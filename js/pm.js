import { openDB, getActiveVisit, insertCassetteEntry, getEntriesByVisit } from "./db.js";
import { generateUUID, nowISO } from "./utils.js";

let activeVisit = null;

const form = document.getElementById("pmForm");
const SN_PREFIX = {
	RC60: "CGQA",
	RJC: "CGIS",
}; 

const rcTypeEl = document.getElementById("rcType");
const snPrefixEl = document.getElementById("snPrefix");

rcTypeEl.addEventListener("change", () => {
	snPrefixEl.value = SN_PREFIX[rcTypeEl.value] || "";
});

document.addEventListener("DOMContentLoaded", async () => {
  await openDB();
  activeVisit = await getActiveVisit();

  if (!activeVisit) {
    location.href = "index.html";
    return;
  }

  renderVisitHeader(activeVisit);
  await renderTable();
});


form.addEventListener("submit", async (e) => {
	e.preventDefault();

	if (!SN_PREFIX[rcTypeEl.value]) {
		alert("RC Type belum dipilih");
		return;
	}

	const serialNumber =
		SN_PREFIX[rcTypeEl.value] + document.getElementById("snNumber").value;

	const entry = {
		entry_id: generateUUID(),
		visit_id: activeVisit.visit_id,
		timestamp: nowISO(),

		rc_type: rcTypeEl.value,
		serial_number: serialNumber,
		production_month: document.getElementById("prodMonth").value,
		production_year: Number(document.getElementById("prodYear").value),
		revision: Number(document.getElementById("revision").value),
		action: document.getElementById("action").value,
		status: document.getElementById("status").value,
	};

	try {
		await insertCassetteEntry(entry);
		form.reset();
    await renderTable();
		snPrefixEl.value = "";
		alert("Data PM berhasil ditambahkan");
	} catch (err) {
		console.error(err);
		alert("Gagal menyimpan data PM");
	}
});

function renderVisitHeader(visit) {
	document.getElementById("hdrPkt").textContent = visit.pkt;
	document.getElementById("hdrBank").textContent = visit.bank;
	document.getElementById("hdrEngineer").textContent = visit.engineer;
	document.getElementById("hdrDate").textContent = visit.visit_date;

  document.getElementById("v-id").textContent = visit.visit_id;
  document.getElementById("v-eng").textContent = visit.engineer;
  document.getElementById("v-date").textContent = visit.visit_date;
}

async function renderTable() {
  const tbody = document.querySelector("#pmTable tbody");
  tbody.innerHTML = "";

  const entries = await getEntriesByVisit(activeVisit.visit_id);

  // Deteksi duplikasi SN
  const snCount = {};
  entries.forEach(e => {
    snCount[e.serial_number] = (snCount[e.serial_number] || 0) + 1;
  });

  entries.forEach((e, i) => {
    const tr = document.createElement("tr");

    if (snCount[e.serial_number] > 1) {
      tr.classList.add("duplicate");
    }

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${e.rc_type}</td>
      <td>${e.serial_number}</td>
      <td>${e.production_month}</td>
      <td>${e.production_year}</td>
      <td>${e.revision}</td>
      <td>${e.action}</td>
      <td>${e.status}</td>
    `;

    tbody.appendChild(tr);
  });
  
}
