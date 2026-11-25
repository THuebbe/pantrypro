// /frontend/src/pages/Register.test.jsx

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Register from "./Register";

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
			<button type="button" onClick={onSkip}>
				Skip restaurant
			</button>
		</>
	),
}));

function renderRegister() {
	render(
		<MemoryRouter initialEntries={["/register"]}>
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
	});

	it("sends a new sign-up straight to the card page", async () => {
		const user = userEvent.setup();
		renderRegister();

		await user.click(screen.getByRole("button", { name: "Finish account" }));
		await user.click(screen.getByRole("button", { name: "Finish restaurant" }));

		expect(screen.getByText("Card page")).toBeInTheDocument();
	});

	it("still goes to the dashboard when the restaurant step is skipped", async () => {
		const user = userEvent.setup();
		renderRegister();

		await user.click(screen.getByRole("button", { name: "Finish account" }));
		await user.click(screen.getByRole("button", { name: "Skip restaurant" }));

		expect(screen.getByText("Dashboard page")).toBeInTheDocument();
	});
});
