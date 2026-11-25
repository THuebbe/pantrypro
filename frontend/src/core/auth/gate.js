// /frontend/src/core/auth/gate.js

// The card page has to open for anyone signed in, or a locked-out owner
// could never pay to get back in.
const BILLING_PATH = "/settings/billing";

/**
 * Where a signed-in user has to go before they may see this page, or null
 * if they may see it. Every screen works on the restaurant, so one is
 * always needed. The plan only counts once the server enforces billing.
 * @param {object} params
 * @param {object} params.user - Signed-in user's details
 * @param {object} [params.billing] - Response of GET /billing/status
 * @param {string} params.pathname - Page being opened
 * @returns {string|null}
 */
export function gateRedirect({ user, billing, pathname }) {
	if (!user?.businessId) return "/register?step=restaurant";
	if (pathname.startsWith(BILLING_PATH)) return null;
	if (!billing?.enforced) return null;
	if (billing.access !== "full") return BILLING_PATH;

	return null;
}
