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

/**
 * Put items in counting order: grouped by location (alphabetical, unplaced
 * last), then by name. Every item gets a number from this full order, so
 * "#14" means the same item on the printed sheet and on the Count screen,
 * whatever is filtered out.
 * @param {Array<object>} items - Inventory rows
 * @returns {Array<{place: string, items: Array<object>}>}
 */
export function orderForCount(items = []) {
	const byLocation = new Map();

	for (const item of items) {
		const place = item.location?.trim() || NO_LOCATION;
		if (!byLocation.has(place)) byLocation.set(place, []);
		byLocation.get(place).push(item);
	}

	const groups = [...byLocation.entries()]
		.sort(([a], [b]) => {
			if (a === NO_LOCATION) return 1;
			if (b === NO_LOCATION) return -1;
			return a.localeCompare(b);
		})
		.map(([place, placeItems]) => ({
			place,
			items: [...placeItems].sort((a, b) =>
				(a.ingredient_name || "").localeCompare(b.ingredient_name || "")
			),
		}));

	let number = 0;
	return groups.map((group) => ({
		...group,
		items: group.items.map((item) => ({ ...item, number: (number += 1) })),
	}));
}

/**
 * Keep only items matching a search, dropping empty groups. Numbers stay.
 * @param {Array<{place: string, items: Array<object>}>} groups
 * @param {string} term
 */
export function filterGroups(groups, term) {
	const wanted = String(term ?? "").trim().toLowerCase();
	if (!wanted) return groups;

	return groups
		.map((group) => ({
			...group,
			items: group.items.filter(
				(item) =>
					String(item.number) === wanted.replace(/^#/, "") ||
					(item.ingredient_name || "").toLowerCase().includes(wanted) ||
					(item.category || "").toLowerCase().includes(wanted) ||
					group.place.toLowerCase().includes(wanted)
			),
		}))
		.filter((group) => group.items.length > 0);
}

/**
 * Today's date the way the owner reads it: MM-DD-YYYY
 * @param {Date} date
 */
export function formatSheetDate(date = new Date()) {
	const pad = (n) => String(n).padStart(2, "0");
	return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${date.getFullYear()}`;
}
