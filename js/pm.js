import {
	getActiveVisit,
	insertPMItem,
	getPMItemsByVisit,
	calculateSummary,
	updateVisitSummary,
} from "./db.js";

let activeVisit = null;

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
	activeVisit = await getActiveVisit();

	if (!activeVisit) {
		alert("Tidak ada visit aktif.");
		window.location.href = "visit.html";
		return;
	}

	renderVisitHeader();
	initDropdowns();
	await refreshTable();

	document.getElementById("pm-form").addEventListener("submit", handleSubmit);
});

/* =========================================================
   VISIT HEADER
   ========================================================= */
function renderVisitHeader() {
	document.getElementById("visit-pkt").textContent = activeVisit.pkt;
	document.getElementById("visit-date").textContent = activeVisit.visitDate;
	document.getElementById("visit-bank").textContent = activeVisit.bank;
	document.getElementById("visit-engineer").textContent = activeVisit.engineer;
	document.getElementById("visit-ok").textContent = activeVisit.totalOK || 0;
	document.getElementById("visit-ng").textContent = activeVisit.totalNG || 0;
}

/* =========================================================
   DROPDOWNS
   ========================================================= */
function initDropdowns() {
	/* Cassette Type */
	const cassette = document.getElementById("cassetteType");
	cassette.innerHTML = `
    <option value="RC60">RC60</option>
    <option value="RJC">RJC</option>
  `;

	// Auto-fill prefix when cassette type changes
	cassette.addEventListener("change", (e) => {
		const v = e.target.value || "";
		const prefixInput = document.getElementById("prefix");
		if (!prefixInput) return;
		if (v.startsWith("RC")) prefixInput.value = "CGQA";
		else if (v === "RJC") prefixInput.value = "CGIS";
		else prefixInput.value = "";
	});

	// Set initial prefix based on current selection
	(function setInitialPrefix() {
		const v = cassette.value || "";
		const prefixInput = document.getElementById("prefix");
		if (!prefixInput) return;
		if (v.startsWith("RC")) prefixInput.value = "CGQA";
		else if (v === "RJC") prefixInput.value = "CGIS";
	})();

	/* Production Month */
	const month = document.getElementById("productionMonth");
	[
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	].forEach((m) => {
		month.innerHTML += `<option value="${m}">${m}</option>`;
	});

	/* Production Year */
	const year = document.getElementById("productionYear");
	const now = new Date().getFullYear();
	for (let y = now; y >= 2018; y--) {
		year.innerHTML += `<option value="${y}">${y}</option>`;
	}

	/* Action */
	document.getElementById("action").innerHTML = `
    <option value="Clean">Clean</option>
    <option value="Check">Check</option>
    <option value="Replace">Replace</option>
  `;

	/* Status */
	document.getElementById("status").innerHTML = `
    <option value="OK">OK</option>
    <option value="NG">NG</option>
  `;
}

/* =========================================================
   SUBMIT HANDLER
   ========================================================= */
async function handleSubmit(e) {
	e.preventDefault();

	const cassetteType = cassetteTypeValue();
	const sn = buildSerialNumber(cassetteType);
	if (!sn) return;

	const item = {
		visitId: activeVisit.id,
		cassetteType,
		serialNumber: sn,
		productionMonth: document.getElementById("productionMonth").value,
		productionYear: Number(document.getElementById("productionYear").value),
		revision: Number(document.getElementById("revision").value),
		action: document.getElementById("action").value,
		status: document.getElementById("status").value,
		notes: document.getElementById("notes").value || "",
	};

	await insertPMItem(item);
	await refreshTable();

	e.target.reset();
}

/* =========================================================
   SERIAL NUMBER BUILDER
   ========================================================= */
function cassetteTypeValue() {
	return document.getElementById("cassetteType").value;
}

function buildSerialNumber(type) {
	const suffix = document.getElementById("serialNumber").value.trim();

	if (!/^\d{6}$/.test(suffix)) {
		alert("Serial number harus 6 digit angka");
		return null;
	}

	const prefix = type === "RC60" ? "CGQA" : "CGIS";
	return prefix + suffix;
}

