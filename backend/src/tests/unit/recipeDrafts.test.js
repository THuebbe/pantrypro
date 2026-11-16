// /backend/src/tests/unit/recipeDrafts.test.js
// Unit tests for unit conversion, stock deduction and recipe drafts.
// No network or database needed. Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY ||= "test";
process.env.SUPABASE_ANON_KEY ||= "test";

const { convertQuantity, normalizeUnit, compatibleUnits } = await import(
	"../../services/units.js"
);
const { buildDraftTool, buildDraftRequest, validateDraft, parseRules, DRAFT_TOOL_NAME } =
	await import("../../services/recipeDrafts/recipeDraftCore.js");
const { draftRecipe, RecipeDraftError } = await import(
	"../../services/recipeDrafts/recipeDraftService.js"
);
const { supabase } = await import("../../services/supabase.js");
const { deductIngredient } = await import("../../services/inventory.js");

const near = (actual, expected) =>
	assert.ok(
		Math.abs(actual - expected) < 1e-6,
		`expected ${expected}, got ${actual}`
	);

const INVENTORY = [
	{ ingredientId: "ing-beef", name: "Ground Beef (80/20)", category: "Meat", unit: "lbs" },
	{ ingredientId: "ing-bun", name: "Bread (Hamburger Buns)", category: "Bakery", unit: "dozen" },
	{ ingredientId: "ing-milk", name: "Milk (Whole)", category: "Dairy", unit: "gal" },
	{ ingredientId: "ing-cheese", name: "Cheddar Cheese", category: "Dairy", unit: "lbs" },
];

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

test("weights, volumes and counts convert within their own kind", () => {
	near(convertQuantity(6, "oz", "lbs"), 0.375);
	near(convertQuantity(1, "lbs", "oz"), 16);
	near(convertQuantity(1, "kg", "g"), 1000);
	near(convertQuantity(1, "each", "dozen"), 1 / 12);
	near(convertQuantity(2, "dozen", "each"), 24);
	near(convertQuantity(1, "gal", "qt"), 4);
	near(convertQuantity(1, "cup", "fl oz"), 8);
	near(convertQuantity(3, "tsp", "tbsp"), 1);
	near(convertQuantity(5, "oz", "oz"), 5);
});

test("different kinds of measure do not convert", () => {
	assert.equal(convertQuantity(1, "cup", "lbs"), null);
	assert.equal(convertQuantity(1, "each", "oz"), null);
	assert.equal(convertQuantity(1, "oz", "fl oz"), null);
	assert.equal(convertQuantity(1, "handful", "oz"), null);
	assert.equal(convertQuantity("abc", "oz", "lbs"), null);
});

test("units are recognized however they are typed", () => {
	assert.equal(normalizeUnit("Lb"), "lbs");
	assert.equal(normalizeUnit(" pounds "), "lbs");
	assert.equal(normalizeUnit("FL  OZ"), "fl oz");
	assert.equal(normalizeUnit("ea"), "each");
	assert.equal(normalizeUnit("pinch"), null);
	assert.equal(normalizeUnit(undefined), null);
	assert.deepEqual(compatibleUnits("dozen"), ["each", "dozen"]);
	assert.deepEqual(compatibleUnits("lbs"), ["g", "kg", "oz", "lbs"]);
});

// ---------------------------------------------------------------------------
// Stock deduction converts the recipe unit to the inventory unit
// ---------------------------------------------------------------------------

function stubInventoryRow(t, row) {
	let saved = null;

	t.mock.method(supabase, "from", () => {
		const chain = {
			select: () => chain,
			eq: () => chain,
			update: (values) => {
				saved = { ...row, ...values };
				return chain;
			},
			single: async () => ({ data: saved || row, error: null }),
		};
		return chain;
	});

	return () => saved;
}

test("one bun comes off a dozen-counted item as a twelfth, not a whole dozen", async (t) => {
	const saved = stubInventoryRow(t, { id: "inv-1", quantity: "3.00", unit: "dozen" });

	const result = await deductIngredient("rest-1", "ing-bun", 1, "each");

	near(result.deductedQuantity, 1 / 12);
	near(saved().quantity, 3 - 1 / 12);
	assert.equal(result.inventoryUnit, "dozen");
});

test("six ounces comes off a pound-counted item as 0.375 lbs", async (t) => {
	const saved = stubInventoryRow(t, { id: "inv-2", quantity: "10", unit: "lbs" });

	const result = await deductIngredient("rest-1", "ing-beef", 6, "oz");

	near(result.deductedQuantity, 0.375);
	near(saved().quantity, 9.625);
});

