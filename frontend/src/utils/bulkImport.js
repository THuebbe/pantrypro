// frontend\src\utils\bulkImport.js

/**
 * Turning a spreadsheet into inventory rows
 *
 * Works for an uploaded .csv file and for cells pasted straight from Excel
 * or Google Sheets (which arrive tab-separated). The first row must be
 * headers; common names for each column are recognised, so "Qty" or
 * "Unit Cost" work without renaming anything.
 */

export const TEMPLATE_HEADERS = [
	"name",
	"unit",
	"quantity",
	"cost_per_unit",
	"category",
	"minimum_quantity",
	"location",
	"storage_type",
];

export const TEMPLATE_CSV = [
	TEMPLATE_HEADERS.join(","),
	"Example: Ground Beef 80/20,lbs,20,4.25,Meat,10,Walk-in cooler,refrigerated",
	"Example: Hot Dog Buns,dozen,6,3.50,Bakery,2,Dry storage,dry",
	"",
].join("\r\n");

// Field -> header spellings it answers to (already simplified, see simplify())
const HEADER_ALIASES = {
	name: ["name", "item", "item name", "ingredient", "ingredient name", "product", "product name", "description"],
	unit: ["unit", "units", "uom", "unit of measure", "counted in", "count unit"],
	quantity: ["quantity", "qty", "on hand", "quantity on hand", "qty on hand", "count", "amount", "stock"],
	costPerUnit: ["cost per unit", "cost", "unit cost", "price", "unit price", "cost each", "price per unit"],
	category: ["category", "type", "group"],
	minimumQuantity: ["minimum quantity", "minimum", "min", "min qty", "par", "par level", "reorder point", "reorder at"],
	location: ["location", "storage location", "where", "shelf", "area"],
	storageType: ["storage type", "storage", "storage temp"],
};

const NUMERIC_FIELDS = new Set(["quantity", "costPerUnit", "minimumQuantity"]);

const EXAMPLE_ROW = /^example\b/i;

function simplify(header) {
	return String(header ?? "")
		.toLowerCase()
		.replace(/\(.*?\)/g, " ")
		.replace(/[_\-/.]+/g, " ")
		.replace(/[^a-z0-9 ]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Split delimited text into rows of cells. Handles quoted cells, doubled
 * quotes, commas or line breaks inside quotes, and \r\n line endings.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseDelimited(text) {
	const source = String(text ?? "").replace(/^\uFEFF/, "");
	const firstLine = source.split(/\r?\n/, 1)[0] || "";
	const delimiter =
		firstLine.includes("\t") ? "\t" : firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";

	const rows = [];
	let row = [];
	let cell = "";
	let inQuotes = false;

	for (let i = 0; i < source.length; i += 1) {
		const char = source[i];

		if (inQuotes) {
			if (char === '"') {
				if (source[i + 1] === '"') {
					cell += '"';
					i += 1;
				} else {
					inQuotes = false;
				}
			} else {
				cell += char;
			}
			continue;
		}

		if (char === '"' && cell === "") {
			inQuotes = true;
		} else if (char === delimiter) {
			row.push(cell);
			cell = "";
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && source[i + 1] === "\n") i += 1;
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
		} else {
			cell += char;
		}
	}

	if (cell !== "" || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}

	return rows;
}

/**
 * Work out which column holds which field
 * @param {string[]} headerRow
 * @returns {{ columns: Object<string, number>, ignored: string[] }}
 */
export function mapHeaders(headerRow) {
	const columns = {};
	const ignored = [];

	headerRow.forEach((header, index) => {
		const simple = simplify(header);
		if (!simple) return;

		const field = Object.keys(HEADER_ALIASES).find(
			(key) => HEADER_ALIASES[key].includes(simple) && columns[key] === undefined
		);

		if (field) {
			columns[field] = index;
		} else {
			ignored.push(String(header).trim());
		}
	});

	return { columns, ignored };
}

function cleanNumber(value) {
	const trimmed = String(value ?? "").trim();
	if (!trimmed) return "";

	// "$4.25", "1,200", "12 lbs" -> the number; anything else is passed on as
	// typed so the server can say what's wrong with it.
	const stripped = trimmed.replace(/[$,\s]/g, "");
	const match = stripped.match(/^-?\d*\.?\d+/);

	return match && /^-?\d*\.?\d+[a-z]*$/i.test(stripped) ? match[0] : trimmed;
}

/**
 * Turn pasted or uploaded text into rows for the bulk add
 * @param {string} text
 * @returns {{ rows: object[], ignored: string[], examplesSkipped: number,
 *   error: string|null }}
 */
export function rowsFromText(text) {
	const table = parseDelimited(text).filter((cells) =>
		cells.some((cell) => cell.trim() !== "")
	);

	if (table.length === 0) {
		return { rows: [], ignored: [], examplesSkipped: 0, error: "There's nothing to read yet." };
	}

	const { columns, ignored } = mapHeaders(table[0]);

	if (columns.name === undefined) {
		return {
			rows: [],
			ignored,
			examplesSkipped: 0,
			error:
				'The first row needs to be column headers, including one called "name". Download the template to see the layout.',
		};
	}

	let examplesSkipped = 0;
	const rows = [];

	for (const cells of table.slice(1)) {
		const row = {};

		for (const [field, index] of Object.entries(columns)) {
			const raw = (cells[index] ?? "").trim();
			row[field] = NUMERIC_FIELDS.has(field) ? cleanNumber(raw) : raw;
		}

		if (EXAMPLE_ROW.test(row.name)) {
			examplesSkipped += 1;
			continue;
		}

		rows.push(row);
	}

	if (rows.length === 0) {
		return {
			rows,
			ignored,
			examplesSkipped,
			error:
				examplesSkipped > 0
					? "Only the example rows are filled in. Add your items below them."
					: "There are headers but no items under them.",
		};
	}

	return { rows, ignored, examplesSkipped, error: null };
}

/**
 * Offer the template as a download
 */
export function downloadTemplate() {
	const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");

	link.href = url;
	link.download = "pantrypro-inventory-template.csv";
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}
