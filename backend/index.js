// --- Import Library ---
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const app = express();
const port = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || "kunci-rahasia-warung";

app.use(cors());
app.use(express.json());

// --- Koneksi Database ---
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kasir_warung'
}).promise();

// --- Fungsi Inisialisasi Admin ---
async function initAdmin() {
  try {
    const [adminRows] = await db.query("SELECT * FROM pengguna WHERE nama_pengguna='admin'");
    if (adminRows.length === 0) {
      const hash = await bcrypt.hash("admin123", 10);
      await db.query("INSERT INTO pengguna (nama_pengguna,password_hash,peran) VALUES (?,?,?)", ['admin', hash, 'admin']);
      console.log("✅ Admin default dibuat: admin / admin123");
    }
  } catch (error) {
    console.error("❌ Gagal inisialisasi admin:", error.message);
  }
}

// --- Middleware ---
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.status(401).send("Token tidak ditemukan");

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).send("Token tidak valid atau sesi telah berakhir.");
    req.user = user;
    next();
  });
}

function verifyAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).send("Akses ditolak. Hanya untuk admin.");
    }
}

// --- API LOGIN ---
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query("SELECT * FROM pengguna WHERE nama_pengguna=?", [username]);
    if (rows.length === 0) return res.status(404).send("Pengguna tidak ditemukan");
    
    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).send("Password salah");

    const token = jwt.sign({ userId: user.id_pengguna, role: user.peran, username: user.nama_pengguna }, SECRET_KEY, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id_pengguna, username: user.nama_pengguna, role: user.peran } });
  } catch(e) {
    res.status(500).send("Server error saat login.");
  }
});

// --- API KATEGORI ---
app.get('/api/kategori', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM kategori ORDER BY nama_kategori ASC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data kategori", error: error.message });
  }
});

app.post('/api/kategori', verifyToken, verifyAdmin, async (req, res) => {
  const { nama_kategori } = req.body;
  if (!nama_kategori) return res.status(400).send('Nama kategori tidak boleh kosong');
  try {
    await db.query("INSERT INTO kategori (nama_kategori) VALUES (?)", [nama_kategori]);
    res.status(201).send('Kategori berhasil ditambahkan');
  } catch (error) {
    res.status(500).json({ message: "Gagal menambahkan kategori", error: error.message });
  }
});

app.put('/api/kategori/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { nama_kategori } = req.body;
  if (!nama_kategori) return res.status(400).send('Nama kategori tidak boleh kosong');
  try {
    await db.query("UPDATE kategori SET nama_kategori = ? WHERE id_kategori = ?", [nama_kategori, id]);
    res.send('Kategori berhasil diperbarui');
  } catch (error) {
    res.status(500).json({ message: "Gagal memperbarui kategori", error: error.message });
  }
});

app.delete('/api/kategori/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [menuRows] = await db.query("SELECT COUNT(*) as count FROM menu WHERE id_kategori = ?", [id]);
    if (menuRows[0].count > 0) return res.status(400).send('Tidak dapat menghapus, kategori masih digunakan oleh menu.');
    await db.query("DELETE FROM kategori WHERE id_kategori = ?", [id]);
    res.send('Kategori berhasil dihapus');
  } catch (error) {
    res.status(500).json({ message: "Gagal menghapus kategori", error: error.message });
  }
});


// --- API MENU ---
app.get('/api/menu', verifyToken, async (req, res) => {
  try {
    const { q, kategori, all } = req.query; 
    let query = `SELECT m.*, k.nama_kategori FROM menu m LEFT JOIN kategori k ON m.id_kategori = k.id_kategori`;
    const params = [];
    const conditions = [];
    if (req.user.role !== 'admin' || !all) {
        conditions.push('m.stok > 0');
    }
    if (q) {
      conditions.push(`m.nama_menu LIKE ?`);
      params.push(`%${q}%`);
    }
    if (kategori && kategori !== 'all') {
      conditions.push(`m.id_kategori = ?`);
      params.push(kategori);
    }
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data menu", error: error.message });
  }
});

app.get('/api/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM menu WHERE id_menu = ?', [id]);
        if (rows.length === 0) return res.status(404).send('Menu tidak ditemukan');
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil detail menu", error: error.message });
    }
});

