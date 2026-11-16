// /backend/src/services/units.js

/**
 * Unit conversion
 *
 * A recipe line can be written in one unit (6 oz of chicken) while the
 * inventory item is counted in another (lbs). Anything that moves stock or
 * costs a recipe converts through here first, so 6 oz comes off as
 * 0.375 lbs and not as 6 lbs.
 *
 * Units convert only within one kind of measure: weight to weight, volume
 * to volume, count to count. A cup of flour cannot become pounds without
 * knowing the ingredient's density, so that returns null and the caller
 * decides what to do.
 */

// Factor = how many base units (grams, millilitres, each) one unit holds
const UNITS = {
	// Weight, base: gram
	g: { kind: "weight", factor: 1 },
	kg: { kind: "weight", factor: 1000 },
	oz: { kind: "weight", factor: 28.349523125 },
	lbs: { kind: "weight", factor: 453.59237 },

	// Volume, base: millilitre (US customary)
	ml: { kind: "volume", factor: 1 },
	l: { kind: "volume", factor: 1000 },
	tsp: { kind: "volume", factor: 4.92892159375 },
	tbsp: { kind: "volume", factor: 14.78676478125 },
	"fl oz": { kind: "volume", factor: 29.5735295625 },
	cup: { kind: "volume", factor: 236.5882365 },
	pt: { kind: "volume", factor: 473.176473 },
	qt: { kind: "volume", factor: 946.352946 },
	gal: { kind: "volume", factor: 3785.411784 },

	// Count, base: each
	each: { kind: "count", factor: 1 },
	dozen: { kind: "count", factor: 12 },
};

const ALIASES = {
	gram: "g",
	grams: "g",
	kilogram: "kg",
	kilograms: "kg",
	kgs: "kg",
	ounce: "oz",
	ounces: "oz",
	lb: "lbs",
	pound: "lbs",
	pounds: "lbs",
	milliliter: "ml",
	milliliters: "ml",
	millilitre: "ml",
	millilitres: "ml",
	liter: "l",
	liters: "l",
	litre: "l",
	litres: "l",
	teaspoon: "tsp",
	teaspoons: "tsp",
	tablespoon: "tbsp",
	tablespoons: "tbsp",
	floz: "fl oz",
	"fl. oz": "fl oz",
	"fl. oz.": "fl oz",
	"fluid ounce": "fl oz",
	"fluid ounces": "fl oz",
	cups: "cup",
	pint: "pt",
	pints: "pt",
	quart: "qt",
	quarts: "qt",
	gallon: "gal",
	gallons: "gal",
	ea: "each",
	piece: "each",
	pieces: "each",
	pc: "each",
	pcs: "each",
	unit: "each",
	units: "each",
	doz: "dozen",
	dz: "dozen",
};

/**
 * Every unit the app understands, in display order
 */
export const KNOWN_UNITS = Object.keys(UNITS);

/**
 * Turn a unit as typed into its standard spelling
 * @param {string} unit - e.g. "Lb", "pounds", "fl. oz"
 * @returns {string|null} Standard unit, or null if not recognized
 */
export function normalizeUnit(unit) {
	if (typeof unit !== "string") return null;

	const cleaned = unit.trim().toLowerCase().replace(/\s+/g, " ");

	if (UNITS[cleaned]) return cleaned;
	if (ALIASES[cleaned]) return ALIASES[cleaned];

	return null;
}

/**
 * Units that can be converted to and from the given unit
 * @param {string} unit - Any recognized unit
 * @returns {string[]} Units of the same kind (weight, volume or count)
 */
export function compatibleUnits(unit) {
	const normalized = normalizeUnit(unit);
	if (!normalized) return [];

	const kind = UNITS[normalized].kind;

	return KNOWN_UNITS.filter((candidate) => UNITS[candidate].kind === kind);
}

/**
 * Convert a quantity from one unit to another
 * @param {number|string} quantity - Amount in the source unit
 * @param {string} fromUnit - Source unit
 * @param {string} toUnit - Target unit
 * @returns {number|null} Amount in the target unit, or null when the units
 *   are unknown or measure different things
 */
export function convertQuantity(quantity, fromUnit, toUnit) {
	const amount = typeof quantity === "number" ? quantity : parseFloat(quantity);
	if (!Number.isFinite(amount)) return null;

	const from = normalizeUnit(fromUnit);
	const to = normalizeUnit(toUnit);
	if (!from || !to) return null;

	if (from === to) return amount;

	if (UNITS[from].kind !== UNITS[to].kind) return null;

	return (amount * UNITS[from].factor) / UNITS[to].factor;
}

/**
 * Describe a unit's kind and size relative to its base unit
 * @param {string} unit - Any recognized unit
 * @returns {{unit: string, kind: string, factor: number}|null}
 */
export function describeUnit(unit) {
	const normalized = normalizeUnit(unit);
	if (!normalized) return null;

	return { unit: normalized, ...UNITS[normalized] };
}
