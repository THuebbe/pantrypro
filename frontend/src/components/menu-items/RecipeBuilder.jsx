// frontend\src\components\menu-items\RecipeBuilder.jsx

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
	ArrowLeft,
	Plus,
	DollarSign,
	AlertTriangle,
	CheckCircle,
	Trash2,
	Edit2,
} from "lucide-react";
import { useMenuItem } from "../../hooks/useMenuItems";
import {
	useRecipe,
	useRecipeCost,
	useRecipeValidation,
	useDeleteRecipeIngredient,
} from "../../hooks/useRecipes";
import Modal from "../shared/Modal";
import AddIngredientForm from "./AddIngredientForm";
import EditIngredientForm from "./EditIngredientForm";

export default function RecipeBuilder() {
	const location = useLocation();
	const navigate = useNavigate();

	const pathParts = location.pathname.split("/").filter(Boolean);
	const menuItemId = pathParts[1]; // /menu-items/:id/recipe -> pathParts[1] is the ID

	const [showAddModal, setShowAddModal] = useState(false);
	const [editingIngredient, setEditingIngredient] = useState(null);
	const [showValidation, setShowValidation] = useState(false);

	// Fetch data
	const { data: menuItem, isLoading: menuItemLoading } =
		useMenuItem(menuItemId);
	const { data: recipe, isLoading: recipeLoading } = useRecipe(menuItemId);
	const { data: costData, isLoading: costLoading } = useRecipeCost(menuItemId);
	const { data: validationData } = useRecipeValidation(menuItemId);

	// Mutations
	const deleteIngredientMutation = useDeleteRecipeIngredient();

	const handleAddIngredientSuccess = () => {
		setShowAddModal(false);
	};

	const handleEditIngredientSuccess = () => {
		setEditingIngredient(null);
	};

	const handleDeleteIngredient = async (ingredient) => {
		if (!window.confirm(`Remove ${ingredient.ingredient_name} from recipe?`))
			return;

		try {
			await deleteIngredientMutation.mutateAsync({
				recipeIngredientId: ingredient.id,
				menuItemId,
			});
		} catch (error) {
			alert(
				"Failed to remove ingredient: " +
					(error.response?.data?.error || error.message)
			);
		}
	};

	const getFoodCostColor = (percentage) => {
		if (!percentage) return "text-gray-600 bg-gray-100";
		if (percentage < 25) return "text-green-600 bg-green-50 border-green-200";
		if (percentage < 30)
			return "text-yellow-600 bg-yellow-50 border-yellow-200";
		if (percentage < 35)
			return "text-orange-600 bg-orange-50 border-orange-200";
		return "text-red-600 bg-red-50 border-red-200";
	};

	const foodCostPercent =
		menuItem && costData
			? ((costData.total_cost / menuItem.price) * 100).toFixed(1)
			: null;

	if (menuItemLoading) {
		return (
			<div className="bg-white rounded-lg border border-gray-200 p-12 flex items-center justify-center h-full">
				<div className="text-center">
					<div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
					<p className="text-gray-600">Loading recipe builder...</p>
				</div>
			</div>
		);
	}

	if (!menuItem) {
		return (
			<div className="bg-white rounded-lg border border-red-200 p-12">
				<div className="text-center text-red-600">
					<p className="font-semibold text-lg mb-2">Menu item not found</p>
					<button
						onClick={() => navigate("/menu-items")}
						className="text-sm text-green-600 hover:text-green-700"
					>
						← Back to Menu Items
					</button>
				</div>
			</div>
		);
	}

	return (
		<>
			<div className="bg-white rounded-lg border border-gray-200 p-6 h-full flex flex-col">
				{/* Header */}
				<div className="flex items-start justify-between mb-6">
					<div className="flex-1">
						<button
							onClick={() => navigate("/menu-items")}
							className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3 text-sm"
						>
							<ArrowLeft size={16} />
							Back to Menu Items
						</button>
						<h2 className="text-2xl font-bold text-gray-900 mb-1">
							{menuItem.name}
						</h2>
						<div className="flex items-center gap-4 text-sm text-gray-600">
							<span className="px-2 py-1 bg-gray-100 rounded">
								{menuItem.category}
							</span>
							<span className="font-medium">
								Menu Price: ${menuItem.price.toFixed(2)}
							</span>
						</div>
					</div>

					<button
						onClick={() => setShowAddModal(true)}
						className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
					>
						<Plus size={20} />
						Add Ingredient
					</button>
				</div>

				{/* Cost Summary Card */}
				<div className="mb-6 p-4 border-2 rounded-lg bg-gray-50">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{/* Total Cost */}
						<div>
							<div className="text-sm text-gray-600 mb-1">Recipe Cost</div>
							<div className="text-2xl font-bold text-gray-900">
								{costLoading ? (
									<span className="text-gray-400">Loading...</span>
								) : costData ? (
									`$${costData.total_cost.toFixed(2)}`
								) : (
									<span className="text-gray-400">$0.00</span>
								)}
							</div>
						</div>

						{/* Food Cost % */}
						<div>
							<div className="text-sm text-gray-600 mb-1">Food Cost %</div>
							<div
								className={`text-2xl font-bold px-3 py-1 rounded border inline-block ${getFoodCostColor(
									foodCostPercent
								)}`}
							>
								{foodCostPercent ? `${foodCostPercent}%` : "--"}
							</div>
						</div>

						{/* Profit */}
						<div>
							<div className="text-sm text-gray-600 mb-1">Profit per Plate</div>
							<div className="text-2xl font-bold text-green-600">
								{costData && menuItem
									? `$${(menuItem.price - costData.total_cost).toFixed(2)}`
									: "--"}
							</div>
						</div>
					</div>

					{/* Food Cost Warning */}
					{foodCostPercent && parseFloat(foodCostPercent) > 35 && (
						<div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
							<AlertTriangle
								size={20}
								className="text-red-600 flex-shrink-0 mt-0.5"
							/>
							<div className="text-sm">
								<p className="font-medium text-red-800">
									High Food Cost Warning
								</p>
								<p className="text-red-600 mt-1">
									Food cost is above 35%. Consider adjusting portions or
									increasing price.
								</p>
							</div>
						</div>
					)}

					{/* Validation Button */}
					{recipe?.ingredients && recipe.ingredients.length > 0 && (
						<button
							onClick={() => setShowValidation(!showValidation)}
							className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-sm"
						>
							<CheckCircle size={16} />
							{showValidation ? "Hide Validation" : "Validate Recipe"}
						</button>
					)}

					{/* Validation Results */}
					{showValidation && validationData && (
						<div className="mt-4 space-y-2">
							{validationData.is_valid ? (
								<div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
									<CheckCircle
										size={20}
										className="text-green-600 flex-shrink-0"
									/>
									<div className="text-sm text-green-800">
										All ingredients are available in inventory
									</div>
								</div>
							) : (
								<div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
									<div className="flex items-start gap-2 mb-2">
										<AlertTriangle
											size={20}
											className="text-yellow-600 flex-shrink-0"
										/>
										<div className="text-sm font-medium text-yellow-800">
											Some ingredients need attention:
										</div>
									</div>
									<ul className="ml-7 text-sm text-yellow-700 space-y-1">
										{validationData.issues?.map((issue, idx) => (
											<li key={idx}>• {issue}</li>
										))}
									</ul>
								</div>
							)}
						</div>
					)}
				</div>

				{/* Ingredients List */}
				<div className="flex-1 overflow-y-auto">
					{recipeLoading ? (
						<div className="flex items-center justify-center py-12">
							<div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
						</div>
					) : !recipe?.ingredients || recipe.ingredients.length === 0 ? (
						<div className="text-center py-12">
							<DollarSign
								size={48}
								className="mx-auto mb-4 text-gray-300"
							/>
							<p className="text-lg font-medium text-gray-600 mb-2">
								No ingredients yet
							</p>
							<p className="text-sm text-gray-500 mb-4">
								Start building your recipe by adding ingredients
							</p>
							<button
								onClick={() => setShowAddModal(true)}
								className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
							>
								<Plus size={20} />
								Add First Ingredient
							</button>
						</div>
					) : (
						<div className="space-y-3">
							{recipe.ingredients.map((ingredient) => {
								const ingredientCost = costData?.ingredients?.find(
									(i) => i.ingredient_id === ingredient.ingredient_id
								);

								return (
									<IngredientCard
										key={ingredient.id}
										ingredient={ingredient}
										cost={ingredientCost}
										onEdit={() => setEditingIngredient(ingredient)}
										onDelete={() => handleDeleteIngredient(ingredient)}
									/>
								);
							})}
						</div>
					)}
				</div>
			</div>

			{/* Add Ingredient Modal */}
			<Modal
				isOpen={showAddModal}
				onClose={() => setShowAddModal(false)}
				title="Add Ingredient to Recipe"
				size="lg"
			>
				<AddIngredientForm
					menuItemId={menuItemId}
					existingIngredients={recipe?.ingredients || []}
					onSuccess={handleAddIngredientSuccess}
					onCancel={() => setShowAddModal(false)}
				/>
			</Modal>

			{/* Edit Ingredient Modal */}
			<Modal
				isOpen={!!editingIngredient}
				onClose={() => setEditingIngredient(null)}
				title="Edit Ingredient"
				size="md"
			>
				{editingIngredient && (
					<EditIngredientForm
						ingredient={editingIngredient}
						menuItemId={menuItemId}
						onSuccess={handleEditIngredientSuccess}
						onCancel={() => setEditingIngredient(null)}
					/>
				)}
			</Modal>
		</>
	);
}

