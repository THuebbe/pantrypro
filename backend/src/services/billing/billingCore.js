// /backend/src/services/billing/billingCore.js

/**
 * Billing core
 *
 * The rules of billing with no network and no database: what a business
 * may do given its subscription state, and how a Stripe subscription maps
 * onto the businesses table.
 *
 * The policy:
 *   - A new business starts a free trial by entering a card.
 *   - Trialing or paid up: full access.
 *   - A payment fails: full access for a grace period, then blocked.
 *   - Cancelled, or never subscribed: blocked.
 *   - A business marked billing_exempt (test accounts) is never blocked.
 *   - Blocked means every screen and API call sends the owner to the card
 *     page. Sign-in, the card page and Stripe's webhook always work, so an
 *     owner can always get back in by paying.
 */

export const TRIAL_DAYS = 30;
export const GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Is billing switched on for this server?
 * Enforcement needs both the switch and working Stripe settings, so a
 * half-configured server can never lock every customer out.
 * @param {object} env - process.env
 * @returns {{configured: boolean, enforced: boolean}}
 */
export function billingMode(env = process.env) {
	const configured = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID);
	const enforced = configured && env.BILLING_ENFORCED === "true";

	return { configured, enforced };
}

/**
 * Decide what a business may do right now
 * @param {object|null} business - Row from businesses
 * @param {object} options
 * @param {boolean} options.enforced - Whether billing is enforced
 * @param {Date} [options.now]
 * @returns {{access: "full"|"blocked", state: string, message: string, graceEndsAt: string|null}}
 */
export function accessFor(business, options = {}) {
	const result = planAccess(business, options);

	// Test accounts keep full access whatever their plan says. One with a
	// real plan still shows that plan.
	if (result.access === "blocked" && business?.billing_exempt === true) {
		return {
			access: "full",
			state: "exempt",
			message: "",
			graceEndsAt: null,
		};
	}

	return result;
}

function planAccess(business, { enforced, now = new Date() } = {}) {
	const full = (state, message = "") => ({
		access: "full",
		state,
		message,
		graceEndsAt: null,
	});
	const blocked = (state, message) => ({
		access: "blocked",
		state,
		message,
		graceEndsAt: null,
	});

	if (!enforced) return full("not_enforced");

	const status = business?.billing_status || null;

	if (status === "trialing") return full("trialing");
	if (status === "active") return full("active");

	if (status === "past_due") {
		const since = business.billing_past_due_since
			? new Date(business.billing_past_due_since)
			: now;
		const graceEnds = new Date(since.getTime() + GRACE_DAYS * DAY_MS);

		if (now < graceEnds) {
			return {
				access: "full",
				state: "past_due_grace",
				message:
					"Your last payment didn't go through. Update your card to keep full access.",
				graceEndsAt: graceEnds.toISOString(),
			};
		}

		return blocked(
			"lapsed",
			"Your payment is overdue. Update your card to get back into PantryPro."
		);
	}

	if (!status) {
		return blocked(
			"none",
			`Start your ${TRIAL_DAYS}-day free trial to begin using PantryPro.`
		);
	}

	// canceled, unpaid, incomplete, incomplete_expired, paused
	return blocked(
		"lapsed",
		"Your subscription has ended. Resubscribe to get back into PantryPro."
	);
}

function toIso(unixSeconds) {
	return typeof unixSeconds === "number" && unixSeconds > 0
		? new Date(unixSeconds * 1000).toISOString()
		: null;
}

/**
 * Map a Stripe subscription onto businesses columns
 * @param {object} subscription - Stripe Subscription object
 * @param {object} [current] - The business row as it is now
 * @param {Date} [now]
 * @returns {object} Column values to write
 */
export function subscriptionFields(subscription, current = {}, now = new Date()) {
	const status = subscription.status;

	// Newer Stripe API versions report the period on the subscription item.
	const periodEnd =
		subscription.current_period_end ??
		subscription.items?.data?.[0]?.current_period_end ??
		null;

	let pastDueSince = null;
	if (status === "past_due") {
		// Keep the first date a payment failed; the grace period runs from it.
		pastDueSince = current?.billing_past_due_since || now.toISOString();
	}

	return {
		stripe_subscription_id: subscription.id,
		billing_status: status,
		trial_ends_at: toIso(subscription.trial_end),
		current_period_end: toIso(periodEnd),
		billing_past_due_since: pastDueSince,
		updated_at: now.toISOString(),
	};
}

/**
 * Has this business used its free trial already?
 * @param {object} business - Row from businesses
 * @returns {boolean}
 */
export function hasUsedTrial(business) {
	return Boolean(business?.stripe_subscription_id);
}

/**
 * Can this business start a new subscription right now?
 * @param {object} business - Row from businesses
 * @returns {boolean}
 */
export function canStartSubscription(business) {
	return !["trialing", "active", "past_due"].includes(
		business?.billing_status || ""
	);
}
