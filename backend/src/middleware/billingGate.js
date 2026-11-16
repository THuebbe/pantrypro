// /backend/src/middleware/billingGate.js

/**
 * Billing gate
 *
 * When billing is enforced, a business without a trial or paid
 * subscription is read-only: it can still load every screen, but requests
 * that change data are refused with 402. Sign-in, business registration
 * and the billing screens themselves always work, so an owner can always
 * get back to paying.
 */

import { supabase } from "../services/supabase.js";
import { billingMode, accessFor } from "../services/billing/billingCore.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ALWAYS_ALLOWED = ["/api/auth", "/api/business", "/api/billing"];

/**
 * Decide whether a signed-in request may go ahead
 * @param {object} req - Express request, after requireAuth has set businessId
 * @returns {Promise<null|{status: number, body: object}>} null to allow
 */
export async function checkBillingAccess(req) {
	const mode = billingMode();

	if (!mode.enforced) return null;
	if (SAFE_METHODS.has(req.method)) return null;
	if (ALWAYS_ALLOWED.some((prefix) => (req.baseUrl || "").startsWith(prefix))) {
		return null;
	}

	// Mid sign-up, before a business exists, there is nothing to bill.
	if (!req.businessId) return null;

	const { data: business, error } = await supabase
		.from("businesses")
		.select("billing_status, billing_past_due_since")
		.eq("id", req.businessId)
		.maybeSingle();

	if (error) {
		// If the billing lookup itself breaks, let the customer keep working.
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
