// /backend/src/tests/unit/billing.test.js
// Unit tests for billing rules, the read-only gate and the Stripe flow.
// No network or database needed. Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY ||= "test";
process.env.SUPABASE_ANON_KEY ||= "test";

const {
	TRIAL_DAYS,
	GRACE_DAYS,
	billingMode,
	accessFor,
	subscriptionFields,
	hasUsedTrial,
	canStartSubscription,
} = await import("../../services/billing/billingCore.js");
const { supabase } = await import("../../services/supabase.js");
const { checkBillingAccess } = await import("../../middleware/billingGate.js");
const {
	BillingError,
	createCheckoutSession,
	createPortalSession,
	handleStripeEvent,
	getBillingSummary,
} = await import("../../services/billing/billingService.js");

const NOW = new Date("2026-11-16T12:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();

function withEnv(values, fn) {
	const saved = {};
	for (const [key, value] of Object.entries(values)) {
		saved[key] = process.env[key];
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	const restore = () => {
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	};
	return Promise.resolve()
		.then(fn)
		.finally(restore);
}

const ENFORCED = {
	STRIPE_SECRET_KEY: "sk_test_x",
	STRIPE_PRICE_ID: "price_123",
	BILLING_ENFORCED: "true",
	FRONTEND_URL: "https://app.example.com/",
};

/**
 * Stand-in for the businesses table: one row, records every update.
 */
function stubBusiness(t, row) {
	const state = { row: row ? { ...row } : null, updates: [], filters: [] };

	t.mock.method(supabase, "from", (table) => {
		assert.equal(table, "businesses");
		let pendingUpdate = null;

		const chain = {
			select: () => chain,
			update: (values) => {
				pendingUpdate = values;
				return chain;
			},
			eq: (column, value) => {
				state.filters.push([column, value]);
				if (pendingUpdate) {
					state.updates.push(pendingUpdate);
					if (state.row) Object.assign(state.row, pendingUpdate);
					pendingUpdate = null;
				}
				return chain;
			},
			single: async () =>
				state.row
					? { data: state.row, error: null }
					: { data: null, error: { message: "not found" } },
			maybeSingle: async () => ({ data: state.row, error: null }),
			then: (resolve) => resolve({ data: null, error: null }),
		};

		return chain;
	});

	return state;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

test("enforcement needs the switch and working Stripe settings", () => {
	assert.deepEqual(billingMode({}), { configured: false, enforced: false });
	assert.deepEqual(billingMode({ BILLING_ENFORCED: "true" }), {
		configured: false,
		enforced: false,
	});
	assert.deepEqual(
		billingMode({ STRIPE_SECRET_KEY: "sk", STRIPE_PRICE_ID: "price" }),
		{ configured: true, enforced: false }
	);
	assert.deepEqual(billingMode(ENFORCED), { configured: true, enforced: true });
});

test("when billing is not enforced, everyone has full access", () => {
	for (const status of [null, "canceled", "past_due", "trialing"]) {
		assert.equal(
			accessFor({ billing_status: status }, { enforced: false }).access,
			"full"
		);
	}
});

test("trialing and paid accounts have full access", () => {
	assert.equal(accessFor({ billing_status: "trialing" }, { enforced: true }).access, "full");
	assert.equal(accessFor({ billing_status: "active" }, { enforced: true }).access, "full");
});

test("a failed payment keeps full access for the grace period, then read-only", () => {
	const inGrace = accessFor(
		{ billing_status: "past_due", billing_past_due_since: daysAgo(GRACE_DAYS - 1) },
		{ enforced: true, now: NOW }
	);
	assert.equal(inGrace.access, "full");
	assert.equal(inGrace.state, "past_due_grace");
	assert.ok(inGrace.graceEndsAt);
	assert.match(inGrace.message, /Update your card/);

	const lapsed = accessFor(
		{ billing_status: "past_due", billing_past_due_since: daysAgo(GRACE_DAYS + 1) },
		{ enforced: true, now: NOW }
	);
	assert.equal(lapsed.access, "read_only");
	assert.equal(lapsed.state, "lapsed");
});

test("never subscribed and cancelled accounts are read-only, with the right prompt", () => {
	const fresh = accessFor({ billing_status: null }, { enforced: true });
	assert.equal(fresh.access, "read_only");
	assert.equal(fresh.state, "none");
	assert.match(fresh.message, new RegExp(`${TRIAL_DAYS}-day free trial`));

	for (const status of ["canceled", "unpaid", "incomplete_expired", "paused"]) {
		const access = accessFor({ billing_status: status }, { enforced: true });
		assert.equal(access.access, "read_only");
		assert.equal(access.state, "lapsed");
	}

	assert.equal(accessFor(null, { enforced: true }).access, "read_only");
});

test("a Stripe subscription maps onto the business columns", () => {
	const fields = subscriptionFields(
		{
			id: "sub_1",
			status: "trialing",
			trial_end: 1797422400,
			current_period_end: 1797422400,
		},
		{},
		NOW
	);

	assert.equal(fields.stripe_subscription_id, "sub_1");
	assert.equal(fields.billing_status, "trialing");
	assert.equal(fields.trial_ends_at, new Date(1797422400 * 1000).toISOString());
	assert.equal(fields.current_period_end, fields.trial_ends_at);
	assert.equal(fields.billing_past_due_since, null);
});

test("the period end is read from the subscription item on newer Stripe versions", () => {
	const fields = subscriptionFields(
		{ id: "sub_2", status: "active", items: { data: [{ current_period_end: 1800000000 }] } },
		{},
		NOW
	);

	assert.equal(fields.current_period_end, new Date(1800000000 * 1000).toISOString());
	assert.equal(fields.trial_ends_at, null);
});

test("the grace period runs from the first failed payment and clears on recovery", () => {
	const first = subscriptionFields({ id: "sub_3", status: "past_due" }, {}, NOW);
	assert.equal(first.billing_past_due_since, NOW.toISOString());

	const repeat = subscriptionFields(
		{ id: "sub_3", status: "past_due" },
		{ billing_past_due_since: daysAgo(3) },
		NOW
	);
	assert.equal(repeat.billing_past_due_since, daysAgo(3));

	const recovered = subscriptionFields(
		{ id: "sub_3", status: "active" },
		{ billing_past_due_since: daysAgo(3) },
		NOW
	);
	assert.equal(recovered.billing_past_due_since, null);
});

test("the trial is offered once, and a live subscription can't be doubled", () => {
	assert.equal(hasUsedTrial({}), false);
	assert.equal(hasUsedTrial({ stripe_subscription_id: "sub_1" }), true);

	assert.equal(canStartSubscription({ billing_status: null }), true);
	assert.equal(canStartSubscription({ billing_status: "canceled" }), true);
	for (const status of ["trialing", "active", "past_due"]) {
		assert.equal(canStartSubscription({ billing_status: status }), false);
	}
});

// ---------------------------------------------------------------------------
// The read-only gate
// ---------------------------------------------------------------------------

const request = (overrides = {}) => ({
	method: "POST",
	baseUrl: "/api/inventory",
	businessId: "biz-1",
	...overrides,
});

test("the gate does nothing until billing is enforced", async (t) => {
	stubBusiness(t, { billing_status: null });

	await withEnv(
		{ STRIPE_SECRET_KEY: undefined, STRIPE_PRICE_ID: undefined, BILLING_ENFORCED: "true" },
		async () => assert.equal(await checkBillingAccess(request()), null)
	);
	await withEnv({ ...ENFORCED, BILLING_ENFORCED: undefined }, async () =>
		assert.equal(await checkBillingAccess(request()), null)
	);
});

test("an unsubscribed business can read but not change data", async (t) => {
	stubBusiness(t, { billing_status: null });

	await withEnv(ENFORCED, async () => {
		assert.equal(await checkBillingAccess(request({ method: "GET" })), null);

		const blocked = await checkBillingAccess(request());
		assert.equal(blocked.status, 402);
		assert.equal(blocked.body.code, "subscription_required");
		assert.equal(blocked.body.billingState, "none");

		for (const method of ["PUT", "PATCH", "DELETE"]) {
			assert.equal((await checkBillingAccess(request({ method }))).status, 402);
		}
	});
});

test("sign-in, business registration and billing are never blocked", async (t) => {
	stubBusiness(t, { billing_status: "canceled" });

	await withEnv(ENFORCED, async () => {
		for (const baseUrl of ["/api/auth", "/api/business", "/api/billing"]) {
			assert.equal(await checkBillingAccess(request({ baseUrl })), null);
		}
		assert.equal(await checkBillingAccess(request({ businessId: null })), null);
	});
});

test("a trialing business passes the gate", async (t) => {
	stubBusiness(t, { billing_status: "trialing" });

	await withEnv(ENFORCED, async () =>
		assert.equal(await checkBillingAccess(request()), null)
	);
});

// ---------------------------------------------------------------------------
// Stripe flow, with a stand-in for Stripe
// ---------------------------------------------------------------------------

function fakeStripe(overrides = {}) {
	const calls = { customers: [], checkout: [], portal: [], retrieved: [] };
	return {
		calls,
		customers: {
			create: async (params) => {
				calls.customers.push(params);
				return { id: "cus_new" };
			},
		},
		checkout: {
			sessions: {
				create: async (params) => {
					calls.checkout.push(params);
					return { url: "https://checkout.stripe.test/session" };
				},
			},
		},
		billingPortal: {
			sessions: {
				create: async (params) => {
					calls.portal.push(params);
					return { url: "https://billing.stripe.test/portal" };
				},
			},
		},
		subscriptions: {
			retrieve: async (id) => {
				calls.retrieved.push(id);
				return overrides.subscription;
			},
		},
	};
}

test("a first-time subscriber gets a card-required checkout with the free trial", async (t) => {
	const db = stubBusiness(t, { id: "biz-1", name: "Sam's Diner", billing_status: null });
	const stripe = fakeStripe();

	await withEnv(ENFORCED, async () => {
		const result = await createCheckoutSession({
			businessId: "biz-1",
			email: "sam@example.com",
			stripe,
		});

		assert.equal(result.url, "https://checkout.stripe.test/session");
	});

	assert.deepEqual(stripe.calls.customers[0], {
		name: "Sam's Diner",
		email: "sam@example.com",
		metadata: { business_id: "biz-1" },
	});
	assert.deepEqual(db.updates[0], { stripe_customer_id: "cus_new" });

	const session = stripe.calls.checkout[0];
	assert.equal(session.mode, "subscription");
	assert.equal(session.customer, "cus_new");
	assert.equal(session.client_reference_id, "biz-1");
	assert.deepEqual(session.line_items, [{ price: "price_123", quantity: 1 }]);
	assert.equal(session.payment_method_collection, "always");
	assert.equal(session.allow_promotion_codes, true);
	assert.equal(session.subscription_data.trial_period_days, TRIAL_DAYS);
	assert.deepEqual(session.subscription_data.metadata, { business_id: "biz-1" });
	assert.equal(session.success_url, "https://app.example.com/settings/billing?checkout=success");
});

test("a returning subscriber reuses the Stripe customer and gets no second trial", async (t) => {
	stubBusiness(t, {
		id: "biz-1",
		name: "Sam's Diner",
		billing_status: "canceled",
		stripe_customer_id: "cus_old",
		stripe_subscription_id: "sub_old",
	});
	const stripe = fakeStripe();

	await withEnv(ENFORCED, () =>
		createCheckoutSession({ businessId: "biz-1", email: "sam@example.com", stripe })
	);

	assert.equal(stripe.calls.customers.length, 0);
	assert.equal(stripe.calls.checkout[0].customer, "cus_old");
	assert.equal("trial_period_days" in stripe.calls.checkout[0].subscription_data, false);
});

test("a business with a live subscription can't start another", async (t) => {
	stubBusiness(t, { id: "biz-1", name: "x", billing_status: "active", stripe_customer_id: "cus_1" });
	const stripe = fakeStripe();

	await withEnv(ENFORCED, () =>
		assert.rejects(
			() => createCheckoutSession({ businessId: "biz-1", email: "a@b.c", stripe }),
			(error) => error instanceof BillingError && /already has a subscription/.test(error.message)
		)
	);
	assert.equal(stripe.calls.checkout.length, 0);
});

test("the billing page opens for an existing customer only", async (t) => {
	const db = stubBusiness(t, { id: "biz-1", name: "x", stripe_customer_id: "cus_1" });
	const stripe = fakeStripe();

	await withEnv(ENFORCED, async () => {
		const result = await createPortalSession({ businessId: "biz-1", stripe });
		assert.equal(result.url, "https://billing.stripe.test/portal");
		assert.deepEqual(stripe.calls.portal[0], {
			customer: "cus_1",
			return_url: "https://app.example.com/settings/billing",
		});

		db.row.stripe_customer_id = null;
		await assert.rejects(
			() => createPortalSession({ businessId: "biz-1", stripe }),
			/Start your subscription first/
		);
	});
});

test("without Stripe settings, billing says it is not set up", async (t) => {
	stubBusiness(t, { id: "biz-1", name: "x" });

	await withEnv({ STRIPE_SECRET_KEY: undefined, STRIPE_PRICE_ID: undefined }, () =>
		assert.rejects(
			() => createCheckoutSession({ businessId: "biz-1", email: "a@b.c" }),
			(error) => error.status === 503 && /not set up/.test(error.message)
		)
	);
});

test("finishing checkout starts the trial on the right business", async (t) => {
	const db = stubBusiness(t, { id: "biz-1", name: "x", stripe_customer_id: "cus_1", billing_status: null });
	const stripe = fakeStripe({
		subscription: { id: "sub_1", status: "trialing", customer: "cus_1", trial_end: 1797422400, metadata: {} },
	});

	const result = await handleStripeEvent(
		{
			type: "checkout.session.completed",
			data: { object: { mode: "subscription", subscription: "sub_1", client_reference_id: "biz-1" } },
		},
		stripe
	);

	assert.equal(result.handled, true);
	assert.deepEqual(stripe.calls.retrieved, ["sub_1"]);
	assert.equal(db.row.billing_status, "trialing");
	assert.equal(db.row.stripe_subscription_id, "sub_1");
	assert.ok(db.row.trial_ends_at);
	assert.ok(db.filters.some(([column, value]) => column === "id" && value === "biz-1"));
});

test("a failed payment and a cancellation both reach the business", async (t) => {
	const db = stubBusiness(t, {
		id: "biz-1",
		stripe_customer_id: "cus_1",
		stripe_subscription_id: "sub_1",
		billing_status: "active",
	});

	await handleStripeEvent({
		type: "customer.subscription.updated",
		data: { object: { id: "sub_1", status: "past_due", customer: "cus_1", metadata: { business_id: "biz-1" } } },
	});
	assert.equal(db.row.billing_status, "past_due");
	assert.ok(db.row.billing_past_due_since);

	await handleStripeEvent({
		type: "customer.subscription.deleted",
		data: { object: { id: "sub_1", status: "canceled", customer: "cus_1", metadata: {} } },
	});
	assert.equal(db.row.billing_status, "canceled");
	assert.equal(db.row.billing_past_due_since, null);
});

test("an old cancelled subscription can't overwrite the current one", async (t) => {
	const db = stubBusiness(t, {
		id: "biz-1",
		stripe_customer_id: "cus_1",
		stripe_subscription_id: "sub_new",
		billing_status: "active",
	});

	const result = await handleStripeEvent({
		type: "customer.subscription.deleted",
		data: { object: { id: "sub_old", status: "canceled", customer: "cus_1", metadata: { business_id: "biz-1" } } },
	});

	assert.equal(result.handled, false);
	assert.equal(db.row.billing_status, "active");
	assert.equal(db.row.stripe_subscription_id, "sub_new");
});

test("a paid invoice records the charge, and unrelated events are ignored", async (t) => {
	const db = stubBusiness(t, { id: "biz-1", stripe_customer_id: "cus_1" });

	await handleStripeEvent({
		type: "invoice.paid",
		data: { object: { customer: "cus_1", amount_paid: 9900, created: 1797422400, status_transitions: { paid_at: 1797422400 } } },
	});
	assert.equal(db.row.last_charge_amount, 99);
	assert.equal(db.row.last_charge_date, "2026-12-16");

	// The $0 invoice at the start of a trial is not a charge.
	const before = db.updates.length;
	await handleStripeEvent({
		type: "invoice.paid",
		data: { object: { customer: "cus_1", amount_paid: 0, created: 1797422400 } },
	});
	assert.equal(db.updates.length, before);

	assert.deepEqual(await handleStripeEvent({ type: "charge.refunded", data: { object: {} } }), {
		handled: false,
	});
});

test("the billing summary tells the screen what to offer", async (t) => {
	stubBusiness(t, { id: "biz-1", name: "x", billing_status: null });

	await withEnv(ENFORCED, async () => {
		const summary = await getBillingSummary("biz-1");

		assert.equal(summary.status, "none");
		assert.equal(summary.access, "read_only");
		assert.equal(summary.trialAvailable, true);
		assert.equal(summary.canSubscribe, true);
		assert.equal(summary.canManage, false);
		assert.equal(summary.trialDays, TRIAL_DAYS);
	});
});

test("before Stripe is set up, the summary needs no database and grants full access", async (t) => {
	const from = t.mock.method(supabase, "from", () => {
		throw new Error("the database should not be read");
	});

	await withEnv({ STRIPE_SECRET_KEY: undefined, STRIPE_PRICE_ID: undefined }, async () => {
		const summary = await getBillingSummary("biz-1");

		assert.equal(summary.configured, false);
		assert.equal(summary.access, "full");
		assert.equal(summary.canSubscribe, false);
	});
	assert.equal(from.mock.callCount(), 0);
});

test("with enforcement off, the screen still shows the real subscription state", async (t) => {
	const db = stubBusiness(t, {
		id: "biz-1",
		name: "x",
		billing_status: "trialing",
		stripe_customer_id: "cus_1",
		stripe_subscription_id: "sub_1",
		trial_ends_at: "2026-12-17T03:31:56Z",
	});

	await withEnv({ ...ENFORCED, BILLING_ENFORCED: undefined }, async () => {
		const trialing = await getBillingSummary("biz-1");
		assert.equal(trialing.enforced, false);
		assert.equal(trialing.state, "trialing");
		assert.equal(trialing.access, "full");
		assert.equal(trialing.trialEndsAt, "2026-12-17T03:31:56Z");
		assert.equal(trialing.canSubscribe, false);
		assert.equal(trialing.canManage, true);

		// A cancelled or never-started subscription shows as such, but
		// nothing is restricted while enforcement is off.
		db.row.billing_status = "canceled";
		const ended = await getBillingSummary("biz-1");
		assert.equal(ended.state, "lapsed");
		assert.equal(ended.access, "full");
		assert.equal(ended.message, "");
		assert.equal(ended.canSubscribe, true);

		db.row.billing_status = null;
		const fresh = await getBillingSummary("biz-1");
		assert.equal(fresh.state, "none");
		assert.equal(fresh.access, "full");
	});
});
