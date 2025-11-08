// /backend/src/services/posAdapters/cloverAdapter.js

/**
 * Clover POS Menu Import Adapter
 *
 * Clover API Documentation: https://docs.clover.com/docs
 *
 * Required Environment Variables:
 * - CLOVER_API_URL (e.g., https://api.clover.com or sandbox URL)
 *
 * Note: Each restaurant will have their own Clover credentials stored in
 * restaurants.pos_integration_data as JSONB
 */

import axios from "axios";

/**
 * Fetch menu items from Clover POS
 * @param {object} credentials - Clover API credentials
 * @param {string} credentials.accessToken - Clover access token
 * @param {string} credentials.merchantId - Clover merchant ID
 * @returns {Promise<Array>} Normalized menu items
 */
export async function fetchCloverMenuItems(credentials) {
	const { accessToken, merchantId } = credentials;

	if (!accessToken || !merchantId) {
		throw new Error(
			"Clover credentials incomplete: accessToken and merchantId required"
		);
	}

	const baseUrl = process.env.CLOVER_API_URL || "https://api.clover.com";

	try {
		// Clover Items API
		const response = await axios.get(
			`${baseUrl}/v3/merchants/${merchantId}/items`,
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				params: {
					expand: "categories", // Include category information
				},
			}
		);

		const menuItems = [];

		if (response.data && response.data.elements) {
			for (const item of response.data.elements) {
				// Only import items that are available
				if (!item.hidden && item.available !== false) {
					// Get category name from first category (if exists)
					let category = "Uncategorized";
					if (
						item.categories &&
						item.categories.elements &&
						item.categories.elements.length > 0
					) {
						category = item.categories.elements[0].name;
					}

					menuItems.push({
						posMenuItemId: item.id,
						name: item.name,
						description: item.code || "", // Clover uses 'code' field for descriptions
						category: category,
						price: item.price ? item.price / 100 : 0, // Clover uses cents
						isActive: !item.hidden && item.available !== false,
						posData: {
							sku: item.sku,
							code: item.code,
							priceType: item.priceType,
							defaultTaxRates: item.defaultTaxRates,
							unitName: item.unitName,
							categories: item.categories?.elements?.map((c) => ({
								id: c.id,
								name: c.name,
							})),
							modifierGroups: item.modifierGroups,
						},
					});
				}
			}
		}

		return menuItems;
	} catch (error) {
		console.error("Error fetching Clover menu items:", error);

		if (error.response) {
			throw new Error(
				`Clover API error (${error.response.status}): ${
					error.response.data?.message || error.message
				}`
			);
		}

		throw new Error(`Failed to fetch Clover menu: ${error.message}`);
	}
}

/**
 * Fetch categories from Clover
 * @param {object} credentials - Clover API credentials
 * @returns {Promise<Array>} Categories
 */
export async function fetchCloverCategories(credentials) {
	const { accessToken, merchantId } = credentials;

	const baseUrl = process.env.CLOVER_API_URL || "https://api.clover.com";

	try {
		const response = await axios.get(
			`${baseUrl}/v3/merchants/${merchantId}/categories`,
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
			}
		);

		const categories = [];

		if (response.data && response.data.elements) {
			for (const category of response.data.elements) {
				categories.push({
					id: category.id,
					name: category.name,
					sortOrder: category.sortOrder,
				});
			}
		}

		return categories;
	} catch (error) {
		console.error("Error fetching Clover categories:", error);
		return [];
	}
}

/**
 * Verify Clover connection
 * @param {object} credentials - Clover credentials
 * @returns {Promise<boolean>} True if connection successful
 */
export async function verifyCloverConnection(credentials) {
	try {
		const { accessToken, merchantId } = credentials;

		const baseUrl = process.env.CLOVER_API_URL || "https://api.clover.com";

		const response = await axios.get(`${baseUrl}/v3/merchants/${merchantId}`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		return response.status === 200 && response.data.id === merchantId;
	} catch (error) {
		console.error("Clover connection verification failed:", error);
		return false;
	}
}

/**
 * Get Clover merchant info
 * @param {string} accessToken - Clover access token
 * @param {string} merchantId - Clover merchant ID
 * @returns {Promise<Object>} Merchant information
 */
export async function getCloverMerchantInfo(accessToken, merchantId) {
	const baseUrl = process.env.CLOVER_API_URL || "https://api.clover.com";

	try {
		const response = await axios.get(`${baseUrl}/v3/merchants/${merchantId}`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		return response.data;
	} catch (error) {
		console.error("Error fetching Clover merchant info:", error);
		throw new Error(`Failed to fetch Clover merchant info: ${error.message}`);
	}
}
