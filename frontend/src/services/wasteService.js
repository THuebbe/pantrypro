// frontend\src\services\wasteService.js

import api from "../core/database/api";

/**
 * Get valid waste reasons for dropdown
 * @returns {Promise} Waste and reduction reasons
 */
export async function fetchWasteReasons() {
	const response = await api.get("/waste/reasons");
	return response.data;
}

/**
 * Get waste categories
 * @returns {Promise} Category types
 */
export async function fetchWasteCategories() {
	const response = await api.get("/waste/categories");
	return response.data;
}

/**
 * Remove stock from inventory (logs waste automatically)
 * This is the operational endpoint for logging waste
 * @param {Object} data - Request data
 * @param {Array} data.items - Array of items to remove
 * @returns {Promise}
 */
export async function removeStock(data) {
	// Make sure we're sending { items: [...] } structure
	const response = await api.post("/inventory/remove", data);
	return response.data;
}
