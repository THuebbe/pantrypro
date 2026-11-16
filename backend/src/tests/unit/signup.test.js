// /backend/src/tests/unit/signup.test.js
// Unit tests for the account field mapping. Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY ||= "test";

const { toUserDetails } = await import("../../services/auth.js");

test("a users row gains the camelCase names the app reads", () => {
	const details = toUserDetails({
		id: "user-1",
		email: "owner@example.com",
		first_name: "Sam",
		last_name: "Rivera",
		role: "MANAGER",
		business_id: "biz-1",
		created_at: "2026-11-16T00:00:00Z",
		updated_at: "2026-11-16T00:00:00Z",
	});

	assert.equal(details.firstName, "Sam");
	assert.equal(details.lastName, "Rivera");
	assert.equal(details.businessId, "biz-1");
	assert.equal(details.business_id, "biz-1");
	assert.equal(details.role, "MANAGER");
});

test("a user with no business yet reads as null, not undefined", () => {
	const details = toUserDetails({ id: "user-2", email: "new@example.com" });

	assert.equal(details.businessId, null);
	assert.equal(details.firstName, null);
	assert.equal(toUserDetails(null), null);
});
