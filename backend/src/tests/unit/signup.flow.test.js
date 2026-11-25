// /backend/src/tests/unit/signup.flow.test.js
// Unit tests for the locked sign-up: nothing exists until the card goes
// through. No network or database needed. Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY ||= "test";
process.env.POS_CREDENTIALS_KEY = "a".repeat(64);
process.env.STRIPE_SECRET_KEY = "sk_test_x";
process.env.STRIPE_PRICE_ID = "price_123";
process.env.FRONTEND_URL = "https://app.example.com";

const {
	SignupError,
	validateSignup,
	newClaimToken,
	claimTokenMatches,
	canAutoSignIn,
	isPermanentFailure,
} = await import("../../services/signup/signupCore.js");
const {
	startSignup,
	resumeSignup,
	finishPendingSignup,
	completeSignup,
	cleanupPendingSignups,
} = await import("../../services/signup/signupService.js");
const { handleStripeEvent } = await import("../../services/billing/billingService.js");
const { supabase } = await import("../../services/supabase.js");

const NOW = new Date("2026-11-25T18:00:00Z");

const goodSignup = () => ({
	firstName: "Sam",
	lastName: "Rivera",
	email: "Owner@Example.com ",
	password: "Str0ng!pass",
	restaurant: { name: "Bob's Burgers", domain: "", address: "1 Main St", city: "Davenport" },
});

// ---------------------------------------------------------------------------
// A small in-memory stand-in for the Supabase query builder
// ---------------------------------------------------------------------------

function fakeDb(tables = {}) {
	const data = { pending_signups: [], businesses: [], ...tables };
	let nextId = 1;

	const matches = (row, filters) =>
		filters.every(([op, column, value]) => {
			if (op === "eq") return row[column] === value;
			if (op === "is") return (row[column] ?? null) === value;
			if (op === "lt") return row[column] < value;
			if (op === "in") return value.includes(row[column]);
			if (op === "or") {
				// Only the claim filter is used: pending, or processing and stale.
				const stale = /updated_at\.lt\."([^"]+)"/.exec(value)[1];
				return (
					row.status === "pending" ||
					(row.status === "processing" && row.updated_at < stale)
				);
			}
			throw new Error(`fake db: unknown filter ${op}`);
		});

	function from(table) {
		const rows = (data[table] ||= []);
		const filters = [];
		let action = "select";
		let payload = null;

		const run = () => {
			if (action === "insert") {
				const row = { id: `row-${nextId++}`, updated_at: NOW.toISOString(), ...payload };
				rows.push(row);
				return [row];
			}
			const hit = rows.filter((row) => matches(row, filters));
			if (action === "update") hit.forEach((row) => Object.assign(row, payload));
			if (action === "delete") {
				for (const row of hit) rows.splice(rows.indexOf(row), 1);
			}
			return hit.map((row) => ({ ...row }));
		};

		const chain = {
			select: () => chain,
			insert: (values) => ((action = "insert"), (payload = values), chain),
			update: (values) => ((action = "update"), (payload = values), chain),
			delete: () => ((action = "delete"), chain),
			eq: (c, v) => (filters.push(["eq", c, v]), chain),
			is: (c, v) => (filters.push(["is", c, v]), chain),
			lt: (c, v) => (filters.push(["lt", c, v]), chain),
			in: (c, v) => (filters.push(["in", c, v]), chain),
			or: (v) => (filters.push(["or", null, v]), chain),
			limit: () => chain,
			single: async () => {
				const out = run();
				return out[0] ? { data: out[0], error: null } : { data: null, error: { message: "none" } };
			},
			maybeSingle: async () => ({ data: run()[0] || null, error: null }),
			then: (resolve) => resolve({ data: run(), error: null }),
		};
		return chain;
	}

	return { from, data };
}

