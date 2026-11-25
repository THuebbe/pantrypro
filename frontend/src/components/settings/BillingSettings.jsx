// frontend\src\components\settings\BillingSettings.jsx

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { useAuth } from "../../core/auth/useAuth";
import {
	useBillingStatus,
	useStartCheckout,
	useOpenBillingPortal,
} from "../../hooks/useBilling";

// Dates are shown as MM-DD-YYYY
function formatBillingDate(value) {
	if (!value) return "";

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";

	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");

	return `${month}-${day}-${date.getFullYear()}`;
}

function describe(billing) {
	switch (billing.state) {
		case "trialing":
			return {
				tone: "green",
				icon: Clock,
				title: "Free trial",
				detail: billing.trialEndsAt
					? `Your trial runs until ${formatBillingDate(billing.trialEndsAt)}. Your card is charged after that unless you cancel.`
					: "Your free trial is running.",
			};
		case "active":
			return {
				tone: "green",
				icon: CheckCircle,
				title: "Subscription active",
				detail: billing.currentPeriodEnd
					? `Next payment on ${formatBillingDate(billing.currentPeriodEnd)}.`
					: "Your subscription is active.",
			};
		case "past_due_grace":
			return {
				tone: "yellow",
				icon: AlertTriangle,
				title: "Payment didn't go through",
				detail: billing.enforced
					? `Update your card by ${formatBillingDate(billing.graceEndsAt)} to keep full access.`
					: "Update your card to keep your subscription going.",
			};
		case "lapsed":
			// The account is only locked once billing is enforced.
			return billing.access === "blocked"
				? {
						tone: "red",
						icon: AlertTriangle,
						title: "No active plan",
						detail: billing.message,
				  }
				: {
						tone: "yellow",
						icon: AlertTriangle,
						title: "No active subscription",
						detail: "Your subscription has ended. Resubscribe to keep it going.",
				  };
		case "exempt":
			return {
				tone: "gray",
				icon: CheckCircle,
				title: "No plan needed",
				detail: "This is a test account. It has full access without a plan.",
			};
		case "none":
			return {
				tone: "blue",
				icon: CreditCard,
				title: billing.trialAvailable
					? `Start your ${billing.trialDays}-day free trial`
					: "Subscribe to PantryPro",
				detail: billing.trialAvailable
					? "Enter a card to begin. Nothing is charged during the trial, and you can cancel any time before it ends."
					: "Enter a card to start your subscription.",
			};
		default:
			return {
				tone: "gray",
				icon: CreditCard,
				title: "Billing",
				detail: "Billing isn't switched on for this account yet.",
			};
	}
}

const TONES = {
	green: "bg-green-50 border-green-200 text-green-800",
	yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
	red: "bg-red-50 border-red-200 text-red-800",
	blue: "bg-blue-50 border-blue-200 text-blue-800",
	gray: "bg-gray-50 border-gray-200 text-gray-700",
};

export default function BillingSettings({ params = {} }) {
	const { data: billing, isLoading, error, refetch } = useBillingStatus();
	const checkout = useStartCheckout();
	const portal = useOpenBillingPortal();
	const { logout } = useAuth();
	const navigate = useNavigate();
	const locked = billing?.access === "blocked";
	const justSubscribed = params.checkout === "success" && billing?.access === "full";

	// Stripe confirms the subscription a moment after sending the customer
	// back, so look again shortly after returning from checkout.
	useEffect(() => {
		if (params.checkout !== "success") return undefined;

		const timers = [2000, 6000].map((delay) => setTimeout(() => refetch(), delay));
		return () => timers.forEach(clearTimeout);
	}, [params.checkout, refetch]);

	if (isLoading) {
		return (
			<div className="bg-white rounded-lg border border-gray-200 p-6">
				<p className="text-gray-600">Loading billing...</p>
			</div>
		);
	}

	if (error || !billing) {
		return (
			<div className="bg-white rounded-lg border border-gray-200 p-6">
				<h2 className="text-2xl font-bold text-gray-900 mb-2">Billing</h2>
				<p className="text-red-600">
					{error?.response?.data?.error ||
						"Couldn't load billing. Try again in a moment."}
				</p>
			</div>
		);
	}

	const summary = describe(billing);
	const Icon = summary.icon;
	const actionError =
		checkout.error?.response?.data?.error ||
		portal.error?.response?.data?.error ||
		"";

	return (
		<div className="bg-white rounded-lg border border-gray-200 p-6">
			<h2 className="text-2xl font-bold text-gray-900 mb-4">Billing</h2>

			{locked && billing.state !== "none" && (
				<p className="mb-4 text-sm text-gray-700">
					PantryPro needs an active plan. Add your card below to get back in.
				</p>
			)}

			{params.checkout === "success" && billing.state === "none" && (
				<p className="mb-4 text-sm text-gray-700">
					Thanks. Your subscription is being confirmed and will show here in a
					few seconds.
				</p>
			)}

			{params.checkout === "cancelled" && (
				<p className="mb-4 text-sm text-gray-700">
					Checkout was closed before finishing. Nothing was charged.
				</p>
			)}

			<div className={`p-4 border rounded-lg flex items-start gap-3 ${TONES[summary.tone]}`}>
				<Icon className="w-6 h-6 flex-shrink-0 mt-0.5" />
				<div>
					<p className="font-semibold">{summary.title}</p>
					<p className="text-sm mt-1">{summary.detail}</p>
				</div>
			</div>

			{!billing.configured ? (
				<p className="mt-4 text-sm text-gray-600">
					Payments haven't been set up for PantryPro yet. You have full access in
					the meantime.
				</p>
			) : (
				<div className="mt-4 flex flex-wrap gap-3">
					{billing.canSubscribe && (
						<button
							type="button"
							onClick={() => checkout.mutate()}
							disabled={checkout.isPending}
							className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{checkout.isPending
								? "Opening checkout..."
								: billing.trialAvailable
								? "Start free trial"
								: "Resubscribe"}
						</button>
					)}
					{justSubscribed && (
						<button
							type="button"
							onClick={() => navigate("/dashboard")}
							className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
						>
							Go to dashboard
						</button>
					)}
					{billing.canManage && (
						<button
							type="button"
							onClick={() => portal.mutate()}
							disabled={portal.isPending}
							className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{portal.isPending ? "Opening..." : "Manage billing"}
						</button>
					)}
				</div>
			)}

			{actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}

			{locked && (
				<button
					type="button"
					onClick={async () => {
						await logout();
						navigate("/login");
					}}
					className="mt-4 text-sm text-gray-600 hover:text-gray-800 underline"
				>
					Sign out
				</button>
			)}

			<p className="mt-6 text-xs text-gray-500">
				Payments are handled by Stripe. PantryPro never sees or stores your card
				number.
			</p>
		</div>
	);
}
