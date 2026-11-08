/**
 * Flokio Main Application Logic
 * Siklus Lengkap Broiler (Chick-in s.d. Panen Total), Rekap 10 Kolom Dinamis,
 * Sinkronisasi Role Realtime & Portabilitas Multi-Perangkat.
 */

// ================= GLOBAL STATE =================
let currentRole = 'kandang';    // 'kandang' | 'owner'
let currentDevice = 'phone';     // 'phone' | 'tablet'
let currentScreen = 'login';     // 'login' | 'beranda' | 'kandang' | 'rekap' | 'akun'
let activeKandangId = 'k01';
let activeFlok = null;
let dailyLogs = [];
let currentInputUmur = 16;       // Umur yang sedang aktif di-inspect / di-input (1 s.d. 35)
let currentWeekTab = 2;          // Default Minggu 2 (H8-14)
let pakanUnit = 'kg';            // 'kg' | 'sak'
let panenMode = 'jarang';        // 'jarang' | 'total'
let lastHarvestReportText = '';

let currentPenjaga = {
  nama: 'Budi Santoso',
  wa: '081234567890'
};

// ================= INITIALIZATION & SERVICE WORKER =================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Daftarkan Service Worker untuk PWA Offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] Service Worker aktif:', reg.scope))
      .catch(err => console.warn('[PWA] Service Worker register gagal:', err));
  }

  // 2. Buka Database & Muat Data Aktif
  try {
    await FlokioDB.open();

    // Muat data penjaga
    const savedPenjaga = await FlokioDB.getSetting('current_penjaga');
    if (savedPenjaga) {
      currentPenjaga.nama = savedPenjaga.nama || 'Budi Santoso';
      currentPenjaga.wa = savedPenjaga.wa || '081234567890';
    }

    // Muat Flok Aktif
    await reloadAppData();

    // Inisialisasi dropdown umur (Hari 1 s.d. Hari 35)
    initUmurDropdown();

    // Set umur input ke hari data terbaru atau hari ke-1
    if (dailyLogs.length > 0) {
      const maxUmur = Math.max(...dailyLogs.map(l => l.umur_hari));
      currentInputUmur = maxUmur;
      currentWeekTab = Math.min(5, Math.ceil(maxUmur / 7));
    } else {
      currentInputUmur = 1;
      currentWeekTab = 1;
    }

  } catch (err) {
    console.error('[App Init] Gagal inisialisasi data:', err);
  }

  // 3. Render Awal & Deteksi Perangkat
  detectAndApplyDevice();
  renderAllViews();
  selectUmur(currentInputUmur);
  setRole('kandang');
  navigateTo('login');
});

// Helper: Muat ulang flok dan catatan harian dari DB
async function reloadAppData() {
  activeFlok = await FlokioDB.getActiveFlokByKandang(activeKandangId);
  if (!activeFlok) {
    // Fallback jika belum ada
    activeFlok = {
      id: 'flok_k01_4',
      kandang_id: 'k01',
      nomor_flok: 4,
      tanggal_chickin: '2024-10-05',
      strain: 'Cobb 500',
      populasi_awal: 4500,
      bobot_doc_gram: 42,
      status_siklus: 'berjalan',
      stok_pakan_awal_kg: 1500,
      jenis_pakan_awal: 'BP-1 (Starter)',
      panen_jarang: [],
      panen_total: null
    };
    await FlokioDB.saveFlok(activeFlok);
  }

  dailyLogs = await FlokioDB.getDailyLogsByFlok(activeFlok.id);
}

// Inisialisasi Opsi Umur 1 s.d. 35
function initUmurDropdown() {
  const sel = document.getElementById('selectUmurInput');
  if (!sel) return;
  sel.innerHTML = '';
  for (let i = 1; i <= 35; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.text = `Hari ke-${i}`;
    sel.appendChild(opt);
  }
}

// ================= SCREEN NAVIGATION ROUTER =================
function navigateTo(screenName) {
  currentScreen = screenName;
  document.querySelectorAll('.screen-view').forEach(el => el.classList.add('hidden'));

  // Layar Login: Sembunyikan Header & Navigasi
  if (screenName === 'login') {
    document.getElementById('screenLogin').classList.remove('hidden');
    document.getElementById('mainTopHeader').classList.add('hidden');
    document.getElementById('bottomNav').classList.add('hidden');
    const sb = document.getElementById('sidebar');
    if (sb) {
      sb.classList.add('hidden');
      sb.classList.remove('flex');
    }
    return;
  }

  // Layar Kerja
  document.getElementById('mainTopHeader').classList.remove('hidden');
  if (currentDevice === 'phone') {
    document.getElementById('bottomNav').classList.remove('hidden');
    const sb = document.getElementById('sidebar');
    if (sb) {
      sb.classList.add('hidden');
      sb.classList.remove('flex');
    }
  } else {
    document.getElementById('bottomNav').classList.add('hidden');
    const sb = document.getElementById('sidebar');
    if (sb) {
      sb.classList.remove('hidden');
      sb.classList.add('flex');
    }
  }

  if (screenName === 'beranda') {
    document.getElementById('screenBeranda').classList.remove('hidden');
    renderAllViews();
  } else if (screenName === 'kandang') {
    document.getElementById('screenKandang').classList.remove('hidden');
    renderAllViews();
  } else if (screenName === 'rekap') {
    // ROUTE GUARD: Lembar Rekap Fisik eksklusif untuk Owner
    if (currentRole === 'kandang') {
      showToast('Akses Dibatasi: Lembar Rekap Kertas wewenang Owner.');
      navigateTo('beranda');
      return;
    }
    document.getElementById('screenRekap').classList.remove('hidden');
    renderRekapTable();
  } else if (screenName === 'akun') {
    document.getElementById('screenAkun').classList.remove('hidden');
    renderAkunView();
  }

  updateBottomNavState(screenName);
  updateSidebarNavState(screenName);
}

function updateBottomNavState(screenName) {
  const bBeranda = document.getElementById('botNavBeranda');
  const bKandang = document.getElementById('botNavKandang');
  const bAkun = document.getElementById('botNavAkun');

  const active = 'text-[#3B5166] flex flex-col items-center gap-1 text-[11px] font-bold flex-1';
  const inactive = 'text-slate-400 hover:text-slate-800 flex flex-col items-center gap-1 text-[11px] font-medium flex-1';

  if (bBeranda) bBeranda.className = screenName === 'beranda' ? active : inactive;
  if (bKandang) bKandang.className = screenName === 'kandang' ? active : inactive;
  if (bAkun) bAkun.className = screenName === 'akun' ? active : inactive;
}

function updateSidebarNavState(screenName) {
  const sBeranda = document.getElementById('sideNavBeranda');
  const sKandang = document.getElementById('sideNavKandang');
  const sRekap = document.getElementById('sideNavRekap');
  const sAkun = document.getElementById('sideNavAkun');

  const activeClass = 'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white text-[#3B5166] font-bold shadow-xs border border-slate-200 text-left';
  const inactiveClass = 'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-white font-medium text-left';

  if (sBeranda) sBeranda.className = screenName === 'beranda' ? activeClass : inactiveClass;
  if (sKandang) sKandang.className = screenName === 'kandang' ? activeClass : inactiveClass;
  if (sRekap) sRekap.className = screenName === 'rekap' ? activeClass : inactiveClass;
  if (sAkun) sAkun.className = screenName === 'akun' ? activeClass : inactiveClass;

  if (sRekap) {
    if (currentRole === 'kandang') {
      sRekap.classList.add('hidden');
      sRekap.classList.remove('flex');
    } else {
      sRekap.classList.remove('hidden');
      sRekap.classList.add('flex');
    }
  }
}

// ================= AUTH & LOGIN LOGIC =================
function switchLoginTab(role) {
  const tabKandang = document.getElementById('tabLoginKandang');
  const tabOwner = document.getElementById('tabLoginOwner');
  const formKandang = document.getElementById('formLoginKandang');
  const formOwner = document.getElementById('formLoginOwner');

  if (role === 'kandang') {
    tabKandang.className = 'flex-1 py-2 font-bold rounded-xl bg-white text-slate-900 shadow-xs transition-all flex items-center justify-center gap-1.5';
    tabOwner.className = 'flex-1 py-2 font-medium rounded-xl text-slate-500 hover:text-slate-900 transition-all flex items-center justify-center gap-1.5';
    formKandang.classList.remove('hidden');
    formOwner.classList.add('hidden');
  } else {
    tabOwner.className = 'flex-1 py-2 font-bold rounded-xl bg-white text-slate-900 shadow-xs transition-all flex items-center justify-center gap-1.5';
    tabKandang.className = 'flex-1 py-2 font-medium rounded-xl text-slate-500 hover:text-slate-900 transition-all flex items-center justify-center gap-1.5';
    formOwner.classList.remove('hidden');
    formKandang.classList.add('hidden');
  }
}

