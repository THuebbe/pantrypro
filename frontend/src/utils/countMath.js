// frontend\src\utils\countMath.js

// Numbers for the inventory count screen.

export const COUNT_REASONS = [
	{ value: "cycle_count", label: "Cycle count" },
	{ value: "initial_count", label: "Starting count" },
	{ value: "correction", label: "Correction" },
];

export const NO_LOCATION = "No location set";

export function formatQty(value) {
	const number = Number(value);
	if (!Number.isFinite(number)) return "0";
	return String(Math.round(number * 100) / 100);
}

// Half away from zero, matching the server, so a $6.375 loss shows as
// -$6.38 just as a gain would show +$6.38.
export function round(value, places) {
	const factor = 10 ** places;
	const scaled = Math.abs(value) * factor;
	return (Math.sign(value) * Math.round(scaled + 1e-9)) / factor || 0;
}

export function formatMoney(value) {
	const sign = value < 0 ? "-" : value > 0 ? "+" : "";
	return `${sign}$${Math.abs(value).toFixed(2)}`;
}

/**
 * Work out the difference a count makes for one item
 * @returns {{change: number, value: number|null}|null} null if not counted
 */
export function varianceFor(item, entered) {
	if (entered === undefined || String(entered).trim() === "") return null;

	const counted = Number(entered);
	if (!Number.isFinite(counted) || counted < 0) return null;

	const change = round(counted - (Number(item.quantity) || 0), 4);
	const cost = item.cost_per_unit === null || item.cost_per_unit === undefined
		? null
		: Number(item.cost_per_unit);

	return {
		change,
		value: Number.isFinite(cost) ? round(change * cost, 2) : null,
	};
}
