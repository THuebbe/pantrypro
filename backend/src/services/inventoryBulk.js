// /backend/src/services/inventoryBulk.js

/**
 * Bulk changes to a restaurant's inventory
 *
 * Two jobs, kept apart on purpose:
 *
 * - Bulk add puts NEW items in, from a spreadsheet or a paste. A row for an
 *   item the restaurant already stocks is skipped, never overwritten, so an
 *   old file can't wipe out quantities that sales have been moving since.
 *
 * - Count sets EXISTING items to what was physically counted. Every counted
 *   item is written to inventory_adjustments with the before and after
 *   numbers, so the difference (the variance) isn't lost.
 *
 * The planning steps are plain functions with no database access, so the
 * rules can be tested on their own.
 */

import { randomUUID } from "node:crypto";
import { supabase } from "./supabase.js";
import { normalizeUnit } from "./units.js";
import { InventoryItemError, validateNewItem } from "./inventoryItems.js";

export const MAX_BULK_ROWS = 500;

export const COUNT_REASONS = {
	cycle_count: "Cycle count",
	initial_count: "Starting count",
	correction: "Correction",
};

const NOTE_MAX = 300;
const UPDATE_CHUNK = 25;

/**
 * Template rows begin "Example" so people can see the format. They are
 * dropped rather than added if someone forgets to delete them.
 * @param {object} row
 * @returns {boolean}
 */
export function isExampleRow(row) {
	return /^example\b/i.test(String(row?.name ?? "").trim());
}

function nameKey(name) {
	return String(name ?? "")
		.trim()
		.replace(/\s+/g, " ")
		.toLowerCase();
}

function checkRows(rows) {
	if (!Array.isArray(rows) || rows.length === 0) {
		throw new InventoryItemError("There are no rows to add");
	}

	if (rows.length > MAX_BULK_ROWS) {
		throw new InventoryItemError(
			`That's ${rows.length} rows. Add up to ${MAX_BULK_ROWS} at a time.`
		);
	}
}

/**
 * Decide what happens to each row. No database access.
 * @param {Array<object>} rows - [{ name, unit, quantity, costPerUnit, category,
 *   minimumQuantity, location, storageType }]
 * @param {object} context
 * @param {Set<string>} context.stockedNames - Lower-case names already stocked
 * @param {Map<string, object>} context.catalogByName - Shared catalog items by
 *   lower-case name: { id, name, unit, category }
 * @returns {Array<object>} One entry per row:
 *   { row, status: "new"|"catalog"|"exists"|"error", name, message?, item? }
 */
export function planBulkAdd(rows, { stockedNames, catalogByName }) {
	const seen = new Set();

	return rows.map((input, index) => {
		const row = index + 1;
		const name = String(input?.name ?? "")
			.trim()
			.replace(/\s+/g, " ");
		const key = name.toLowerCase();

		try {
			if (!name) {
				throw new InventoryItemError("Enter a name for the item");
			}

			if (stockedNames.has(key)) {
				return {
					row,
					status: "exists",
					name,
					message: `${name} is already in your inventory. Use Count to change how many you have.`,
				};
			}

			if (seen.has(key)) {
				throw new InventoryItemError(`${name} is in this list more than once`);
			}
			seen.add(key);

			const catalogItem = catalogByName.get(key);

			const clean = validateNewItem(
				catalogItem
					? { ...input, name: undefined, ingredientId: catalogItem.id }
					: { ...input, name }
			);

			const unit = clean.unit || normalizeUnit(catalogItem?.unit);
			if (!unit) {
				throw new InventoryItemError("Choose the unit this item is counted in");
			}

			return {
				row,
				status: catalogItem ? "catalog" : "new",
				name: catalogItem ? catalogItem.name : clean.name,
				item: {
					...clean,
					name: catalogItem ? catalogItem.name : clean.name,
					unit,
					category: clean.category || catalogItem?.category || null,
				},
			};
		} catch (error) {
			if (error instanceof InventoryItemError) {
				return { row, status: "error", name, message: error.message };
			}
			throw error;
		}
	});
}

