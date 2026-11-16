// /backend/src/services/billing/billingService.js

/**
 * Billing service (Stripe)
 *
 * Stripe holds the card, the subscription and the receipts. PantryPro
 * stores only Stripe's ids and the current subscription state, which
 * Stripe reports through the webhook. No card details ever reach this
 * server.
 *
 * Settings (backend environment):
 *   STRIPE_SECRET_KEY      Stripe secret key
 *   STRIPE_PRICE_ID        The monthly price customers subscribe to
 *   STRIPE_WEBHOOK_SECRET  Signing secret of the webhook endpoint
 *   BILLING_ENFORCED       "true" to make unpaid accounts read-only
 *   FRONTEND_URL           Where Stripe sends the customer back to
 */

import Stripe from "stripe";
import { supabase } from "../supabase.js";
import {
	TRIAL_DAYS,
	billingMode,
	accessFor,
	subscriptionFields,
	hasUsedTrial,
	canStartSubscription,
} from "./billingCore.js";

const BILLING_COLUMNS =
	"id, name, stripe_customer_id, stripe_subscription_id, billing_status, trial_ends_at, current_period_end, billing_past_due_since";

let sharedStripe = null;

/**
 * An error whose message is safe and useful to show the owner
 */
export class BillingError extends Error {
	constructor(message, status = 400) {
		super(message);
		this.name = "BillingError";
		this.status = status;
	}
}

function getStripe() {
	if (!billingMode().configured) {
		throw new BillingError("Billing is not set up on the server yet.", 503);
	}

	if (!sharedStripe) {
		sharedStripe = new Stripe(process.env.STRIPE_SECRET_KEY);
	}

	return sharedStripe;
}

function frontendUrl() {
	return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
}

/**
 * Load the billing columns for a business
 * @param {string} businessId - Business UUID
 * @returns {Promise<Object>} Business row
 */
export async function getBillingBusiness(businessId) {
	if (!businessId) {
		throw new BillingError("Register your business before setting up billing.");
	}

	const { data, error } = await supabase
		.from("businesses")
		.select(BILLING_COLUMNS)
		.eq("id", businessId)
		.single();

	if (error || !data) {
		throw new BillingError("Business not found", 404);
	}

	return data;
}

/**
 * Billing summary for the Billing screen
 * @param {string} businessId - Business UUID
 * @returns {Promise<Object>}
 */
export async function getBillingSummary(businessId) {
	const mode = billingMode();

	// Until Stripe is set up there is nothing to look up, and everyone has
	// full access.
	if (!mode.configured) {
		return {
			configured: false,
			enforced: false,
			status: "none",
			access: "full",
			state: "not_enforced",
			message: "",
			graceEndsAt: null,
			trialEndsAt: null,
			currentPeriodEnd: null,
			trialDays: TRIAL_DAYS,
			trialAvailable: true,
			canSubscribe: false,
			canManage: false,
		};
	}

	const business = await getBillingBusiness(businessId);
	const access = accessFor(business, { enforced: mode.enforced });

	return {
		configured: mode.configured,
		enforced: mode.enforced,
		status: business.billing_status || "none",
		access: access.access,
		state: access.state,
		message: access.message,
		graceEndsAt: access.graceEndsAt,
		trialEndsAt: business.trial_ends_at,
		currentPeriodEnd: business.current_period_end,
		trialDays: TRIAL_DAYS,
		trialAvailable: !hasUsedTrial(business),
		canSubscribe: mode.configured && canStartSubscription(business),
		canManage: mode.configured && Boolean(business.stripe_customer_id),
	};
}

/**
 * Start a subscription: returns a Stripe Checkout page for the owner to
 * enter a card. First-time subscribers get the free trial.
 * @param {object} params
 * @param {string} params.businessId - Business UUID
 * @param {string} params.email - Owner's email, shown on receipts
 * @param {object} [params.stripe] - Stripe client (tests pass a stand-in)
 * @returns {Promise<{url: string}>}
 */
export async function createCheckoutSession({ businessId, email, stripe }) {
	const client = stripe || getStripe();
	const business = await getBillingBusiness(businessId);

	if (!canStartSubscription(business)) {
		throw new BillingError(
			"This business already has a subscription. Use Manage billing to change it."
		);
	}

	let customerId = business.stripe_customer_id;

	if (!customerId) {
		const customer = await client.customers.create({
			name: business.name,
			email,
			metadata: { business_id: business.id },
		});
		customerId = customer.id;

		const { error } = await supabase
			.from("businesses")
			.update({ stripe_customer_id: customerId })
			.eq("id", business.id);

		if (error) {
			throw new BillingError("Couldn't save billing details. Try again.", 500);
		}
	}

	const subscriptionData = { metadata: { business_id: business.id } };
	if (!hasUsedTrial(business)) {
		subscriptionData.trial_period_days = TRIAL_DAYS;
	}

	const session = await client.checkout.sessions.create({
		mode: "subscription",
		customer: customerId,
		client_reference_id: business.id,
		line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
		// Take the card now, even though nothing is charged during the trial.
		payment_method_collection: "always",
		// Shows a "promotion code" box on Stripe's page. Codes and what they
		// discount are created in the Stripe dashboard, not here.
		allow_promotion_codes: true,
		subscription_data: subscriptionData,
		success_url: `${frontendUrl()}/settings/billing?checkout=success`,
		cancel_url: `${frontendUrl()}/settings/billing?checkout=cancelled`,
	});

	return { url: session.url };
}

