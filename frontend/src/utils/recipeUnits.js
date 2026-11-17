// frontend\src\utils\recipeUnits.js

/**
 * Units a recipe line can use. A recipe unit has to be the same kind of
 * measure as the unit the ingredient is counted in (weight with weight,
 * volume with volume, count with count), or the app can't convert it and
 * the line is never costed or deducted. Mirrors backend/src/services/units.js.
 */
export const UNIT_OPTIONS = [
	{ value: "oz", label: "oz (ounces)", group: "Weight" },
	{ value: "lbs", label: "lbs (pounds)", group: "Weight" },
	{ value: "g", label: "g (grams)", group: "Weight" },
	{ value: "kg", label: "kg (kilograms)", group: "Weight" },

	{ value: "tsp", label: "tsp (teaspoon)", group: "Volume" },
	{ value: "tbsp", label: "tbsp (tablespoon)", group: "Volume" },
	{ value: "fl oz", label: "fl oz (fluid ounce)", group: "Volume" },
	{ value: "cup", label: "cup", group: "Volume" },
	{ value: "pt", label: "pt (pint)", group: "Volume" },
	{ value: "qt", label: "qt (quart)", group: "Volume" },
	{ value: "gal", label: "gal (gallon)", group: "Volume" },
	{ value: "ml", label: "ml (milliliter)", group: "Volume" },
	{ value: "l", label: "l (liter)", group: "Volume" },

	{ value: "each", label: "each", group: "Count" },
	{ value: "dozen", label: "dozen", group: "Count" },
];

const ALIASES = {
	lb: "lbs",
	pound: "lbs",
	pounds: "lbs",
	ounce: "oz",
	ounces: "oz",
	gram: "g",
	grams: "g",
	ea: "each",
	pc: "each",
	pcs: "each",
	unit: "each",
	units: "each",
	doz: "dozen",
	dz: "dozen",
	cups: "cup",
	gallon: "gal",
	gallons: "gal",
	quart: "qt",
	quarts: "qt",
	pint: "pt",
	pints: "pt",
};

/**
 * Which kind of measure a unit is
 * @param {string} unit - e.g. "lbs", "Each"
 * @returns {"Weight"|"Volume"|"Count"|null}
 */
export function unitGroup(unit) {
	if (typeof unit !== "string") return null;

	const cleaned = unit.trim().toLowerCase();
	const standard = ALIASES[cleaned] || cleaned;

	return UNIT_OPTIONS.find((opt) => opt.value === standard)?.group || null;
}

/**
 * Unit choices for a recipe line, grouped for a <select>
 * @param {string} inventoryUnit - Unit the ingredient is counted in
 * @returns {Object<string, Array<{value: string, label: string}>>} Only the
 *   matching kind when the inventory unit is recognized, otherwise all units
 */
export function unitChoicesFor(inventoryUnit) {
	const group = unitGroup(inventoryUnit);
	const options = group
		? UNIT_OPTIONS.filter((opt) => opt.group === group)
		: UNIT_OPTIONS;

	return options.reduce((acc, option) => {
		if (!acc[option.group]) acc[option.group] = [];
		acc[option.group].push(option);
		return acc;
	}, {});
}
