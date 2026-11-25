// /backend/src/services/signup/signupService.js

/**
 * Locked sign-up
 *
 * Nothing is created until the card goes through:
 *   1. startSignup: the owner's details and restaurant are checked and held
 *      in pending_signups (password encrypted), and a Stripe Checkout page
 *      is opened for the card.
 *   2. Stripe confirms the card (webhook checkout.session.completed), or the
 *      owner lands back on /signup/complete. Either one calls
 *      finishPendingSignup, which makes the login, the user record and the
 *      restaurant, and links the Stripe subscription. Running it twice is
 *      harmless.
 *   3. completeSignup signs in the browser that started the sign-up and
 *      sends it to the dashboard.
 * Abandoned sign-ups are deleted by cleanupPendingSignups.
 */

import { supabase } from "../supabase.js";
import { encryptCredentials, decryptCredentials } from "../credentialVault.js";
import {
	createOwnerAccount,
	emailHasAccount,
	getUserBusinessId,
	issueSessionForEmail,
} from "../auth.js";
import { createBusiness } from "../business.js";
import {
	applySubscription,
	frontendUrl,
	getStripe,
} from "../billing/billingService.js";
import { billingMode, TRIAL_DAYS } from "../billing/billingCore.js";
import {
	SignupError,
	CHECKOUT_LIFETIME_HOURS,
	PENDING_LIFETIME_HOURS,
	FINISHED_RETENTION_DAYS,
	validateSignup,
	newClaimToken,
	claimTokenMatches,
	isPermanentFailure,
	canAutoSignIn,
	hoursFromNow,
} from "./signupCore.js";

const TABLE = "pending_signups";
// A sign-up stuck in "processing" this long (a crash mid-way) may be taken
// up again.
const STUCK_AFTER_MS = 5 * 60 * 1000;

const FAILED_MESSAGE =
	"We couldn't finish setting up your account, and your card won't be charged. Please sign up again.";

const defaults = () => ({
	db: supabase,
	stripe: null,
	createOwnerAccount,
	emailHasAccount,
	getUserBusinessId,
	issueSessionForEmail,
	createBusiness,
	applySubscription,
	now: () => new Date(),
});

function stripeFrom(deps) {
	if (!billingMode().configured && !deps.stripe) {
		throw new SignupError("Sign-up isn't open yet. Please check back soon.", 503);
	}
	return deps.stripe || getStripe();
}

const idOf = (value) => (typeof value === "string" ? value : value?.id || null);

/**
 * Open a Stripe Checkout page for a pending sign-up
 */
async function openCheckout(row, stripe, now) {
	const session = await stripe.checkout.sessions.create({
		mode: "subscription",
		customer_email: row.email,
		line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
		// Take the card now, even though nothing is charged during the trial.
		payment_method_collection: "always",
		// The "promotion code" box (FOUNDER). Codes live in the Stripe dashboard.
		allow_promotion_codes: true,
		metadata: { pending_signup_id: row.id },
		subscription_data: {
			trial_period_days: TRIAL_DAYS,
			metadata: { pending_signup_id: row.id },
		},
		expires_at: Math.floor(
			new Date(hoursFromNow(CHECKOUT_LIFETIME_HOURS, now)).getTime() / 1000
		),
		success_url: `${frontendUrl()}/signup/complete?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${frontendUrl()}/register?resume=${row.id}`,
	});

	return session;
}

/**
 * Hold a new sign-up and open the card page
 * @param {object} body - Request body from the sign-up form
 * @param {object} [overrides] - Stand-ins for tests
 * @returns {Promise<{url: string, pendingId: string, claimToken: string}>}
 */
