// /backend/src/tests/unit/inventoryItems.test.js
// Unit tests for adding inventory items by hand. No network or database.
// Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY ||= "test";
process.env.SUPABASE_ANON_KEY ||= "test";

const { supabase } = await import("../../services/supabase.js");
const {
	InventoryItemError,
	validateNewItem,
	addInventoryItem,
	getCatalogForRestaurant,
} = await import("../../services/inventoryItems.js");

/**
 * A small in-memory stand-in for the two tables involved.
 */
function fakeDatabase(t, seed = {}) {
	const tables = {
		ingredient_library: [...(seed.ingredient_library || [])],
		restaurant_inventory: [...(seed.restaurant_inventory || [])],
	};
	const options = { failInventoryInsert: null, ...seed.options };
	let nextId = 1;

	t.mock.method(supabase, "from", (table) => {
		const filters = [];
		let action = "select";
		let payload = null;

		const matches = (row) => filters.every(([column, value]) => row[column] === value);

		const run = () => {
			if (action === "insert") {
				if (table === "restaurant_inventory" && options.failInventoryInsert) {
					return { data: null, error: options.failInventoryInsert };
				}
				const row = { id: `${table}-${nextId++}`, ...payload };
				tables[table].push(row);
				return { data: [row], error: null };
			}

			if (action === "delete") {
				tables[table] = tables[table].filter((row) => !matches(row));
				return { data: [], error: null };
			}

			let rows = tables[table].filter(matches);

			// Mimic the join used for the duplicate-name check
			if (table === "restaurant_inventory") {
				rows = rows.map((row) => ({
					...row,
					ingredient: tables.ingredient_library.find((i) => i.id === row.ingredient_id) || null,
				}));
			}

			return { data: rows, error: null };
		};

		const chain = {
			select: () => chain,
			order: () => chain,
			insert: (values) => {
				action = "insert";
				payload = values;
				return chain;
			},
			delete: () => {
				action = "delete";
				return chain;
			},
			eq: (column, value) => {
				filters.push([column, value]);
				return chain;
			},
			single: async () => {
				const { data, error } = run();
				return { data: data?.[0] || null, error };
			},
			maybeSingle: async () => {
				const { data, error } = run();
				return { data: data?.[0] || null, error };
			},
			then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
		};

		return chain;
	});

	return { tables, options };
}

