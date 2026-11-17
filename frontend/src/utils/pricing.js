// frontend\src\utils\pricing.js

/**
 * Menu pricing math. Food cost % is what the ingredients cost as a share of
 * the menu price: a $1.80 plate sold at $10.00 runs an 18% food cost.
 */

export const MIN_FOOD_COST = 5;
export const MAX_FOOD_COST = 60;

/**
 * Food cost % for a plate at a given price
 * @param {number} cost - Recipe cost per plate
 * @param {number} price - Menu price
 * @returns {number|null} Percentage, or null when it can't be worked out
 */
export function foodCostPercent(cost, price) {
	if (!Number.isFinite(cost) || !Number.isFinite(price)) return null;
	if (cost <= 0 || price <= 0) return null;

	return (cost / price) * 100;
}

/**
 * Menu price that lands a plate on a food cost %
 * @param {number} cost - Recipe cost per plate
 * @param {number} percent - Target food cost %, e.g. 18
 * @returns {number|null} Price to the cent, or null when it can't be worked out
 */
export function priceForFoodCost(cost, percent) {
	if (!Number.isFinite(cost) || !Number.isFinite(percent)) return null;
	if (cost <= 0 || percent <= 0) return null;

	return Math.round((cost / (percent / 100)) * 100) / 100;
}

/**
 * Round a price up to the next menu-friendly ending
 * @param {number} price - Any price
 * @param {number} ending - Cents to end on: 0.99, 0.49 or 0 (whole dollar)
 * @returns {number|null}
 */
export function roundUpToEnding(price, ending = 0.99) {
	if (!Number.isFinite(price) || price <= 0) return null;

	const cents = Math.round(price * 100);
	const endingCents = Math.round(ending * 100);
	let dollars = Math.floor(cents / 100);

	if (cents % 100 > endingCents) dollars += 1;

	return (dollars * 100 + endingCents) / 100;
}

/**
 * Profit left on a plate after ingredients
 * @param {number} cost - Recipe cost per plate
 * @param {number} price - Menu price
 * @returns {number|null}
 */
export function profitPerPlate(cost, price) {
	if (!Number.isFinite(cost) || !Number.isFinite(price)) return null;

	return Math.round((price - cost) * 100) / 100;
}
