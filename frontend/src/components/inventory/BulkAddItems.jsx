// frontend\src\components\inventory\BulkAddItems.jsx

import { useState } from "react";
import { Download, Upload, Trash2, CheckCircle, AlertTriangle } from "lucide-react";
import { usePreviewBulkAdd, useCommitBulkAdd } from "../../hooks/useBulkInventory";
import { rowsFromText, downloadTemplate } from "../../utils/bulkImport";
import { UNIT_OPTIONS } from "../../utils/recipeUnits";

const FIELDS = [
	"name",
	"unit",
	"quantity",
	"costPerUnit",
	"category",
	"minimumQuantity",
	"location",
	"storageType",
];

const STATUS = {
	new: { label: "New item", className: "bg-green-50 text-green-700 border-green-200" },
	catalog: { label: "From catalog", className: "bg-blue-50 text-blue-700 border-blue-200" },
	exists: { label: "Already stocked", className: "bg-gray-100 text-gray-600 border-gray-200" },
	error: { label: "Needs fixing", className: "bg-red-50 text-red-700 border-red-200" },
	edited: { label: "Edited", className: "bg-yellow-50 text-yellow-800 border-yellow-200" },
};

const READY = new Set(["new", "catalog", "edited"]);

let nextKey = 1;

function toPayload(row) {
	return Object.fromEntries(FIELDS.map((field) => [field, row[field] ?? ""]));
}

function errorText(error, fallback) {
	return error?.response?.data?.error || fallback;
}

/**
 * Add many inventory items at once from a CSV file or a paste
 */
