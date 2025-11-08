// /backend/src/services/posAdapters/toastAdapter.js

/**
 * Toast POS Menu Import Adapter
 *
 * Toast API Documentation: https://doc.toasttab.com/
 *
 * Required Environment Variables:
 * - TOAST_API_URL (e.g., https://ws-api.toasttab.com or sandbox URL)
 * - TOAST_CLIENT_ID
 * - TOAST_CLIENT_SECRET
 *
 * Note: Each restaurant will have their own Toast credentials stored in
 * restaurants.pos_integration_data as JSONB
 */

import axios from "axios";

/**
 * Fetch menu items from Toast POS
 * @param {object} credentials - Toast API credentials
 * @param {string} credentials.restaurantGuid - Toast restaurant GUID
 * @param {string} credentials.accessToken - Toast API access token
 * @returns {Promise<Array>} Normalized menu items
 */
export async function fetchToastMenuItems(credentials) {
	const { restaurantGuid, accessToken, apiUrl } = credentials;

	if (!restaurantGuid || !accessToken) {
		throw new Error(
			"Toast credentials incomplete: restaurantGuid and accessToken required"
		);
	}

	const baseUrl =
		apiUrl || process.env.TOAST_API_URL || "https://ws-api.toasttab.com";

	try {
		// Toast API endpoint for menu items
		const response = await axios.get(
			`${baseUrl}/restaurants/v1/restaurants/${restaurantGuid}/menus`,
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Toast-Restaurant-External-ID": restaurantGuid,
					"Content-Type": "application/json",
				},
			}
		);

		// Toast returns nested menu structure: menus > groups > items
		const menuItems = [];

		if (response.data && Array.isArray(response.data)) {
			for (const menu of response.data) {
				if (menu.groups && Array.isArray(menu.groups)) {
					for (const group of menu.groups) {
						if (group.items && Array.isArray(group.items)) {
							for (const item of group.items) {
								// Only import items that are available for sale
								if (
									item.visibility === "VISIBLE" ||
									item.visibility === "ALWAYS"
								) {
									menuItems.push({
										posMenuItemId: item.guid,
										name: item.name,
										description: item.description || "",
										category: group.name || "Uncategorized",
										price: item.price ? item.price / 100 : 0, // Toast uses cents
										isActive:
											item.visibility === "VISIBLE" ||
											item.visibility === "ALWAYS",
										posData: {
											sku: item.sku,
											plu: item.plu,
											visibility: item.visibility,
											groupGuid: group.guid,
											groupName: group.name,
										},
									});
								}
							}
						}
					}
				}
			}
		}

		return menuItems;
	} catch (error) {
		console.error("Error fetching Toast menu items:", error);

		if (error.response) {
			// Toast API error
			throw new Error(
				`Toast API error (${error.response.status}): ${
					error.response.data?.message || error.message
				}`
			);
		}

		throw new Error(`Failed to fetch Toast menu: ${error.message}`);
	}
}

/**
 * Get Toast OAuth access token
 * @param {object} credentials - Toast OAuth credentials
 * @param {string} credentials.clientId - Toast client ID
 * @param {string} credentials.clientSecret - Toast client secret
 * @param {string} credentials.restaurantGuid - Toast restaurant GUID
 * @returns {Promise<string>} Access token
 */
export async function getToastAccessToken(credentials) {
	const { clientId, clientSecret, restaurantGuid } = credentials;

	if (!clientId || !clientSecret || !restaurantGuid) {
		throw new Error("Toast OAuth credentials incomplete");
	}

	const baseUrl = process.env.TOAST_AUTH_URL || "https://ws-api.toasttab.com";

	try {
		const response = await axios.post(
			`${baseUrl}/authentication/v1/authentication/login`,
			{
				clientId: clientId,
				clientSecret: clientSecret,
				userAccessType: "TOAST_MACHINE_CLIENT",
			},
			{
				headers: {
					"Content-Type": "application/json",
					"Toast-Restaurant-External-ID": restaurantGuid,
				},
			}
		);

		return response.data.token.accessToken;
	} catch (error) {
		console.error("Error getting Toast access token:", error);
		throw new Error(`Failed to authenticate with Toast: ${error.message}`);
	}
}

/**
 * Verify Toast connection
 * @param {object} credentials - Toast credentials
 * @returns {Promise<boolean>} True if connection successful
 */
export async function verifyToastConnection(credentials) {
	try {
		// Try to fetch a small amount of data to verify connection
		const { restaurantGuid, accessToken, apiUrl } = credentials;
		const baseUrl =
			apiUrl || process.env.TOAST_API_URL || "https://ws-api.toasttab.com";

		const response = await axios.get(
			`${baseUrl}/restaurants/v1/restaurants/${restaurantGuid}`,
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Toast-Restaurant-External-ID": restaurantGuid,
				},
			}
		);

		return response.status === 200;
	} catch (error) {
		console.error("Toast connection verification failed:", error);
		return false;
	}
}
