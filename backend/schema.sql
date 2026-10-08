-- Skema database kasir_warung
-- Cara pakai: mysql -u root -p < schema.sql
-- atau: CREATE DATABASE kasir_warung; USE kasir_warung; SOURCE schema.sql;

CREATE DATABASE IF NOT EXISTS kasir_warung;
USE kasir_warung;

CREATE TABLE IF NOT EXISTS pengguna (
  id_pengguna INT AUTO_INCREMENT PRIMARY KEY,
  nama_pengguna VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  peran ENUM('admin', 'kasir') NOT NULL DEFAULT 'kasir'
);

CREATE TABLE IF NOT EXISTS kategori (
  id_kategori INT AUTO_INCREMENT PRIMARY KEY,
  nama_kategori VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS menu (
  id_menu INT AUTO_INCREMENT PRIMARY KEY,
  nama_menu VARCHAR(150) NOT NULL,
  harga INT NOT NULL,
  stok INT NOT NULL DEFAULT 0,
  gambar VARCHAR(255) DEFAULT NULL,
  id_kategori INT DEFAULT NULL,
  FOREIGN KEY (id_kategori) REFERENCES kategori(id_kategori) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transaksi (
  id_transaksi INT AUTO_INCREMENT PRIMARY KEY,
  total_harga INT NOT NULL,
  jumlah_bayar INT NOT NULL,
  kembalian INT NOT NULL,
  id_pengguna INT DEFAULT NULL,
  metode_pembayaran VARCHAR(50) DEFAULT 'tunai',
  tanggal_transaksi DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_pengguna) REFERENCES pengguna(id_pengguna) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS detail_transaksi (
  id_detail INT AUTO_INCREMENT PRIMARY KEY,
  id_transaksi INT NOT NULL,
  id_menu INT NOT NULL,
  jumlah INT NOT NULL,
  harga_satuan INT NOT NULL,
  FOREIGN KEY (id_transaksi) REFERENCES transaksi(id_transaksi) ON DELETE CASCADE,
  FOREIGN KEY (id_menu) REFERENCES menu(id_menu) ON DELETE RESTRICT
);
