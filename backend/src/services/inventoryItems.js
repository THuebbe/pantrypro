// /backend/src/services/inventoryItems.js

/**
 * Adding items to a restaurant's inventory by hand
 *
 * An owner can pick an item from the shared catalog or type in their own.
 * Either way the result is one row in restaurant_inventory. An item the
 * owner types in also gets a row in ingredient_library, marked as not part
 * of the shared catalog, so other restaurants never see it.
 */

import { supabase } from "./supabase.js";
import { KNOWN_UNITS, normalizeUnit } from "./units.js";

export const STORAGE_TYPES = ["dry", "refrigerated", "frozen"];

const NAME_MAX = 120;
const TEXT_MAX = 60;

/**
 * An error whose message is safe and useful to show the owner
 */
export class InventoryItemError extends Error {
	constructor(message, status = 400) {
		super(message);
		this.name = "InventoryItemError";
		this.status = status;
	}
}

function optionalNumber(value, label) {
	if (value === undefined || value === null || value === "") return null;

	const number = Number(value);

	if (!Number.isFinite(number) || number < 0) {
		throw new InventoryItemError(`${label} must be zero or more`);
	}

	return number;
}

function optionalText(value, max = TEXT_MAX) {
	if (typeof value !== "string") return null;

	const trimmed = value.trim();

	return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Check and tidy what the owner entered. No database access.
 * @param {object} input - Request body
 * @returns {object} Clean values
 */
export function validateNewItem(input = {}) {
	const ingredientId = optionalText(input.ingredientId, 64);
	const name = optionalText(input.name, NAME_MAX);

	if (!ingredientId && !name) {
		throw new InventoryItemError("Enter a name for the item");
	}

	// A catalog item brings its own unit; a new item must say how it's counted.
	let unit = null;
	if (input.unit !== undefined && input.unit !== null && input.unit !== "") {
		unit = normalizeUnit(String(input.unit));

		if (!unit) {
			throw new InventoryItemError(
				`"${input.unit}" isn't a unit the app can use. Choose one of: ${KNOWN_UNITS.join(", ")}`
			);
		}
	} else if (!ingredientId) {
		throw new InventoryItemError("Choose the unit this item is counted in");
	}

	const storageType = optionalText(input.storageType);
	if (storageType && !STORAGE_TYPES.includes(storageType)) {
		throw new InventoryItemError(
			`Storage must be one of: ${STORAGE_TYPES.join(", ")}`
		);
	}

	return {
		ingredientId,
		name,
		unit,
		category: optionalText(input.category),
		storageType,
		location: optionalText(input.location),
		quantity: optionalNumber(input.quantity, "Quantity on hand") ?? 0,
		costPerUnit: optionalNumber(input.costPerUnit, "Cost"),
		minimumQuantity: optionalNumber(input.minimumQuantity, "Minimum quantity"),
	};
}

/**
 * Catalog items this restaurant hasn't added yet
 * @param {string} restaurantId - Restaurant UUID
 * @returns {Promise<Array>} [{ id, name, category, unit, storageType }]
 */
export async function getCatalogForRestaurant(restaurantId) {
	const [catalog, inventory] = await Promise.all([
		supabase
			.from("ingredient_library")
			.select("id, name, category, unit, storage_type")
			.eq("is_platform", true)
			.order("name"),
		supabase
			.from("restaurant_inventory")
			.select("ingredient_id")
			.eq("restaurant_id", restaurantId),
	]);

	if (catalog.error) throw catalog.error;
	if (inventory.error) throw inventory.error;

	const stocked = new Set((inventory.data || []).map((row) => row.ingredient_id));

	return (catalog.data || [])
		.filter((item) => !stocked.has(item.id) && normalizeUnit(item.unit))
		.map((item) => ({
			id: item.id,
			name: item.name,
			category: item.category,
			unit: normalizeUnit(item.unit),
			storageType: item.storage_type,
		}));
}

/**
 * Add one item to a restaurant's inventory
 * @param {object} params
 * @param {string} params.restaurantId - Restaurant UUID
 * @param {string} params.userId - Who is adding it
 * @param {object} params.input - Request body
 * @returns {Promise<Object>} The new inventory item, shaped like GET /api/inventory rows
 */
export async function addInventoryItem({ restaurantId, userId, input }) {
	if (!restaurantId) {
		throw new InventoryItemError("No restaurant found for this account", 404);
	}

	const item = validateNewItem(input);

	// What this restaurant already stocks, for duplicate checks
	const { data: current, error: currentError } = await supabase
		.from("restaurant_inventory")
		.select("ingredient_id, ingredient:ingredient_library(name)")
		.eq("restaurant_id", restaurantId);

	if (currentError) throw currentError;

	let ingredient;
	let createdIngredientId = null;

	if (item.ingredientId) {
		const { data, error } = await supabase
			.from("ingredient_library")
			.select("id, name, category, unit, is_platform")
			.eq("id", item.ingredientId)
			.maybeSingle();

		// Only shared catalog items can be picked by id. Another restaurant's
		// own item must not be reachable by guessing its id.
		if (error || !data || !data.is_platform) {
			throw new InventoryItemError("That catalog item wasn't found", 404);
		}

		if ((current || []).some((row) => row.ingredient_id === data.id)) {
			throw new InventoryItemError(
				`${data.name} is already in your inventory`,
				409
			);
		}

		ingredient = data;
	} else {
		const wanted = item.name.toLowerCase();

		if (
			(current || []).some(
				(row) => (row.ingredient?.name || "").trim().toLowerCase() === wanted
			)
		) {
			throw new InventoryItemError(
				`${item.name} is already in your inventory`,
				409
			);
		}

		const { data, error } = await supabase
			.from("ingredient_library")
			.insert({
				name: item.name,
				category: item.category,
				unit: item.unit,
				storage_type: item.storageType,
				is_platform: false,
				created_by: userId || null,
			})
			.select("id, name, category, unit")
			.single();

		if (error) throw error;

		ingredient = data;
		createdIngredientId = data.id;
	}

	const unit = item.unit || normalizeUnit(ingredient.unit);

	if (!unit) {
		throw new InventoryItemError("Choose the unit this item is counted in");
	}

	const now = new Date().toISOString();

	const { data: created, error: createError } = await supabase
		.from("restaurant_inventory")
		.insert({
			restaurant_id: restaurantId,
			ingredient_id: ingredient.id,
			quantity: item.quantity,
			unit,
			minimum_quantity: item.minimumQuantity,
			cost_per_unit: item.costPerUnit,
			location: item.location,
			last_restocked: item.quantity > 0 ? now : null,
			created_at: now,
			updated_at: now,
		})
		.select()
		.single();

	if (createError) {
		// Don't leave a catalog entry behind that nobody stocks.
		if (createdIngredientId) {
			await supabase
				.from("ingredient_library")
				.delete()
				.eq("id", createdIngredientId);
		}

		if (createError.code === "23505") {
			throw new InventoryItemError(
				`${ingredient.name} is already in your inventory`,
				409
			);
		}

		throw createError;
	}

	return {
		id: created.id,
		ingredient_id: created.ingredient_id,
		ingredient_name: ingredient.name,
		category: ingredient.category,
		quantity: created.quantity,
		unit: created.unit,
		minimum_quantity: created.minimum_quantity,
		cost_per_unit: created.cost_per_unit,
		location: created.location,
		expiration_date: created.expiration_date,
		last_restocked: created.last_restocked,
	};
}
