// /backend/src/services/billing/businessBilling.js

import { supabase } from "../supabase.js";

const EXEMPT_COLUMN = "billing_exempt";

/**
 * Select a business's billing columns, with its billing_exempt flag when
 * that column exists. Until its migration runs the flag is read as off,
 * so the rest of billing keeps working.
 * @param {string} columns - Columns to select, without billing_exempt
 * @param {(query: object) => object} filter - Adds the where clause
 * @param {object} [db] - Supabase client
 * @returns {Promise<{data: object|null, error: object|null}>}
 */
export async function selectBusinessBilling(columns, filter, db = supabase) {
	const withFlag = await filter(
		db.from("businesses").select(`${columns}, ${EXEMPT_COLUMN}`)
	).maybeSingle();

	if (!withFlag.error || !isMissingColumn(withFlag.error)) return withFlag;

	return filter(db.from("businesses").select(columns)).maybeSingle();
}

function isMissingColumn(error) {
	return (
		error?.code === "42703" ||
		error?.code === "PGRST204" ||
		String(error?.message || "").includes(EXEMPT_COLUMN)
	);
}
