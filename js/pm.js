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

  document
    .getElementById("pm-form")
    .addEventListener("submit", handleSubmit);
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
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
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
