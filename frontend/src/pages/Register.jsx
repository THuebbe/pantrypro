// /frontend/src/pages/Register.jsx

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../core/auth/useAuth";
import RegisterUser from "./RegisterUser";
import RegisterBusiness from "./RegisterBusiness";

export default function Register() {
	const [searchParams] = useSearchParams();
	const { isAuthenticated } = useAuth();
	// Someone signed in without a restaurant is sent back here to finish it.
	const [step, setStep] = useState(
		isAuthenticated && searchParams.get("step") === "restaurant" ? 2 : 1
	);
	const navigate = useNavigate();

	const handleUserSuccess = () => {
		setStep(2);
	};

	// A new account goes straight to the card page to start the trial.
	// Stripe Checkout there still takes promo codes (FOUNDER).
	const handleBusinessSuccess = () => {
		navigate("/settings/billing");
	};

	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				{/*  Progress Indicator */}
				<div className="mb-8">
					<div className="flex items-center justify-center gap-2">
						<div
							className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
								step === 1
									? "bg-green-600 text-white"
									: "bg-green-200 text-green-800"
							}`}
						>
							1
						</div>
						<div className="w-16 h-1 bg-gray-300"></div>
						<div
							className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
								step === 2
									? "bg-green-600 text-white"
									: "bg-gray-300 text-gray-600"
							}`}
						>
							2
						</div>
					</div>
					<div className="flex justify-between mt-2 text-sm text-gray-600">
						<span>Your Account</span>
						<span>Your Restaurant</span>
					</div>
				</div>
				{/* Step Content */}
				{step === 1 && <RegisterUser onSuccess={handleUserSuccess} />}
				{step === 2 && (
					<RegisterBusiness onSuccess={handleBusinessSuccess} />
				)}
			</div>
		</div>
	);
}