test("a recipe unit that can't convert stops the deduction", async (t) => {
	const saved = stubInventoryRow(t, { id: "inv-3", quantity: "10", unit: "lbs" });

	await assert.rejects(
		() => deductIngredient("rest-1", "ing-cheese", 1, "cup"),
		/can't be converted/
	);
	assert.equal(saved(), null);
});

test("matching units deduct as before", async (t) => {
	const saved = stubInventoryRow(t, { id: "inv-4", quantity: "10", unit: "lbs" });

	const result = await deductIngredient("rest-1", "ing-beef", 2, "lbs");

	assert.equal(result.deductedQuantity, 2);
	assert.equal(saved().quantity, 8);
});

// ---------------------------------------------------------------------------
// Recipe draft: the form and the check
// ---------------------------------------------------------------------------

test("the model can only pick ingredients from this restaurant's list", () => {
	const tool = buildDraftTool(INVENTORY);
	const line = tool.input_schema.properties.lines.items.properties;

	assert.equal(tool.name, DRAFT_TOOL_NAME);
	assert.deepEqual(
		line.ingredient_id.enum,
		INVENTORY.map((i) => i.ingredientId)
	);
	assert.ok(line.unit.enum.includes("oz"));

	const request = buildDraftRequest(
		{ name: "Classic Cheeseburger", category: "Burgers", price: 12.5 },
		INVENTORY
	);
	assert.match(request, /Classic Cheeseburger/);
	assert.match(request, /\$12\.50/);
	assert.match(request, /id: ing-beef \| Ground Beef \(80\/20\) \| Meat \| stocked in: lbs/);
});

test("a good draft passes the check and keeps kitchen units", () => {
	const draft = validateDraft(
		{
			lines: [
				{ ingredient_id: "ing-beef", quantity: 6, unit: "oz" },
				{ ingredient_id: "ing-bun", quantity: 1, unit: "each" },
				{ ingredient_id: "ing-cheese", quantity: 1, unit: "ounce" },
			],
			missing_ingredients: ["Lettuce", "Tomato", "Lettuce", "  "],
			confidence: "high",
		},
		INVENTORY
	);

	assert.equal(draft.rejected.length, 0);
	assert.deepEqual(
		draft.lines.map((l) => [l.ingredientName, l.quantity, l.unit, l.inventoryUnit]),
		[
			["Ground Beef (80/20)", 6, "oz", "lbs"],
			["Bread (Hamburger Buns)", 1, "each", "dozen"],
			["Cheddar Cheese", 1, "oz", "lbs"],
		]
	);
	assert.deepEqual(draft.lines[1].allowedUnits, ["each", "dozen"]);
	assert.deepEqual(draft.missing, ["Lettuce", "Tomato"]);
	assert.equal(draft.confidence, "high");
});

