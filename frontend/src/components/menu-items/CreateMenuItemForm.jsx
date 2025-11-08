// frontend\src\components\menu-items\CreateMenuItemForm.jsx

import { useState } from "react";
import { useCreateMenuItem } from "../../hooks/useMenuItems";

export default function CreateMenuItemForm({ onSuccess, onCancel }) {
	const [name, setName] = useState("");
	const [category, setCategory] = useState("");
	const [customCategory, setCustomCategory] = useState("");
	const [price, setPrice] = useState("");
	const [toastMenuItemId, setToastMenuItemId] = useState("");
	const [isActive, setIsActive] = useState(true);
	const [errors, setErrors] = useState({});

	const createMenuItemMutation = useCreateMenuItem();

	const commonCategories = [
		"Appetizers",
		"Entrees",
		"Sides",
		"Desserts",
		"Beverages",
		"Salads",
		"Soups",
		"Sandwiches",
		"Pizza",
		"Pasta",
		"Seafood",
		"Vegetarian",
		"Cocktails",
		"Other",
	];

	const validate = () => {
		const newErrors = {};

		if (!name.trim()) {
			newErrors.name = "Name is required";
		}

		if (!category) {
			newErrors.category = "Category is required";
		}

		if (category === "Other" && !customCategory.trim()) {
			newErrors.customCategory = "Custom category is required";
		}

		if (!price || parseFloat(price) <= 0) {
			newErrors.price = "Price must be greater than 0";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!validate()) return;

		const finalCategory =
			category === "Other" ? customCategory.trim() : category;

		try {
			const newMenuItem = await createMenuItemMutation.mutateAsync({
				name: name.trim(),
				category: finalCategory,
				price: parseFloat(price),
				toastMenuItemId: toastMenuItemId.trim() || undefined,
				isActive,
			});

			onSuccess(newMenuItem);
		} catch (error) {
			setErrors({
				submit: error.response?.data?.error || "Failed to create menu item",
			});
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="space-y-6"
		>
			{/* Name */}
			<div>
				<label className="block text-sm font-medium text-gray-700 mb-2">
					Menu Item Name *
				</label>
				<input
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
						errors.name ? "border-red-500" : "border-gray-300"
					}`}
					placeholder="e.g., Chicken Parmesan"
				/>
				{errors.name && (
					<p className="mt-1 text-sm text-red-600">{errors.name}</p>
				)}
			</div>

			{/* Category */}
			<div>
				<label className="block text-sm font-medium text-gray-700 mb-2">
					Category *
				</label>
				<select
					value={category}
					onChange={(e) => setCategory(e.target.value)}
					className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
						errors.category ? "border-red-500" : "border-gray-300"
					}`}
				>
					<option value="">Select a category...</option>
					{commonCategories.map((cat) => (
						<option
							key={cat}
							value={cat}
						>
							{cat}
						</option>
					))}
				</select>
				{errors.category && (
					<p className="mt-1 text-sm text-red-600">{errors.category}</p>
				)}
			</div>

			{/* Custom Category */}
			{category === "Other" && (
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Custom Category *
					</label>
					<input
						type="text"
						value={customCategory}
						onChange={(e) => setCustomCategory(e.target.value)}
						className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
							errors.customCategory ? "border-red-500" : "border-gray-300"
						}`}
						placeholder="Enter custom category"
					/>
					{errors.customCategory && (
						<p className="mt-1 text-sm text-red-600">{errors.customCategory}</p>
					)}
				</div>
			)}

			{/* Price */}
			<div>
				<label className="block text-sm font-medium text-gray-700 mb-2">
					Price *
				</label>
				<div className="relative">
					<span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
						$
					</span>
					<input
						type="number"
						step="0.01"
						min="0"
						value={price}
						onChange={(e) => setPrice(e.target.value)}
						className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
							errors.price ? "border-red-500" : "border-gray-300"
						}`}
						placeholder="0.00"
					/>
				</div>
				{errors.price && (
					<p className="mt-1 text-sm text-red-600">{errors.price}</p>
				)}
			</div>

			{/* Toast Menu Item ID (Optional) */}
			<div>
				<label className="block text-sm font-medium text-gray-700 mb-2">
					Toast Menu Item ID (Optional)
				</label>
				<input
					type="text"
					value={toastMenuItemId}
					onChange={(e) => setToastMenuItemId(e.target.value)}
					className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
					placeholder="Link to POS system"
				/>
				<p className="mt-1 text-xs text-gray-500">
					Optional: Link this menu item to your POS system
				</p>
			</div>

			{/* Active Checkbox */}
			<div className="flex items-center">
				<input
					type="checkbox"
					id="isActive"
					checked={isActive}
					onChange={(e) => setIsActive(e.target.checked)}
					className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
				/>
				<label
					htmlFor="isActive"
					className="ml-2 text-sm text-gray-700"
				>
					Active (visible to staff)
				</label>
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
					disabled={createMenuItemMutation.isPending}
				>
					Cancel
				</button>
				<button
					type="submit"
					className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={createMenuItemMutation.isPending}
				>
					{createMenuItemMutation.isPending
						? "Creating..."
						: "Create & Add Recipe →"}
				</button>
			</div>
		</form>
	);
}
