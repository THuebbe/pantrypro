// /backend/src/services/inventory.js

import { supabase } from "./supabase.js";
import { convertQuantity, normalizeUnit } from "./units.js";

/**
 * Get all inventory items for a restaurant
 * @param {string} restaurantId - Restaurant UUID
 * @returns {Promise<Array>} Array of inventory items with ingredient details
 */
export async function getInventoryList(restaurantId) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	try {
		const { data, error } = await supabase
			.from("restaurant_inventory")
			.select(
				`
        *,
        ingredient_library (
          id,
          name,
          category,
          unit
        )
      `
			)
			.eq("restaurant_id", restaurantId)
			.order("created_at", { ascending: false });

		if (error) throw error;

		// Transform data to match frontend expected format
		const inventory = data.map((item) => ({
			id: item.id,
			ingredient_id: item.ingredient_id,
			ingredient_name: item.ingredient_library?.name || "Unknown",
			category: item.ingredient_library?.category || "uncategorized",
			quantity: parseFloat(item.quantity),
			unit: item.unit,
			minimum_quantity: item.minimum_quantity
				? parseFloat(item.minimum_quantity)
				: null,
			cost_per_unit: item.cost_per_unit ? parseFloat(item.cost_per_unit) : null,
			location: item.location,
			expiration_date: item.expiration_date,
			last_restocked: item.last_restocked,
		}));

		return inventory;
	} catch (error) {
		console.error("Error getting inventory list:", error);
		throw new Error(`Failed to get inventory: ${error.message}`);
	}
}

/**
 * Look up ingredient by barcode
 * @param {string} barcode - Barcode/UPC to search
 * @returns {Promise<Object>} Ingredient details
 */
export async function lookupIngredientByBarcode(barcode) {
	try {
		const { data, error } = await supabase
			.from("ingredient_library")
			.select("*")
			.eq("barcode", barcode)
			.single();

		if (error) {
			if (error.code === "PGRST116") {
				// No rows returned
				throw new Error("Ingredient not found");
			}
			throw error;
		}

		return data;
	} catch (error) {
		console.error("Error looking up ingredient:", error);
		throw error;
	}
}

/**
 * Receive inventory items (add to stock)
 * @param {string} restaurantId - Restaurant UUID
 * @param {Array} items - Array of items to receive
 * @returns {Promise<Object>} Result with updated items
 */
export async function receiveInventory(restaurantId, items) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	try {
		const updatedItems = [];

		for (const item of items) {
			// Check if inventory item already exists
			const { data: existing, error: findError } = await supabase
				.from("restaurant_inventory")
				.select("*")
				.eq("restaurant_id", restaurantId)
				.eq("ingredient_id", item.ingredientId)
				.single();

			if (findError && findError.code !== "PGRST116") {
				// Error other than "not found"
				throw findError;
			}

			const now = new Date().toISOString();

			if (existing) {
				// Update existing inventory - add to quantity
				const newQuantity =
					parseFloat(existing.quantity) + parseFloat(item.quantity);

				const { data: updated, error: updateError } = await supabase
					.from("restaurant_inventory")
					.update({
						quantity: newQuantity,
						last_restocked: now,
						expiration_date: item.expirationDate || existing.expiration_date,
						updated_at: now,
					})
					.eq("id", existing.id)
					.select()
					.single();

				if (updateError) throw updateError;
				updatedItems.push(updated);
			} else {
				// Create new inventory record
				const { data: created, error: createError } = await supabase
					.from("restaurant_inventory")
					.insert({
						restaurant_id: restaurantId,
						ingredient_id: item.ingredientId,
						quantity: parseFloat(item.quantity),
						unit: item.unit,
						location: item.location,
						expiration_date: item.expirationDate,
						last_restocked: now,
						created_at: now,
						updated_at: now,
					})
					.select()
					.single();

				if (createError) throw createError;
				updatedItems.push(created);
			}
		}

		return {
			success: true,
			message: `Received ${items.length} items`,
			items: updatedItems,
		};
	} catch (error) {
		console.error("Error receiving inventory:", error);
		throw new Error(`Failed to receive inventory: ${error.message}`);
	}
}

/**
 * Remove inventory items (waste, usage, spoilage)
 * Automatically logs to waste_log table for reporting
 * @param {string} restaurantId - Restaurant UUID
 * @param {Array} items - Array of items to remove with ingredientId, quantity, unit, reason, notes
 * @param {string} userId - User ID who is logging the removal
 * @returns {Promise<Object>} Result with updated items
 */
