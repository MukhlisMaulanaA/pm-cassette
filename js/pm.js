import {
	getActiveVisit,
	insertPMItem,
	getPMItemsByVisit,
	calculateSummary,
	updateVisitSummary,
} from "./db.js";
import { getPMItemById, updatePMItem, deletePMItem } from "./db.js";

let activeVisit = null;

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
	activeVisit = await getActiveVisit();

	if (!activeVisit) {
		alert("Tidak ada visit aktif.");
		window.location.href = "index.html";
		return;
	}

	renderVisitHeader();
	initDropdowns();
	await refreshTable();

	// Form submit (add / update)
	document.getElementById("pm-form").addEventListener("submit", handleSubmit);

	// Table actions (edit / delete) — event delegation
	const tbody = document.getElementById("pm-table-body");
	tbody.addEventListener("click", async (ev) => {
		const btn = ev.target.closest("button");
		if (!btn) return;
		const id = btn.dataset.id ? Number(btn.dataset.id) : null;
		if (!id) return;
		if (btn.classList.contains("btn-edit")) {
			const item = await getPMItemById(id);
			if (item) populateFormForEdit(item);
		}
		if (btn.classList.contains("btn-delete")) {
			if (!confirm("Hapus item ini?")) return;
			await deletePMItem(id);
			await refreshTable();
		}
	});
});

/* =========================================================
   VISIT HEADER
   ========================================================= */
function renderVisitHeader() {
	const ok = activeVisit.totalOK || 0;
	const ng = activeVisit.totalNG || 0;

	document.getElementById("visit-pkt").textContent = activeVisit.pkt;
	document.getElementById("visit-date").textContent = activeVisit.visitDate;
	document.getElementById("visit-bank").textContent = activeVisit.bank;
	document.getElementById("visit-engineer").textContent = activeVisit.engineer;
	document.getElementById("visit-ok").textContent = ok;
	document.getElementById("visit-ng").textContent = ng;
	document.getElementById("visit-total").textContent = ok + ng;
}

/* =========================================================
   DROPDOWNS
   ========================================================= */
function initDropdowns() {
	/* Cassette Type */
	const cassette = document.getElementById("cassetteType");
	cassette.innerHTML = `
    <option value="">-- Pilih --</option>
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
    <option value="Adjust">Adjust</option>
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

	const editIdEl = document.getElementById("editId");
	const submitBtn = document.getElementById("pm-submit-button");

	if (editIdEl && editIdEl.value) {
		// Update existing
		item.id = Number(editIdEl.value);
		await updatePMItem(item);
		// reset form state
		editIdEl.value = "";
		submitBtn.textContent = "Add";
	} else {
		// Insert new
		await insertPMItem(item);
	}

	await refreshTable();

	e.target.reset();
}

function populateFormForEdit(item) {
  // fill form fields; serialNumber input expects suffix (last 6 digits)
  document.getElementById("cassetteType").value = item.cassetteType || "";
  const prefixInput = document.getElementById("prefix");
  if (prefixInput) {
    if ((item.cassetteType || "").startsWith("RC")) prefixInput.value = "CGQA";
    else if (item.cassetteType === "RJC") prefixInput.value = "CGIS";
    else prefixInput.value = "";
  }

  const snVal = item.serialNumber || "";
  const suffix = snVal.length > 6 ? snVal.slice(-6) : snVal;
  document.getElementById("serialNumber").value = suffix;
  document.getElementById("productionMonth").value = item.productionMonth || "";
  document.getElementById("productionYear").value = item.productionYear || "";
  document.getElementById("revision").value = item.revision || "";
  document.getElementById("action").value = item.action || "";
  document.getElementById("status").value = item.status || "";
  document.getElementById("notes").value = item.notes || "";

  document.getElementById("editId").value = String(item.id);
  document.getElementById("pm-submit-button").textContent = "Save";
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
				<td>${i.productionMonth || "-"}</td>
				<td>${i.productionYear || "-"}</td>
				<td>${i.revision}</td>
				<td>${i.action}</td>
				<td>${i.status}</td>
				<td>${i.notes || "-"}</td>
				<td class="action">
						<button class="icon-btn btn-edit" title="Edit" data-id="${i.id}">
						  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
						    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
						  </svg>
						</button>
						<button class="icon-btn btn-delete" title="Delete" data-id="${i.id}">
						  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
						    <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
						  </svg>
						</button>
				</td>
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

	const totalOK = activeVisit.totalOK || 0;
	const totalNG = activeVisit.totalNG || 0;

	const rows = [
		["PM Cassette Report"],
		[],
		["PKT", , activeVisit.pkt],
		["Engineer", , activeVisit.engineer],
		["Visit Date", , activeVisit.visitDate],
		["Bank", , activeVisit.bank || "-"],
		["Total OK", , totalOK],
		["Total NG", , totalNG],
		["Total", , totalOK + totalNG],
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
		for (let rr = 3; rr <= 9; rr++) wsExcel.mergeCells(`A${rr}:B${rr}`);

		// Align left for first 8 rows and bold first row
		for (let rr = 1; rr <= 9; rr++) {
			const row = wsExcel.getRow(rr);
			row.alignment = { horizontal: "left", vertical: "middle" };
			if (rr === 1) row.font = { bold: true };
			row.commit();
		}

		// Table header and data start at row 10 (1-based)
		const startRowExcel = 11;
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
		{ s: { r: 8, c: 0 }, e: { r: 8, c: 1 } },
	];

	/* ===============================
	 ALIGN LEFT HEADER
	 =============================== */
	for (let r = 0; r <= 8; r++) {
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
