// /backend/src/services/salesDataService.js

/**
 * Sales Data Service
 *
 * Manages sales data synchronization from POS systems,
 * stores sales in the database, and provides query interfaces.
 */

import { supabase } from "./supabase.js";
import { decryptCredentials } from "./credentialVault.js";
import { reverseDeductionsForSale } from "./inventoryDeductionService.js";
import { fetchAllToastOrders } from "./posAdapters/toastOrdersAdapter.js";

/**
 * Sync sales from POS system for a date range
 * @param {string} restaurantId - Restaurant UUID
 * @param {string} posSystem - POS system type
 * @param {object} options - Sync options
 * @param {string} options.startDate - Start date
 * @param {string} options.endDate - End date
 * @returns {Promise<Object>} Sync results
 */
export async function syncSalesFromPOS(restaurantId, posSystem, options = {}) {
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
			throw new Error("POS integration not configured for this restaurant");
		}

		// Orders are selected by modification time, so the next sync must start
		// from when this one began or changes made while it runs are missed.
		const syncStartedAt = new Date().toISOString();

		let orders = [];
		const stats = {
			fetched: 0,
			created: 0,
			updated: 0,
			skipped: 0,
			errors: 0,
		};

		// Fetch orders based on POS system
		switch (posSystem.toLowerCase()) {
			case "toast": {
				orders = await fetchAllToastOrders(
					decryptCredentials(restaurant.pos_integration_data),
					{
						startDate: options.startDate,
						endDate: options.endDate,
					}
				);
				break;
			}
			default:
				throw new Error(`Unsupported POS system: ${posSystem}`);
		}

		stats.fetched = orders.length;

		// Process and store each order
		for (const order of orders) {
			try {
				const result = await upsertSale(restaurantId, posSystem, order);
				if (result.action === "created") {
					stats.created++;
				} else if (result.action === "updated") {
					stats.updated++;
				} else {
					stats.skipped++;
				}
			} catch (error) {
				console.error(`Error processing order ${order.posOrderId}:`, error);
				stats.errors++;
			}
		}

		// Update last sync timestamp
		await updateLastSyncTimestamp(restaurantId, syncStartedAt);

		return {
			success: true,
			stats,
			timestamp: new Date().toISOString(),
		};
	} catch (error) {
		console.error("Error syncing sales from POS:", error);
		throw new Error(`Failed to sync sales: ${error.message}`);
	}
}

/**
 * Upsert a sale record (create or update)
 * @param {string} restaurantId - Restaurant UUID
 * @param {string} posSystem - POS system type
 * @param {object} order - Normalized order data
 * @returns {Promise<Object>} Result with action taken
 */
async function upsertSale(restaurantId, posSystem, order) {
	// Skip voided or deleted orders
	if (order.voided || order.deleted) {
		// Check if we have this order and need to mark it as voided
		const { data: existing } = await supabase
			.from("pos_sales")
			.select("id, voided, inventory_deducted")
			.eq("restaurant_id", restaurantId)
			.eq("pos_system", posSystem)
			.eq("pos_order_id", order.posOrderId)
			.maybeSingle();

		if (existing) {
			if (existing.voided && !existing.inventory_deducted) {
				return { action: "skipped", reason: "already_voided" };
			}

			// Stock was already taken out for this order, so put it back.
			if (existing.inventory_deducted) {
				await reverseDeductionsForSale(restaurantId, existing.id, null);
			}

			await supabase
				.from("pos_sales")
				.update({
					voided: true,
					status: order.status,
					updated_at: new Date().toISOString(),
				})
				.eq("id", existing.id);

			return { action: "updated", reason: "marked_voided" };
		}

		return { action: "skipped", reason: "voided_order" };
	}

	// Check if order already exists
	const { data: existingSale } = await supabase
		.from("pos_sales")
		.select("id, updated_at")
		.eq("restaurant_id", restaurantId)
		.eq("pos_system", posSystem)
		.eq("pos_order_id", order.posOrderId)
		.maybeSingle();

	const saleData = {
		restaurant_id: restaurantId,
		pos_system: posSystem,
		pos_order_id: order.posOrderId,
		order_number: order.orderNumber,
		order_date: order.orderDate,
		business_date: order.businessDate,
		closed_date: order.closedDate,
		order_source: order.orderSource,
		order_type: order.orderType,
		status: order.status,
		subtotal: order.subtotal,
		tax: order.tax,
		total_amount: order.total,
		voided: order.voided || false,
		raw_data: order.rawData,
	};

	if (existingSale) {
		// Update existing. inventory_deducted is left as it is: resetting it
		// here would deduct the same order again on every later sync.
		const { error: updateError } = await supabase
			.from("pos_sales")
			.update({
				...saleData,
				updated_at: new Date().toISOString(),
			})
			.eq("id", existingSale.id);

		if (updateError) throw updateError;

		// Update line items
		await updateSaleLineItems(existingSale.id, order.lineItems);

		return { action: "updated" };
	} else {
		// Create new
		const { data: newSale, error: createError } = await supabase
			.from("pos_sales")
			.insert({
				...saleData,
				inventory_deducted: false,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			})
			.select()
			.single();

		if (createError) throw createError;

		// Create line items
		await createSaleLineItems(newSale.id, restaurantId, order.lineItems);

		return { action: "created" };
	}
}

