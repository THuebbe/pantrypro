// frontend\src\utils\pricing.test.js

import { describe, it, expect } from "vitest";
import {
	foodCostPercent,
	priceForFoodCost,
	roundUpToEnding,
	profitPerPlate,
} from "./pricing";
import { unitGroup, unitChoicesFor } from "./recipeUnits";

describe("pricing", () => {
	it("works out food cost % from cost and price", () => {
		expect(foodCostPercent(1.8, 10)).toBeCloseTo(18);
		expect(foodCostPercent(0.4, 4)).toBeCloseTo(10);
	});

	it("returns null when there is no cost or no price", () => {
		expect(foodCostPercent(0, 10)).toBeNull();
		expect(foodCostPercent(2, 0)).toBeNull();
		expect(foodCostPercent(NaN, 10)).toBeNull();
	});

	it("works out the price for a target food cost %", () => {
		expect(priceForFoodCost(1.8, 18)).toBe(10);
		expect(priceForFoodCost(1.47, 18)).toBe(8.17);
		expect(priceForFoodCost(1.47, 0)).toBeNull();
		expect(priceForFoodCost(0, 18)).toBeNull();
	});

	it("price and food cost % round-trip", () => {
		const price = priceForFoodCost(2.35, 28);
		expect(foodCostPercent(2.35, price)).toBeCloseTo(28, 0);
	});

	it("rounds up to a menu ending, never down", () => {
		expect(roundUpToEnding(8.17, 0.99)).toBe(8.99);
		expect(roundUpToEnding(8.99, 0.99)).toBe(8.99);
		expect(roundUpToEnding(8.17, 0.49)).toBe(8.49);
		expect(roundUpToEnding(8.5, 0.49)).toBe(9.49);
		expect(roundUpToEnding(8.17, 0)).toBe(9);
		expect(roundUpToEnding(8, 0)).toBe(8);
	});

	it("works out profit per plate", () => {
		expect(profitPerPlate(1.47, 8.99)).toBe(7.52);
	});
});

describe("recipe units", () => {
	it("knows what kind of measure a unit is", () => {
		expect(unitGroup("lbs")).toBe("Weight");
		expect(unitGroup("Lb")).toBe("Weight");
		expect(unitGroup("tbsp")).toBe("Volume");
		expect(unitGroup("dozen")).toBe("Count");
		expect(unitGroup("case")).toBeNull();
		expect(unitGroup(null)).toBeNull();
	});

	it("only offers units that convert to the inventory unit", () => {
		const choices = unitChoicesFor("lbs");
		expect(Object.keys(choices)).toEqual(["Weight"]);
		expect(choices.Weight.map((o) => o.value)).toEqual([
			"oz",
			"lbs",
			"g",
			"kg",
		]);
	});

	it("offers every unit when the inventory unit isn't recognized", () => {
		expect(Object.keys(unitChoicesFor("case"))).toEqual([
			"Weight",
			"Volume",
			"Count",
		]);
	});
});
