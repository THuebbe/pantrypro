// /frontend/src/components/ProtectedRoute.test.jsx

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { gateRedirect } from "../core/auth/gate";

let auth;
let billing;

vi.mock("../core/auth/useAuth", () => ({
	useAuth: () => auth,
}));

vi.mock("../hooks/useBilling", () => ({
	useBillingStatus: () => billing,
}));

function openAt(path) {
	render(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				<Route
					path="/dashboard"
					element={
						<ProtectedRoute>
							<p>Dashboard page</p>
						</ProtectedRoute>
					}
				/>
				<Route
					path="/settings/billing"
					element={
						<ProtectedRoute>
							<p>Card page</p>
						</ProtectedRoute>
					}
				/>
				<Route path="/login" element={<p>Login page</p>} />
				<Route path="/register" element={<p>Restaurant step</p>} />
			</Routes>
		</MemoryRouter>
	);
}

const owner = { businessId: "biz-1" };
const status = (data) => ({ data, isLoading: false });

describe("ProtectedRoute", () => {
	beforeEach(() => {
		auth = { isAuthenticated: true, loading: false, user: owner };
		billing = status({ enforced: true, access: "full", state: "trialing" });
	});

	it("lets an owner with an active plan in", () => {
		openAt("/dashboard");
		expect(screen.getByText("Dashboard page")).toBeInTheDocument();
	});

	it("sends an owner without an active plan to the card page", () => {
		billing = status({ enforced: true, access: "blocked", state: "lapsed" });
		openAt("/dashboard");
		expect(screen.getByText("Card page")).toBeInTheDocument();
	});

	it("still opens the card page itself for a locked-out owner", () => {
		billing = status({ enforced: true, access: "blocked", state: "none" });
		openAt("/settings/billing");
		expect(screen.getByText("Card page")).toBeInTheDocument();
	});

	it("lets a failed renewal in during the grace period", () => {
		billing = status({ enforced: true, access: "full", state: "past_due_grace" });
		openAt("/dashboard");
		expect(screen.getByText("Dashboard page")).toBeInTheDocument();
	});

	it("sends a signed-in user with no restaurant to finish setup", () => {
		auth = { isAuthenticated: true, loading: false, user: { businessId: null } };
		billing = status(undefined);
		openAt("/dashboard");
		expect(screen.getByText("Restaurant step")).toBeInTheDocument();
	});

	it("waits for the billing check before showing anything", () => {
		billing = { data: undefined, isLoading: true };
		openAt("/dashboard");
		expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
		expect(screen.getByText("Loading...")).toBeInTheDocument();
	});

	it("sends someone signed out to log in", () => {
		auth = { isAuthenticated: false, loading: false, user: null };
		openAt("/dashboard");
		expect(screen.getByText("Login page")).toBeInTheDocument();
	});
});

describe("gateRedirect", () => {
	it("does nothing while billing isn't enforced", () => {
		expect(
			gateRedirect({ user: owner, billing: { enforced: false, access: "full" }, pathname: "/dashboard" })
		).toBe(null);
	});
});