/**
 * Create line items for a sale
 */
async function createSaleLineItems(saleId, restaurantId, lineItems) {
	if (!lineItems || lineItems.length === 0) return;

	// Look up menu items by POS ID
	const posMenuItemIds = lineItems
		.filter((item) => item.posMenuItemId)
		.map((item) => item.posMenuItemId);

	const { data: menuItems } = await supabase
		.from("menu_items")
		.select("id, toast_menu_item_id")
		.eq("restaurant_id", restaurantId)
		.in("toast_menu_item_id", posMenuItemIds);

	const menuItemMap = new Map();
	if (menuItems) {
		for (const item of menuItems) {
			menuItemMap.set(item.toast_menu_item_id, item.id);
		}
	}

	const lineItemRecords = lineItems
		.filter((item) => !item.voided) // Exclude voided items
		.map((item) => ({
			pos_sale_id: saleId,
			menu_item_id: menuItemMap.get(item.posMenuItemId) || null,
			pos_menu_item_id: item.posMenuItemId,
			name: item.name,
			quantity: item.quantity,
			unit_price: item.unitPrice,
			total_price: item.totalPrice,
			created_at: new Date().toISOString(),
		}));

	if (lineItemRecords.length > 0) {
		const { error } = await supabase
			.from("pos_sales_items")
			.insert(lineItemRecords);

		if (error) {
			console.error("Error creating sale line items:", error);
		}
	}
}

/**
 * Update line items for an existing sale
 */
async function updateSaleLineItems(saleId, lineItems) {
	// Delete existing line items and recreate
	await supabase.from("pos_sales_items").delete().eq("pos_sale_id", saleId);

	// Get restaurant_id from sale
	const { data: sale } = await supabase
		.from("pos_sales")
		.select("restaurant_id")
		.eq("id", saleId)
		.single();

	if (sale) {
		await createSaleLineItems(saleId, sale.restaurant_id, lineItems);
	}
}

/**
 * Update last sync timestamp for a restaurant
 */
async function updateLastSyncTimestamp(restaurantId, syncedAt) {
	await supabase
		.from("restaurants")
		.update({
			last_pos_sync: syncedAt || new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})
		.eq("id", restaurantId);
}

/**
 * Get sales list with filters
 * @param {string} restaurantId - Restaurant UUID
 * @param {object} filters - Query filters
 * @returns {Promise<Array>} Sales list
 */
export async function getSales(restaurantId, filters = {}) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	let query = supabase
		.from("pos_sales")
		.select(`
			*,
			pos_sales_items (
				id,
				menu_item_id,
				name,
				quantity,
				unit_price,
				total_price
			)
		`)
		.eq("restaurant_id", restaurantId)
		.order("order_date", { ascending: false });

	// Apply filters
	if (filters.startDate) {
		query = query.gte("business_date", filters.startDate);
	}
	if (filters.endDate) {
		query = query.lte("business_date", filters.endDate);
	}
	if (filters.status) {
		query = query.eq("status", filters.status);
	}
	if (filters.limit) {
		query = query.limit(filters.limit);
	}

	const { data, error } = await query;

	if (error) throw error;

	return data || [];
}

/**
 * Get a single sale by ID
 * @param {string} restaurantId - Restaurant UUID
 * @param {string} saleId - Sale UUID
 * @returns {Promise<Object>} Sale details
 */
export async function getSaleById(restaurantId, saleId) {
	const { data, error } = await supabase
		.from("pos_sales")
		.select(`
			*,
			pos_sales_items (
				id,
				menu_item_id,
				pos_menu_item_id,
				name,
				quantity,
				unit_price,
				total_price,
				menu_items (
					id,
					name,
					category
				)
			)
		`)
		.eq("restaurant_id", restaurantId)
		.eq("id", saleId)
		.single();

	if (error) throw error;

	return data;
}

