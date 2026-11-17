// /backend/src/routes/inventory.js

import express from "express";
import {
	getInventoryList,
	lookupIngredientByBarcode,
	receiveInventory,
	removeInventory,
} from "../services/inventory.js";
import { requireAuth } from "../middleware/auth.js";
import { getData } from "../services/supabase.js";
import { supabase } from "../services/supabase.js";
import {
	InventoryItemError,
	STORAGE_TYPES,
	addInventoryItem,
	getCatalogForRestaurant,
} from "../services/inventoryItems.js";
import { KNOWN_UNITS } from "../services/units.js";
import {
	commitBulkAdd,
	previewBulkAdd,
	saveCount,
} from "../services/inventoryBulk.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// GET /api/inventory
router.get("/", async (req, res) => {
	try {
		const { data: restaurant, error: restaurantError } = await supabase
			.from("restaurants")
			.select("*")
			.eq("business_id", req.businessId)
			.single();

		if (restaurantError) throw restaurantError;

		const restaurant_id = restaurant.id;

		const { data, error } = await supabase
			.from("restaurant_inventory")
			.select(
				`
				*,
				ingredient:ingredient_library(*)
			`
			)
			.eq("restaurant_id", restaurant_id);

		if (error) throw error;

		const inventory = data.map((item) => ({
			id: item.id,
			ingredient_id: item.ingredient_id,
			ingredient_name: item.ingredient.name,
			category: item.ingredient.category,
			quantity: item.quantity,
			unit: item.unit,
			minimum_quantity: item.minimum_quantity,
			cost_per_unit: item.cost_per_unit,
			location: item.location,
			expiration_date: item.expiration_date,
			last_restocked: item.last_restocked,
		}));

		res.json(inventory);
	} catch (error) {
		console.error("Inventory error: ", error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * Find the restaurant for the signed-in user's business
 * @param {string} businessId - Business UUID
 * @returns {Promise<string|null>} Restaurant UUID, or null if there is none
 */
async function findRestaurantId(businessId) {
	if (!businessId) return null;

	const { data } = await supabase
		.from("restaurants")
		.select("id")
		.eq("business_id", businessId)
		.maybeSingle();

	return data?.id || null;
}

// GET /api/inventory/catalog
// Shared catalog items this restaurant hasn't added yet, plus the choices
// the Add item form offers.
router.get("/catalog", async (req, res) => {
	try {
		const restaurantId = await findRestaurantId(req.businessId);

		if (!restaurantId) {
			return res.status(404).json({ error: "No restaurant found for this account" });
		}

		res.json({
			items: await getCatalogForRestaurant(restaurantId),
			units: KNOWN_UNITS,
			storageTypes: STORAGE_TYPES,
		});
	} catch (error) {
		console.error("Catalog error:", error);
		res.status(500).json({ error: "Couldn't load the catalog. Try again." });
	}
});

// POST /api/inventory/items
// Add one item by hand: either { ingredientId } for a catalog item, or
// { name, unit } for the owner's own item. Optional: category, storageType,
// quantity, costPerUnit, minimumQuantity, location.
router.post("/items", async (req, res) => {
	try {
		const restaurantId = await findRestaurantId(req.businessId);

		const item = await addInventoryItem({
			restaurantId,
			userId: req.user?.id,
			input: req.body,
		});

		res.status(201).json(item);
	} catch (error) {
		if (error instanceof InventoryItemError) {
			return res.status(error.status).json({ error: error.message });
		}

		console.error("Add inventory item error:", error);
		res.status(500).json({ error: "Couldn't add the item. Try again." });
	}
});

function sendBulkError(res, error, fallback) {
	if (error instanceof InventoryItemError) {
		return res.status(error.status).json({ error: error.message });
	}

	console.error(`${fallback}:`, error);
	res.status(500).json({ error: `${fallback}. Try again.` });
}

// GET /api/inventory/count-sheet
// What a printed count sheet needs: the restaurant's name and every item
// with where it's kept. No costs; the sheet goes on a clipboard.
router.get("/count-sheet", async (req, res) => {
	try {
		const { data: restaurant } = await supabase
			.from("restaurants")
			.select("id, business_name")
			.eq("business_id", req.businessId)
			.maybeSingle();

		if (!restaurant) {
			return res.status(404).json({ error: "No restaurant found for this account" });
		}

		let restaurantName = restaurant.business_name || null;
		if (!restaurantName) {
			const { data: business } = await supabase
				.from("businesses")
				.select("name")
				.eq("id", req.businessId)
				.maybeSingle();
			restaurantName = business?.name || null;
		}

		const { data, error } = await supabase
			.from("restaurant_inventory")
			.select("id, quantity, unit, location, ingredient:ingredient_library(name, category)")
			.eq("restaurant_id", restaurant.id);

		if (error) throw error;

		res.json({
			restaurantName,
			items: (data || []).map((row) => ({
				id: row.id,
				ingredient_name: row.ingredient?.name || "Unnamed item",
				category: row.ingredient?.category || null,
				quantity: row.quantity,
				unit: row.unit,
				location: row.location,
			})),
		});
	} catch (error) {
		console.error("Count sheet error:", error);
		res.status(500).json({ error: "Couldn't load the count sheet. Try again." });
	}
});

// POST /api/inventory/bulk/preview
// Check rows for a bulk add without saving. Body: { rows: [{ name, unit,
// quantity, costPerUnit, category, minimumQuantity, location, storageType }] }
router.post("/bulk/preview", async (req, res) => {
	try {
		const restaurantId = await findRestaurantId(req.businessId);
		res.json(await previewBulkAdd({ restaurantId, rows: req.body?.rows }));
	} catch (error) {
		sendBulkError(res, error, "Couldn't check those rows");
	}
});

// POST /api/inventory/bulk/add
// Add every row that checks out; returns the rest as skipped. Never changes
// items the restaurant already stocks.
router.post("/bulk/add", async (req, res) => {
	try {
		const restaurantId = await findRestaurantId(req.businessId);
		const result = await commitBulkAdd({
			restaurantId,
			userId: req.user?.id,
			rows: req.body?.rows,
		});

		res.status(result.added > 0 ? 201 : 200).json(result);
	} catch (error) {
		sendBulkError(res, error, "Couldn't add those items");
	}
});

// POST /api/inventory/count
// Set counted items to what was counted and record the variance.
// Body: { reason, note, counts: [{ inventoryId, quantity }] }
router.post("/count", async (req, res) => {
	try {
		const restaurantId = await findRestaurantId(req.businessId);
		res.json(
			await saveCount({
				restaurantId,
				userId: req.user?.id,
				reason: req.body?.reason,
				note: req.body?.note,
				counts: req.body?.counts,
			})
		);
	} catch (error) {
		sendBulkError(res, error, "Couldn't save the count");
	}
});

// GET /api/inventory/lookup?barcode=123456789
router.get("/lookup", async (req, res) => {
	try {
		const { barcode } = req.query;

		if (!barcode) {
			return res.status(400).json({ error: "Barcode parameter is required" });
		}

		const ingredient = await lookupIngredientByBarcode(barcode);
		res.json(ingredient);
	} catch (error) {
		console.error("❌ Lookup ingredient error:", error);
		if (error.message.includes("not found")) {
			res.status(404).json({ error: error.message });
		} else {
			res.status(500).json({ error: error.message });
		}
	}
});

// POST /api/inventory/receive
router.post("/receive", async (req, res) => {
	try {
		const { items } = req.body;

		if (!items || !Array.isArray(items) || items.length === 0) {
			return res.status(400).json({ error: "Items array is required" });
		}

		// Get restaurant_id from authenticated user's business (matches existing pattern)
		const { data: restaurant, error: restaurantError } = await supabase
			.from("restaurants")
			.select("id")
			.eq("business_id", req.businessId)
			.single();

		if (restaurantError) throw restaurantError;
		if (!restaurant) {
			return res.status(404).json({
				error: "No restaurant found for this business. Please contact support.",
			});
		}

		const restaurant_id = restaurant.id;

		const result = await receiveInventory(restaurant_id, items);
		res.json(result);
	} catch (error) {
		console.error("❌ Receive inventory error:", error);
		res.status(500).json({ error: error.message });
	}
});

// POST /api/inventory/remove
router.post("/remove", async (req, res) => {
	try {
		const { items } = req.body;

		if (!items || !Array.isArray(items) || items.length === 0) {
			return res.status(400).json({ error: "Items array is required" });
		}

		// Validate each item has required fields
		for (const item of items) {
			if (!item.ingredientId) {
				return res
					.status(400)
					.json({ error: "Missing required field: ingredientId" });
			}
			if (!item.quantity || item.quantity <= 0) {
				return res.status(400).json({
					error: "Quantity must be a positive number",
				});
			}
			if (!item.reason) {
				return res
					.status(400)
					.json({ error: "Missing required field: reason" });
			}
		}

		// Get restaurant_id from authenticated user's business (matches existing pattern)
		const { data: restaurant, error: restaurantError } = await supabase
			.from("restaurants")
			.select("id")
			.eq("business_id", req.businessId)
			.single();

		if (restaurantError) throw restaurantError;
		if (!restaurant) {
			return res.status(404).json({
				error: "No restaurant found for this business. Please contact support.",
			});
		}

		const restaurant_id = restaurant.id;

		const result = await removeInventory(restaurant_id, items, req.user.id);
		res.json(result);
	} catch (error) {
		console.error("❌ Remove inventory error:", error);
		res.status(500).json({ error: error.message });
	}
});

export default router;
