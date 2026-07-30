import {
	getActiveVisit,
	insertPMItem,
	getPMItemsByVisit,
	calculateSummary,
	updateVisitSummary,
	deletePMItemsByVisit,
	endVisit,
} from "./db.js";

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

	// Form submit (add)
	document.getElementById("pm-form").addEventListener("submit", handleSubmit);
});

function formatVisitDateForTable(value) {
	if (!value) return "-";
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return String(value);
	return d
		.toLocaleDateString("id-ID", {
			day: "numeric",
			month: "long",
			year: "numeric",
		})
		.toUpperCase();
}

function formatProductionMonthYear(month, year) {
	const monthMap = {
		Jan: "Jan",
		Feb: "Feb",
		Mar: "Mar",
		Apr: "Apr",
		May: "Mei",
		Jun: "Jun",
		Jul: "Jul",
		Aug: "Agu",
		Sep: "Sep",
		Oct: "Okt",
		Nov: "Nov",
		Dec: "Des",
	};

	if (!month && !year) return "";
	const m = monthMap[month] || month || "";
	if (!year) return m;
	if (!m) return String(year);
	return `${m}-${String(year).slice(-2).padStart(2, "0")}`;
}

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
	document.getElementById("visit-group").textContent = activeVisit.group || "-";
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
	const monthOptions = [
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
	];
	month.innerHTML = `<option value="">-- Pilih --</option>${monthOptions
		.map((m) => `<option value="${m}">${m}</option>`)
		.join("")}`;

	/* Production Year */
	const year = document.getElementById("productionYear");
	const now = new Date().getFullYear();
	year.innerHTML = `<option value="">-- Pilih --</option>`;
	for (let y = now; y >= 2018; y--) {
		year.innerHTML += `<option value="${y}">${y}</option>`;
	}

	/* Action */
	const actionInput = document.getElementById("action");
	if (actionInput && !actionInput.value) actionInput.value = "Check & Clean";

	/* Status */
	document.getElementById("status").innerHTML = `
		<option value="">-- Pilih --</option>
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
		action: document.getElementById("action").value.trim(),
		status: document.getElementById("status").value,
	};

	if (!item.action) {
		alert("Action wajib diisi");
		return;
	}

	await insertPMItem(item);

	await refreshTable();

	e.target.reset();
	document.getElementById("action").value = "Check & Clean";
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
		const visitDate = formatVisitDateForTable(activeVisit.visitDate);
		const monthYear = formatProductionMonthYear(i.productionMonth, i.productionYear);
		let rowClass = "";

		if (serialCounts[sn] > 1) rowClass = "duplicate";
		else if (suffixCounts[suf] > 1) rowClass = "similar";

		tbody.innerHTML += `
			<tr class="${rowClass}">
				<td>${idx + 1}</td>
				<td>${visitDate}</td>
				<td>${activeVisit.bank || "-"}</td>
				<td>${activeVisit.pkt || "-"}</td>
				<td>${activeVisit.group || "-"}</td>
				<td>${i.cassetteType || "-"}</td>
				<td>${i.serialNumber || "-"}</td>
				<td>${monthYear || "-"}</td>
				<td>${i.revision ?? "-"}</td>
				<td>${i.action || "-"}</td>
				<td>${i.status || "-"}</td>
			</tr>
		`;
	});

	const summary = calculateSummary(items);
	await updateVisitSummary(activeVisit.id, summary.ok, summary.ng);

	activeVisit.totalOK = summary.ok;
	activeVisit.totalNG = summary.ng;
	renderVisitHeader();
}

/* End session: delete PM items for current visit and mark visit ended */
async function endSessionAfterExport() {
	if (!activeVisit) return;
	try {
		await deletePMItemsByVisit(activeVisit.id);
		await endVisit(activeVisit.id);
	} catch (err) {
		console.error('Error ending visit session:', err);
	}
	alert('Export selesai. Data lokal visit telah dihapus.');
	window.location.href = 'index.html';
}

const exportBtn = document.getElementById("export-xlsx");
if (exportBtn) {
	exportBtn.addEventListener("click", async (e) => {
		const msg =
			"Export report? After exporting, local visit data will be cleared and the visit will end. Continue?";
		if (!confirm(msg)) return;
		await exportXlsx();
	});
}

async function exportXlsx() {
	if (!activeVisit) return;

	const items = await getPMItemsByVisit(activeVisit.id);
	if (!items.length) {
		alert("Tidak ada data PM");
		return;
	}

	const totalOK = activeVisit.totalOK || 0;
	const totalNG = activeVisit.totalNG || 0;
	const totalAll = totalOK + totalNG;
	const visitDateText = formatVisitDateForTable(activeVisit.visitDate);

	const rows = [
		["PM CASSETTE REPORT"],
		[],
		["FLM", ":", activeVisit.pkt || "-", "", "", "", "", "", "OK", totalOK, ""],
		[
			"Tanggal Visit",
			":",
			visitDateText,
			"",
			"",
			"",
			"",
			"",
			"NG",
			totalNG,
			"",
		],
		[
			"Engineer",
			":",
			activeVisit.engineer || "-",
			"",
			"",
			"",
			"",
			"",
			"TOTAL",
			totalAll,
			"",
		],
		["Group", ":", activeVisit.group || "-", "", "", "", "", "", "", "", ""],
		["Bank", ":", activeVisit.bank || "-", "", "", "", "", "", "", "", ""],
		[],
		[
			"No",
			"TANGGAL",
			"BANK",
			"PKT",
			"GROUP AREA",
			"RC / RJC / Retract",
			"SN CST",
			"Bulan / Tahun Produksi",
			"Revisi Cassete",
			"Action",
			"Status ( OK / NG )",
		],
	];

	items.forEach((i, idx) => {
		rows.push([
			idx + 1,
			visitDateText,
			activeVisit.bank || "-",
			activeVisit.pkt || "-",
			activeVisit.group || "-",
			i.cassetteType || "",
			i.serialNumber || "",
			formatProductionMonthYear(i.productionMonth, i.productionYear),
			i.revision ?? "",
			i.action || "",
			i.status || "",
		]);
	});

	// Prefer ExcelJS in browser for reliable styling support
	if (window.ExcelJS && window.saveAs) {
		const workbook = new ExcelJS.Workbook();
		workbook.creator = "PM Cassette";
		const wsExcel = workbook.addWorksheet("PM Cassette");

		// Add rows
		rows.forEach((r) => wsExcel.addRow(r));

		// Merge title
		wsExcel.mergeCells("A1:C1");

		// Header block style
		for (let rr = 1; rr <= 8; rr++) {
			const row = wsExcel.getRow(rr);
			row.alignment = { horizontal: "left", vertical: "middle" };
			if (rr === 1) row.font = { bold: true, size: 13 };
			row.commit();
		}

		// Table header and data range
		const startRowExcel = 9;
		const endRowExcel = startRowExcel + items.length;
		const lastCol = 11; // columns A..K

		// Border style
		const border = {
			top: { style: "thin", color: { argb: "FF000000" } },
			left: { style: "thin", color: { argb: "FF000000" } },
			bottom: { style: "thin", color: { argb: "FF000000" } },
			right: { style: "thin", color: { argb: "FF000000" } },
		};

		const colLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];

		for (let rr = startRowExcel; rr <= endRowExcel; rr++) {
			for (let ci = 0; ci < lastCol; ci++) {
				const addr = `${colLetters[ci]}${rr}`;
				const cell = wsExcel.getCell(addr);
				if (!cell.value) cell.value = "";
				cell.border = border;
				cell.alignment = {
					horizontal: ci === 9 ? "left" : "center",
					vertical: "middle",
					wrapText: true,
				};
				if (rr === startRowExcel) {
					cell.font = { bold: true };
					cell.fill = {
						type: "pattern",
						pattern: "solid",
						fgColor: { argb: "FFD9D9D9" },
					};
					cell.alignment = {
						horizontal: "center",
						vertical: "middle",
						wrapText: true,
					};
				}
			}
		}

		wsExcel.autoFilter = {
			from: { row: startRowExcel, column: 1 },
			to: { row: startRowExcel, column: 11 },
		};

		// Column widths
		wsExcel.columns = [
			{ width: 5 },
			{ width: 18 },
			{ width: 12 },
			{ width: 24 },
			{ width: 18 },
			{ width: 18 },
			{ width: 16 },
			{ width: 19 },
			{ width: 14 },
			{ width: 30 },
			{ width: 14 },
		];

		const pktSafe = activeVisit.pkt.replace(/\s+/g, "_");
		const fileName = `PM_${pktSafe}_${activeVisit.visitDate}.xlsx`;

		const buf = await workbook.xlsx.writeBuffer();
				saveAs(new Blob([buf], { type: "application/octet-stream" }), fileName);
				// After exporting, clear local PM data for this visit and end visit
				await endSessionAfterExport();
				return;
	}

	// Fallback to SheetJS (without guaranteed styling support)
	const ws = XLSX.utils.aoa_to_sheet(rows);

	/* ===============================
	 COLUMN WIDTH
	 =============================== */
	ws["!cols"] = [
		{ wch: 5 },
		{ wch: 18 },
		{ wch: 12 },
		{ wch: 24 },
		{ wch: 18 },
		{ wch: 18 },
		{ wch: 16 },
		{ wch: 19 },
		{ wch: 14 },
		{ wch: 30 },
		{ wch: 14 },
	];

	/* ===============================
	 EXPORT
	 =============================== */
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, "PM Cassette");

	const pktSafe = activeVisit.pkt.replace(/\s+/g, "_");
	const fileName = `PM_${pktSafe}_${activeVisit.visitDate}.xlsx`;

	XLSX.writeFile(wb, fileName);

	// After exporting, clear local PM data for this visit and end visit
	await endSessionAfterExport();
}
