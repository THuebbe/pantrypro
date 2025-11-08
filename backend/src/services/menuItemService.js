// /backend/src/services/menuItemService.js

import { supabase } from "./supabase.js";

/**
 * Get all menu items for a restaurant
 * @param {string} restaurantId - Restaurant UUID
 * @param {object} filters - Optional filters (category, isActive)
 * @returns {Promise<Array>} Array of menu items
 */
export async function getMenuItems(restaurantId, filters = {}) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	try {
		let query = supabase
			.from("menu_items")
			.select("*")
			.eq("restaurant_id", restaurantId);

		// Apply filters
		if (filters.category) {
			query = query.eq("category", filters.category);
		}

		if (filters.isActive !== undefined) {
			query = query.eq("is_active", filters.isActive);
		}

		// Default to showing active items only
		if (filters.isActive === undefined) {
			query = query.eq("is_active", true);
		}

		query = query.order("name", { ascending: true });

		const { data, error } = await query;

		if (error) throw error;

		return data || [];
	} catch (error) {
		console.error("Error getting menu items:", error);
		throw new Error(`Failed to get menu items: ${error.message}`);
	}
}

/**
 * Get a single menu item by ID with its recipe
 * @param {string} menuItemId - Menu item UUID
 * @returns {Promise<Object>} Menu item with recipe details
 */
export async function getMenuItem(menuItemId) {
	if (!menuItemId) {
		throw new Error("Menu item ID is required");
	}

	try {
		// Get menu item
		const { data: menuItem, error: menuItemError } = await supabase
			.from("menu_items")
			.select("*")
			.eq("id", menuItemId)
			.single();

		if (menuItemError) {
			if (menuItemError.code === "PGRST116") {
				throw new Error("Menu item not found");
			}
			throw menuItemError;
		}

		// Get recipe ingredients with ingredient details
		const { data: recipeIngredients, error: recipeError } = await supabase
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
			.eq("menu_item_id", menuItemId);

		const restaurantId = menuItem.restaurant_id;
		const { data: inventory } = await supabase
			.from("restaurant_inventory")
			.select("ingredient_id, cost_per_unit")
			.eq("restaurant_id", restaurantId);

		// Create cost map
		const ingredientCosts = {};
		inventory?.forEach((item) => {
			ingredientCosts[item.ingredient_id] = parseFloat(item.cost_per_unit || 0);
		});

		if (recipeError) throw recipeError;

		// Calculate recipe cost
		let recipeCost = 0;
		const ingredients = (recipeIngredients || []).map((ri) => {
			const costPerUnit = ingredientCosts[ri.ingredient_id] || 0;
			const quantity = parseFloat(ri.quantity || 0);
			const prepLossFactor = parseFloat(ri.prep_loss_factor || 0);

			// Adjust quantity for prep loss
			const adjustedQuantity = quantity * (1 + prepLossFactor / 100);
			const ingredientCost = adjustedQuantity * costPerUnit;
			recipeCost += ingredientCost;

			return {
				id: ri.id,
				ingredient_id: ri.ingredient_id,
				ingredient_name: ri.ingredient_library?.name || "Unknown",
				ingredient_category: ri.ingredient_library?.category || "uncategorized",
				quantity: quantity,
				unit: ri.unit,
				prep_loss_factor: prepLossFactor,
				cost_per_unit: costPerUnit,
				ingredient_cost: parseFloat(ingredientCost.toFixed(2)),
			};
		});

		// Calculate food cost percentage
		const price = parseFloat(menuItem.price || 0);
		const foodCostPercent = price > 0 ? (recipeCost / price) * 100 : 0;

		return {
			...menuItem,
			recipe: ingredients,
			recipe_cost: parseFloat(recipeCost.toFixed(2)),
			food_cost_percent: parseFloat(foodCostPercent.toFixed(2)),
			gross_profit: parseFloat((price - recipeCost).toFixed(2)),
		};
	} catch (error) {
		console.error("Error getting menu item:", error);
		throw error;
	}
}

/**
 * Create a new menu item
 * @param {string} restaurantId - Restaurant UUID
 * @param {object} menuItemData - Menu item details
 * @returns {Promise<Object>} Created menu item
 */
export async function createMenuItem(restaurantId, menuItemData) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	if (!menuItemData.name) {
		throw new Error("Menu item name is required");
	}

	if (!menuItemData.category) {
		throw new Error("Category is required");
	}

	try {
		const now = new Date().toISOString();

		const { data, error } = await supabase
			.from("menu_items")
			.insert({
				restaurant_id: restaurantId,
				name: menuItemData.name,
				category: menuItemData.category,
				price: menuItemData.price || 0,
				toast_menu_item_id: menuItemData.toastMenuItemId || null,
				is_active:
					menuItemData.isActive !== undefined ? menuItemData.isActive : true,
				created_at: now,
				updated_at: now,
			})
			.select()
			.single();

		if (error) throw error;

		return data;
	} catch (error) {
		console.error("Error creating menu item:", error);
		throw new Error(`Failed to create menu item: ${error.message}`);
	}
}

/**
 * Update a menu item
 * @param {string} menuItemId - Menu item UUID
 * @param {object} updates - Fields to update
 * @returns {Promise<Object>} Updated menu item
 */
export async function updateMenuItem(menuItemId, updates) {
	if (!menuItemId) {
		throw new Error("Menu item ID is required");
	}

	try {
		const now = new Date().toISOString();

		// Build update object with only provided fields
		const updateData = {
			updated_at: now,
		};

		if (updates.name !== undefined) updateData.name = updates.name;
		if (updates.category !== undefined) updateData.category = updates.category;
		if (updates.price !== undefined) updateData.price = updates.price;
		if (updates.toastMenuItemId !== undefined)
			updateData.toast_menu_item_id = updates.toastMenuItemId;
		if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

		const { data, error } = await supabase
			.from("menu_items")
			.update(updateData)
			.eq("id", menuItemId)
			.select()
			.single();

		if (error) {
			if (error.code === "PGRST116") {
				throw new Error("Menu item not found");
			}
			throw error;
		}

		return data;
	} catch (error) {
		console.error("Error updating menu item:", error);
		throw error;
	}
}

/**
 * Delete a menu item (soft delete by setting is_active = false)
 * @param {string} menuItemId - Menu item UUID
 * @returns {Promise<Object>} Deleted menu item
 */
export async function deleteMenuItem(menuItemId) {
	if (!menuItemId) {
		throw new Error("Menu item ID is required");
	}

	try {
		const now = new Date().toISOString();

		const { data, error } = await supabase
			.from("menu_items")
			.update({
				is_active: false,
				updated_at: now,
			})
			.eq("id", menuItemId)
			.select()
			.single();

		if (error) {
			if (error.code === "PGRST116") {
				throw new Error("Menu item not found");
			}
			throw error;
		}

		return data;
	} catch (error) {
		console.error("Error deleting menu item:", error);
		throw error;
	}
}

/**
 * Get all categories used by a restaurant's menu items
 * @param {string} restaurantId - Restaurant UUID
 * @returns {Promise<Array>} Array of unique categories
 */
export async function getMenuCategories(restaurantId) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	try {
		const { data, error } = await supabase
			.from("menu_items")
			.select("category")
			.eq("restaurant_id", restaurantId)
			.eq("is_active", true);

		if (error) throw error;

		// Get unique categories
		const categories = [...new Set(data.map((item) => item.category))].filter(
			Boolean
		);

		return categories.sort();
	} catch (error) {
		console.error("Error getting menu categories:", error);
		throw new Error(`Failed to get categories: ${error.message}`);
	}
}
