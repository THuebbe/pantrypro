// /backend/src/services/metrics.js

import { supabase } from "./supabase.js";

/**
 * Get dashboard overview metrics
 * @param {string} restaurantId - Restaurant UUID
 * @returns {Promise<Object>} Dashboard metrics
 */
export async function getDashboardMetrics(restaurantId) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	try {
		// Get all inventory items to check low stock
		// Note: We can't compare two columns directly in Supabase JS, so we fetch and filter
		const { data: allInventory, error: inventoryError } = await supabase
			.from("restaurant_inventory")
			.select("quantity, minimum_quantity")
			.eq("restaurant_id", restaurantId);

		if (inventoryError) throw inventoryError;

		// Filter for low stock in JavaScript
		const lowStockCount =
			allInventory?.filter(
				(item) =>
					parseFloat(item.quantity) <= parseFloat(item.minimum_quantity || 0)
			).length || 0;

		// Get expiring items count (expires within next 7 days)
		const today = new Date();
		const sevenDaysFromNow = new Date();
		sevenDaysFromNow.setDate(today.getDate() + 7);

		const { count: expiringCount, error: expiringError } = await supabase
			.from("restaurant_inventory")
			.select("id", { count: "exact", head: true })
			.eq("restaurant_id", restaurantId)
			.gte("expiration_date", today.toISOString().split("T")[0])
			.lte("expiration_date", sevenDaysFromNow.toISOString().split("T")[0]);

		if (expiringError) throw expiringError;

		// Get open orders count (status = 'draft' OR 'ordered')
		const { count: openOrdersCount, error: ordersError } = await supabase
			.from("purchase_orders")
			.select("id", { count: "exact", head: true })
			.eq("restaurant_id", restaurantId)
			.in("status", ["draft", "ordered"]);

		if (ordersError) throw ordersError;

		// Mock food cost percentage for MVP
		// TODO: Calculate from actual sales data in future
		const weeklyFoodCostPercent = 28.5;

		return {
			lowStockCount: lowStockCount,
			expiringItemsCount: expiringCount || 0,
			openOrdersCount: openOrdersCount || 0,
			weeklyFoodCostPercent,
		};
	} catch (error) {
		console.error("Error getting dashboard metrics:", error);
		throw new Error(`Failed to get dashboard metrics: ${error.message}`);
	}
}

/**
 * Get inventory-specific metrics
 * @param {string} restaurantId - Restaurant UUID
 * @returns {Promise<Object>} Inventory metrics
 */
export async function getInventoryMetrics(restaurantId) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	try {
		// Get all inventory to check below reorder point
		// Note: We can't compare two columns directly in Supabase JS, so we fetch and filter
		const { data: allInventory, error: inventoryError } = await supabase
			.from("restaurant_inventory")
			.select("quantity, minimum_quantity")
			.eq("restaurant_id", restaurantId);

		if (inventoryError) throw inventoryError;

		// Filter for below reorder in JavaScript
		const belowReorderCount =
			allInventory?.filter(
				(item) =>
					parseFloat(item.quantity) <= parseFloat(item.minimum_quantity || 0)
			).length || 0;

		// Get expiring this week (next 7 days)
		const today = new Date();
		const sevenDaysFromNow = new Date();
		sevenDaysFromNow.setDate(today.getDate() + 7);

		const { count: expiringThisWeek, error: expiringError } = await supabase
			.from("restaurant_inventory")
			.select("id", { count: "exact", head: true })
			.eq("restaurant_id", restaurantId)
			.gte("expiration_date", today.toISOString().split("T")[0])
			.lte("expiration_date", sevenDaysFromNow.toISOString().split("T")[0]);

		if (expiringError) throw expiringError;

		// Get top used ingredient
		// For MVP, we'll query the ingredient that appears most in inventory
		// TODO: Track actual usage data in future
		const { data: ingredients, error: ingredientsError } = await supabase
			.from("restaurant_inventory")
			.select(
				`
        ingredient_id,
        ingredient_library!inner(name)
      `
			)
			.eq("restaurant_id", restaurantId)
			.limit(100); // Reasonable limit for analysis

		if (ingredientsError) throw ingredientsError;

		// Count occurrences and find most common
		let topUsedIngredient = "Chicken Breast"; // Default fallback
		if (ingredients && ingredients.length > 0) {
			const ingredientCounts = {};
			ingredients.forEach((item) => {
				const name = item.ingredient_library?.name;
				if (name) {
					ingredientCounts[name] = (ingredientCounts[name] || 0) + 1;
				}
			});

			const sortedIngredients = Object.entries(ingredientCounts).sort(
				(a, b) => b[1] - a[1]
			);
			if (sortedIngredients.length > 0) {
				topUsedIngredient = sortedIngredients[0][0];
			}
		}

		// Mock inventory turnover rate for MVP
		// TODO: Calculate from actual usage data: (Cost of Goods Used / Average Inventory Value)
		const inventoryTurnoverRate = 2.3;

		return {
			belowReorderCount: belowReorderCount,
			expiringThisWeek: expiringThisWeek || 0,
			topUsedIngredient,
			inventoryTurnoverRate,
		};
	} catch (error) {
		console.error("Error getting inventory metrics:", error);
		throw new Error(`Failed to get inventory metrics: ${error.message}`);
	}
}