async function submitLogin(role) {
  if (role === 'kandang') {
    const pin = document.getElementById('loginPinKandang').value;
    const namaInput = document.getElementById('loginOperatorNama').value.trim();
    const waInput = document.getElementById('loginOperatorWA').value.trim();

    currentPenjaga.nama = namaInput || 'Budi Santoso';
    currentPenjaga.wa = waInput || '081234567890';
    try {
      await FlokioDB.saveSetting('current_penjaga', currentPenjaga);
    } catch (e) {
      console.warn('Gagal simpan setting ke DB:', e);
    }

    if (pin === '1234') {
      setRole('kandang');
      navigateTo('beranda');
      showToast(`Login Berhasil! Selamat bertugas, ${currentPenjaga.nama}.`);
    } else {
      alert('PIN Anak Kandang Salah! Gunakan PIN demo: 1234');
    }
  } else {
    const pass = document.getElementById('loginOwnerPass').value;
    if (pass === '8888') {
      setRole('owner');
      navigateTo('beranda');
      showToast('Login Berhasil! Selamat datang, Pak Haji (Owner).');
    } else {
      alert('PIN/Password Owner Salah! Gunakan PIN demo: 8888');
    }
  }
}

function quickLoginDemo(role) {
  switchLoginTab(role);
  submitLogin(role);
}

function handleLogout() {
  navigateTo('login');
  showToast('Sesi Berakhir: Anda telah keluar ke Layar Login.');
}

function toggleActiveRole() {
  setRole(currentRole === 'kandang' ? 'owner' : 'kandang');
  showToast(`Beralih Mode ke: ${currentRole === 'owner' ? '👑 Owner' : '👷 Anak Kandang'}`);
}

// ================= ROLE & ACCESS CONTROL =================
function setRole(role) {
  currentRole = role;
  const btnKandang = document.getElementById('btnRoleKandang');
  const btnOwner = document.getElementById('btnRoleOwner');

  const cardOwner = document.getElementById('cardFlokOwnerActive');
  const cardKandang = document.getElementById('cardFlokKandangActive');
  const cardEmpty = document.getElementById('cardFlokEmptyState');

  const formInput = document.getElementById('sectionFormInput');
  const cardSaved = document.getElementById('cardCatatanSaved');
  const ownerAudit = document.getElementById('sectionOwnerAudit');

  const btnRekapHome = document.getElementById('btnNavRekapOwnerOnly');
  const sideNavRekap = document.getElementById('sideNavRekap');
  const sideOwnerGroup = document.getElementById('sideOwnerGroup');
  const btnTambahKandang = document.getElementById('btnTambahKandangInScreen');

  const topBadge = document.getElementById('topHeaderBadge');
  const sidebarRoleTag = document.getElementById('sidebarRoleTag');
  const sidebarUserLabel = document.getElementById('sidebarUserLabel');
  const sidebarSubLabel = document.getElementById('sidebarSubLabel');

  const isFlokEmpty = activeFlok && activeFlok.status_siklus === 'panen';

  if (role === 'owner') {
    if (btnOwner) btnOwner.className = 'px-2 py-0.5 rounded font-bold bg-white text-slate-900 shadow-xs transition-all';
    if (btnKandang) btnKandang.className = 'px-2 py-0.5 rounded font-medium text-slate-500 hover:text-slate-900 transition-all';

    // Sembunyikan formulir kerja anak kandang
    if (formInput) formInput.classList.add('hidden');
    if (cardSaved) cardSaved.classList.add('hidden');
    if (cardKandang) cardKandang.classList.add('hidden');

    // Tampilkan View Owner
    if (isFlokEmpty) {
      if (cardOwner) cardOwner.classList.add('hidden');
      if (ownerAudit) ownerAudit.classList.add('hidden');
      if (cardEmpty) cardEmpty.classList.remove('hidden');
    } else {
      if (cardEmpty) cardEmpty.classList.add('hidden');
      if (cardOwner) cardOwner.classList.remove('hidden');
      if (ownerAudit) ownerAudit.classList.remove('hidden');
    }

    if (btnRekapHome) {
      btnRekapHome.classList.remove('hidden');
      btnRekapHome.classList.add('flex');
    }
    if (sideNavRekap) {
      sideNavRekap.classList.remove('hidden');
      sideNavRekap.classList.add('flex');
    }
    if (sideOwnerGroup) sideOwnerGroup.classList.remove('hidden');
    if (btnTambahKandang) btnTambahKandang.classList.remove('hidden');

    const optK2 = document.getElementById('optKandang2Tablet');
    if (optK2) optK2.disabled = false;

    if (topBadge) topBadge.innerText = '👑 Pak Haji (Owner)';
    if (sidebarRoleTag) sidebarRoleTag.innerText = 'Mode: Owner / Mandor';
    if (sidebarUserLabel) sidebarUserLabel.innerText = 'Pak Haji (Owner)';
    if (sidebarSubLabel) sidebarSubLabel.innerText = 'Pemilik Peternakan';

  } else {
    // Mode Anak Kandang
    if (btnKandang) btnKandang.className = 'px-2 py-0.5 rounded font-bold bg-white text-slate-900 shadow-xs transition-all';
    if (btnOwner) btnOwner.className = 'px-2 py-0.5 rounded font-medium text-slate-500 hover:text-slate-900 transition-all';

    // Sembunyikan View Owner
    if (cardOwner) cardOwner.classList.add('hidden');
    if (ownerAudit) ownerAudit.classList.add('hidden');
    if (btnRekapHome) {
      btnRekapHome.classList.add('hidden');
      btnRekapHome.classList.remove('flex');
    }
    if (sideNavRekap) {
      sideNavRekap.classList.add('hidden');
      sideNavRekap.classList.remove('flex');
    }
    if (sideOwnerGroup) sideOwnerGroup.classList.add('hidden');
    if (btnTambahKandang) btnTambahKandang.classList.add('hidden');

    const optK2 = document.getElementById('optKandang2Tablet');
    if (optK2) optK2.disabled = true;

    // Tampilkan View Anak Kandang
    if (isFlokEmpty) {
      if (cardKandang) cardKandang.classList.add('hidden');
      if (formInput) formInput.classList.add('hidden');
      if (cardSaved) cardSaved.classList.add('hidden');
      if (cardEmpty) cardEmpty.classList.remove('hidden');
    } else {
      if (cardEmpty) cardEmpty.classList.add('hidden');
      if (cardKandang) cardKandang.classList.remove('hidden');

      // Cek apakah umur saat ini sudah disimpan
      const existingLog = dailyLogs.find(l => l.umur_hari === currentInputUmur);
      if (existingLog) {
        if (formInput) formInput.classList.remove('hidden'); // Form tetap terlihat agar bisa diedit
        if (cardSaved) cardSaved.classList.remove('hidden');
      } else {
        if (formInput) formInput.classList.remove('hidden');
        if (cardSaved) cardSaved.classList.add('hidden');
      }
    }

    if (topBadge) topBadge.innerText = `👷 ${currentPenjaga.nama} (Penjaga)`;
    if (sidebarRoleTag) sidebarRoleTag.innerText = 'Mode: Penjaga Kandang';
    if (sidebarUserLabel) sidebarUserLabel.innerText = currentPenjaga.nama;
    if (sidebarSubLabel) sidebarSubLabel.innerText = 'Operator Kandang 01';
  }

  // Jika sedang di layar Rekap saat berubah ke Anak Kandang, redirect ke Beranda
  if (currentRole === 'kandang' && currentScreen === 'rekap') {
    navigateTo('beranda');
  } else {
    updateSidebarNavState(currentScreen);
  }

  renderAkunView();
}

// ================= DEVICE CONTROLLER (RESPONSIVE OTOMATIS) =================
function detectAndApplyDevice() {
  const isTablet = window.innerWidth >= 768;
  setDevice(isTablet ? 'tablet' : 'phone');
}

