// /backend/src/tests/unit/inventoryBulk.test.js
// Unit tests for bulk add and counts. No network or database.
// Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY ||= "test";
process.env.SUPABASE_ANON_KEY ||= "test";

const { supabase } = await import("../../services/supabase.js");
const { InventoryItemError } = await import("../../services/inventoryItems.js");
const {
	MAX_BULK_ROWS,
	isExampleRow,
	planBulkAdd,
	planCount,
	previewBulkAdd,
	commitBulkAdd,
	saveCount,
} = await import("../../services/inventoryBulk.js");

const RESTAURANT = "rest-1";

/**
 * In-memory stand-in for the tables bulk add and count touch.
 * Supports the query shapes the service uses and nothing more.
 */
function fakeDatabase(t, seed = {}) {
	const tables = {
		ingredient_library: [...(seed.ingredient_library || [])],
		restaurant_inventory: [...(seed.restaurant_inventory || [])],
		inventory_adjustments: [],
	};
	const options = { failInventoryInsert: null, noHistoryTable: false, ...seed.options };
	let nextId = 1;

	const withJoin = (table, row) =>
		table === "restaurant_inventory"
			? {
					...row,
					ingredient: tables.ingredient_library.find((i) => i.id === row.ingredient_id) || null,
			  }
			: row;

	t.mock.method(supabase, "from", (table) => {
		const filters = [];
		let action = "select";
		let payload = null;

		const matches = (row) => filters.every((f) => f(row));

		const run = () => {
			if (action === "insert") {
				if (table === "inventory_adjustments" && options.noHistoryTable) {
					return { data: null, error: { code: "42P01", message: "relation does not exist" } };
				}
				if (table === "restaurant_inventory" && options.failInventoryInsert) {
					return { data: null, error: options.failInventoryInsert };
				}
				const rows = (Array.isArray(payload) ? payload : [payload]).map((r) => ({
					id: `${table}-${nextId++}`,
					...r,
				}));
				tables[table].push(...rows);
				return { data: rows, error: null };
			}

			if (action === "update") {
				const hit = tables[table].filter(matches);
				hit.forEach((row) => Object.assign(row, payload));
				return { data: hit, error: null };
			}

			if (action === "delete") {
				tables[table] = tables[table].filter((row) => !matches(row));
				return { data: null, error: null };
			}

			return {
				data: tables[table].filter(matches).map((row) => withJoin(table, row)),
				error: null,
			};
		};

		const builder = {
			select: () => builder,
			insert: (rows) => ((action = "insert"), (payload = rows), builder),
			update: (values) => ((action = "update"), (payload = values), builder),
			delete: () => ((action = "delete"), builder),
			eq: (column, value) => (filters.push((row) => row[column] === value), builder),
			in: (column, values) => (filters.push((row) => values.includes(row[column])), builder),
			then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
		};

		return builder;
	});

	return tables;
}

const CATALOG = [
	{ id: "cat-beef", name: "Ground Beef (80/20)", unit: "lbs", category: "Meat", is_platform: true },
	{ id: "cat-buns", name: "Hot Dog Buns", unit: "dozen", category: "Bakery", is_platform: true },
];

// ---------- pure planning ----------

test("example rows from the template are recognised", () => {
	assert.equal(isExampleRow({ name: "Example: Ground beef" }), true);
	assert.equal(isExampleRow({ name: "EXAMPLE - buns" }), true);
	assert.equal(isExampleRow({ name: "Examples of nothing" }), false);
	assert.equal(isExampleRow({ name: "Onions" }), false);
});

