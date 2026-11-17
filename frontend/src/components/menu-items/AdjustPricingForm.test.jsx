// frontend\src\components\menu-items\AdjustPricingForm.test.jsx

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdjustPricingForm from "./AdjustPricingForm";

const mutateAsync = vi.fn();

vi.mock("../../hooks/useMenuItems", () => ({
	useUpdateMenuItem: () => ({ mutateAsync, isPending: false }),
}));

const ITEM = { id: "menu-1", name: "Pepper Dog", price: 5 };

const renderForm = (props = {}) =>
	render(
		<AdjustPricingForm
			menuItem={ITEM}
			recipeCost={1.8}
			onSuccess={vi.fn()}
			onCancel={vi.fn()}
			{...props}
		/>
	);

describe("AdjustPricingForm", () => {
	beforeEach(() => {
		mutateAsync.mockReset();
		mutateAsync.mockResolvedValue({});
	});

	it("starts on the current price and food cost %", () => {
		renderForm();

		expect(screen.getByLabelText("Menu price ($)")).toHaveValue(5);
		expect(screen.getByLabelText("Food cost (%)")).toHaveValue(36);
	});

	it("moves the food cost % when the price changes", () => {
		renderForm();

		fireEvent.change(screen.getByLabelText("Menu price ($)"), {
			target: { value: "9" },
		});

		expect(screen.getByLabelText("Food cost (%)")).toHaveValue(20);
	});

	it("moves the price when the food cost % changes", () => {
		renderForm();

		fireEvent.change(screen.getByLabelText("Food cost (%)"), {
			target: { value: "18" },
		});

		expect(screen.getByLabelText("Menu price ($)")).toHaveValue(10);
	});

	it("moves the price when the slider is dragged", () => {
		renderForm();

		fireEvent.change(screen.getByLabelText("Drag to set food cost %"), {
			target: { value: "30" },
		});

		expect(screen.getByLabelText("Menu price ($)")).toHaveValue(6);
	});

	it("jumps to 18% and rounds up, then saves that price", async () => {
		const onSuccess = vi.fn();
		renderForm({ recipeCost: 1.47, onSuccess });
		const user = userEvent.setup();

		await user.click(screen.getByRole("button", { name: "18%" }));
		expect(screen.getByLabelText("Menu price ($)")).toHaveValue(8.17);

		await user.click(screen.getByRole("button", { name: ".99" }));
		expect(screen.getByLabelText("Menu price ($)")).toHaveValue(8.99);

		await user.click(screen.getByRole("button", { name: "Save price" }));

		expect(mutateAsync).toHaveBeenCalledWith({
			id: "menu-1",
			data: { price: 8.99 },
		});
		expect(onSuccess).toHaveBeenCalled();
	});

	it("won't save until the price has changed", () => {
		renderForm();

		expect(screen.getByRole("button", { name: "Save price" })).toBeDisabled();
	});

	it("still lets the price be set when the recipe has no cost", () => {
		renderForm({ recipeCost: 0 });

		expect(screen.getByLabelText("Food cost (%)")).toBeDisabled();
		expect(screen.getByText(/has no cost yet/)).toBeInTheDocument();

		fireEvent.change(screen.getByLabelText("Menu price ($)"), {
			target: { value: "6.5" },
		});

		expect(screen.getByRole("button", { name: "Save price" })).toBeEnabled();
	});

	it("says so when part of the recipe isn't costed", () => {
		renderForm({ uncostedCount: 1 });

		expect(screen.getByText(/1 ingredient isn't/)).toBeInTheDocument();
	});

	it("shows the reason when saving fails", async () => {
		mutateAsync.mockRejectedValue({
			response: { data: { error: "Access denied" } },
		});
		renderForm();
		const user = userEvent.setup();

		fireEvent.change(screen.getByLabelText("Menu price ($)"), {
			target: { value: "7" },
		});
		await user.click(screen.getByRole("button", { name: "Save price" }));

		expect(await screen.findByText("Access denied")).toBeInTheDocument();
	});
});
