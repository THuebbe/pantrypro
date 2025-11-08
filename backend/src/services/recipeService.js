// /backend/src/services/recipeService.js

import { supabase } from "./supabase.js";

/**
 * Get recipe for a menu item
 * @param {string} menuItemId - Menu item UUID
 * @returns {Promise<Object>} Recipe with ingredients and cost calculations
 */
export async function getRecipe(menuItemId) {
	if (!menuItemId) {
		throw new Error("Menu item ID is required");
	}

	try {
		// Get recipe ingredients with ingredient details
		const { data: recipeIngredients, error } = await supabase
			.from("recipe_ingredients")
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
			.eq("menu_item_id", menuItemId)
			.order("created_at", { ascending: true });

		if (error) throw error;

		// Transform data
		const ingredients = (recipeIngredients || []).map((ri) => ({
			id: ri.id,
			ingredient_id: ri.ingredient_id,
			ingredient_name: ri.ingredient_library?.name || "Unknown",
			ingredient_category: ri.ingredient_library?.category || "uncategorized",
			quantity: parseFloat(ri.quantity),
			unit: ri.unit,
			prep_loss_factor: parseFloat(ri.prep_loss_factor || 0),
		}));

		return {
			menu_item_id: menuItemId,
			ingredients: ingredients,
			ingredient_count: ingredients.length,
		};
	} catch (error) {
		console.error("Error getting recipe:", error);
		throw new Error(`Failed to get recipe: ${error.message}`);
	}
}

/**
 * Create or update a complete recipe for a menu item
 * This replaces all existing recipe ingredients
 * @param {string} menuItemId - Menu item UUID
 * @param {Array} ingredients - Array of ingredient objects
 * @returns {Promise<Object>} Created recipe
 */
export async function createOrUpdateRecipe(menuItemId, ingredients) {
	if (!menuItemId) {
		throw new Error("Menu item ID is required");
	}

	if (!Array.isArray(ingredients) || ingredients.length === 0) {
		throw new Error("At least one ingredient is required");
	}

	// Validate each ingredient
	for (const ingredient of ingredients) {
		if (!ingredient.ingredientId) {
			throw new Error("Ingredient ID is required for all ingredients");
		}
		if (!ingredient.quantity || ingredient.quantity <= 0) {
			throw new Error("Quantity must be greater than 0");
		}
		if (!ingredient.unit) {
			throw new Error("Unit is required for all ingredients");
		}
	}

	try {
		// Delete existing recipe ingredients
		const { error: deleteError } = await supabase
			.from("recipe_ingredients")
			.delete()
			.eq("menu_item_id", menuItemId);

		if (deleteError) throw deleteError;

		// Insert new recipe ingredients
		const now = new Date().toISOString();
		const recipeData = ingredients.map((ingredient) => ({
			menu_item_id: menuItemId,
			ingredient_id: ingredient.ingredientId,
			quantity: parseFloat(ingredient.quantity),
			unit: ingredient.unit,
			prep_loss_factor: parseFloat(ingredient.prepLossFactor || 0),
			created_at: now,
			updated_at: now,
		}));

		const { data, error: insertError } = await supabase
			.from("recipe_ingredients")
			.insert(recipeData)
			.select();

		if (insertError) throw insertError;

		return {
			success: true,
			message: `Recipe created with ${data.length} ingredients`,
			ingredients: data,
		};
	} catch (error) {
		console.error("Error creating/updating recipe:", error);
		throw new Error(`Failed to create/update recipe: ${error.message}`);
	}
}

/**
 * Add a single ingredient to a recipe
 * @param {string} menuItemId - Menu item UUID
 * @param {object} ingredient - Ingredient details
 * @returns {Promise<Object>} Added ingredient
 */
export async function addIngredientToRecipe(menuItemId, ingredient) {
	if (!menuItemId) {
		throw new Error("Menu item ID is required");
	}

	if (!ingredient.ingredientId) {
		throw new Error("Ingredient ID is required");
	}

	if (!ingredient.quantity || ingredient.quantity <= 0) {
		throw new Error("Quantity must be greater than 0");
	}

	if (!ingredient.unit) {
		throw new Error("Unit is required");
	}

	try {
		// Check if ingredient already exists in recipe
		const { data: existing } = await supabase
			.from("recipe_ingredients")
			.select("id")
			.eq("menu_item_id", menuItemId)
			.eq("ingredient_id", ingredient.ingredientId)
			.single();

		if (existing) {
			throw new Error("Ingredient already exists in this recipe");
		}

		const now = new Date().toISOString();
		const { data, error } = await supabase
			.from("recipe_ingredients")
			.insert({
				menu_item_id: menuItemId,
				ingredient_id: ingredient.ingredientId,
				quantity: parseFloat(ingredient.quantity),
				unit: ingredient.unit,
				prep_loss_factor: parseFloat(ingredient.prepLossFactor || 0),
				created_at: now,
				updated_at: now,
			})
			.select()
			.single();

		if (error) throw error;

		return data;
	} catch (error) {
		console.error("Error adding ingredient to recipe:", error);
		throw error;
	}
}