/* =========================================================
   TABLE & SUMMARY
   ========================================================= */
async function refreshTable() {
	const items = await getPMItemsByVisit(activeVisit.id);
	const tbody = document.getElementById("pm-table-body");

	tbody.innerHTML = "";

	// Detect exact duplicates and similar suffixes (last 4 chars)
	const serialCounts = {};
	const suffixCounts = {};
	const SUFFIX_LEN = 4;

	items.forEach((it) => {
		const sn = it.serialNumber || "";
		serialCounts[sn] = (serialCounts[sn] || 0) + 1;
		const suf = sn.slice(-SUFFIX_LEN);
		suffixCounts[suf] = (suffixCounts[suf] || 0) + 1;
	});

	items.forEach((i, idx) => {
		const sn = i.serialNumber || "";
		const suf = sn.slice(-SUFFIX_LEN);
		let rowClass = "";

		if (serialCounts[sn] > 1) rowClass = "duplicate";
		else if (suffixCounts[suf] > 1) rowClass = "similar";

		tbody.innerHTML += `
      <tr class="${rowClass}">
        <td>${idx + 1}</td>
        <td>${i.cassetteType}</td>
        <td>${i.serialNumber}</td>
        <td>${i.productionMonth}-${i.productionYear}</td>
        <td>${i.revision}</td>
        <td>${i.action}</td>
        <td>${i.status}</td>
        <td>${i.notes || "-"}</td>
      </tr>
    `;
	});

	const summary = calculateSummary(items);
	await updateVisitSummary(activeVisit.id, summary.ok, summary.ng);

	activeVisit.totalOK = summary.ok;
	activeVisit.totalNG = summary.ng;
	renderVisitHeader();
}

document.getElementById("export-xlsx").addEventListener("click", exportXlsx);

