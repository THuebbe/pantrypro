// /frontend/src/pages/Register.test.jsx

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Register from "./Register";

let auth;
let savedClaim;

vi.mock("../core/auth/useAuth", () => ({
	useAuth: () => auth,
}));

vi.mock("../services/signupService", () => ({
	startSignup: vi.fn(),
	resumeSignup: vi.fn(),
	saveSignupClaim: vi.fn(),
	readSignupClaim: () => savedClaim,
	clearSignupClaim: vi.fn(),
}));

import {
	startSignup,
	resumeSignup,
	saveSignupClaim,
	clearSignupClaim,
} from "../services/signupService";

// Stand-ins for the two form steps, so the test only checks what Register
// does once each step is filled in.
vi.mock("./RegisterUser", () => ({
	default: ({ onNext }) => (
		<button
			type="button"
			onClick={() =>
				onNext({
					email: "owner@example.com",
					password: "Secret123!",
					firstName: "Sam",
					lastName: "Lee",
				})
			}
		>
			Finish account
		</button>
	),
}));

vi.mock("./RegisterBusiness", () => ({
	default: ({ onSubmit, onBack, onSkip }) => (
		<>
			<button type="button" onClick={() => onSubmit({ name: "Sam's Diner" })}>
				Finish restaurant
			</button>
			{onBack && (
				<button type="button" onClick={onBack}>
					Back
				</button>
			)}
			{onSkip && (
				<button type="button" onClick={onSkip}>
					Skip restaurant
				</button>
			)}
		</>
	),
}));

function renderRegister(path = "/register") {
	render(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				<Route path="/register" element={<Register />} />
				<Route path="/settings/billing" element={<p>Card page</p>} />
			</Routes>
		</MemoryRouter>
	);
}

describe("Register", () => {
	const originalLocation = window.location;
	let assign;

	beforeEach(() => {
		vi.clearAllMocks();
		auth = { isAuthenticated: false, createBusiness: vi.fn().mockResolvedValue({}) };
		savedClaim = null;
		assign = vi.fn();
		Object.defineProperty(window, "location", {
			configurable: true,
			value: { ...originalLocation, assign },
		});
	});

	afterEach(() => {
		Object.defineProperty(window, "location", {
			configurable: true,
			value: originalLocation,
		});
	});

	it("holds the sign-up on the server and sends the owner to checkout", async () => {
		startSignup.mockResolvedValue({
			url: "https://checkout.stripe.com/c/pay/cs_test_1",
			pendingId: "pend-1",
			claimToken: "claim-1",
		});
		const user = userEvent.setup();
		renderRegister();

		await user.click(screen.getByRole("button", { name: "Finish account" }));
		await user.click(screen.getByRole("button", { name: "Finish restaurant" }));

		await waitFor(() =>
			expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_test_1")
		);
		expect(startSignup).toHaveBeenCalledWith({
			email: "owner@example.com",
			password: "Secret123!",
			firstName: "Sam",
			lastName: "Lee",
			restaurant: { name: "Sam's Diner" },
		});
		expect(saveSignupClaim).toHaveBeenCalledWith({
			pendingId: "pend-1",
			claimToken: "claim-1",
		});
		// The claim saved in the browser never holds the password.
		expect(JSON.stringify(saveSignupClaim.mock.calls)).not.toContain("Secret123!");
		expect(auth.createBusiness).not.toHaveBeenCalled();
	});

	it("offers no way to skip the restaurant step", async () => {
		const user = userEvent.setup();
		renderRegister();

		await user.click(screen.getByRole("button", { name: "Finish account" }));

		expect(screen.getByRole("button", { name: "Finish restaurant" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Skip restaurant" })).not.toBeInTheDocument();
	});

	it("lets a signed-in owner without a restaurant finish it, then shows the card page", async () => {
		auth.isAuthenticated = true;
		const user = userEvent.setup();
		renderRegister("/register?step=restaurant");

		await user.click(screen.getByRole("button", { name: "Finish restaurant" }));

		expect(await screen.findByText("Card page")).toBeInTheDocument();
		expect(auth.createBusiness).toHaveBeenCalledWith({ name: "Sam's Diner" });
		expect(startSignup).not.toHaveBeenCalled();
	});

	it("starts at the account step for someone not signed in", () => {
		renderRegister("/register?step=restaurant");

		expect(screen.getByRole("button", { name: "Finish account" })).toBeInTheDocument();
	});

	it("reopens checkout for a sign-up whose card page was closed", async () => {
		savedClaim = { pendingId: "pend-1", claimToken: "claim-1" };
		resumeSignup.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_test_2" });
		const user = userEvent.setup();
		renderRegister("/register?resume=pend-1");

		await user.click(screen.getByRole("button", { name: "Continue to card" }));

		await waitFor(() =>
			expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_test_2")
		);
		expect(resumeSignup).toHaveBeenCalledWith(savedClaim);
	});

	it("starts over from the account step when asked", async () => {
		savedClaim = { pendingId: "pend-1", claimToken: "claim-1" };
		const user = userEvent.setup();
		renderRegister("/register?resume=pend-1");

		await user.click(screen.getByRole("button", { name: "Start over" }));

		expect(clearSignupClaim).toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Finish account" })).toBeInTheDocument();
	});

	it("ignores a resume link from another browser", () => {
		savedClaim = null;
		renderRegister("/register?resume=pend-1");

		expect(screen.queryByRole("button", { name: "Continue to card" })).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Finish account" })).toBeInTheDocument();
	});
});