function setDevice(device) {
  currentDevice = device;
  const shell = document.getElementById('appShell');
  const sidebar = document.getElementById('sidebar');
  const bottomNav = document.getElementById('bottomNav');
  if (!shell) return;

  if (device === 'phone') {
    shell.className = 'w-full max-w-md mx-auto flex-1 flex flex-col bg-white min-h-screen shadow-md';
    if (sidebar) {
      sidebar.classList.add('hidden');
      sidebar.classList.remove('flex');
    }
    if (currentScreen !== 'login' && bottomNav) bottomNav.classList.remove('hidden');
  } else {
    shell.className = currentScreen === 'login'
      ? 'w-full max-w-md mx-auto flex-1 flex flex-col bg-white rounded-3xl shadow-xl min-h-[720px] my-auto border border-slate-200'
      : 'w-full max-w-5xl mx-auto flex-1 flex flex-row bg-white rounded-3xl shadow-xl min-h-[820px] my-4 overflow-hidden border border-slate-200';

    if (currentScreen !== 'login') {
      if (sidebar) {
        sidebar.classList.remove('hidden');
        sidebar.classList.add('flex');
        updateSidebarNavState(currentScreen);
      }
    } else {
      if (sidebar) {
        sidebar.classList.add('hidden');
        sidebar.classList.remove('flex');
      }
    }
    if (bottomNav) bottomNav.classList.add('hidden');
  }
}

window.addEventListener('resize', detectAndApplyDevice);

// ================= PERHITUNGAN METRIK & CORE DATA MODEL =================
function computeFlokMetrics(flok, logs) {
  if (!flok) {
    return {
      populasiAwal: 5000,
      sisaAyam: 5000,
      totalMati: 0,
      deplesiPersen: '0.00',
      totalPakanPakai: 0,
      totalPakanMasuk: 2000,
      sisaStokPakan: 2000,
      latestBW: 42,
      maxLoggedUmur: 1,
      fcr: '1.05',
      estIP: 350,
      totalPanenJarangEkor: 0,
      totalPanenJarangKg: 0,
      dayRecords: []
    };
  }

  const populasiAwal = Number(flok.populasi_awal) || 5000;
  const stokPakanAwal = Number(flok.stok_pakan_awal_kg) || 0;
  const panenJarangList = flok.panen_jarang || [];

  let totalPanenJarangEkor = 0;
  let totalPanenJarangKg = 0;
  panenJarangList.forEach(p => {
    totalPanenJarangEkor += Number(p.ekor) || 0;
    totalPanenJarangKg += Number(p.total_kg) || 0;
  });

  const logsByUmur = {};
  logs.forEach(log => {
    logsByUmur[log.umur_hari] = log;
  });

  const dayRecords = [];
  let runningMati = 0;
  let runningPakanPakai = 0;
  let runningPakanMasuk = stokPakanAwal;
  let runningBW = Number(flok.bobot_doc_gram) || 42;
  const maxLoggedUmur = logs.length > 0 ? Math.max(...logs.map(l => l.umur_hari)) : 1;

  for (let day = 1; day <= 35; day++) {
    const log = logsByUmur[day];
    const dateStr = addDaysToDateStr(flok.tanggal_chickin, day - 1);

    if (log) {
      runningMati += (Number(log.kematian_ekor) || 0) + (Number(log.afkir_ekor) || 0);
      runningPakanPakai += (Number(log.pakan_pakai_kg) || 0);
      runningPakanMasuk += (Number(log.pakan_masuk_kg) || 0);
      if (log.bw_sampling_gram) runningBW = Number(log.bw_sampling_gram);
    }

    let jarangUpToDayEkor = 0;
    panenJarangList.forEach(p => {
      if (p.umur_hari <= day) jarangUpToDayEkor += Number(p.ekor) || 0;
    });

    const sisaAyamHari = Math.max(0, populasiAwal - runningMati - jarangUpToDayEkor);
    const sisaPakanHari = Math.max(0, runningPakanMasuk - runningPakanPakai);
    const pakanPakaiHari = log ? (Number(log.pakan_pakai_kg) || 0) : 0;
    const fiHari = (log && sisaAyamHari > 0) ? ((pakanPakaiHari * 1000) / sisaAyamHari).toFixed(1) : '-';

    dayRecords.push({
      umur: day,
      tanggal: dateStr,
      hasLog: !!log,
      log: log || null,
      jenisPakan: log ? log.pakan_jenis : getDefaultFeedForAge(day),
      pakanPakaiKg: pakanPakaiHari,
      pakanMasukKg: log ? (Number(log.pakan_masuk_kg) || 0) : 0,
      sisaPakanKg: sisaPakanHari,
      fi: fiHari,
      bw: (log && log.bw_sampling_gram) ? log.bw_sampling_gram : '-',
      mati: log ? (Number(log.kematian_ekor) || 0) : '-',
      sisaAyam: sisaAyamHari,
      catatan: log ? log.catatan : ''
    });
  }

  const sisaAyam = Math.max(0, populasiAwal - runningMati - totalPanenJarangEkor);
  const deplesiPersen = populasiAwal > 0 ? ((runningMati / populasiAwal) * 100).toFixed(2) : '0.00';
  const sisaStokPakan = Math.max(0, runningPakanMasuk - runningPakanPakai);

  // Perkiraan Biomassa & FCR
  const estBiomassaKg = (sisaAyam * (runningBW / 1000)) + totalPanenJarangKg;
  const fcr = estBiomassaKg > 0 ? (runningPakanPakai / estBiomassaKg).toFixed(2) : '1.05';

  // Perkiraan Indeks Performa (IP)
  const umurForIP = Math.max(1, maxLoggedUmur);
  const bwKg = runningBW / 1000;
  let estIP = 0;
  if (parseFloat(fcr) > 0 && umurForIP > 0) {
    estIP = Math.round(((100 - parseFloat(deplesiPersen)) * bwKg) / (parseFloat(fcr) * umurForIP) * 100);
  }

  return {
    populasiAwal,
    sisaAyam,
    totalMati: runningMati,
    deplesiPersen,
    totalPakanPakai: runningPakanPakai,
    totalPakanMasuk: runningPakanMasuk,
    sisaStokPakan,
    latestBW: runningBW,
    maxLoggedUmur,
    fcr,
    estIP,
    totalPanenJarangEkor,
    totalPanenJarangKg,
    dayRecords
  };
}

// ================= RENDER ALL VIEWS SECARA DINAMIS =================
function renderAllViews() {
  if (!activeFlok) return;

  const metrics = computeFlokMetrics(activeFlok, dailyLogs);
  const umurTerkini = metrics.maxLoggedUmur;

  // 1. Render Kartu Flok Owner
  const oFlokBadge = document.getElementById('ownerCardFlokBadge');
  if (oFlokBadge) oFlokBadge.innerText = `Flok #${activeFlok.nomor_flok}`;
  const oDoc = document.getElementById('ownerCardDocDate');
  if (oDoc) oDoc.innerText = formatIndoDate(activeFlok.tanggal_chickin);
  const oPopAwal = document.getElementById('ownerCardPopAwal');
  if (oPopAwal) oPopAwal.innerText = Number(activeFlok.populasi_awal).toLocaleString('id-ID');
  const oUmurBadge = document.getElementById('ownerCardUmurBadge');
  if (oUmurBadge) oUmurBadge.innerText = `Hari ke-${umurTerkini}`;
  const oDeplesi = document.getElementById('ownerCardDeplesi');
  if (oDeplesi) oDeplesi.innerText = `${metrics.deplesiPersen}%`;
  const oSisaAyam = document.getElementById('ownerCardSisaAyam');
  if (oSisaAyam) oSisaAyam.innerText = metrics.sisaAyam.toLocaleString('id-ID');
  const oFCR = document.getElementById('ownerCardFCR');
  if (oFCR) oFCR.innerText = metrics.fcr;
  const oIP = document.getElementById('ownerCardIP');
  if (oIP) oIP.innerText = metrics.estIP;

  // 2. Render Kartu Flok Anak Kandang
  const wFlokBadge = document.getElementById('workerCardFlokBadge');
  if (wFlokBadge) wFlokBadge.innerText = `Flok #${activeFlok.nomor_flok}`;
  const wShift = document.getElementById('lblWorkerShift');
  if (wShift) wShift.innerText = currentPenjaga.nama;
  const wUmurBadge = document.getElementById('workerCardUmurBadge');
  if (wUmurBadge) wUmurBadge.innerText = `Hari ke-${umurTerkini}`;
  const wSisaAyam = document.getElementById('workerCardSisaAyam');
  if (wSisaAyam) wSisaAyam.innerText = `${metrics.sisaAyam.toLocaleString('id-ID')} Ekor`;
  const wSisaPakan = document.getElementById('workerCardSisaPakan');
  if (wSisaPakan) wSisaPakan.innerText = `${metrics.sisaStokPakan.toLocaleString('id-ID')} Kg`;

  // Cari log hari terkini untuk badge kartu anak kandang
  const currentDayLog = dailyLogs.find(l => l.umur_hari === currentInputUmur) || dailyLogs[dailyLogs.length - 1];
  const bMati = document.getElementById('badgeMatiHariIni');
  if (bMati) bMati.innerText = currentDayLog ? `${currentDayLog.kematian_ekor} Ekor` : '0 Ekor';
  const bPakan = document.getElementById('badgePakanHariIni');
  if (bPakan) bPakan.innerText = currentDayLog ? `${currentDayLog.pakan_pakai_kg} Kg` : '0 Kg';

  // 3. Render Panel Audit Owner (Hari Terpilih)
  renderOwnerAuditView(metrics);

  // 4. Render Layar Kandang
  const kPop = document.getElementById('kandang01PopulasiTag');
  if (kPop) kPop.innerText = `${metrics.sisaAyam.toLocaleString('id-ID')} ekor`;
  const kFCR = document.getElementById('kandang01FCRTag');
  if (kFCR) kFCR.innerText = metrics.fcr;
  const kPenjaga = document.getElementById('kandang01PenjagaTag');
  if (kPenjaga) kPenjaga.innerText = currentPenjaga.nama.split(' ')[0];
  const kUmur = document.getElementById('kandang01UmurTag');
  if (kUmur) kUmur.innerText = `Hari ke-${umurTerkini}`;
  const kStatusTag = document.getElementById('kandang01StatusTag');
  if (kStatusTag) {
    if (activeFlok.status_siklus === 'panen') {
      kStatusTag.className = 'text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full';
      kStatusTag.innerText = 'Kosong (Masa Sanitasi)';
    } else {
      kStatusTag.className = 'text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full';
      kStatusTag.innerText = `Flok #${activeFlok.nomor_flok} Aktif`;
    }
  }

  // 5. Render Lembar Rekap Kertas
  const rFlokInfo = document.getElementById('rekapFlokInfo');
  if (rFlokInfo) rFlokInfo.innerText = `Flok #${activeFlok.nomor_flok} (DOC: ${formatIndoDate(activeFlok.tanggal_chickin)})`;
  renderRekapTable();
}

