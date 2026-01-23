let db;

const DB_NAME = "pm_cassette_db";
const DB_VERSION = 2;

export function openDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = (event) => {
			db = event.target.result;

			if (!db.objectStoreNames.contains("visit_meta")) {
				db.createObjectStore("visit_meta", {
					keyPath: "visit_id",
				});
			}

			if (!db.objectStoreNames.contains("cassette_entries")) {
				const store = db.createObjectStore("cassette_entries", {
					keyPath: "entry_id",
				});
				store.createIndex("visit_id", "visit_id", { unique: false });
				store.createIndex("serial_number", "serial_number", { unique: false });
			}
		};

		request.onsuccess = () => {
			db = request.result;
			resolve();
		};

		request.onerror = () => reject(request.error);
	});
}

export function createVisit(visit) {
	return new Promise((resolve, reject) => {
		const tx = db.transaction("visit_meta", "readwrite");
		tx.objectStore("visit_meta").add(visit);

		tx.oncomplete = resolve;
		tx.onerror = () => reject(tx.error);
	});
}

export function getActiveVisit() {
	return new Promise((resolve) => {
		const tx = db.transaction("visit_meta", "readonly");
		const store = tx.objectStore("visit_meta");
		const req = store.getAll();

		req.onsuccess = () => {
			resolve(req.result.length > 0 ? req.result[0] : null);
		};
	});
}
