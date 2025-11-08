// frontend\src\components\dashboard\content\MenuItemsContent.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChefHat, DollarSign, Edit, Trash2 } from "lucide-react";
import { useMenuItems, useDeleteMenuItem } from "../../../hooks/useMenuItems";
import Modal from "../../shared/Modal";
import CreateMenuItemForm from "../../menu-items/CreateMenuItemForm";
import MenuItemCard from "../../menu-items/MenuItemCard";

export default function MenuItemsContent() {
	const navigate = useNavigate();
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [categoryFilter, setCategoryFilter] = useState("all");
	const [searchQuery, setSearchQuery] = useState("");

	const {
		data: menuItems,
		isLoading,
		isError,
		error,
	} = useMenuItems({ isActive: true });
	const deleteMenuItemMutation = useDeleteMenuItem();

	const [successMessage, setSuccessMessage] = useState("");

	// Filter menu items
	const filteredMenuItems =
		menuItems?.filter((item) => {
			const matchesCategory =
				categoryFilter === "all" || item.category === categoryFilter;
			const matchesSearch = item.name
				.toLowerCase()
				.includes(searchQuery.toLowerCase());
			return matchesCategory && matchesSearch;
		}) || [];

	// Get unique categories for filter
	const categories = [
		"all",
		...new Set(menuItems?.map((item) => item.category) || []),
	];

	const handleCreateSuccess = (newMenuItem) => {
		setShowCreateModal(false);
		setSuccessMessage(`Created "${newMenuItem.name}" successfully!`);
		setTimeout(() => setSuccessMessage(""), 5000);

		// Navigate to recipe builder
		navigate(`/menu-items/${newMenuItem.id}/recipe`);
	};

	const handleViewRecipe = (menuItemId) => {
		navigate(`/menu-items/${menuItemId}/recipe`);
	};

	const handleDelete = async (menuItem) => {
		if (!window.confirm(`Are you sure you want to delete "${menuItem.name}"?`))
			return;

		try {
			await deleteMenuItemMutation.mutateAsync(menuItem.id);
			setSuccessMessage(`Deleted "${menuItem.name}" successfully`);
			setTimeout(() => setSuccessMessage(""), 5000);
		} catch (error) {
			alert(
				"Failed to delete menu item: " +
					(error.response?.data?.error || error.message)
			);
		}
	};

	// Loading state
	if (isLoading) {
		return (
			<div className="bg-white rounded-lg border border-gray-200 p-12 flex items-center justify-center">
				<div className="text-center">
					<div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
					<p className="text-gray-600">Loading menu items...</p>
				</div>
			</div>
		);
	}

	// Error state
	if (isError) {
		return (
			<div className="bg-white rounded-lg border border-red-200 p-12">
				<div className="text-center text-red-600">
					<p className="font-semibold text-lg mb-2">
						Failed to load menu items
					</p>
					<p className="text-sm">
						{error?.message || "Please try again later"}
					</p>
				</div>
			</div>
		);
	}

	return (
		<>
			<div className="bg-white rounded-lg border border-gray-200 p-6 h-full flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<div>
						<h2 className="text-2xl font-bold text-gray-900">Menu Items</h2>
						<p className="text-sm text-gray-600 mt-1">
							Manage your menu items and recipes
						</p>
					</div>
					<button
						onClick={() => setShowCreateModal(true)}
						className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
					>
						<Plus size={20} />
						Create Menu Item
					</button>
				</div>

				{/* Success Message */}
				{successMessage && (
					<div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
						<p className="text-sm text-green-700 font-medium">
							✓ {successMessage}
						</p>
					</div>
				)}

				{/* Filters */}
				<div className="flex gap-4 mb-6">
					<div className="flex-1">
						<input
							type="text"
							placeholder="Search menu items..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
						/>
					</div>
					<select
						value={categoryFilter}
						onChange={(e) => setCategoryFilter(e.target.value)}
						className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
					>
						{categories.map((cat) => (
							<option
								key={cat}
								value={cat}
							>
								{cat === "all" ? "All Categories" : cat}
							</option>
						))}
					</select>
				</div>

				{/* Menu Items Grid */}
				{filteredMenuItems.length === 0 ? (
					<div className="flex-1 flex items-center justify-center">
						<div className="text-center text-gray-500">
							<ChefHat
								size={48}
								className="mx-auto mb-4 text-gray-300"
							/>
							<p className="text-lg font-medium mb-2">No menu items found</p>
							<p className="text-sm">
								{searchQuery || categoryFilter !== "all"
									? "Try adjusting your filters"
									: "Create your first menu item to get started"}
							</p>
						</div>
					</div>
				) : (
					<div className="flex-1 overflow-y-auto">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{filteredMenuItems.map((item) => (
								<MenuItemCard
									key={item.id}
									item={item}
									onViewRecipe={handleViewRecipe}
									onDelete={handleDelete}
								/>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Create Modal */}
			<Modal
				isOpen={showCreateModal}
				onClose={() => setShowCreateModal(false)}
				title="Create Menu Item"
				size="md"
			>
				<CreateMenuItemForm
					onSuccess={handleCreateSuccess}
					onCancel={() => setShowCreateModal(false)}
				/>
			</Modal>
		</>
	);
}