export async function startSignup(body, overrides = {}) {
	const deps = { ...defaults(), ...overrides };
	const stripe = stripeFrom(deps);
	const details = validateSignup(body);
	const now = deps.now();

	if (await deps.emailHasAccount(details.email)) {
		throw new SignupError(
			"An account with this email already exists. Sign in instead.",
			409
		);
	}

	let passwordEncrypted;
	try {
		passwordEncrypted = encryptCredentials({ password: details.password });
	} catch (error) {
		console.error("[Signup] Can't encrypt the password:", error.message);
		throw new SignupError("Sign-up isn't available right now. Please try again later.", 503);
	}

	const claim = newClaimToken();

	const { data: row, error } = await deps.db
		.from(TABLE)
		.insert({
			email: details.email,
			first_name: details.firstName,
			last_name: details.lastName,
			password_encrypted: passwordEncrypted,
			restaurant: details.restaurant,
			claim_token_hash: claim.hash,
			status: "pending",
			expires_at: hoursFromNow(PENDING_LIFETIME_HOURS, now),
		})
		.select("id, email")
		.single();

	if (error || !row) {
		console.error("[Signup] Couldn't hold the sign-up:", error?.message);
		throw new SignupError("Sign-up isn't available right now. Please try again.", 500);
	}

	const session = await openCheckout(row, stripe, now);

	await deps.db
		.from(TABLE)
		.update({ stripe_checkout_session_id: session.id, updated_at: now.toISOString() })
		.eq("id", row.id);

	return { url: session.url, pendingId: row.id, claimToken: claim.token };
}

/**
 * Open a new card page for a sign-up whose checkout was closed
 * @param {object} params
 * @param {string} params.pendingId
 * @param {string} params.claimToken - From the browser that started it
 * @param {object} [overrides]
 * @returns {Promise<{url: string}>}
 */
export async function resumeSignup({ pendingId, claimToken }, overrides = {}) {
	const deps = { ...defaults(), ...overrides };
	const stripe = stripeFrom(deps);
	const now = deps.now();

	const { data: row } = await deps.db
		.from(TABLE)
		.select("id, email, status, claim_token_hash, expires_at")
		.eq("id", pendingId)
		.maybeSingle();

	if (
		!row ||
		row.status !== "pending" ||
		new Date(row.expires_at) <= now ||
		!claimTokenMatches(claimToken, row.claim_token_hash)
	) {
		throw new SignupError("This sign-up has expired. Please start again.", 404);
	}

	const session = await openCheckout(row, stripe, now);

	await deps.db
		.from(TABLE)
		.update({ stripe_checkout_session_id: session.id, updated_at: now.toISOString() })
		.eq("id", row.id);

	return { url: session.url };
}

/**
 * Take a pending sign-up for processing, so two callers (webhook and the
 * returning browser) can't make the account twice.
 * @returns {Promise<{claimed: boolean, row: object|null}>}
 */
async function claimPending(db, pendingId, now) {
	const stuckBefore = new Date(now.getTime() - STUCK_AFTER_MS).toISOString();

	const { data: claimed } = await db
		.from(TABLE)
		.update({ status: "processing", updated_at: now.toISOString() })
		.eq("id", pendingId)
		.or(`status.eq.pending,and(status.eq.processing,updated_at.lt."${stuckBefore}")`)
		.select("*")
		.maybeSingle();

	if (claimed) return { claimed: true, row: claimed };

	const { data: current } = await db
		.from(TABLE)
		.select("*")
		.eq("id", pendingId)
		.maybeSingle();

	return { claimed: false, row: current || null };
}

async function saveProgress(db, pendingId, fields, now) {
	const { error } = await db
		.from(TABLE)
		.update({ ...fields, updated_at: now.toISOString() })
		.eq("id", pendingId);

	if (error) throw new Error(`Couldn't save sign-up progress: ${error.message}`);
}

/**
 * Make the account for a sign-up whose card Stripe has confirmed
 * @param {string} pendingId - pending_signups.id
 * @param {object} session - Completed Stripe Checkout Session
 * @param {object} [overrides]
 * @returns {Promise<object|null>} The sign-up row as it now stands
 */