// Ingredient Card Component
function IngredientCard({ ingredient, cost, onEdit, onDelete }) {
	const hasLoss = ingredient.prep_loss_factor > 0;

	return (
		<div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1">
					<h4 className="font-semibold text-gray-900 mb-2">
						{ingredient.ingredient_name}
					</h4>

					<div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
						<div>
							<span className="text-gray-600">Quantity:</span>
							<span className="ml-2 font-medium text-gray-900">
								{ingredient.quantity} {ingredient.unit}
							</span>
						</div>

						{hasLoss && (
							<div>
								<span className="text-gray-600">Prep Loss:</span>
								<span className="ml-2 font-medium text-orange-600">
									{ingredient.prep_loss_factor}%
								</span>
							</div>
						)}

						{cost && (
							<>
								{hasLoss && (
									<div>
										<span className="text-gray-600">Adjusted:</span>
										<span className="ml-2 font-medium text-gray-900">
											{cost.adjusted_quantity.toFixed(2)} {ingredient.unit}
										</span>
									</div>
								)}

								<div>
									<span className="text-gray-600">Cost:</span>
									<span className="ml-2 font-medium text-green-600">
										${cost.ingredient_cost.toFixed(2)}
									</span>
								</div>
							</>
						)}

						{cost && !cost.in_stock && (
							<div className="col-span-2">
								<span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
									<AlertTriangle size={12} />
									Out of stock
								</span>
							</div>
						)}
					</div>
				</div>

				{/* Actions */}
				<div className="flex gap-2">
					<button
						onClick={onEdit}
						className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
						title="Edit"
					>
						<Edit2 size={18} />
					</button>
					<button
						onClick={onDelete}
						className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
						title="Remove"
					>
						<Trash2 size={18} />
					</button>
				</div>
			</div>
		</div>
	);
}
