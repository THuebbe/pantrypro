// frontend\src\components\menu-items\RecipeDraftReview.test.jsx

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecipeDraftReview from "./RecipeDraftReview";

const DRAFT = {
	menuItemId: "menu-1",
	menuItemName: "Classic Cheeseburger",
	confidence: "medium",
	note: "",
	lines: [
		{
			ingredientId: "ing-beef",
			ingredientName: "Ground Beef (80/20)",
			quantity: 6,
			unit: "oz",
			inventoryUnit: "lbs",
			allowedUnits: ["g", "kg", "oz", "lbs"],
			prepLossFactor: 0,
		},
		{
			ingredientId: "ing-bun",
			ingredientName: "Bread (Hamburger Buns)",
			quantity: 1,
			unit: "each",
			inventoryUnit: "dozen",
			allowedUnits: ["each", "dozen"],
			prepLossFactor: 0,
		},
	],
	missing: ["Lettuce", "Tomato"],
	rejected: [{ name: "Milk (Whole)", reason: "Suggested in oz" }],
};

function renderReview(props = {}) {
	const onSave = vi.fn();
	const onCancel = vi.fn();

	render(
		<RecipeDraftReview
			draft={DRAFT}
			hasExistingRecipe={false}
			isSaving={false}
			saveError=""
			onSave={onSave}
			onCancel={onCancel}
			{...props}
		/>
	);

	return { onSave, onCancel };
}

describe("RecipeDraftReview", () => {
	it("shows the draft, what is missing and what was left out", () => {
		renderReview();

		expect(screen.getByText("Ground Beef (80/20)")).toBeInTheDocument();
		expect(screen.getByText("Counted in dozen")).toBeInTheDocument();
		expect(screen.getByText(/Lettuce, Tomato/)).toBeInTheDocument();
		expect(screen.getByText(/Milk \(Whole\): Suggested in oz/)).toBeInTheDocument();
		expect(
			screen.queryByText(/replaces the recipe this menu item has now/)
		).not.toBeInTheDocument();
	});

	it("saves the owner's corrections, not the original draft", async () => {
		const user = userEvent.setup();
		const { onSave } = renderReview();

		const beefQuantity = screen.getByLabelText("Quantity of Ground Beef (80/20)");
		await user.clear(beefQuantity);
		await user.type(beefQuantity, "0.5");
		await user.selectOptions(
			screen.getByLabelText("Unit for Ground Beef (80/20)"),
			"lbs"
		);
		await user.click(screen.getByLabelText("Remove Bread (Hamburger Buns)"));
		await user.click(screen.getByRole("button", { name: "Save recipe" }));

		expect(onSave).toHaveBeenCalledWith([
			{ ingredientId: "ing-beef", quantity: 0.5, unit: "lbs", prepLossFactor: 0 },
		]);
	});

	it("only offers units that convert to the inventory unit", () => {
		renderReview();

		const options = Array.from(
			screen.getByLabelText("Unit for Bread (Hamburger Buns)").options
		).map((option) => option.value);

		expect(options).toEqual(["each", "dozen"]);
	});

	it("blocks saving while a quantity is empty or zero", async () => {
		const user = userEvent.setup();
		const { onSave } = renderReview();

		await user.clear(screen.getByLabelText("Quantity of Ground Beef (80/20)"));

		const save = screen.getByRole("button", { name: "Save recipe" });
		expect(save).toBeDisabled();
		await user.click(save);
		expect(onSave).not.toHaveBeenCalled();
	});

	it("warns before replacing an existing recipe and can be discarded", async () => {
		const user = userEvent.setup();
		const { onCancel, onSave } = renderReview({ hasExistingRecipe: true });

		expect(
			screen.getByText(/replaces the recipe this menu item has now/)
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Discard draft" }));
		expect(onCancel).toHaveBeenCalled();
		expect(onSave).not.toHaveBeenCalled();
	});
});
