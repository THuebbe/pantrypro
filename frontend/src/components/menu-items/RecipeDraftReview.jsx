// frontend\src\components\menu-items\RecipeDraftReview.jsx

import { useState } from "react";
import { AlertTriangle, Trash2, Info } from "lucide-react";

/**
 * Review screen for an AI-drafted recipe. The owner corrects quantities
 * and units, removes lines that are wrong, and saves. Nothing reaches the
 * recipe until Save is pressed.
 */
export default function RecipeDraftReview({
	draft,
	hasExistingRecipe,
	isSaving,
	saveError,
	onSave,
	onCancel,
}) {
	const [lines, setLines] = useState(() =>
		draft.lines.map((line) => ({ ...line, quantity: String(line.quantity) }))
	);

	const updateLine = (ingredientId, changes) => {
		setLines((current) =>
			current.map((line) =>
				line.ingredientId === ingredientId ? { ...line, ...changes } : line
			)
		);
	};

	const removeLine = (ingredientId) => {
		setLines((current) =>
			current.filter((line) => line.ingredientId !== ingredientId)
		);
	};

	const isValidQuantity = (value) => {
		const number = parseFloat(value);
		return Number.isFinite(number) && number > 0;
	};

	const canSave =
		lines.length > 0 && lines.every((line) => isValidQuantity(line.quantity));

	const handleSave = () => {
		if (!canSave) return;

		onSave(
			lines.map((line) => ({
				ingredientId: line.ingredientId,
				quantity: parseFloat(line.quantity),
				unit: line.unit,
				prepLossFactor: line.prepLossFactor || 0,
			}))
		);
	};

	return (
		<div className="space-y-4">
			<div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
				<Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
				<p className="text-sm text-blue-800">
					This is a starting point for one serving of{" "}
					<strong>{draft.menuItemName}</strong>, built only from items in your
					inventory. Correct the amounts to match how your kitchen makes it.
					{draft.confidence === "low" &&
						" The draft is a rough guess for this item, so check it closely."}
				</p>
			</div>

			{draft.note && <p className="text-sm text-gray-600">{draft.note}</p>}

			{lines.length === 0 ? (
				<p className="text-sm text-gray-600 py-4 text-center">
					No ingredients to save. Close this and add ingredients by hand.
				</p>
			) : (
				<div className="space-y-2">
					{lines.map((line) => (
						<div
							key={line.ingredientId}
							className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg"
						>
							<div className="flex-1 min-w-0">
								<p className="font-medium text-gray-900 truncate">
									{line.ingredientName}
								</p>
								<p className="text-xs text-gray-500">
									Counted in {line.inventoryUnit}
								</p>
							</div>
							<input
								type="number"
								min="0"
								step="any"
								inputMode="decimal"
								aria-label={`Quantity of ${line.ingredientName}`}
								value={line.quantity}
								onChange={(e) =>
									updateLine(line.ingredientId, { quantity: e.target.value })
								}
								className={`w-24 px-2 py-2 border rounded-lg text-right ${
									isValidQuantity(line.quantity)
										? "border-gray-300"
										: "border-red-500"
								}`}
							/>
							<select
								aria-label={`Unit for ${line.ingredientName}`}
								value={line.unit}
								onChange={(e) =>
									updateLine(line.ingredientId, { unit: e.target.value })
								}
								className="w-24 px-2 py-2 border border-gray-300 rounded-lg bg-white"
							>
								{line.allowedUnits.map((unit) => (
									<option key={unit} value={unit}>
										{unit}
									</option>
								))}
							</select>
							<button
								type="button"
								onClick={() => removeLine(line.ingredientId)}
								aria-label={`Remove ${line.ingredientName}`}
								className="p-2 text-gray-400 hover:text-red-600"
							>
								<Trash2 size={18} />
							</button>
						</div>
					))}
				</div>
			)}

			{draft.missing.length > 0 && (
				<div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
					<p className="text-sm font-medium text-yellow-800">
						Not in your inventory yet
					</p>
					<p className="text-sm text-yellow-700 mt-1">
						{draft.missing.join(", ")}. Add these to inventory, then add them to
						the recipe, or they won't be tracked.
					</p>
				</div>
			)}

			{draft.rejected.length > 0 && (
				<div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
					<p className="text-sm font-medium text-gray-800">
						Left out of the draft
					</p>
					<ul className="text-sm text-gray-600 mt-1 space-y-1">
						{draft.rejected.map((item, index) => (
							<li key={index}>
								{item.name}: {item.reason}
							</li>
						))}
					</ul>
				</div>
			)}

			{hasExistingRecipe && lines.length > 0 && (
				<div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
					<AlertTriangle
						size={20}
						className="text-red-600 flex-shrink-0 mt-0.5"
					/>
					<p className="text-sm text-red-800">
						Saving replaces the recipe this menu item has now.
					</p>
				</div>
			)}

			{saveError && <p className="text-sm text-red-600">{saveError}</p>}

			<div className="flex justify-end gap-3 pt-2">
				<button
					type="button"
					onClick={onCancel}
					className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
				>
					Discard draft
				</button>
				<button
					type="button"
					onClick={handleSave}
					disabled={!canSave || isSaving}
					className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isSaving ? "Saving..." : "Save recipe"}
				</button>
			</div>
		</div>
	);
}
