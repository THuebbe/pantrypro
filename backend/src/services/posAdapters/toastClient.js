// /backend/src/services/posAdapters/toastClient.js

/**
 * Toast API client (Standard API access)
 *
 * A restaurant creates its own read-only credentials in Toast Web
 * (Integrations > Toast API access > Manage credentials) and enters the
 * client ID, client secret and restaurant GUID in Settings. This client
 * exchanges the ID and secret for a short-lived token and reuses that
 * token until shortly before it expires.
 *
 * Toast documentation:
 *   https://doc.toasttab.com/doc/devguide/authentication.html
 *   https://doc.toasttab.com/doc/devguide/devApiAccessUserGuide.html
 */

import axios from "axios";

export const TOAST_PRODUCTION_URL = "https://ws-api.toasttab.com";
export const TOAST_SANDBOX_URL = "https://ws-sandbox-api.toasttab.com";

// The backend sends the client secret to this host, so only Toast's own
// hosts are accepted.
const ALLOWED_API_URLS = [TOAST_PRODUCTION_URL, TOAST_SANDBOX_URL];

const REQUEST_TIMEOUT_MS = 30000;
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

// clientId|apiUrl -> { accessToken, expiresAt }
const tokenCache = new Map();

/**
 * Resolve and validate the Toast API base URL
 * @param {object} credentials - Toast credentials
 * @returns {string} Base URL without a trailing slash
 */
export function resolveToastApiUrl(credentials = {}) {
	const url = (
		credentials.apiUrl ||
		process.env.TOAST_API_URL ||
		TOAST_PRODUCTION_URL
	).replace(/\/+$/, "");

	if (!ALLOWED_API_URLS.includes(url)) {
		throw new Error(`Unsupported Toast API URL: ${url}`);
	}

	return url;
}

/**
 * Check that the stored credentials have everything needed
 * @param {object} credentials - Toast credentials
 */
export function assertToastCredentials(credentials) {
	if (
		!credentials ||
		!credentials.restaurantGuid ||
		!credentials.clientId ||
		!credentials.clientSecret
	) {
		throw new Error(
			"Toast credentials incomplete: restaurant GUID, client ID and client secret are required"
		);
	}
}

/**
 * Turn an axios error into a message a restaurant owner can act on
 * @param {Error} error - Error from axios
 * @param {string} action - What was being attempted
 * @returns {Error}
 */
export function describeToastError(error, action) {
	const status = error.response?.status;

	if (status === 401) {
		return new Error(
			"Toast did not accept the client ID or client secret. Check both values in Toast Web."
		);
	}
	if (status === 403) {
		return new Error(
			"These Toast credentials do not have access to this restaurant GUID, or are missing a required permission (scope)."
		);
	}
	if (status === 429) {
		return new Error("Toast is rate limiting requests. Try again in a minute.");
	}
	if (status) {
		const detail = error.response.data?.message || error.message;
		return new Error(`Toast API error while ${action} (${status}): ${detail}`);
	}

	return new Error(`Could not reach Toast while ${action}: ${error.message}`);
}

/**
 * Get an access token, reusing a cached one while it is still valid
 * @param {object} credentials - Toast credentials
 * @param {object} options - Options
 * @param {boolean} options.forceRefresh - Ignore the cached token
 * @returns {Promise<string>} Access token
 */
export async function getToastAccessToken(credentials, options = {}) {
	assertToastCredentials(credentials);

	const baseUrl = resolveToastApiUrl(credentials);
	const cacheKey = `${credentials.clientId}|${baseUrl}`;
	const cached = tokenCache.get(cacheKey);

	if (
		!options.forceRefresh &&
		cached &&
		cached.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()
	) {
		return cached.accessToken;
	}

	try {
		const response = await axios.post(
			`${baseUrl}/authentication/v1/authentication/login`,
			{
				clientId: credentials.clientId,
				clientSecret: credentials.clientSecret,
				userAccessType: "TOAST_MACHINE_CLIENT",
			},
			{
				headers: { "Content-Type": "application/json" },
				timeout: REQUEST_TIMEOUT_MS,
			}
		);

		const token = response.data?.token;

		if (!token?.accessToken) {
			throw new Error("Toast login response did not include an access token");
		}

		const lifetimeMs = (Number(token.expiresIn) || 300) * 1000;

		tokenCache.set(cacheKey, {
			accessToken: token.accessToken,
			expiresAt: Date.now() + lifetimeMs,
		});

		return token.accessToken;
	} catch (error) {
		tokenCache.delete(cacheKey);
		throw describeToastError(error, "signing in");
	}
}

/**
 * Send a GET request to a Toast API for one restaurant
 * @param {object} credentials - Toast credentials
 * @param {string} path - API path, e.g. /orders/v2/ordersBulk
 * @param {object} params - Query parameters
 * @returns {Promise<any>} Response body
 */
export async function toastGet(credentials, path, params = {}) {
	const baseUrl = resolveToastApiUrl(credentials);

	const send = async (accessToken) =>
		axios.get(`${baseUrl}${path}`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Toast-Restaurant-External-ID": credentials.restaurantGuid,
			},
			params,
			timeout: REQUEST_TIMEOUT_MS,
		});

	try {
		const response = await send(await getToastAccessToken(credentials));
		return response.data;
	} catch (error) {
		// A token can be revoked before it expires; sign in again once.
		if (error.response?.status === 401) {
			try {
				const response = await send(
					await getToastAccessToken(credentials, { forceRefresh: true })
				);
				return response.data;
			} catch (retryError) {
				throw retryError.response
					? describeToastError(retryError, `requesting ${path}`)
					: retryError;
			}
		}

		throw error.response || error.request
			? describeToastError(error, `requesting ${path}`)
			: error;
	}
}

/**
 * Clear cached tokens (used by tests and when credentials change)
 */
export function clearToastTokenCache() {
	tokenCache.clear();
}
