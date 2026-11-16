// frontend\src\services\billingService.js

import api from "../core/database/api";

/**
 * Subscription state for the signed-in user's business
 */
export async function fetchBillingStatus() {
	const response = await api.get("/billing/status");
	return response.data;
}

/**
 * Get a Stripe Checkout URL to start the subscription
 */
export async function startCheckout() {
	const response = await api.post("/billing/checkout");
	return response.data;
}

/**
 * Get a URL to Stripe's billing page (card, receipts, cancel)
 */
export async function openBillingPortal() {
	const response = await api.post("/billing/portal");
	return response.data;
}