async function loadAddContext(restaurantId) {
	const [inventory, catalog] = await Promise.all([
		supabase
			.from("restaurant_inventory")
			.select("ingredient_id, ingredient:ingredient_library(name)")
			.eq("restaurant_id", restaurantId),
		supabase
			.from("ingredient_library")
			.select("id, name, unit, category")
			.eq("is_platform", true),
	]);

	if (inventory.error) throw inventory.error;
	if (catalog.error) throw catalog.error;

	const stockedIds = new Set();
	const stockedNames = new Set();
	for (const row of inventory.data || []) {
		stockedIds.add(row.ingredient_id);
		if (row.ingredient?.name) stockedNames.add(nameKey(row.ingredient.name));
	}

	const catalogByName = new Map();
	for (const item of catalog.data || []) {
		const key = nameKey(item.name);
		// A catalog item already stocked counts as stocked by name too.
		if (stockedIds.has(item.id)) {
			stockedNames.add(key);
			continue;
		}
		if (!catalogByName.has(key)) catalogByName.set(key, item);
	}

	return { stockedNames, catalogByName };
}

function summarize(plan, examplesSkipped) {
	const count = (status) => plan.filter((p) => p.status === status).length;

	return {
		rows: plan,
		examplesSkipped,
		ready: count("new") + count("catalog"),
		exists: count("exists"),
		errors: count("error"),
	};
}

/**
 * Check rows without saving anything
 * @param {object} params
 * @param {string} params.restaurantId
 * @param {Array<object>} params.rows
 */
export async function previewBulkAdd({ restaurantId, rows }) {
	if (!restaurantId) {
		throw new InventoryItemError("No restaurant found for this account", 404);
	}
	checkRows(rows);

	const realRows = rows.filter((row) => !isExampleRow(row));
	if (realRows.length === 0) {
		throw new InventoryItemError(
			"Only the example rows are filled in. Add your own items below them."
		);
	}

	const plan = planBulkAdd(realRows, await loadAddContext(restaurantId));

	return summarize(plan, rows.length - realRows.length);
}

/**
 * Add every row that checks out; report the rest
 * @param {object} params
 * @param {string} params.restaurantId
 * @param {string} params.userId
 * @param {Array<object>} params.rows
 * @returns {Promise<object>} { added, items, skipped, examplesSkipped }
 */
