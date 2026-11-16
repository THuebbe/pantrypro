// /backend/src/services/inventoryDeductionService.js

/**
 * Inventory Deduction Service
 *
 * Handles automatic inventory deduction when sales occur.
 * Uses recipe ingredients to calculate how much of each ingredient
 * should be deducted for each menu item sold.
 */

import { supabase } from "./supabase.js";
import { deductIngredient } from "./inventory.js";

/**
 * Deduct inventory for a single sale
 * @param {string} restaurantId - Restaurant UUID
 * @param {string} saleId - pos_sales UUID
 * @returns {Promise<Object>} Deduction results
 */
export async function deductInventoryForSale(restaurantId, saleId) {
	if (!restaurantId || !saleId) {
		throw new Error("Restaurant ID and Sale ID are required");
	}

	try {
		// Get the sale with its line items
		const { data: sale, error: saleError } = await supabase
			.from("pos_sales")
			.select(`
				*,
				pos_sales_items (
					id,
					menu_item_id,
					pos_menu_item_id,
					name,
					quantity
				)
			`)
			.eq("id", saleId)
			.eq("restaurant_id", restaurantId)
			.single();

		if (saleError) throw saleError;

		// Skip if already deducted or voided
		if (sale.inventory_deducted) {
			return { success: true, message: "Already deducted", deductions: [] };
		}
		if (sale.voided) {
			return { success: true, message: "Skipped voided sale", deductions: [] };
		}

		const deductions = [];
		const warnings = [];

		// Process each line item
		for (const lineItem of sale.pos_sales_items || []) {
			if (!lineItem.menu_item_id) {
				warnings.push({
					item: lineItem.name,
					warning: "No matching menu item - cannot deduct ingredients",
				});
				continue;
			}

			// Get recipe ingredients for this menu item
			const { data: recipeIngredients, error: recipeError } = await supabase
				.from("recipe_ingredients")
				.select(`
					*,
					ingredient_library (
						id,
						name,
						unit
					)
				`)
				.eq("menu_item_id", lineItem.menu_item_id);

			if (recipeError) {
				console.error(`Error fetching recipe for ${lineItem.name}:`, recipeError);
				warnings.push({
					item: lineItem.name,
					warning: `Failed to fetch recipe: ${recipeError.message}`,
				});
				continue;
			}

			if (!recipeIngredients || recipeIngredients.length === 0) {
				warnings.push({
					item: lineItem.name,
					warning: "No recipe defined - cannot deduct ingredients",
				});
				continue;
			}

			// Deduct each ingredient based on recipe and quantity sold
			for (const recipe of recipeIngredients) {
				const quantitySold = lineItem.quantity || 1;
				const recipeQty = parseFloat(recipe.quantity) || 0;
				const prepLossFactor = parseFloat(recipe.prep_loss_factor || 0);
				// Prep loss is stored as a percentage (5 means 5%).
				const totalDeduction =
					recipeQty * quantitySold * (1 + prepLossFactor / 100);

				if (totalDeduction <= 0) continue;

				try {
					const result = await deductIngredient(
						restaurantId,
						recipe.ingredient_id,
						totalDeduction,
						recipe.unit || recipe.ingredient_library?.unit
					);

					// Log the deduction
					const { data: deductionLog, error: logError } = await supabase
						.from("inventory_deductions")
						.insert({
							restaurant_id: restaurantId,
							pos_sale_id: saleId,
							pos_sales_item_id: lineItem.id,
							menu_item_id: lineItem.menu_item_id,
							ingredient_id: recipe.ingredient_id,
							inventory_id: result.inventoryId,
							// Logged in the inventory item's unit so a reversal
							// puts back exactly what was taken out.
							quantity_deducted: result.deductedQuantity,
							unit:
								result.inventoryUnit ||
								recipe.unit ||
								recipe.ingredient_library?.unit,
							reason: "sale",
							deducted_at: new Date().toISOString(),
						})
						.select()
						.single();

					if (logError) {
						console.error("Error logging deduction:", logError);
					}

					deductions.push({
						ingredientId: recipe.ingredient_id,
						ingredientName: recipe.ingredient_library?.name || "Unknown",
						menuItem: lineItem.name,
						quantityDeducted: result.deductedQuantity,
						unit:
							result.inventoryUnit ||
							recipe.unit ||
							recipe.ingredient_library?.unit,
						previousQuantity: result.previousQuantity,
						newQuantity: result.newQuantity,
						wentNegative: result.wentNegative,
					});

					if (result.wentNegative) {
						warnings.push({
							item: recipe.ingredient_library?.name || "Unknown",
							warning: `Inventory went to zero (would need ${Math.abs(
								result.previousQuantity - result.deductedQuantity
							).toFixed(2)} more)`,
						});
					}
				} catch (deductError) {
					console.error(
						`Error deducting ${recipe.ingredient_library?.name}:`,
						deductError
					);
					warnings.push({
						item: recipe.ingredient_library?.name || "Unknown",
						warning: `Deduction failed: ${deductError.message}`,
					});
				}
			}
		}

		// Mark sale as deducted
		await supabase
			.from("pos_sales")
			.update({
				inventory_deducted: true,
				updated_at: new Date().toISOString(),
			})
			.eq("id", saleId);

		return {
			success: true,
			saleId,
			deductions,
			warnings,
			stats: {
				ingredientsDeducted: deductions.length,
				warningCount: warnings.length,
			},
		};
	} catch (error) {
		console.error("Error deducting inventory for sale:", error);
		throw new Error(`Failed to deduct inventory: ${error.message}`);
	}
}