export async function finishPendingSignup(pendingId, session, overrides = {}) {
	const deps = { ...defaults(), ...overrides };
	const stripe = stripeFrom(deps);
	const now = deps.now();

	if (session?.metadata?.pending_signup_id !== pendingId) {
		throw new Error("Checkout session doesn't belong to this sign-up");
	}

	const { claimed, row } = await claimPending(deps.db, pendingId, now);

	if (!row) {
		console.error(`[Signup] No pending sign-up ${pendingId} for checkout ${session.id}`);
		return null;
	}
	if (!claimed) return row;

	const subscriptionId = idOf(session.subscription);
	const customerId = idOf(session.customer);
	const progress = { ...row };

	try {
		if (!progress.user_id) {
			const { password } = decryptCredentials(row.password_encrypted) || {};
			if (!password) throw new Error("Stored password is missing");

			const account = await deps.createOwnerAccount({
				email: row.email,
				password,
				firstName: row.first_name,
				lastName: row.last_name,
			});
			progress.user_id = account.id;
			await saveProgress(deps.db, pendingId, { user_id: account.id }, now);
		}

		if (!progress.business_id) {
			// A crash after the restaurant was made but before it was noted
			// here leaves it on the user; pick it up rather than make another.
			let businessId = await deps.getUserBusinessId(progress.user_id);

			if (!businessId) {
				const result = await deps.createBusiness(row.restaurant, progress.user_id);
				businessId = result.business.id;
			}

			progress.business_id = businessId;
			await saveProgress(deps.db, pendingId, { business_id: businessId }, now);
		}

		const { error: linkError } = await deps.db
			.from("businesses")
			.update({ stripe_customer_id: customerId, updated_at: now.toISOString() })
			.eq("id", progress.business_id);

		if (linkError) throw new Error(`Couldn't link the Stripe customer: ${linkError.message}`);

		const subscription = await stripe.subscriptions.retrieve(subscriptionId);
		subscription.metadata = {
			...(subscription.metadata || {}),
			business_id: progress.business_id,
		};
		await deps.applySubscription(subscription);

		const finished = {
			status: "completed",
			password_encrypted: null,
			stripe_customer_id: customerId,
			stripe_subscription_id: subscriptionId,
			completed_at: now.toISOString(),
			error: null,
		};
		await saveProgress(deps.db, pendingId, finished, now);

		console.log(`[Signup] Account made for sign-up ${pendingId}`);
		return { ...progress, ...finished };
	} catch (error) {
		if (isPermanentFailure(error)) {
			// Trying again can't fix this (the email or restaurant is already
			// taken). Close the sign-up and cancel the subscription so the
			// card is never charged.
			console.error(`[Signup] Sign-up ${pendingId} can't be finished:`, error.message);

			try {
				if (subscriptionId) await stripe.subscriptions.cancel(subscriptionId);
			} catch (cancelError) {
				console.error(
					`[Signup] Couldn't cancel subscription ${subscriptionId}:`,
					cancelError.message
				);
			}

			const failed = {
				status: "failed",
				password_encrypted: null,
				stripe_customer_id: customerId,
				stripe_subscription_id: subscriptionId,
				error: error.message,
			};
			await saveProgress(deps.db, pendingId, failed, now);
			return { ...progress, ...failed };
		}

		// Anything else may pass on a retry: put it back for the next try
		// (Stripe redelivers the webhook) and report the failure.
		await saveProgress(deps.db, pendingId, { status: "pending", error: error.message }, now).catch(
			() => {}
		);
		throw error;
	}
}

/**
 * The browser is back from Stripe Checkout. Finish the account if the
 * webhook hasn't yet, and sign that browser in.
 * @param {object} params
 * @param {string} params.sessionId - Stripe Checkout Session id from the URL
 * @param {string} [params.claimToken] - Kept by the browser that started it
 * @param {object} [overrides]
 * @returns {Promise<object>} { status: "waiting"|"working"|"ready"|"sign_in"|"failed", ... }
 */
