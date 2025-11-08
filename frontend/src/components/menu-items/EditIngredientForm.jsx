// frontend\src\components\menu-items\EditIngredientForm.jsx

import { useState } from "react";
import { useUpdateRecipeIngredient } from "../../hooks/useRecipes";

export default function EditIngredientForm({
	ingredient,
	menuItemId,
	onSuccess,
	onCancel,
}) {
	const [quantity, setQuantity] = useState(ingredient.quantity.toString());
	const [unit, setUnit] = useState(ingredient.unit);
	const [prepLossFactor, setPrepLossFactor] = useState(
		ingredient.prep_loss_factor.toString()
	);
	const [errors, setErrors] = useState({});

	const updateIngredientMutation = useUpdateRecipeIngredient();

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

	const validate = () => {
		const newErrors = {};

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
			await updateIngredientMutation.mutateAsync({
				recipeIngredientId: ingredient.id,
				updates: {
					quantity: parseFloat(quantity),
					unit,
					prepLossFactor: parseFloat(prepLossFactor),
				},
				menuItemId,
			});

			onSuccess();
		} catch (error) {
			setErrors({
				submit: error.response?.data?.error || "Failed to update ingredient",
			});
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="space-y-6"
		>
			{/* Ingredient Name (read-only) */}
			<div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
				<div className="font-semibold text-gray-900">
					{ingredient.ingredient_name}
				</div>
				<div className="text-sm text-gray-600">
					{ingredient.category || "Ingredient"}
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
					Account for waste during prep (trim, peels, etc.). Common: 5-15% for
					produce, 0-5% for proteins
				</p>
				{errors.prepLossFactor && (
					<p className="mt-1 text-sm text-red-600">{errors.prepLossFactor}</p>
				)}
			</div>

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
					disabled={updateIngredientMutation.isPending}
				>
					Cancel
				</button>
				<button
					type="submit"
					className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={updateIngredientMutation.isPending}
				>
					{updateIngredientMutation.isPending ? "Saving..." : "Save Changes"}
				</button>
			</div>
		</form>
	);
}
