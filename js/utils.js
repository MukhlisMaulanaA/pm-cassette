export function generateUUID() {
	return crypto.randomUUID();
}

export function todayISO() {
	return new Date().toISOString().split("T")[0];
}

export function nowISO() {
	return new Date().toISOString();
}