export async function completeSignup({ sessionId, claimToken }, overrides = {}) {
	const deps = { ...defaults(), ...overrides };
	const stripe = stripeFrom(deps);

	if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
		throw new SignupError("That sign-up link isn't valid.", 400);
	}

	let session;
	try {
		session = await stripe.checkout.sessions.retrieve(sessionId);
	} catch {
		throw new SignupError("That sign-up link isn't valid.", 404);
	}

	const pendingId = session.metadata?.pending_signup_id;
	if (!pendingId) throw new SignupError("That sign-up link isn't valid.", 404);

	if (session.status !== "complete") return { status: "waiting" };

	let row;
	try {
		row = await finishPendingSignup(pendingId, session, deps);
	} catch (error) {
		console.error(`[Signup] Finishing ${pendingId} failed:`, error.message);
		return { status: "working" };
	}

	if (!row) throw new SignupError("This sign-up has expired. Please start again.", 404);
	if (row.status === "failed") return { status: "failed", message: FAILED_MESSAGE };
	if (row.status !== "completed") return { status: "working" };

	if (!canAutoSignIn(row, claimToken, deps.now())) {
		return { status: "sign_in", email: row.email };
	}

	// Sign the browser in once only.
	const { data: marked } = await deps.db
		.from(TABLE)
		.update({ session_issued_at: deps.now().toISOString() })
		.eq("id", pendingId)
		.is("session_issued_at", null)
		.select("id")
		.maybeSingle();

	if (!marked) return { status: "sign_in", email: row.email };

	try {
		const signedIn = await deps.issueSessionForEmail(row.email);

		return {
			status: "ready",
			accessToken: signedIn.accessToken,
			refreshToken: signedIn.refreshToken,
			userDetails: signedIn.userDetails,
		};
	} catch (error) {
		// The account is fine; they just sign in with their password.
		console.error(`[Signup] Auto sign-in for ${pendingId} failed:`, error.message);
		return { status: "sign_in", email: row.email };
	}
}

/**
 * Delete sign-ups nobody finished, and finished ones past their retention
 * @param {object} [overrides]
 * @returns {Promise<number>} Rows deleted
 */
export async function cleanupPendingSignups(overrides = {}) {
	const deps = { ...defaults(), ...overrides };
	const now = deps.now();
	let deleted = 0;

	// Abandoned: never paid, and past the point any checkout could finish.
	const { data: expired, error: expiredError } = await deps.db
		.from(TABLE)
		.delete()
		.eq("status", "pending")
		.lt("expires_at", now.toISOString())
		.select("id");

	if (expiredError) {
		console.error("[Signup] Cleanup of abandoned sign-ups failed:", expiredError.message);
	} else {
		deleted += expired?.length || 0;
	}

	const keepAfter = new Date(
		now.getTime() - FINISHED_RETENTION_DAYS * 24 * 60 * 60 * 1000
	).toISOString();

	const { data: finished, error: finishedError } = await deps.db
		.from(TABLE)
		.delete()
		.in("status", ["completed", "failed"])
		.lt("updated_at", keepAfter)
		.select("id");

	if (finishedError) {
		console.error("[Signup] Cleanup of finished sign-ups failed:", finishedError.message);
	} else {
		deleted += finished?.length || 0;
	}

	if (deleted) console.log(`[Signup] Cleaned up ${deleted} sign-up(s)`);
	return deleted;
}

let cleanupTimer = null;

/**
 * Run the cleanup now and then every hour
 */
export function startSignupCleanupJob(intervalMs = 60 * 60 * 1000) {
	if (cleanupTimer) return;

	const run = () => cleanupPendingSignups().catch((error) =>
		console.error("[Signup] Cleanup failed:", error.message)
	);

	run();
	cleanupTimer = setInterval(run, intervalMs);
}
