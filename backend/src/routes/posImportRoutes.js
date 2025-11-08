// /backend/src/routes/posImport.js

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
	importMenuFromPOS,
	verifyPOSConnection,
	getImportPreview,
	savePOSCredentials,
} from "../services/menuImportService.js";
import { getSquareLocations } from "../services/posAdapters/squareAdapter.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// TODO: Add role-based middleware for manager/admin only
// import { requireRole } from "../middleware/roles.js";
// router.use(requireRole(['manager', 'admin']));

/**
 * POST /api/pos-import/credentials
 * Save POS credentials for a restaurant
 *
 * Body (Toast):
 * {
 *   "posSystem": "toast",
 *   "credentials": {
 *     "restaurantGuid": "abc-123",
 *     "accessToken": "token-xyz",
 *     "apiUrl": "https://ws-api.toasttab.com"
 *   }
 * }
 *
 * Body (Square):
 * {
 *   "posSystem": "square",
 *   "credentials": {
 *     "accessToken": "token-xyz",
 *     "locationId": "location-123"
 *   }
 * }
 *
 * Body (Clover):
 * {
 *   "posSystem": "clover",
 *   "credentials": {
 *     "accessToken": "token-xyz",
 *     "merchantId": "merchant-123"
 *   }
 * }
 */
router.post("/credentials", async (req, res) => {
	try {
		const restaurantId = req.restaurantId || req.userDetails?.businessId;

		if (!restaurantId) {
			return res.status(400).json({ error: "Restaurant ID not found" });
		}

		const { posSystem, credentials } = req.body;

		if (!posSystem || !credentials) {
			return res.status(400).json({
				error: "posSystem and credentials are required",
			});
		}

		const validSystems = ["toast", "square", "clover"];
		if (!validSystems.includes(posSystem.toLowerCase())) {
			return res.status(400).json({
				error: `Invalid POS system. Must be one of: ${validSystems.join(", ")}`,
			});
		}

		const restaurant = await savePOSCredentials(
			restaurantId,
			posSystem,
			credentials
		);

		res.json({
			success: true,
			message: "POS credentials saved successfully",
			posSystem: restaurant.pos_system,
		});
	} catch (error) {
		console.error("Error in POST /api/pos-import/credentials:", error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/pos-import/verify
 * Verify POS connection
 *
 * Query parameter:
 * - posSystem: 'toast', 'square', or 'clover'
 */
router.get("/verify", async (req, res) => {
	try {
		const restaurantId = req.restaurantId || req.userDetails?.businessId;

		if (!restaurantId) {
			return res.status(400).json({ error: "Restaurant ID not found" });
		}

		const { posSystem } = req.query;

		if (!posSystem) {
			return res
				.status(400)
				.json({ error: "posSystem query parameter required" });
		}

		const result = await verifyPOSConnection(restaurantId, posSystem);

		res.json(result);
	} catch (error) {
		console.error("Error in GET /api/pos-import/verify:", error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/pos-import/preview
 * Get import preview (dry run - doesn't import)
 * Shows what would be created/updated
 *
 * Query parameter:
 * - posSystem: 'toast', 'square', or 'clover'
 */
router.get("/preview", async (req, res) => {
	try {
		const restaurantId = req.restaurantId || req.userDetails?.businessId;

		if (!restaurantId) {
			return res.status(400).json({ error: "Restaurant ID not found" });
		}

		const { posSystem } = req.query;

		if (!posSystem) {
			return res
				.status(400)
				.json({ error: "posSystem query parameter required" });
		}

		const preview = await getImportPreview(restaurantId, posSystem);

		res.json(preview);
	} catch (error) {
		console.error("Error in GET /api/pos-import/preview:", error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * POST /api/pos-import/import
 * Import menu items from POS
 *
 * Body:
 * {
 *   "posSystem": "toast",
 *   "options": {
 *     "updateExisting": true,
 *     "deactivateMissing": false
 *   }
 * }
 */
router.post("/import", async (req, res) => {
	try {
		const restaurantId = req.restaurantId || req.userDetails?.businessId;

		if (!restaurantId) {
			return res.status(400).json({ error: "Restaurant ID not found" });
		}

		const { posSystem, options = {} } = req.body;

		if (!posSystem) {
			return res.status(400).json({ error: "posSystem is required" });
		}

		const result = await importMenuFromPOS(restaurantId, posSystem, options);

		res.json(result);
	} catch (error) {
		console.error("Error in POST /api/pos-import/import:", error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/pos-import/square/locations
 * Get available Square locations
 * Used during initial setup to let user select which location to sync
 *
 * Query parameter:
 * - accessToken: Square access token
 */
router.get("/square/locations", async (req, res) => {
	try {
		const { accessToken } = req.query;

		if (!accessToken) {
			return res
				.status(400)
				.json({ error: "accessToken query parameter required" });
		}

		const locations = await getSquareLocations(accessToken);

		res.json({
			locations: locations.map((loc) => ({
				id: loc.id,
				name: loc.name,
				address: loc.address,
				status: loc.status,
			})),
		});
	} catch (error) {
		console.error("Error in GET /api/pos-import/square/locations:", error);
		res.status(500).json({ error: error.message });
	}
});

export default router;