export default function BulkAddItems({ onDone }) {
	const [text, setText] = useState("");
	const [readError, setReadError] = useState("");
	const [notes, setNotes] = useState([]);
	const [rows, setRows] = useState(null);
	const [result, setResult] = useState(null);

	const preview = usePreviewBulkAdd();
	const commit = useCommitBulkAdd();
	const busy = preview.isPending || commit.isPending;

	const applyPlan = (current, plan) =>
		current.map((row, i) => {
			const checked = plan.rows[i] || {};
			return {
				...row,
				status: checked.status || "error",
				message: checked.message || "",
				catalogName:
					checked.status === "catalog" && checked.name !== row.name ? checked.name : "",
			};
		});

	const check = async (current) => {
		setReadError("");
		try {
			const plan = await preview.mutateAsync(current.map(toPayload));
			setRows(applyPlan(current, plan));
		} catch (error) {
			setReadError(errorText(error, "Couldn't check those rows. Try again."));
		}
	};

	const handleRead = async (source) => {
		setResult(null);
		const parsed = rowsFromText(source);

		const found = [];
		if (parsed.examplesSkipped > 0) {
			found.push(
				`Skipped ${parsed.examplesSkipped} example row${parsed.examplesSkipped === 1 ? "" : "s"}.`
			);
		}
		if (parsed.ignored.length > 0) {
			found.push(`Not used: ${parsed.ignored.join(", ")}.`);
		}
		setNotes(found);

		if (parsed.error) {
			setReadError(parsed.error);
			return;
		}

		await check(parsed.rows.map((row) => ({ ...row, key: nextKey++ })));
	};

	const handleFile = async (event) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;

		if (!/\.(csv|tsv|txt)$/i.test(file.name)) {
			setReadError(
				"Save the spreadsheet as CSV first (File > Save As or Download > CSV), then upload that."
			);
			return;
		}

		await handleRead(await file.text());
	};

	const updateRow = (key, field, value) => {
		setRows((current) =>
			current.map((row) =>
				row.key === key
					? { ...row, [field]: value, status: "edited", message: "", catalogName: "" }
					: row
			)
		);
	};

	const removeRow = (key) => {
		setRows((current) => current.filter((row) => row.key !== key));
	};

	const handleAdd = async () => {
		const toSend = rows.filter((row) => row.status !== "exists");
		const alreadyStocked = rows.length - toSend.length;

		try {
			const outcome = await commit.mutateAsync(toSend.map(toPayload));

			// Rows the server turned down stay on screen with the reason.
			const leftover = outcome.skipped
				.map((skip) => {
					const row = toSend[skip.row - 1];
					return row ? { ...row, status: skip.status, message: skip.message } : null;
				})
				.filter((row) => row && row.status === "error");

			const stocked = alreadyStocked + outcome.skipped.filter((s) => s.status === "exists").length;

			setResult({ added: outcome.added, stocked, left: leftover.length });
			setRows(leftover.length > 0 ? leftover : null);
			setText("");
		} catch (error) {
			setReadError(errorText(error, "Couldn't add those items. Try again."));
		}
	};

	// ----- Done -----
	if (result && !rows) {
		return (
			<div className="space-y-4">
				<div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
					<CheckCircle className="text-green-600 flex-shrink-0" size={22} />
					<div className="text-sm text-green-800">
						<p className="font-medium">
							Added {result.added} item{result.added === 1 ? "" : "s"}.
						</p>
						{result.stocked > 0 && (
							<p className="mt-1">
								{result.stocked} {result.stocked === 1 ? "was" : "were"} already in your
								inventory and left as they were. Use Count to change quantities.
							</p>
						)}
					</div>
				</div>
				<div className="flex gap-3">
					<button
						type="button"
						onClick={() => setResult(null)}
						className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
					>
						Add more
					</button>
					<button
						type="button"
						onClick={onDone}
						className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
					>
						Done
					</button>
				</div>
			</div>
		);
	}

	// ----- Review -----
	if (rows) {
		const readyCount = rows.filter((row) => READY.has(row.status)).length;
		const errorCount = rows.filter((row) => row.status === "error").length;
		const hasEdits = rows.some((row) => row.status === "edited");

		return (
			<div className="space-y-4">
				{result && (
					<div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
						Added {result.added}. {result.left} row{result.left === 1 ? "" : "s"} below
						still need{result.left === 1 ? "s" : ""} fixing.
					</div>
				)}

				{notes.length > 0 && !result && (
					<p className="text-sm text-gray-500">{notes.join(" ")}</p>
				)}

				<p className="text-sm text-gray-700">
					{readyCount} ready
					{errorCount > 0 && `, ${errorCount} need fixing`}
					{rows.length - readyCount - errorCount > 0 &&
						`, ${rows.length - readyCount - errorCount} already stocked (will be skipped)`}
					. Fix rows here, or remove them. Nothing is saved until you add.
				</p>

				<div className="overflow-x-auto border border-gray-200 rounded-lg">
					<table className="min-w-full text-sm">
						<thead className="bg-gray-50 text-left text-gray-600">
							<tr>
								<th className="px-3 py-2 font-medium">Status</th>
								<th className="px-3 py-2 font-medium">Name</th>
								<th className="px-3 py-2 font-medium">Unit</th>
								<th className="px-3 py-2 font-medium">On hand</th>
								<th className="px-3 py-2 font-medium">Cost/unit</th>
								<th className="px-3 py-2 font-medium">Category</th>
								<th className="px-3 py-2" />
							</tr>
						</thead>
						<tbody>
							{rows.map((row, index) => (
								<BulkRow
									key={row.key}
									row={row}
									index={index}
									onChange={updateRow}
									onRemove={removeRow}
								/>
							))}
						</tbody>
					</table>
				</div>

				{readError && <p className="text-sm text-red-600">{readError}</p>}

				<div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
					<button
						type="button"
						onClick={() => {
							setRows(null);
							setResult(null);
						}}
						disabled={busy}
						className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
					>
						Start over
					</button>
					{hasEdits && (
						<button
							type="button"
							onClick={() => check(rows)}
							disabled={busy}
							className="px-4 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50"
						>
							{preview.isPending ? "Checking..." : "Check again"}
						</button>
					)}
					<button
						type="button"
						onClick={handleAdd}
						disabled={busy || readyCount === 0}
						className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{commit.isPending
							? "Adding..."
							: `Add ${readyCount} item${readyCount === 1 ? "" : "s"}`}
					</button>
				</div>
			</div>
		);
	}

	// ----- Input -----
	return (
		<div className="space-y-5">
			<div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 space-y-2">
				<p>
					Start from the template, or use your own spreadsheet as long as the first row is
					headers and one of them is <span className="font-medium">name</span>. Units can
					be lbs, oz, each, dozen, gal and so on.
				</p>
				<p>
					Only new items are added. Anything already in your inventory is left alone; use
					Count to change quantities.
				</p>
				<button
					type="button"
					onClick={downloadTemplate}
					className="inline-flex items-center gap-2 text-green-700 font-medium hover:text-green-800"
				>
					<Download size={16} />
					Download the template
				</button>
			</div>

			<div>
				<label
					htmlFor="bulk-file"
					className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
				>
					<Upload size={18} />
					Upload a CSV file
				</label>
				<input
					id="bulk-file"
					type="file"
					accept=".csv,.tsv,.txt,text/csv"
					onChange={handleFile}
					className="sr-only"
				/>
			</div>

			<div>
				<label
					htmlFor="bulk-paste"
					className="block text-sm font-medium text-gray-700 mb-2"
				>
					Or paste from a spreadsheet (include the header row)
				</label>
				<textarea
					id="bulk-paste"
					rows={6}
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder={"name\tunit\tquantity\tcost_per_unit\nOnions\tlbs\t10\t0.89"}
					className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
				/>
			</div>

			{readError && (
				<div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 text-sm text-red-700">
					<AlertTriangle size={18} className="flex-shrink-0" />
					{readError}
				</div>
			)}

			<div className="flex gap-3 pt-4 border-t border-gray-200">
				<button
					type="button"
					onClick={onDone}
					className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={() => handleRead(text)}
					disabled={!text.trim() || busy}
					className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{preview.isPending ? "Checking..." : "Check rows"}
				</button>
			</div>
		</div>
	);
}