/**
 * Get sales summary for a date range
 * @param {string} restaurantId - Restaurant UUID
 * @param {object} options - Summary options
 * @returns {Promise<Object>} Sales summary
 */
export async function getSalesSummary(restaurantId, options = {}) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	const { startDate, endDate } = options;

	// Default to today if no dates
	const today = new Date().toISOString().split("T")[0];
	const start = startDate || today;
	const end = endDate || today;

	// Get aggregated data
	const { data: sales, error } = await supabase
		.from("pos_sales")
		.select("total_amount, subtotal, tax, status, order_type")
		.eq("restaurant_id", restaurantId)
		.gte("business_date", start)
		.lte("business_date", end)
		.eq("voided", false);

	if (error) throw error;

	// Calculate summary
	const summary = {
		totalSales: 0,
		totalRevenue: 0,
		totalTax: 0,
		averageOrderValue: 0,
		orderCount: sales?.length || 0,
		byOrderType: {},
	};

	if (sales && sales.length > 0) {
		for (const sale of sales) {
			summary.totalRevenue += parseFloat(sale.total_amount) || 0;
			summary.totalSales += parseFloat(sale.subtotal) || 0;
			summary.totalTax += parseFloat(sale.tax) || 0;

			const orderType = sale.order_type || "Other";
			if (!summary.byOrderType[orderType]) {
				summary.byOrderType[orderType] = { count: 0, revenue: 0 };
			}
			summary.byOrderType[orderType].count++;
			summary.byOrderType[orderType].revenue += parseFloat(sale.total_amount) || 0;
		}

		summary.averageOrderValue = summary.totalRevenue / summary.orderCount;
	}

	return {
		dateRange: { start, end },
		summary,
	};
}

/**
 * Get top selling items for a date range
 * @param {string} restaurantId - Restaurant UUID
 * @param {object} options - Query options
 * @returns {Promise<Array>} Top items
 */
export async function getTopSellingItems(restaurantId, options = {}) {
	const { startDate, endDate, limit = 10 } = options;

	const today = new Date().toISOString().split("T")[0];
	const start = startDate || today;
	const end = endDate || today;

	// Get sales in date range
	const { data: sales, error: salesError } = await supabase
		.from("pos_sales")
		.select("id")
		.eq("restaurant_id", restaurantId)
		.gte("business_date", start)
		.lte("business_date", end)
		.eq("voided", false);

	if (salesError) throw salesError;

	if (!sales || sales.length === 0) {
		return [];
	}

	const saleIds = sales.map((s) => s.id);

	// Get items from those sales
	const { data: items, error: itemsError } = await supabase
		.from("pos_sales_items")
		.select("name, quantity, total_price, menu_item_id")
		.in("pos_sale_id", saleIds);

	if (itemsError) throw itemsError;

	// Aggregate by item name
	const itemTotals = {};
	for (const item of items || []) {
		const key = item.name;
		if (!itemTotals[key]) {
			itemTotals[key] = {
				name: item.name,
				menuItemId: item.menu_item_id,
				quantitySold: 0,
				revenue: 0,
			};
		}
		itemTotals[key].quantitySold += item.quantity || 1;
		itemTotals[key].revenue += parseFloat(item.total_price) || 0;
	}

	// Sort by quantity and return top N
	return Object.values(itemTotals)
		.sort((a, b) => b.quantitySold - a.quantitySold)
		.slice(0, limit);
}

/**
 * Get sync status for a restaurant
 * @param {string} restaurantId - Restaurant UUID
 * @returns {Promise<Object>} Sync status
 */
export async function getSyncStatus(restaurantId) {
	const { data: restaurant, error } = await supabase
		.from("restaurants")
		.select("pos_system, last_pos_sync")
		.eq("id", restaurantId)
		.maybeSingle();

	if (error) throw error;

	// If no restaurant found, return default status
	if (!restaurant) {
		return {
			posSystem: null,
			lastSync: null,
			unprocessedSales: 0,
			configured: false,
		};
	}

	// Get count of unprocessed sales
	const { count: unprocessedCount } = await supabase
		.from("pos_sales")
		.select("id", { count: "exact", head: true })
		.eq("restaurant_id", restaurantId)
		.eq("inventory_deducted", false)
		.eq("voided", false);

	return {
		posSystem: restaurant.pos_system,
		lastSync: restaurant.last_pos_sync,
		unprocessedSales: unprocessedCount || 0,
		configured: true,
	};
}
