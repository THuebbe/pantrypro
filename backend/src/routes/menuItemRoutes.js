// /backend/src/routes/menuItems.js

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";
import {
	getMenuItems,
	getMenuItem,
	createMenuItem,
	updateMenuItem,
	deleteMenuItem,
	getMenuCategories,
} from "../services/menuItemService.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// TODO: Add role-based middleware for manager/admin only routes
// import { requireRole } from "../middleware/roles.js";
// router.use(requireRole(['manager', 'admin'])); // Uncomment when role system is implemented

/**
 * Helper function to get restaurant_id from business_id
 * This is the correct pattern to follow for all routes
 */
async function getRestaurantId(businessId) {
	if (!businessId) {
		throw new Error("Business ID not found");
	}

	const { data: restaurant, error } = await supabase
		.from("restaurants")
		.select("id")
		.eq("business_id", businessId)
		.single();

	if (error) {
		console.error("Error looking up restaurant:", error);
		throw new Error("Failed to find restaurant for this business");
	}

	if (!restaurant) {
		throw new Error(
			"No restaurant found for this business. Please contact support."
		);
	}

	return restaurant.id;
}

/**
 * GET /api/menu-items
 * Get all menu items for the restaurant
 *
 * Query parameters:
 * - category: Filter by category (optional)
 * - isActive: Filter by active status (optional, defaults to true)
 */
router.get("/", async (req, res) => {
	try {
		// ✅ FIXED: Look up restaurant_id from business_id
		const businessId = req.userDetails?.businessId;
		const restaurantId = await getRestaurantId(businessId);

		const filters = {};
		if (req.query.category) {
			filters.category = req.query.category;
		}
		if (req.query.isActive !== undefined) {
			filters.isActive = req.query.isActive === "true";
		}

		const menuItems = await getMenuItems(restaurantId, filters);

		res.json(menuItems);
	} catch (error) {
		console.error("Error in GET /api/menu-items:", error);

		if (error.message.includes("Business ID not found")) {
			return res.status(400).json({ error: error.message });
		}
		if (error.message.includes("No restaurant found")) {
			return res.status(404).json({ error: error.message });
		}

		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/menu-items/categories
 * Get all unique categories used by the restaurant
 */
router.get("/categories", async (req, res) => {
	try {
		// ✅ FIXED: Look up restaurant_id from business_id
		const businessId = req.userDetails?.businessId;
		const restaurantId = await getRestaurantId(businessId);

		const categories = await getMenuCategories(restaurantId);

		res.json(categories);
	} catch (error) {
		console.error("Error in GET /api/menu-items/categories:", error);

		if (error.message.includes("No restaurant found")) {
			return res.status(404).json({ error: error.message });
		}

		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/menu-items/:id
 * Get a single menu item with its recipe
 */
router.get("/:id", async (req, res) => {
	try {
		const { id } = req.params;

		const menuItem = await getMenuItem(id);

		// ✅ FIXED: Verify the menu item belongs to the user's restaurant
		const businessId = req.userDetails?.businessId;
		const restaurantId = await getRestaurantId(businessId);

		if (menuItem.restaurant_id !== restaurantId) {
			return res.status(403).json({ error: "Access denied" });
		}

		res.json(menuItem);
	} catch (error) {
		console.error(`Error in GET /api/menu-items/${req.params.id}:`, error);

		if (error.message === "Menu item not found") {
			return res.status(404).json({ error: error.message });
		}

		if (error.message.includes("No restaurant found")) {
			return res.status(404).json({ error: error.message });
		}

		res.status(500).json({ error: error.message });
	}
});

router.post("/", async (req, res) => {
	try {
		// ✅ FIXED: Look up restaurant_id from business_id
		const businessId = req.userDetails?.businessId;
		const restaurantId = await getRestaurantId(businessId);

		const { name, category, price, toastMenuItemId, isActive } = req.body;

		// Validation
		if (!name || !name.trim()) {
			return res.status(400).json({ error: "Menu item name is required" });
		}

		if (!category || !category.trim()) {
			return res.status(400).json({ error: "Category is required" });
		}

		const menuItem = await createMenuItem(restaurantId, {
			name: name.trim(),
			category: category.trim(),
			price: price !== undefined ? parseFloat(price) : 0,
			toastMenuItemId: toastMenuItemId || null,
			isActive: isActive !== undefined ? isActive : true,
		});

		res.status(201).json(menuItem);
	} catch (error) {
		console.error("Error in POST /api/menu-items:", error);

		if (error.message.includes("No restaurant found")) {
			return res.status(404).json({ error: error.message });
		}

		res.status(500).json({ error: error.message });
	}
});

router.put("/:id", async (req, res) => {
	try {
		const { id } = req.params;

		// ✅ FIXED: First check if menu item exists and belongs to this restaurant
		const businessId = req.userDetails?.businessId;
		const restaurantId = await getRestaurantId(businessId);

		const existing = await getMenuItem(id);
		if (existing.restaurant_id !== restaurantId) {
			return res.status(403).json({ error: "Access denied" });
		}

		const { name, category, price, toastMenuItemId, isActive } = req.body;

		const updates = {};
		if (name !== undefined) updates.name = name.trim();
		if (category !== undefined) updates.category = category.trim();
		if (price !== undefined) updates.price = parseFloat(price);
		if (toastMenuItemId !== undefined)
			updates.toastMenuItemId = toastMenuItemId;
		if (isActive !== undefined) updates.isActive = isActive;

		const menuItem = await updateMenuItem(id, updates);

		res.json(menuItem);
	} catch (error) {
		console.error(`Error in PUT /api/menu-items/${req.params.id}:`, error);

		if (error.message === "Menu item not found") {
			return res.status(404).json({ error: error.message });
		}

		if (error.message.includes("No restaurant found")) {
			return res.status(404).json({ error: error.message });
		}

		res.status(500).json({ error: error.message });
	}
});

router.delete("/:id", async (req, res) => {
	try {
		const { id } = req.params;

		// ✅ FIXED: First check if menu item exists and belongs to this restaurant
		const businessId = req.userDetails?.businessId;
		const restaurantId = await getRestaurantId(businessId);

		const existing = await getMenuItem(id);
		if (existing.restaurant_id !== restaurantId) {
			return res.status(403).json({ error: "Access denied" });
		}

		const menuItem = await deleteMenuItem(id);

		res.json({
			success: true,
			message: "Menu item deleted successfully",
			menuItem: menuItem,
		});
	} catch (error) {
		console.error(`Error in DELETE /api/menu-items/${req.params.id}:`, error);

		if (error.message === "Menu item not found") {
			return res.status(404).json({ error: error.message });
		}

		if (error.message.includes("No restaurant found")) {
			return res.status(404).json({ error: error.message });
		}

		res.status(500).json({ error: error.message });
	}
});

export default router;
