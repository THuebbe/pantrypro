// /backend/src/services/posAdapters/toastOrdersAdapter.js

/**
 * Toast POS Orders/Sales Adapter
 *
 * Fetches orders from Toast for sales tracking and inventory deduction,
 * using GET /orders/v2/ordersBulk (scope: orders:read). Works with the
 * read-only Standard API access a restaurant sets up in Toast Web.
 *
 * Toast documentation:
 *   https://doc.toasttab.com/doc/devguide/apiOrdersGetDetailedInfoAboutMultipleOrders.html
 */

import { toastGet, assertToastCredentials } from "./toastClient.js";

const MAX_PAGE_SIZE = 100; // Toast's limit
const MAX_PAGES = 500; // Safety stop: 50,000 orders in one sync
const MAX_WINDOW_MS = 31 * 24 * 60 * 60 * 1000; // Toast asks for a month or less

/**
 * Convert a date input to the ISO-8601 format Toast expects
 * @param {string|Date} value - Date, ISO string or YYYY-MM-DD
 * @returns {string} e.g. 2026-03-02T19:10:30.000Z
 */
function toToastTimestamp(value) {
	const date = value instanceof Date ? value : new Date(value);

	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid date: ${value}`);
	}

	return date.toISOString();
}

/**
 * Convert Toast's business date (integer yyyyMMdd) to YYYY-MM-DD
 * @param {number|string} businessDate - e.g. 20260302
 * @returns {string|null} e.g. 2026-03-02
 */
export function formatBusinessDate(businessDate) {
	const digits = String(businessDate ?? "");

	if (!/^\d{8}$/.test(digits)) return null;

	return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/**
 * Fetch one page of orders modified in a time window
 * @param {object} credentials - Toast credentials
 * @param {object} options - Fetch options
 * @param {string} options.startDate - Window start (inclusive)
 * @param {string} options.endDate - Window end (exclusive)
 * @param {number} options.page - Page number, starting at 1
 * @param {number} options.pageSize - Orders per page (max 100)
 * @returns {Promise<Object>} Orders and whether another page may exist
 */
export async function fetchToastOrders(credentials, options = {}) {
	assertToastCredentials(credentials);

	const now = new Date();
	const startOfToday = new Date(now);
	startOfToday.setHours(0, 0, 0, 0);

	const startDate = toToastTimestamp(options.startDate || startOfToday);
	const endDate = toToastTimestamp(options.endDate || now);
	const page = options.page || 1;
	const pageSize = Math.min(options.pageSize || MAX_PAGE_SIZE, MAX_PAGE_SIZE);

	if (new Date(endDate) <= new Date(startDate)) {
		return { orders: [], pagination: { page, hasMore: false } };
	}

	if (new Date(endDate) - new Date(startDate) > MAX_WINDOW_MS) {
		throw new Error("Toast sales can be synced at most 31 days at a time");
	}

	const data = await toastGet(credentials, "/orders/v2/ordersBulk", {
		startDate,
		endDate,
		page,
		pageSize,
	});

	const rawOrders = Array.isArray(data) ? data : [];

	return {
		orders: rawOrders.map(normalizeToastOrder),
		pagination: {
			page,
			// A full page means there may be another one.
			hasMore: rawOrders.length === pageSize,
		},
	};
}

/**
 * Fetch every order modified in a time window, following pagination
 * @param {object} credentials - Toast credentials
 * @param {object} options - Fetch options
 * @param {string} options.startDate - Window start
 * @param {string} options.endDate - Window end
 * @returns {Promise<Array>} Normalized orders
 */
export async function fetchAllToastOrders(credentials, options = {}) {
	let orders = [];
	let page = 1;
	let hasMore = true;

	while (hasMore && page <= MAX_PAGES) {
		const result = await fetchToastOrders(credentials, { ...options, page });

		orders = orders.concat(result.orders);
		hasMore = result.pagination.hasMore;
		page++;
	}

	return orders;
}

/**
 * Fetch a single order by ID
 * @param {object} credentials - Toast credentials
 * @param {string} orderId - Toast order GUID
 * @returns {Promise<Object|null>} Normalized order data
 */
export async function fetchToastOrder(credentials, orderId) {
	assertToastCredentials(credentials);

	try {
		const data = await toastGet(
			credentials,
			`/orders/v2/orders/${encodeURIComponent(orderId)}`
		);

		return normalizeToastOrder(data);
	} catch (error) {
		if (/\(404\)/.test(error.message)) {
			return null;
		}

		throw error;
	}
}

/**
 * Normalize a Toast order to our internal format.
 *
 * Toast reports money as decimal currency amounts (dollars), not cents.
 * A selection's price is the total for that line, so the unit price is
 * the line total divided by the quantity.
 *
 * @param {object} toastOrder - Raw Toast order data
 * @returns {object} Normalized order
 */
export function normalizeToastOrder(toastOrder) {
	const lineItems = [];
	let subtotal = 0;
	let tax = 0;
	let total = 0;

	const checks = Array.isArray(toastOrder.checks) ? toastOrder.checks : [];

	for (const check of checks) {
		// A voided or deleted check was never sold.
		if (check.voided || check.deleted) continue;

		subtotal += Number(check.amount) || 0;
		tax += Number(check.taxAmount) || 0;
		total += Number(check.totalAmount) || 0;

		for (const selection of check.selections || []) {
			const quantity =
				typeof selection.quantity === "number" ? selection.quantity : 1;
			const lineTotal = Number(selection.price) || 0;

			lineItems.push({
				posMenuItemId: selection.item?.guid || null,
				name: selection.displayName || "Unknown Item",
				quantity,
				unitPrice: quantity ? roundMoney(lineTotal / quantity) : 0,
				totalPrice: roundMoney(lineTotal),
				modifiers: (selection.modifiers || []).map((mod) => ({
					posMenuItemId: mod.item?.guid || null,
					name: mod.displayName,
					price: Number(mod.price) || 0,
				})),
				voided: selection.voided || false,
				voidReason: selection.voidReason || null,
			});
		}
	}

	return {
		posOrderId: toastOrder.guid,
		orderNumber:
			toastOrder.displayNumber || checks[0]?.displayNumber || toastOrder.externalId,
		orderDate: toastOrder.openedDate || toastOrder.createdDate,
		businessDate: formatBusinessDate(toastOrder.businessDate),
		closedDate: toastOrder.closedDate || null,
		orderSource: toastOrder.source || "POS",
		// Toast returns only the dining option's GUID here, not its name.
		orderType: null,
		status: normalizeOrderStatus(toastOrder),
		subtotal: roundMoney(subtotal),
		tax: roundMoney(tax),
		total: roundMoney(total),
		lineItems,
		voided: toastOrder.voided || false,
		deleted: toastOrder.deleted || false,
		rawData: toastOrder, // Store original for debugging
	};
}

function roundMoney(value) {
	return Math.round(value * 100) / 100;
}

/**
 * Normalize order status from Toast
 * @param {object} order - Toast order
 * @returns {string} Normalized status
 */
function normalizeOrderStatus(order) {
	if (order.deleted) return "deleted";
	if (order.voided) return "voided";
	if (order.closedDate) return "closed";
	if (order.paidDate) return "paid";
	return "open";
}

/**
 * Get orders modified since a timestamp (for incremental sync)
 * @param {object} credentials - Toast credentials
 * @param {string} since - ISO timestamp
 * @returns {Promise<Array>} Modified orders
 */
export async function fetchToastOrdersSince(credentials, since) {
	return fetchAllToastOrders(credentials, {
		startDate: since,
		endDate: new Date().toISOString(),
	});
}
