/**
 * Flokio Offline-First Database Layer (IndexedDB Engine)
 * Menyediakan penyimpanan lokal permanen di browser HP/Tablet tanpa butuh internet.
 * Mendukung ekspor/impor cadangan dan integrasi Cloud Sync.
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

  console.log('[IndexedDB] Mengisi data awal (Seeding Master Kandang 01 & Flok #4 lengkap)...');

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
    status_siklus: 'berjalan', // 'berjalan' | 'panen'
    stok_pakan_awal_kg: 1500,
    jenis_pakan_awal: 'BP-1 (Starter)',
    panen_jarang: [],
    panen_total: null
  });

  // Seed Data Riil Hari 1 s.d. Hari 16 (M1 & M2 Lengkap)
  const sampleData = [
    // M1: Hari 1 - 7 (Starter / Brooding)
    { id: 'log_f4_h01', flok_id: 'flok_k01_4', umur_hari: 1, tanggal: '2024-10-05', pakan_jenis: 'BP-1 (Starter)', pakan_pakai_kg: 35, pakan_masuk_kg: 1500, bw_sampling_gram: 42, kematian_ekor: 8, afkir_ekor: 0, catatan: 'DOC masuk 4.500 ekor, kondisi lincah, pemanas brooding 33°C' },
    { id: 'log_f4_h02', flok_id: 'flok_k01_4', umur_hari: 2, tanggal: '2024-10-06', pakan_jenis: 'BP-1 (Starter)', pakan_pakai_kg: 50, pakan_masuk_kg: 0, bw_sampling_gram: null, kematian_ekor: 6, afkir_ekor: 0, catatan: 'Suhu stabil 32°C, sekam kering, ayam aktif minum' },
    { id: 'log_f4_h03', flok_id: 'flok_k01_4', umur_hari: 3, tanggal: '2024-10-07', pakan_jenis: 'BP-1 (Starter)', pakan_pakai_kg: 70, pakan_masuk_kg: 0, bw_sampling_gram: null, kematian_ekor: 5, afkir_ekor: 0, catatan: 'Pemberian vitamin brooding dan elektrolit' },
    { id: 'log_f4_h04', flok_id: 'flok_k01_4', umur_hari: 4, tanggal: '2024-10-08', pakan_jenis: 'BP-1 (Starter)', pakan_pakai_kg: 90, pakan_masuk_kg: 0, bw_sampling_gram: null, kematian_ekor: 4, afkir_ekor: 0, catatan: 'Ventilasi tirai dibuka sedikit sirkulasi pagi' },
    { id: 'log_f4_h05', flok_id: 'flok_k01_4', umur_hari: 5, tanggal: '2024-10-09', pakan_jenis: 'BP-1 (Starter)', pakan_pakai_kg: 110, pakan_masuk_kg: 0, bw_sampling_gram: null, kematian_ekor: 4, afkir_ekor: 0, catatan: 'Pelebaran sekat chick guard tahap 1' },
    { id: 'log_f4_h06', flok_id: 'flok_k01_4', umur_hari: 6, tanggal: '2024-10-10', pakan_jenis: 'BP-1 (Starter)', pakan_pakai_kg: 130, pakan_masuk_kg: 0, bw_sampling_gram: null, kematian_ekor: 3, afkir_ekor: 0, catatan: 'Kondisi feses normal, nafsu makan baik' },
    { id: 'log_f4_h07', flok_id: 'flok_k01_4', umur_hari: 7, tanggal: '2024-10-11', pakan_jenis: 'BP-1 (Starter)', pakan_pakai_kg: 150, pakan_masuk_kg: 0, bw_sampling_gram: 182, kematian_ekor: 3, afkir_ekor: 0, catatan: 'Sampling akhir M1 rata-rata 182g (Target tercapai)' },

    // M2: Hari 8 - 14 (Grower)
    { id: 'log_f4_h08', flok_id: 'flok_k01_4', umur_hari: 8, tanggal: '2024-10-12', pakan_jenis: 'B11A (Grower)', pakan_pakai_kg: 150, pakan_masuk_kg: 150, bw_sampling_gram: 215, kematian_ekor: 15, afkir_ekor: 0, catatan: 'Peralihan pakan ke grower B11A, suhu 29°C' },
    { id: 'log_f4_h09', flok_id: 'flok_k01_4', umur_hari: 9, tanggal: '2024-10-13', pakan_jenis: 'B11A (Grower)', pakan_pakai_kg: 200, pakan_masuk_kg: 1500, bw_sampling_gram: null, kematian_ekor: 15, afkir_ekor: 0, catatan: 'Pakan masuk 30 sak (1.500 kg) B11A' },
    { id: 'log_f4_h10', flok_id: 'flok_k01_4', umur_hari: 10, tanggal: '2024-10-14', pakan_jenis: 'B11A (Grower)', pakan_pakai_kg: 200, pakan_masuk_kg: 0, bw_sampling_gram: null, kematian_ekor: 9, afkir_ekor: 0, catatan: 'Sekam kering, kipas exhaust 1 aktif periodik' },
    { id: 'log_f4_h11', flok_id: 'flok_k01_4', umur_hari: 11, tanggal: '2024-10-15', pakan_jenis: 'B11A (Grower)', pakan_pakai_kg: 250, pakan_masuk_kg: 0, bw_sampling_gram: null, kematian_ekor: 7, afkir_ekor: 0, catatan: 'Kondisi ayam lincah, air minum lancar' },
    { id: 'log_f4_h12', flok_id: 'flok_k01_4', umur_hari: 12, tanggal: '2024-10-16', pakan_jenis: 'B11A (Grower)', pakan_pakai_kg: 250, pakan_masuk_kg: 0, bw_sampling_gram: null, kematian_ekor: 9, afkir_ekor: 0, catatan: 'Pemberian vitamin anti-stres' },
    { id: 'log_f4_h13', flok_id: 'flok_k01_4', umur_hari: 13, tanggal: '2024-10-17', pakan_jenis: 'B11A (Grower)', pakan_pakai_kg: 300, pakan_masuk_kg: 0, bw_sampling_gram: null, kematian_ekor: 12, afkir_ekor: 0, catatan: 'Exhaust fan 3 aktif suhu siang 30°C' },
    { id: 'log_f4_h14', flok_id: 'flok_k01_4', umur_hari: 14, tanggal: '2024-10-18', pakan_jenis: 'B11A (Grower)', pakan_pakai_kg: 250, pakan_masuk_kg: 0, bw_sampling_gram: 469, kematian_ekor: 9, afkir_ekor: 0, catatan: 'Timbang sampling 50 ekor: avg 469g' },

    // M3: Hari 15 & 16
    { id: 'log_f4_h15', flok_id: 'flok_k01_4', umur_hari: 15, tanggal: '2024-10-19', pakan_jenis: 'B11A (Grower)', pakan_pakai_kg: 320, pakan_masuk_kg: 1000, bw_sampling_gram: null, kematian_ekor: 6, afkir_ekor: 0, catatan: 'Ayam aktif makan, pakan masuk 20 sak' },
    { id: 'log_f4_h16', flok_id: 'flok_k01_4', umur_hari: 16, tanggal: '2024-10-20', pakan_jenis: 'B11A (Grower)', pakan_pakai_kg: 350, pakan_masuk_kg: 0, bw_sampling_gram: 620, kematian_ekor: 6, afkir_ekor: 0, catatan: 'Kondisi sekam kering, ayam lincah, suhu exhaust fan stabil 28°C' }
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

  // Status Sinkronisasi
  await putRecord(db, 'settings', {
    key: 'cloud_sync',
    enabled: false,
    farm_id: 'kandang-01-flokio'
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

// Helper: Hapus satu data
function deleteRecord(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Helper: Bersihkan seluruh store
function clearStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
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

// ================= EXPORT API DATABASE =================
window.FlokioDB = {
  open: openDB,

  // Daily Logs
  saveDailyLog: async (log) => {
    const db = await openDB();
    return putRecord(db, 'catatan_harian', log);
  },
  getDailyLogsByFlok: async (flokId) => {
    const db = await openDB();
    const all = await getAllRecords(db, 'catatan_harian');
    return all.filter(item => item.flok_id === flokId).sort((a, b) => a.umur_hari - b.umur_hari);
  },
  getDailyLogByUmur: async (flokId, umurHari) => {
    const db = await openDB();
    const all = await getAllRecords(db, 'catatan_harian');
    return all.find(item => item.flok_id === flokId && item.umur_hari === umurHari) || null;
  },
  deleteDailyLog: async (logId) => {
    const db = await openDB();
    return deleteRecord(db, 'catatan_harian', logId);
  },
  clearDailyLogsByFlok: async (flokId) => {
    const db = await openDB();
    const all = await getAllRecords(db, 'catatan_harian');
    const toDelete = all.filter(item => item.flok_id === flokId);
    for (const item of toDelete) {
      await deleteRecord(db, 'catatan_harian', item.id);
    }
  },

  // Flok
  saveFlok: async (flok) => {
    const db = await openDB();
    return putRecord(db, 'flok', flok);
  },
  getFlok: async (id) => {
    const db = await openDB();
    return getRecord(db, 'flok', id);
  },
  getAllFloks: async () => {
    const db = await openDB();
    return getAllRecords(db, 'flok');
  },
  getActiveFlokByKandang: async (kandangId = 'k01') => {
    const db = await openDB();
    const all = await getAllRecords(db, 'flok');
    const floks = all.filter(f => f.kandang_id === kandangId);
    // Prioritaskan flok yang statusnya 'berjalan', atau ambil nomor flok tertinggi
    const aktif = floks.find(f => f.status_siklus === 'berjalan');
    if (aktif) return aktif;
    if (floks.length > 0) {
      floks.sort((a, b) => (b.nomor_flok || 0) - (a.nomor_flok || 0));
      return floks[0];
    }
    return null;
  },

  // Kandang
  saveKandang: async (kandang) => {
    const db = await openDB();
    return putRecord(db, 'kandang', kandang);
  },
  getKandang: async (id) => {
    const db = await openDB();
    return getRecord(db, 'kandang', id);
  },
  getAllKandang: async () => {
    const db = await openDB();
    return getAllRecords(db, 'kandang');
  },

  // Settings
  saveSetting: async (key, value) => {
    const db = await openDB();
    return putRecord(db, 'settings', { key, ...value });
  },
  getSetting: async (key) => {
    const db = await openDB();
    return getRecord(db, 'settings', key);
  },

  // Ekspor & Impor Seluruh Data (Data Portability Antar Perangkat)
  exportAllData: async () => {
    const db = await openDB();
    const payload = {
      app: 'Flokio Broiler App',
      version: DB_VERSION,
      timestamp: new Date().toISOString(),
      kandang: await getAllRecords(db, 'kandang'),
      flok: await getAllRecords(db, 'flok'),
      catatan_harian: await getAllRecords(db, 'catatan_harian'),
      settings: await getAllRecords(db, 'settings')
    };
    return JSON.stringify(payload, null, 2);
  },

  importAllData: async (jsonString) => {
    const db = await openDB();
    const data = JSON.parse(jsonString);

    if (Array.isArray(data.kandang)) {
      await clearStore(db, 'kandang');
      for (const k of data.kandang) await putRecord(db, 'kandang', k);
    }
    if (Array.isArray(data.flok)) {
      await clearStore(db, 'flok');
      for (const f of data.flok) await putRecord(db, 'flok', f);
    }
    if (Array.isArray(data.catatan_harian)) {
      await clearStore(db, 'catatan_harian');
      for (const c of data.catatan_harian) await putRecord(db, 'catatan_harian', c);
    }
    if (Array.isArray(data.settings)) {
      await clearStore(db, 'settings');
      for (const s of data.settings) await putRecord(db, 'settings', s);
    }
    return true;
  }
};
