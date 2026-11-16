// frontend\src\components\settings\BillingSettings.test.jsx

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BillingSettings from "./BillingSettings";

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
	render(<BillingSettings params={params} />);
}

describe("BillingSettings", () => {
	beforeEach(() => {
		checkout.mutate.mockClear();
		portal.mutate.mockClear();
	});

	it("offers the free trial to a business that has never subscribed", async () => {
		const user = userEvent.setup();
		show({ state: "none", access: "read_only", canSubscribe: true });

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

	it("explains a read-only account and offers to resubscribe without a second trial", () => {
		show(
			{
				state: "lapsed",
				access: "read_only",
				message: "Your subscription has ended, so the account is read-only.",
				canSubscribe: true,
				canManage: true,
				trialAvailable: false,
			},
			{ locked: "1" }
		);

		expect(screen.getByText("Account is read-only")).toBeInTheDocument();
		expect(screen.getByText(/That change wasn't saved/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Resubscribe" })).toBeInTheDocument();
	});

	it("says payments aren't set up when Stripe isn't configured", () => {
		show({ configured: false, enforced: false, state: "not_enforced", access: "full" });

		expect(screen.getByText(/Payments haven't been set up/)).toBeInTheDocument();
		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});

	it("shows an error instead of a blank screen when billing can't load", () => {
		status = { data: null, isLoading: false, error: { response: { data: { error: "Business not found" } } }, refetch: vi.fn() };
		render(<BillingSettings />);

		expect(screen.getByText("Business not found")).toBeInTheDocument();
	});
});
