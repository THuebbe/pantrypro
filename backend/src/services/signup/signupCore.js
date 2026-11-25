// /backend/src/services/signup/signupCore.js

/**
 * Sign-up rules with no network and no database: what a sign-up must
 * contain, and the token that lets the browser that started it sign in.
 */

import crypto from "crypto";

// Stripe Checkout pages last at most 24 hours. A pending sign-up is kept
// longer than that, so a card entered at the last minute still finds it.
export const CHECKOUT_LIFETIME_HOURS = 23;
export const PENDING_LIFETIME_HOURS = 48;
// Finished or failed sign-ups are kept a week, then deleted.
export const FINISHED_RETENTION_DAYS = 7;
// The browser that finished checkout is signed in automatically only this
// soon after the account was made. After that it signs in as usual.
export const AUTO_SIGN_IN_MINUTES = 60;

/**
 * A sign-up problem the person can fix, with a message to show them
 */
export class SignupError extends Error {
	constructor(message, status = 400) {
		super(message);
		this.name = "SignupError";
		this.status = status;
	}
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/;
const SPECIAL_CHARACTER = /[!@#$%^&*(),.?":{}|<>~]/;

const text = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * Check and tidy what the sign-up form sent. Mirrors the form's own rules,
 * so anything the form lets through passes here too.
 * @param {object} body - Request body
 * @returns {{email: string, firstName: string, lastName: string, password: string, restaurant: object}}
 */
export function validateSignup(body = {}) {
	const firstName = text(body.firstName);
	const lastName = text(body.lastName);
	const email = text(body.email).toLowerCase();
	const password = typeof body.password === "string" ? body.password : "";
	const restaurantIn = body.restaurant || {};
	const restaurant = {
		name: text(restaurantIn.name),
		domain: text(restaurantIn.domain),
		address: text(restaurantIn.address),
		city: text(restaurantIn.city),
	};

	if (firstName.length < 2 || lastName.length < 2) {
		throw new SignupError("Enter your first and last name.");
	}
	if (!EMAIL_PATTERN.test(email)) {
		throw new SignupError("Enter a valid email address.");
	}
	if (
		password.length < 8 ||
		!/[A-Z]/.test(password) ||
		!/[a-z]/.test(password) ||
		!/\d/.test(password) ||
		!SPECIAL_CHARACTER.test(password)
	) {
		throw new SignupError(
			"Your password needs at least 8 characters, with an uppercase letter, a lowercase letter, a number and a special character."
		);
	}
	if (restaurant.name.length < 2) {
		throw new SignupError("Enter your restaurant's name.");
	}
	if (restaurant.city.length < 2) {
		throw new SignupError("Enter your restaurant's city.");
	}
	if (restaurant.domain && !DOMAIN_PATTERN.test(restaurant.domain)) {
		throw new SignupError("Enter a valid website domain, like example.com, or leave it blank.");
	}

	return { email, firstName, lastName, password, restaurant };
}

/**
 * A new claim token and the hash that is stored
 * @returns {{token: string, hash: string}}
 */
export function newClaimToken() {
	const token = crypto.randomBytes(32).toString("hex");
	return { token, hash: hashClaimToken(token) };
}

/**
 * @param {string} token
 * @returns {string} SHA-256 hex
 */
export function hashClaimToken(token) {
	return crypto.createHash("sha256").update(String(token)).digest("hex");
}

/**
 * Does this token belong to the stored hash? Compared in constant time.
 * @param {string} token - From the browser
 * @param {string} storedHash - From pending_signups
 * @returns {boolean}
 */
export function claimTokenMatches(token, storedHash) {
	if (typeof token !== "string" || !token || typeof storedHash !== "string") {
		return false;
	}

	const given = Buffer.from(hashClaimToken(token), "hex");
	const stored = Buffer.from(storedHash, "hex");

	return given.length === stored.length && crypto.timingSafeEqual(given, stored);
}

/**
 * Will trying again never fix this failure? Then the sign-up is closed and
 * the subscription cancelled, rather than retried for days.
 * @param {Error} error
 * @returns {boolean}
 */
export function isPermanentFailure(error) {
	return /already (been )?registered|already exists|already has a business/i.test(
		error?.message || ""
	);
}

/**
 * May the browser that finished checkout be signed in automatically?
 * @param {object} row - pending_signups row
 * @param {string} claimToken - From the browser
 * @param {Date} [now]
 * @returns {boolean}
 */
export function canAutoSignIn(row, claimToken, now = new Date()) {
	if (row?.status !== "completed" || row.session_issued_at || !row.completed_at) {
		return false;
	}

	const age = now.getTime() - new Date(row.completed_at).getTime();
	if (age > AUTO_SIGN_IN_MINUTES * 60 * 1000) return false;

	return claimTokenMatches(claimToken, row.claim_token_hash);
}

/**
 * Hours from now as an ISO string
 */
export function hoursFromNow(hours, now = new Date()) {
	return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}
