// /backend/src/routes/recipes.js

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";
import { getMenuItem } from "../services/menuItemService.js";
import {
	getRecipe,
	createOrUpdateRecipe,
	addIngredientToRecipe,
	updateRecipeIngredient,
	removeIngredientFromRecipe,
	calculateRecipeCost,
	validateRecipe,
	calculateIngredientDeductions,
} from "../services/recipeService.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// TODO: Add role-based middleware for manager/admin only routes
// import { requireRole } from "../middleware/roles.js";
// router.use(requireRole(['manager', 'admin'])); // Uncomment when role system is implemented

/**
 * Helper function to get restaurant_id from business_id
 * This is the correct pattern to follow for all routes
 */
async function getRestaurantId(businessId) {
	if (!businessId) {
		throw new Error("Business ID not found");
	}

	const { data: restaurant, error } = await supabase
		.from("restaurants")
		.select("id")
		.eq("business_id", businessId)
		.single();

	if (error) {
		console.error("Error looking up restaurant:", error);
		throw new Error("Failed to find restaurant for this business");
	}

	if (!restaurant) {
		throw new Error(
			"No restaurant found for this business. Please contact support."
		);
	}

	return restaurant.id;
}

/**
 * Helper function to verify menu item ownership
 */
async function verifyMenuItemOwnership(menuItemId, restaurantId) {
	try {
		const menuItem = await getMenuItem(menuItemId);
		return menuItem.restaurant_id === restaurantId;
	} catch (error) {
		return false;
	}
}

/**
 * GET /api/recipes/:menuItemId
 * Get recipe for a specific menu item
 */
router.get("/:menuItemId", async (req, res) => {
	try {
		const { menuItemId } = req.params;

		// ✅ FIXED: Look up restaurant_id from business_id
		const businessId = req.userDetails?.businessId;
		const restaurantId = await getRestaurantId(businessId);

		// Verify ownership
		const hasAccess = await verifyMenuItemOwnership(menuItemId, restaurantId);
		if (!hasAccess) {
			return res.status(403).json({ error: "Access denied" });
		}

		const recipe = await getRecipe(menuItemId);

		res.json(recipe);
	} catch (error) {
		console.error(`Error in GET /api/recipes/${req.params.menuItemId}:`, error);

		if (error.message.includes("No restaurant found")) {
			return res.status(404).json({ error: error.message });
		}

		res.status(500).json({ error: error.message });
	}
});

/**
 * POST /api/recipes/:menuItemId
 * Create or update complete recipe for a menu item (replaces existing)
 *
 * Body:
 * {
 *   "ingredients": [
 *     {
 *       "ingredientId": "uuid",
 *       "quantity": 8,
 *       "unit": "oz",
 *       "prepLossFactor": 5
 *     },
 *     ...
 *   ]
 * }
 */
router.post("/:menuItemId", async (req, res) => {
	try {
		const { menuItemId } = req.params;
		const { ingredients } = req.body;

		// ✅ FIXED: Look up restaurant_id from business_id
		const businessId = req.userDetails?.businessId;
		const restaurantId = await getRestaurantId(businessId);

		// Verify ownership
		const hasAccess = await verifyMenuItemOwnership(menuItemId, restaurantId);
		if (!hasAccess) {
			return res.status(403).json({ error: "Access denied" });
		}

		// Validation
		if (!Array.isArray(ingredients) || ingredients.length === 0) {
			return res.status(400).json({
				error: "At least one ingredient is required",
			});
		}

		// Validate each ingredient
		for (const ingredient of ingredients) {
			if (!ingredient.ingredientId) {
				return res.status(400).json({
					error: "ingredientId is required for all ingredients",
				});
			}
			if (!ingredient.quantity || ingredient.quantity <= 0) {
				return res.status(400).json({
					error: "quantity must be greater than 0",
				});
			}
			if (!ingredient.unit) {
				return res.status(400).json({
					error: "unit is required for all ingredients",
				});
			}
		}

		const recipe = await createOrUpdateRecipe(menuItemId, ingredients);

		res.status(201).json(recipe);
	} catch (error) {
		console.error(
			`Error in POST /api/recipes/${req.params.menuItemId}:`,
			error
		);

		if (error.message.includes("No restaurant found")) {
			return res.status(404).json({ error: error.message });
		}

		res.status(500).json({ error: error.message });
	}
});

/**
 * POST /api/recipes/:menuItemId/ingredients
 * Add a single ingredient to existing recipe
 *
 * Body:
 * {
 *   "ingredientId": "uuid",
 *   "quantity": 8,
 *   "unit": "oz",
 *   "prepLossFactor": 5
 * }
 */
router.post("/:menuItemId/ingredients", async (req, res) => {
	try {
		const { menuItemId } = req.params;
		const { ingredientId, quantity, unit, prepLossFactor } = req.body;

		// ✅ FIXED: Look up restaurant_id from business_id
		const businessId = req.userDetails?.businessId;
		const restaurantId = await getRestaurantId(businessId);

		// Verify ownership
		const hasAccess = await verifyMenuItemOwnership(menuItemId, restaurantId);
		if (!hasAccess) {
			return res.status(403).json({ error: "Access denied" });
		}

		// Validation
		if (!ingredientId) {
			return res.status(400).json({ error: "ingredientId is required" });
		}
		if (!quantity || quantity <= 0) {
			return res.status(400).json({ error: "quantity must be greater than 0" });
		}
		if (!unit) {
			return res.status(400).json({ error: "unit is required" });
		}

		const ingredient = await addIngredientToRecipe(menuItemId, {
			ingredientId,
			quantity: parseFloat(quantity),
			unit,
			prepLossFactor: prepLossFactor ? parseFloat(prepLossFactor) : 0,
		});

		res.status(201).json(ingredient);
	} catch (error) {
		console.error(
			`Error in POST /api/recipes/${req.params.menuItemId}/ingredients:`,
			error
		);

		if (error.message === "Ingredient already exists in this recipe") {
			return res.status(409).json({ error: error.message });
		}

		if (error.message.includes("No restaurant found")) {
			return res.status(404).json({ error: error.message });
		}

		res.status(500).json({ error: error.message });
	}
});