function BulkRow({ row, index, onChange, onRemove }) {
	const status = STATUS[row.status] || STATUS.error;
	const unitKnown = UNIT_OPTIONS.some((opt) => opt.value === row.unit);
	const locked = row.status === "exists";
	const input =
		"w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-50";

	return (
		<>
			<tr className="border-t border-gray-100 align-top">
				<td className="px-3 py-2 whitespace-nowrap">
					<span className={`inline-block px-2 py-0.5 rounded border text-xs ${status.className}`}>
						{status.label}
					</span>
				</td>
				<td className="px-3 py-2 min-w-[12rem]">
					<input
						aria-label={`Row ${index + 1} name`}
						value={row.name}
						disabled={locked}
						onChange={(e) => onChange(row.key, "name", e.target.value)}
						className={input}
					/>
					{row.catalogName && (
						<p className="mt-1 text-xs text-blue-700">Matches {row.catalogName}</p>
					)}
				</td>
				<td className="px-3 py-2 min-w-[6rem]">
					<select
						aria-label={`Row ${index + 1} unit`}
						value={row.unit}
						disabled={locked}
						onChange={(e) => onChange(row.key, "unit", e.target.value)}
						className={input}
					>
						<option value="">
							{row.status === "catalog" ? "Catalog's unit" : "Choose..."}
						</option>
						{!unitKnown && row.unit && (
							<option value={row.unit}>{row.unit} (not usable)</option>
						)}
						{UNIT_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.value}
							</option>
						))}
					</select>
				</td>
				<td className="px-3 py-2 min-w-[5rem]">
					<input
						aria-label={`Row ${index + 1} on hand`}
						value={row.quantity}
						inputMode="decimal"
						disabled={locked}
						onChange={(e) => onChange(row.key, "quantity", e.target.value)}
						className={input}
					/>
				</td>
				<td className="px-3 py-2 min-w-[5rem]">
					<input
						aria-label={`Row ${index + 1} cost per unit`}
						value={row.costPerUnit}
						inputMode="decimal"
						disabled={locked}
						onChange={(e) => onChange(row.key, "costPerUnit", e.target.value)}
						className={input}
					/>
				</td>
				<td className="px-3 py-2 min-w-[7rem]">
					<input
						aria-label={`Row ${index + 1} category`}
						value={row.category}
						disabled={locked}
						onChange={(e) => onChange(row.key, "category", e.target.value)}
						className={input}
					/>
				</td>
				<td className="px-3 py-2">
					<button
						type="button"
						aria-label={`Remove row ${index + 1}`}
						onClick={() => onRemove(row.key)}
						className="p-1 text-gray-400 hover:text-red-600"
					>
						<Trash2 size={16} />
					</button>
				</td>
			</tr>
			{row.message && (
				<tr>
					<td />
					<td colSpan={6} className={`px-3 pb-2 text-xs ${row.status === "error" ? "text-red-600" : "text-gray-500"}`}>
						{row.message}
					</td>
				</tr>
			)}
		</>
	);
}
