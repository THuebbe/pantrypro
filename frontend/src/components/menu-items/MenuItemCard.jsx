// frontend\src\components\menu-items\MenuItemCard.jsx

import { ChefHat, Trash2 } from "lucide-react";

export default function MenuItemCard({ item, onViewRecipe, onDelete }) {
	const getFoodCostColor = (percentage) => {
		if (percentage < 25) return "text-green-600 bg-green-50";
		if (percentage < 30) return "text-yellow-600 bg-yellow-50";
		if (percentage < 35) return "text-orange-600 bg-orange-50";
		return "text-red-600 bg-red-50";
	};

	// Mock food cost % for now - will be real when recipe exists
	const foodCostPercent = 28; // TODO: Calculate from recipe

	return (
		<div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
			<div className="flex items-start justify-between mb-3">
				<div className="flex-1">
					<h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
					<span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
						{item.category}
					</span>
				</div>
				<div className="text-right">
					<div className="text-lg font-bold text-gray-900">
						${item.price.toFixed(2)}
					</div>
				</div>
			</div>

			{/* Food Cost Indicator */}
			<div
				className={`mb-3 px-2 py-1 rounded text-xs font-medium ${getFoodCostColor(
					foodCostPercent
				)}`}
			>
				Food Cost: {foodCostPercent}%
			</div>

			{/* Actions */}
			<div className="flex gap-2">
				<button
					onClick={() => {
						onViewRecipe(item.id);
					}}
					className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
				>
					<ChefHat size={16} />
					Recipe
				</button>
				<button
					onClick={() => onDelete(item)}
					className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
				>
					<Trash2 size={16} />
				</button>
			</div>

			{item.toast_menu_item_id && (
				<div className="mt-3 text-xs text-gray-500">🔗 Linked to POS</div>
			)}
		</div>
	);
}
