// /backend/src/services/auth.js

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Signing a user in stores that user's session on the client that did it.
// Sign-ins go through this separate client so the admin client above keeps
// its service-level access for database work.
const authClient = createClient(supabaseUrl, supabaseServiceKey, {
	auth: { persistSession: false, autoRefreshToken: false },
});

console.log("Supabase URL:", supabaseUrl);
console.log("Service Key loaded:", supabaseServiceKey ? "Yes" : "No");

/**
 * The users table stores snake_case columns (first_name, business_id).
 * The rest of the app reads camelCase (firstName, businessId). This adds
 * the camelCase names to a row so both spellings work.
 * @param {object|null} row - Row from the users table
 * @returns {object|null}
 */
export function toUserDetails(row) {
	if (!row) return row;

	return {
		...row,
		firstName: row.first_name ?? null,
		lastName: row.last_name ?? null,
		businessId: row.business_id ?? null,
		createdAt: row.created_at ?? null,
		updatedAt: row.updated_at ?? null,
	};
}

/**
 * Make the login and user record for a new owner whose card Stripe has
 * confirmed. Only the sign-up flow calls this (signupService.js); there is
 * no public route that makes an account.
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @param {string} params.firstName
 * @param {string} params.lastName
 * @returns {Promise<{id: string}>} The new user's id
 */
export async function createOwnerAccount({ email, password, firstName, lastName }) {
	const { data, error } = await supabase.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { firstName: firstName || "", lastName: lastName || "" },
	});

	if (error) throw new Error(`Auth creation failed: ${error.message}`);

	const now = new Date().toISOString();
	const { error: dbError } = await supabase.from("users").insert({
		id: data.user.id,
		email: data.user.email,
		first_name: firstName || null,
		last_name: lastName || null,
		role: "MANAGER",
		business_id: null,
		created_at: now,
		updated_at: now,
	});

	if (dbError) {
		// Don't leave a login behind with no user record.
		await supabase.auth.admin.deleteUser(data.user.id);
		throw new Error(`Database user creation failed: ${dbError.message}`);
	}

	return { id: data.user.id };
}

/**
 * The business a user belongs to, if any
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
export async function getUserBusinessId(userId) {
	const { data, error } = await supabase
		.from("users")
		.select("business_id")
		.eq("id", userId)
		.maybeSingle();

	if (error) throw new Error(`User lookup failed: ${error.message}`);

	return data?.business_id || null;
}

/**
 * Is this email already used by an account?
 * @param {string} email - Lowercased
 * @returns {Promise<boolean>}
 */
export async function emailHasAccount(email) {
	const { data, error } = await supabase
		.from("users")
		.select("id")
		.eq("email", email)
		.limit(1);

	if (error) throw new Error(`User lookup failed: ${error.message}`);

	return Array.isArray(data) && data.length > 0;
}

/**
 * Sign a user in without their password, for the browser that has just
 * finished sign-up. A one-time sign-in link is made and used on the spot;
 * no email is sent.
 * @param {string} email
 * @returns {Promise<object>} Same shape as loginUser
 */
export async function issueSessionForEmail(email) {
	const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
		type: "magiclink",
		email,
	});

	if (linkError) throw new Error(`Sign-in link failed: ${linkError.message}`);

	const { data, error } = await authClient.auth.verifyOtp({
		token_hash: link.properties.hashed_token,
		type: "magiclink",
	});

	if (error) throw new Error(`Sign-in failed: ${error.message}`);

	const { data: userData } = await supabase
		.from("users")
		.select("*")
		.eq("id", data.user.id)
		.single();

	return {
		user: data.user,
		userDetails: toUserDetails(userData),
		accessToken: data.session.access_token,
		refreshToken: data.session.refresh_token,
		expiresAt: data.session.expires_at,
	};
}

