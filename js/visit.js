import { openDB, createVisit, getActiveVisit } from "./db.js";
import { generateUUID, todayISO, nowISO } from "./utils.js";

const form = document.getElementById("visitForm");

document.addEventListener("DOMContentLoaded", async () => {
	await openDB();

	const activeVisit = await getActiveVisit();
	if (activeVisit) {
		window.location.href = "pm.html";
		return;
	}

	document.getElementById("visitDate").value = todayISO();
});

form.addEventListener("submit", async (e) => {
	e.preventDefault();

	const visit = {
		visit_id: generateUUID(),
		pkt: document.getElementById("pkt").value,
		bank: document.getElementById("bank").value,
		engineer: document.getElementById("engineer").value,
		visit_date: document.getElementById("visitDate").value,
		created_at: nowISO(),
	};

	await createVisit(visit);
	window.location.href = "pm.html";
});
