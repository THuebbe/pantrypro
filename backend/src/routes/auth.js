// /backend/src/routes/auth.js

import express from "express";
import {
	registerUser,
	loginUser,
	logoutUser,
	resetPassword,
	updateUser,
	refreshSession,
} from "../services/auth.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// ============================================
// PUBLIC ROUTES (no auth required)
// ============================================

// POST /api/auth/register
router.post("/register", async (req, res) => {
	try {
		const { email, password, firstName, lastName, businessId, role } = req.body;

		const result = await registerUser(email, password, {
			firstName,
			lastName,
			businessId,
			role,
		});

		res.status(201).json(result);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
	try {
		const { email, password } = req.body;

		const result = await loginUser(email, password);

		res.json(result);
	} catch (error) {
		res.status(401).json({ error: error.message });
	}
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
	try {
		const { email } = req.body;

		const result = await resetPassword(email);

		res.json(result);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
});

// POST /api/auth/refresh
router.post("/refresh", async (req, res) => {
	try {
		const { refreshToken } = req.body;

		if (!refreshToken) {
			return res.status(400).json({ error: "Refresh token required" });
		}

		const result = await refreshSession(refreshToken);

		res.json(result);
	} catch (error) {
		// Return 401 for expired/invalid refresh tokens
		res.status(401).json({ error: error.message });
	}
});

// ============================================
// PROTECTED ROUTES (auth required)
// ============================================

// Apply requireAuth middleware to all routes below this line
router.use(requireAuth);

// GET /api/auth/me
router.get("/me", async (req, res) => {
	try {
		// req.user and req.userDetails come from requireAuth middleware
		res.json({
			user: req.user,
			userDetails: req.userDetails,
			businessId: req.businessId,
			role: req.userRole,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

// PUT /api/auth/me
router.put("/me", async (req, res) => {
	try {
		// A user may change their own name, email and password here.
		// Role and business are never taken from the request: accepting
		// them would let anyone promote themselves or move into another
		// restaurant's account.
		const { firstName, lastName, email, password } = req.body || {};
		const updates = { firstName, lastName, email, password };

		const result = await updateUser(req.user.id, updates);

		res.json(result);
	} catch (error) {
		console.error("❌ Update error:", error);
		res.status(400).json({ error: error.message });
	}
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
	try {
		const token = req.headers.authorization;
		const result = await logoutUser(token);

		res.json(result);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

export default router;