/**
 * Process all undeducted sales for a restaurant
 * @param {string} restaurantId - Restaurant UUID
 * @returns {Promise<Object>} Processing results
 */
export async function processUndeductedSales(restaurantId) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	try {
		// Get all undeducted, non-voided, closed sales
		const { data: sales, error } = await supabase
			.from("pos_sales")
			.select("id")
			.eq("restaurant_id", restaurantId)
			.eq("inventory_deducted", false)
			.eq("voided", false)
			.eq("status", "closed")
			.order("order_date", { ascending: true });

		if (error) throw error;

		if (!sales || sales.length === 0) {
			return {
				success: true,
				message: "No undeducted sales to process",
				processed: 0,
			};
		}

		const results = {
			processed: 0,
			succeeded: 0,
			failed: 0,
			totalDeductions: 0,
			totalWarnings: 0,
			errors: [],
		};

		for (const sale of sales) {
			try {
				const result = await deductInventoryForSale(restaurantId, sale.id);
				results.processed++;
				results.succeeded++;
				results.totalDeductions += result.deductions?.length || 0;
				results.totalWarnings += result.warnings?.length || 0;
			} catch (error) {
				results.processed++;
				results.failed++;
				results.errors.push({
					saleId: sale.id,
					error: error.message,
				});
			}
		}

		return {
			success: true,
			...results,
		};
	} catch (error) {
		console.error("Error processing undeducted sales:", error);
		throw new Error(`Failed to process sales: ${error.message}`);
	}
}

/**
 * Reverse deductions for a sale (e.g., voided order)
 * @param {string} restaurantId - Restaurant UUID
 * @param {string} saleId - pos_sales UUID
 * @param {string} userId - User performing the reversal
 * @returns {Promise<Object>} Reversal results
 */