export async function commitBulkAdd({ restaurantId, userId, rows }) {
	const preview = await previewBulkAdd({ restaurantId, rows });
	const toAdd = preview.rows.filter(
		(p) => p.status === "new" || p.status === "catalog"
	);
	const skipped = preview.rows.filter(
		(p) => p.status === "exists" || p.status === "error"
	);

	if (toAdd.length === 0) {
		return {
			added: 0,
			items: [],
			skipped,
			examplesSkipped: preview.examplesSkipped,
		};
	}

	// 1. The owner's own items get a private catalog entry first.
	const newOnes = toAdd.filter((p) => p.status === "new");
	const createdIds = [];
	const idByName = new Map();

	if (newOnes.length > 0) {
		const { data, error } = await supabase
			.from("ingredient_library")
			.insert(
				newOnes.map((p) => ({
					name: p.item.name,
					category: p.item.category,
					unit: p.item.unit,
					storage_type: p.item.storageType,
					is_platform: false,
					created_by: userId || null,
				}))
			)
			.select("id, name");

		if (error) throw error;

		for (const created of data || []) {
			createdIds.push(created.id);
			idByName.set(nameKey(created.name), created.id);
		}
	}

	// 2. One inventory row per item, in a single insert.
	const now = new Date().toISOString();
	const inventoryRows = toAdd.map((p) => ({
		restaurant_id: restaurantId,
		ingredient_id:
			p.status === "catalog" ? p.item.ingredientId : idByName.get(nameKey(p.name)),
		quantity: p.item.quantity,
		unit: p.item.unit,
		minimum_quantity: p.item.minimumQuantity,
		cost_per_unit: p.item.costPerUnit,
		location: p.item.location,
		last_restocked: p.item.quantity > 0 ? now : null,
		created_at: now,
		updated_at: now,
	}));

	if (inventoryRows.some((r) => !r.ingredient_id)) {
		await removeLibraryRows(createdIds);
		throw new Error("Bulk add lost track of a new item's id");
	}

	const { data: inserted, error: insertError } = await supabase
		.from("restaurant_inventory")
		.insert(inventoryRows)
		.select("id, ingredient_id, quantity, unit");

	if (insertError) {
		// Nothing was added, so don't leave orphan catalog entries behind.
		await removeLibraryRows(createdIds);

		if (insertError.code === "23505") {
			throw new InventoryItemError(
				"Some of these items were added while you were working. Nothing was saved; check the list again.",
				409
			);
		}
		throw insertError;
	}

	const nameById = new Map(
		toAdd.map((p, i) => [inventoryRows[i].ingredient_id, p.name])
	);

	return {
		added: inserted.length,
		items: inserted.map((row) => ({
			id: row.id,
			ingredient_id: row.ingredient_id,
			ingredient_name: nameById.get(row.ingredient_id),
			quantity: row.quantity,
			unit: row.unit,
		})),
		skipped,
		examplesSkipped: preview.examplesSkipped,
	};
}

async function removeLibraryRows(ids) {
	if (ids.length === 0) return;
	await supabase.from("ingredient_library").delete().in("id", ids);
}

/**
 * Work out what a count changes. No database access.
 * @param {Array<{inventoryId: string, quantity: number|string}>} counts
 * @param {Map<string, object>} current - Inventory rows by id:
 *   { id, ingredient_id, quantity, unit, cost_per_unit, name }
 * @returns {Array<object>} One line per counted item
 * @throws {InventoryItemError} When any count is unusable; nothing is saved
 */
export function planCount(counts, current) {
	if (!Array.isArray(counts) || counts.length === 0) {
		throw new InventoryItemError("Enter a count for at least one item");
	}

	if (counts.length > MAX_BULK_ROWS) {
		throw new InventoryItemError(
			`Save up to ${MAX_BULK_ROWS} counts at a time`
		);
	}

	const problems = [];
	const seen = new Set();
	const lines = [];

	for (const entry of counts) {
		const item = current.get(entry?.inventoryId);

		if (!item) {
			problems.push("One of the counted items isn't in your inventory");
			continue;
		}

		if (seen.has(item.id)) {
			problems.push(`${item.name} was counted twice`);
			continue;
		}
		seen.add(item.id);

		const raw = entry.quantity;
		const counted =
			raw === "" || raw === null || raw === undefined ? NaN : Number(raw);

		if (!Number.isFinite(counted) || counted < 0) {
			problems.push(`${item.name}: the count must be zero or more`);
			continue;
		}

		const before = Number(item.quantity) || 0;
		const change = round(counted - before, 4);
		const cost = item.cost_per_unit === null ? null : Number(item.cost_per_unit);

		lines.push({
			inventoryId: item.id,
			ingredientId: item.ingredient_id,
			name: item.name,
			unit: item.unit,
			before,
			after: counted,
			change,
			costPerUnit: Number.isFinite(cost) ? cost : null,
			valueChange: Number.isFinite(cost) ? round(change * cost, 2) : null,
		});
	}

	if (problems.length > 0) {
		throw new InventoryItemError(
			`Nothing was saved. ${[...new Set(problems)].join(". ")}.`
		);
	}

	return lines;
}