/**
 * PUT /api/recipes/ingredients/:recipeIngredientId
 * Update a specific recipe ingredient
 *
 * Body: Any combination of:
 * {
 *   "quantity": 10,
 *   "unit": "oz",
 *   "prepLossFactor": 7
 * }
 */
router.put("/ingredients/:recipeIngredientId", async (req, res) => {
	try {
		const { recipeIngredientId } = req.params;
		const { quantity, unit, prepLossFactor } = req.body;

		// Build updates object
		const updates = {};
		if (quantity !== undefined) updates.quantity = parseFloat(quantity);
		if (unit !== undefined) updates.unit = unit;
		if (prepLossFactor !== undefined)
			updates.prepLossFactor = parseFloat(prepLossFactor);

		const ingredient = await updateRecipeIngredient(
			recipeIngredientId,
			updates
		);

		res.json(ingredient);
	} catch (error) {
		console.error(
			`Error in PUT /api/recipes/ingredients/${req.params.recipeIngredientId}:`,
			error
		);

		if (error.message === "Recipe ingredient not found") {
			return res.status(404).json({ error: error.message });
		}

		res.status(500).json({ error: error.message });
	}
});

/**
 * DELETE /api/recipes/ingredients/:recipeIngredientId
 * Remove an ingredient from a recipe
 */
router.delete("/ingredients/:recipeIngredientId", async (req, res) => {
	try {
		const { recipeIngredientId } = req.params;

		const result = await removeIngredientFromRecipe(recipeIngredientId);

		res.json(result);
	} catch (error) {
		console.error(
			`Error in DELETE /api/recipes/ingredients/${req.params.recipeIngredientId}:`,
			error
		);
		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/recipes/:menuItemId/cost
 * Calculate theoretical food cost for a menu item
 */
router.get("/:menuItemId/cost", async (req, res) => {
	try {
		const { menuItemId } = req.params;

		// ✅ FIXED: Look up restaurant_id from business_id
		const businessId = req.userDetails?.businessId;
		const restaurantId = await getRestaurantId(businessId);

		// Verify ownership
		const hasAccess = await verifyMenuItemOwnership(menuItemId, restaurantId);
		if (!hasAccess) {
			return res.status(403).json({ error: "Access denied" });
		}

		const costBreakdown = await calculateRecipeCost(menuItemId, restaurantId);

		res.json(costBreakdown);
	} catch (error) {
		console.error(
			`Error in GET /api/recipes/${req.params.menuItemId}/cost:`,
			error
		);

		if (error.message.includes("No restaurant found")) {
			return res.status(404).json({ error: error.message });
		}

		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/recipes/:menuItemId/validate
 * Validate recipe - check if ingredients exist in inventory
 */
router.get("/:menuItemId/validate", async (req, res) => {
	try {
		const { menuItemId } = req.params;

		// ✅ FIXED: Look up restaurant_id from business_id
		const businessId = req.userDetails?.businessId;
		const restaurantId = await getRestaurantId(businessId);

		// Verify ownership
		const hasAccess = await verifyMenuItemOwnership(menuItemId, restaurantId);
		if (!hasAccess) {
			return res.status(403).json({ error: "Access denied" });
		}

		const validation = await validateRecipe(menuItemId, restaurantId);

		res.json(validation);
	} catch (error) {
		console.error(
			`Error in GET /api/recipes/${req.params.menuItemId}/validate:`,
			error
		);

		if (error.message.includes("No restaurant found")) {
			return res.status(404).json({ error: error.message });
		}

		res.status(500).json({ error: error.message });
	}
});

/**
 * POST /api/recipes/:menuItemId/calculate-deductions
 * Calculate ingredient deductions for POS integration
 * Used when processing POS sales to know how much inventory to deduct
 *
 * Body:
 * {
 *   "quantity": 2
 * }
 */
router.post("/:menuItemId/calculate-deductions", async (req, res) => {
	try {
		const { menuItemId } = req.params;
		const { quantity } = req.body;

		// ✅ FIXED: Look up restaurant_id from business_id
		const businessId = req.userDetails?.businessId;
		const restaurantId = await getRestaurantId(businessId);

		// Verify ownership
		const hasAccess = await verifyMenuItemOwnership(menuItemId, restaurantId);
		if (!hasAccess) {
			return res.status(403).json({ error: "Access denied" });
		}

		// Validation
		if (!quantity || quantity <= 0) {
			return res.status(400).json({
				error: "quantity is required and must be greater than 0",
			});
		}

		const deductions = await calculateIngredientDeductions(
			menuItemId,
			parseFloat(quantity)
		);

		res.json({
			menu_item_id: menuItemId,
			quantity_sold: parseFloat(quantity),
			deductions: deductions,
		});
	} catch (error) {
		console.error(
			`Error in POST /api/recipes/${req.params.menuItemId}/calculate-deductions:`,
			error
		);

		if (error.message === "No recipe found for this menu item") {
			return res.status(404).json({ error: error.message });
		}

		if (error.message.includes("No restaurant found")) {
			return res.status(404).json({ error: error.message });
		}

		res.status(500).json({ error: error.message });
	}
});

export default router;
