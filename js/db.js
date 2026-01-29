/* =========================================================
   IndexedDB Configuration
   ========================================================= */
let db;
const DB_NAME = "pm_visit_db";
const DB_VERSION = 2;

const STORE_VISITS = "visits";
const STORE_PM = "pm_items";

let dbInstance = null;

/* =========================================================
   Open Database
   ========================================================= */
export function openDB() {
	return new Promise((resolve, reject) => {
		if (dbInstance) {
			resolve(dbInstance);
			return;
		}

		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);

		request.onsuccess = () => {
			dbInstance = request.result;
			resolve(dbInstance);
		};

		request.onupgradeneeded = (event) => {
			const db = event.target.result;

			/* ---------- VISITS STORE ---------- */
			if (!db.objectStoreNames.contains(STORE_VISITS)) {
				const visitStore = db.createObjectStore(STORE_VISITS, {
					keyPath: "id",
				});

				visitStore.createIndex("isActive", "isActive", { unique: false });
				visitStore.createIndex("visitDate", "visitDate", { unique: false });
			}

			/* ---------- PM ITEMS STORE ---------- */
			if (!db.objectStoreNames.contains(STORE_PM)) {
				const pmStore = db.createObjectStore(STORE_PM, {
					keyPath: "id",
					autoIncrement: true,
				});

				pmStore.createIndex("visitId", "visitId", { unique: false });
				pmStore.createIndex("cassetteType", "cassetteType", { unique: false });
				pmStore.createIndex("status", "status", { unique: false });
				pmStore.createIndex("productionYear", "productionYear", {
					unique: false,
				});
			}
		};
	});
}

/* =========================================================
   VISIT FUNCTIONS
   ========================================================= */

/* Get active visit */
export async function getActiveVisit() {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_VISITS, "readonly");
		const store = tx.objectStore(STORE_VISITS);
		const index = store.index("isActive");

		// isActive stored as numeric flag (1 = active, 0 = inactive)
		const req = index.get(1);

		req.onsuccess = () => resolve(req.result || null);
		req.onerror = () => reject(req.error);
	});
}

/* Create new visit (auto deactivate old visit) */
export async function createVisit(visitData) {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_VISITS, "readwrite");
		const store = tx.objectStore(STORE_VISITS);

		// Deactivate all visits
		store.openCursor().onsuccess = (e) => {
			const cursor = e.target.result;
			if (cursor) {
				const v = cursor.value;
				v.isActive = 0;
				cursor.update(v);
				cursor.continue();
			}
		};

		// Create new visit
		// Normalize incoming visit data to the store schema and ensure an `id` is present
		const genId = () => {
			if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
			return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
		};

		const newVisit = {
			id: visitData.visit_id || visitData.id || genId(),
			pkt: visitData.pkt || visitData.PKT || "",
			bank: visitData.bank || "",
			engineer: visitData.engineer || "",
			visitDate: visitData.visit_date || visitData.visitDate || new Date().toISOString(),
			createdAt: visitData.created_at || visitData.createdAt || new Date().toISOString(),
			isActive: 1,
			totalOK: 0,
			totalNG: 0,
		};

		store.put(newVisit);

		tx.oncomplete = () => resolve(true);
		tx.onerror = () => reject(tx.error);
	});
}

/* Update visit summary (OK / NG) */
export async function updateVisitSummary(visitId, totalOK, totalNG) {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_VISITS, "readwrite");
		const store = tx.objectStore(STORE_VISITS);

		const req = store.get(visitId);
		req.onsuccess = () => {
			const visit = req.result;
			if (!visit) return resolve(false);

			visit.totalOK = totalOK;
			visit.totalNG = totalNG;
			store.put(visit);
			resolve(true);
		};

		req.onerror = () => reject(req.error);
	});
}

/* =========================================================
   PM ITEM FUNCTIONS
   ========================================================= */

/* Insert PM item */
export async function insertPMItem(item) {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_PM, "readwrite");
		const store = tx.objectStore(STORE_PM);

		store.add({
			...item,
			notes: item.notes || "",
			createdAt: new Date().toISOString(),
		});

		tx.oncomplete = () => resolve(true);
		tx.onerror = () => reject(tx.error);
	});
}

/* Get PM items by visit */
export async function getPMItemsByVisit(visitId) {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_PM, "readonly");
		const store = tx.objectStore(STORE_PM);
		const index = store.index("visitId");

		const req = index.getAll(visitId);
		req.onsuccess = () => resolve(req.result || []);
		req.onerror = () => reject(req.error);
	});
}

/* Get single PM item by id */
export async function getPMItemById(id) {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_PM, "readonly");
		const store = tx.objectStore(STORE_PM);

		const req = store.get(id);
		req.onsuccess = () => resolve(req.result || null);
		req.onerror = () => reject(req.error);
	});
}

/* Update PM item (expects object with `id` present) */
export async function updatePMItem(item) {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_PM, "readwrite");
		const store = tx.objectStore(STORE_PM);

		const toPut = {
			...item,
			notes: item.notes || "",
			updatedAt: new Date().toISOString(),
		};

		const req = store.put(toPut);
		req.onsuccess = () => resolve(true);
		req.onerror = () => reject(req.error);
	});
}

/* Delete PM item by id */
export async function deletePMItem(id) {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_PM, "readwrite");
		const store = tx.objectStore(STORE_PM);

		const req = store.delete(id);
		req.onsuccess = () => resolve(true);
		req.onerror = () => reject(req.error);
	});
}

/* =========================================================
   SUMMARY HELPERS
   ========================================================= */

export function calculateSummary(items) {
	let ok = 0;
	let ng = 0;

	items.forEach((i) => {
		if (i.status === "OK") ok++;
		if (i.status === "NG") ng++;
	});

	return { ok, ng };
}
