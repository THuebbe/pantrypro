// frontend\src\pages\CountSheet.test.jsx

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CountSheet from "./CountSheet";
import api from "../core/database/api";
import { orderForCount, filterGroups, formatSheetDate } from "../utils/countMath";

vi.mock("../core/database/api", () => ({ default: { get: vi.fn() } }));

const ITEMS = [
	{ id: "a", ingredient_name: "Salt", quantity: 2, unit: "lbs", location: null },
	{ id: "b", ingredient_name: "Ground Beef", quantity: 10, unit: "lbs", location: "Walk-in" },
	{ id: "c", ingredient_name: "Hot Dog Buns", quantity: 3, unit: "dozen", location: "Dry storage" },
	{ id: "d", ingredient_name: "Bacon", quantity: 4.5, unit: "lbs", location: "Walk-in" },
];

function renderSheet() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={client}>
			<CountSheet />
		</QueryClientProvider>
	);
}

describe("counting order", () => {
	it("groups by location, unplaced last, names A-Z, numbered through", () => {
		const groups = orderForCount(ITEMS);

		expect(groups.map((g) => g.place)).toEqual(["Dry storage", "Walk-in", "No location set"]);
		expect(groups.flatMap((g) => g.items.map((i) => `${i.number} ${i.ingredient_name}`))).toEqual([
			"1 Hot Dog Buns",
			"2 Bacon",
			"3 Ground Beef",
			"4 Salt",
		]);
	});

	it("keeps numbers when searching, including by #number", () => {
		const groups = orderForCount(ITEMS);

		expect(filterGroups(groups, "beef")[0].items[0].number).toBe(3);
		expect(filterGroups(groups, "#4")[0].items[0].ingredient_name).toBe("Salt");
		expect(filterGroups(groups, "walk-in")[0].items).toHaveLength(2);
		expect(filterGroups(groups, "")).toBe(groups);
	});

	it("dates the sheet MM-DD-YYYY", () => {
		expect(formatSheetDate(new Date(2026, 10, 7))).toBe("11-07-2026");
	});
});

describe("CountSheet", () => {
	beforeEach(() => {
		api.get.mockResolvedValue({ data: { restaurantName: "Mr. Bill's Dog House", items: ITEMS } });
	});

	it("prints a blind sheet by default", async () => {
		renderSheet();

		expect(await screen.findByText("Walk-in")).toBeInTheDocument();
		expect(screen.getAllByText("Mr. Bill's Dog House").length).toBe(3);
		expect(screen.getByText("Ground Beef")).toBeInTheDocument();
		expect(screen.queryByText("Expected")).not.toBeInTheDocument();
		expect(screen.queryByText("4.5")).not.toBeInTheDocument();
	});

	it("can show expected quantities, with a warning", async () => {
		const user = userEvent.setup();
		renderSheet();

		await user.click(await screen.findByLabelText("Show expected quantities"));

		expect(screen.getAllByText("Expected")).toHaveLength(3);
		expect(screen.getByText("4.5")).toBeInTheDocument();
		expect(screen.getByText(/tend to write the printed number/)).toBeInTheDocument();
	});

	it("leaves out unticked locations", async () => {
		const user = userEvent.setup();
		renderSheet();

		await user.click(await screen.findByLabelText("Walk-in (2)"));

		expect(screen.queryByText("Ground Beef")).not.toBeInTheDocument();
		expect(screen.getByText(/2 items in 2 locations/)).toBeInTheDocument();
	});

	it("prints when asked", async () => {
		const print = vi.spyOn(window, "print").mockImplementation(() => {});
		const user = userEvent.setup();
		renderSheet();

		await user.click(await screen.findByRole("button", { name: "Print" }));

		expect(print).toHaveBeenCalled();
	});
});
