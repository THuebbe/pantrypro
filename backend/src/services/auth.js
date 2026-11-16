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

export async function registerUser(email, password, metadata) {
	try {
		// Step 1: Create the user with admin API
		const { data, error } = await supabase.auth.admin.createUser({
			email: email,
			password: password,
			email_confirm: true,
			user_metadata: {
				firstName: metadata.firstName || "",
				lastName: metadata.lastName || "",
			},
		});

		if (error) throw new Error(`Auth creation failed: ${error.message}`);

		// Step 2: Insert into users table (snake_case columns)
		const { error: dbError } = await supabase.from("users").insert({
			id: data.user.id,
			email: data.user.email,
			first_name: metadata.firstName || null,
			last_name: metadata.lastName || null,
			role: metadata.role || "MANAGER",
			business_id: metadata.businessId || null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		});

		if (dbError) {
			// Don't leave a login behind that has no user record: the email
			// would be taken and the person could never finish signing up.
			await supabase.auth.admin.deleteUser(data.user.id);
			throw new Error(`Database user creation failed: ${dbError.message}`);
		}

		// Step 3: Sign the user in to get a session/token
		const { data: sessionData, error: signInError } =
			await authClient.auth.signInWithPassword({
				email: email,
				password: password,
			});

		if (signInError) throw new Error(`Sign in failed: ${signInError.message}`);

		// Step 4: Get full user details from users table
		const { data: userDetails, error: userError } = await supabase
			.from("users")
			.select("*")
			.eq("id", data.user.id)
			.single();

		if (userError)
			throw new Error(`Failed to fetch user details: ${userError.message}`);

		return {
			user: sessionData.user,
			session: sessionData.session,
			userDetails: toUserDetails(userDetails),
			accessToken: sessionData.session.access_token,
			refreshToken: sessionData.session.refresh_token,
			expiresAt: sessionData.session.expires_at,
			message: "User successfully registered",
		};
	} catch (error) {
		throw error;
	}
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