// Half away from zero, so a loss of $6.375 is -$6.38 like a gain is +$6.38.
// The epsilon absorbs float noise such as 1.005 * 100 = 100.49999.
function round(value, places) {
	const factor = 10 ** places;
	const scaled = Math.abs(value) * factor;
	return (Math.sign(value) * Math.round(scaled + 1e-9)) / factor || 0;
}

/**
 * Set counted items to the counted quantity and record the variance
 * @param {object} params
 * @param {string} params.restaurantId
 * @param {string} params.userId
 * @param {string} params.reason - A key of COUNT_REASONS
 * @param {string} [params.note]
 * @param {Array<{inventoryId: string, quantity: number}>} params.counts
 */
export async function saveCount({ restaurantId, userId, reason, note, counts }) {
	if (!restaurantId) {
		throw new InventoryItemError("No restaurant found for this account", 404);
	}

	const reasonKey = reason || "cycle_count";
	if (!COUNT_REASONS[reasonKey]) {
		throw new InventoryItemError(
			`Reason must be one of: ${Object.keys(COUNT_REASONS).join(", ")}`
		);
	}

	const ids = Array.isArray(counts)
		? [...new Set(counts.map((c) => c?.inventoryId).filter(Boolean))]
		: [];

	const current = new Map();
	if (ids.length > 0) {
		const { data, error } = await supabase
			.from("restaurant_inventory")
			.select(
				"id, ingredient_id, quantity, unit, cost_per_unit, ingredient:ingredient_library(name)"
			)
			.eq("restaurant_id", restaurantId)
			.in("id", ids);

		if (error) throw error;

		for (const row of data || []) {
			current.set(row.id, { ...row, name: row.ingredient?.name || "An item" });
		}
	}

	const lines = planCount(counts, current);
	const now = new Date().toISOString();

	// Only items whose number actually moved need writing.
	const changed = lines.filter((line) => line.change !== 0);
	const failed = [];

	for (let i = 0; i < changed.length; i += UPDATE_CHUNK) {
		const chunk = changed.slice(i, i + UPDATE_CHUNK);
		const results = await Promise.all(
			chunk.map((line) =>
				supabase
					.from("restaurant_inventory")
					.update({ quantity: line.after, updated_at: now })
					.eq("id", line.inventoryId)
					.eq("restaurant_id", restaurantId)
			)
		);

		results.forEach((result, j) => {
			if (result.error) failed.push(chunk[j]);
		});
	}

	const failedIds = new Set(failed.map((line) => line.inventoryId));
	const saved = lines.filter((line) => !failedIds.has(line.inventoryId));

	// Every counted item is recorded, including ones that matched, so
	// "last counted" and zero-variance counts are kept too.
	const batchId = randomUUID();
	const cleanNote =
		typeof note === "string" && note.trim() ? note.trim().slice(0, NOTE_MAX) : null;

	let historySaved = false;
	if (saved.length > 0) {
		const { error: logError } = await supabase.from("inventory_adjustments").insert(
			saved.map((line) => ({
				restaurant_id: restaurantId,
				inventory_id: line.inventoryId,
				ingredient_id: line.ingredientId,
				batch_id: batchId,
				reason: reasonKey,
				note: cleanNote,
				quantity_before: line.before,
				quantity_after: line.after,
				quantity_change: line.change,
				unit: line.unit,
				cost_per_unit: line.costPerUnit,
				value_change: line.valueChange,
				adjusted_by: userId || null,
				adjusted_at: now,
			}))
		);

		if (logError) {
			// The quantities are already right; losing the history shouldn't undo
			// the count. Say so instead.
			console.error("Couldn't record count history:", logError.message);
		} else {
			historySaved = true;
		}
	}

	const valueChange = round(
		saved.reduce((sum, line) => sum + (line.valueChange || 0), 0),
		2
	);

	return {
		batchId,
		counted: saved.length,
		changed: saved.filter((line) => line.change !== 0).length,
		valueChange,
		historySaved,
		failed: failed.map((line) => line.name),
		lines: saved,
	};
}
