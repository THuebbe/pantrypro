// frontend\src\pages\CountSheet.jsx

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import api from "../core/database/api";
import { formatQty, formatSheetDate, orderForCount } from "../utils/countMath";

const BLANK_LINES = 3;

/**
 * A printable inventory count sheet. Blind by default: no expected
 * quantities, so whoever counts writes what's there, not what the paper
 * says should be there.
 */
export default function CountSheet() {
	const { data, isLoading, isError, error } = useQuery({
		queryKey: ["count-sheet"],
		queryFn: async () => (await api.get("/inventory/count-sheet")).data,
	});

	const groups = useMemo(() => orderForCount(data?.items || []), [data]);

	const [hidden, setHidden] = useState(() => new Set());
	const [showExpected, setShowExpected] = useState(false);
	const [pagePerLocation, setPagePerLocation] = useState(true);

	const printed = groups.filter((group) => !hidden.has(group.place));
	const itemCount = printed.reduce((sum, group) => sum + group.items.length, 0);
	const today = formatSheetDate();

	const toggle = (place) => {
		setHidden((current) => {
			const next = new Set(current);
			if (next.has(place)) next.delete(place);
			else next.add(place);
			return next;
		});
	};

	if (isLoading) {
		return <p className="p-8 text-gray-600">Loading the count sheet...</p>;
	}

	if (isError) {
		return (
			<p className="p-8 text-red-600">
				{error?.response?.data?.error || "Couldn't load the count sheet. Try again."}
			</p>
		);
	}

	return (
		<div className="min-h-screen bg-gray-100 print:bg-white">
			{/* Options: on screen only */}
			<div className="print:hidden bg-white border-b border-gray-200">
				<div className="max-w-3xl mx-auto p-4 space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h1 className="text-xl font-bold text-gray-900">Count sheet</h1>
							<p className="text-sm text-gray-600">
								{itemCount} item{itemCount === 1 ? "" : "s"} in {printed.length} location
								{printed.length === 1 ? "" : "s"}. Enter the numbers in Inventory &gt; Count;
								the item numbers match.
							</p>
						</div>
						<button
							type="button"
							onClick={() => window.print()}
							disabled={itemCount === 0}
							className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
						>
							<Printer size={18} />
							Print
						</button>
					</div>

					{groups.length > 1 && (
						<fieldset>
							<legend className="text-sm font-medium text-gray-700 mb-2">Locations</legend>
							<div className="flex flex-wrap gap-x-4 gap-y-2">
								{groups.map((group) => (
									<label key={group.place} className="inline-flex items-center gap-2 text-sm">
										<input
											type="checkbox"
											checked={!hidden.has(group.place)}
											onChange={() => toggle(group.place)}
										/>
										{group.place} ({group.items.length})
									</label>
								))}
							</div>
						</fieldset>
					)}

					<div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
						<label className="inline-flex items-center gap-2">
							<input
								type="checkbox"
								checked={pagePerLocation}
								onChange={(e) => setPagePerLocation(e.target.checked)}
							/>
							Start each location on a new page
						</label>
						<label className="inline-flex items-center gap-2">
							<input
								type="checkbox"
								checked={showExpected}
								onChange={(e) => setShowExpected(e.target.checked)}
							/>
							Show expected quantities
						</label>
					</div>
					{showExpected && (
						<p className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-2">
							With expected quantities printed, people tend to write the printed number.
							Leave this off for a real count; use it for quick spot checks.
						</p>
					)}
				</div>
			</div>

			{/* The sheet */}
			<div className="max-w-3xl mx-auto bg-white my-6 p-8 shadow print:shadow-none print:my-0 print:p-0 print:max-w-none text-gray-900">
				{itemCount === 0 ? (
					<p className="text-gray-600">Nothing to count. Pick at least one location.</p>
				) : (
					printed.map((group, index) => (
						<section
							key={group.place}
							className={
								index === 0 ? "" : pagePerLocation ? "break-before-page mt-8 print:mt-0" : "mt-8 print:mt-6"
							}
						>
							{(index === 0 || pagePerLocation) && (
								<SheetHeader name={data?.restaurantName} date={today} />
							)}

							<h2 className="text-lg font-bold border-b-2 border-gray-900 pb-1 mb-2">
								{group.place}
							</h2>

							<table className="w-full text-sm border-collapse">
								<thead>
									<tr className="text-left border-b border-gray-400">
										<th className="py-1 pr-2 w-10">#</th>
										<th className="py-1 pr-2">Item</th>
										<th className="py-1 pr-2 w-14">Unit</th>
										{showExpected && <th className="py-1 pr-2 w-20 text-right">Expected</th>}
										<th className="py-1 pr-2 w-28">Counted</th>
										<th className="py-1 w-40">Notes</th>
									</tr>
								</thead>
								<tbody>
									{group.items.map((item) => (
										<tr key={item.id} className="border-b border-gray-300 break-inside-avoid">
											<td className="py-2 pr-2 text-gray-500">{item.number}</td>
											<td className="py-2 pr-2">{item.ingredient_name}</td>
											<td className="py-2 pr-2">{item.unit}</td>
											{showExpected && (
												<td className="py-2 pr-2 text-right">{formatQty(item.quantity)}</td>
											)}
											<td className="py-1 pr-2">
												<div className="h-7 border border-gray-500 rounded-sm" />
											</td>
											<td className="py-2" />
										</tr>
									))}
									{Array.from({ length: BLANK_LINES }, (_, i) => (
										<tr key={`blank-${i}`} className="border-b border-gray-300 break-inside-avoid">
											<td className="py-2 pr-2 text-gray-400">+</td>
											<td className="py-2 pr-2" />
											<td className="py-2 pr-2" />
											{showExpected && <td />}
											<td className="py-1 pr-2">
												<div className="h-7 border border-gray-500 rounded-sm" />
											</td>
											<td className="py-2" />
										</tr>
									))}
								</tbody>
							</table>
							<p className="mt-1 text-xs text-gray-500">
								+ lines: items found here that aren&apos;t on the list.
							</p>
						</section>
					))
				)}
			</div>
		</div>
	);
}

function SheetHeader({ name, date }) {
	return (
		<header className="mb-4">
			<div className="flex items-baseline justify-between gap-4">
				<p className="text-xl font-bold">{name || "Inventory"}</p>
				<p className="text-sm">Inventory count · printed {date}</p>
			</div>
			<div className="mt-3 grid grid-cols-3 gap-4 text-sm">
				<p>
					Counted by <span className="inline-block w-28 border-b border-gray-900" />
				</p>
				<p>
					Start time <span className="inline-block w-16 border-b border-gray-900" />
				</p>
				<p>
					End time <span className="inline-block w-16 border-b border-gray-900" />
				</p>
			</div>
		</header>
	);
}
