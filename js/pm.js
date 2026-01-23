import { openDB, getActiveVisit } from "./db.js";

document.addEventListener("DOMContentLoaded", async () => {
  await openDB();

  const visit = await getActiveVisit();

  // GUARD: tidak boleh masuk PM tanpa visit
  if (!visit) {
    window.location.href = "index.html";
    return;
  }

  renderVisitHeader(visit);
});

function renderVisitHeader(visit) {
  document.getElementById("hdrPkt").textContent = visit.pkt;
  document.getElementById("hdrBank").textContent = visit.bank;
  document.getElementById("hdrEngineer").textContent = visit.engineer;
  document.getElementById("hdrDate").textContent = visit.visit_date;
}
