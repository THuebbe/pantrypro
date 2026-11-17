// frontend\src\components\inventory\AddInventoryItemForm.test.jsx

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AddInventoryItemForm from "./AddInventoryItemForm";
import api from "../../core/database/api";

vi.mock("../../core/database/api", () => ({
	default: { get: vi.fn(), post: vi.fn() },
}));

const CATALOG = {
	items: [{ id: "cat-buns", name: "Bread (Hamburger Buns)", category: "Dry Goods", unit: "dozen" }],
	units: ["each", "dozen", "oz", "lbs", "gal"],
	storageTypes: ["dry", "refrigerated", "frozen"],
};

function renderForm() {
	const onDone = vi.fn();
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

	render(
		<QueryClientProvider client={client}>
			<AddInventoryItemForm onDone={onDone} />
		</QueryClientProvider>
	);

	return { onDone };
}

describe("AddInventoryItemForm", () => {
	beforeEach(() => {
		api.get.mockReset();
		api.post.mockReset();
		api.get.mockResolvedValue({ data: CATALOG });
	});

	it("adds the owner's own item and stays open for the next one", async () => {
		const user = userEvent.setup();
		api.post.mockResolvedValue({ data: { ingredient_name: "Hot Dog Buns" } });
		renderForm();

		const add = screen.getByRole("button", { name: "Add item" });
		expect(add).toBeDisabled();

		await user.type(screen.getByLabelText("Item name"), "Hot Dog Buns");
		await waitFor(() =>
			expect(screen.getByRole("option", { name: "dozen" })).toBeInTheDocument()
		);
		await user.selectOptions(screen.getByLabelText("Counted in"), "dozen");
		await user.type(screen.getByLabelText("On hand now (dozen)"), "6");
		await user.type(screen.getByLabelText("Cost per dozen ($)"), "3.25");
		await user.click(add);

		await waitFor(() =>
			expect(api.post).toHaveBeenCalledWith("/inventory/items", {
				name: "Hot Dog Buns",
				unit: "dozen",
				category: "",
				storageType: "",
				quantity: "6",
				costPerUnit: "3.25",
				minimumQuantity: "",
			})
		);

		expect(await screen.findByText("Added: Hot Dog Buns")).toBeInTheDocument();
		expect(screen.getByLabelText("Item name")).toHaveValue("");
		expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
	});

	it("adds an item from the catalog in the catalog's unit", async () => {
		const user = userEvent.setup();
		api.post.mockResolvedValue({ data: { ingredient_name: "Bread (Hamburger Buns)" } });
		renderForm();

		await user.click(screen.getByRole("tab", { name: "From the catalog" }));
		await waitFor(() =>
			expect(
				screen.getByRole("option", { name: "Bread (Hamburger Buns) (counted in dozen)" })
			).toBeInTheDocument()
		);
		await user.selectOptions(screen.getByLabelText("Catalog item"), "cat-buns");
		await user.type(screen.getByLabelText("On hand now (dozen)"), "3");
		await user.click(screen.getByRole("button", { name: "Add item" }));

		await waitFor(() =>
			expect(api.post).toHaveBeenCalledWith("/inventory/items", {
				ingredientId: "cat-buns",
				quantity: "3",
				costPerUnit: "",
				minimumQuantity: "",
			})
		);
	});

	it("shows the server's reason when an item can't be added", async () => {
		const user = userEvent.setup();
		api.post.mockRejectedValue({
			response: { data: { error: "Hot Dogs is already in your inventory" } },
		});
		renderForm();

		await user.type(screen.getByLabelText("Item name"), "Hot Dogs");
		await waitFor(() =>
			expect(screen.getByRole("option", { name: "each" })).toBeInTheDocument()
		);
		await user.selectOptions(screen.getByLabelText("Counted in"), "each");
		await user.click(screen.getByRole("button", { name: "Add item" }));

		expect(
			await screen.findByText("Hot Dogs is already in your inventory")
		).toBeInTheDocument();
		expect(screen.getByLabelText("Item name")).toHaveValue("Hot Dogs");
	});

	it("closes without adding when cancelled", async () => {
		const user = userEvent.setup();
		const { onDone } = renderForm();

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onDone).toHaveBeenCalled();
		expect(api.post).not.toHaveBeenCalled();
	});
});