export async function loginUser(email, password) {
	try {
		const { data, error } = await authClient.auth.signInWithPassword({
			email: email,
			password: password,
		});

		if (error) throw new Error(`Login failed: ${error.message}`);

		// Get user details from users table (camelCase)
		// Join with businesses table (snake_case)
		const { data: userData, error: userError } = await supabase
			.from("users")
			.select("*") // Join uses relationship name
			.eq("id", data.user.id)
			.single();

		if (userError) {
			console.warn("Could not fetch user details:", userError);
		}

		return {
			user: data.user,
			session: data.session,
			userDetails: toUserDetails(userData),
			accessToken: data.session.access_token,
			refreshToken: data.session.refresh_token,
			expiresAt: data.session.expires_at,
		};
	} catch (error) {
		throw error;
	}
}

export async function refreshSession(refreshToken) {
	try {
		if (!refreshToken) {
			throw new Error("No refresh token provided");
		}

		const { data, error } = await authClient.auth.refreshSession({
			refresh_token: refreshToken,
		});

		if (error) {
			throw new Error(`Token refresh failed: ${error.message}`);
		}

		// Get user details from users table
		const { data: userData, error: userError } = await supabase
			.from("users")
			.select("*")
			.eq("id", data.user.id)
			.single();

		if (userError) {
			console.warn("Could not fetch user details:", userError);
		}

		return {
			user: data.user,
			session: data.session,
			userDetails: toUserDetails(userData),
			accessToken: data.session.access_token,
			refreshToken: data.session.refresh_token,
			expiresAt: data.session.expires_at,
		};
	} catch (error) {
		throw error;
	}
}

export async function verifyToken(token) {
	try {
		if (!token) {
			throw new Error("No token provided");
		}

		const cleanToken = token.replace("Bearer ", "");

		const { data, error } = await supabase.auth.getUser(cleanToken);

		if (error) {
			throw new Error(`Token verification failed: ${error.message}`);
		}

		// Get user from users table (camelCase columns)
		const { data: userData, error: userError } = await supabase
			.from("users")
			.select("*")
			.eq("id", data.user.id)
			.single();

		if (userError) {
			throw new Error(`User lookup failed: ${userError.message}`);
		}

		return {
			user: data.user,
			userDetails: toUserDetails(userData),
			businessId: userData.business_id,
			role: userData.role,
		};
	} catch (error) {
		throw error;
	}
}

export async function logoutUser(token) {
	try {
		const cleanToken = token.replace("Bearer ", "");

		const { error } = await supabase.auth.admin.signOut(cleanToken);

		if (error) {
			throw new Error(`Logout failed: ${error.message}`);
		}

		return { message: "Logged out successfully" };
	} catch (error) {
		throw error;
	}
}

export async function resetPassword(email) {
	try {
		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
		});

		if (error) {
			throw new Error(`Password reset failed: ${error.message}`);
		}

		return { message: "Password reset email sent" };
	} catch (error) {
		throw error;
	}
}

export async function updateUser(userId, updates) {
	try {
		if (
			updates.email ||
			updates.password ||
			updates.firstName ||
			updates.lastName
		) {
			const authUpdates = {};

			if (updates.email) authUpdates.email = updates.email;
			if (updates.password) authUpdates.password = updates.password;

			if (updates.firstName || updates.lastName) {
				authUpdates.data = {
					firstName: updates.firstName,
					lastName: updates.lastName,
				};
			}
			const { error: authError } = await supabase.auth.admin.updateUserById(
				userId,
				authUpdates
			);
			if (authError) {
				throw new Error(`Auth update failed: ${authError.message}`);
			}
		}

		// Update users table (snake_case columns). Only fields that were
		// sent are changed, so a name edit can't blank out the business link.
		const changes = { updated_at: new Date().toISOString() };
		if (updates.firstName !== undefined) changes.first_name = updates.firstName;
		if (updates.lastName !== undefined) changes.last_name = updates.lastName;
		if (updates.role !== undefined) changes.role = updates.role;
		if (updates.businessId !== undefined) changes.business_id = updates.businessId;

		const { data, error } = await supabase
			.from("users")
			.update(changes)
			.eq("id", userId)
			.select()
			.single();

		if (error) {
			throw new Error(`User update failed: ${error.message}`);
		}

		return toUserDetails(data);
	} catch (error) {
		throw error;
	}
}
