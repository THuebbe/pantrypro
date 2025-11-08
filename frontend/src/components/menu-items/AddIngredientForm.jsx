// frontend\src\components\menu-items\AddIngredientForm.jsx

import { useState } from "react";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAddRecipeIngredient } from "../../hooks/useRecipes";
import api from "../../core/database/api";

export default function AddIngredientForm({
	menuItemId,
	existingIngredients,
	onSuccess,
	onCancel,
}) {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedIngredient, setSelectedIngredient] = useState(null);
	const [quantity, setQuantity] = useState("");
	const [unit, setUnit] = useState("");
	const [prepLossFactor, setPrepLossFactor] = useState("0");
	const [errors, setErrors] = useState({});

	const addIngredientMutation = useAddRecipeIngredient();

	// Fetch all inventory for ingredient selection
	const { data: inventory, isLoading } = useQuery({
		queryKey: ["inventory"],
		queryFn: async () => {
			const response = await api.get("/inventory");
			return response.data;
		},
	});

	// Filter out already added ingredients
	const existingIngredientIds = new Set(
		existingIngredients.map((i) => i.ingredient_id)
	);
	const availableInventory =
		inventory?.filter(
			(item) => !existingIngredientIds.has(item.ingredient_id)
		) || [];

	// Search filtering
	const filteredInventory = availableInventory.filter(
		(item) =>
			item.ingredient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			item.category.toLowerCase().includes(searchQuery.toLowerCase())
	);

	const unitOptions = [
		// Weight
		{ value: "oz", label: "oz (ounces)", group: "Weight" },
		{ value: "lbs", label: "lbs (pounds)", group: "Weight" },
		{ value: "g", label: "g (grams)", group: "Weight" },
		{ value: "kg", label: "kg (kilograms)", group: "Weight" },

		// Volume
		{ value: "tsp", label: "tsp (teaspoon)", group: "Volume" },
		{ value: "tbsp", label: "tbsp (tablespoon)", group: "Volume" },
		{ value: "cup", label: "cup", group: "Volume" },
		{ value: "pt", label: "pt (pint)", group: "Volume" },
		{ value: "qt", label: "qt (quart)", group: "Volume" },
		{ value: "gal", label: "gal (gallon)", group: "Volume" },
		{ value: "ml", label: "ml (milliliter)", group: "Volume" },
		{ value: "l", label: "l (liter)", group: "Volume" },
		{ value: "fl oz", label: "fl oz (fluid ounce)", group: "Volume" },

		// Count
		{ value: "each", label: "each", group: "Count" },
		{ value: "dozen", label: "dozen", group: "Count" },
	];

	const groupedUnits = unitOptions.reduce((acc, option) => {
		if (!acc[option.group]) acc[option.group] = [];
		acc[option.group].push(option);
		return acc;
	}, {});

	const handleSelectIngredient = (item) => {
		setSelectedIngredient(item);
		setUnit(item.unit); // Pre-fill with inventory unit
	};

	const validate = () => {
		const newErrors = {};

		if (!selectedIngredient) {
			newErrors.ingredient = "Please select an ingredient";
		}

		if (!quantity || parseFloat(quantity) <= 0) {
			newErrors.quantity = "Quantity must be greater than 0";
		}

		if (!unit) {
			newErrors.unit = "Please select a unit";
		}

		const loss = parseFloat(prepLossFactor);
		if (isNaN(loss) || loss < 0 || loss > 100) {
			newErrors.prepLossFactor = "Prep loss must be between 0 and 100";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!validate()) return;

		try {
			await addIngredientMutation.mutateAsync({
				menuItemId,
				ingredient: {
					ingredientId: selectedIngredient.ingredient_id,
					quantity: parseFloat(quantity),
					unit,
					prepLossFactor: parseFloat(prepLossFactor),
				},
			});

			onSuccess();
		} catch (error) {
			if (error.response?.status === 409) {
				setErrors({ submit: "This ingredient is already in the recipe" });
			} else {
				setErrors({
					submit: error.response?.data?.error || "Failed to add ingredient",
				});
			}
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="space-y-6"
		>
			{/* Ingredient Search & Selection */}
			{!selectedIngredient ? (
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Search Ingredients *
					</label>
					<div className="relative mb-3">
						<Search
							size={20}
							className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
						/>
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
							placeholder="Search by name or category..."
						/>
					</div>

					{isLoading ? (
						<div className="text-center py-4 text-gray-500">
							Loading ingredients...
						</div>
					) : filteredInventory.length === 0 ? (
						<div className="text-center py-4 text-gray-500">
							{searchQuery
								? "No ingredients found"
								: "No available ingredients"}
						</div>
					) : (
						<div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
							{filteredInventory.map((item) => (
								<button
									key={item.id}
									type="button"
									onClick={() => handleSelectIngredient(item)}
									className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors border-b border-gray-100 last:border-b-0"
								>
									<div className="font-medium text-gray-900">
										{item.ingredient_name}
									</div>
									<div className="text-sm text-gray-600">
										{item.category} • {item.quantity} {item.unit} available
									</div>
								</button>
							))}
						</div>
					)}

					{errors.ingredient && (
						<p className="mt-2 text-sm text-red-600">{errors.ingredient}</p>
					)}
				</div>
			) : (
				<>
					{/* Selected Ingredient Display */}
					<div className="bg-green-50 border border-green-200 rounded-lg p-4">
						<div className="flex items-center justify-between">
							<div>
								<div className="font-semibold text-gray-900">
									{selectedIngredient.ingredient_name}
								</div>
								<div className="text-sm text-gray-600">
									{selectedIngredient.category} • {selectedIngredient.quantity}{" "}
									{selectedIngredient.unit} in stock
								</div>
							</div>
							<button
								type="button"
								onClick={() => {
									setSelectedIngredient(null);
									setQuantity("");
									setUnit("");
								}}
								className="text-sm text-green-600 hover:text-green-700"
							>
								Change
							</button>
						</div>
					</div>

					{/* Quantity */}
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Quantity Needed *
						</label>
						<input
							type="number"
							step="0.01"
							min="0"
							value={quantity}
							onChange={(e) => setQuantity(e.target.value)}
							className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
								errors.quantity ? "border-red-500" : "border-gray-300"
							}`}
							placeholder="0.00"
						/>
						{errors.quantity && (
							<p className="mt-1 text-sm text-red-600">{errors.quantity}</p>
						)}
					</div>

					{/* Unit */}
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Unit *
						</label>
						<select
							value={unit}
							onChange={(e) => setUnit(e.target.value)}
							className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
								errors.unit ? "border-red-500" : "border-gray-300"
							}`}
						>
							<option value="">Select unit...</option>
							{Object.entries(groupedUnits).map(([group, options]) => (
								<optgroup
									key={group}
									label={group}
								>
									{options.map((opt) => (
										<option
											key={opt.value}
											value={opt.value}
										>
											{opt.label}
										</option>
									))}
								</optgroup>
							))}
						</select>
						{errors.unit && (
							<p className="mt-1 text-sm text-red-600">{errors.unit}</p>
						)}
					</div>

					{/* Prep Loss Factor */}
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Prep Loss Factor (%)
						</label>
						<input
							type="number"
							step="0.1"
							min="0"
							max="100"
							value={prepLossFactor}
							onChange={(e) => setPrepLossFactor(e.target.value)}
							className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
								errors.prepLossFactor ? "border-red-500" : "border-gray-300"
							}`}
							placeholder="0"
						/>
						<p className="mt-1 text-xs text-gray-500">
							Account for waste during prep (trim, peels, etc.). Common: 5-15%
							for produce, 0-5% for proteins
						</p>
						{errors.prepLossFactor && (
							<p className="mt-1 text-sm text-red-600">
								{errors.prepLossFactor}
							</p>
						)}
					</div>
				</>
			)}

			{/* Submit Error */}
			{errors.submit && (
				<div className="bg-red-50 border border-red-200 rounded-lg p-4">
					<p className="text-sm text-red-600">{errors.submit}</p>
				</div>
			)}

			{/* Action Buttons */}
			<div className="flex gap-3 pt-4 border-t border-gray-200">
				<button
					type="button"
					onClick={onCancel}
					className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
					disabled={addIngredientMutation.isPending}
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={!selectedIngredient || addIngredientMutation.isPending}
					className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{addIngredientMutation.isPending ? "Adding..." : "Add to Recipe"}
				</button>
			</div>
		</form>
	);
}
