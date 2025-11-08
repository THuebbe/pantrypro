//  frontend\src\components\dashboard\content\InventoryContent.jsx

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import api from "../../../core/database/api";
import Modal from "../../shared/Modal";
import RemoveStockForm from "../../inventory/RemoveStockForm";

export default function InventoryContent({ subsection }) {
	const [selectedItem, setSelectedItem] = useState(null);
	const [showRemoveModal, setShowRemoveModal] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");

	const {
		data: inventory,
		isLoading,
		isError,
		error,
	} = useQuery({
		queryKey: ["inventory"],
		queryFn: async () => {
			const response = await api.get("/inventory");
			return response.data;
		},
		staleTime: 1000 * 60 * 2,
	});

	const getFilteredInventory = () => {
		if (!inventory) return [];

		switch (subsection) {
			case "low-stock":
				return inventory.filter(
					(item) => item.quantity <= (item.minimum_quantity || 0)
				);
			case "expiring": {
				const sevenDaysFromNow = new Date();
				sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
				return inventory.filter((item) => {
					if (!item.expiration_date) return false;
					const expirationDate = new Date(item.expiration_date);
					const today = new Date();
					return expirationDate >= today && expirationDate <= sevenDaysFromNow;
				});
			}
			case "remove":
				return inventory; // Show all for selection
			default:
				return inventory;
		}
	};

	const filteredInventory = getFilteredInventory();

	const getTitle = () => {
		switch (subsection) {
			case "low-stock":
				return "Low Stock Items";
			case "expiring":
				return "Items Expiring Soon";
			case "remove":
				return "Remove Stock / Log Waste";
			default:
				return "All Ingredients";
		}
	};

	// Handle opening remove modal
	const handleRemoveClick = (item) => {
		setSelectedItem(item);
		setShowRemoveModal(true);
		setSuccessMessage(""); // Clear any previous success message
	};

	// Handle successful removal
	const handleRemoveSuccess = () => {
		setShowRemoveModal(false);
		setSelectedItem(null);
		setSuccessMessage(
			`Successfully removed ${selectedItem?.ingredient_name} from inventory`
		);

		// Clear success message after 5 seconds
		setTimeout(() => setSuccessMessage(""), 5000);
	};

	// Handle modal close
	const handleModalClose = () => {
		setShowRemoveModal(false);
		setSelectedItem(null);
	};

	// Loading state
	if (isLoading) {
		return (
			<div className="bg-white rounded-lg border border-gray-200 p-12 flex items-center justify-center">
				<div className="text-center">
					<div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
					<p className="text-gray-600">Loading inventory...</p>
				</div>
			</div>
		);
	}

	// Error state
	if (isError) {
		return (
			<div className="bg-white rounded-lg border border-red-200 p-12">
				<div className="text-center text-red-600">
					<p className="font-semibold text-lg mb-2">Failed to load inventory</p>
					<p className="text-sm">
						{error?.message || "Please try again later"}
					</p>
				</div>
			</div>
		);
	}

	// Remove/Log Waste view - emphasized buttons
	if (subsection === "remove") {
		return (
			<>
				<div className="bg-white rounded-lg border border-gray-200 p-6 h-full flex flex-col">
					<div className="mb-4">
						<h2 className="text-2xl font-bold text-gray-900 mb-2">
							{getTitle()}
						</h2>
						<p className="text-sm text-gray-600">
							Select an item below to remove it from inventory and log the waste
						</p>
					</div>

					{/* Success Message */}
					{successMessage && (
						<div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
							<p className="text-sm text-green-700 font-medium">
								✓ {successMessage}
							</p>
						</div>
					)}

					{filteredInventory.length === 0 ? (
						<div className="flex-1 flex items-center justify-center">
							<p className="text-gray-500">No items found</p>
						</div>
					) : (
						<div className="overflow-y-auto flex-1">
							<div className="space-y-3">
								{filteredInventory.map((item) => (
									<InventoryCardWithRemove
										key={item.id}
										item={item}
										onRemoveClick={handleRemoveClick}
										emphasized
									/>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Remove Modal */}
				<Modal
					isOpen={showRemoveModal}
					onClose={handleModalClose}
					title="Remove Stock"
					size="md"
				>
					{selectedItem && (
						<RemoveStockForm
							item={selectedItem}
							onSuccess={handleRemoveSuccess}
							onCancel={handleModalClose}
						/>
					)}
				</Modal>
			</>
		);
	}

	// Regular inventory list view
	return (
		<>
			<div className="bg-white rounded-lg border border-gray-200 p-6 h-full flex flex-col">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-2xl font-bold text-gray-900">{getTitle()}</h2>
					<p className="text-sm text-gray-500">
						{filteredInventory.length} items
					</p>
				</div>

				{/* Success Message */}
				{successMessage && (
					<div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
						<p className="text-sm text-green-700 font-medium">
							✓ {successMessage}
						</p>
					</div>
				)}

				{filteredInventory.length === 0 ? (
					<div className="flex-1 flex items-center justify-center">
						<p className="text-gray-500">No items found</p>
					</div>
				) : (
					<div className="overflow-y-auto flex-1">
						<div className="space-y-3">
							{filteredInventory.map((item) => (
								<InventoryCardWithRemove
									key={item.id}
									item={item}
									onRemoveClick={handleRemoveClick}
								/>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Remove Modal */}
			<Modal
				isOpen={showRemoveModal}
				onClose={handleModalClose}
				title="Remove Stock"
				size="md"
			>
				{selectedItem && (
					<RemoveStockForm
						item={selectedItem}
						onSuccess={handleRemoveSuccess}
						onCancel={handleModalClose}
					/>
				)}
			</Modal>
		</>
	);
}

// Updated Inventory Card with Remove Button
function InventoryCardWithRemove({ item, onRemoveClick, emphasized = false }) {
	const isLowStock = item.quantity <= (item.minimum_quantity || 0);

	const getDaysUntilExpiry = () => {
		if (!item.expiration_date) return null;
		const today = new Date();
		const expiration = new Date(item.expiration_date);
		const diffTime = expiration - today;
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays;
	};

	const daysUntilExpiry = getDaysUntilExpiry();
	const isExpiringSoon =
		daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry >= 0;

	return (
		<div
			className={`border rounded-lg p-4 transition-colors ${
				emphasized
					? "border-gray-300 hover:border-red-400 hover:shadow-md"
					: "border-gray-200 hover:border-green-300"
			}`}
		>
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1">
					<h3 className="font-semibold text-gray-900 mb-1">
						{item.ingredient_name}
					</h3>
					<div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
						<span>Category: {item.category}</span>
						<span>Location: {item.location}</span>
					</div>

					{/* Alerts */}
					<div className="mt-3 flex gap-2">
						{isLowStock && (
							<span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
								⚠️ Low Stock
							</span>
						)}
						{isExpiringSoon && (
							<span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
								📅 Expires in {daysUntilExpiry} days
							</span>
						)}
					</div>

					{item.expiration_date && (
						<div className="mt-2 text-xs text-gray-500">
							Expires: {new Date(item.expiration_date).toLocaleDateString()}
						</div>
					)}
				</div>

				<div className="flex flex-col items-end gap-3">
					<div className="text-right">
						<div className="text-2xl font-bold text-gray-900">
							{item.quantity}{" "}
							<span className="text-sm font-normal text-gray-500">
								{item.unit}
							</span>
						</div>
						{item.minimum_quantity && (
							<div className="text-xs text-gray-500">
								Min: {item.minimum_quantity} {item.unit}
							</div>
						)}
					</div>

					{/* Remove Button */}
					<button
						onClick={() => onRemoveClick(item)}
						className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
							emphasized
								? "bg-red-600 text-white hover:bg-red-700 font-medium"
								: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
						}`}
					>
						<Trash2 size={16} />
						<span className="text-sm">Remove</span>
					</button>
				</div>
			</div>
		</div>
	);
}