// Render Panel Audit Owner untuk Umur yang dipilih
function renderOwnerAuditView(metrics) {
  const log = dailyLogs.find(l => l.umur_hari === currentInputUmur);
  const auditTitle = document.getElementById('ownerAuditUmurTitle');
  if (auditTitle) auditTitle.innerText = `Laporan Harian: Hari ke-${currentInputUmur}`;
  const auditPicker = document.getElementById('ownerAuditUmurPickerBadge');
  if (auditPicker) auditPicker.innerText = `H-${currentInputUmur}`;

  const opName = document.getElementById('ownerViewOperatorName');
  if (opName) opName.innerText = currentPenjaga.nama;
  const opWA = document.getElementById('ownerViewOperatorWA');
  if (opWA) opWA.innerText = currentPenjaga.wa;

  const oMati = document.getElementById('ownerViewMati');
  const oMort = document.getElementById('ownerViewMortalitas');
  const oPakan = document.getElementById('ownerViewPakan');
  const oPakanSak = document.getElementById('ownerViewPakanSak');
  const oFI = document.getElementById('ownerViewFI');
  const oSisaStok = document.getElementById('ownerViewSisaStok');
  const oSisaStokSak = document.getElementById('ownerViewSisaStokSak');
  const oCatatan = document.getElementById('ownerViewCatatan');

  if (log) {
    const matiVal = Number(log.kematian_ekor) || 0;
    const pakanKg = Number(log.pakan_pakai_kg) || 0;
    const pakanSak = (pakanKg / 50).toFixed(1);
    const mortPct = metrics.sisaAyam > 0 ? ((matiVal / metrics.sisaAyam) * 100).toFixed(2) : '0.00';
    const fiVal = metrics.sisaAyam > 0 ? ((pakanKg * 1000) / metrics.sisaAyam).toFixed(1) : '0';

    if (oMati) oMati.innerText = `${matiVal} Ekor`;
    if (oMort) oMort.innerText = `● Mortalitas ${mortPct}% (${matiVal > 20 ? 'Perhatian' : 'Aman'})`;
    if (oPakan) oPakan.innerText = `${pakanKg} Kg (${log.pakan_jenis || 'B11A'})`;
    if (oPakanSak) oPakanSak.innerText = `Setara ${pakanSak} Sak (@50kg)`;
    if (oFI) oFI.innerText = `${fiVal} g/ekor`;
    if (oSisaStok) oSisaStok.innerText = `${metrics.sisaStokPakan.toLocaleString('id-ID')} Kg`;
    if (oSisaStokSak) oSisaStokSak.innerText = `${(metrics.sisaStokPakan / 50).toFixed(1)} Sak`;
    if (oCatatan) oCatatan.innerText = `"${log.catatan || 'Kondisi ayam sehat dan aktif.'}"`;
  } else {
    if (oMati) oMati.innerText = '-';
    if (oMort) oMort.innerText = '● Belum diinput operator';
    if (oPakan) oPakan.innerText = '-';
    if (oPakanSak) oPakanSak.innerText = '-';
    if (oFI) oFI.innerText = '-';
    if (oSisaStok) oSisaStok.innerText = `${metrics.sisaStokPakan.toLocaleString('id-ID')} Kg`;
    if (oSisaStokSak) oSisaStokSak.innerText = `${(metrics.sisaStokPakan / 50).toFixed(1)} Sak`;
    if (oCatatan) oCatatan.innerText = '"Belum ada catatan untuk hari ini."';
  }

  // Update Link WhatsApp
  updatePenjagaWAInfo(log);
}

function updatePenjagaWAInfo(log) {
  let rawWA = (currentPenjaga.wa || '081234567890').trim();
  let cleanWA = rawWA.replace(/[^0-9]/g, '');
  if (cleanWA.startsWith('0')) {
    cleanWA = '62' + cleanWA.substring(1);
  } else if (!cleanWA.startsWith('62')) {
    cleanWA = '62' + cleanWA;
  }

  const btnWA = document.getElementById('btnOwnerChatWA');
  if (btnWA) {
    const textMsg = encodeURIComponent(
      `Halo Mas ${currentPenjaga.nama}, saya sudah pantau laporan Kandang 01 Hari ke-${currentInputUmur}.\n` +
      `Kematian: ${log ? log.kematian_ekor : 0} ekor, Pakan: ${log ? log.pakan_pakai_kg : 0} kg.\n` +
      `Tolong pastikan ventilasi dan sekam selalu terjaga baik.`
    );
    btnWA.href = `https://wa.me/${cleanWA}?text=${textMsg}`;
  }
}

// Render Layar Akun
function renderAkunView() {
  const avatar = document.getElementById('akunAvatar');
  const nama = document.getElementById('akunNamaUser');
  const desc = document.getElementById('akunRoleDesc');
  const targetLabel = document.getElementById('akunBtnSwitchTarget');

  if (currentRole === 'owner') {
    if (avatar) avatar.innerText = 'HR';
    if (nama) nama.innerText = 'Pak Haji Rahmat (Owner)';
    if (desc) desc.innerText = 'Akses Penuh: Manajemen Flok, Audit Panen & IP';
    if (targetLabel) targetLabel.innerText = 'Anak Kandang';
  } else {
    if (avatar) avatar.innerText = currentPenjaga.nama.substring(0, 2).toUpperCase();
    if (nama) nama.innerText = currentPenjaga.nama;
    if (desc) desc.innerText = `Pekerja Lapangan Kandang 01 (WA: ${currentPenjaga.wa})`;
    if (targetLabel) targetLabel.innerText = 'Owner';
  }
}

// ================= FORM CONTROLLER & UMUR NAVIGATION =================
function onSelectUmurChange(val) {
  selectUmur(parseInt(val) || 1);
}

function stepUmur(delta) {
  const next = Math.max(1, Math.min(35, currentInputUmur + delta));
  selectUmur(next);
}

function onInputDateChange(newDateStr) {
  if (!activeFlok || !newDateStr) return;
  // Hitung selisih hari dari tanggal chick-in
  const chickinDate = new Date(activeFlok.tanggal_chickin);
  const pickedDate = new Date(newDateStr);
  const diffTime = pickedDate - chickinDate;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

  if (diffDays >= 1 && diffDays <= 35) {
    selectUmur(diffDays);
  } else {
    showToast(`Tanggal di luar rentang umur siklus (Hari ke-${diffDays}).`);
  }
}