/**
 * Get order-specific metrics (Phase 2)
 * @param {string} restaurantId - Restaurant UUID
 * @returns {Promise<Object>} Order metrics
 */
export async function getOrderMetrics(restaurantId) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	try {
		// Get all pending orders (status = 'draft' or 'ordered')
		const { data: pendingOrders, error: pendingError } = await supabase
			.from("purchase_orders")
			.select("total")
			.eq("restaurant_id", restaurantId)
			.in("status", ["draft", "ordered"]);

		if (pendingError) throw pendingError;

		// Calculate total pending value
		const pendingOrdersValue =
			pendingOrders?.reduce(
				(sum, order) => sum + parseFloat(order.total || 0),
				0
			) || 0;

		// Get overdue deliveries (status = 'ordered' AND expected_delivery_date < today)
		const today = new Date().toISOString().split("T")[0];

		const { count: overdueCount, error: overdueError } = await supabase
			.from("purchase_orders")
			.select("id", { count: "exact", head: true })
			.eq("restaurant_id", restaurantId)
			.eq("status", "ordered")
			.lt("expected_delivery_date", today);

		if (overdueError) throw overdueError;

		// Get top supplier (most frequent supplier this month)
		const firstDayOfMonth = new Date();
		firstDayOfMonth.setDate(1);
		firstDayOfMonth.setHours(0, 0, 0, 0);

		const { data: ordersThisMonth, error: ordersError } = await supabase
			.from("purchase_orders")
			.select("supplier_name")
			.eq("restaurant_id", restaurantId)
			.gte("order_date", firstDayOfMonth.toISOString());

		if (ordersError) throw ordersError;

		// Count supplier occurrences
		let topSupplierName = "Sysco"; // Default fallback
		if (ordersThisMonth && ordersThisMonth.length > 0) {
			const supplierCounts = {};
			ordersThisMonth.forEach((order) => {
				const name = order.supplier_name;
				if (name) {
					supplierCounts[name] = (supplierCounts[name] || 0) + 1;
				}
			});

			const sortedSuppliers = Object.entries(supplierCounts).sort(
				(a, b) => b[1] - a[1]
			);
			if (sortedSuppliers.length > 0) {
				topSupplierName = sortedSuppliers[0][0];
			}
		}

		// Calculate average fulfillment days for completed orders
		const { data: completedOrders, error: completedError } = await supabase
			.from("purchase_orders")
			.select("order_date, actual_delivery_date")
			.eq("restaurant_id", restaurantId)
			.not("actual_delivery_date", "is", null)
			.limit(50); // Last 50 completed orders

		if (completedError) throw completedError;

		let avgFulfillmentDays = 3; // Default fallback
		if (completedOrders && completedOrders.length > 0) {
			const totalDays = completedOrders.reduce((sum, order) => {
				const orderDate = new Date(order.order_date);
				const deliveryDate = new Date(order.actual_delivery_date);
				const days = Math.floor(
					(deliveryDate - orderDate) / (1000 * 60 * 60 * 24)
				);
				return sum + (days > 0 ? days : 0);
			}, 0);
			avgFulfillmentDays = Math.round(totalDays / completedOrders.length);
		}

		return {
			pendingOrdersValue: parseFloat(pendingOrdersValue.toFixed(2)),
			overdueDeliveriesCount: overdueCount || 0,
			topSupplierName,
			avgFulfillmentDays,
		};
	} catch (error) {
		console.error("Error getting order metrics:", error);
		throw new Error(`Failed to get order metrics: ${error.message}`);
	}
}