app.post('/api/menu', verifyToken, verifyAdmin, async (req, res) => {
  const { nama_menu, harga, stok, gambar, id_kategori } = req.body;
  await db.query("INSERT INTO menu (nama_menu, harga, stok, gambar, id_kategori) VALUES (?,?,?,?,?)", [nama_menu, harga, stok, gambar, id_kategori]);
  res.status(201).send('Menu berhasil ditambahkan');
});

app.put('/api/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { nama_menu, harga, stok, gambar, id_kategori } = req.body;
  await db.query("UPDATE menu SET nama_menu=?, harga=?, stok=?, gambar=?, id_kategori=? WHERE id_menu=?", [nama_menu, harga, stok, gambar, id_kategori, id]);
  res.send('Menu berhasil diperbarui');
});

app.delete('/api/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  await db.query("DELETE FROM menu WHERE id_menu=?", [id]);
  res.send('Menu berhasil dihapus');
});


// --- API TRANSAKSI ---
app.post('/api/transaksi', verifyToken, async (req, res) => {
  const { items, total, amountPaid, change, metode_pembayaran } = req.body;
  const userId = req.user.userId;
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    for (const item of items) {
        const [[menu]] = await conn.query("SELECT nama_menu, stok FROM menu WHERE id_menu = ? FOR UPDATE", [item.id_menu]);
        if (menu.stok < item.quantity) {
            throw new Error(`Stok untuk ${menu.nama_menu} tidak mencukupi. Sisa ${menu.stok}.`);
        }
    }
    
    const [result] = await conn.query(
      "INSERT INTO transaksi (total_harga, jumlah_bayar, kembalian, id_pengguna, metode_pembayaran) VALUES (?,?,?,?,?)", 
      [total, amountPaid, change, userId, metode_pembayaran]
    );
    const transactionId = result.insertId;
    
    const detailPromises = items.map(item => {
      conn.query("INSERT INTO detail_transaksi (id_transaksi, id_menu, jumlah, harga_satuan) VALUES (?,?,?,?)", [transactionId, item.id_menu, item.quantity, item.harga]);
      return conn.query("UPDATE menu SET stok = stok - ? WHERE id_menu = ?", [item.quantity, item.id_menu]);
    });
    
    await Promise.all(detailPromises);
    await conn.commit();
    res.status(201).json({ message: 'Transaksi berhasil!', transactionId: transactionId });
  } catch (err) {
    await conn.rollback();
    console.error("Error saat menyimpan transaksi:", err);
    if (err.message.startsWith('Stok')) return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Gagal menyimpan transaksi' });
  } finally {
    conn.release();
  }
});

// --- API PENGGUNA ---
app.get('/api/pengguna', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const [rows] = await db.query("SELECT id_pengguna, nama_pengguna, peran FROM pengguna ORDER BY nama_pengguna ASC");
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil data pengguna", error: error.message });
    }
});

app.post('/api/pengguna', verifyToken, verifyAdmin, async (req, res) => {
    const { nama_pengguna, password, peran } = req.body;
    if (!nama_pengguna || !password || !peran) return res.status(400).send('Semua field harus diisi');
    try {
        const [existing] = await db.query("SELECT * FROM pengguna WHERE nama_pengguna = ?", [nama_pengguna]);
        if (existing.length > 0) return res.status(409).send('Nama pengguna sudah ada');
        const hash = await bcrypt.hash(password, 10);
        await db.query("INSERT INTO pengguna (nama_pengguna, password_hash, peran) VALUES (?,?,?)", [nama_pengguna, hash, peran]);
        res.status(201).send('Pengguna baru berhasil ditambahkan');
    } catch (error) {
        res.status(500).json({ message: "Gagal menambahkan pengguna", error: error.message });
    }
});

app.delete('/api/pengguna/:id', verifyToken, verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const adminId = req.user.userId;
    if (parseInt(id, 10) === adminId) return res.status(403).send('Tidak dapat menghapus akun Anda sendiri.');
    try {
        await db.query("DELETE FROM pengguna WHERE id_pengguna = ?", [id]);
        res.send('Pengguna berhasil dihapus');
    } catch (error) {
        res.status(500).json({ message: "Gagal menghapus pengguna", error: error.message });
    }
});