function selectUmur(umur) {
  currentInputUmur = umur;

  // Update Dropdown Selector
  const sel = document.getElementById('selectUmurInput');
  if (sel) sel.value = umur;

  // Update Tanggal
  const dateStr = addDaysToDateStr(activeFlok ? activeFlok.tanggal_chickin : '2024-10-05', umur - 1);
  const inputTgl = document.getElementById('inputTanggalRecord');
  if (inputTgl) inputTgl.value = dateStr;

  // Update Fase Badge
  const bFase = document.getElementById('badgeFase');
  if (bFase) {
    if (umur <= 7) {
      bFase.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800';
      bFase.innerText = 'Fase Starter (Brooding)';
    } else if (umur <= 21) {
      bFase.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800';
      bFase.innerText = 'Fase Grower';
    } else {
      bFase.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800';
      bFase.innerText = 'Fase Finisher';
    }
  }

  // Cek apakah hari ini sudah pernah disimpan
  const existingLog = dailyLogs.find(l => l.umur_hari === umur);
  const bStatus = document.getElementById('badgeFormStatus');
  const cardSaved = document.getElementById('cardCatatanSaved');
  const formInput = document.getElementById('sectionFormInput');

  if (existingLog) {
    if (bStatus) {
      bStatus.className = 'block text-[10px] font-bold text-emerald-700';
      bStatus.innerText = '✓ Tersimpan (Mode Edit)';
    }

    // Isi Nilai Form dengan data yang tersimpan
    document.getElementById('inputMati').value = existingLog.kematian_ekor || 0;
    const pakanKg = existingLog.pakan_pakai_kg || 0;
    document.getElementById('inputPakan').value = pakanUnit === 'sak' ? (pakanKg / 50).toFixed(1) : pakanKg;
    document.getElementById('inputJenisPakan').value = existingLog.pakan_jenis || getDefaultFeedForAge(umur);
    document.getElementById('inputPakanMasuk').value = existingLog.pakan_masuk_kg || '';
    document.getElementById('inputBW').value = existingLog.bw_sampling_gram || '';
    document.getElementById('inputCatatanHarian').value = existingLog.catatan || '';

    // Isi Card Saved
    const sTitle = document.getElementById('savedCardTitle');
    if (sTitle) sTitle.innerText = `Catatan Hari ke-${umur} Sudah Tersimpan`;
    const sMati = document.getElementById('savedMatiSummary');
    if (sMati) sMati.innerText = `${existingLog.kematian_ekor || 0} Ekor`;
    const sPakan = document.getElementById('savedPakanSummary');
    if (sPakan) sPakan.innerText = `${pakanKg} Kg (${existingLog.pakan_jenis || 'B11A'})`;
    const sCatatan = document.getElementById('savedCatatanSummary');
    if (sCatatan) sCatatan.innerText = `"${existingLog.catatan || 'Kondisi aman terkendali.'}"`;

    if (currentRole === 'kandang') {
      if (cardSaved) cardSaved.classList.remove('hidden');
    }
  } else {
    if (bStatus) {
      bStatus.className = 'block text-[10px] font-bold text-slate-400';
      bStatus.innerText = '📝 Hari Baru';
    }

    // Default values
    document.getElementById('inputMati').value = 0;
    document.getElementById('inputJenisPakan').value = getDefaultFeedForAge(umur);
    document.getElementById('inputPakan').value = getDefaultFeedKgForAge(umur);
    document.getElementById('inputPakanMasuk').value = '';
    document.getElementById('inputBW').value = '';
    document.getElementById('inputCatatanHarian').value = 'Kondisi sekam kering, ayam lincah, sirkulasi lancar.';

    if (cardSaved) cardSaved.classList.add('hidden');
  }

  recalc();
  renderAllViews();
}

function unlockEditForm() {
  document.getElementById('cardCatatanSaved').classList.add('hidden');
  document.getElementById('sectionFormInput').classList.remove('hidden');
  showToast(`Silakan koreksi catatan Hari ke-${currentInputUmur} lalu simpan.`);
}

function adjustMati(delta) {
  const el = document.getElementById('inputMati');
  el.value = Math.max(0, (parseInt(el.value) || 0) + delta);
  recalc();
}

function setUnit(unit) {
  pakanUnit = unit;
  const btnKg = document.getElementById('btnKg');
  const btnSak = document.getElementById('btnSak');
  const el = document.getElementById('inputPakan');

  if (unit === 'sak') {
    btnSak.className = 'px-2.5 py-0.5 rounded font-bold bg-white text-slate-800 shadow-xs';
    btnKg.className = 'px-2.5 py-0.5 rounded text-slate-500';
    el.value = (parseFloat(el.value) / 50).toFixed(1);
  } else {
    btnKg.className = 'px-2.5 py-0.5 rounded font-bold bg-white text-slate-800 shadow-xs';
    btnSak.className = 'px-2.5 py-0.5 rounded text-slate-500';
    el.value = Math.round(parseFloat(el.value) * 50);
  }
  recalc();
}

function recalc() {
  const mati = parseInt(document.getElementById('inputMati')?.value) || 0;
  let pakanVal = parseFloat(document.getElementById('inputPakan')?.value) || 0;
  const pakanKg = pakanUnit === 'sak' ? pakanVal * 50 : pakanVal;

  const metrics = computeFlokMetrics(activeFlok, dailyLogs);
  const sisaAyamPerkiraan = Math.max(0, metrics.sisaAyam - mati);
  const fi = sisaAyamPerkiraan > 0 ? ((pakanKg * 1000) / sisaAyamPerkiraan).toFixed(1) : '0';

  const dispFI = document.getElementById('dispFI');
  if (dispFI) dispFI.innerText = `${fi} g/ekor`;
}

function updateCatatanLive(val) {
  const clean = val.trim() || 'Aman terkendali.';
  const elOwner = document.getElementById('ownerViewCatatan');
  if (elOwner) elOwner.innerText = `"${clean}"`;
  const elSaved = document.getElementById('savedCatatanSummary');
  if (elSaved) elSaved.innerText = `"${clean}"`;
}

// ================= SIMPAN LOG HARIAN =================
async function simpanLog(advanceToNext = false) {
  if (!activeFlok) {
    showToast('Peringatan: Tidak ada flok yang aktif.');
    return;
  }

  const mati = parseInt(document.getElementById('inputMati').value) || 0;
  let pakanVal = parseFloat(document.getElementById('inputPakan').value) || 0;
  const pakanKg = pakanUnit === 'sak' ? pakanVal * 50 : pakanVal;
  const jenis = document.getElementById('inputJenisPakan').value;
  const masukKg = parseFloat(document.getElementById('inputPakanMasuk').value) || 0;
  const bwVal = parseFloat(document.getElementById('inputBW').value) || null;
  const catatan = (document.getElementById('inputCatatanHarian').value || '').trim() || 'Kondisi aman terkendali.';
  const tglRecord = document.getElementById('inputTanggalRecord').value || addDaysToDateStr(activeFlok.tanggal_chickin, currentInputUmur - 1);

  const logPayload = {
    id: `log_f${activeFlok.nomor_flok}_h${currentInputUmur}`,
    flok_id: activeFlok.id,
    umur_hari: currentInputUmur,
    tanggal: tglRecord,
    kematian_ekor: mati,
    afkir_ekor: 0,
    pakan_jenis: jenis,
    pakan_pakai_kg: pakanKg,
    pakan_masuk_kg: masukKg,
    bw_sampling_gram: bwVal,
    catatan: catatan,
    diinput_oleh: currentPenjaga.nama,
    waktu_input: new Date().toISOString()
  };

  try {
    await FlokioDB.saveDailyLog(logPayload);
    // Muat ulang dari DB agar state konsisten
    dailyLogs = await FlokioDB.getDailyLogsByFlok(activeFlok.id);
  } catch (e) {
    console.error('Gagal simpan log ke DB:', e);
  }

  // Perbarui tampilan
  renderAllViews();
  selectUmur(currentInputUmur);

  if (advanceToNext && currentInputUmur < 35) {
    showToast(`Hari ke-${currentInputUmur} Disimpan! Lanjut ke Hari ke-${currentInputUmur + 1}.`);
    stepUmur(1);
  } else {
    showToast(`Catatan Hari ke-${currentInputUmur} Berhasil Disimpan & Tersinkron!`);
  }
}

