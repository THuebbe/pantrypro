// /backend/src/services/recipeDrafts/recipeDraftService.js

/**
 * Recipe draft service
 *
 * Proposes a recipe for one menu item for the owner to correct and save.
 * Nothing is written to the database here. See CONTRACT.md in this folder.
 */

import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../supabase.js";
import { normalizeUnit } from "../units.js";
import {
	DRAFT_TOOL_NAME,
	buildDraftTool,
	buildDraftRequest,
	validateDraft,
	parseRules,
} from "./recipeDraftCore.js";

const DEFAULT_MODEL = "claude-haiku-5-5";
const MAX_OUTPUT_TOKENS = 2000;

const RULES = parseRules(
	fs.readFileSync(new URL("./rules.md", import.meta.url), "utf8")
);

let sharedClient = null;

/**
 * An error whose message is safe and useful to show the owner
 */
export class RecipeDraftError extends Error {
	constructor(message, status = 400) {
		super(message);
		this.name = "RecipeDraftError";
		this.status = status;
	}
}

function getClient() {
	if (!process.env.ANTHROPIC_API_KEY) {
		throw new RecipeDraftError(
			"Recipe drafting is not set up on the server yet (ANTHROPIC_API_KEY is missing).",
			503
		);
	}

	if (!sharedClient) {
		sharedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
	}

	return sharedClient;
}

/**
 * Load the restaurant's inventory as the list the model may choose from
 * @param {string} restaurantId - Restaurant UUID
 * @returns {Promise<Array>} [{ ingredientId, name, category, unit }]
 */
async function loadInventoryList(restaurantId) {
	const { data, error } = await supabase
		.from("restaurant_inventory")
		.select(
			`
			ingredient_id,
			unit,
			ingredient_library (
				id,
				name,
				category,
				unit
			)
		`
		)
		.eq("restaurant_id", restaurantId);

	if (error) throw error;

	const byIngredient = new Map();

	for (const row of data || []) {
		const unit = normalizeUnit(row.unit || row.ingredient_library?.unit);

		// An item counted in a unit the app can't convert can't be drafted
		// against safely, so it is left off the list.
		if (!row.ingredient_library?.name || !unit) continue;

		if (!byIngredient.has(row.ingredient_id)) {
			byIngredient.set(row.ingredient_id, {
				ingredientId: row.ingredient_id,
				name: row.ingredient_library.name,
				category: row.ingredient_library.category || null,
				unit,
			});
		}
	}

	return Array.from(byIngredient.values()).sort((a, b) =>
		a.name.localeCompare(b.name)
	);
}

/**
 * Draft a recipe for one menu item
 * @param {object} params
 * @param {object} params.menuItem - { id, name, category, price }
 * @param {string} params.restaurantId - Restaurant UUID
 * @param {object} [params.client] - Anthropic client (tests pass a stand-in)
 * @param {Array} [params.inventory] - Inventory list (tests pass one)
 * @returns {Promise<Object>} Draft for the owner to review; nothing is saved
 */
export async function draftRecipe({ menuItem, restaurantId, client, inventory }) {
	if (!menuItem?.name) {
		throw new RecipeDraftError("Menu item not found", 404);
	}

	const inventoryList = inventory || (await loadInventoryList(restaurantId));

	if (inventoryList.length === 0) {
		throw new RecipeDraftError(
			"Add your ingredients to inventory first. A draft can only use items you stock."
		);
	}

	const model = process.env.RECIPE_DRAFT_MODEL || DEFAULT_MODEL;
	const anthropic = client || getClient();

	let response;
	try {
		response = await anthropic.messages.create({
			model,
			max_tokens: MAX_OUTPUT_TOKENS,
			system: RULES.text,
			tools: [buildDraftTool(inventoryList)],
			tool_choice: { type: "tool", name: DRAFT_TOOL_NAME },
			messages: [
				{
					role: "user",
					content: buildDraftRequest(
						{
							name: menuItem.name,
							category: menuItem.category,
							price:
								menuItem.price === null || menuItem.price === undefined
									? undefined
									: Number(menuItem.price),
						},
						inventoryList
					),
				},
			],
		});
	} catch (error) {
		console.error("Recipe draft request failed:", error?.status, error?.message);

		if (error?.status === 401 || error?.status === 403) {
			throw new RecipeDraftError(
				"The server's AI key was not accepted. Recipe drafting is unavailable until it is fixed.",
				503
			);
		}
		if (error?.status === 429 || error?.status === 529) {
			throw new RecipeDraftError(
				"The drafting service is busy. Try again in a minute.",
				503
			);
		}

		throw new RecipeDraftError(
			"Couldn't draft a recipe right now. You can still add ingredients by hand.",
			502
		);
	}

	const toolUse = (response?.content || []).find(
		(block) => block.type === "tool_use" && block.name === DRAFT_TOOL_NAME
	);

	if (!toolUse) {
		throw new RecipeDraftError(
			"The draft came back empty. Try again, or add ingredients by hand.",
			502
		);
	}

	const checked = validateDraft(toolUse.input, inventoryList);

	return {
		menuItemId: menuItem.id,
		menuItemName: menuItem.name,
		...checked,
		rulesVersion: RULES.version,
		model,
	};
}