const CATALOG = [
	{ id: "cat-beef", name: "Ground Beef (80/20)", category: "Protein", unit: "lbs", storage_type: "refrigerated", is_platform: true },
	{ id: "cat-buns", name: "Bread (Hamburger Buns)", category: "Dry Goods", unit: "dozen", storage_type: "dry", is_platform: true },
	{ id: "cat-odd", name: "Mystery Unit Item", category: "Dry Goods", unit: "case", storage_type: "dry", is_platform: true },
	{ id: "other-secret", name: "Rival's Secret Sauce", category: "Condiments", unit: "gal", is_platform: false },
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

test("a new item needs a name and a unit the app can convert", () => {
	assert.throws(() => validateNewItem({}), /Enter a name/);
	assert.throws(() => validateNewItem({ name: "  " }), /Enter a name/);
	assert.throws(() => validateNewItem({ name: "Hot Dogs" }), /Choose the unit/);
	assert.throws(() => validateNewItem({ name: "Hot Dogs", unit: "case" }), /isn't a unit the app can use/);

	const item = validateNewItem({ name: "  Hot Dogs  ", unit: "Each" });
	assert.equal(item.name, "Hot Dogs");
	assert.equal(item.unit, "each");
	assert.equal(item.quantity, 0);
	assert.equal(item.costPerUnit, null);
});

test("numbers must be zero or more, and blanks are allowed", () => {
	const base = { name: "Hot Dogs", unit: "each" };

	assert.throws(() => validateNewItem({ ...base, quantity: -1 }), /Quantity on hand must be zero or more/);
	assert.throws(() => validateNewItem({ ...base, costPerUnit: "abc" }), /Cost must be zero or more/);
	assert.throws(() => validateNewItem({ ...base, minimumQuantity: -5 }), /Minimum quantity/);
	assert.throws(() => validateNewItem({ ...base, storageType: "attic" }), /Storage must be one of/);

	const item = validateNewItem({ ...base, quantity: "48", costPerUnit: "0.35", minimumQuantity: "", storageType: "frozen" });
	assert.equal(item.quantity, 48);
	assert.equal(item.costPerUnit, 0.35);
	assert.equal(item.minimumQuantity, null);
	assert.equal(item.storageType, "frozen");
});

test("a catalog pick doesn't need a name or unit", () => {
	const item = validateNewItem({ ingredientId: "cat-beef", quantity: 10 });
	assert.equal(item.ingredientId, "cat-beef");
	assert.equal(item.unit, null);
});

// ---------------------------------------------------------------------------
// Adding
// ---------------------------------------------------------------------------

test("an owner's own item is created privately and stocked", async (t) => {
	const db = fakeDatabase(t, { ingredient_library: CATALOG });

	const added = await addInventoryItem({
		restaurantId: "rest-1",
		userId: "user-1",
		input: { name: "Hot Dogs (All Beef)", unit: "each", category: "Protein", quantity: 48, costPerUnit: 0.35, minimumQuantity: 24 },
	});

	const libraryRow = db.tables.ingredient_library.find((row) => row.name === "Hot Dogs (All Beef)");
	assert.equal(libraryRow.is_platform, false);
	assert.equal(libraryRow.created_by, "user-1");
	assert.equal(libraryRow.unit, "each");

	const stock = db.tables.restaurant_inventory[0];
	assert.equal(stock.restaurant_id, "rest-1");
	assert.equal(stock.ingredient_id, libraryRow.id);
	assert.equal(stock.quantity, 48);
	assert.equal(stock.unit, "each");
	assert.equal(stock.cost_per_unit, 0.35);
	assert.equal(stock.minimum_quantity, 24);
	assert.ok(stock.last_restocked);

	assert.equal(added.ingredient_name, "Hot Dogs (All Beef)");
	assert.equal(added.category, "Protein");
	assert.equal(added.quantity, 48);
});

test("a catalog item is stocked in the catalog's unit without a new catalog entry", async (t) => {
	const db = fakeDatabase(t, { ingredient_library: CATALOG });

	const added = await addInventoryItem({
		restaurantId: "rest-1",
		userId: "user-1",
		input: { ingredientId: "cat-buns", quantity: 3 },
	});

	assert.equal(db.tables.ingredient_library.length, CATALOG.length);
	assert.equal(added.ingredient_id, "cat-buns");
	assert.equal(added.unit, "dozen");
	assert.equal(added.ingredient_name, "Bread (Hamburger Buns)");
});

test("an item added with nothing on hand has no restock date", async (t) => {
	const db = fakeDatabase(t, { ingredient_library: CATALOG });

	await addInventoryItem({ restaurantId: "rest-1", userId: "u", input: { name: "Relish", unit: "gal" } });

	assert.equal(db.tables.restaurant_inventory[0].quantity, 0);
	assert.equal(db.tables.restaurant_inventory[0].last_restocked, null);
});

test("the same item can't be added twice, by catalog id or by name", async (t) => {
	fakeDatabase(t, {
		ingredient_library: [...CATALOG, { id: "own-1", name: "Hot Dogs", unit: "each", is_platform: false }],
		restaurant_inventory: [
			{ id: "inv-1", restaurant_id: "rest-1", ingredient_id: "cat-beef" },
			{ id: "inv-2", restaurant_id: "rest-1", ingredient_id: "own-1" },
		],
	});

	await assert.rejects(
		() => addInventoryItem({ restaurantId: "rest-1", userId: "u", input: { ingredientId: "cat-beef" } }),
		(error) => error instanceof InventoryItemError && error.status === 409 && /already in your inventory/.test(error.message)
	);
	await assert.rejects(
		() => addInventoryItem({ restaurantId: "rest-1", userId: "u", input: { name: "  hot dogs ", unit: "each" } }),
		(error) => error.status === 409
	);
});

test("two restaurants can each have their own item with the same name", async (t) => {
	const db = fakeDatabase(t, {
		ingredient_library: [{ id: "own-1", name: "Hot Dogs", unit: "each", is_platform: false }],
		restaurant_inventory: [{ id: "inv-1", restaurant_id: "rest-1", ingredient_id: "own-1" }],
	});

	await addInventoryItem({ restaurantId: "rest-2", userId: "u2", input: { name: "Hot Dogs", unit: "lbs" } });

	assert.equal(db.tables.ingredient_library.length, 2);
	assert.equal(db.tables.restaurant_inventory.filter((row) => row.restaurant_id === "rest-2").length, 1);
});

test("another restaurant's own item can't be picked by guessing its id", async (t) => {
	const db = fakeDatabase(t, { ingredient_library: CATALOG });

	await assert.rejects(
		() => addInventoryItem({ restaurantId: "rest-1", userId: "u", input: { ingredientId: "other-secret" } }),
		(error) => error.status === 404 && /wasn't found/.test(error.message)
	);
	await assert.rejects(
		() => addInventoryItem({ restaurantId: "rest-1", userId: "u", input: { ingredientId: "does-not-exist" } }),
		(error) => error.status === 404
	);
	assert.equal(db.tables.restaurant_inventory.length, 0);
});

test("if stocking fails, the new catalog entry is removed", async (t) => {
	const db = fakeDatabase(t, {
		ingredient_library: CATALOG,
		options: { failInventoryInsert: { code: "XX000", message: "boom" } },
	});

	await assert.rejects(() =>
		addInventoryItem({ restaurantId: "rest-1", userId: "u", input: { name: "Relish", unit: "gal" } })
	);

	assert.equal(db.tables.ingredient_library.some((row) => row.name === "Relish"), false);
	assert.equal(db.tables.ingredient_library.length, CATALOG.length);
});

test("an account with no restaurant gets a clear message", async (t) => {
	fakeDatabase(t);

	await assert.rejects(
		() => addInventoryItem({ restaurantId: null, userId: "u", input: { name: "x", unit: "each" } }),
		(error) => error.status === 404 && /No restaurant found/.test(error.message)
	);
});

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

test("the catalog offers shared items not yet stocked, in usable units only", async (t) => {
	fakeDatabase(t, {
		ingredient_library: CATALOG,
		restaurant_inventory: [{ id: "inv-1", restaurant_id: "rest-1", ingredient_id: "cat-beef" }],
	});

	const catalog = await getCatalogForRestaurant("rest-1");

	// Beef is already stocked, the "case" item can't be converted, and the
	// other restaurant's private item is never listed.
	assert.deepEqual(
		catalog.map((item) => item.id),
		["cat-buns"]
	);
	assert.deepEqual(catalog[0], {
		id: "cat-buns",
		name: "Bread (Hamburger Buns)",
		category: "Dry Goods",
		unit: "dozen",
		storageType: "dry",
	});
});
