// /backend/src/routes/metrics.js

import express from "express";
import {
	getDashboardMetrics,
	getInventoryMetrics,
	getOrderMetrics,
	getReceivingMetrics,
	getMenuItemsMetrics,
} from "../services/metrics.js";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// GET /api/metrics/dashboard
router.get("/dashboard", async (req, res) => {
	try {
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

		const metrics = await getDashboardMetrics(restaurant_id);
		res.json(metrics);
	} catch (error) {
		console.error("❌ Dashboard metrics error:", error);
		res.status(500).json({ error: error.message });
	}
});

// GET /api/metrics/inventory
router.get("/inventory", async (req, res) => {
	try {
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

		const metrics = await getInventoryMetrics(restaurant_id);
		res.json(metrics);
	} catch (error) {
		console.error("❌ Inventory metrics error:", error);
		res.status(500).json({ error: error.message });
	}
});

// GET /api/metrics/orders
router.get("/orders", async (req, res) => {
	try {
		// Get restaurant_id from authenticated user's business
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

		const metrics = await getOrderMetrics(restaurant_id);
		res.json(metrics);
	} catch (error) {
		console.error("❌ Order metrics error:", error);
		res.status(500).json({ error: error.message });
	}
});

// GET /api/metrics/receiving
router.get("/receiving", async (req, res) => {
	try {
		// Get restaurant_id from authenticated user's business
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

		const metrics = await getReceivingMetrics(restaurant_id);
		res.json(metrics);
	} catch (error) {
		console.error("❌ Receiving metrics error:", error);
		res.status(500).json({ error: error.message });
	}
});

// GET /api/metrics/waste
router.get("/waste", async (req, res) => {
	try {
		// Get restaurant_id from authenticated user's business
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

		// Get period from query params (default to 'week')
		const period = req.query.period || "week";

		// Calculate date range based on period
		const now = new Date();
		let startDate;

		switch (period) {
			case "today":
				startDate = new Date(now.setHours(0, 0, 0, 0));
				break;
			case "week":
				startDate = new Date(now.setDate(now.getDate() - now.getDay()));
				startDate.setHours(0, 0, 0, 0);
				break;
			case "month":
				startDate = new Date(now.getFullYear(), now.getMonth(), 1);
				break;
			default:
				startDate = new Date(now.setDate(now.getDate() - now.getDay()));
				startDate.setHours(0, 0, 0, 0);
		}

		// Get waste data for the period (only actual waste, not reductions)
		const { data: wasteData, error: wasteError } = await supabase
			.from("waste_log")
			.select("cost_value, reason")
			.eq("restaurant_id", restaurant_id)
			.eq("category", "waste")
			.gte("logged_at", startDate.toISOString());

		if (wasteError) throw wasteError;

		// Calculate metrics
		const totalWasteValue = wasteData.reduce(
			(sum, item) => sum + parseFloat(item.cost_value || 0),
			0
		);
		const wasteIncidentCount = wasteData.length;
		const avgWastePerIncident =
			wasteIncidentCount > 0 ? totalWasteValue / wasteIncidentCount : 0;

		// Find top waste reason
		const reasonCounts = {};
		wasteData.forEach((item) => {
			reasonCounts[item.reason] = (reasonCounts[item.reason] || 0) + 1;
		});
		const topWasteReason =
			Object.keys(reasonCounts).length > 0
				? Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0][0]
				: null;

		res.json({
			period,
			totalWasteValue: parseFloat(totalWasteValue.toFixed(2)),
			wasteIncidentCount,
			topWasteReason,
			avgWastePerIncident: parseFloat(avgWastePerIncident.toFixed(2)),
		});
	} catch (error) {
		console.error("Waste metrics error:", error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * ⭐ ADD THIS NEW ROUTE at the end of the file ⭐
 *
 * GET /api/metrics/menu-items
 * Get menu items-specific metrics
 */
router.get("/menu-items", async (req, res) => {
	try {
		// Get restaurant_id from authenticated user's business (same pattern as other routes)
		const businessId = req.userDetails?.businessId || req.businessId;

		if (!businessId) {
			return res.status(400).json({ error: "Business ID not found" });
		}

		const { data: restaurant, error: restaurantError } = await supabase
			.from("restaurants")
			.select("id")
			.eq("business_id", businessId)
			.single();

		if (restaurantError) {
			console.error("Error looking up restaurant:", restaurantError);
			return res.status(500).json({
				error: "Failed to find restaurant for this business",
			});
		}

		if (!restaurant) {
			return res.status(404).json({
				error: "No restaurant found for this business. Please contact support.",
			});
		}

		const restaurantId = restaurant.id;
		const metrics = await getMenuItemsMetrics(restaurantId);

		res.json(metrics);
	} catch (error) {
		console.error("Error in GET /api/metrics/menu-items:", error);
		res.status(500).json({ error: error.message });
	}
});

export default router;