// --- API LAPORAN ---
app.get('/api/laporan/summary', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const [salesToday] = await db.query(`
            SELECT SUM(total_harga) as totalPendapatan, COUNT(id_transaksi) as jumlahTransaksi
            FROM transaksi WHERE DATE(tanggal_transaksi) = ?
        `, [today]);
        const [topProduct] = await db.query(`
            SELECT m.nama_menu, SUM(dt.jumlah) as totalTerjual
            FROM detail_transaksi dt
            JOIN menu m ON dt.id_menu = m.id_menu
            JOIN transaksi t ON dt.id_transaksi = t.id_transaksi
            WHERE DATE(t.tanggal_transaksi) = ?
            GROUP BY m.nama_menu ORDER BY totalTerjual DESC LIMIT 1
        `, [today]);
        res.json({
            pendapatanHariIni: salesToday[0].totalPendapatan || 0,
            transaksiHariIni: salesToday[0].jumlahTransaksi || 0,
            produkTerlarisHariIni: topProduct.length > 0 ? topProduct[0].nama_menu : 'Belum ada'
        });
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil ringkasan laporan", error: error.message });
    }
});

app.get('/api/laporan/harian', verifyToken, verifyAdmin, async (req, res) => {
    try {
        let { startDate, endDate } = req.query;
        let query;
        let params = [];

        if (startDate && endDate) {
            query = `
                SELECT DATE(tanggal_transaksi) AS tanggal, SUM(total_harga) AS total_penjualan, COUNT(id_transaksi) AS jumlah_transaksi
                FROM transaksi WHERE DATE(tanggal_transaksi) BETWEEN ? AND ?
                GROUP BY DATE(tanggal_transaksi) ORDER BY tanggal DESC
            `;
            params = [startDate, endDate];
        } else {
            query = `
                SELECT DATE(tanggal_transaksi) AS tanggal, SUM(total_harga) AS total_penjualan, COUNT(id_transaksi) AS jumlah_transaksi
                FROM transaksi WHERE tanggal_transaksi >= CURDATE() - INTERVAL 7 DAY
                GROUP BY DATE(tanggal_transaksi) ORDER BY tanggal DESC
            `;
        }
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil laporan", error: error.message });
    }
});

app.get('/api/laporan/pdf', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = "SELECT DATE_FORMAT(tanggal_transaksi, '%d-%m-%Y') as tanggal, COUNT(*) as jumlah_transaksi, SUM(total_harga) as total_penjualan FROM transaksi";
        const params = [];

        if (startDate && endDate) {
            query += " WHERE DATE(tanggal_transaksi) BETWEEN ? AND ?";
            params.push(startDate, endDate);
        }
        query += " GROUP BY DATE(tanggal_transaksi) ORDER BY DATE(tanggal_transaksi) DESC";

        const [rows] = await db.query(query, params);

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=laporan-penjualan.pdf');
        doc.pipe(res);
        doc.fontSize(16).text(`Laporan Penjualan (${startDate || 'Semua'} - ${endDate || 'Semua'})`, { align: 'center' }).moveDown();
        
        if (rows.length === 0) {
            doc.fontSize(12).text('Tidak ada data untuk periode yang dipilih.', { align: 'center'});
        } else {
            rows.forEach(row => {
                doc.fontSize(12).text(`Tanggal: ${row.tanggal} | Jml Transaksi: ${row.jumlah_transaksi} | Total: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(row.total_penjualan)}`);
            });
        }
        doc.end();
    } catch (error) {
        res.status(500).send("Gagal membuat laporan PDF");
    }
});

app.get('/api/laporan/excel', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = `
            SELECT DATE(tanggal_transaksi) AS tanggal, SUM(total_harga) AS total_penjualan, COUNT(*) AS jumlah_transaksi
            FROM transaksi`;
        const params = [];
        
        if (startDate && endDate) {
            query += " WHERE DATE(tanggal_transaksi) BETWEEN ? AND ?";
            params.push(startDate, endDate);
        }
        query += " GROUP BY DATE(tanggal_transaksi) ORDER BY tanggal DESC";

        const [rows] = await db.query(query, params);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Laporan Harian");
        sheet.columns = [
            { header: 'Tanggal', key: 'tanggal', width: 15 },
            { header: 'Jumlah Transaksi', key: 'jumlah_transaksi', width: 20 },
            { header: 'Total Penjualan', key: 'total_penjualan', width: 20, style: { numFmt: '"Rp"#,##0' } },
        ];
        rows.forEach(r => { sheet.addRow(r); });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="laporan.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).send("Gagal membuat laporan Excel");
    }
});

// --- Jalankan Server ---
app.listen(port, () => {
  console.log(`🚀 Server backend berjalan di http://localhost:${port}`);
  initAdmin().catch(console.error);
});