/**
 * Get receiving-specific metrics (Phase 2)
 * @param {string} restaurantId - Restaurant UUID
 * @returns {Promise<Object>} Receiving metrics
 */
export async function getReceivingMetrics(restaurantId) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	try {
		// Get pending shipments (status = 'ordered')
		const { count: pendingShipmentsCount, error: pendingError } = await supabase
			.from("purchase_orders")
			.select("id", { count: "exact", head: true })
			.eq("restaurant_id", restaurantId)
			.eq("status", "ordered");

		if (pendingError) throw pendingError;

		// Get received today (actual_delivery_date = today)
		const today = new Date().toISOString().split("T")[0];

		const { count: receivedTodayCount, error: todayError } = await supabase
			.from("purchase_orders")
			.select("id", { count: "exact", head: true })
			.eq("restaurant_id", restaurantId)
			.eq("actual_delivery_date", today);

		if (todayError) throw todayError;

		// Quality issues count - Mock for MVP
		// TODO: Implement quality tracking feature in future
		const qualityIssuesCount = 1;

		// Calculate on-time delivery percentage
		const { data: recentOrders, error: recentError } = await supabase
			.from("purchase_orders")
			.select("expected_delivery_date, actual_delivery_date")
			.eq("restaurant_id", restaurantId)
			.not("actual_delivery_date", "is", null)
			.limit(50); // Last 50 delivered orders

		if (recentError) throw recentError;

		let onTimeDeliveryPercent = 87; // Default fallback
		if (recentOrders && recentOrders.length > 0) {
			const onTimeCount = recentOrders.filter((order) => {
				const expected = new Date(order.expected_delivery_date);
				const actual = new Date(order.actual_delivery_date);
				return actual <= expected; // On time or early
			}).length;
			onTimeDeliveryPercent = Math.round(
				(onTimeCount / recentOrders.length) * 100
			);
		}

		return {
			pendingShipmentsCount: pendingShipmentsCount || 0,
			receivedTodayCount: receivedTodayCount || 0,
			qualityIssuesCount,
			onTimeDeliveryPercent,
		};
	} catch (error) {
		console.error("Error getting receiving metrics:", error);
		throw new Error(`Failed to get receiving metrics: ${error.message}`);
	}
}

/**
 * Get menu items-specific metrics
 * @param {string} restaurantId - Restaurant UUID
 * @returns {Promise<Object>} Menu items metrics
 */
