// /backend/src/routes/signupRoutes.js

/**
 * Sign-up. No sign-in needed: these are how an account comes to exist.
 * See services/signup/signupService.js for the flow.
 */

import express from "express";
import { SignupError } from "../services/signup/signupCore.js";
import {
	startSignup,
	resumeSignup,
	completeSignup,
} from "../services/signup/signupService.js";

const router = express.Router();

function sendSignupError(res, error, route) {
	if (error instanceof SignupError) {
		return res.status(error.status).json({ error: error.message });
	}

	console.error(`Error in ${route}:`, error.message);
	res.status(500).json({ error: "Sign-up isn't working right now. Please try again." });
}

/**
 * POST /api/signup/start
 * Body: { firstName, lastName, email, password, restaurant: { name, domain, address, city } }
 * Holds the sign-up and returns the Stripe Checkout page for the card.
 */
router.post("/start", async (req, res) => {
	try {
		res.status(201).json(await startSignup(req.body));
	} catch (error) {
		sendSignupError(res, error, "POST /api/signup/start");
	}
});

/**
 * POST /api/signup/resume
 * Body: { pendingId, claimToken }
 * A new card page for a sign-up whose checkout was closed.
 */
router.post("/resume", async (req, res) => {
	try {
		res.json(await resumeSignup(req.body || {}));
	} catch (error) {
		sendSignupError(res, error, "POST /api/signup/resume");
	}
});

/**
 * POST /api/signup/complete
 * Body: { sessionId, claimToken }
 * Called by the page Stripe returns to. Finishes the account if needed
 * and signs that browser in.
 */
router.post("/complete", async (req, res) => {
	try {
		res.json(await completeSignup(req.body || {}));
	} catch (error) {
		sendSignupError(res, error, "POST /api/signup/complete");
	}
});

export default router;
