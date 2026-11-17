// frontend\src\components\menu-items\AdjustPricingForm.jsx

import { useState } from "react";
import { useUpdateMenuItem } from "../../hooks/useMenuItems";
import {
	MIN_FOOD_COST,
	MAX_FOOD_COST,
	foodCostPercent,
	priceForFoodCost,
	roundUpToEnding,
	profitPerPlate,
} from "../../utils/pricing";

const TARGETS = [18, 25, 28, 30, 35];

const clamp = (value) => Math.min(MAX_FOOD_COST, Math.max(MIN_FOOD_COST, value));

/**
 * Price and food cost % move together: change one and the other follows.
 * Nothing is saved until "Save price".
 */
export default function AdjustPricingForm({
	menuItem,
	recipeCost,
	uncostedCount = 0,
	onSuccess,
	onCancel,
}) {
	const hasCost = Number.isFinite(recipeCost) && recipeCost > 0;
	const startPercent = foodCostPercent(recipeCost, menuItem.price);

	const [price, setPrice] = useState(menuItem.price.toFixed(2));
	const [percent, setPercent] = useState(
		startPercent ? startPercent.toFixed(1) : ""
	);
	const [error, setError] = useState("");

	const updateMenuItemMutation = useUpdateMenuItem();

	const priceNumber = parseFloat(price);
	const percentNumber = parseFloat(percent);
	const profit = profitPerPlate(recipeCost, priceNumber);
	const changed =
		Number.isFinite(priceNumber) &&
		priceNumber.toFixed(2) !== menuItem.price.toFixed(2);

	const handlePriceChange = (value) => {
		setPrice(value);
		const next = foodCostPercent(recipeCost, parseFloat(value));
		setPercent(next ? next.toFixed(1) : "");
	};

	const handlePercentChange = (value) => {
		setPercent(value);
		const next = priceForFoodCost(recipeCost, parseFloat(value));
		if (next) setPrice(next.toFixed(2));
	};

	const handleRound = (ending) => {
		const rounded = roundUpToEnding(priceNumber, ending);
		if (rounded) handlePriceChange(rounded.toFixed(2));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");

		if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
			setError("Enter a price above $0.00");
			return;
		}

		try {
			await updateMenuItemMutation.mutateAsync({
				id: menuItem.id,
				data: { price: Math.round(priceNumber * 100) / 100 },
			});
			onSuccess();
		} catch (err) {
			setError(
				err.response?.data?.error || "Couldn't save the price. Try again."
			);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			noValidate
			className="space-y-5"
		>
			<div className="grid grid-cols-3 gap-3 text-center">
				<div className="p-3 bg-gray-50 rounded-lg">
					<div className="text-xs text-gray-600">Recipe cost</div>
					<div className="text-lg font-bold text-gray-900">
						{hasCost ? `$${recipeCost.toFixed(2)}` : "--"}
					</div>
				</div>
				<div className="p-3 bg-gray-50 rounded-lg">
					<div className="text-xs text-gray-600">Current price</div>
					<div className="text-lg font-bold text-gray-900">
						${menuItem.price.toFixed(2)}
					</div>
				</div>
				<div className="p-3 bg-gray-50 rounded-lg">
					<div className="text-xs text-gray-600">Profit per plate</div>
					<div className="text-lg font-bold text-green-600">
						{hasCost && profit !== null ? `$${profit.toFixed(2)}` : "--"}
					</div>
				</div>
			</div>

			{!hasCost && (
				<div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
					This recipe has no cost yet, so food cost % can&apos;t be worked
					out. You can still set the price.
				</div>
			)}

			{hasCost && uncostedCount > 0 && (
				<div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
					{uncostedCount === 1
						? "1 ingredient isn't"
						: `${uncostedCount} ingredients aren't`}{" "}
					in the recipe cost yet, so the real food cost is higher than shown.
					Run Validate Recipe to see which.
				</div>
			)}

			<div className="grid grid-cols-2 gap-4">
				<div>
					<label
						htmlFor="adjust-price"
						className="block text-sm font-medium text-gray-700 mb-2"
					>
						Menu price ($)
					</label>
					<input
						id="adjust-price"
						type="number"
						step="0.01"
						min="0"
						inputMode="decimal"
						value={price}
						onChange={(e) => handlePriceChange(e.target.value)}
						className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
					/>
				</div>
				<div>
					<label
						htmlFor="adjust-percent"
						className="block text-sm font-medium text-gray-700 mb-2"
					>
						Food cost (%)
					</label>
					<input
						id="adjust-percent"
						type="number"
						step="0.1"
						min="0"
						inputMode="decimal"
						value={percent}
						disabled={!hasCost}
						onChange={(e) => handlePercentChange(e.target.value)}
						className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
					/>
				</div>
			</div>

			{hasCost && (
				<>
					<div>
						<label
							htmlFor="adjust-slider"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Drag to set food cost %
						</label>
						<input
							id="adjust-slider"
							type="range"
							min={MIN_FOOD_COST}
							max={MAX_FOOD_COST}
							step="0.5"
							value={Number.isFinite(percentNumber) ? clamp(percentNumber) : 30}
							onChange={(e) => handlePercentChange(e.target.value)}
							className="w-full accent-green-600"
						/>
						<div className="flex justify-between text-xs text-gray-500">
							<span>{MIN_FOOD_COST}% (higher price)</span>
							<span>{MAX_FOOD_COST}% (lower price)</span>
						</div>
					</div>

					<div>
						<div className="text-sm font-medium text-gray-700 mb-2">
							Jump to a target
						</div>
						<div className="flex flex-wrap gap-2">
							{TARGETS.map((target) => (
								<button
									key={target}
									type="button"
									onClick={() => handlePercentChange(String(target))}
									className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-green-50 hover:border-green-600"
								>
									{target}%
								</button>
							))}
						</div>
					</div>
				</>
			)}

			<div>
				<div className="text-sm font-medium text-gray-700 mb-2">
					Round the price up
				</div>
				<div className="flex flex-wrap gap-2">
					{[
						{ ending: 0.99, label: ".99" },
						{ ending: 0.49, label: ".49" },
						{ ending: 0, label: "whole dollar" },
					].map((option) => (
						<button
							key={option.label}
							type="button"
							onClick={() => handleRound(option.ending)}
							className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-green-50 hover:border-green-600"
						>
							{option.label}
						</button>
					))}
				</div>
			</div>

			<p className="text-xs text-gray-500">
				This changes the price PantryPro uses for food cost and reports. It
				doesn&apos;t change the price in your POS.
			</p>

			{error && (
				<div className="bg-red-50 border border-red-200 rounded-lg p-3">
					<p className="text-sm text-red-600">{error}</p>
				</div>
			)}

			<div className="flex gap-3 pt-4 border-t border-gray-200">
				<button
					type="button"
					onClick={onCancel}
					disabled={updateMenuItemMutation.isPending}
					className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={!changed || updateMenuItemMutation.isPending}
					className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{updateMenuItemMutation.isPending ? "Saving..." : "Save price"}
				</button>
			</div>
		</form>
	);
}