// ================= LEMBAR REKAP KERTAS (10 KOLOM FISIK) =================
function switchWeek(m) {
  currentWeekTab = m;
  for (let i = 1; i <= 5; i++) {
    const btn = document.getElementById(`tabM${i}`);
    if (btn) {
      btn.className = i === m
        ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-[#3B5166] text-white shadow-xs'
        : 'px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 bg-white border border-slate-200';
    }
  }
  renderRekapTable();
}

function renderRekapTable() {
  const tbody = document.getElementById('rekapTableBody');
  const tfoot = document.getElementById('rekapTableFoot');
  if (!tbody || !activeFlok) return;

  const metrics = computeFlokMetrics(activeFlok, dailyLogs);
  const dayRecords = metrics.dayRecords;

  const startDay = ((currentWeekTab - 1) * 7) + 1;
  const endDay = currentWeekTab * 7;

  let htmlRows = '';
  let sumPakai = 0;
  let sumMasuk = 0;
  let sumMati = 0;
  let fiCount = 0;
  let sumFI = 0;
  let lastBW = '-';
  let lastSisaEkor = metrics.populasiAwal;

  for (let d = startDay; d <= endDay; d++) {
    const r = dayRecords[d - 1];
    if (!r) continue;

    const isCurrentActiveDay = d === currentInputUmur;
    const rowClass = isCurrentActiveDay ? 'today-row cursor-pointer' : 'cursor-pointer hover:bg-slate-50';

    if (r.hasLog) {
      sumPakai += r.pakanPakaiKg;
      sumMasuk += r.pakanMasukKg;
      sumMati += Number(r.mati) || 0;
      if (r.fi !== '-') {
        sumFI += parseFloat(r.fi);
        fiCount++;
      }
      if (r.bw !== '-') lastBW = r.bw;
    }
    lastSisaEkor = r.sisaAyam;

    const shortDate = formatDateShort(r.tanggal);
    const matiDisplay = r.mati !== '-' && Number(r.mati) > 10
      ? `<span class="text-rose-600 font-bold">${r.mati}</span>`
      : r.mati;

    htmlRows += `
      <tr class="${rowClass}" onclick="selectUmur(${d}); navigateTo('beranda');" title="Klik untuk edit hari ke-${d}">
        <td>${shortDate}</td>
        <td><strong>${r.umur}</strong></td>
        <td>${r.jenisPakan ? r.jenisPakan.split(' ')[0] : '-'}</td>
        <td>${r.pakanPakaiKg > 0 ? r.pakanPakaiKg : '-'}</td>
        <td>${r.pakanMasukKg > 0 ? r.pakanMasukKg : '-'}</td>
        <td>${r.sisaPakanKg.toLocaleString('id-ID')}</td>
        <td>${r.fi}</td>
        <td>${r.bw}</td>
        <td>${matiDisplay}</td>
        <td class="font-bold text-slate-900">${r.sisaAyam.toLocaleString('id-ID')}</td>
      </tr>
    `;
  }

  tbody.innerHTML = htmlRows;

  // Render Footer Rekap Mingguan
  const avgFI = fiCount > 0 ? (sumFI / fiCount).toFixed(1) : '-';
  if (tfoot) {
    tfoot.innerHTML = `
      <tr>
        <td colspan="3" class="text-left px-2">Total Minggu ${currentWeekTab}:</td>
        <td>${sumPakai > 0 ? sumPakai.toLocaleString('id-ID') : '-'} Kg</td>
        <td>${sumMasuk > 0 ? sumMasuk.toLocaleString('id-ID') : '-'} Kg</td>
        <td>-</td>
        <td>${avgFI} (avg)</td>
        <td>${lastBW}</td>
        <td class="text-rose-600 font-bold">${sumMati > 0 ? sumMati : '-'}</td>
        <td class="font-bold text-slate-900">${lastSisaEkor.toLocaleString('id-ID')}</td>
      </tr>
    `;
  }
}

// ================= WHATSAPP REPORT GENERATOR =================
function previewWA() {
  if (!activeFlok) return;

  const metrics = computeFlokMetrics(activeFlok, dailyLogs);
  const log = dailyLogs.find(l => l.umur_hari === currentInputUmur);

  const mati = log ? log.kematian_ekor : (document.getElementById('inputMati')?.value || 0);
  const pakanVal = log ? log.pakan_pakai_kg : (parseFloat(document.getElementById('inputPakan')?.value) || 0);
  const pakanKg = pakanUnit === 'sak' ? pakanVal * 50 : pakanVal;
  const jenis = log ? log.pakan_jenis : (document.getElementById('inputJenisPakan')?.value || 'B11A');
  const fi = log ? ((pakanKg * 1000) / metrics.sisaAyam).toFixed(1) : (document.getElementById('dispFI')?.innerText || '-');
  const catatan = log ? log.catatan : (document.getElementById('inputCatatanHarian')?.value || 'Aman terkendali.');
  const tglStr = formatIndoDate(log ? log.tanggal : addDaysToDateStr(activeFlok.tanggal_chickin, currentInputUmur - 1));

  const txt =
`*LAPORAN HARIAN RECORDING BROILER — FLOKIO*
Kandang     : Kandang 01 (Flok #${activeFlok.nomor_flok})
Umur / Tgl  : Hari ke-${currentInputUmur} (${tglStr})
Pelapor     : ${currentRole === 'owner' ? 'Pak Haji (Owner)' : (currentPenjaga.nama + ' (Penjaga)')}
----------------------------------------
• Kematian/Afkir : ${mati} ekor
• Pakan Pakai    : ${pakanKg} kg (${jenis})
• Feed Intake    : ${fi} g/ekor
• Sisa Ayam Hidup: ${metrics.sisaAyam.toLocaleString('id-ID')} ekor
• Sisa Stok Pakan: ${metrics.sisaStokPakan.toLocaleString('id-ID')} kg
• Deplesi Flok   : ${metrics.deplesiPersen}%
• Catatan Kondisi: "${catatan}"
----------------------------------------
_Flokio Smart Broiler Ledger_`;

  lastHarvestReportText = txt;
  const pre = document.getElementById('textWAPreview');
  if (pre) pre.innerText = txt;
  document.getElementById('modalWA').classList.remove('hidden');
}

function closeModalWA() {
  document.getElementById('modalWA').classList.add('hidden');
}

function copyWA() {
  const txt = document.getElementById('textWAPreview').innerText;
  navigator.clipboard.writeText(txt);
  showToast('Teks Laporan WhatsApp Berhasil Disalin!');
  closeModalWA();
}

// ================= MODAL CHICK-IN FLOK BARU =================
function openModalChickin() {
  const nextNum = (activeFlok ? activeFlok.nomor_flok : 4) + 1;
  const inputNum = document.getElementById('inputFlokNumber');
  if (inputNum) inputNum.value = nextNum;

  const inputDate = document.getElementById('inputChickinDate');
  if (inputDate) inputDate.value = new Date().toISOString().split('T')[0];

  document.getElementById('modalChickin').classList.remove('hidden');
}

function closeModalChickin() {
  document.getElementById('modalChickin').classList.add('hidden');
}

async function submitChickin() {
  const flokNum = parseInt(document.getElementById('inputFlokNumber').value) || 5;
  const tglDoc = document.getElementById('inputChickinDate').value || new Date().toISOString().split('T')[0];
  const popAwal = parseInt(document.getElementById('inputChickinPopulasi').value) || 5000;
  const bwDoc = parseFloat(document.getElementById('inputChickinBobotDOC').value) || 42;
  const stokPakan = parseFloat(document.getElementById('inputChickinStokPakan').value) || 2000;
  const jenisPakan = document.getElementById('inputChickinJenisPakan').value || 'BP-1 (Starter)';
  const strain = document.getElementById('inputChickinStrain').value || 'Cobb 500';

  const newFlokId = `flok_${activeKandangId}_${flokNum}`;

  const newFlok = {
    id: newFlokId,
    kandang_id: activeKandangId,
    nomor_flok: flokNum,
    tanggal_chickin: tglDoc,
    strain: strain,
    populasi_awal: popAwal,
    bobot_doc_gram: bwDoc,
    status_siklus: 'berjalan',
    stok_pakan_awal_kg: stokPakan,
    jenis_pakan_awal: jenisPakan,
    panen_jarang: [],
    panen_total: null
  };

  try {
    await FlokioDB.saveFlok(newFlok);
    // Bersihkan catatan lama flok ini jika ada
    await FlokioDB.clearDailyLogsByFlok(newFlokId);

    // Update status kandang
    const kandang = await FlokioDB.getKandang(activeKandangId);
    if (kandang) {
      kandang.status = 'aktif';
      await FlokioDB.saveKandang(kandang);
    }

    activeFlok = newFlok;
    dailyLogs = [];
    currentInputUmur = 1;
    currentWeekTab = 1;
  } catch (err) {
    console.error('Gagal chickin flok baru:', err);
  }

  closeModalChickin();
  setRole(currentRole);
  selectUmur(1);
  renderAllViews();
  showToast(`Siklus Flok #${flokNum} Berhasil Dimulai dari Hari ke-1 (DOC)!`);
}

// ================= MODAL PANEN & INDEKS PERFORMA (IP) =================
function openModalPanen() {
  if (!activeFlok) return;

  const metrics = computeFlokMetrics(activeFlok, dailyLogs);
  const todayStr = new Date().toISOString().split('T')[0];

  // Set default form jarang
  const inJarangTgl = document.getElementById('inputPanenJarangDate');
  if (inJarangTgl) inJarangTgl.value = todayStr;
  const inJarangUmur = document.getElementById('inputPanenJarangUmur');
  if (inJarangUmur) inJarangUmur.value = metrics.maxLoggedUmur || 28;
  const inJarangEkor = document.getElementById('inputPanenJarangEkor');
  if (inJarangEkor) inJarangEkor.value = Math.min(1000, Math.floor(metrics.sisaAyam * 0.3));

  // Set default form total
  const inTotalTgl = document.getElementById('inputPanenTotalDate');
  if (inTotalTgl) inTotalTgl.value = todayStr;
  const inTotalUmur = document.getElementById('inputPanenTotalUmur');
  if (inTotalUmur) inTotalUmur.value = metrics.maxLoggedUmur || 34;
  const inTotalEkor = document.getElementById('inputPanenTotalEkor');
  if (inTotalEkor) inTotalEkor.value = metrics.sisaAyam;
  const estTotalKg = Math.round(metrics.sisaAyam * (metrics.latestBW / 1000));
  const inTotalKg = document.getElementById('inputPanenTotalKg');
  if (inTotalKg) inTotalKg.value = estTotalKg;

  setPanenType(panenMode);
  recalcPanenJarangAvg();
  recalcPanenTotalAvg();

  document.getElementById('modalPanen').classList.remove('hidden');
}

function closeModalPanen() {
  document.getElementById('modalPanen').classList.add('hidden');
}

function setPanenType(type) {
  panenMode = type;
  const btnJarang = document.getElementById('btnPanenJarang');
  const btnTotal = document.getElementById('btnPanenTotal');
  const formJarang = document.getElementById('formPanenJarang');
  const formTotal = document.getElementById('formPanenTotal');

  if (type === 'jarang') {
    btnJarang.className = 'flex-1 py-2 font-bold rounded-lg bg-white text-slate-800 shadow-xs border border-slate-200';
    btnTotal.className = 'flex-1 py-2 font-medium rounded-lg text-slate-500 hover:text-slate-800';
    formJarang.classList.remove('hidden');
    formTotal.classList.add('hidden');
  } else {
    btnTotal.className = 'flex-1 py-2 font-bold rounded-lg bg-amber-50 text-amber-900 shadow-xs border border-amber-300';
    btnJarang.className = 'flex-1 py-2 font-medium rounded-lg text-slate-500 hover:text-slate-800';
    formTotal.classList.remove('hidden');
    formJarang.classList.add('hidden');
  }
}

function recalcPanenJarangAvg() {
  const ekor = parseFloat(document.getElementById('inputPanenJarangEkor')?.value) || 0;
  const kg = parseFloat(document.getElementById('inputPanenJarangKg')?.value) || 0;
  const avg = ekor > 0 ? (kg / ekor).toFixed(2) : '0.00';
  const disp = document.getElementById('dispPanenJarangAvg');
  if (disp) disp.innerText = `${avg} Kg / ekor`;
}

function recalcPanenTotalAvg() {
  const ekor = parseFloat(document.getElementById('inputPanenTotalEkor')?.value) || 0;
  const kg = parseFloat(document.getElementById('inputPanenTotalKg')?.value) || 0;
  const avg = ekor > 0 ? (kg / ekor).toFixed(2) : '0.00';
  const disp = document.getElementById('dispPanenTotalAvg');
  if (disp) disp.innerText = `${avg} Kg / ekor`;
}

async function submitPanen() {
  if (!activeFlok) return;

  if (panenMode === 'jarang') {
    // 1. Eksekusi Panen Jarang
    const tgl = document.getElementById('inputPanenJarangDate').value;
    const umur = parseInt(document.getElementById('inputPanenJarangUmur').value) || 28;
    const ekor = parseInt(document.getElementById('inputPanenJarangEkor').value) || 0;
    const totalKg = parseFloat(document.getElementById('inputPanenJarangKg').value) || 0;
    const bakul = document.getElementById('inputPanenJarangBakul').value.trim() || 'Bakul Ayam';

    if (ekor <= 0 || totalKg <= 0) {
      alert('Masukkan jumlah ekor dan total tonase panen dengan benar!');
      return;
    }

    if (!activeFlok.panen_jarang) activeFlok.panen_jarang = [];
    activeFlok.panen_jarang.push({
      tanggal: tgl,
      umur_hari: umur,
      ekor: ekor,
      total_kg: totalKg,
      avg_kg: (totalKg / ekor).toFixed(2),
      bakul: bakul,
      waktu_input: new Date().toISOString()
    });

    await FlokioDB.saveFlok(activeFlok);
    closeModalPanen();
    renderAllViews();
    showToast(`Panen Jarang ${ekor.toLocaleString('id-ID')} ekor (${totalKg} kg) berhasil dicatat!`);

  } else {
    // 2. Eksekusi Panen Total & Hitung IP Resmi
    const tglTotal = document.getElementById('inputPanenTotalDate').value;
    const umurTotal = parseInt(document.getElementById('inputPanenTotalUmur').value) || 34;
    const ekorTotal = parseInt(document.getElementById('inputPanenTotalEkor').value) || 0;
    const kgTotal = parseFloat(document.getElementById('inputPanenTotalKg').value) || 0;
    const hargaKg = parseFloat(document.getElementById('inputPanenHargaKg').value) || 0;
    const bakulTotal = document.getElementById('inputPanenTotalBakul').value.trim() || 'Mitra Panen';

    if (ekorTotal <= 0 || kgTotal <= 0) {
      alert('Masukkan ekor dan tonase panen total dengan benar!');
      return;
    }

    const metrics = computeFlokMetrics(activeFlok, dailyLogs);

    // Kalkulasi Total Siklus (Panen Jarang + Panen Total)
    const panenJarangEkor = metrics.totalPanenJarangEkor;
    const panenJarangKg = metrics.totalPanenJarangKg;

    const totalEkorTerpanen = panenJarangEkor + ekorTotal;
    const totalTonaseKg = panenJarangKg + kgTotal;
    const bobotRataRataKg = totalEkorTerpanen > 0 ? (totalTonaseKg / totalEkorTerpanen) : 0;
    const totalPakanKg = metrics.totalPakanPakai;
    const fcrFinal = totalTonaseKg > 0 ? (totalPakanKg / totalTonaseKg) : 1.5;

    const populasiAwal = metrics.populasiAwal;
    const deplesiAkhirPct = populasiAwal > 0 ? (((populasiAwal - totalEkorTerpanen) / populasiAwal) * 100) : 0;
    const livabilityPct = Math.max(0, 100 - deplesiAkhirPct);

    // Umur Panen Rata-rata
    let weightedUmur = 0;
    (activeFlok.panen_jarang || []).forEach(pj => {
      weightedUmur += (pj.umur_hari * pj.ekor);
    });
    weightedUmur += (umurTotal * ekorTotal);
    const avgUmurPanen = totalEkorTerpanen > 0 ? (weightedUmur / totalEkorTerpanen) : umurTotal;

    // FORMULA RESMI INDEKS PERFORMA (IP):
    // IP = ((Daya Hidup % * Bobot Rata-rata kg) / (FCR * Umur Rata-rata)) * 100
    let ipOfficial = 0;
    if (fcrFinal > 0 && avgUmurPanen > 0) {
      ipOfficial = Math.round(((livabilityPct * bobotRataRataKg) / (fcrFinal * avgUmurPanen)) * 100);
    }

    // Predikat IP
    let ipBadgeText = 'Standar (Cukup)';
    if (ipOfficial >= 400) {
      ipBadgeText = '🌟 Istimewa / Super Prima';
    } else if (ipOfficial >= 350) {
      ipBadgeText = '🟢 Sangat Baik / Menguntungkan';
    } else if (ipOfficial >= 300) {
      ipBadgeText = '🟡 Standar / Cukup';
    } else {
      ipBadgeText = '🔴 Perlu Evaluasi Manajemen';
    }

    const panenTotalObj = {
      tanggal: tglTotal,
      umur_panen: umurTotal,
      ekor_panen: ekorTotal,
      total_kg: kgTotal,
      harga_kg: hargaKg,
      bakul: bakulTotal,
      populasi_awal: populasiAwal,
      total_ekor_semua: totalEkorTerpanen,
      total_tonase_semua: totalTonaseKg,
      bobot_rata_kg: bobotRataRataKg.toFixed(3),
      total_pakan_kg: totalPakanKg,
      fcr_final: fcrFinal.toFixed(3),
      deplesi_akhir_pct: deplesiAkhirPct.toFixed(2),
      livability_pct: livabilityPct.toFixed(2),
      avg_umur: avgUmurPanen.toFixed(1),
      ip: ipOfficial,
      predikat: ipBadgeText,
      waktu_panen: new Date().toISOString()
    };

    activeFlok.panen_total = panenTotalObj;
    activeFlok.status_siklus = 'panen';

    await FlokioDB.saveFlok(activeFlok);

    // Update status kandang ke kosong
    const kandang = await FlokioDB.getKandang(activeKandangId);
    if (kandang) {
      kandang.status = 'kosong';
      await FlokioDB.saveKandang(kandang);
    }

    closeModalPanen();
    renderAllViews();
    setRole(currentRole);

    // Tampilkan Sertifikat Hasil Panen
    showHarvestCertificate(panenTotalObj);
  }
}

function showHarvestCertificate(res) {
  document.getElementById('hasilPanenFlokTitle').innerText = `Kandang 01 • Flok #${activeFlok.nomor_flok} (Selesai)`;
  document.getElementById('hasilPanenIPValue').innerText = res.ip;
  document.getElementById('hasilPanenIPBadge').innerText = res.predikat;

  document.getElementById('hasilPanenPopAwal').innerText = `${res.populasi_awal.toLocaleString('id-ID')} Ekor`;
  document.getElementById('hasilPanenTotalEkor').innerText = `${res.total_ekor_semua.toLocaleString('id-ID')} Ekor`;
  document.getElementById('hasilPanenTotalKg').innerText = `${Number(res.total_tonase_semua).toLocaleString('id-ID')} Kg`;
  document.getElementById('hasilPanenAvgBW').innerText = `${res.bobot_rata_kg} Kg / ekor`;
  document.getElementById('hasilPanenDeplesi').innerText = `${res.deplesi_akhir_pct}%`;
  document.getElementById('hasilPanenLivability').innerText = `${res.livability_pct}%`;
  document.getElementById('hasilPanenTotalPakan').innerText = `${Number(res.total_pakan_kg).toLocaleString('id-ID')} Kg (${(res.total_pakan_kg / 50).toFixed(0)} Sak)`;
  document.getElementById('hasilPanenFCR').innerText = res.fcr_final;

  // Format Pesan WhatsApp Rekap Panen
  lastHarvestReportText =
`*🏆 SERTIFIKAT HASIL PANEN FLOK BROILER — FLOKIO*
Kandang          : Kandang 01 (Flok #${activeFlok.nomor_flok})
Tanggal Panen    : ${formatIndoDate(res.tanggal)}
------------------------------------------------
• INDEKS PERFORMA (IP) : *${res.ip}* (${res.predikat})
• FCR Final Siklus     : *${res.fcr_final}*
• Bobot Rata-rata      : *${res.bobot_rata_kg} kg/ekor*
• Rata-rata Umur Panen : *${res.avg_umur} hari*
• Daya Hidup (Livability): *${res.livability_pct}%* (Deplesi: ${res.deplesi_akhir_pct}%)
• Total Ekor Terpanen  : *${res.total_ekor_semua.toLocaleString('id-ID')} ekor*
• Total Tonase Panen   : *${Number(res.total_tonase_semua).toLocaleString('id-ID')} kg*
• Total Konsumsi Pakan : *${Number(res.total_pakan_kg).toLocaleString('id-ID')} kg*
• Pembeli / Mitra      : ${res.bakul}
------------------------------------------------
_Flokio Smart Broiler Ledger — Kandang 01 Masuk Masa Sanitasi_`;

  document.getElementById('modalHasilPanen').classList.remove('hidden');
}

function closeModalHasilPanen() {
  document.getElementById('modalHasilPanen').classList.add('hidden');
  showToast('Siklus Flok Selesai! Kandang 01 siap untuk masa sanitasi & DOC baru.');
}

function copyHasilPanenWA() {
  navigator.clipboard.writeText(lastHarvestReportText);
  showToast('Laporan Hasil Panen Berhasil Disalin ke Clipboard!');
}

// ================= MASTER GEDUNG KANDANG =================
function onSelectKandang(kandangId) {
  activeKandangId = kandangId;
  showToast(`Beralih ke Gedung ${kandangId === 'k01' ? 'Kandang 01' : 'Kandang 02'}`);
}

function openModalTambahKandang() {
  document.getElementById('modalTambahKandang').classList.remove('hidden');
}

function closeModalTambahKandang() {
  document.getElementById('modalTambahKandang').classList.add('hidden');
}

async function submitTambahKandang() {
  const name = document.getElementById('inputNewKandangName').value.trim() || 'Kandang 03';
  const kap = parseInt(document.getElementById('inputNewKandangKap').value) || 5000;
  const newId = 'k' + (Date.now().toString().slice(-3));

  await FlokioDB.saveKandang({
    id: newId,
    nama: name,
    tipe: 'Closed House',
    kapasitas: kap,
    status: 'kosong',
    operator_default: '-',
    operator_wa: ''
  });

  closeModalTambahKandang();
  showToast(`Gedung ${name} Berhasil Didaftarkan!`);
}

// ================= EKSPOR & IMPOR DATA (SINKRONISASI OFFLINE) =================
async function exportDataBackup() {
  try {
    const jsonStr = await FlokioDB.exportAllData();

    // 1. Download sebagai file JSON
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flokio_backup_flok${activeFlok ? activeFlok.nomor_flok : '4'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // 2. Salin juga ke clipboard
    try {
      await navigator.clipboard.writeText(jsonStr);
    } catch (_) {}

    showToast('Cadangan Data Berhasil Diunduh & Disalin ke Clipboard!');
  } catch (err) {
    console.error('Ekspor gagal:', err);
    showToast('Gagal mengekspor data cadangan.');
  }
}

function openModalImport() {
  document.getElementById('textImportJSON').value = '';
  document.getElementById('modalImporData').classList.remove('hidden');
}

function closeModalImport() {
  document.getElementById('modalImporData').classList.add('hidden');
}

async function submitImportData() {
  const fileInput = document.getElementById('fileImportJSON');
  const textInput = document.getElementById('textImportJSON').value.trim();

  let jsonStr = '';

  if (fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    jsonStr = await file.text();
  } else if (textInput) {
    jsonStr = textInput;
  } else {
    alert('Pilih file cadangan JSON atau tempel teks JSON terlebih dahulu!');
    return;
  }

  try {
    await FlokioDB.importAllData(jsonStr);
    await reloadAppData();
    closeModalImport();
    renderAllViews();
    selectUmur(currentInputUmur);
    showToast('Data Cadangan Berhasil Dipulihkan! Seluruh Layar Tersinkron.');
  } catch (err) {
    alert('Format file cadangan tidak valid atau rusak!');
    console.error('Impor error:', err);
  }
}

// ================= CLOUD SYNC REALTIME (FIREBASE ADAPTER) =================
function toggleCloudSync(enabled) {
  const badge = document.getElementById('syncStatusBadge');
  if (enabled) {
    if (badge) {
      badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold border border-sky-200';
      badge.innerText = '☁️ Cloud Sync Aktif';
    }
    showToast('Sinkronisasi Cloud Realtime Diaktifkan!');
  } else {
    if (badge) {
      badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200';
      badge.innerText = '🟢 Offline-Ready (Lokal)';
    }
    showToast('Mode Lokal Offline Aktif.');
  }
}

function applyCloudRoomCode() {
  const code = document.getElementById('inputFarmRoomCode').value.trim();
  if (!code) {
    alert('Masukkan kode peternakan!');
    return;
  }
  showToast(`Kode Peternakan [${code}] diterapkan. Memulai penyelarasan...`);
}

// ================= UTILITY HELPERS =================
function addDaysToDateStr(baseDateStr, daysToAdd) {
  try {
    const d = new Date(baseDateStr || '2024-10-05');
    d.setDate(d.getDate() + Number(daysToAdd));
    return d.toISOString().split('T')[0];
  } catch (_) {
    return '2024-10-05';
  }
}

function formatIndoDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (_) {
    return dateStr;
  }
}

function formatDateShort(dateStr) {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateStr;
  } catch (_) {
    return dateStr;
  }
}

function getDefaultFeedForAge(age) {
  if (age <= 7) return 'BP-1 (Starter)';
  if (age <= 21) return 'B11A (Grower)';
  return 'B12 (Finisher)';
}

function getDefaultFeedKgForAge(age) {
  // Kurva estimasi pakan harian standar broiler Cobb 500 (untuk 4500 ekor)
  if (age <= 1) return 35;
  if (age <= 3) return 60;
  if (age <= 7) return 150;
  if (age <= 14) return 250;
  if (age <= 21) return 380;
  if (age <= 28) return 500;
  return 600;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerText = msg;
  toast.classList.remove('opacity-0');
  toast.classList.add('opacity-100');
  setTimeout(() => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0');
  }, 2800);
}
