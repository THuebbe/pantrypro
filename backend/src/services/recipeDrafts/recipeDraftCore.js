// /backend/src/services/recipeDrafts/recipeDraftCore.js

/**
 * Recipe draft core
 *
 * The parts of recipe drafting that involve no network and no database:
 * building the form the model must fill in, and checking what it returns.
 * See CONTRACT.md in this folder for the stage contract.
 */

import {
	KNOWN_UNITS,
	normalizeUnit,
	compatibleUnits,
	convertQuantity,
	describeUnit,
} from "../units.js";

export const DRAFT_TOOL_NAME = "submit_recipe_draft";

// Upper limits for ONE serving, in each kind's base unit. A line above its
// limit is almost always a batch quantity or a unit mix-up, so it goes to
// the owner as rejected instead of into the recipe.
const SERVING_LIMITS = {
	weight: 1000, // grams (about 2.2 lbs)
	volume: 1000, // millilitres (about 1 qt)
	count: 24, // each
};

/**
 * Build the tool (answer form) the model is required to call
 * @param {Array} inventory - [{ ingredientId, name, category, unit }]
 * @returns {object} Tool definition for the Messages API
 */
export function buildDraftTool(inventory) {
	return {
		name: DRAFT_TOOL_NAME,
		description:
			"Submit the drafted recipe for one serving of the menu item.",
		input_schema: {
			type: "object",
			properties: {
				lines: {
					type: "array",
					description: "One entry per ingredient used in one serving.",
					items: {
						type: "object",
						properties: {
							ingredient_id: {
								type: "string",
								enum: inventory.map((item) => item.ingredientId),
								description: "Id of an ingredient from the provided list.",
							},
							quantity: {
								type: "number",
								description: "Amount used in one serving.",
							},
							unit: {
								type: "string",
								enum: KNOWN_UNITS,
							},
						},
						required: ["ingredient_id", "quantity", "unit"],
					},
				},
				missing_ingredients: {
					type: "array",
					description:
						"Names of ingredients the dish needs that are not in the provided list.",
					items: { type: "string" },
				},
				confidence: {
					type: "string",
					enum: ["low", "medium", "high"],
				},
				note: {
					type: "string",
					description:
						"One short sentence for the owner, only if something needs explaining.",
				},
			},
			required: ["lines", "missing_ingredients", "confidence"],
		},
	};
}

/**
 * Build the user message describing the menu item and the inventory list
 * @param {object} menuItem - { name, category, price }
 * @param {Array} inventory - [{ ingredientId, name, category, unit }]
 * @returns {string}
 */
export function buildDraftRequest(menuItem, inventory) {
	const price =
		typeof menuItem.price === "number" ? `$${menuItem.price.toFixed(2)}` : "unknown";

	const ingredientLines = inventory
		.map(
			(item) =>
				`- id: ${item.ingredientId} | ${item.name}` +
				(item.category ? ` | ${item.category}` : "") +
				` | stocked in: ${item.unit}`
		)
		.join("\n");

	return [
		"Menu item:",
		`- name: ${menuItem.name}`,
		`- category: ${menuItem.category || "unknown"}`,
		`- price: ${price}`,
		"",
		"Ingredients this restaurant stocks:",
		ingredientLines,
		"",
		`Draft the recipe for one serving and submit it with ${DRAFT_TOOL_NAME}.`,
	].join("\n");
}

/**
 * The check from CONTRACT.md. Decides, line by line, what the owner sees.
 * @param {object} raw - Tool input returned by the model
 * @param {Array} inventory - [{ ingredientId, name, category, unit }]
 * @returns {{lines: Array, missing: string[], rejected: Array, confidence: string, note: string}}
 */
export function validateDraft(raw, inventory) {
	const byId = new Map(inventory.map((item) => [item.ingredientId, item]));
	const seen = new Set();
	const lines = [];
	const rejected = [];

	const rawLines = Array.isArray(raw?.lines) ? raw.lines : [];

	for (const line of rawLines) {
		const item = byId.get(line?.ingredient_id);

		if (!item) {
			rejected.push({
				name: String(line?.ingredient_id ?? "Unknown ingredient"),
				reason: "Not an ingredient in your inventory",
			});
			continue;
		}

		const reject = (reason) => rejected.push({ name: item.name, reason });

		if (seen.has(item.ingredientId)) {
			reject("Listed more than once");
			continue;
		}

		const quantity = Number(line.quantity);
		if (!Number.isFinite(quantity) || quantity <= 0) {
			reject("Quantity was not a number greater than zero");
			continue;
		}

		const unit = normalizeUnit(line.unit);
		if (!unit) {
			reject(`Unit "${line.unit}" is not one the app uses`);
			continue;
		}

		if (convertQuantity(quantity, unit, item.unit) === null) {
			reject(
				`Suggested in ${unit}, but this item is counted in ${item.unit} and the two can't be converted`
			);
			continue;
		}

		const unitInfo = describeUnit(unit);
		const inBaseUnits = quantity * unitInfo.factor;
		if (inBaseUnits > SERVING_LIMITS[unitInfo.kind]) {
			reject(`${quantity} ${unit} is too much for one serving`);
			continue;
		}

		seen.add(item.ingredientId);
		lines.push({
			ingredientId: item.ingredientId,
			ingredientName: item.name,
			quantity: Math.round(quantity * 1000) / 1000,
			unit,
			inventoryUnit: item.unit,
			allowedUnits: compatibleUnits(item.unit),
			prepLossFactor: 0,
		});
	}

	const missing = Array.isArray(raw?.missing_ingredients)
		? [
				...new Set(
					raw.missing_ingredients
						.filter((name) => typeof name === "string" && name.trim())
						.map((name) => name.trim().slice(0, 80))
				),
		  ].slice(0, 20)
		: [];

	const confidence = ["low", "medium", "high"].includes(raw?.confidence)
		? raw.confidence
		: "low";

	const note = typeof raw?.note === "string" ? raw.note.trim().slice(0, 300) : "";

	return { lines, missing, rejected, confidence, note };
}

/**
 * Pull the rules text and version out of rules.md
 * @param {string} fileText - Contents of rules.md
 * @returns {{version: string, text: string}}
 */
export function parseRules(fileText) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(fileText);

	if (!match) {
		return { version: "unknown", text: fileText.trim() };
	}

	const version = /^version:\s*(.+)$/m.exec(match[1])?.[1]?.trim() || "unknown";

	return { version, text: match[2].trim() };
}
