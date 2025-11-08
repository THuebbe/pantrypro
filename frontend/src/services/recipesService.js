// frontend\src\services\recipesService.js

import api from "../core/database/api";

/**
 * Get recipe for menu item
 * @param {string} menuItemId - Menu item ID
 */
export async function fetchRecipe(menuItemId) {
	const response = await api.get(`/recipes/${menuItemId}`);
	return response.data;
}

/**
 * Create/update complete recipe
 * @param {string} menuItemId - Menu item ID
 * @param {Array} ingredients - Array of ingredient objects
 */
export async function saveRecipe(menuItemId, ingredients) {
	const response = await api.post(`/recipes/${menuItemId}`, { ingredients });
	return response.data;
}

/**
 * Add single ingredient to recipe
 * @param {string} menuItemId - Menu item ID
 * @param {Object} ingredient - Ingredient data
 */
export async function addRecipeIngredient(menuItemId, ingredient) {
	const response = await api.post(
		`/recipes/${menuItemId}/ingredients`,
		ingredient
	);
	return response.data;
}

/**
 * Update recipe ingredient
 * @param {string} recipeIngredientId - Recipe ingredient ID
 * @param {Object} updates - Updated fields
 */
export async function updateRecipeIngredient(recipeIngredientId, updates) {
	const response = await api.put(
		`/recipes/ingredients/${recipeIngredientId}`,
		updates
	);
	return response.data;
}

/**
 * Remove ingredient from recipe
 * @param {string} recipeIngredientId - Recipe ingredient ID
 */
export async function deleteRecipeIngredient(recipeIngredientId) {
	const response = await api.delete(
		`/recipes/ingredients/${recipeIngredientId}`
	);
	return response.data;
}

/**
 * Calculate recipe cost
 * @param {string} menuItemId - Menu item ID
 */
export async function calculateRecipeCost(menuItemId) {
	const response = await api.get(`/recipes/${menuItemId}/cost`);
	return response.data;
}

/**
 * Validate recipe
 * @param {string} menuItemId - Menu item ID
 */
export async function validateRecipe(menuItemId) {
	const response = await api.get(`/recipes/${menuItemId}/validate`);
	return response.data;
}
