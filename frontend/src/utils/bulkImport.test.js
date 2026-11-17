// frontend\src\utils\bulkImport.test.js

import { describe, it, expect } from "vitest";
import {
	TEMPLATE_CSV,
	parseDelimited,
	mapHeaders,
	rowsFromText,
} from "./bulkImport";

describe("parseDelimited", () => {
	it("reads CSV with quotes, commas and line breaks inside cells", () => {
		const text = 'name,notes\r\n"Beef, ground","He said ""fresh""\nnext line"\r\nBuns,plain';

		expect(parseDelimited(text)).toEqual([
			["name", "notes"],
			["Beef, ground", 'He said "fresh"\nnext line'],
			["Buns", "plain"],
		]);
	});

	it("reads cells pasted from a spreadsheet (tabs)", () => {
		expect(parseDelimited("name\tqty\nBeef\t10\n")).toEqual([
			["name", "qty"],
			["Beef", "10"],
		]);
	});

	it("ignores a byte-order mark from Excel", () => {
		expect(parseDelimited("\uFEFFname\nBeef")[0]).toEqual(["name"]);
	});
});

describe("mapHeaders", () => {
	it("recognises common header names", () => {
		const { columns, ignored } = mapHeaders([
			"Item Name",
			"UOM",
			"Qty On Hand",
			"Unit Cost ($)",
			"Par Level",
			"Vendor",
		]);

		expect(columns).toEqual({
			name: 0,
			unit: 1,
			quantity: 2,
			costPerUnit: 3,
			minimumQuantity: 4,
		});
		expect(ignored).toEqual(["Vendor"]);
	});
});

describe("rowsFromText", () => {
	it("skips the template's example rows", () => {
		const result = rowsFromText(`${TEMPLATE_CSV}Onions,lbs,10,0.89\r\n`);

		expect(result.error).toBeNull();
		expect(result.examplesSkipped).toBe(2);
		expect(result.rows).toEqual([
			{
				name: "Onions",
				unit: "lbs",
				quantity: "10",
				costPerUnit: "0.89",
				category: "",
				minimumQuantity: "",
				location: "",
				storageType: "",
			},
		]);
	});

	it("cleans up money and thousands in number columns", () => {
		const { rows } = rowsFromText('name,cost,qty\nBeef,"$1,204.50",12 lbs');

		expect(rows[0].costPerUnit).toBe("1204.50");
		expect(rows[0].quantity).toBe("12");
	});

	it("leaves an unreadable number as typed so the server can explain", () => {
		const { rows } = rowsFromText("name,qty\nBeef,about ten");

		expect(rows[0].quantity).toBe("about ten");
	});

	it("drops blank lines", () => {
		const { rows } = rowsFromText("name,unit\n\nBeef,lbs\n,\n");

		expect(rows).toHaveLength(1);
	});

	it("explains a missing name column", () => {
		expect(rowsFromText("qty,unit\n4,lbs").error).toMatch(/"name"/);
	});

	it("explains a template with only the examples filled in", () => {
		expect(rowsFromText(TEMPLATE_CSV).error).toMatch(/Only the example rows/);
	});

	it("says when there's nothing to read", () => {
		expect(rowsFromText("   ").error).toMatch(/nothing/);
	});
});
