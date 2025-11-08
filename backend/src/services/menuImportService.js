// /backend/src/services/menuImportService.js

import { supabase } from "./supabase.js";
import {
	fetchToastMenuItems,
	verifyToastConnection,
} from "./posAdapters/toastAdapter.js";
import {
	fetchSquareMenuItems,
	verifySquareConnection,
} from "./posAdapters/squareAdapter.js";
import {
	fetchCloverMenuItems,
	verifyCloverConnection,
} from "./posAdapters/cloverAdapter.js";

/**
 * Import menu items from POS system
 * @param {string} restaurantId - Restaurant UUID
 * @param {string} posSystem - POS system type ('toast', 'square', 'clover')
 * @param {object} options - Import options
 * @param {boolean} options.updateExisting - Update existing items (default: true)
 * @param {boolean} options.deactivateMissing - Deactivate items not in POS (default: false)
 * @returns {Promise<Object>} Import results with statistics
 */
export async function importMenuFromPOS(restaurantId, posSystem, options = {}) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	if (!posSystem) {
		throw new Error("POS system type is required");
	}

	const { updateExisting = true, deactivateMissing = false } = options;

	try {
		// Get restaurant and POS credentials
		const { data: restaurant, error: restaurantError } = await supabase
			.from("restaurants")
			.select("*")
			.eq("id", restaurantId)
			.single();

		if (restaurantError) throw restaurantError;

		if (!restaurant.pos_integration_data) {
			throw new Error("POS integration not configured for this restaurant");
		}

		// Fetch menu items from POS based on system type
		let posMenuItems;

		switch (posSystem.toLowerCase()) {
			case "toast":
				posMenuItems = await fetchToastMenuItems(
					restaurant.pos_integration_data
				);
				break;
			case "square":
				posMenuItems = await fetchSquareMenuItems(
					restaurant.pos_integration_data
				);
				break;
			case "clover":
				posMenuItems = await fetchCloverMenuItems(
					restaurant.pos_integration_data
				);
				break;
			default:
				throw new Error(`Unsupported POS system: ${posSystem}`);
		}

		// Get existing menu items
		const { data: existingItems, error: existingError } = await supabase
			.from("menu_items")
			.select("*")
			.eq("restaurant_id", restaurantId);

		if (existingError) throw existingError;

		// Build map of existing items by POS ID
		const existingItemsMap = new Map();
		for (const item of existingItems || []) {
			if (item.toast_menu_item_id) {
				existingItemsMap.set(item.toast_menu_item_id, item);
			}
		}

		// Process each POS menu item
		const stats = {
			total: posMenuItems.length,
			created: 0,
			updated: 0,
			skipped: 0,
			errors: 0,
		};

		const results = [];
		const now = new Date().toISOString();

		for (const posItem of posMenuItems) {
			try {
				const existingItem = existingItemsMap.get(posItem.posMenuItemId);

				if (existingItem) {
					// Item exists - update if requested
					if (updateExisting) {
						const { data: updated, error: updateError } = await supabase
							.from("menu_items")
							.update({
								name: posItem.name,
								category: posItem.category,
								price: posItem.price,
								is_active: posItem.isActive,
								updated_at: now,
							})
							.eq("id", existingItem.id)
							.select()
							.single();

						if (updateError) {
							console.error(
								`Error updating menu item ${posItem.name}:`,
								updateError
							);
							stats.errors++;
							results.push({
								action: "error",
								name: posItem.name,
								error: updateError.message,
							});
						} else {
							stats.updated++;
							results.push({
								action: "updated",
								id: updated.id,
								name: updated.name,
								category: updated.category,
								price: updated.price,
							});
						}
					} else {
						stats.skipped++;
						results.push({
							action: "skipped",
							name: posItem.name,
							reason: "Already exists and updateExisting=false",
						});
					}

					// Remove from map (for tracking missing items)
					existingItemsMap.delete(posItem.posMenuItemId);
				} else {
					// New item - create
					const { data: created, error: createError } = await supabase
						.from("menu_items")
						.insert({
							restaurant_id: restaurantId,
							name: posItem.name,
							category: posItem.category,
							price: posItem.price,
							toast_menu_item_id: posItem.posMenuItemId, // Store POS ID for linking
							is_active: posItem.isActive,
							created_at: now,
							updated_at: now,
						})
						.select()
						.single();

					if (createError) {
						console.error(
							`Error creating menu item ${posItem.name}:`,
							createError
						);
						stats.errors++;
						results.push({
							action: "error",
							name: posItem.name,
							error: createError.message,
						});
					} else {
						stats.created++;
						results.push({
							action: "created",
							id: created.id,
							name: created.name,
							category: created.category,
							price: created.price,
						});
					}
				}
			} catch (itemError) {
				console.error(`Error processing item ${posItem.name}:`, itemError);
				stats.errors++;
				results.push({
					action: "error",
					name: posItem.name,
					error: itemError.message,
				});
			}
		}

		// Handle items that exist in our system but not in POS
		if (deactivateMissing && existingItemsMap.size > 0) {
			const missingItems = Array.from(existingItemsMap.values());

			for (const item of missingItems) {
				if (item.is_active) {
					const { error: deactivateError } = await supabase
						.from("menu_items")
						.update({
							is_active: false,
							updated_at: now,
						})
						.eq("id", item.id);

					if (deactivateError) {
						console.error(
							`Error deactivating item ${item.name}:`,
							deactivateError
						);
					} else {
						results.push({
							action: "deactivated",
							id: item.id,
							name: item.name,
							reason: "Not found in POS menu",
						});
					}
				}
			}
		}

		return {
			success: true,
			stats: stats,
			results: results,
			timestamp: now,
		};
	} catch (error) {
		console.error("Error importing menu from POS:", error);
		throw new Error(`Failed to import menu: ${error.message}`);
	}
}

