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

  console.log('[IndexedDB] Menyiapkan struktur kandang bersih (Tanpa data dummy)...');

  // Master Kandang Bersih (Status kosong, siap untuk Chick-in baru)
  await putRecord(db, 'kandang', {
    id: 'k01',
    nama: 'Kandang 01',
    tipe: 'Closed House',
    kapasitas: 5000,
    status: 'kosong',
    operator_default: '-',
    operator_wa: ''
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

  // Kunci Akses Dashboard Khusus Master Developer (Hanya diketahui oleh "Gua")
  await putRecord(db, 'settings', {
    key: 'master_passcode',
    _val: 'masterflokio'
  });

  // Daftar Akun Owner Sah (Hanya dapat dibuat di Dashboard Khusus oleh "Gua")
  // Awalnya KOSONG. Akun Owner HANYA BISA DIGUNAKAN jika sudah dibuat oleh Master Developer di Dashboard Khusus.
  await putRecord(db, 'settings', {
    key: 'owner_accounts_list',
    _val: []
  });

  // Pointer Akun Owner Aktif (Kosong saat awal sebelum login)
  await putRecord(db, 'settings', {
    key: 'owner_account',
    _val: null
  });

  // Daftar Akun Anak Kandang (Dikelola Eksklusif oleh Owner - Maksimal 3 Akun)
  // Awalnya KOSONG sampai Owner membuatnya di Menu Akun.
  await putRecord(db, 'settings', {
    key: 'anak_kandang_list',
    _val: []
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
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return putRecord(db, 'settings', { key, ...value, _val: value });
    } else {
      return putRecord(db, 'settings', { key, _val: value });
    }
  },
  getSetting: async (key) => {
    const db = await openDB();
    const record = await getRecord(db, 'settings', key);
    if (!record) return null;
    return record._val !== undefined ? record._val : record;
  },

  // Reset & Pembersihan Data Dummy
  resetAllFlokAndLogs: async () => {
    const db = await openDB();
    await clearStore(db, 'flok');
    await clearStore(db, 'catatan_harian');
    const k1 = await getRecord(db, 'kandang', 'k01');
    if (k1) { k1.status = 'kosong'; await putRecord(db, 'kandang', k1); }
    const k2 = await getRecord(db, 'kandang', 'k02');
    if (k2) { k2.status = 'kosong'; await putRecord(db, 'kandang', k2); }
    return true;
  },

  cleanLegacyDummyFlok: async () => {
    try {
      const db = await openDB();
      const floks = await getAllRecords(db, 'flok');
      const hasDummy = floks.some(f => f.id === 'flok_k01_4');
      if (hasDummy) {
        console.log('[FlokioDB] Membersihkan data dummy bawaan (flok_k01_4)...');
        await clearStore(db, 'flok');
        await clearStore(db, 'catatan_harian');
        const k1 = await getRecord(db, 'kandang', 'k01');
        if (k1) { k1.status = 'kosong'; await putRecord(db, 'kandang', k1); }
      }
      const penjaga = await getRecord(db, 'settings', 'current_penjaga');
      if (penjaga && (penjaga.nama === 'Budi Santoso' || (penjaga._val && penjaga._val.nama === 'Budi Santoso'))) {
        await deleteRecord(db, 'settings', 'current_penjaga');
      }
    } catch (e) {
      console.warn('Gagal bersihkan data dummy legacy:', e);
    }
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