export async function getMenuItemsMetrics(restaurantId) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	try {
		// 1. Get total active menu items count
		const { count: totalMenuItems, error: countError } = await supabase
			.from("menu_items")
			.select("id", { count: "exact", head: true })
			.eq("restaurant_id", restaurantId)
			.eq("is_active", true);

		if (countError) throw countError;

		// 2. Get all menu items with recipes to calculate metrics
		const { data: menuItems, error: menuItemsError } = await supabase
			.from("menu_items")
			.select(
				`
        id,
        name,
        price,
        recipe_ingredients (
          id,
          quantity,
          unit,
          prep_loss_factor,
          ingredient_library (
            id,
            name
          )
        )
      `
			)
			.eq("restaurant_id", restaurantId)
			.eq("is_active", true);

		if (menuItemsError) throw menuItemsError;

		// 3. Count items without recipes
		const itemsWithoutRecipes =
			menuItems?.filter(
				(item) =>
					!item.recipe_ingredients || item.recipe_ingredients.length === 0
			).length || 0;

		// 4. Calculate average menu price
		let avgMenuPrice = 0;
		if (menuItems && menuItems.length > 0) {
			const totalPrice = menuItems.reduce(
				(sum, item) => sum + parseFloat(item.price || 0),
				0
			);
			avgMenuPrice = totalPrice / menuItems.length;
		}

		// 5. Calculate average recipe cost and food cost percentage
		const { data: inventory, error: inventoryError } = await supabase
			.from("restaurant_inventory")
			.select("ingredient_id, cost_per_unit")
			.eq("restaurant_id", restaurantId);

		if (inventoryError) throw inventoryError;

		// Create a map of ingredient costs
		const ingredientCosts = {};
		inventory?.forEach((item) => {
			ingredientCosts[item.ingredient_id] = parseFloat(item.cost_per_unit || 0);
		});

		let totalRecipeCost = 0;
		let itemsWithRecipes = 0;
		let worstFoodCostItem = null;
		let worstFoodCostPercent = 0;
		let highestPricedItem = "N/A";
		let highestPrice = 0;

		menuItems?.forEach((item) => {
			if (item.recipe_ingredients && item.recipe_ingredients.length > 0) {
				// Calculate recipe cost for this item
				let recipeCost = 0;

				item.recipe_ingredients.forEach((ingredient) => {
					const ingredientId = ingredient.ingredient_library?.id;
					const costPerUnit = ingredientCosts[ingredientId] || 0;
					const quantity = parseFloat(ingredient.quantity || 0);
					const prepLoss = parseFloat(ingredient.prep_loss_factor || 0);

					// Convert to pounds if needed
					let quantityInPounds = quantity;
					if (ingredient.unit === "oz") {
						quantityInPounds = quantity / 16;
					}

					// Apply prep loss
					const adjustedQuantity = quantityInPounds * (1 + prepLoss / 100);

					recipeCost += adjustedQuantity * costPerUnit;
				});

				totalRecipeCost += recipeCost;
				itemsWithRecipes++;

				// Track worst food cost percentage
				const menuPrice = parseFloat(item.price || 0);
				if (menuPrice > 0) {
					const foodCostPercent = (recipeCost / menuPrice) * 100;
					if (foodCostPercent > worstFoodCostPercent) {
						worstFoodCostPercent = foodCostPercent;
						worstFoodCostItem = item.name;
					}
				}
			}

			// Find highest priced item
			if (parseFloat(item.price || 0) > highestPrice) {
				highestPrice = parseFloat(item.price || 0);
				highestPricedItem = `${item.name} ($${highestPrice.toFixed(2)})`;
			}
		});

		// Calculate average recipe cost
		const avgRecipeCost =
			itemsWithRecipes > 0 ? totalRecipeCost / itemsWithRecipes : 0;

		// Calculate average food cost percentage
		const avgFoodCostPercent =
			avgMenuPrice > 0 ? (avgRecipeCost / avgMenuPrice) * 100 : 0;

		return {
			totalMenuItems: totalMenuItems || 0,
			itemsWithoutRecipes: itemsWithoutRecipes,
			avgMenuPrice: parseFloat(avgMenuPrice.toFixed(2)),
			avgRecipeCost: parseFloat(avgRecipeCost.toFixed(2)),
			avgFoodCostPercent: parseFloat(avgFoodCostPercent.toFixed(1)),
			worstFoodCostItem: worstFoodCostItem || "N/A",
			highestPricedItem: highestPricedItem,
		};
	} catch (error) {
		console.error("Error getting menu items metrics:", error);
		throw new Error(`Failed to get menu items metrics: ${error.message}`);
	}
}