/**
 * Update a single recipe ingredient
 * @param {string} recipeIngredientId - Recipe ingredient UUID
 * @param {object} updates - Fields to update
 * @returns {Promise<Object>} Updated ingredient
 */
export async function updateRecipeIngredient(recipeIngredientId, updates) {
	if (!recipeIngredientId) {
		throw new Error("Recipe ingredient ID is required");
	}

	try {
		const now = new Date().toISOString();
		const updateData = {
			updated_at: now,
		};

		if (updates.quantity !== undefined) {
			if (updates.quantity <= 0) {
				throw new Error("Quantity must be greater than 0");
			}
			updateData.quantity = parseFloat(updates.quantity);
		}

		if (updates.unit !== undefined) {
			if (!updates.unit) {
				throw new Error("Unit cannot be empty");
			}
			updateData.unit = updates.unit;
		}

		if (updates.prepLossFactor !== undefined) {
			updateData.prep_loss_factor = parseFloat(updates.prepLossFactor);
		}

		const { data, error } = await supabase
			.from("recipe_ingredients")
			.update(updateData)
			.eq("id", recipeIngredientId)
			.select()
			.single();

		if (error) {
			if (error.code === "PGRST116") {
				throw new Error("Recipe ingredient not found");
			}
			throw error;
		}

		return data;
	} catch (error) {
		console.error("Error updating recipe ingredient:", error);
		throw error;
	}
}

/**
 * Remove an ingredient from a recipe
 * @param {string} recipeIngredientId - Recipe ingredient UUID
 * @returns {Promise<Object>} Success message
 */
export async function removeIngredientFromRecipe(recipeIngredientId) {
	if (!recipeIngredientId) {
		throw new Error("Recipe ingredient ID is required");
	}

	try {
		const { error } = await supabase
			.from("recipe_ingredients")
			.delete()
			.eq("id", recipeIngredientId);

		if (error) throw error;

		return {
			success: true,
			message: "Ingredient removed from recipe",
		};
	} catch (error) {
		console.error("Error removing ingredient from recipe:", error);
		throw new Error(`Failed to remove ingredient: ${error.message}`);
	}
}

/**
 * Calculate theoretical food cost for a menu item based on its recipe
 * @param {string} menuItemId - Menu item UUID
 * @param {string} restaurantId - Restaurant UUID (for inventory lookup)
 * @returns {Promise<Object>} Cost breakdown and warnings
 */
export async function calculateRecipeCost(menuItemId, restaurantId) {
	if (!menuItemId) {
		throw new Error("Menu item ID is required");
	}

	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	try {
		// Get recipe ingredients
		const { data: recipeIngredients, error: recipeError } = await supabase
			.from("recipe_ingredients")
			.select(
				`
        *,
        ingredient_library (
          id,
          name
        )
      `
			)
			.eq("menu_item_id", menuItemId);

		if (recipeError) throw recipeError;

		if (!recipeIngredients || recipeIngredients.length === 0) {
			return {
				total_cost: 0,
				ingredients: [],
				warnings: ["No recipe defined for this menu item"],
			};
		}

		const warnings = [];
		const ingredientCosts = [];
		let totalCost = 0;

		// Get inventory data for all ingredients
		for (const ri of recipeIngredients) {
			const { data: inventoryItem } = await supabase
				.from("restaurant_inventory")
				.select("cost_per_unit, quantity")
				.eq("restaurant_id", restaurantId)
				.eq("ingredient_id", ri.ingredient_id)
				.single();

			const costPerUnit = parseFloat(inventoryItem?.cost_per_unit || 0);
			const currentStock = parseFloat(inventoryItem?.quantity || 0);
			const quantity = parseFloat(ri.quantity);
			const prepLossFactor = parseFloat(ri.prep_loss_factor || 0);

			// Calculate adjusted quantity with prep loss
			const adjustedQuantity = quantity * (1 + prepLossFactor / 100);
			const ingredientCost = adjustedQuantity * costPerUnit;

			totalCost += ingredientCost;

			// Check for warnings
			if (!inventoryItem) {
				warnings.push(`${ri.ingredient_library.name} not found in inventory`);
			} else if (currentStock === 0) {
				warnings.push(`${ri.ingredient_library.name} is out of stock`);
			} else if (costPerUnit === 0) {
				warnings.push(
					`${ri.ingredient_library.name} has no cost defined - cost calculation may be inaccurate`
				);
			}

			ingredientCosts.push({
				ingredient_id: ri.ingredient_id,
				ingredient_name: ri.ingredient_library.name,
				quantity: quantity,
				unit: ri.unit,
				prep_loss_factor: prepLossFactor,
				adjusted_quantity: parseFloat(adjustedQuantity.toFixed(4)),
				cost_per_unit: costPerUnit,
				ingredient_cost: parseFloat(ingredientCost.toFixed(2)),
				in_stock: currentStock > 0,
				current_stock: currentStock,
			});
		}

		return {
			total_cost: parseFloat(totalCost.toFixed(2)),
			ingredients: ingredientCosts,
			warnings: warnings,
		};
	} catch (error) {
		console.error("Error calculating recipe cost:", error);
		throw new Error(`Failed to calculate recipe cost: ${error.message}`);
	}
}

