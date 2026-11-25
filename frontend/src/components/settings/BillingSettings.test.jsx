// frontend\src\components\settings\BillingSettings.test.jsx

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import BillingSettings from "./BillingSettings";

const logout = vi.fn(async () => {});
vi.mock("../../core/auth/useAuth", () => ({
	useAuth: () => ({ logout }),
}));

const checkout = { mutate: vi.fn(), isPending: false, error: null };
const portal = { mutate: vi.fn(), isPending: false, error: null };
let status;

vi.mock("../../hooks/useBilling", () => ({
	useBillingStatus: () => status,
	useStartCheckout: () => checkout,
	useOpenBillingPortal: () => portal,
}));

const base = {
	configured: true,
	enforced: true,
	trialDays: 30,
	trialAvailable: true,
	canSubscribe: false,
	canManage: false,
	message: "",
};

function show(billing, params = {}) {
	status = { data: { ...base, ...billing }, isLoading: false, error: null, refetch: vi.fn() };
	render(
		<MemoryRouter>
			<BillingSettings params={params} />
		</MemoryRouter>
	);
}

describe("BillingSettings", () => {
	beforeEach(() => {
		checkout.mutate.mockClear();
		portal.mutate.mockClear();
	});

	it("offers the free trial to a business that has never subscribed", async () => {
		const user = userEvent.setup();
		show({ state: "none", access: "blocked", canSubscribe: true });

		expect(screen.getByText("Start your 30-day free trial")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Manage billing" })).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Start free trial" }));
		expect(checkout.mutate).toHaveBeenCalled();
	});

	it("shows when the trial ends, as MM-DD-YYYY, and lets the owner manage billing", async () => {
		const user = userEvent.setup();
		show({ state: "trialing", access: "full", canManage: true, trialEndsAt: "2026-12-16T18:00:00Z" });

		expect(screen.getByText(/Your trial runs until 12-16-2026/)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Start free trial" })).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Manage billing" }));
		expect(portal.mutate).toHaveBeenCalled();
	});

	it("explains a locked account, offers to resubscribe without a second trial, and lets the owner sign out", async () => {
		const user = userEvent.setup();
		show(
			{
				state: "lapsed",
				access: "blocked",
				message: "Your subscription has ended. Resubscribe to get back into PantryPro.",
				canSubscribe: true,
				canManage: true,
				trialAvailable: false,
			},
			{ locked: "1" }
		);

		expect(screen.getByText("No active plan")).toBeInTheDocument();
		expect(screen.getByText(/needs an active plan/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Resubscribe" })).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Sign out" }));
		expect(logout).toHaveBeenCalled();
	});

	it("doesn't tell a brand-new sign-up they're locked out", () => {
		show({ state: "none", access: "blocked", canSubscribe: true });

		expect(screen.queryByText(/needs an active plan/)).not.toBeInTheDocument();
	});

	it("offers the way into the app once checkout has gone through", () => {
		show({ state: "trialing", access: "full", canManage: true }, { checkout: "success" });

		expect(screen.getByRole("button", { name: "Go to dashboard" })).toBeInTheDocument();
	});

	it("shows the trial even while billing isn't enforced yet", () => {
		show({ enforced: false, state: "trialing", access: "full", canManage: true, trialEndsAt: "2026-12-16T18:00:00Z" });

		expect(screen.getByText("Free trial")).toBeInTheDocument();
		expect(screen.getByText(/Your trial runs until 12-16-2026/)).toBeInTheDocument();
		expect(screen.queryByText(/isn't switched on/)).not.toBeInTheDocument();
	});

	it("doesn't call an unenforced account locked", () => {
		show({ enforced: false, state: "lapsed", access: "full", canSubscribe: true, trialAvailable: false });

		expect(screen.getByText("No active subscription")).toBeInTheDocument();
		expect(screen.queryByText("No active plan")).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
	});

	it("says payments aren't set up when Stripe isn't configured", () => {
		show({ configured: false, enforced: false, state: "not_enforced", access: "full" });

		expect(screen.getByText(/Payments haven't been set up/)).toBeInTheDocument();
		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});

	it("shows an error instead of a blank screen when billing can't load", () => {
		status = { data: null, isLoading: false, error: { response: { data: { error: "Business not found" } } }, refetch: vi.fn() };
		render(
			<MemoryRouter>
				<BillingSettings />
			</MemoryRouter>
		);

		expect(screen.getByText("Business not found")).toBeInTheDocument();
	});
});