function fakeStripe({ sessionStatus = "complete", pendingId = "row-1" } = {}) {
	const calls = { checkout: [], cancelled: [], retrieved: [] };
	return {
		calls,
		checkout: {
			sessions: {
				create: async (params) => {
					calls.checkout.push(params);
					return { id: `cs_test_${calls.checkout.length}`, url: "https://checkout.stripe.test/s" };
				},
				retrieve: async (id) => ({
					id,
					status: sessionStatus,
					mode: "subscription",
					customer: "cus_1",
					subscription: "sub_1",
					metadata: { pending_signup_id: pendingId },
				}),
			},
		},
		subscriptions: {
			retrieve: async (id) => {
				calls.retrieved.push(id);
				return { id, status: "trialing", customer: "cus_1", metadata: { pending_signup_id: pendingId } };
			},
			cancel: async (id) => calls.cancelled.push(id),
		},
	};
}

function fakeAccounts({ failAccount } = {}) {
	const made = { accounts: [], businesses: [], subscriptions: [], sessions: [] };
	return {
		made,
		emailHasAccount: async () => false,
		createOwnerAccount: async (details) => {
			if (failAccount) throw new Error(failAccount);
			made.accounts.push(details);
			return { id: "user-1" };
		},
		getUserBusinessId: async () => null,
		createBusiness: async (restaurant, userId) => {
			made.businesses.push({ restaurant, userId });
			return { business: { id: "biz-1" } };
		},
		applySubscription: async (subscription) => made.subscriptions.push(subscription),
		issueSessionForEmail: async (email) => {
			made.sessions.push(email);
			return { accessToken: "at", refreshToken: "rt", userDetails: { email, businessId: "biz-1" } };
		},
		now: () => NOW,
	};
}

async function startedSignup() {
	const db = fakeDb();
	const stripe = fakeStripe();
	const accounts = fakeAccounts();
	const started = await startSignup(goodSignup(), { db, stripe, ...accounts });
	return { db, stripe, accounts, started, deps: { db, stripe, ...accounts } };
}

const completedSession = (pendingId = "row-1") => ({
	id: "cs_test_1",
	status: "complete",
	mode: "subscription",
	customer: "cus_1",
	subscription: "sub_1",
	metadata: { pending_signup_id: pendingId },
});

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

test("a sign-up is checked the same way the form checks it", () => {
	const ok = validateSignup(goodSignup());
	assert.equal(ok.email, "owner@example.com");
	assert.equal(ok.restaurant.name, "Bob's Burgers");

	for (const bad of [
		{ firstName: "S" },
		{ email: "nope" },
		{ password: "short" },
		{ password: "nouppercase1!" },
		{ restaurant: { name: "B", city: "Davenport" } },
		{ restaurant: { name: "Bob's", city: "" } },
		{ restaurant: { name: "Bob's", city: "Davenport", domain: "not a domain" } },
	]) {
		assert.throws(() => validateSignup({ ...goodSignup(), ...bad }), SignupError);
	}
});

test("only the browser holding the claim token matches it", () => {
	const claim = newClaimToken();
	assert.equal(claimTokenMatches(claim.token, claim.hash), true);
	assert.equal(claimTokenMatches(newClaimToken().token, claim.hash), false);
	assert.equal(claimTokenMatches(undefined, claim.hash), false);
});

test("auto sign-in is for a fresh, finished sign-up, once", () => {
	const claim = newClaimToken();
	const row = {
		status: "completed",
		completed_at: new Date(NOW.getTime() - 5 * 60000).toISOString(),
		claim_token_hash: claim.hash,
	};
	assert.equal(canAutoSignIn(row, claim.token, NOW), true);
	assert.equal(canAutoSignIn({ ...row, session_issued_at: NOW.toISOString() }, claim.token, NOW), false);
	assert.equal(canAutoSignIn({ ...row, status: "processing" }, claim.token, NOW), false);
	assert.equal(
		canAutoSignIn({ ...row, completed_at: new Date(NOW.getTime() - 2 * 3600000).toISOString() }, claim.token, NOW),
		false
	);
});

test("a taken email is a failure retrying can't fix", () => {
	assert.equal(
		isPermanentFailure(new Error("Auth creation failed: A user with this email address has already been registered")),
		true
	);
	assert.equal(isPermanentFailure(new Error("fetch failed")), false);
});

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------