/**
 * Validate a recipe - check if all ingredients exist and are in stock
 * @param {string} menuItemId - Menu item UUID
 * @param {string} restaurantId - Restaurant UUID
 * @returns {Promise<Object>} Validation results
 */
export async function validateRecipe(menuItemId, restaurantId) {
	if (!menuItemId) {
		throw new Error("Menu item ID is required");
	}

	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	try {
		// Get recipe
		const { data: recipeIngredients, error } = await supabase
			.from("recipe_ingredients")
			.select(
				`
        *,
        ingredient_library (
          id,
          name
        )
      `
			)
			.eq("menu_item_id", menuItemId);

		if (error) throw error;

		if (!recipeIngredients || recipeIngredients.length === 0) {
			return {
				is_valid: false,
				has_recipe: false,
				errors: ["No recipe defined"],
				warnings: [],
			};
		}

		const errors = [];
		const warnings = [];
		let allIngredientsExist = true;
		let allIngredientsInStock = true;

		// Check each ingredient
		for (const ri of recipeIngredients) {
			const { data: inventoryItem } = await supabase
				.from("restaurant_inventory")
				.select("quantity")
				.eq("restaurant_id", restaurantId)
				.eq("ingredient_id", ri.ingredient_id)
				.single();

			if (!inventoryItem) {
				errors.push(
					`${ri.ingredient_library.name} does not exist in inventory`
				);
				allIngredientsExist = false;
			} else {
				const currentStock = parseFloat(inventoryItem.quantity || 0);
				if (currentStock === 0) {
					warnings.push(`${ri.ingredient_library.name} is out of stock`);
					allIngredientsInStock = false;
				}
			}
		}

		return {
			is_valid: allIngredientsExist,
			has_recipe: true,
			all_in_stock: allIngredientsInStock,
			errors: errors,
			warnings: warnings,
		};
	} catch (error) {
		console.error("Error validating recipe:", error);
		throw new Error(`Failed to validate recipe: ${error.message}`);
	}
}

/**
 * Calculate ingredient deductions for POS integration
 * When a menu item is sold, this calculates how much of each ingredient to deduct
 * @param {string} menuItemId - Menu item UUID
 * @param {number} quantity - Number of items sold
 * @returns {Promise<Array>} Array of ingredient deductions
 */
export async function calculateIngredientDeductions(menuItemId, quantity) {
	if (!menuItemId) {
		throw new Error("Menu item ID is required");
	}

	if (!quantity || quantity <= 0) {
		throw new Error("Quantity must be greater than 0");
	}

	try {
		// Get recipe
		const { data: recipeIngredients, error } = await supabase
			.from("recipe_ingredients")
			.select("*")
			.eq("menu_item_id", menuItemId);

		if (error) throw error;

		if (!recipeIngredients || recipeIngredients.length === 0) {
			throw new Error("No recipe found for this menu item");
		}

		// Calculate deductions
		const deductions = recipeIngredients.map((ri) => {
			const recipeQuantity = parseFloat(ri.quantity);
			const prepLossFactor = parseFloat(ri.prep_loss_factor || 0);

			// Adjust for prep loss
			const adjustedQuantity = recipeQuantity * (1 + prepLossFactor / 100);

			// Multiply by items sold
			const totalDeduction = adjustedQuantity * quantity;

			return {
				ingredient_id: ri.ingredient_id,
				quantity: parseFloat(totalDeduction.toFixed(4)),
				unit: ri.unit,
			};
		});

		return deductions;
	} catch (error) {
		console.error("Error calculating ingredient deductions:", error);
		throw error;
	}
}