/**
 * Verify POS connection for a restaurant
 * @param {string} restaurantId - Restaurant UUID
 * @param {string} posSystem - POS system type
 * @returns {Promise<Object>} Connection status
 */
export async function verifyPOSConnection(restaurantId, posSystem) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	try {
		// Get restaurant and POS credentials
		const { data: restaurant, error: restaurantError } = await supabase
			.from("restaurants")
			.select("pos_integration_data")
			.eq("id", restaurantId)
			.single();

		if (restaurantError) throw restaurantError;

		if (!restaurant.pos_integration_data) {
			return {
				connected: false,
				error: "POS integration not configured",
			};
		}

		let isConnected = false;

		switch (posSystem.toLowerCase()) {
			case "toast":
				isConnected = await verifyToastConnection(
					restaurant.pos_integration_data
				);
				break;
			case "square":
				isConnected = await verifySquareConnection(
					restaurant.pos_integration_data
				);
				break;
			case "clover":
				isConnected = await verifyCloverConnection(
					restaurant.pos_integration_data
				);
				break;
			default:
				throw new Error(`Unsupported POS system: ${posSystem}`);
		}

		return {
			connected: isConnected,
			posSystem: posSystem,
			timestamp: new Date().toISOString(),
		};
	} catch (error) {
		console.error("Error verifying POS connection:", error);
		return {
			connected: false,
			error: error.message,
		};
	}
}

/**
 * Get import preview (dry run - doesn't actually import)
 * Shows what would be created/updated without making changes
 * @param {string} restaurantId - Restaurant UUID
 * @param {string} posSystem - POS system type
 * @returns {Promise<Object>} Preview results
 */
