// frontend\src\components\inventory\BulkAddItems.test.jsx

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BulkAddItems from "./BulkAddItems";

const previewAsync = vi.fn();
const commitAsync = vi.fn();

vi.mock("../../hooks/useBulkInventory", () => ({
	usePreviewBulkAdd: () => ({ mutateAsync: previewAsync, isPending: false }),
	useCommitBulkAdd: () => ({ mutateAsync: commitAsync, isPending: false }),
}));

const PASTE = "name\tunit\tqty\tcost\nOnions\tlbs\t10\t0.89\nhot dog buns\t\t4\t\nRelish\tcase\t2\t\nMustard\tgal\t1\t";

const PLAN = {
	rows: [
		{ row: 1, status: "new", name: "Onions" },
		{ row: 2, status: "catalog", name: "Hot Dog Buns" },
		{ row: 3, status: "error", name: "Relish", message: '"case" isn\'t a unit the app can use.' },
		{ row: 4, status: "exists", name: "Mustard", message: "Mustard is already in your inventory." },
	],
};

async function pasteAndCheck(user) {
	fireEvent.change(screen.getByLabelText(/Or paste from a spreadsheet/), {
		target: { value: PASTE },
	});
	await user.click(screen.getByRole("button", { name: "Check rows" }));
}

describe("BulkAddItems", () => {
	beforeEach(() => {
		previewAsync.mockReset();
		commitAsync.mockReset();
		previewAsync.mockResolvedValue(PLAN);
	});

	it("reads a paste and shows what will happen to each row", async () => {
		const user = userEvent.setup();
		render(<BulkAddItems onDone={vi.fn()} />);

		await pasteAndCheck(user);

		expect(previewAsync).toHaveBeenCalledWith([
			expect.objectContaining({ name: "Onions", unit: "lbs", quantity: "10", costPerUnit: "0.89" }),
			expect.objectContaining({ name: "hot dog buns", quantity: "4" }),
			expect.objectContaining({ name: "Relish", unit: "case" }),
			expect.objectContaining({ name: "Mustard", unit: "gal" }),
		]);
		expect(screen.getByText("Matches Hot Dog Buns")).toBeInTheDocument();
		expect(screen.getByText(/isn't a unit/)).toBeInTheDocument();
		expect(screen.getByText(/2 ready, 1 need fixing, 1 already stocked/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Add 2 items" })).toBeEnabled();
	});

	it("explains a paste with no name column without calling the server", async () => {
		const user = userEvent.setup();
		render(<BulkAddItems onDone={vi.fn()} />);

		fireEvent.change(screen.getByLabelText(/Or paste from a spreadsheet/), {
			target: { value: "qty\tunit\n4\tlbs" },
		});
		await user.click(screen.getByRole("button", { name: "Check rows" }));

		expect(previewAsync).not.toHaveBeenCalled();
		expect(screen.getByText(/needs to be column headers/)).toBeInTheDocument();
	});

	it("adds, skips stocked items, and keeps rows that still need fixing", async () => {
		const user = userEvent.setup();
		commitAsync.mockResolvedValue({
			added: 2,
			skipped: [{ row: 3, status: "error", name: "Relish", message: "Still not a unit" }],
		});
		render(<BulkAddItems onDone={vi.fn()} />);

		await pasteAndCheck(user);
		await user.click(screen.getByRole("button", { name: "Add 2 items" }));

		// The already-stocked row isn't sent at all.
		const sent = commitAsync.mock.calls[0][0];
		expect(sent.map((r) => r.name)).toEqual(["Onions", "hot dog buns", "Relish"]);

		expect(screen.getByText(/Added 2\. 1 row below still needs fixing/)).toBeInTheDocument();
		expect(screen.getByLabelText("Row 1 name")).toHaveValue("Relish");
		expect(screen.getByText("Still not a unit")).toBeInTheDocument();
	});

	it("marks an edited row and offers to check again", async () => {
		const user = userEvent.setup();
		render(<BulkAddItems onDone={vi.fn()} />);

		await pasteAndCheck(user);
		await user.selectOptions(screen.getByLabelText("Row 3 unit"), "each");

		expect(screen.getByText("Edited")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Add 3 items" })).toBeEnabled();

		previewAsync.mockResolvedValue({
			rows: [
				PLAN.rows[0],
				PLAN.rows[1],
				{ row: 3, status: "new", name: "Relish" },
				PLAN.rows[3],
			],
		});
		await user.click(screen.getByRole("button", { name: "Check again" }));

		expect(previewAsync).toHaveBeenLastCalledWith(
			expect.arrayContaining([expect.objectContaining({ name: "Relish", unit: "each" })])
		);
		expect(screen.queryByText("Edited")).not.toBeInTheDocument();
	});

	it("shows a finished screen when everything went in", async () => {
		const user = userEvent.setup();
		commitAsync.mockResolvedValue({ added: 2, skipped: [] });
		previewAsync.mockResolvedValue({ rows: PLAN.rows.slice(0, 2) });
		render(<BulkAddItems onDone={vi.fn()} />);

		fireEvent.change(screen.getByLabelText(/Or paste from a spreadsheet/), {
			target: { value: "name\tunit\nOnions\tlbs\nhot dog buns\t" },
		});
		await user.click(screen.getByRole("button", { name: "Check rows" }));
		await user.click(screen.getByRole("button", { name: "Add 2 items" }));

		expect(screen.getByText("Added 2 items.")).toBeInTheDocument();
	});
});