test("planBulkAdd sorts rows into new, catalog, exists and error", () => {
	const plan = planBulkAdd(
		[
			{ name: "Bell Peppers", unit: "lbs", quantity: "5", costPerUnit: "1.99" },
			{ name: "hot dog buns", quantity: 4 },
			{ name: "Mustard", unit: "gal" },
			{ name: "Relish", unit: "case" },
			{ name: "Bell  Peppers", unit: "lbs" },
			{ name: "", unit: "lbs" },
			{ name: "Onions", quantity: "-2", unit: "lbs" },
		],
		{
			stockedNames: new Set(["mustard"]),
			catalogByName: new Map([["hot dog buns", CATALOG[1]]]),
		}
	);

	assert.deepEqual(
		plan.map((p) => p.status),
		["new", "catalog", "exists", "error", "error", "error", "error"]
	);
	assert.equal(plan[0].item.quantity, 5);
	assert.equal(plan[0].item.costPerUnit, 1.99);
	assert.equal(plan[1].name, "Hot Dog Buns");
	assert.equal(plan[1].item.unit, "dozen");
	assert.equal(plan[1].item.ingredientId, "cat-buns");
	assert.match(plan[2].message, /Use Count/);
	assert.match(plan[3].message, /"case" isn't a unit/);
	assert.match(plan[4].message, /more than once/);
	assert.match(plan[5].message, /Enter a name/);
	assert.match(plan[6].message, /zero or more/);
	assert.deepEqual(
		plan.map((p) => p.row),
		[1, 2, 3, 4, 5, 6, 7]
	);
});

test("planBulkAdd needs a unit for an item that isn't in the catalog", () => {
	const [only] = planBulkAdd([{ name: "Secret Sauce" }], {
		stockedNames: new Set(),
		catalogByName: new Map(),
	});

	assert.equal(only.status, "error");
	assert.match(only.message, /unit/);
});

test("planCount works out the change and its dollar value", () => {
	const current = new Map([
		["inv-1", { id: "inv-1", ingredient_id: "i1", name: "Beef", quantity: "10", unit: "lbs", cost_per_unit: "4.25" }],
		["inv-2", { id: "inv-2", ingredient_id: "i2", name: "Buns", quantity: 3, unit: "dozen", cost_per_unit: null }],
	]);

	const lines = planCount(
		[
			{ inventoryId: "inv-1", quantity: "8.5" },
			{ inventoryId: "inv-2", quantity: 3 },
		],
		current
	);

	assert.equal(lines[0].change, -1.5);
	assert.equal(lines[0].valueChange, -6.38);
	assert.equal(lines[1].change, 0);
	assert.equal(lines[1].valueChange, null);
});

test("planCount saves nothing if any count is bad", () => {
	const current = new Map([
		["inv-1", { id: "inv-1", ingredient_id: "i1", name: "Beef", quantity: 10, unit: "lbs" }],
	]);

	assert.throws(
		() =>
			planCount(
				[
					{ inventoryId: "inv-1", quantity: "" },
					{ inventoryId: "someone-elses", quantity: 4 },
				],
				current
			),
		(error) =>
			error instanceof InventoryItemError &&
			/Nothing was saved/.test(error.message) &&
			/Beef/.test(error.message) &&
			/isn't in your inventory/.test(error.message)
	);

	assert.throws(() => planCount([], current), /at least one/);
	assert.throws(
		() =>
			planCount(
				[
					{ inventoryId: "inv-1", quantity: 1 },
					{ inventoryId: "inv-1", quantity: 2 },
				],
				current
			),
		/counted twice/
	);
});

// ---------- with the fake database ----------

test("preview skips template examples and flags items already stocked", async (t) => {
	fakeDatabase(t, {
		ingredient_library: [...CATALOG],
		restaurant_inventory: [
			{ id: "inv-1", restaurant_id: RESTAURANT, ingredient_id: "cat-beef", quantity: 10 },
		],
	});

	const result = await previewBulkAdd({
		restaurantId: RESTAURANT,
		rows: [
			{ name: "Example: Ground beef", unit: "lbs" },
			{ name: "ground beef (80/20)", unit: "lbs" },
			{ name: "Hot Dog Buns" },
		],
	});

	assert.equal(result.examplesSkipped, 1);
	assert.equal(result.exists, 1);
	assert.equal(result.ready, 1);
	assert.equal(result.rows[1].status, "catalog");
});

test("preview refuses a file with only the examples, or too many rows", async (t) => {
	fakeDatabase(t, { ingredient_library: [...CATALOG] });

	await assert.rejects(
		previewBulkAdd({ restaurantId: RESTAURANT, rows: [{ name: "Example: beef" }] }),
		/Only the example rows/
	);

	await assert.rejects(
		previewBulkAdd({
			restaurantId: RESTAURANT,
			rows: Array.from({ length: MAX_BULK_ROWS + 1 }, (_, i) => ({ name: `x${i}`, unit: "each" })),
		}),
		/up to 500/
	);

	await assert.rejects(previewBulkAdd({ restaurantId: null, rows: [{}] }), /No restaurant/);
});

test("bulk add saves good rows in one go and returns the rest", async (t) => {
	const tables = fakeDatabase(t, { ingredient_library: [...CATALOG] });

	const result = await commitBulkAdd({
		restaurantId: RESTAURANT,
		userId: "user-1",
		rows: [
			{ name: "Bell Peppers", unit: "lb", quantity: 5, costPerUnit: 1.99, category: "Produce" },
			{ name: "Hot Dog Buns", quantity: 4 },
			{ name: "Relish", unit: "case" },
		],
	});

	assert.equal(result.added, 2);
	assert.equal(result.skipped.length, 1);
	assert.equal(result.skipped[0].name, "Relish");

	const own = tables.ingredient_library.find((i) => i.name === "Bell Peppers");
	assert.equal(own.is_platform, false);
	assert.equal(own.created_by, "user-1");
	assert.equal(own.unit, "lbs");

	const stocked = tables.restaurant_inventory;
	assert.equal(stocked.length, 2);
	assert.ok(stocked.every((r) => r.restaurant_id === RESTAURANT));
	assert.equal(stocked.find((r) => r.ingredient_id === "cat-buns").quantity, 4);
	assert.equal(stocked.find((r) => r.ingredient_id === own.id).cost_per_unit, 1.99);
	assert.deepEqual(
		result.items.map((i) => i.ingredient_name).sort(),
		["Bell Peppers", "Hot Dog Buns"]
	);
});

test("bulk add leaves no orphan catalog entries when the insert fails", async (t) => {
	const tables = fakeDatabase(t, {
		ingredient_library: [...CATALOG],
		options: { failInventoryInsert: { code: "23505", message: "duplicate" } },
	});

	await assert.rejects(
		commitBulkAdd({
			restaurantId: RESTAURANT,
			userId: "user-1",
			rows: [{ name: "Bell Peppers", unit: "lbs" }],
		}),
		(error) => error instanceof InventoryItemError && error.status === 409
	);

	assert.equal(tables.ingredient_library.length, CATALOG.length);
	assert.equal(tables.restaurant_inventory.length, 0);
});

test("a count updates only changed items and records every counted item", async (t) => {
	const tables = fakeDatabase(t, {
		ingredient_library: [...CATALOG],
		restaurant_inventory: [
			{ id: "inv-1", restaurant_id: RESTAURANT, ingredient_id: "cat-beef", quantity: 10, unit: "lbs", cost_per_unit: 4 },
			{ id: "inv-2", restaurant_id: RESTAURANT, ingredient_id: "cat-buns", quantity: 3, unit: "dozen", cost_per_unit: 2.5 },
			{ id: "inv-other", restaurant_id: "rest-2", ingredient_id: "cat-beef", quantity: 99, unit: "lbs" },
		],
	});

	const result = await saveCount({
		restaurantId: RESTAURANT,
		userId: "user-1",
		reason: "cycle_count",
		note: "  Monday close  ",
		counts: [
			{ inventoryId: "inv-1", quantity: 7 },
			{ inventoryId: "inv-2", quantity: 3 },
		],
	});

	assert.equal(result.counted, 2);
	assert.equal(result.changed, 1);
	assert.equal(result.valueChange, -12);
	assert.equal(result.historySaved, true);

	assert.equal(tables.restaurant_inventory.find((r) => r.id === "inv-1").quantity, 7);
	assert.equal(tables.restaurant_inventory.find((r) => r.id === "inv-other").quantity, 99);

	const history = tables.inventory_adjustments;
	assert.equal(history.length, 2);
	assert.ok(history.every((h) => h.batch_id === result.batchId));
	assert.equal(history[0].quantity_before, 10);
	assert.equal(history[0].quantity_after, 7);
	assert.equal(history[0].note, "Monday close");
});

test("a count can't reach another restaurant's item", async (t) => {
	const tables = fakeDatabase(t, {
		restaurant_inventory: [
			{ id: "inv-other", restaurant_id: "rest-2", ingredient_id: "cat-beef", quantity: 99, unit: "lbs" },
		],
	});

	await assert.rejects(
		saveCount({
			restaurantId: RESTAURANT,
			counts: [{ inventoryId: "inv-other", quantity: 0 }],
		}),
		/isn't in your inventory/
	);
	assert.equal(tables.restaurant_inventory[0].quantity, 99);
});

test("a count still saves quantities when the history table isn't there yet", async (t) => {
	const tables = fakeDatabase(t, {
		ingredient_library: [...CATALOG],
		restaurant_inventory: [
			{ id: "inv-1", restaurant_id: RESTAURANT, ingredient_id: "cat-beef", quantity: 10, unit: "lbs", cost_per_unit: 4 },
		],
		options: { noHistoryTable: true },
	});

	t.mock.method(console, "error", () => {});

	const result = await saveCount({
		restaurantId: RESTAURANT,
		counts: [{ inventoryId: "inv-1", quantity: 6 }],
	});

	assert.equal(result.historySaved, false);
	assert.equal(tables.restaurant_inventory[0].quantity, 6);
});

test("a count rejects an unknown reason", async (t) => {
	fakeDatabase(t);

	await assert.rejects(
		saveCount({ restaurantId: RESTAURANT, reason: "theft", counts: [] }),
		/Reason must be one of/
	);
});