test("starting a sign-up makes no account and opens a card checkout that takes promo codes", async () => {
	const { db, stripe, accounts, started } = await startedSignup();

	assert.equal(accounts.made.accounts.length, 0);
	assert.equal(accounts.made.businesses.length, 0);

	const [row] = db.data.pending_signups;
	assert.equal(row.status, "pending");
	assert.equal(row.email, "owner@example.com");
	assert.ok(row.password_encrypted.data, "password is stored encrypted");
	assert.ok(!JSON.stringify(row).includes("Str0ng!pass"), "password never stored as typed");
	assert.equal(row.stripe_checkout_session_id, "cs_test_1");
	assert.notEqual(row.claim_token_hash, started.claimToken);

	const [params] = stripe.calls.checkout;
	assert.equal(params.mode, "subscription");
	assert.equal(params.customer_email, "owner@example.com");
	assert.equal(params.allow_promotion_codes, true);
	assert.equal(params.payment_method_collection, "always");
	assert.equal(params.subscription_data.trial_period_days, 30);
	assert.equal(params.metadata.pending_signup_id, row.id);
	assert.equal(params.success_url, "https://app.example.com/signup/complete?session_id={CHECKOUT_SESSION_ID}");
	assert.equal(params.cancel_url, `https://app.example.com/register?resume=${row.id}`);

	assert.equal(started.url, "https://checkout.stripe.test/s");
	assert.equal(started.pendingId, row.id);
});

test("an email that already has an account can't start a sign-up", async () => {
	await assert.rejects(
		startSignup(goodSignup(), {
			db: fakeDb(),
			stripe: fakeStripe(),
			...fakeAccounts(),
			emailHasAccount: async () => true,
		}),
		(error) => error.status === 409
	);
});

test("Stripe's confirmation makes the account, the restaurant and links the plan", async () => {
	const { db, accounts, deps } = await startedSignup();

	const row = await finishPendingSignup("row-1", completedSession(), deps);

	assert.equal(row.status, "completed");
	assert.deepEqual(accounts.made.accounts, [
		{ email: "owner@example.com", password: "Str0ng!pass", firstName: "Sam", lastName: "Rivera" },
	]);
	assert.equal(accounts.made.businesses[0].userId, "user-1");
	assert.equal(accounts.made.businesses[0].restaurant.city, "Davenport");
	assert.equal(accounts.made.subscriptions[0].metadata.business_id, "biz-1");

	const stored = db.data.pending_signups[0];
	assert.equal(stored.password_encrypted, null, "password cleared once the account exists");
	assert.equal(stored.user_id, "user-1");
	assert.equal(stored.business_id, "biz-1");
});

test("the webhook and the returning browser can't make the account twice", async () => {
	const { accounts, deps } = await startedSignup();

	await finishPendingSignup("row-1", completedSession(), deps);
	const again = await finishPendingSignup("row-1", completedSession(), deps);

	assert.equal(again.status, "completed");
	assert.equal(accounts.made.accounts.length, 1);
	assert.equal(accounts.made.businesses.length, 1);
});

test("a checkout for a different sign-up is refused", async () => {
	const { deps } = await startedSignup();
	await assert.rejects(finishPendingSignup("row-1", completedSession("row-9"), deps));
});

test("a taken email closes the sign-up and cancels the plan so the card isn't charged", async () => {
	const { db, stripe, deps } = await startedSignup();
	const failing = {
		...deps,
		createOwnerAccount: async () => {
			throw new Error("Auth creation failed: A user with this email address has already been registered");
		},
	};

	const row = await finishPendingSignup("row-1", completedSession(), failing);

	assert.equal(row.status, "failed");
	assert.deepEqual(stripe.calls.cancelled, ["sub_1"]);
	assert.equal(db.data.pending_signups[0].password_encrypted, null);
});