export async function removeInventory(restaurantId, items, userId) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	// Valid waste reasons
	const validReasons = [
		"spoilage",
		"expired",
		"damaged",
		"over-prep",
		"prep-waste",
		"poor-quality",
		"short-life",
		"usage",
		"donation",
		"discontinued",
	];

	// Waste reasons (Category A)
	const wasteReasons = [
		"spoilage",
		"expired",
		"damaged",
		"over-prep",
		"prep-waste",
		"poor-quality",
		"short-life",
	];

	try {
		const updatedItems = [];

		for (const item of items) {
			// Validate reason
			if (!validReasons.includes(item.reason)) {
				throw new Error(
					`Invalid reason "${item.reason}". Must be one of: ${validReasons.join(
						", "
					)}`
				);
			}

			// Determine category
			const category = wasteReasons.includes(item.reason)
				? "waste"
				: "reduction";

			// Find the inventory item
			const { data: existing, error: findError } = await supabase
				.from("restaurant_inventory")
				.select("*")
				.eq("restaurant_id", restaurantId)
				.eq("ingredient_id", item.ingredientId)
				.single();

			if (findError) {
				if (findError.code === "PGRST116") {
					throw new Error(
						`Inventory item not found for ingredient: ${item.ingredientId}`
					);
				}
				throw findError;
			}

			// Calculate new quantity
			const currentQuantity = parseFloat(existing.quantity);
			const removeQuantity = parseFloat(item.quantity);
			const newQuantity = currentQuantity - removeQuantity;

			// Don't allow negative inventory
			if (newQuantity < 0) {
				throw new Error(
					`Cannot remove ${removeQuantity} ${item.unit} - only ${currentQuantity} ${item.unit} available`
				);
			}

			// Calculate cost value
			const costPerUnit = parseFloat(existing.cost_per_unit || 0);
			const costValue = removeQuantity * costPerUnit;

			// Update inventory quantity
			const now = new Date().toISOString();
			const { data: updated, error: updateError } = await supabase
				.from("restaurant_inventory")
				.update({
					quantity: newQuantity,
					updated_at: now,
				})
				.eq("id", existing.id)
				.select()
				.single();

			if (updateError) throw updateError;

			// ✅ NEW: Log to waste_log table
			const { data: wasteLog, error: wasteLogError } = await supabase
				.from("waste_log")
				.insert({
					restaurant_id: restaurantId,
					ingredient_id: item.ingredientId,
					inventory_id: existing.id,
					quantity: removeQuantity,
					unit: item.unit,
					cost_value: costValue,
					reason: item.reason,
					category: category,
					notes: item.notes || null,
					logged_by: userId,
					logged_at: now,
					created_at: now,
					updated_at: now,
				})
				.select()
				.single();

			if (wasteLogError) {
				console.error("⚠️ Failed to log waste (non-critical):", wasteLogError);
				// Don't fail the whole operation if waste logging fails
				// This ensures inventory still updates even if waste_log has issues
			}

			updatedItems.push({
				id: updated.id,
				ingredient_id: updated.ingredient_id,
				new_quantity: parseFloat(updated.quantity),
				removed_quantity: removeQuantity,
				cost_value: parseFloat(costValue.toFixed(2)),
				reason: item.reason,
				category: category,
				notes: item.notes || null,
			});
		}

		return {
			success: true,
			message: `Removed ${items.length} items from inventory`,
			items: updatedItems,
		};
	} catch (error) {
		console.error("Error removing inventory:", error);
		throw error;
	}
}

/**
 * Deduct ingredient from inventory (used by sales auto-deduction)
 * @param {string} restaurantId - Restaurant UUID
 * @param {string} ingredientId - Ingredient library UUID
 * @param {number} quantity - Amount to deduct
 * @param {string} unit - Unit of measurement
 * @returns {Promise<Object>} Updated inventory record
 */
export async function deductIngredient(restaurantId, ingredientId, quantity, unit) {
	if (!restaurantId || !ingredientId) {
		throw new Error("Restaurant ID and Ingredient ID are required");
	}

	try {
		// Find the inventory item
		const { data: existing, error: findError } = await supabase
			.from("restaurant_inventory")
			.select("*")
			.eq("restaurant_id", restaurantId)
			.eq("ingredient_id", ingredientId)
			.single();

		if (findError) {
			if (findError.code === "PGRST116") {
				throw new Error(`Inventory item not found for ingredient: ${ingredientId}`);
			}
			throw findError;
		}

		const currentQuantity = parseFloat(existing.quantity);

		// The amount arrives in the recipe's unit (6 oz) and stock is counted
		// in the inventory item's unit (lbs), so convert before subtracting.
		let deductQuantity = parseFloat(quantity);

		if (unit && existing.unit && normalizeUnit(unit) !== normalizeUnit(existing.unit)) {
			const converted = convertQuantity(deductQuantity, unit, existing.unit);

			if (converted === null) {
				throw new Error(
					`Recipe uses ${unit} but this item is counted in ${existing.unit}; the two can't be converted`
				);
			}

			deductQuantity = converted;
		}

		const newQuantity = Math.max(0, currentQuantity - deductQuantity);

		const now = new Date().toISOString();
		const { data: updated, error: updateError } = await supabase
			.from("restaurant_inventory")
			.update({
				quantity: newQuantity,
				updated_at: now,
			})
			.eq("id", existing.id)
			.select()
			.single();

		if (updateError) throw updateError;

		return {
			inventoryId: updated.id,
			ingredientId,
			previousQuantity: currentQuantity,
			deductedQuantity: deductQuantity,
			inventoryUnit: existing.unit,
			newQuantity: parseFloat(updated.quantity),
			wentNegative: currentQuantity - deductQuantity < 0,
		};
	} catch (error) {
		console.error("Error deducting ingredient:", error);
		throw error;
	}
}
