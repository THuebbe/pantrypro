// /frontend/src/components/ProtectedRoute.jsx

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../core/auth/useAuth";
import { useBillingStatus } from "../hooks/useBilling";
import { gateRedirect } from "../core/auth/gate";

function Spinner() {
	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center">
			<div className="text-center">
				<div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
				<p className="text-gray-600">Loading...</p>
			</div>
		</div>
	);
}

export default function ProtectedRoute({ children }) {
	const { isAuthenticated, loading, user } = useAuth();
	const location = useLocation();
	const hasBusiness = Boolean(user?.businessId);

	// Billing needs a business. Without one the status call can only fail,
	// so it's asked for once the restaurant exists.
	const { data: billing, isLoading: billingLoading } = useBillingStatus({
		enabled: isAuthenticated && hasBusiness,
	});

	if (loading) return <Spinner />;

	if (!isAuthenticated) {
		return (
			<Navigate
				to="/login"
				replace
			/>
		);
	}

	if (hasBusiness && billingLoading) return <Spinner />;

	const redirect = gateRedirect({ user, billing, pathname: location.pathname });

	if (redirect) {
		return (
			<Navigate
				to={redirect}
				replace
			/>
		);
	}

	return children;
}
