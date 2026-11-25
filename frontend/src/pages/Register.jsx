// /frontend/src/pages/Register.jsx

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../core/auth/useAuth";
import RegisterUser from "./RegisterUser";
import RegisterBusiness from "./RegisterBusiness";
import {
	startSignup,
	resumeSignup,
	saveSignupClaim,
	readSignupClaim,
	clearSignupClaim,
} from "../services/signupService";

const STEPS = ["Your Account", "Your Restaurant", "Your Card"];

/**
 * Sign-up. Nothing is created as the owner fills it in: their details and
 * restaurant are held on the server only once both are done, then Stripe
 * Checkout takes the card, and the account is made when the card goes
 * through. There is no way to skip a step.
 */
export default function Register() {
	const [searchParams] = useSearchParams();
	const { isAuthenticated, createBusiness } = useAuth();
	const navigate = useNavigate();

	// Someone signed in without a restaurant (made before this sign-up
	// existed) is sent back here to finish it.
	const finishingRestaurant =
		isAuthenticated && searchParams.get("step") === "restaurant";

	const resumeId = searchParams.get("resume");
	const savedClaim = readSignupClaim();
	const canResume = Boolean(
		resumeId && savedClaim?.pendingId === resumeId && savedClaim?.claimToken
	);

	const [step, setStep] = useState(finishingRestaurant ? 2 : 1);
	const [account, setAccount] = useState(null);
	const [showResume, setShowResume] = useState(canResume);
	const [resumeError, setResumeError] = useState(null);
	const [resuming, setResuming] = useState(false);

	const handleAccount = (details) => {
		setAccount(details);
		setStep(2);
	};

	const handleRestaurant = async (restaurant) => {
		if (finishingRestaurant) {
			await createBusiness(restaurant);
			navigate("/settings/billing");
			return;
		}

		const started = await startSignup({ ...account, restaurant });
		saveSignupClaim({ pendingId: started.pendingId, claimToken: started.claimToken });
		window.location.assign(started.url);
	};

	const handleResume = async () => {
		setResuming(true);
		setResumeError(null);
		try {
			const { url } = await resumeSignup(savedClaim);
			window.location.assign(url);
		} catch (err) {
			setResumeError(
				err.response?.data?.error || "Couldn't reopen checkout. Please start again."
			);
			setResuming(false);
		}
	};

	const startOver = () => {
		clearSignupClaim();
		setShowResume(false);
		setStep(1);
		navigate("/register", { replace: true });
	};

	const current = showResume ? 3 : step;

	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				{/*  Progress Indicator */}
				<div className="mb-8">
					<div className="flex items-center justify-center gap-2">
						{STEPS.map((label, index) => (
							<div key={label} className="flex items-center gap-2">
								{index > 0 && <div className="w-10 h-1 bg-gray-300"></div>}
								<div
									className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
										current === index + 1
											? "bg-green-600 text-white"
											: current > index + 1
											? "bg-green-200 text-green-800"
											: "bg-gray-300 text-gray-600"
									}`}
								>
									{index + 1}
								</div>
							</div>
						))}
					</div>
					<div className="flex justify-between mt-2 text-sm text-gray-600">
						{STEPS.map((label) => (
							<span key={label}>{label}</span>
						))}
					</div>
				</div>

				{showResume ? (
					<div className="bg-white rounded-lg shadow-md p-8 text-center">
						<h2 className="text-2xl font-bold text-gray-900 mb-2">
							Add your card to finish
						</h2>
						<p className="text-gray-600 mb-6">
							Your details are saved. Your account is made as soon as your card
							goes through.
						</p>
						{resumeError && (
							<p className="mb-4 text-sm text-red-600">{resumeError}</p>
						)}
						<button
							type="button"
							onClick={handleResume}
							disabled={resuming}
							className="w-full py-3 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
						>
							{resuming ? "Opening checkout..." : "Continue to card"}
						</button>
						<button
							type="button"
							onClick={startOver}
							className="w-full py-2 mt-2 text-gray-600 hover:text-gray-800 text-sm"
						>
							Start over
						</button>
					</div>
				) : (
					<>
						{step === 1 && (
							<RegisterUser initialValues={account} onNext={handleAccount} />
						)}
						{step === 2 && (
							<RegisterBusiness
								onSubmit={handleRestaurant}
								onBack={finishingRestaurant ? undefined : () => setStep(1)}
								submitLabel={finishingRestaurant ? "Complete Setup" : "Next: Add Your Card"}
							/>
						)}
					</>
				)}
			</div>
		</div>
	);
}
