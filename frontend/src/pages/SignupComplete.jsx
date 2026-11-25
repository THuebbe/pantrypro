// /frontend/src/pages/SignupComplete.jsx

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../core/auth/useAuth";
import {
	completeSignup,
	readSignupClaim,
	clearSignupClaim,
} from "../services/signupService";

// Stripe usually confirms within seconds. Keep asking for about a minute.
const POLL_MS = 2000;
const MAX_TRIES = 30;

/**
 * Where Stripe Checkout sends a new owner once the card is in. The account
 * is made on the server as soon as Stripe confirms; this page waits for
 * that, signs this browser in and opens the dashboard.
 */
export default function SignupComplete() {
	const [searchParams] = useSearchParams();
	const sessionId = searchParams.get("session_id");
	const { acceptSession } = useAuth();
	const navigate = useNavigate();
	const [state, setState] = useState({ status: "working" });
	const started = useRef(false);

	useEffect(() => {
		if (started.current) return undefined;
		started.current = true;

		let cancelled = false;
		let timer = null;
		const claim = readSignupClaim();

		const ask = async (tries) => {
			try {
				const result = await completeSignup({
					sessionId,
					claimToken: claim?.claimToken,
				});
				if (cancelled) return;

				if (result.status === "ready") {
					clearSignupClaim();
					acceptSession(result);
					navigate("/dashboard", { replace: true });
					return;
				}
				if (result.status === "sign_in" || result.status === "failed") {
					clearSignupClaim();
					setState(result);
					return;
				}
			} catch (err) {
				if (cancelled) return;
				if (err.response?.status && err.response.status < 500) {
					setState({
						status: "failed",
						message: err.response.data?.error || "That sign-up link isn't valid.",
					});
					return;
				}
			}

			if (tries + 1 >= MAX_TRIES) {
				setState({ status: "slow" });
				return;
			}
			timer = setTimeout(() => ask(tries + 1), POLL_MS);
		};

		if (!sessionId) {
			setState({ status: "failed", message: "That sign-up link isn't valid." });
		} else {
			ask(0);
		}

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [sessionId, acceptSession, navigate]);

	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
			<div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 text-center">
				{state.status === "working" && (
					<>
						<div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
						<h2 className="text-xl font-bold text-gray-900 mb-2">
							Setting up your account
						</h2>
						<p className="text-gray-600">
							Your card went through. This takes a few seconds.
						</p>
					</>
				)}

				{state.status === "sign_in" && (
					<>
						<h2 className="text-xl font-bold text-gray-900 mb-2">
							Your account is ready
						</h2>
						<p className="text-gray-600 mb-6">
							Sign in with {state.email || "your email"} and the password you
							chose.
						</p>
						<Link
							to="/login"
							className="inline-block w-full py-3 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700"
						>
							Sign in
						</Link>
					</>
				)}

				{state.status === "slow" && (
					<>
						<h2 className="text-xl font-bold text-gray-900 mb-2">
							Still confirming your card
						</h2>
						<p className="text-gray-600 mb-6">
							This is taking longer than usual. Your account will be ready in a
							minute; sign in then with the email and password you chose.
						</p>
						<Link
							to="/login"
							className="inline-block w-full py-3 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700"
						>
							Go to sign in
						</Link>
					</>
				)}

				{state.status === "failed" && (
					<>
						<h2 className="text-xl font-bold text-gray-900 mb-2">
							We couldn't finish sign-up
						</h2>
						<p className="text-gray-600 mb-6">{state.message}</p>
						<Link
							to="/register"
							className="inline-block w-full py-3 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700"
						>
							Start again
						</Link>
					</>
				)}
			</div>
		</div>
	);
}
