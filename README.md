# Flokio — Smart Broiler Recording Ledger 🐣

Aplikasi PWA (*Progressive Web App*) modern, offline-first, dan **100% gratis selamanya** untuk pencatatan operasional peternakan ayam broiler, menggantikan lembar pencatatan kertas fisik.

---

## 🌟 Fitur Utama Terbaru

1. **Siklus Lengkap Broiler (Chick-in s.d. Panen Total & Hitung IP):**
   * **Chick-in Flok Baru:** Atur tanggal DOC masuk, populasi awal (DOC), bobot awal DOC, stok pakan awal, dan strain ayam.
   * **Input Harian Hari 1 s.d. 35:** Fleksibel memilih umur ayam dengan tombol cepat `[ 💾 Simpan & Lanjut ke H+1 ❯ ]` untuk kemudahan simulasi seluruh siklus dari awal hingga panen.
   * **Pencatatan Panen:** Mendukung **Panen Jarang (Penjarangan)** dan **Panen Total (Tutup Siklus)**.
   * **Kalkulasi Indeks Performa (IP) Resmi:**
     $$\text{IP} = \frac{(100 - \text{Deplesi}) \times \text{Bobot Rata-rata (kg)}}{\text{FCR} \times \text{Umur Rata-rata}} \times 100$$
     Dilengkapi sertifikat hasil panen flok dan format laporan WhatsApp 1-klik.

2. **Lembar Rekapitulasi 10 Kolom Fisik (M1–M5) 100% Dinamis:**
   * Meniru lembar pencatatan fisik standar industri (Chickin Indonesia / CP / Japfa).
   * Tab mingguan: **M1 (H1-7)**, **M2 (H8-14)**, **M3 (H15-21)**, **M4 (H22-28)**, dan **M5 (H29-35)**.
   * Kolom: `Tgl | Umur | Jenis Pakan | Pakai (Kg) | Masuk (Kg) | Sisa Pakan | FI (g/ek) | BW (g) | Mati | Sisa Ekor`.
   * Otomatis menghitung akumulasi kematian, deplesi kumulatif, sisa ayam, sisa stok pakan, dan total mingguan.

3. **Peran Pengguna Terpisah & Sinkronisasi Realtime:**
   * **👷 Anak Kandang (Penjaga):** Input operasional harian, pakan masuk, sampling timbang, dan catatan kondisi lapangan.
   * **👑 Owner (Pemilik):** Dashboard audit terpadu, verifikasi laporan masuk hari ini, tombol chat WhatsApp penjaga, otorisasi panen, dan evaluasi IP flok.
   * Setiap data yang disimpan oleh Anak Kandang langsung tersinkron detik itu juga ke metrik dan tabel Owner!

4. **Sinkronisasi Multi-Perangkat (HP Anak Kandang $\leftrightarrow$ Laptop Owner):**
   * **Opsi A (Cadangan Offline JSON):** Ekspor cadangan dari HP dan impor di laptop dengan 1 klik tanpa butuh internet.
   * **Opsi B (Cloud Sync Realtime Firebase):** Mendukung sinkronisasi awan otomatis gratis via Firebase Firestore CDN.

---

## 📁 Struktur Berkas

```
flokio/
├── index.html            # Berkas utama aplikasi PWA (UI Dinamis)
├── manifest.json         # Konfigurasi PWA Web App Manifest
├── sw.js                 # Service Worker (Strategi Offline Cache v2)
├── css/
│   └── style.css         # Desain tema Chickin Indonesia & tabel fisik
├── js/
│   ├── db.js             # Engine Database Lokal IndexedDB (CRUD & Portabilitas)
│   └── app.js            # Controller lifecycle, routing, dan kalkulasi IP
├── assets/
│   └── icons/
│       └── flokio_mascot.jpg # Logo Maskot Resmi 3D Flokio
└── README.md             # Dokumentasi & panduan
```

---

## 🚀 Panduan Uji Coba (Dari Chick-in sampai Panen)

1. **Buka Aplikasi:**
   * Buka `index.html` di browser Anda (atau via GitHub Pages: `https://clauzer12.github.io/flokio/`).
2. **Login Cepat:**
   * Masuk sebagai **👷 Anak Kandang** (PIN: `1234`).
3. **Mulai Siklus Baru (Chick-in):**
   * Buka menu **Akun** atau beralih ke Owner $\rightarrow$ klik **🐣 Mulai Chick-in Flok Baru** (misal Flok #5, 5.000 ekor DOC).
4. **Input Harian:**
   * Di Beranda, masukkan data Hari ke-1 (misal mati 5, pakan 35 kg) $\rightarrow$ klik **`💾 Simpan & Lanjut ke H+1 ❯`**.
   * Lakukan untuk hari-hari berikutnya. Amati Sisa Ayam, Feed Intake (FI), dan Stok Pakan yang berkurang secara otomatis!
5. **Cek Lembar Rekap Kertas (Owner):**
   * Beralih ke **👑 Owner** $\rightarrow$ buka menu **Lembar Rekap Kertas**.
   * Buka tab **M1 (H1-7)**, **M2 (H8-14)**, dst. Semua 10 kolom terisi rapi sesuai data yang Anda input!
6. **Eksekusi Panen & Lihat Nilai IP:**
   * Klik tombol **⚖️ Catat Panen (IP)**.
   * Pilih **Panen Total** $\rightarrow$ masukkan total tonase timbang $\rightarrow$ klik **Simpan Data Panen**.
   * Nilai **Indeks Performa (IP)** resmi akan langsung dihitung dan sertifikat hasil panen muncul di layar!
