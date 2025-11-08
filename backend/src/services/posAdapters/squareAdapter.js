// /backend/src/services/posAdapters/squareAdapter.js

/**
 * Square POS Menu Import Adapter
 *
 * Square API Documentation: https://developer.squareup.com/reference/square
 *
 * Required Environment Variables:
 * - SQUARE_ENVIRONMENT (sandbox or production)
 *
 * Note: Each restaurant will have their own Square credentials stored in
 * restaurants.pos_integration_data as JSONB
 */

import axios from "axios";

/**
 * Fetch menu items from Square POS
 * @param {object} credentials - Square API credentials
 * @param {string} credentials.accessToken - Square access token
 * @param {string} credentials.locationId - Square location ID
 * @returns {Promise<Array>} Normalized menu items
 */
export async function fetchSquareMenuItems(credentials) {
	const { accessToken, locationId } = credentials;

	if (!accessToken || !locationId) {
		throw new Error(
			"Square credentials incomplete: accessToken and locationId required"
		);
	}

	const baseUrl =
		process.env.SQUARE_ENVIRONMENT === "sandbox"
			? "https://connect.squareupsandbox.com"
			: "https://connect.squareup.com";

	try {
		// Square Catalog API - list items
		const response = await axios.post(
			`${baseUrl}/v2/catalog/search`,
			{
				object_types: ["ITEM"],
				query: {
					enabled_location_ids_filter: {
						location_ids: [locationId],
					},
				},
			},
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
					"Square-Version": "2023-10-18", // Use latest stable version
				},
			}
		);

		const menuItems = [];

		if (response.data && response.data.objects) {
			for (const item of response.data.objects) {
				// Square items have variations (e.g., sizes)
				// For simplicity, we'll import the base item
				// You could enhance this to handle variations separately

				if (item.type === "ITEM" && item.item_data) {
					const itemData = item.item_data;

					// Get the first variation's price (if exists)
					let price = 0;
					if (itemData.variations && itemData.variations.length > 0) {
						const firstVariation = itemData.variations[0];
						if (firstVariation.item_variation_data?.price_money) {
							price =
								firstVariation.item_variation_data.price_money.amount / 100; // Square uses cents
						}
					}

					menuItems.push({
						posMenuItemId: item.id,
						name: itemData.name,
						description: itemData.description || "",
						category: itemData.category_id
							? "Needs Category Mapping"
							: "Uncategorized",
						price: price,
						isActive:
							!itemData.is_deleted && itemData.available_online !== false,
						posData: {
							categoryId: itemData.category_id,
							variations: itemData.variations?.map((v) => ({
								id: v.id,
								name: v.item_variation_data?.name,
								price: v.item_variation_data?.price_money?.amount / 100,
							})),
							imageIds: itemData.image_ids,
							modifierListInfo: itemData.modifier_list_info,
						},
					});
				}
			}
		}

		// If there are categories, fetch them for better category mapping
		if (menuItems.some((item) => item.posData.categoryId)) {
			const categories = await fetchSquareCategories(credentials);

			// Map category IDs to names
			for (const item of menuItems) {
				if (item.posData.categoryId) {
					const category = categories.find(
						(c) => c.id === item.posData.categoryId
					);
					if (category) {
						item.category = category.name;
					}
				}
			}
		}

		return menuItems;
	} catch (error) {
		console.error("Error fetching Square menu items:", error);

		if (error.response) {
			throw new Error(
				`Square API error (${error.response.status}): ${
					error.response.data?.errors?.[0]?.detail || error.message
				}`
			);
		}

		throw new Error(`Failed to fetch Square menu: ${error.message}`);
	}
}

/**
 * Fetch categories from Square
 * @param {object} credentials - Square API credentials
 * @returns {Promise<Array>} Categories
 */
async function fetchSquareCategories(credentials) {
	const { accessToken } = credentials;

	const baseUrl =
		process.env.SQUARE_ENVIRONMENT === "sandbox"
			? "https://connect.squareupsandbox.com"
			: "https://connect.squareup.com";

	try {
		const response = await axios.post(
			`${baseUrl}/v2/catalog/search`,
			{
				object_types: ["CATEGORY"],
			},
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
					"Square-Version": "2023-10-18",
				},
			}
		);

		const categories = [];

		if (response.data && response.data.objects) {
			for (const category of response.data.objects) {
				if (category.type === "CATEGORY" && category.category_data) {
					categories.push({
						id: category.id,
						name: category.category_data.name,
					});
				}
			}
		}

		return categories;
	} catch (error) {
		console.error("Error fetching Square categories:", error);
		return [];
	}
}

/**
 * Verify Square connection
 * @param {object} credentials - Square credentials
 * @returns {Promise<boolean>} True if connection successful
 */
export async function verifySquareConnection(credentials) {
	try {
		const { accessToken } = credentials;

		const baseUrl =
			process.env.SQUARE_ENVIRONMENT === "sandbox"
				? "https://connect.squareupsandbox.com"
				: "https://connect.squareup.com";

		const response = await axios.get(`${baseUrl}/v2/locations`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Square-Version": "2023-10-18",
			},
		});

		return response.status === 200 && response.data.locations?.length > 0;
	} catch (error) {
		console.error("Square connection verification failed:", error);
		return false;
	}
}

/**
 * Get Square locations for a given access token
 * Useful for initial setup - user needs to select which location to sync
 * @param {string} accessToken - Square access token
 * @returns {Promise<Array>} Available locations
 */
export async function getSquareLocations(accessToken) {
	const baseUrl =
		process.env.SQUARE_ENVIRONMENT === "sandbox"
			? "https://connect.squareupsandbox.com"
			: "https://connect.squareup.com";

	try {
		const response = await axios.get(`${baseUrl}/v2/locations`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Square-Version": "2023-10-18",
			},
		});

		return response.data.locations || [];
	} catch (error) {
		console.error("Error fetching Square locations:", error);
		throw new Error(`Failed to fetch Square locations: ${error.message}`);
	}
}
