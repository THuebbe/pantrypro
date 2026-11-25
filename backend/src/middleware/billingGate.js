// /backend/src/middleware/billingGate.js

/**
 * Billing gate
 *
 * When billing is enforced, a business needs a trial, a paid subscription
 * or a failed renewal still inside its grace period to use PantryPro.
 * Without one, every signed-in API call is refused with 402, reads
 * included, and the app sends the owner to the card page.
 *
 * Always allowed, so an owner can always get back in by paying:
 *   /api/auth      sign-in, refresh, who am I, logout
 *   /api/business  finishing restaurant setup
 *   /api/billing   the card page, Stripe Checkout and Stripe's billing page
 * Stripe's webhook never reaches this check: it has no sign-in and is
 * mounted before the routes in index.js.
 */

import { supabase } from "../services/supabase.js";
import { billingMode, accessFor } from "../services/billing/billingCore.js";

const ALWAYS_ALLOWED = ["/api/auth", "/api/business", "/api/billing"];

/**
 * Decide whether a signed-in request may go ahead
 * @param {object} req - Express request, after requireAuth has set businessId
 * @returns {Promise<null|{status: number, body: object}>} null to allow
 */
export async function checkBillingAccess(req) {
	const mode = billingMode();

	if (!mode.enforced) return null;
	if (req.method === "OPTIONS") return null;
	if (ALWAYS_ALLOWED.some((prefix) => (req.baseUrl || "").startsWith(prefix))) {
		return null;
	}

	// A signed-in user with no restaurant yet has nothing to use until the
	// restaurant step is done.
	if (!req.businessId) {
		return {
			status: 402,
			body: {
				error: "Finish setting up your restaurant to start using PantryPro.",
				code: "business_required",
				billingState: "no_business",
			},
		};
	}

	const { data: business, error } = await supabase
		.from("businesses")
		.select("billing_status, billing_past_due_since")
		.eq("id", req.businessId)
		.maybeSingle();

	if (error) {
		// If the billing lookup itself breaks, don't throw a paying customer
		// out over a database hiccup.
		console.error("[Billing] Access lookup failed:", error.message);
		return null;
	}

	const access = accessFor(business, { enforced: true });

	if (access.access === "full") return null;

	return {
		status: 402,
		body: {
			error: access.message,
			code: "subscription_required",
			billingState: access.state,
		},
	};
}
