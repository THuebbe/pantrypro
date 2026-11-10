// /backend/src/services/credentialVault.js

/**
 * Credential Vault
 *
 * Encrypts POS credentials (client secrets, access tokens) before they are
 * stored in restaurants.pos_integration_data, and decrypts them when the
 * backend needs to call the POS.
 *
 * Algorithm: AES-256-GCM with a random 12-byte IV per record.
 * Key: POS_CREDENTIALS_KEY environment variable, 32 bytes as 64 hex
 * characters or as base64. Generate one with:
 *
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * The key lives only in the backend environment. Losing it means every
 * restaurant has to re-enter its POS credentials.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = 1;

/**
 * Read and validate the encryption key from the environment
 * @returns {Buffer} 32-byte key
 */
function getKey() {
	const raw = process.env.POS_CREDENTIALS_KEY;

	if (!raw) {
		throw new Error(
			"POS_CREDENTIALS_KEY is not set on the server, so POS credentials cannot be stored securely"
		);
	}

	const trimmed = raw.trim();
	const key = /^[0-9a-fA-F]{64}$/.test(trimmed)
		? Buffer.from(trimmed, "hex")
		: Buffer.from(trimmed, "base64");

	if (key.length !== 32) {
		throw new Error(
			"POS_CREDENTIALS_KEY must be 32 bytes (64 hex characters or base64)"
		);
	}

	return key;
}

/**
 * Check whether a stored value is an encrypted envelope
 * @param {any} value - Value from restaurants.pos_integration_data
 * @returns {boolean}
 */
export function isEncrypted(value) {
	return (
		!!value &&
		typeof value === "object" &&
		value.v === VERSION &&
		typeof value.iv === "string" &&
		typeof value.tag === "string" &&
		typeof value.data === "string"
	);
}

/**
 * Encrypt a credentials object for storage
 * @param {object} credentials - Plain credentials
 * @returns {object} Envelope safe to store as JSONB
 */
export function encryptCredentials(credentials) {
	if (!credentials || typeof credentials !== "object") {
		throw new Error("Credentials must be an object");
	}

	const key = getKey();
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

	const data = Buffer.concat([
		cipher.update(JSON.stringify(credentials), "utf8"),
		cipher.final(),
	]);

	return {
		v: VERSION,
		alg: ALGORITHM,
		iv: iv.toString("base64"),
		tag: cipher.getAuthTag().toString("base64"),
		data: data.toString("base64"),
	};
}

/**
 * Decrypt a stored value back into a credentials object.
 * Rows saved before encryption was added are returned as they are, so
 * existing connections keep working until they are next saved.
 * @param {object} stored - Value from restaurants.pos_integration_data
 * @returns {object|null} Plain credentials
 */
export function decryptCredentials(stored) {
	if (!stored) return null;

	if (!isEncrypted(stored)) {
		return stored;
	}

	const key = getKey();

	try {
		const decipher = crypto.createDecipheriv(
			ALGORITHM,
			key,
			Buffer.from(stored.iv, "base64")
		);
		decipher.setAuthTag(Buffer.from(stored.tag, "base64"));

		const plain = Buffer.concat([
			decipher.update(Buffer.from(stored.data, "base64")),
			decipher.final(),
		]);

		return JSON.parse(plain.toString("utf8"));
	} catch (error) {
		throw new Error(
			"Stored POS credentials could not be decrypted. The server key may have changed; reconnect the POS in Settings."
		);
	}
}
