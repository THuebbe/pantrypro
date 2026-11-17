// frontend\src\components\inventory\CountInventory.jsx

import { useMemo, useState } from "react";
import { Search, CheckCircle, AlertTriangle } from "lucide-react";
import { useSaveCount } from "../../hooks/useBulkInventory";
import {
	COUNT_REASONS,
	NO_LOCATION,
	formatMoney,
	formatQty,
	round,
	varianceFor,
} from "../../utils/countMath";

/**
 * Enter what was physically counted. Blank means not counted, and that
 * item is left alone.
 */
export default function CountInventory({ inventory = [], onDone, onDirtyChange }) {
	const [counts, setCounts] = useState({});
	const [search, setSearch] = useState("");
	const [reason, setReason] = useState("cycle_count");
	const [note, setNote] = useState("");
	const [error, setError] = useState("");
	const [result, setResult] = useState(null);

	const saveCount = useSaveCount();

	const setCount = (id, value) => {
		setCounts((current) => {
			const next = { ...current, [id]: value };
			onDirtyChange?.(Object.values(next).some((v) => String(v).trim() !== ""));
			return next;
		});
	};

	// Grouped by where things are kept, so the list follows a walk through
	// the storage areas.
	const groups = useMemo(() => {
		const term = search.trim().toLowerCase();
		const visible = inventory
			.filter(
				(item) =>
					!term ||
					(item.ingredient_name || "").toLowerCase().includes(term) ||
					(item.category || "").toLowerCase().includes(term) ||
					(item.location || "").toLowerCase().includes(term)
			)
			.sort((a, b) =>
				(a.ingredient_name || "").localeCompare(b.ingredient_name || "")
			);

		const byLocation = new Map();
		for (const item of visible) {
			const place = item.location?.trim() || NO_LOCATION;
			if (!byLocation.has(place)) byLocation.set(place, []);
			byLocation.get(place).push(item);
		}

		return [...byLocation.entries()].sort(([a], [b]) => {
			if (a === NO_LOCATION) return 1;
			if (b === NO_LOCATION) return -1;
			return a.localeCompare(b);
		});
	}, [inventory, search]);

	const entered = inventory
		.map((item) => ({ item, variance: varianceFor(item, counts[item.id]) }))
		.filter((entry) => entry.variance);

	const invalid = inventory.filter((item) => {
		const value = counts[item.id];
		return value !== undefined && String(value).trim() !== "" && !varianceFor(item, value);
	});

	const netValue = round(
		entered.reduce((sum, e) => sum + (e.variance.value || 0), 0),
		2
	);

	const handleSave = async () => {
		setError("");

		if (invalid.length > 0) {
			setError(
				`Fix the count for ${invalid.map((i) => i.ingredient_name).join(", ")}: it must be a number, zero or more.`
			);
			return;
		}

		try {
			const outcome = await saveCount.mutateAsync({
				reason,
				note,
				counts: entered.map(({ item }) => ({
					inventoryId: item.id,
					quantity: Number(counts[item.id]),
				})),
			});
			setResult(outcome);
			onDirtyChange?.(false);
		} catch (err) {
			setError(err.response?.data?.error || "Couldn't save the count. Try again.");
		}
	};

	if (result) {
		return (
			<div className="space-y-4">
				<div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
					<CheckCircle className="text-green-600 flex-shrink-0" size={22} />
					<div className="text-sm text-green-800 space-y-1">
						<p className="font-medium">
							Saved {result.counted} count{result.counted === 1 ? "" : "s"}.
						</p>
						<p>
							{result.changed === 0
								? "Every count matched what PantryPro had."
								: `${result.changed} item${result.changed === 1 ? "" : "s"} changed, worth ${formatMoney(result.valueChange)} overall.`}
						</p>
					</div>
				</div>

				{!result.historySaved && (
					<div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
						Quantities were updated, but the count history wasn&apos;t recorded. The
						inventory history table hasn&apos;t been set up yet.
					</div>
				)}

				{result.failed?.length > 0 && (
					<div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
						These didn&apos;t save, count them again: {result.failed.join(", ")}
					</div>
				)}

				<button
					type="button"
					onClick={onDone}
					className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
				>
					Done
				</button>
			</div>
		);
	}

	if (inventory.length === 0) {
		return (
			<p className="text-sm text-gray-600">
				There&apos;s nothing to count yet. Add items to your inventory first.
			</p>
		);
	}

	return (
		<div className="space-y-4">
			<p className="text-sm text-gray-600">
				Type what you counted. Leave an item blank to skip it; it won&apos;t change.
			</p>

			<div className="relative">
				<Search
					size={18}
					className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
				/>
				<input
					type="search"
					aria-label="Find an item"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Find an item, category or location"
					className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
				/>
			</div>

			<div className="space-y-5">
				{groups.map(([place, items]) => (
					<section key={place}>
						<h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
							{place}
						</h3>
						<div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
							{items.map((item) => (
								<CountRow
									key={item.id}
									item={item}
									value={counts[item.id] ?? ""}
									onChange={(value) => setCount(item.id, value)}
								/>
							))}
						</div>
					</section>
				))}
				{groups.length === 0 && (
					<p className="text-sm text-gray-500">No items match &quot;{search}&quot;.</p>
				)}
			</div>

			<div className="sticky bottom-0 bg-white pt-4 border-t border-gray-200 space-y-3">
				<p className="text-sm text-gray-700">
					{entered.length} of {inventory.length} counted
					{entered.length > 0 && <> · net {formatMoney(netValue)}</>}
				</p>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<select
						aria-label="Reason"
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						className="px-3 py-2 border border-gray-300 rounded-lg"
					>
						{COUNT_REASONS.map((r) => (
							<option key={r.value} value={r.value}>
								{r.label}
							</option>
						))}
					</select>
					<input
						aria-label="Note"
						value={note}
						maxLength={300}
						onChange={(e) => setNote(e.target.value)}
						placeholder="Note (optional)"
						className="px-3 py-2 border border-gray-300 rounded-lg"
					/>
				</div>

				{error && (
					<div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 text-sm text-red-700">
						<AlertTriangle size={18} className="flex-shrink-0" />
						{error}
					</div>
				)}

				<button
					type="button"
					onClick={handleSave}
					disabled={entered.length === 0 || saveCount.isPending}
					className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{saveCount.isPending
						? "Saving..."
						: entered.length === 0
						? "Save counts"
						: `Save ${entered.length} count${entered.length === 1 ? "" : "s"}`}
				</button>
			</div>
		</div>
	);
}

