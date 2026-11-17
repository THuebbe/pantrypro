// frontend\src\components\inventory\CountInventory.test.jsx

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CountInventory from "./CountInventory";
import { varianceFor } from "../../utils/countMath";

const mutateAsync = vi.fn();

vi.mock("../../hooks/useBulkInventory", () => ({
	useSaveCount: () => ({ mutateAsync, isPending: false }),
}));

const INVENTORY = [
	{ id: "inv-beef", ingredient_name: "Ground Beef", quantity: 10, unit: "lbs", cost_per_unit: 4.25, location: "Walk-in" },
	{ id: "inv-buns", ingredient_name: "Hot Dog Buns", quantity: 3, unit: "dozen", cost_per_unit: 2, location: "Dry storage" },
	{ id: "inv-salt", ingredient_name: "Salt", quantity: 2, unit: "lbs", cost_per_unit: null, location: null },
];

describe("varianceFor", () => {
	it("is null until something is entered", () => {
		expect(varianceFor(INVENTORY[0], "")).toBeNull();
		expect(varianceFor(INVENTORY[0], undefined)).toBeNull();
		expect(varianceFor(INVENTORY[0], "-1")).toBeNull();
		expect(varianceFor(INVENTORY[0], "lots")).toBeNull();
	});

	it("works out the change and its value", () => {
		expect(varianceFor(INVENTORY[0], "8.5")).toEqual({ change: -1.5, value: -6.38 });
		expect(varianceFor(INVENTORY[2], "3")).toEqual({ change: 1, value: null });
		expect(varianceFor(INVENTORY[1], "3")).toEqual({ change: 0, value: 0 });
	});
});

describe("CountInventory", () => {
	beforeEach(() => {
		mutateAsync.mockReset();
	});

	it("groups items by location, with unplaced items last", () => {
		render(<CountInventory inventory={INVENTORY} onDone={vi.fn()} />);

		const headings = screen.getAllByRole("heading").map((h) => h.textContent);
		expect(headings).toEqual(["Dry storage", "Walk-in", "No location set"]);
	});

	it("shows the difference as you type and only saves counted items", async () => {
		const onDirtyChange = vi.fn();
		mutateAsync.mockResolvedValue({
			counted: 1,
			changed: 1,
			valueChange: -8.5,
			historySaved: true,
			failed: [],
		});
		render(
			<CountInventory inventory={INVENTORY} onDone={vi.fn()} onDirtyChange={onDirtyChange} />
		);

		fireEvent.change(screen.getByLabelText("Counted Ground Beef"), {
			target: { value: "8" },
		});

		expect(screen.getByText("-2 lbs (-$8.50)")).toBeInTheDocument();
		expect(screen.getByText(/1 of 3 counted/)).toBeInTheDocument();
		expect(onDirtyChange).toHaveBeenLastCalledWith(true);

		await userEvent.setup().click(screen.getByRole("button", { name: "Save 1 count" }));

		expect(mutateAsync).toHaveBeenCalledWith({
			reason: "cycle_count",
			note: "",
			counts: [{ inventoryId: "inv-beef", quantity: 8 }],
		});
		expect(await screen.findByText("Saved 1 count.")).toBeInTheDocument();
		expect(onDirtyChange).toHaveBeenLastCalledWith(false);
	});

	it("won't save a bad number", async () => {
		render(<CountInventory inventory={INVENTORY} onDone={vi.fn()} />);

		fireEvent.change(screen.getByLabelText("Counted Ground Beef"), {
			target: { value: "8" },
		});
		fireEvent.change(screen.getByLabelText("Counted Salt"), {
			target: { value: "two" },
		});

		await userEvent.setup().click(screen.getByRole("button", { name: "Save 1 count" }));

		expect(mutateAsync).not.toHaveBeenCalled();
		expect(screen.getByText(/Fix the count for Salt/)).toBeInTheDocument();
	});

	it("says so when the history wasn't recorded", async () => {
		mutateAsync.mockResolvedValue({
			counted: 1,
			changed: 0,
			valueChange: 0,
			historySaved: false,
			failed: [],
		});
		render(<CountInventory inventory={INVENTORY} onDone={vi.fn()} />);

		fireEvent.change(screen.getByLabelText("Counted Hot Dog Buns"), {
			target: { value: "3" },
		});
		await userEvent.setup().click(screen.getByRole("button", { name: "Save 1 count" }));

		expect(await screen.findByText(/matched what PantryPro had/)).toBeInTheDocument();
		expect(screen.getByText(/history wasn.t recorded/)).toBeInTheDocument();
	});

	it("filters by search", () => {
		render(<CountInventory inventory={INVENTORY} onDone={vi.fn()} />);

		fireEvent.change(screen.getByLabelText("Find an item"), {
			target: { value: "bun" },
		});

		expect(screen.getByLabelText("Counted Hot Dog Buns")).toBeInTheDocument();
		expect(screen.queryByLabelText("Counted Ground Beef")).not.toBeInTheDocument();
	});
});
