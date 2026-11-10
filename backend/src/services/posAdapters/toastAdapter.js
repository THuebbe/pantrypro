// /backend/src/services/posAdapters/toastAdapter.js

/**
 * Toast POS Menu Import Adapter
 *
 * Reads menus through the Toast menus API V2, which is the version
 * available to Standard API access (scope: menus:read).
 *
 * Each restaurant's Toast credentials are stored encrypted in
 * restaurants.pos_integration_data:
 *   { restaurantGuid, clientId, clientSecret, apiUrl }
 */

import { toastGet, assertToastCredentials } from "./toastClient.js";

/**
 * Flatten the Toast menus V2 response into a list of menu items.
 * Menus contain menu groups, and menu groups can contain more menu groups.
 * An item that appears in several groups is returned once.
 * @param {object} menusResponse - Body of GET /menus/v2/menus
 * @returns {Array} Normalized menu items
 */
export function normalizeToastMenus(menusResponse) {
	const items = new Map();

	const visitGroup = (group) => {
		if (!group) return;

		for (const item of group.menuItems || []) {
			if (!item?.guid || items.has(item.guid)) continue;

			const visibility = Array.isArray(item.visibility) ? item.visibility : null;

			items.set(item.guid, {
				posMenuItemId: item.guid,
				name: item.name,
				description: item.description || "",
				category: group.name || "Uncategorized",
				// Toast reports prices in dollars. Items priced by size or by
				// menu have no single price and come through as null.
				price: typeof item.price === "number" ? item.price : 0,
				// An empty visibility list means the item is hidden everywhere.
				isActive: visibility ? visibility.length > 0 : true,
				posData: {
					sku: item.sku,
					plu: item.plu,
					visibility,
					groupGuid: group.guid,
					groupName: group.name,
				},
			});
		}

		for (const subgroup of group.menuGroups || []) {
			visitGroup(subgroup);
		}
	};

	for (const menu of menusResponse?.menus || []) {
		for (const group of menu.menuGroups || []) {
			visitGroup(group);
		}
	}

	return Array.from(items.values());
}

/**
 * Fetch menu items from Toast POS
 * @param {object} credentials - Toast credentials
 * @returns {Promise<Array>} Normalized menu items
 */
export async function fetchToastMenuItems(credentials) {
	assertToastCredentials(credentials);

	const menus = await toastGet(credentials, "/menus/v2/menus");

	return normalizeToastMenus(menus);
}

/**
 * Verify Toast connection.
 * Signs in and reads the restaurant record, so it checks the client ID,
 * the client secret and the restaurant GUID together.
 * @param {object} credentials - Toast credentials
 * @returns {Promise<boolean>} True if connection successful; throws with a
 *   readable reason otherwise
 */
export async function verifyToastConnection(credentials) {
	assertToastCredentials(credentials);

	await toastGet(
		credentials,
		`/restaurants/v1/restaurants/${encodeURIComponent(credentials.restaurantGuid)}`
	);

	return true;
}
