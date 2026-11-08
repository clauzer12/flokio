# Flokio — Smart Broiler Recording Ledger 🐣

Aplikasi PWA (*Progressive Web App*) modern, ringan, dan **100% gratis selamanya** untuk pencatatan operasional peternakan ayam broiler, menggantikan lembar pencatatan kertas fisik.

---

## 🌟 Fitur Utama

1. **Peran Pengguna Terpisah (Role-Based Access Control):**
   * **Anak Kandang (Penjaga):** Login cepat dengan PIN 4-digit (`1234`), nomor WhatsApp dinamis, input harian (mati, pakan, stok masuk, sampling bobot), dan catatan lapangan (kondisi sekam, suhu, blower, obat/vitamin).
   * **Owner (Pemilik Peternakan):** Login master (`8888`), dashboard audit realtime, tombol koordinasi cepat **`💬 Chat WhatsApp Penjaga`**, manajemen gedung kandang, pembukaan flok baru (*Chick-in*), dan pencatatan panen.
2. **Konsistensi Menu Multi-Device:**
   * Di **HP**: 3 menu navigasi bawah (**Beranda**, **Kandang**, **Akun**).
   * Di **Tablet**: *Sidebar* responsif dengan menu yang persis sama untuk Anak Kandang (tanpa bocor menu owner), dan menu eksklusif **Lembar Rekap Kertas (Tabel 10 Kolom Fisik M1–M5)** khusus Owner.
3. **100% Offline-First (Tahan Sinyal Drop di Kandang):**
   * Menggunakan teknologi HTML5 **IndexedDB** & **Service Worker** (`sw.js`). Data tetap tersimpan aman di memori HP saat sinyal seluler mati di dalam kandang ayam.
4. **Otomasi Kalkulasi Peternakan:**
   * Menghitung otomatis Sisa Ayam, Feed Intake (FI g/ekor), FCR berjalan, mortalitas kumulatif, dan estimasi Indeks Prestasi (IP).
5. **Generator WhatsApp 1-Klik:**
   * Menyusun draf pesan WhatsApp rapi siap kirim ke grup atau owner dalam 1 kali klik.

---

## 📁 Struktur Berkas

```
flokio/
├── index.html            # Berkas utama aplikasi PWA
├── manifest.json         # Konfigurasi PWA Web App Manifest
├── sw.js                 # Service Worker (Strategi Offline Cache)
├── css/
│   └── style.css         # Desain tema Chickin Indonesia & tabel fisik
├── js/
│   ├── db.js             # Engine Database Lokal IndexedDB
│   └── app.js            # Controller antarmuka, routing, dan kalkulasi
├── assets/
│   └── icons/
│       └── flokio_mascot.jpg # Logo Maskot Resmi 3D Flokio
└── README.md             # Petunjuk instalasi & panduan
```

---

## 🚀 Cara Menjalankan

### Cara 1: Langsung Buka di Browser (Tanpa Install Tool Tambahan)
1. Buka folder `C:\Users\Prakas\.gemini\antigravity\scratch\flokio\`.
2. Klik ganda pada berkas **`index.html`** untuk membukanya di browser Google Chrome / Microsoft Edge.
3. Gunakan bilah simulator di bagian atas untuk menguji:
   * **Mode Peran:** 👷 Anak Kandang $\leftrightarrow$ 👑 Owner
   * **Mode Tampilan:** 📱 HP $\leftrightarrow$ 📟 Tablet
   * **Login Cepat:** Klik tombol **🔑 Login** $\rightarrow$ pilih Budi (`1234`) atau Pak Haji (`8888`).

### Cara 2: Install sebagai Aplikasi HP (PWA)
1. Buka tautan Flokio melalui Google Chrome di HP Anda.
2. Klik ikon titik tiga di pojok kanan atas browser $\rightarrow$ pilih **"Tambahkan ke Layar Utama" (Add to Home screen)** / **"Install Aplikasi"**.
3. Ikon maskot Flokio akan langsung muncul di menu HP Anda dan dapat dibuka selayaknya aplikasi Android / iOS native, bahkan saat ponsel dalam mode pesawat / tanpa kuota internet!

### Cara 3: Hosting 100% Gratis di GitHub Pages
1. Buat repositori baru di GitHub (misal: `flokio`).
2. Unggah seluruh isi folder `flokio/` ke repositori tersebut.
3. Masuk ke tab **Settings** $\rightarrow$ **Pages** $\rightarrow$ pilih branch `main` $\rightarrow$ klik **Save**.
4. Aplikasi Anda sudah langsung online secara resmi dengan HTTPS gratis selamanya di:  
   `https://<username-github>.github.io/flokio/`
