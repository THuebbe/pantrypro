// /backend/src/routes/billingRoutes.js

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
	BillingError,
	getBillingSummary,
	createCheckoutSession,
	createPortalSession,
	handleStripeEvent,
	verifyWebhook,
} from "../services/billing/billingService.js";

const router = express.Router();

/**
 * POST /api/billing/webhook
 * Called by Stripe, not by the app. It needs the body exactly as sent to
 * check the signature, so index.js mounts it before express.json().
 */
export async function stripeWebhookHandler(req, res) {
	let event;

	try {
		event = verifyWebhook(req.body, req.headers["stripe-signature"]);
	} catch (error) {
		return res.status(error.status || 400).json({ error: error.message });
	}

	try {
		const result = await handleStripeEvent(event);
		res.json({ received: true, handled: result.handled });
	} catch (error) {
		// A 500 makes Stripe deliver the event again later.
		console.error(`[Billing] Failed to handle ${event.type}:`, error.message);
		res.status(500).json({ error: "Event could not be processed" });
	}
}

function sendBillingError(res, error, route) {
	if (error instanceof BillingError) {
		return res.status(error.status).json({ error: error.message });
	}

	console.error(`Error in ${route}:`, error.message);
	res.status(500).json({ error: "Billing is unavailable right now. Try again." });
}

router.use(requireAuth);

/**
 * GET /api/billing/status
 * Subscription state for the signed-in user's business.
 */
router.get("/status", async (req, res) => {
	try {
		res.json(await getBillingSummary(req.businessId));
	} catch (error) {
		sendBillingError(res, error, "GET /api/billing/status");
	}
});

/**
 * POST /api/billing/checkout
 * Returns a Stripe Checkout URL to start the subscription (with the free
 * trial for a first-time subscriber).
 */
router.post("/checkout", async (req, res) => {
	try {
		res.json(
			await createCheckoutSession({
				businessId: req.businessId,
				email: req.user?.email,
			})
		);
	} catch (error) {
		sendBillingError(res, error, "POST /api/billing/checkout");
	}
});

/**
 * POST /api/billing/portal
 * Returns a URL to Stripe's billing page (card, receipts, cancel).
 */
router.post("/portal", async (req, res) => {
	try {
		res.json(await createPortalSession({ businessId: req.businessId }));
	} catch (error) {
		sendBillingError(res, error, "POST /api/billing/portal");
	}
});

export default router;
