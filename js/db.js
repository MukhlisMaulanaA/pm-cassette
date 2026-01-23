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

export function insertCassetteEntry(entry) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cassette_entries", "readwrite");
    tx.objectStore("cassette_entries").add(entry);

    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export function addEntry(entry) {
	return new Promise(async (resolve, reject) => {
		try {
			const existing = await getEntriesByVisit(entry.visit_id);
			const duplicate = existing.some(e => e.serial_number === entry.serial_number);

			const tx = db.transaction("cassette_entries", "readwrite");
			tx.objectStore("cassette_entries").add({ ...entry, is_duplicate: duplicate });

			tx.oncomplete = () => resolve({ duplicate });
			tx.onerror = () => reject(tx.error);
		} catch (err) {
			reject(err);
		}
	});
}

export function getEntriesByVisit(visitId) {
	return new Promise((resolve, reject) => {
		const tx = db.transaction("cassette_entries", "readonly");
		const store = tx.objectStore("cassette_entries");
		const index = store.index("visit_id");
		const req = index.getAll(visitId);

		req.onsuccess = () => {
			const results = req.result || [];
			// sort by timestamp asc
			results.sort((a, b) => (a.timestamp || "") > (b.timestamp || "") ? 1 : -1);
			resolve(results);
		};

		req.onerror = () => reject(req.error);
	});
}

export function deleteEntry(entryId) {
	return new Promise((resolve, reject) => {
		const tx = db.transaction("cassette_entries", "readwrite");
		tx.objectStore("cassette_entries").delete(entryId);

		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
