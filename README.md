# PM Cassette Inspection PWA

## Deskripsi Singkat
PM Cassette Inspection PWA adalah aplikasi **Progressive Web App (PWA)** berbasis **HTML, CSS, dan JavaScript** yang menggunakan **IndexedDB** sebagai penyimpanan lokal. Aplikasi ini dirancang untuk mendukung proses **Preventive Maintenance (PM) Cassette** secara **offline-first**, terstruktur, dan konsisten, serta mampu menghasilkan laporan **XLSX** siap analisis data.

Aplikasi ini sangat cocok digunakan di lingkungan manufaktur atau quality control yang membutuhkan:
- Konsistensi data
- Audit trail per visit
- Kemudahan ekspor data

---

## Fitur Utama

### 1. Visit Management
- User **wajib membuat Visit** sebelum melakukan input PM.
- Visit berfungsi sebagai **session kerja**.
- 1 Visit = 1 File laporan.
- Visit otomatis **berakhir (End Visit)** setelah export XLSX.

### 2. PM Cassette Entry
- Mendukung dua tipe cassette:
  - **RC60** (prefix serial: `CGQA`)
  - **RJC** (prefix serial: `CGIS`)
- User hanya menginput **6 digit angka serial**.
- Field utama:
  - Production Month (select)
  - Action (select)
  - Result (OK / NG)
  - Notes (opsional, selalu visible)

### 3. Realtime Table
- Data PM langsung muncul di tabel.
- Mendukung:
  - Edit data
  - Delete data
- Total **OK dan NG** dihitung realtime.

### 4. Export XLSX Profesional
- Format laporan sesuai standar industri:
  - Data visit di bagian atas
  - Tabel dengan border
  - Kolom nomor urut
  - Kolom Notes
  - Akumulasi total OK & NG
- Penamaan file otomatis:
  ```
  PM_Advantage_Karawang_YYYY-MM-DD.xlsx
  ```

### 5. Offline-First
- Menggunakan **IndexedDB**
- Tidak memerlukan koneksi internet
- Cocok untuk tablet / laptop di area produksi

---

## Arsitektur Aplikasi

### Struktur Folder
```
/public
  ├── index.html        # Visit Init Page
  ├── pm.html           # PM Cassette Page
  ├── js/
  │    ├── db.js        # IndexedDB schema & CRUD
  │    ├── pm.js        # PM logic & UI handler
  │    └── export.js    # XLSX export logic
  └── assets/
```

---

## Penjelasan File Inti

### `db.js`
Bertanggung jawab penuh terhadap **IndexedDB**:
- Schema database
- Object store:
  - `active_visit`
  - `pm_records`
- CRUD data
- Helper penting:
  - `getActiveVisit()`
  - `deleteActiveVisit()`

### `pm.js`
Mengatur:
- Load visit aktif
- Validasi form PM
- Insert / edit / delete PM data
- Render tabel realtime
- Hitung total OK & NG
- Flow **Export + End Visit**

### `export.js`
Mengatur:
- Generate file XLSX
- Layout Excel
- Merge cell
- Border table
- Total OK & NG

---

## Flow Aplikasi

### 1. Start Visit
1. User membuka `index.html`
2. Mengisi data visit
3. Visit disimpan ke IndexedDB
4. Redirect ke `pm.html`

### 2. Input PM Cassette
1. User mengisi form PM
2. Data disimpan ke IndexedDB
3. Tabel update realtime

### 3. Export & End Visit
1. User klik **Export XLSX**
2. File XLSX dibuat
3. Visit dihapus dari IndexedDB
4. UI di-reset
5. User siap Visit baru

---

## Konsep Session (Visit)

- Visit **tidak memiliki timeout otomatis**.
- Visit hanya berakhir jika:
  - User melakukan **Export XLSX**.
- Pendekatan ini dipilih untuk:
  - Mencegah kehilangan data
  - Menjamin data diekspor secara eksplisit

---

## Teknologi yang Digunakan

- HTML5
- CSS3 (Mobile Friendly)
- JavaScript (ES6 Module)
- IndexedDB
- SheetJS / XLSX Library
- GitHub Pages (Deployment)

---

## Deployment

Aplikasi ini dapat dideploy menggunakan **GitHub Pages**:

1. Push project ke GitHub
2. Masuk ke **Settings → Pages**
3. Source: `main` branch
4. Folder: `/root`
5. Akses melalui URL GitHub Pages

---

## Catatan Pengembangan Lanjutan (Opsional)

- Visit history (archive)
- Role operator / supervisor
- Digital signature
- Sinkronisasi ke backend (future)

---

## Lisensi & Penggunaan

Aplikasi ini dirancang untuk kebutuhan internal dan pembelajaran. Silakan disesuaikan dengan standar perusahaan masing-masing.

---

**Status:** ✅ Production Ready

Jika Anda adalah pengembang baru, cukup mulai dari `index.html` → ikuti flow Visit → PM → Export.