/**
 * Open Stripe's billing page, where the owner updates the card, sees
 * receipts or cancels.
 * @param {object} params
 * @param {string} params.businessId - Business UUID
 * @param {object} [params.stripe] - Stripe client (tests pass a stand-in)
 * @returns {Promise<{url: string}>}
 */
export async function createPortalSession({ businessId, stripe }) {
	const client = stripe || getStripe();
	const business = await getBillingBusiness(businessId);

	if (!business.stripe_customer_id) {
		throw new BillingError("Start your subscription first.");
	}

	const session = await client.billingPortal.sessions.create({
		customer: business.stripe_customer_id,
		return_url: `${frontendUrl()}/settings/billing`,
	});

	return { url: session.url };
}

/**
 * Write a Stripe subscription's current state onto its business
 * @param {object} subscription - Stripe Subscription object
 * @returns {Promise<boolean>} True if a business was updated
 */
async function applySubscription(subscription) {
	const customerId =
		typeof subscription.customer === "string"
			? subscription.customer
			: subscription.customer?.id;
	const businessId = subscription.metadata?.business_id;

	let query = supabase.from("businesses").select(BILLING_COLUMNS);
	query = businessId
		? query.eq("id", businessId)
		: query.eq("stripe_customer_id", customerId);

	const { data: business } = await query.maybeSingle();

	if (!business) {
		console.warn(
			`[Billing] No business found for Stripe subscription ${subscription.id}`
		);
		return false;
	}

	// An older subscription must not overwrite the one now in force.
	if (
		business.stripe_subscription_id &&
		business.stripe_subscription_id !== subscription.id &&
		["trialing", "active", "past_due"].includes(business.billing_status) &&
		!["trialing", "active", "past_due"].includes(subscription.status)
	) {
		return false;
	}

	const fields = subscriptionFields(subscription, business);
	if (customerId && !business.stripe_customer_id) {
		fields.stripe_customer_id = customerId;
	}

	const { error } = await supabase
		.from("businesses")
		.update(fields)
		.eq("id", business.id);

	if (error) {
		throw new Error(`Failed to save subscription state: ${error.message}`);
	}

	return true;
}

/**
 * Handle a verified Stripe webhook event. Each event is applied as "this
 * is the state now", so a repeated or out-of-order delivery does no harm.
 * @param {object} event - Verified Stripe event
 * @param {object} [stripe] - Stripe client (tests pass a stand-in)
 * @returns {Promise<{handled: boolean}>}
 */
export async function handleStripeEvent(event, stripe) {
	switch (event.type) {
		case "checkout.session.completed": {
			const session = event.data.object;
			if (session.mode !== "subscription" || !session.subscription) {
				return { handled: false };
			}

			const client = stripe || getStripe();
			const subscriptionId =
				typeof session.subscription === "string"
					? session.subscription
					: session.subscription.id;
			const subscription = await client.subscriptions.retrieve(subscriptionId);

			// Checkout knows which business this was, even if the metadata
			// didn't carry through.
			if (!subscription.metadata?.business_id && session.client_reference_id) {
				subscription.metadata = {
					...(subscription.metadata || {}),
					business_id: session.client_reference_id,
				};
			}

			return { handled: await applySubscription(subscription) };
		}

		case "customer.subscription.created":
		case "customer.subscription.updated":
		case "customer.subscription.deleted":
			return { handled: await applySubscription(event.data.object) };

		case "invoice.paid": {
			const invoice = event.data.object;
			const customerId =
				typeof invoice.customer === "string"
					? invoice.customer
					: invoice.customer?.id;

			if (!customerId || !invoice.amount_paid) return { handled: false };

			const paidAt = invoice.status_transitions?.paid_at || invoice.created;

			await supabase
				.from("businesses")
				.update({
					last_charge_amount: invoice.amount_paid / 100,
					last_charge_date: new Date(paidAt * 1000).toISOString().slice(0, 10),
				})
				.eq("stripe_customer_id", customerId);

			return { handled: true };
		}

		default:
			return { handled: false };
	}
}

/**
 * Check a webhook's signature and return the event
 * @param {Buffer} rawBody - Request body exactly as received
 * @param {string} signature - Stripe-Signature header
 * @returns {object} Verified Stripe event
 */
export function verifyWebhook(rawBody, signature) {
	if (!process.env.STRIPE_WEBHOOK_SECRET) {
		throw new BillingError("Webhook signing secret is not set", 503);
	}

	try {
		return getStripe().webhooks.constructEvent(
			rawBody,
			signature,
			process.env.STRIPE_WEBHOOK_SECRET
		);
	} catch (error) {
		if (error instanceof BillingError) throw error;
		throw new BillingError("Webhook signature check failed", 400);
	}
}
