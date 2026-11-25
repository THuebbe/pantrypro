// frontend\src\hooks\useBilling.js

import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import {
	fetchBillingStatus,
	startCheckout,
	openBillingPortal,
} from "../services/billingService";

/**
 * Subscription state for the signed-in user's business
 */
export function useBillingStatus(options = {}) {
	return useQuery({
		queryKey: ["billing-status"],
		queryFn: fetchBillingStatus,
		staleTime: 1000 * 60,
		retry: false,
		...options,
	});
}

/**
 * Start the subscription: sends the browser to Stripe Checkout
 */
export function useStartCheckout() {
	return useMutation({
		mutationFn: startCheckout,
		onSuccess: (data) => {
			if (data?.url) window.location.assign(data.url);
		},
	});
}

/**
 * Open Stripe's billing page
 */
export function useOpenBillingPortal() {
	return useMutation({
		mutationFn: openBillingPortal,
		onSuccess: (data) => {
			if (data?.url) window.location.assign(data.url);
		},
	});
}

/**
 * Decides whether a billing banner should show. With billing enforced, an
 * account without a plan never gets past the card page, so in practice this
 * is the grace-period banner after a failed payment.
 */
export function useBillingNotice() {
	const location = useLocation();
	const { data: billing } = useBillingStatus();

	if (!billing?.enforced) return null;
	if (location.pathname.startsWith("/settings/billing")) return null;

	if (billing.state === "none") {
		return {
			tone: "blue",
			text: `Start your ${billing.trialDays}-day free trial to begin adding inventory.`,
			action: "Start free trial",
		};
	}
	if (billing.state === "past_due_grace") {
		return { tone: "yellow", text: billing.message, action: "Update card" };
	}
	if (billing.state === "lapsed") {
		return { tone: "red", text: billing.message, action: "Go to billing" };
	}

	return null;
}
