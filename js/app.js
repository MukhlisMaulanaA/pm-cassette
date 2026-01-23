/* =====================================
   app.js – Main Controller
   Project: PM Cassette PWA
   ===================================== */

import { openDB, addEntry, getEntriesByVisit, deleteEntry } from "/js/db.js";

/* =====================================
   App Initialization
   ===================================== */

const visitId = localStorage.getItem("active_visit");

window.addEventListener("DOMContentLoaded", async () => {
	await openDB();
	bindForm();
	renderTable();
});

/* =====================================
   Form Handling
   ===================================== */

function bindForm() {
	const form = document.getElementById("cassetteForm");
	const warning = document.getElementById("duplicateWarning");

	form.addEventListener("submit", async (e) => {
		e.preventDefault();

		const entry = {
			entry_id: crypto.randomUUID(),
			visit_id: visitId,
			timestamp: new Date().toISOString(),
			cassette_type: form.cassetteType.value,
			serial_number: form.serialNumber.value.trim(),
			production_month: form.productionMonth.value,
			production_year: Number(form.productionYear.value),
			revision: Number(form.revision.value),
			action: form.action.value,
			status: form.status.value,
		};

		const result = await addEntry(entry);
		warning.classList.toggle("hidden", !result.duplicate);

		form.reset();
		renderTable();
	});
}

/* =====================================
   Table Rendering
   ===================================== */

async function renderTable() {
	const tbody = document.querySelector("#cassetteTable tbody");
	tbody.innerHTML = "";

	const entries = await getEntriesByVisit(visitId);

	entries.forEach((e, i) => {
		const tr = document.createElement("tr");
		if (e.is_duplicate) tr.classList.add("duplicate");

		tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${e.cassette_type}</td>
      <td>${e.serial_number}</td>
      <td>${e.production_month}</td>
      <td>${e.production_year}</td>
      <td>${e.revision}</td>
      <td>${e.action}</td>
      <td>${e.status}</td>
      <td><button data-id="${e.entry_id}" class="delete">X</button></td>
    `;

		tr.querySelector(".delete").onclick = async () => {
			if (confirm("Hapus data ini?")) {
				await deleteEntry(e.entry_id);
				renderTable();
			}
		};

		tbody.appendChild(tr);
	});
}