export async function reverseDeductionsForSale(restaurantId, saleId, userId) {
	if (!restaurantId || !saleId) {
		throw new Error("Restaurant ID and Sale ID are required");
	}

	try {
		// Get all deductions for this sale that haven't been reversed
		const { data: deductions, error: fetchError } = await supabase
			.from("inventory_deductions")
			.select("*")
			.eq("pos_sale_id", saleId)
			.eq("restaurant_id", restaurantId)
			.eq("reversed", false);

		if (fetchError) throw fetchError;

		if (!deductions || deductions.length === 0) {
			return { success: true, message: "No deductions to reverse", reversed: 0 };
		}

		let reversed = 0;
		const now = new Date().toISOString();

		for (const deduction of deductions) {
			// Add the quantity back to inventory
			const { data: inventory, error: invError } = await supabase
				.from("restaurant_inventory")
				.select("quantity")
				.eq("restaurant_id", restaurantId)
				.eq("ingredient_id", deduction.ingredient_id)
				.single();

			if (!invError && inventory) {
				const newQuantity = parseFloat(inventory.quantity) + parseFloat(deduction.quantity_deducted);

				await supabase
					.from("restaurant_inventory")
					.update({
						quantity: newQuantity,
						updated_at: now,
					})
					.eq("restaurant_id", restaurantId)
					.eq("ingredient_id", deduction.ingredient_id);
			}

			// Mark deduction as reversed
			await supabase
				.from("inventory_deductions")
				.update({
					reversed: true,
					reversed_at: now,
					reversed_by: userId || null,
				})
				.eq("id", deduction.id);

			reversed++;
		}

		// Mark sale as not deducted
		await supabase
			.from("pos_sales")
			.update({
				inventory_deducted: false,
				updated_at: now,
			})
			.eq("id", saleId);

		return {
			success: true,
			reversed,
			message: `Reversed ${reversed} deductions`,
		};
	} catch (error) {
		console.error("Error reversing deductions:", error);
		throw new Error(`Failed to reverse deductions: ${error.message}`);
	}
}

/**
 * Get deduction history for a restaurant
 * @param {string} restaurantId - Restaurant UUID
 * @param {object} filters - Query filters
 * @returns {Promise<Array>} Deduction records
 */
export async function getDeductionHistory(restaurantId, filters = {}) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	let query = supabase
		.from("inventory_deductions")
		.select(`
			*,
			ingredient_library:ingredient_id (
				name,
				category,
				unit
			),
			menu_items:menu_item_id (
				name,
				category
			)
		`)
		.eq("restaurant_id", restaurantId)
		.order("deducted_at", { ascending: false });

	if (filters.startDate) {
		query = query.gte("deducted_at", filters.startDate);
	}
	if (filters.endDate) {
		query = query.lte("deducted_at", filters.endDate);
	}
	if (filters.ingredientId) {
		query = query.eq("ingredient_id", filters.ingredientId);
	}
	if (filters.limit) {
		query = query.limit(filters.limit);
	} else {
		query = query.limit(100);
	}

	const { data, error } = await query;

	if (error) throw error;

	return data || [];
}

/**
 * Get deduction summary grouped by ingredient
 * @param {string} restaurantId - Restaurant UUID
 * @param {object} options - Query options
 * @returns {Promise<Array>} Aggregated deductions per ingredient
 */
export async function getDeductionSummary(restaurantId, options = {}) {
	if (!restaurantId) {
		throw new Error("Restaurant ID is required");
	}

	const { startDate, endDate } = options;
	const today = new Date().toISOString().split("T")[0];

	let query = supabase
		.from("inventory_deductions")
		.select(`
			ingredient_id,
			quantity_deducted,
			unit,
			ingredient_library:ingredient_id (
				name,
				category
			)
		`)
		.eq("restaurant_id", restaurantId)
		.eq("reversed", false);

	if (startDate) {
		query = query.gte("deducted_at", startDate);
	}
	if (endDate) {
		query = query.lte("deducted_at", endDate);
	}

	const { data, error } = await query;

	if (error) throw error;

	// Aggregate by ingredient
	const summary = {};
	for (const row of data || []) {
		const key = row.ingredient_id;
		if (!summary[key]) {
			summary[key] = {
				ingredientId: row.ingredient_id,
				ingredientName: row.ingredient_library?.name || "Unknown",
				category: row.ingredient_library?.category || "Uncategorized",
				totalDeducted: 0,
				unit: row.unit,
				deductionCount: 0,
			};
		}
		summary[key].totalDeducted += parseFloat(row.quantity_deducted);
		summary[key].deductionCount++;
	}

	return Object.values(summary).sort((a, b) => b.totalDeducted - a.totalDeducted);
}