async function exportXlsx() {
	if (!activeVisit) return;

	const items = await getPMItemsByVisit(activeVisit.id);
	if (!items.length) {
		alert("Tidak ada data PM");
		return;
	}

	/* ===============================
     BUILD RAW DATA
     =============================== */
	const rows = [
		["PM Cassette Report"],
		[],
		["PKT", , activeVisit.pkt],
		["Engineer", , activeVisit.engineer],
		["Visit Date", , activeVisit.visitDate],
		["Bank", , activeVisit.bank || "-"],
		["Total OK", , activeVisit.totalOK || 0],
		["Total NG", , activeVisit.totalNG || 0],
		[],
		[
			"No",
			"Cassette Type",
			"Serial Number",
			"Production Month",
			"Production Year",
			"Revision",
			"Action",
			"Status",
			"Notes",
		],
	];

	items.forEach((i, idx) => {
		rows.push([
			idx + 1,
			i.cassetteType,
			i.serialNumber,
			i.productionMonth,
			i.productionYear,
			i.revision,
			i.action,
			i.status,
			i.notes || "",
		]);
	});

	// Prefer ExcelJS in browser for reliable styling support
	if (window.ExcelJS && window.saveAs) {
		const workbook = new ExcelJS.Workbook();
		workbook.creator = "PM Cassette";
		const wsExcel = workbook.addWorksheet("PM Cassette");

		// Add rows
		rows.forEach((r) => wsExcel.addRow(r));

		// Apply merges (A1:B1 and A3:B3..A8:B8)
		wsExcel.mergeCells("A1:B1");
		for (let rr = 3; rr <= 8; rr++) wsExcel.mergeCells(`A${rr}:B${rr}`);

		// Align left for first 8 rows and bold first row
		for (let rr = 1; rr <= 8; rr++) {
			const row = wsExcel.getRow(rr);
			row.alignment = { horizontal: "left", vertical: "middle" };
			if (rr === 1) row.font = { bold: true };
			row.commit();
		}

		// Table header and data start at row 10 (1-based)
		const startRowExcel = 10;
		const endRowExcel = startRowExcel + items.length;
		const lastCol = 9; // columns A..I

		// Border style
		const border = {
			top: { style: "thin", color: { argb: "FF000000" } },
			left: { style: "thin", color: { argb: "FF000000" } },
			bottom: { style: "thin", color: { argb: "FF000000" } },
			right: { style: "thin", color: { argb: "FF000000" } },
		};

		const colLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

		for (let rr = startRowExcel; rr <= endRowExcel; rr++) {
			for (let ci = 0; ci < lastCol; ci++) {
				const addr = `${colLetters[ci]}${rr}`;
				const cell = wsExcel.getCell(addr);
				if (!cell.value) cell.value = "";
				cell.border = border;
				cell.alignment = { vertical: "middle" };
				if (rr === startRowExcel) cell.font = { bold: true };
			}
		}

		// Column widths
		wsExcel.columns = [
			{ width: 4 },
			{ width: 16 },
			{ width: 20 },
			{ width: 18 },
			{ width: 16 },
			{ width: 10 },
			{ width: 12 },
			{ width: 10 },
			{ width: 24 },
		];

		const pktSafe = activeVisit.pkt.replace(/\s+/g, "_");
		const fileName = `PM_${pktSafe}_${activeVisit.visitDate}.xlsx`;

		const buf = await workbook.xlsx.writeBuffer();
		saveAs(new Blob([buf], { type: "application/octet-stream" }), fileName);
		return;
	}

	// Fallback to SheetJS (without guaranteed styling support)
	const ws = XLSX.utils.aoa_to_sheet(rows);

	/* ===============================
	 MERGE HEADER (A:B)
	 =============================== */
	ws["!merges"] = [
		{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
		{ s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
		{ s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
		{ s: { r: 4, c: 0 }, e: { r: 4, c: 1 } },
		{ s: { r: 5, c: 0 }, e: { r: 5, c: 1 } },
		{ s: { r: 6, c: 0 }, e: { r: 6, c: 1 } },
		{ s: { r: 7, c: 0 }, e: { r: 7, c: 1 } },
	];

	/* ===============================
	 ALIGN LEFT HEADER
	 =============================== */
	for (let r = 0; r <= 7; r++) {
		const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
		if (cell) {
			cell.s = {
				alignment: { horizontal: "left", vertical: "center" },
				font: r === 0 ? { bold: true } : {},
			};
		}
	}

	/* ===============================
	 TABLE BORDER
	 =============================== */
	const startRow = 9;
	const endRow = rows.length - 1;
	const endCol = 8;

	const borderStyle = {
		top: { style: "thin", color: { rgb: "000000" } }, // Black thin border on top
		bottom: { style: "thin", color: { rgb: "000000" } }, // Black thin border on bottom
		left: { style: "thin", color: { rgb: "000000" } }, // Black thin border on left
		right: { style: "thin", color: { rgb: "000000" } },
	};

	for (let r = startRow; r <= endRow; r++) {
		for (let c = 0; c <= endCol; c++) {
			const ref = XLSX.utils.encode_cell({ r, c });
			if (!ws[ref]) ws[ref] = { t: "s", v: "" };
			ws[ref].s = {
				border: borderStyle,
				alignment: { vertical: "center" },
				font: r === startRow ? { bold: true } : {},
			};
		}
	}

	/* ===============================
	 COLUMN WIDTH
	 =============================== */
	ws["!cols"] = [
		{ wch: 4 },
		{ wch: 16 },
		{ wch: 20 },
		{ wch: 18 },
		{ wch: 16 },
		{ wch: 10 },
		{ wch: 12 },
		{ wch: 10 },
		{ wch: 24 },
	];

	/* ===============================
	 EXPORT
	 =============================== */
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, "PM Cassette");

	const pktSafe = activeVisit.pkt.replace(/\s+/g, "_");
	const fileName = `PM_${pktSafe}_${activeVisit.visitDate}.xlsx`;

	XLSX.writeFile(wb, fileName);
}
