# Kasir Warung

Aplikasi Point of Sale (POS) sederhana untuk warung. Kasir bisa jualan lewat katalog menu + keranjang + cetak struk, admin bisa kelola menu/kategori/pengguna dan lihat laporan penjualan (grafik + export PDF/Excel).

## Tech Stack

- **Backend:** Node.js + Express + MySQL (`mysql2`), JWT (`jsonwebtoken`), Bcrypt (`bcryptjs`), PDFKit, ExcelJS, dotenv
- **Frontend:** HTML + Vanilla JS + Tailwind CSS (CDN) + Chart.js
- **Database:** MySQL (`kasir_warung`)

## Struktur Folder

```
kasir-warung/
├── backend/
│   ├── index.js        # REST API Express
│   ├── schema.sql      # Skema database
│   ├── .env.example    # Contoh konfigurasi
│   └── package.json
└── frontend/
    ├── index.html      # Halaman login + kasir
    └── admin.html      # Dasbor admin
```

## Fitur

- Login JWT dengan role `admin` / `kasir` (default: `admin` / `admin123`)
- Kasir: cari menu, filter kategori, keranjang, hitung kembalian, simpan transaksi atomik (cek stok + `FOR UPDATE`), cetak struk
- Admin: ringkasan harian, grafik + tabel laporan per tanggal, unduh PDF/Excel
- Admin: CRUD kategori, menu (nama/harga/stok/gambar/kategori), dan pengguna

## Cara Jalan

### 1. Database

```sql
CREATE DATABASE kasir_warung;
USE kasir_warung;
SOURCE backend/schema.sql;
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
npm start
```

Server jalan di `http://localhost:5000`. Isi `.env`:

```
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=kasir_warung
JWT_SECRET=ganti-dengan-secret-yang-kuat
```

### 3. Frontend

Buka `frontend/index.html` di browser (atau serve statis). API base URL default `http://localhost:5000/api` — ubah konstanta `API_URL` di `index.html` / `admin.html` jika backend beda host/port.

## API Ringkas

Semua endpoint `/api/*` (kecuali `/api/login`) butuh header `Authorization: Bearer <token>`. Endpoint admin butuh role `admin`.

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| POST | `/api/login` | Login, balikan `{ token, user }` |
| GET/POST | `/api/kategori` | List / tambah kategori |
| PUT/DELETE | `/api/kategori/:id` | Ubah / hapus kategori |
| GET/POST | `/api/menu` | List (query `?q=&kategori=&all=`) / tambah menu |
| GET/PUT/DELETE | `/api/menu/:id` | Detail / ubah / hapus menu |
| POST | `/api/transaksi` | Simpan transaksi `{ items, total, amountPaid, change, metode_pembayaran }` |
| GET/POST | `/api/pengguna` | List / tambah pengguna |
| DELETE | `/api/pengguna/:id` | Hapus pengguna |
| GET | `/api/laporan/summary` | Pendapatan + transaksi + produk terlaris hari ini |
| GET | `/api/laporan/harian` | Rekap per hari (`?startDate=&endDate=`) |
| GET | `/api/laporan/pdf` | Unduh laporan PDF |
| GET | `/api/laporan/excel` | Unduh laporan Excel |
