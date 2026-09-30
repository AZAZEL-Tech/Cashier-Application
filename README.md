# 🏪 WarungKu POS - Aplikasi Kasir & Pengelolaan Toko / Warung

Aplikasi kasir (Point of Sale) dan manajemen toko modern yang dirancang responsif untuk **PC/Laptop** dan **Handphone (Android/iPhone)**.

---

## 🌟 Fitur Utama Berdasarkan Role

### 1. 🛒 Role Kasir (Point of Sale / POS)
- **Katalog Produk & Kategori**: Tampilan visual modern dengan filter kategori (*Sembako, Minuman, Makanan, Snack, Rokok, Kebersihan, dll*).
- **Pencarian Cepat & Barcode Scanner**: Dukungan scan barcode via scanner fisik PC maupun scan kamera HP.
- **Keranjang Belanja Realtime**: Penambahan jumlah (qty), potongan diskon khusus, catatan nama pelanggan.
- **Tahan Pesanan (Hold Order)**: Simpan sementara pesanan jika pelanggan ingin menambah barang lain tanpa menghapus keranjang.
- **Metode Pembayaran Lengkap**:
  - 💵 **Tunai (Cash)**: Tombol pecahan uang cepat (Uang Pas, 10k, 20k, 50k, 100k) & kalkulasi kembalian otomatis.
  - 📱 **QRIS Dinamis**: Tampilan QR Code QRIS otomatis sesuai total belanja toko.
  - 🏦 **Transfer Bank & E-Wallet**: BCA, Mandiri, BRI, DANA, GoPay, OVO.
- **Cetak Struk & Notifikasi WhatsApp**:
  - Layout cetak printer thermal (format **58mm** dan **80mm**).
  - Cetak struk via browser print atau kirim nota digital langsung ke **WhatsApp Pelanggan**.
- **Efek Suara Kasir**: Dilengkapi sound effect kasir (*beep* scan & *ka-ching* pembayaran).

---

### 2. 🔐 Role Admin (Backoffice & Keuangan)
- **Dashboard Analitik & KPI**:
  - Total Pemasukan (Omset) hari ini & total.
  - Total Pengeluaran toko (Belanja stok & operasional).
  - **Kalkulasi Keuntungan / Laba Bersih** (*Net Profit = Omset - Modal Pokok - Pengeluaran*).
  - Grafik Tren Penjualan & Laba Harian (Interactive Chart.js).
  - Peringatan Stok Menipis (*Low Stock Alert*).
  - Daftar 5 Produk Terlaris (*Top Selling Products*).
- **Manajemen Produk & Stok**:
  - Tambah, Edit, dan Hapus Produk (Harga Modal, Harga Jual, Satuan, Min. Alert Stok).
  - **Mutasi Stok Masuk (Restock)**: Menambah stok barang dan otomatis mencatat pengeluaran ke buku kas jika dipilih.
  - **Mutasi Stok Keluar**: Mengurangi stok barang dengan alasan rusak/kadaluarsa.
  - Riwayat mutasi stok lengkap.
- **Buku Kas & Pengeluaran Toko**:
  - Catat biaya operasional, listrik & air, gaji karyawan, sewa tempat, dan pembelian grosir.
  - Laporan Arus Kas & Laba Rugi Realtime.
- **Riwayat Transaksi & Export Data**:
  - Riwayat lengkap semua nota transaksi kasir.
  - Cetak ulang struk lama.
  - **Export Laporan ke format Excel (CSV)**.
- **Pengaturan & Keamanan**:
  - Profil toko (Nama, Alamat, No. WhatsApp, Footer Struk).
  - Penggantian Password Admin & PIN Kasir.
  - **Backup & Restore Database (JSON)**: Simpan cadangan data dan pulihkan dengan 1 klik.

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Menjalankan di PC / Laptop
Buka terminal di folder project lalu jalankan:
```bash
python3 server.py
```
Aplikasi akan otomatis terbuka di browser pada alamat:
👉 **`http://localhost:3000`**

### 2. Membuka di Handphone (Android / iPhone)
1. Pastikan HP dan PC terhubung ke **jaringan Wi-Fi yang sama**.
2. Saat `python3 server.py` dijalankan di terminal, akan muncul alamat IP lokal (Contoh: `http://192.168.1.10:3000`).
3. Buka browser Chrome/Safari di HP dan ketikkan alamat tersebut.
4. Anda juga bisa klik **"Tambahkan ke Layar Utama" (Add to Home Screen)** untuk menginstalnya seperti aplikasi bawaan (PWA).

---

## ⚡ Fitur Sinkronisasi Realtime (Kasir HP ⬌ Admin PC)

Aplikasi kini dilengkapi **Mesin Sinkronisasi Realtime (SSE & REST Backend)**:
- Ketika Kasir melayani pembeli di **HP** dan menekan **"Selesaikan Transaksi"**:
  1. Stok barang otomatis berkurang di seluruh perangkat.
  2. Riwayat mutasi barang keluar otomatis tercatat.
  3. Omset penjualan, Laba Kotor, dan **Laba Bersih Toko** di layar **Admin PC** langsung ter-update secara **LIVE** tanpa perlu reload halaman!
  4. Muncul notifikasi banner suara di layar Admin memberitahukan transaksi baru yang baru saja masuk dari kasir.
- Begitu pula saat Admin menambah produk baru atau melakukan **Restock Barang**, daftar barang di HP kasir langsung ter-update seketika.

---

## 🔑 Kredensial Akses Default

| Role | Kredensial Default | Keterangan |
| :--- | :--- | :--- |
| **Admin** | Password: `admin` | Akses panel keuangan, laporan, stok gudang, dan buku kas |
| **Kasir** | PIN: `1234` | Akses kasir POS melayani transaksi belanja |

*(Password & PIN dapat diganti kapan saja melalui menu **Pengaturan Admin**)*

---

## ⌨️ Shortcut Keyboard untuk PC / Laptop (Kasir Cepat)

- **`F2`** : Langsung fokus ke kolom pencarian produk / scan barcode.
- **`F4`** : Tahan pesanan (*Hold Order*).
- **`F8`** : Buka jendela pembayaran (*Checkout*).
- **`Esc`**: Tutup modal / popup yang sedang aktif.
# Cashier-Application