export async function getImportPreview(restaurantId, posSystem) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	try {
		// Get restaurant and POS credentials
		const { data: restaurant, error: restaurantError } = await supabase
			.from("restaurants")
			.select("*")
			.eq("id", restaurantId)
			.single();

		if (restaurantError) throw restaurantError;

		if (!restaurant.pos_integration_data) {
			throw new Error("POS integration not configured for this restaurant");
		}

		// Fetch menu items from POS
		let posMenuItems;

		switch (posSystem.toLowerCase()) {
			case "toast":
				posMenuItems = await fetchToastMenuItems(
					restaurant.pos_integration_data
				);
				break;
			case "square":
				posMenuItems = await fetchSquareMenuItems(
					restaurant.pos_integration_data
				);
				break;
			case "clover":
				posMenuItems = await fetchCloverMenuItems(
					restaurant.pos_integration_data
				);
				break;
			default:
				throw new Error(`Unsupported POS system: ${posSystem}`);
		}

		// Get existing menu items
		const { data: existingItems, error: existingError } = await supabase
			.from("menu_items")
			.select("*")
			.eq("restaurant_id", restaurantId);

		if (existingError) throw existingError;

		// Build map of existing items
		const existingItemsMap = new Map();
		for (const item of existingItems || []) {
			if (item.toast_menu_item_id) {
				existingItemsMap.set(item.toast_menu_item_id, item);
			}
		}

		// Analyze what would happen
		const preview = {
			total: posMenuItems.length,
			toCreate: [],
			toUpdate: [],
			existing: [],
			categories: new Set(),
		};

		for (const posItem of posMenuItems) {
			preview.categories.add(posItem.category);

			const existingItem = existingItemsMap.get(posItem.posMenuItemId);

			if (existingItem) {
				// Would be updated
				const hasChanges =
					existingItem.name !== posItem.name ||
					existingItem.category !== posItem.category ||
					parseFloat(existingItem.price) !== posItem.price ||
					existingItem.is_active !== posItem.isActive;

				if (hasChanges) {
					preview.toUpdate.push({
						name: posItem.name,
						category: posItem.category,
						price: posItem.price,
						changes: {
							name:
								existingItem.name !== posItem.name
									? {
											old: existingItem.name,
											new: posItem.name,
									  }
									: null,
							category:
								existingItem.category !== posItem.category
									? {
											old: existingItem.category,
											new: posItem.category,
									  }
									: null,
							price:
								parseFloat(existingItem.price) !== posItem.price
									? {
											old: parseFloat(existingItem.price),
											new: posItem.price,
									  }
									: null,
						},
					});
				} else {
					preview.existing.push({
						name: posItem.name,
						category: posItem.category,
						price: posItem.price,
					});
				}
			} else {
				// Would be created
				preview.toCreate.push({
					name: posItem.name,
					category: posItem.category,
					price: posItem.price,
				});
			}
		}

		return {
			preview: {
				...preview,
				categories: Array.from(preview.categories).sort(),
			},
			stats: {
				total: preview.total,
				toCreate: preview.toCreate.length,
				toUpdate: preview.toUpdate.length,
				noChanges: preview.existing.length,
			},
		};
	} catch (error) {
		console.error("Error generating import preview:", error);
		throw new Error(`Failed to generate preview: ${error.message}`);
	}
}

/**
 * Save POS credentials for a restaurant
 * @param {string} restaurantId - Restaurant UUID
 * @param {string} posSystem - POS system type
 * @param {object} credentials - POS credentials (structure varies by system)
 * @returns {Promise<Object>} Updated restaurant record
 */
export async function savePOSCredentials(restaurantId, posSystem, credentials) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	try {
		const now = new Date().toISOString();

		const { data, error } = await supabase
			.from("restaurants")
			.update({
				pos_system: posSystem.toLowerCase(),
				pos_integration_data: credentials,
				updated_at: now,
			})
			.eq("id", restaurantId)
			.select()
			.single();

		if (error) throw error;

		return data;
	} catch (error) {
		console.error("Error saving POS credentials:", error);
		throw new Error(`Failed to save POS credentials: ${error.message}`);
	}
}
