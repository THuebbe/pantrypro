// frontend\src\services\menuItemsService.js

import api from "../core/database/api";

/**
 * Get all menu items
 * @param {Object} filters - Optional filters
 * @param {string} filters.category - Filter by category
 * @param {boolean} filters.isActive - Filter by active status
 */
export async function fetchMenuItems(filters = {}) {
	const params = new URLSearchParams();

	if (filters.category) params.append("category", filters.category);
	if (filters.isActive !== undefined)
		params.append("isActive", filters.isActive);

	const response = await api.get(`/menu-items?${params.toString()}`);
	return response.data;
}

/**
 * Get unique categories
 */
export async function fetchMenuCategories() {
	const response = await api.get("/menu-items/categories");
	return response.data;
}

/**
 * Get single menu item with recipe
 * @param {string} id - Menu item ID
 */
export async function fetchMenuItem(id) {
	const response = await api.get(`/menu-items/${id}`);
	return response.data;
}

/**
 * Create new menu item
 * @param {Object} data - Menu item data
 */
export async function createMenuItem(data) {
	const response = await api.post("/menu-items", data);
	return response.data;
}

/**
 * Update menu item
 * @param {string} id - Menu item ID
 * @param {Object} data - Updated data
 */
export async function updateMenuItem(id, data) {
	const response = await api.put(`/menu-items/${id}`, data);
	return response.data;
}

/**
 * Delete menu item (soft delete)
 * @param {string} id - Menu item ID
 */
export async function deleteMenuItem(id) {
	const response = await api.delete(`/menu-items/${id}`);
	return response.data;
}
