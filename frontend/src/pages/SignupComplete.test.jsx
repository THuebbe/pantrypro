// /frontend/src/pages/SignupComplete.test.jsx

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import SignupComplete from "./SignupComplete";

const acceptSession = vi.fn();

vi.mock("../core/auth/useAuth", () => ({
	useAuth: () => ({ acceptSession }),
}));

vi.mock("../services/signupService", () => ({
	completeSignup: vi.fn(),
	readSignupClaim: () => ({ pendingId: "pend-1", claimToken: "claim-1" }),
	clearSignupClaim: vi.fn(),
}));

import { completeSignup, clearSignupClaim } from "../services/signupService";

function renderPage(path = "/signup/complete?session_id=cs_test_1") {
	render(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				<Route path="/signup/complete" element={<SignupComplete />} />
				<Route path="/dashboard" element={<p>Dashboard page</p>} />
			</Routes>
		</MemoryRouter>
	);
}

describe("SignupComplete", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("signs the new owner in and opens the dashboard once the account is ready", async () => {
		const session = {
			status: "ready",
			accessToken: "a",
			refreshToken: "r",
			userDetails: { id: "u1" },
		};
		completeSignup.mockResolvedValue(session);
		renderPage();

		expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
		expect(completeSignup).toHaveBeenCalledWith({
			sessionId: "cs_test_1",
			claimToken: "claim-1",
		});
		expect(acceptSession).toHaveBeenCalledWith(session);
		expect(clearSignupClaim).toHaveBeenCalled();
	});

	it("keeps waiting while the card is still being confirmed", async () => {
		completeSignup
			.mockResolvedValueOnce({ status: "working" })
			.mockResolvedValueOnce({ status: "ready", userDetails: { id: "u1" } });
		renderPage();

		expect(
			await screen.findByText("Dashboard page", {}, { timeout: 4000 })
		).toBeInTheDocument();
		expect(completeSignup).toHaveBeenCalledTimes(2);
	});

	it("asks the owner to sign in when this browser can't be signed in", async () => {
		completeSignup.mockResolvedValue({ status: "sign_in", email: "owner@example.com" });
		renderPage();

		expect(await screen.findByText("Your account is ready")).toBeInTheDocument();
		expect(screen.getByText(/owner@example.com/)).toBeInTheDocument();
		expect(acceptSession).not.toHaveBeenCalled();
	});

	it("says so when the sign-up failed", async () => {
		completeSignup.mockResolvedValue({ status: "failed", message: "Your card was refunded." });
		renderPage();

		expect(await screen.findByText("We couldn't finish sign-up")).toBeInTheDocument();
		expect(screen.getByText("Your card was refunded.")).toBeInTheDocument();
	});

	it("rejects a link with no checkout session", async () => {
		renderPage("/signup/complete");

		expect(await screen.findByText("We couldn't finish sign-up")).toBeInTheDocument();
		expect(completeSignup).not.toHaveBeenCalled();
	});
});