function CountRow({ item, value, onChange }) {
	const variance = varianceFor(item, value);
	const bad = String(value).trim() !== "" && !variance;

	let tone = "text-gray-500";
	if (variance && variance.change < 0) tone = "text-red-600";
	if (variance && variance.change > 0) tone = "text-green-700";

	return (
		<div className="flex items-center gap-3 px-3 py-2">
			<div className="flex-1 min-w-0">
				<p className="font-medium text-gray-900 truncate">{item.ingredient_name}</p>
				<p className="text-xs text-gray-500">
					PantryPro has {formatQty(item.quantity)} {item.unit}
				</p>
				{variance && (
					<p className={`text-xs font-medium ${tone}`}>
						{variance.change === 0
							? "Matches"
							: `${variance.change > 0 ? "+" : ""}${formatQty(variance.change)} ${item.unit}`}
						{variance.change !== 0 && variance.value !== null && ` (${formatMoney(variance.value)})`}
					</p>
				)}
				{bad && <p className="text-xs text-red-600">Enter a number, zero or more</p>}
			</div>
			<div className="flex items-center gap-1">
				<input
					aria-label={`Counted ${item.ingredient_name}`}
					value={value}
					inputMode="decimal"
					onChange={(e) => onChange(e.target.value)}
					placeholder="—"
					className={`w-20 px-2 py-2 text-right border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${bad ? "border-red-500" : "border-gray-300"}`}
				/>
				<span className="w-10 text-xs text-gray-500">{item.unit}</span>
			</div>
		</div>
	);
}
