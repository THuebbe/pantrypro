// /frontend/src/pages/Register.test.jsx

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Register from "./Register";

let auth;

vi.mock("../core/auth/useAuth", () => ({
	useAuth: () => auth,
}));

// Stand-ins for the two form steps, so the test only checks where
// Register sends the new owner once each step is done.
vi.mock("./RegisterUser", () => ({
	default: ({ onSuccess }) => (
		<button type="button" onClick={onSuccess}>
			Finish account
		</button>
	),
}));

vi.mock("./RegisterBusiness", () => ({
	default: ({ onSuccess, onSkip }) => (
		<>
			<button type="button" onClick={onSuccess}>
				Finish restaurant
			</button>
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
				<Route path="/dashboard" element={<p>Dashboard page</p>} />
			</Routes>
		</MemoryRouter>
	);
}

describe("Register", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		auth = { isAuthenticated: false };
	});

	it("sends a new sign-up straight to the card page", async () => {
		const user = userEvent.setup();
		renderRegister();

		await user.click(screen.getByRole("button", { name: "Finish account" }));
		await user.click(screen.getByRole("button", { name: "Finish restaurant" }));

		expect(screen.getByText("Card page")).toBeInTheDocument();
	});

	it("offers no way to skip the restaurant step", async () => {
		const user = userEvent.setup();
		renderRegister();

		await user.click(screen.getByRole("button", { name: "Finish account" }));

		expect(screen.getByRole("button", { name: "Finish restaurant" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Skip restaurant" })).not.toBeInTheDocument();
	});

	it("opens on the restaurant step for someone signed in without one", () => {
		auth = { isAuthenticated: true };
		renderRegister("/register?step=restaurant");

		expect(screen.getByRole("button", { name: "Finish restaurant" })).toBeInTheDocument();
	});

	it("starts at the account step for someone not signed in", () => {
		renderRegister("/register?step=restaurant");

		expect(screen.getByRole("button", { name: "Finish account" })).toBeInTheDocument();
	});
});