test("a passing hiccup puts the sign-up back for Stripe's retry, keeping what was done", async () => {
	const { db, accounts, deps } = await startedSignup();
	let fail = true;
	const flaky = {
		...deps,
		createBusiness: async (restaurant, userId) => {
			if (fail) throw new Error("fetch failed");
			return accounts.createBusiness(restaurant, userId);
		},
	};

	await assert.rejects(finishPendingSignup("row-1", completedSession(), flaky));
	assert.equal(db.data.pending_signups[0].status, "pending");
	assert.equal(db.data.pending_signups[0].user_id, "user-1");

	fail = false;
	const row = await finishPendingSignup("row-1", completedSession(), flaky);
	assert.equal(row.status, "completed");
	assert.equal(accounts.made.accounts.length, 1, "the login isn't made a second time");
});

test("the browser that started the sign-up is signed in once; any other is asked to sign in", async () => {
	const { accounts, started, deps } = await startedSignup();

	const ready = await completeSignup(
		{ sessionId: "cs_test_1", claimToken: started.claimToken },
		deps
	);
	assert.equal(ready.status, "ready");
	assert.equal(ready.accessToken, "at");
	assert.deepEqual(accounts.made.sessions, ["owner@example.com"]);

	const twice = await completeSignup({ sessionId: "cs_test_1", claimToken: started.claimToken }, deps);
	assert.equal(twice.status, "sign_in");

	const other = await completeSignup({ sessionId: "cs_test_1", claimToken: "wrong" }, deps);
	assert.equal(other.status, "sign_in");
	assert.equal(accounts.made.sessions.length, 1);
});

test("before the card goes through, the returning page is told to wait", async () => {
	const { started, deps } = await startedSignup();
	const result = await completeSignup(
		{ sessionId: "cs_test_1", claimToken: started.claimToken },
		{ ...deps, stripe: fakeStripe({ sessionStatus: "open" }) }
	);

	assert.equal(result.status, "waiting");
	assert.equal(deps.db.data.pending_signups[0].status, "pending");
});

test("a closed checkout can be reopened by the browser that started it", async () => {
	const { stripe, started, deps } = await startedSignup();

	const resumed = await resumeSignup({ pendingId: started.pendingId, claimToken: started.claimToken }, deps);
	assert.equal(resumed.url, "https://checkout.stripe.test/s");
	assert.equal(stripe.calls.checkout.length, 2);

	await assert.rejects(
		resumeSignup({ pendingId: started.pendingId, claimToken: "wrong" }, deps),
		(error) => error.status === 404
	);
});

test("Stripe's webhook for a sign-up checkout finishes that sign-up", async (t) => {
	const { db, stripe, accounts } = await startedSignup();
	t.mock.method(supabase, "from", db.from);

	// The webhook path uses the real account helpers, so only check it
	// reaches the sign-up: a stand-in Stripe and a row with no password make
	// it stop at the first step and put the row back.
	db.data.pending_signups[0].password_encrypted = null;

	await assert.rejects(
		handleStripeEvent({ type: "checkout.session.completed", data: { object: completedSession() } }, stripe),
		/Stored password is missing/
	);
	assert.equal(db.data.pending_signups[0].status, "pending");
	assert.equal(accounts.made.accounts.length, 0);
});

test("cleanup deletes abandoned sign-ups and old finished ones, and nothing still in play", async () => {
	const old = new Date(NOW.getTime() - 10 * 86400000).toISOString();
	const db = fakeDb({
		pending_signups: [
			{ id: "abandoned", status: "pending", expires_at: old, updated_at: old },
			{ id: "fresh", status: "pending", expires_at: new Date(NOW.getTime() + 3600000).toISOString(), updated_at: NOW.toISOString() },
			{ id: "done-old", status: "completed", expires_at: old, updated_at: old },
			{ id: "done-new", status: "completed", expires_at: old, updated_at: NOW.toISOString() },
			{ id: "busy", status: "processing", expires_at: old, updated_at: old },
		],
	});

	const deleted = await cleanupPendingSignups({ db, now: () => NOW });

	assert.equal(deleted, 2);
	assert.deepEqual(
		db.data.pending_signups.map((row) => row.id).sort(),
		["busy", "done-new", "fresh"]
	);
});
