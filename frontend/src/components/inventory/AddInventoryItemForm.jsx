// frontend\src\components\inventory\AddInventoryItemForm.jsx

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../core/database/api";

const CATEGORIES = [
	"Protein",
	"Produce",
	"Dairy",
	"Dry Goods",
	"Condiments",
	"Beverages",
	"Supplies",
	"Other",
];

const FALLBACK_UNITS = ["each", "dozen", "oz", "lbs", "fl oz", "qt", "gal"];

const EMPTY_FORM = {
	ingredientId: "",
	name: "",
	unit: "",
	category: "",
	storageType: "",
	quantity: "",
	costPerUnit: "",
	minimumQuantity: "",
};

const inputClass =
	"w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500";

/**
 * Add an item to inventory by hand: the owner's own item, or one from the
 * shared catalog. Stays open after saving so several can be added in a row.
 */
export default function AddInventoryItemForm({ onDone }) {
	const queryClient = useQueryClient();
	const [mode, setMode] = useState("own");
	const [form, setForm] = useState(EMPTY_FORM);
	const [added, setAdded] = useState([]);

	const { data: catalog } = useQuery({
		queryKey: ["inventory-catalog"],
		queryFn: async () => (await api.get("/inventory/catalog")).data,
		staleTime: 1000 * 60,
	});

	const units = catalog?.units?.length ? catalog.units : FALLBACK_UNITS;
	const catalogItems = catalog?.items || [];
	const picked = catalogItems.find((item) => item.id === form.ingredientId);

	const addItem = useMutation({
		mutationFn: async (payload) => (await api.post("/inventory/items", payload)).data,
		onSuccess: (item) => {
			setAdded((current) => [...current, item.ingredient_name]);
			setForm(EMPTY_FORM);
			queryClient.invalidateQueries({ queryKey: ["inventory"] });
			queryClient.invalidateQueries({ queryKey: ["inventory-catalog"] });
			queryClient.invalidateQueries({ queryKey: ["metrics"] });
		},
	});

	const set = (field) => (event) => {
		addItem.reset();
		setForm((current) => ({ ...current, [field]: event.target.value }));
	};

	const switchMode = (next) => {
		addItem.reset();
		setMode(next);
		setForm(EMPTY_FORM);
	};

	const unitLabel = mode === "catalog" ? picked?.unit : form.unit;

	const canSubmit =
		mode === "catalog"
			? Boolean(form.ingredientId)
			: Boolean(form.name.trim() && form.unit);

	const handleSubmit = (event) => {
		event.preventDefault();
		if (!canSubmit || addItem.isPending) return;

		const shared = {
			quantity: form.quantity,
			costPerUnit: form.costPerUnit,
			minimumQuantity: form.minimumQuantity,
		};

		addItem.mutate(
			mode === "catalog"
				? { ingredientId: form.ingredientId, ...shared }
				: {
						name: form.name,
						unit: form.unit,
						category: form.category,
						storageType: form.storageType,
						...shared,
				  }
		);
	};

	const errorMessage = addItem.error
		? addItem.error.response?.data?.error || "Couldn't add the item. Try again."
		: "";

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="flex gap-2" role="tablist" aria-label="Where the item comes from">
				{[
					["own", "My own item"],
					["catalog", "From the catalog"],
				].map(([value, label]) => (
					<button
						key={value}
						type="button"
						role="tab"
						aria-selected={mode === value}
						onClick={() => switchMode(value)}
						className={`px-4 py-2 rounded-lg text-sm font-medium border ${
							mode === value
								? "bg-green-600 text-white border-green-600"
								: "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
						}`}
					>
						{label}
					</button>
				))}
			</div>

			{added.length > 0 && (
				<div className="p-3 bg-green-50 border border-green-200 rounded-lg" role="status">
					<p className="text-sm text-green-800">
						Added: {added.join(", ")}
					</p>
				</div>
			)}

			{mode === "catalog" ? (
				<div>
					<label htmlFor="add-item-catalog" className="block text-sm font-medium text-gray-700 mb-1">
						Catalog item
					</label>
					{catalogItems.length === 0 ? (
						<p className="text-sm text-gray-600">
							Every catalog item is already in your inventory. Add your own item
							instead.
						</p>
					) : (
						<select
							id="add-item-catalog"
							value={form.ingredientId}
							onChange={set("ingredientId")}
							className={inputClass}
						>
							<option value="">Choose an item...</option>
							{catalogItems.map((item) => (
								<option key={item.id} value={item.id}>
									{item.name} (counted in {item.unit})
								</option>
							))}
						</select>
					)}
				</div>
			) : (
				<>
					<div>
						<label htmlFor="add-item-name" className="block text-sm font-medium text-gray-700 mb-1">
							Item name
						</label>
						<input
							id="add-item-name"
							type="text"
							value={form.name}
							onChange={set("name")}
							placeholder="e.g. Hot Dog Buns"
							maxLength={120}
							className={inputClass}
						/>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
						<div>
							<label htmlFor="add-item-unit" className="block text-sm font-medium text-gray-700 mb-1">
								Counted in
							</label>
							<select
								id="add-item-unit"
								value={form.unit}
								onChange={set("unit")}
								className={inputClass}
							>
								<option value="">Choose a unit...</option>
								{units.map((unit) => (
									<option key={unit} value={unit}>
										{unit}
									</option>
								))}
							</select>
						</div>
						<div>
							<label htmlFor="add-item-category" className="block text-sm font-medium text-gray-700 mb-1">
								Category
							</label>
							<select
								id="add-item-category"
								value={form.category}
								onChange={set("category")}
								className={inputClass}
							>
								<option value="">Not set</option>
								{CATEGORIES.map((category) => (
									<option key={category} value={category}>
										{category}
									</option>
								))}
							</select>
						</div>
						<div>
							<label htmlFor="add-item-storage" className="block text-sm font-medium text-gray-700 mb-1">
								Stored
							</label>
							<select
								id="add-item-storage"
								value={form.storageType}
								onChange={set("storageType")}
								className={inputClass}
							>
								<option value="">Not set</option>
								<option value="dry">Dry</option>
								<option value="refrigerated">Refrigerated</option>
								<option value="frozen">Frozen</option>
							</select>
						</div>
					</div>
					<p className="text-xs text-gray-500">
						Pick the unit you count this item in on the shelf. Recipes can use a
						different unit of the same kind, such as oz for something counted in
						lbs.
					</p>
				</>
			)}

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
				<div>
					<label htmlFor="add-item-quantity" className="block text-sm font-medium text-gray-700 mb-1">
						On hand now{unitLabel ? ` (${unitLabel})` : ""}
					</label>
					<input
						id="add-item-quantity"
						type="number"
						min="0"
						step="any"
						inputMode="decimal"
						value={form.quantity}
						onChange={set("quantity")}
						placeholder="0"
						className={inputClass}
					/>
				</div>
				<div>
					<label htmlFor="add-item-cost" className="block text-sm font-medium text-gray-700 mb-1">
						Cost per {unitLabel || "unit"} ($)
					</label>
					<input
						id="add-item-cost"
						type="number"
						min="0"
						step="any"
						inputMode="decimal"
						value={form.costPerUnit}
						onChange={set("costPerUnit")}
						placeholder="Optional"
						className={inputClass}
					/>
				</div>
				<div>
					<label htmlFor="add-item-minimum" className="block text-sm font-medium text-gray-700 mb-1">
						Reorder below{unitLabel ? ` (${unitLabel})` : ""}
					</label>
					<input
						id="add-item-minimum"
						type="number"
						min="0"
						step="any"
						inputMode="decimal"
						value={form.minimumQuantity}
						onChange={set("minimumQuantity")}
						placeholder="Optional"
						className={inputClass}
					/>
				</div>
			</div>

			{errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

			<div className="flex justify-end gap-3 pt-2">
				<button
					type="button"
					onClick={onDone}
					className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
				>
					{added.length > 0 ? "Done" : "Cancel"}
				</button>
				<button
					type="submit"
					disabled={!canSubmit || addItem.isPending}
					className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{addItem.isPending ? "Adding..." : "Add item"}
				</button>
			</div>
		</form>
	);
}
