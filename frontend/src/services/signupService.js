// /frontend/src/services/signupService.js

import api from "../core/database/api";

// Kept in this tab only while the owner is away at Stripe Checkout, so
// the page Stripe returns to can sign this browser in. It holds a random
// token, never the password.
const CLAIM_KEY = "pantrypro_signup_claim";

export function saveSignupClaim(claim) {
	try {
		sessionStorage.setItem(CLAIM_KEY, JSON.stringify(claim));
	} catch {
		// Private mode and the like: the owner signs in by hand afterwards.
	}
}

export function readSignupClaim() {
	try {
		return JSON.parse(sessionStorage.getItem(CLAIM_KEY) || "null");
	} catch {
		return null;
	}
}

export function clearSignupClaim() {
	try {
		sessionStorage.removeItem(CLAIM_KEY);
	} catch {
		// nothing to clear
	}
}

/**
 * Hold the sign-up on the server and get the Stripe Checkout page
 * @returns {Promise<{url: string, pendingId: string, claimToken: string}>}
 */
export async function startSignup(details) {
	const response = await api.post("/signup/start", details);
	return response.data;
}

/**
 * A new Stripe Checkout page for a sign-up whose checkout was closed
 * @returns {Promise<{url: string}>}
 */
export async function resumeSignup({ pendingId, claimToken }) {
	const response = await api.post("/signup/resume", { pendingId, claimToken });
	return response.data;
}

/**
 * Ask whether the account is ready after checkout
 * @returns {Promise<{status: string}>}
 */
export async function completeSignup({ sessionId, claimToken }) {
	const response = await api.post("/signup/complete", { sessionId, claimToken });
	return response.data;
}