test("the check rejects every kind of bad line, with a reason", () => {
	const draft = validateDraft(
		{
			lines: [
				{ ingredient_id: "ing-made-up", quantity: 2, unit: "oz" },
				{ ingredient_id: "ing-beef", quantity: 6, unit: "oz" },
				{ ingredient_id: "ing-beef", quantity: 4, unit: "oz" },
				{ ingredient_id: "ing-bun", quantity: 0, unit: "each" },
				{ ingredient_id: "ing-milk", quantity: 8, unit: "oz" },
				{ ingredient_id: "ing-cheese", quantity: 5, unit: "lbs" },
			],
			missing_ingredients: "not a list",
			confidence: "certain",
		},
		INVENTORY
	);

	assert.deepEqual(
		draft.lines.map((l) => l.ingredientId),
		["ing-beef"]
	);
	assert.equal(draft.lines[0].quantity, 6);

	const reasons = Object.fromEntries(draft.rejected.map((r) => [r.name, r.reason]));
	assert.match(reasons["ing-made-up"], /Not an ingredient in your inventory/);
	assert.match(reasons["Ground Beef (80/20)"], /more than once/);
	assert.match(reasons["Bread (Hamburger Buns)"], /greater than zero/);
	assert.match(reasons["Milk (Whole)"], /can't be converted/);
	assert.match(reasons["Cheddar Cheese"], /too much for one serving/);

	assert.deepEqual(draft.missing, []);
	assert.equal(draft.confidence, "low");
});

test("an empty or malformed answer yields an empty draft, not a crash", () => {
	for (const raw of [null, {}, { lines: "nope" }, { lines: [null, 7, {}] }]) {
		const draft = validateDraft(raw, INVENTORY);
		assert.deepEqual(draft.lines, []);
	}
});

test("the rules file gives its version and text", () => {
	const parsed = parseRules("---\ntitle: x\nversion: 7\n---\nBe careful.\n");
	assert.deepEqual(parsed, { version: "7", text: "Be careful." });
	assert.equal(parseRules("no frontmatter").version, "unknown");
});

// ---------------------------------------------------------------------------
// Recipe draft: the service, with a stand-in for the AI
// ---------------------------------------------------------------------------

const MENU_ITEM = { id: "menu-1", name: "Classic Cheeseburger", category: "Burgers", price: "12.50" };

function fakeClient(reply) {
	const calls = [];
	return {
		calls,
		messages: {
			create: async (request) => {
				calls.push(request);
				if (reply instanceof Error) throw reply;
				return reply;
			},
		},
	};
}

test("a draft is requested once, forced through the form, and checked", async () => {
	const client = fakeClient({
		content: [
			{
				type: "tool_use",
				name: DRAFT_TOOL_NAME,
				input: {
					lines: [
						{ ingredient_id: "ing-beef", quantity: 6, unit: "oz" },
						{ ingredient_id: "ing-ghost", quantity: 1, unit: "oz" },
					],
					missing_ingredients: ["Pickles"],
					confidence: "medium",
				},
			},
		],
	});

	const draft = await draftRecipe({
		menuItem: MENU_ITEM,
		restaurantId: "rest-1",
		client,
		inventory: INVENTORY,
	});

	assert.equal(client.calls.length, 1);
	const request = client.calls[0];
	assert.deepEqual(request.tool_choice, { type: "tool", name: DRAFT_TOOL_NAME });
	assert.equal(request.model, "claude-haiku-5-5");
	assert.match(request.system, /Use only ingredients from the list/);
	assert.match(request.messages[0].content, /Classic Cheeseburger/);

	assert.equal(draft.menuItemId, "menu-1");
	assert.equal(draft.lines.length, 1);
	assert.equal(draft.rejected.length, 1);
	assert.deepEqual(draft.missing, ["Pickles"]);
	assert.equal(draft.rulesVersion, "1");
	assert.equal(draft.model, "claude-haiku-5-5");
});

test("no inventory means no draft, with a message the owner can act on", async () => {
	const client = fakeClient({ content: [] });

	await assert.rejects(
		() => draftRecipe({ menuItem: MENU_ITEM, restaurantId: "r", client, inventory: [] }),
		(error) =>
			error instanceof RecipeDraftError &&
			error.status === 400 &&
			/Add your ingredients to inventory first/.test(error.message)
	);
	assert.equal(client.calls.length, 0);
});

test("AI failures become plain messages, never raw errors", async () => {
	const busy = Object.assign(new Error("overloaded"), { status: 529 });
	const badKey = Object.assign(new Error("invalid x-api-key"), { status: 401 });

	for (const [failure, pattern, status] of [
		[busy, /busy/, 503],
		[badKey, /AI key was not accepted/, 503],
		[new Error("socket hang up"), /Couldn't draft a recipe right now/, 502],
	]) {
		await assert.rejects(
			() =>
				draftRecipe({
					menuItem: MENU_ITEM,
					restaurantId: "r",
					client: fakeClient(failure),
					inventory: INVENTORY,
				}),
			(error) =>
				error instanceof RecipeDraftError &&
				error.status === status &&
				pattern.test(error.message)
		);
	}

	await assert.rejects(
		() =>
			draftRecipe({
				menuItem: MENU_ITEM,
				restaurantId: "r",
				client: fakeClient({ content: [{ type: "text", text: "hello" }] }),
				inventory: INVENTORY,
			}),
		/came back empty/
	);
});

test("without a server key, drafting says it is not set up", async () => {
	const saved = process.env.ANTHROPIC_API_KEY;
	delete process.env.ANTHROPIC_API_KEY;

	await assert.rejects(
		() => draftRecipe({ menuItem: MENU_ITEM, restaurantId: "r", inventory: INVENTORY }),
		(error) => error.status === 503 && /not set up on the server/.test(error.message)
	);

	if (saved) process.env.ANTHROPIC_API_KEY = saved;
});
