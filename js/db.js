/**
 * Flokio Offline-First Database Layer (IndexedDB Engine)
 * Menyediakan penyimpanan lokal permanen di memori browser HP/Tablet tanpa butuh internet.
 */

const DB_NAME = 'FlokioBroilerDB';
const DB_VERSION = 1;

let dbInstance = null;

// Buka / Inisialisasi Database IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. ObjectStore: Kandang
      if (!db.objectStoreNames.contains('kandang')) {
        db.createObjectStore('kandang', { keyPath: 'id' });
      }

      // 2. ObjectStore: Flok (Siklus Pemeliharaan)
      if (!db.objectStoreNames.contains('flok')) {
        db.createObjectStore('flok', { keyPath: 'id' });
      }

      // 3. ObjectStore: Catatan Harian (Operational Daily Records)
      if (!db.objectStoreNames.contains('catatan_harian')) {
        const store = db.createObjectStore('catatan_harian', { keyPath: 'id' });
        store.createIndex('flok_id', 'flok_id', { unique: false });
        store.createIndex('umur_hari', 'umur_hari', { unique: false });
        store.createIndex('flok_umur', ['flok_id', 'umur_hari'], { unique: true });
      }

      // 4. ObjectStore: Pengaturan & Sesi Pengguna
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      seedInitialData(dbInstance).then(() => resolve(dbInstance));
    };

    request.onerror = (event) => {
      console.error('[IndexedDB] Gagal membuka database:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Inisialisasi data bawaan jika pertama kali dibuka
async function seedInitialData(db) {
  const count = await countRecords(db, 'kandang');
  if (count > 0) return; // Sudah terisi data sebelumnya

  console.log('[IndexedDB] Mengisi data awal (Seeding Master Kandang 01 & Flok #4)...');

  // Master Kandang
  await putRecord(db, 'kandang', {
    id: 'k01',
    nama: 'Kandang 01',
    tipe: 'Closed House',
    kapasitas: 5000,
    status: 'aktif',
    operator_default: 'Budi Santoso',
    operator_wa: '081234567890'
  });

  await putRecord(db, 'kandang', {
    id: 'k02',
    nama: 'Kandang 02',
    tipe: 'Closed House',
    kapasitas: 5000,
    status: 'kosong',
    operator_default: '-',
    operator_wa: ''
  });

  // Flok #4 Aktif di Kandang 01
  await putRecord(db, 'flok', {
    id: 'flok_k01_4',
    kandang_id: 'k01',
    nomor_flok: 4,
    tanggal_chickin: '2024-10-05',
    strain: 'Cobb 500',
    populasi_awal: 4500,
    bobot_doc_gram: 42,
    status_siklus: 'berjalan', // 'berjalan' | 'panen' | 'kosong'
    stok_pakan_awal_kg: 1500,
    jenis_pakan_awal: 'BP-1'
  });

  // Seed Data Minggu 2 (Hari 8 - 14) untuk Tabel Rekap Kertas
  const sampleData = [
    { id: 'log_f4_h08', flok_id: 'flok_k01_4', umur_hari: 8, tanggal: '2024-10-12', jenis_pakan: 'B11A', pakan_pakai_kg: 150, pakan_masuk_kg: 150, sisa_stok_kg: 100, fi: 35.0, bw_sampling: 173, mati: 15, afkir: 0, sisa_ayam: 4278, catatan: 'Suhu stabil 29C' },
    { id: 'log_f4_h09', flok_id: 'flok_k01_4', umur_hari: 9, tanggal: '2024-10-13', jenis_pakan: 'B11A', pakan_pakai_kg: 200, pakan_masuk_kg: 1500, sisa_stok_kg: 1400, fi: 46.9, bw_sampling: null, mati: 15, afkir: 0, sisa_ayam: 4263, catatan: 'Pakan masuk 30 sak' },
    { id: 'log_f4_h10', flok_id: 'flok_k01_4', umur_hari: 10, tanggal: '2024-10-14', jenis_pakan: 'B11A', pakan_pakai_kg: 200, pakan_masuk_kg: 0, sisa_stok_kg: 1200, fi: 47.0, bw_sampling: null, mati: 9, afkir: 0, sisa_ayam: 4254, catatan: 'Sekam kering' },
    { id: 'log_f4_h11', flok_id: 'flok_k01_4', umur_hari: 11, tanggal: '2024-10-15', jenis_pakan: 'B11A', pakan_pakai_kg: 250, pakan_masuk_kg: 0, sisa_stok_kg: 950, fi: 58.7, bw_sampling: null, mati: 7, afkir: 0, sisa_ayam: 4247, catatan: 'Kondisi lincah' },
    { id: 'log_f4_h12', flok_id: 'flok_k01_4', umur_hari: 12, tanggal: '2024-10-16', jenis_pakan: 'B11A', pakan_pakai_kg: 250, pakan_masuk_kg: 0, sisa_stok_kg: 700, fi: 58.9, bw_sampling: null, mati: 9, afkir: 0, sisa_ayam: 4238, catatan: 'Pemberian vitamin C' },
    { id: 'log_f4_h13', flok_id: 'flok_k01_4', umur_hari: 13, tanggal: '2024-10-17', jenis_pakan: 'B11A', pakan_pakai_kg: 300, pakan_masuk_kg: 0, sisa_stok_kg: 400, fi: 70.9, bw_sampling: null, mati: 12, afkir: 0, sisa_ayam: 4226, catatan: 'Exhaust fan 3 aktif' },
    { id: 'log_f4_h14', flok_id: 'flok_k01_4', umur_hari: 14, tanggal: '2024-10-18', jenis_pakan: 'B11A', pakan_pakai_kg: 250, pakan_masuk_kg: 0, sisa_stok_kg: 150, fi: 59.2, bw_sampling: 469, mati: 9, afkir: 0, sisa_ayam: 4217, catatan: 'Timbang sampling 50 ekor' },
    { id: 'log_f4_h15', flok_id: 'flok_k01_4', umur_hari: 15, tanggal: '2024-10-19', jenis_pakan: 'B11A', pakan_pakai_kg: 320, pakan_masuk_kg: 1000, sisa_stok_kg: 830, fi: 75.9, bw_sampling: null, mati: 6, afkir: 0, sisa_ayam: 4211, catatan: 'Ayam aktif makan' },
    { id: 'log_f4_h16', flok_id: 'flok_k01_4', umur_hari: 16, tanggal: '2024-10-20', jenis_pakan: 'B11A', pakan_pakai_kg: 350, pakan_masuk_kg: 0, sisa_stok_kg: 800, fi: 83.2, bw_sampling: null, mati: 6, afkir: 0, sisa_ayam: 4205, catatan: 'Kondisi sekam kering, ayam lincah, suhu exhaust fan stabil 28C' }
  ];

  for (const log of sampleData) {
    await putRecord(db, 'catatan_harian', log);
  }

  // Pengaturan Penjaga Aktif
  await putRecord(db, 'settings', {
    key: 'current_penjaga',
    nama: 'Budi Santoso',
    wa: '081234567890'
  });
}

// Helper: Simpan data (Upsert)
function putRecord(db, storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Helper: Ambil data berdasarkan Key
function getRecord(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Helper: Ambil semua data
function getAllRecords(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Helper: Hitung data
function countRecords(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Export API Database
window.FlokioDB = {
  open: openDB,
  saveDailyLog: async (log) => {
    const db = await openDB();
    return putRecord(db, 'catatan_harian', log);
  },
  getDailyLogsByFlok: async (flokId) => {
    const db = await openDB();
    const all = await getAllRecords(db, 'catatan_harian');
    return all.filter(item => item.flok_id === flokId).sort((a, b) => a.umur_hari - b.umur_hari);
  },
  saveSetting: async (key, value) => {
    const db = await openDB();
    return putRecord(db, 'settings', { key, ...value });
  },
  getSetting: async (key) => {
    const db = await openDB();
    return getRecord(db, 'settings', key);
  },
  saveKandang: async (kandang) => {
    const db = await openDB();
    return putRecord(db, 'kandang', kandang);
  },
  getAllKandang: async () => {
    const db = await openDB();
    return getAllRecords(db, 'kandang');
  },
  saveFlok: async (flok) => {
    const db = await openDB();
    return putRecord(db, 'flok', flok);
  },
  getFlok: async (id) => {
    const db = await openDB();
    return getRecord(db, 'flok', id);
  }
};
