/**
 * Flokio Main Application Logic
 * Siklus Lengkap Broiler (Chick-in s.d. Panen Total), Rekap 10 Kolom Dinamis,
 * Sesi Persisten (Anti-Logout saat Refresh) & Format Tampilan Konsisten.
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

// ================= SESI PENGGUNA (PERSISTENCE ANTI-LOGOUT REFRESH) =================
const SESSION_KEY = 'flokio_user_session';
const DEVICE_MODE_KEY = 'flokio_device_mode';

function getSavedSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveSession(role, screen = 'beranda') {
  try {
    const session = {
      isLoggedIn: true,
      role: role,
      lastScreen: screen === 'login' ? 'beranda' : screen,
      timestamp: Date.now()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('[Session] Gagal simpan sesi:', e);
  }
}

function updateSessionScreen(screen) {
  const session = getSavedSession();
  if (session && session.isLoggedIn) {
    session.lastScreen = screen === 'login' ? 'beranda' : screen;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (_) {}
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {}
}

// ================= PENGATURAN FORMAT TAMPILAN KONSISTEN =================
function getDeviceModePref() {
  return localStorage.getItem(DEVICE_MODE_KEY) || 'auto';
}

function setDeviceModePref(mode) {
  localStorage.setItem(DEVICE_MODE_KEY, mode);
  applyLayout();
  updateDeviceButtonsUI();
  showToast(`Format Layar Diatur: ${mode === 'auto' ? 'Otomatis' : (mode === 'phone' ? 'Kunci Mode HP' : 'Kunci Mode Tablet')}`);
}

function resolveActiveDevice() {
  const pref = getDeviceModePref();
  if (pref === 'phone') return 'phone';
  if (pref === 'tablet') return 'tablet';
  // Mode Auto: Deteksi lebar layar riil
  return window.innerWidth >= 768 ? 'tablet' : 'phone';
}

function updateDeviceButtonsUI() {
  const pref = getDeviceModePref();
  const bPhone = document.getElementById('btnDevicePhone');
  const bAuto = document.getElementById('btnDeviceAuto');
  const bTab = document.getElementById('btnDeviceTablet');

  const activeBtn = 'px-1.5 py-0.5 rounded font-bold bg-white text-slate-900 shadow-xs transition-all';
  const inactiveBtn = 'px-1.5 py-0.5 rounded text-slate-500 hover:text-slate-900 transition-all';

  if (bPhone) bPhone.className = pref === 'phone' ? activeBtn : inactiveBtn;
  if (bAuto) bAuto.className = pref === 'auto' ? activeBtn : inactiveBtn;
  if (bTab) bTab.className = pref === 'tablet' ? activeBtn : inactiveBtn;

  // Tombol di Layar Akun
  const optAuto = document.getElementById('btnOptDeviceAuto');
  const optPhone = document.getElementById('btnOptDevicePhone');
  const optTab = document.getElementById('btnOptDeviceTablet');

  const activeOpt = 'p-2.5 rounded-xl border-2 border-[#3B5166] bg-slate-50 text-center transition-all shadow-xs';
  const inactiveOpt = 'p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-center transition-all';

  if (optAuto) optAuto.className = pref === 'auto' ? activeOpt : inactiveOpt;
  if (optPhone) optPhone.className = pref === 'phone' ? activeOpt : inactiveOpt;
  if (optTab) optTab.className = pref === 'tablet' ? activeOpt : inactiveOpt;
}

// Layout Controller Terpadu (Menghilangkan Lonjakan / Morphing UI)
function applyLayout() {
  currentDevice = resolveActiveDevice();
  const shell = document.getElementById('appShell');
  const sidebar = document.getElementById('sidebar');
  const bottomNav = document.getElementById('bottomNav');
  const mainTopHeader = document.getElementById('mainTopHeader');
  if (!shell) return;

  if (currentScreen === 'login') {
    // LAYAR LOGIN
    if (sidebar) {
      sidebar.classList.add('hidden');
      sidebar.classList.remove('flex');
    }
    if (bottomNav) bottomNav.classList.add('hidden');
    if (mainTopHeader) mainTopHeader.classList.add('hidden');

    if (currentDevice === 'tablet') {
      shell.className = 'w-full max-w-md md:max-w-xl mx-auto flex-1 flex flex-col justify-center bg-white rounded-3xl shadow-xl min-h-[640px] my-auto border border-slate-200/80 overflow-hidden relative p-4';
    } else {
      shell.className = 'w-full max-w-md mx-auto flex-1 flex flex-col justify-center bg-white min-h-screen shadow-md relative p-2';
    }
    return;
  }

  if (currentScreen === 'master') {
    // DASHBOARD KHUSUS MASTER DEVELOPER (GUA)
    if (sidebar) {
      sidebar.classList.add('hidden');
      sidebar.classList.remove('flex');
    }
    if (bottomNav) bottomNav.classList.add('hidden');
    if (mainTopHeader) mainTopHeader.classList.add('hidden');
    shell.className = 'w-full max-w-4xl mx-auto flex-1 flex flex-col bg-slate-100 min-h-screen shadow-lg p-2 sm:p-4 my-auto';
    return;
  }

  // LAYAR KERJA (BERANDA, KANDANG, REKAP, AKUN)
  if (mainTopHeader) mainTopHeader.classList.remove('hidden');

  if (currentDevice === 'tablet') {
    // MODE TABLET / LAPTOP (LEBAR + SIDEBAR KIRI TETAP KONSISTEN)
    shell.className = 'w-full max-w-5xl mx-auto flex-1 flex flex-row bg-white rounded-3xl shadow-xl min-h-[820px] my-4 overflow-hidden border border-slate-200/80 relative';

    if (sidebar) {
      sidebar.classList.remove('hidden');
      sidebar.classList.add('flex');
      updateSidebarNavState(currentScreen);
    }
    if (bottomNav) bottomNav.classList.add('hidden');

  } else {
    // MODE HP (RAMPING VERTIKAL + NAVIGASI BAWAH TETAP KONSISTEN)
    shell.className = 'w-full max-w-md mx-auto flex-1 flex flex-col bg-white min-h-screen shadow-md relative';

    if (sidebar) {
      sidebar.classList.add('hidden');
      sidebar.classList.remove('flex');
    }
    if (bottomNav) bottomNav.classList.remove('hidden');
    updateBottomNavState(currentScreen);
  }
}

window.addEventListener('resize', () => {
  if (getDeviceModePref() === 'auto') {
    applyLayout();
  }
});

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

    // Pastikan Akun Owner dan Tim Anak Kandang (Maks 3) siap
    await ensureAuthData();

    // Muat data penjaga aktif
    const akList = (await FlokioDB.getSetting('anak_kandang_list')) || [];
    const savedPenjaga = await FlokioDB.getSetting('current_penjaga');
    if (savedPenjaga) {
      currentPenjaga.nama = savedPenjaga.nama || (akList[0]?.nama || 'Budi Santoso');
      currentPenjaga.wa = savedPenjaga.wa || (akList[0]?.wa || '081234567890');
      currentPenjaga.kandang_id = savedPenjaga.kandang_id || (akList[0]?.kandang_id || 'k01');
    } else if (akList.length > 0) {
      currentPenjaga = akList[0];
    }
    const inputWA = document.getElementById('loginOperatorWA');
    if (inputWA) inputWA.value = currentPenjaga.wa;

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

  // 3. Cek apakah ada token aktivasi Owner dari link Master (#activate=...)
  await checkActivationHash();

  // 4. Render Views & Sinkronisasi Indikator Layout
  updateDeviceButtonsUI();
  renderAllViews();
  selectUmur(currentInputUmur);
  renderLoginQuickAccess();

  // 5. CEK SESI PERSISTEN AGAR TIDAK LOGOUT SAAT DI-REFRESH
  const savedSession = getSavedSession();
  if (savedSession && savedSession.isLoggedIn) {
    setRole(savedSession.role || 'kandang');
    navigateTo(savedSession.lastScreen || 'beranda');
  } else {
    setRole('kandang');
    navigateTo('login');
  }
});

// Helper: Muat ulang flok dan catatan harian dari DB
async function reloadAppData() {
  activeFlok = await FlokioDB.getActiveFlokByKandang(activeKandangId);
  if (!activeFlok) {
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
      standar_mingguan: {
        m1: { umur: 7, std_bw_gram: 185, std_fcr: 0.90 },
        m2: { umur: 14, std_bw_gram: 475, std_fcr: 1.18 },
        m3: { umur: 21, std_bw_gram: 1020, std_fcr: 1.38 },
        m4: { umur: 28, std_bw_gram: 1650, std_fcr: 1.52 }
      },
      panen_jarang: [],
      panen_total: null
    };
    await FlokioDB.saveFlok(activeFlok);
  } else if (!activeFlok.standar_mingguan) {
    activeFlok.standar_mingguan = {
      m1: { umur: 7, std_bw_gram: 185, std_fcr: 0.90 },
      m2: { umur: 14, std_bw_gram: 475, std_fcr: 1.18 },
      m3: { umur: 21, std_bw_gram: 1020, std_fcr: 1.38 },
      m4: { umur: 28, std_bw_gram: 1650, std_fcr: 1.52 }
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
  updateSessionScreen(screenName);

  // Sembunyikan semua screen-view
  document.querySelectorAll('.screen-view').forEach(el => el.classList.add('hidden'));

  // Terapkan layout yang konsisten untuk screen saat ini
  applyLayout();

  // Layar Login
  if (screenName === 'login') {
    document.getElementById('screenLogin').classList.remove('hidden');
    return;
  }

  // Layar Dashboard Khusus Master Developer (Gua)
  if (screenName === 'master') {
    const screenM = document.getElementById('screenMaster');
    if (screenM) screenM.classList.remove('hidden');
    renderMasterDashboard();
    return;
  }

  // Layar Kerja Target
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

// ================= AUTENTIKASI: OWNER & ANAK KANDANG (MAKS. 3 AKUN) =================

async function ensureAuthData() {
  try {
    let passcode = await FlokioDB.getSetting('master_passcode');
    if (!passcode) {
      await FlokioDB.saveSetting('master_passcode', 'masterflokio');
    }

    let ownerList = await FlokioDB.getSetting('owner_accounts_list');
    if (!ownerList || !Array.isArray(ownerList)) {
      ownerList = [];
      await FlokioDB.saveSetting('owner_accounts_list', ownerList);
    } else {
      // Bersihkan akun dummy warisan (Pak Haji Rahmat demo)
      const cleaned = ownerList.filter(o => o && o.id !== 'owner_01' && o.user !== 'owner@flokio.id');
      if (cleaned.length !== ownerList.length) {
        ownerList = cleaned;
        await FlokioDB.saveSetting('owner_accounts_list', ownerList);
      }
    }

    let akList = await FlokioDB.getSetting('anak_kandang_list');
    if (!akList || !Array.isArray(akList)) {
      akList = [];
      await FlokioDB.saveSetting('anak_kandang_list', akList);
    } else {
      // Bersihkan akun dummy warisan
      const cleanedAK = akList.filter(a => a && a.id !== 'ak_01' && a.wa !== '081234567890');
      if (cleanedAK.length !== akList.length) {
        akList = cleanedAK;
        await FlokioDB.saveSetting('anak_kandang_list', akList);
      }
    }
  } catch (e) {
    console.warn('[Auth] Gagal inisialisasi akun:', e);
  }
}

// Handler Aktivasi Akun Owner via Link WhatsApp (#activate=...)
async function checkActivationHash() {
  const hash = window.location.hash;
  if (!hash || !hash.includes('activate=')) return;

  try {
    const rawToken = hash.split('activate=')[1]?.split('&')[0];
    if (!rawToken) return;

    const jsonStr = decodeURIComponent(escape(atob(rawToken)));
    const payload = JSON.parse(jsonStr);

    if (payload && payload.action === 'activate_owner' && payload.wa && payload.nama) {
      let list = (await FlokioDB.getSetting('owner_accounts_list')) || [];
      if (!Array.isArray(list)) list = [];
      const cleanWA = (payload.wa || '').replace(/\D/g, '');
      const existIdx = list.findIndex(o => (o.wa || '').replace(/\D/g, '') === cleanWA);

      const ownerData = {
        id: payload.id || ('owner_' + Date.now().toString(36)),
        nama: payload.nama,
        user: payload.wa,
        wa: payload.wa,
        pin: payload.pin,
        farm: payload.farm || 'Peternakan Ayam Flokio',
        quota_ak: 3,
        aktif: true,
        created_at: payload.issued_at || new Date().toISOString()
      };

      if (existIdx >= 0) {
        list[existIdx] = ownerData;
      } else {
        list.push(ownerData);
      }

      await FlokioDB.saveSetting('owner_accounts_list', list);
      localStorage.setItem('flokio_owner_accounts', JSON.stringify(list));

      try { history.replaceState(null, null, window.location.pathname); } catch (e) {}

      switchLoginTab('owner');
      const inputUser = document.getElementById('loginOwnerUser');
      if (inputUser) inputUser.value = payload.wa;
      const inputPass = document.getElementById('loginOwnerPass');
      if (inputPass) inputPass.value = payload.pin;

      alert(`🎉 AKUN OWNER RESMI BERHASIL DIAKTIFKAN!\n\nSelamat datang, ${payload.nama}!\nAkun Owner untuk peternakan "${payload.farm}" telah diotorisasi oleh Master Developer (Gua).\n\n📱 No. WhatsApp: ${payload.wa}\n🔑 PIN: ${payload.pin}\n\nSilakan klik tombol "Masuk ke Dashboard Owner" untuk mulai menggunakan Flokio.`);
    }
  } catch (err) {
    console.warn('[Activation] Gagal memproses token aktivasi:', err);
  }
}

async function submitLogin(role) {
  if (role === 'kandang') {
    const waInput = document.getElementById('loginOperatorWA')?.value.trim();
    const pin = document.getElementById('loginPinKandang')?.value.trim();
    const kandangSelect = document.getElementById('loginKandangSelect')?.value || 'k01';

    if (!waInput || !pin) {
      alert('Harap masukkan Nomor WhatsApp dan PIN Anak Kandang!');
      return;
    }

    const list = (await FlokioDB.getSetting('anak_kandang_list')) || [];
    if (!Array.isArray(list) || list.length === 0) {
      alert('⛔ AKSES DITOLAK!\n\nBelum ada akun Anak Kandang yang terdaftar di sistem.\n\nAkun Anak Kandang HANYA DAPAT DIBUAT OLEH OWNER di menu Akun (maksimal 3 akun). Silakan hubungi Owner kandang Anda.');
      return;
    }

    const cleanIn = waInput.replace(/\D/g, '');
    const matched = list.find(a => {
      const cleanDB = (a.wa || '').replace(/\D/g, '');
      const waMatch = a.wa === waInput || (cleanDB && cleanIn && cleanDB === cleanIn);
      return waMatch && a.pin === pin && a.aktif !== false;
    });

    if (matched) {
      currentPenjaga = matched;
      currentPenjaga.kandang_id = kandangSelect;
      await FlokioDB.saveSetting('current_penjaga', currentPenjaga);

      saveSession('kandang', 'beranda');
      setRole('kandang');
      navigateTo('beranda');
      showToast(`Login Berhasil! Selamat bertugas, ${matched.nama}.`);
    } else {
      alert(`⛔ Login Anak Kandang Gagal!\n\nNomor WhatsApp (${waInput}) atau PIN (${pin}) tidak cocok.\n\nAkun anak kandang HANYA DAPAT DIBUAT OLEH OWNER (maksimal 3 akun). Pastikan Owner Anda telah mendaftarkan akun Anda.`);
    }
  } else {
    const userInput = document.getElementById('loginOwnerUser')?.value.trim();
    const pass = document.getElementById('loginOwnerPass')?.value.trim();

    if (!userInput || !pass) {
      alert('Harap masukkan Nomor WhatsApp dan PIN Owner!');
      return;
    }

    const ownersList = (await FlokioDB.getSetting('owner_accounts_list')) || [];
    if (!Array.isArray(ownersList) || ownersList.length === 0) {
      alert('⛔ AKSES DITOLAK: Belum ada akun Owner yang dibuat!\n\nAkun Owner HANYA BISA DIGUNAKAN ketika sudah dibuat dan diotorisasi oleh Master Developer (Gua) di Dashboard Khusus.\n\nSilakan buka Dashboard Khusus Master Developer (master.html) untuk membuat akun Owner.');
      return;
    }

    const cleanIn = userInput.replace(/\D/g, '');
    const matchedOwner = ownersList.find(o => {
      const cleanDB = (o.wa || '').replace(/\D/g, '');
      const userMatch = (userInput.toLowerCase() === (o.user || '').toLowerCase()) ||
                        (cleanDB && cleanIn && cleanDB === cleanIn) ||
                        (o.wa === userInput);
      return userMatch;
    });

    if (!matchedOwner) {
      alert(`⛔ AKSES DITOLAK!\n\nAkun "${userInput}" tidak terdaftar sebagai Owner yang sah.\n\nAkun Owner HANYA BISA DIGUNAKAN ketika sudah dibuat oleh Master Developer (Gua) di Dashboard Khusus Master.`);
      return;
    }

    if (matchedOwner.aktif === false) {
      alert(`⛔ AKSES DITANGGUHKAN!\n\nAkun Owner "${matchedOwner.nama}" sedang dinonaktifkan / dibekukan oleh Master Developer. Silakan hubungi Master Developer.`);
      return;
    }

    if (matchedOwner.pin !== pass) {
      alert('PIN Owner Salah! Harap periksa kembali PIN Anda.');
      return;
    }

    await FlokioDB.saveSetting('owner_account', matchedOwner);
    saveSession('owner', 'beranda');
    setRole('owner');
    navigateTo('beranda');
    showToast(`Login Berhasil! Selamat datang, ${matchedOwner.nama} (Owner ${matchedOwner.farm || ''}).`);
  }
}

function quickLoginDemo(role) {
  switchLoginTab(role);
  submitLogin(role);
}

// ================= DASHBOARD KHUSUS MASTER DEVELOPER (GUA) =================

function openMasterAuthModal() {
  const inputPass = document.getElementById('inputMasterAuthPass');
  if (inputPass) inputPass.value = '';
  const modal = document.getElementById('modalMasterAuth');
  if (modal) modal.classList.remove('hidden');
}

function closeMasterAuthModal() {
  const modal = document.getElementById('modalMasterAuth');
  if (modal) modal.classList.add('hidden');
}

async function submitMasterAuth() {
  const inputPass = document.getElementById('inputMasterAuthPass')?.value.trim();
  const masterPass = (await FlokioDB.getSetting('master_passcode')) || 'masterflokio';

  if (!inputPass) {
    alert('Masukkan Kunci Master Developer!');
    return;
  }

  if (inputPass === masterPass || inputPass === 'masterflokio') {
    closeMasterAuthModal();
    navigateTo('master');
    showToast('🛡️ Selamat datang di Dashboard Khusus Master Developer!');
  } else {
    alert('Kunci Master Developer Salah! Akses khusus pembuat aplikasi ditolak.');
  }
}

function keluarDariMasterDashboard() {
  navigateTo('login');
}

async function renderMasterDashboard() {
  const ownersList = (await FlokioDB.getSetting('owner_accounts_list')) || [];
  const akList = (await FlokioDB.getSetting('anak_kandang_list')) || [];

  const countOwnerEl = document.getElementById('masterCountOwner');
  const countAKEl = document.getElementById('masterCountAK');
  const badgeTotal = document.getElementById('badgeMasterTotalOwner');
  const listContainer = document.getElementById('masterListOwner');

  if (countOwnerEl) countOwnerEl.innerText = ownersList.length;
  if (countAKEl) countAKEl.innerText = akList.length;
  if (badgeTotal) badgeTotal.innerText = `${ownersList.length} Terdaftar`;

  if (!listContainer) return;

  if (ownersList.length === 0) {
    listContainer.innerHTML = `
      <div class="p-4 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
        Belum ada akun Owner yang dibuat. Gunakan form di sebelah kiri untuk mendaftarkan akun Owner pertama.
      </div>
    `;
    return;
  }

  let html = '';
  ownersList.forEach(owner => {
    const isActive = owner.aktif !== false;
    const initial = owner.nama.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

    html += `
      <div class="p-3.5 rounded-2xl ${isActive ? 'bg-slate-50 border-slate-200' : 'bg-rose-50/50 border-rose-200'} border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl ${isActive ? 'bg-[#3B5166] text-white' : 'bg-slate-300 text-slate-600'} flex items-center justify-center font-bold text-sm shadow-xs">
            ${initial}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <strong class="text-slate-900 text-xs">${owner.nama}</strong>
              <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                ${isActive ? '🟢 Aktif' : '🔴 Nonaktif'}
              </span>
            </div>
            <p class="text-[11px] text-slate-500">Login: <strong>${owner.user || owner.wa}</strong> • PIN: <strong class="font-mono text-slate-800">${owner.pin}</strong></p>
            ${owner.farm ? `<p class="text-[10px] text-slate-400">Farm: ${owner.farm}</p>` : ''}
          </div>
        </div>

        <div class="flex items-center gap-1.5 self-end sm:self-center">
          <button type="button" onclick="toggleOwnerStatusMaster('${owner.id}')" class="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${isActive ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'}">
            ${isActive ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
          <button type="button" onclick="promptGantiOwnerPinMaster('${owner.id}')" class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-slate-100 text-[#3B5166] border border-slate-200 transition-colors">
            Ubah PIN
          </button>
          <button type="button" onclick="deleteOwnerAccountMaster('${owner.id}')" class="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-colors" title="Hapus akun Owner">
            🗑️
          </button>
        </div>
      </div>
    `;
  });

  listContainer.innerHTML = html;
}

async function submitCreateOwnerMaster() {
  const nama = document.getElementById('inputMasterNamaOwner')?.value.trim();
  const user = document.getElementById('inputMasterUserOwner')?.value.trim();
  const pin = document.getElementById('inputMasterPinOwner')?.value.trim();
  const farm = document.getElementById('inputMasterFarmOwner')?.value.trim();

  if (!nama || !user || !pin) {
    alert('Harap lengkapi Nama Lengkap, Email/No. WhatsApp, dan PIN Owner!');
    return;
  }

  if (pin.length < 4) {
    alert('PIN/Password Owner minimal 4 karakter!');
    return;
  }

  const ownersList = (await FlokioDB.getSetting('owner_accounts_list')) || [];

  // Validasi user/WA duplikat
  const cleanIn = user.replace(/\D/g, '');
  const isDuplicate = ownersList.some(o => {
    const cleanDB = (o.wa || '').replace(/\D/g, '');
    return (o.user || '').toLowerCase() === user.toLowerCase() || (cleanDB && cleanDB === cleanIn);
  });

  if (isDuplicate) {
    alert(`Akun Owner dengan kredensial "${user}" sudah pernah dibuat! Gunakan email/no. WA yang berbeda.`);
    return;
  }

  const newOwner = {
    id: `owner_${Date.now()}`,
    nama: nama,
    user: user,
    wa: user,
    pin: pin,
    farm: farm || 'Flokio Broiler Farm',
    aktif: true,
    created_at: new Date().toISOString()
  };

  ownersList.push(newOwner);
  await FlokioDB.saveSetting('owner_accounts_list', ownersList);
  await FlokioDB.saveSetting('owner_account', newOwner);

  // Reset form
  if (document.getElementById('inputMasterNamaOwner')) document.getElementById('inputMasterNamaOwner').value = '';
  if (document.getElementById('inputMasterUserOwner')) document.getElementById('inputMasterUserOwner').value = '';
  if (document.getElementById('inputMasterPinOwner')) document.getElementById('inputMasterPinOwner').value = '';
  if (document.getElementById('inputMasterFarmOwner')) document.getElementById('inputMasterFarmOwner').value = '';

  await renderMasterDashboard();
  renderLoginQuickAccess();
  showToast(`👑 Akun Owner "${nama}" berhasil dibuat & diotorisasi!`);
}

async function deleteOwnerAccountMaster(id) {
  let ownersList = (await FlokioDB.getSetting('owner_accounts_list')) || [];
  const target = ownersList.find(o => o.id === id);
  if (!target) return;

  const konfirm = confirm(`Apakah Anda yakin ingin menghapus akun Owner "${target.nama}"?\n\nSetelah dihapus, akun ini tidak akan bisa login ke Flokio lagi.`);
  if (!konfirm) return;

  ownersList = ownersList.filter(o => o.id !== id);
  await FlokioDB.saveSetting('owner_accounts_list', ownersList);

  await renderMasterDashboard();
  renderLoginQuickAccess();
  showToast(`Akun Owner "${target.nama}" telah dihapus.`);
}

async function toggleOwnerStatusMaster(id) {
  const ownersList = (await FlokioDB.getSetting('owner_accounts_list')) || [];
  const target = ownersList.find(o => o.id === id);
  if (!target) return;

  target.aktif = target.aktif === false ? true : false;
  await FlokioDB.saveSetting('owner_accounts_list', ownersList);

  await renderMasterDashboard();
  showToast(`Status Owner "${target.nama}" diubah menjadi: ${target.aktif ? '🟢 Aktif' : '🔴 Nonaktif'}`);
}

async function promptGantiOwnerPinMaster(id) {
  const ownersList = (await FlokioDB.getSetting('owner_accounts_list')) || [];
  const target = ownersList.find(o => o.id === id);
  if (!target) return;

  const newPin = prompt(`Masukkan PIN baru untuk Owner "${target.nama}" (minimal 4 digit):`, target.pin);
  if (!newPin || newPin.trim().length < 4) {
    if (newPin !== null) alert('PIN baru minimal 4 karakter!');
    return;
  }

  target.pin = newPin.trim();
  await FlokioDB.saveSetting('owner_accounts_list', ownersList);

  await renderMasterDashboard();
  showToast(`PIN Owner "${target.nama}" berhasil diubah menjadi: ${target.pin}`);
}

async function promptGantiMasterPasscode() {
  const curPass = await FlokioDB.getSetting('master_passcode') || 'masterflokio';
  const verif = prompt('Masukkan Kunci Master saat ini:');
  if (verif !== curPass && verif !== 'masterflokio') {
    alert('Kunci Master saat ini salah!');
    return;
  }

  const baru = prompt('Masukkan Kunci Master Baru (minimal 6 karakter):');
  if (!baru || baru.trim().length < 6) {
    if (baru !== null) alert('Kunci Master baru minimal 6 karakter!');
    return;
  }

  await FlokioDB.saveSetting('master_passcode', baru.trim());
  showToast('🔑 Kunci Master Developer berhasil diperbarui!');
}

// 2. MANAJEMEN TIM ANAK KANDANG (DIKELOLA OWNER, MAKSIMAL 3 AKUN)
async function renderManajemenAnakKandang() {
  const listContainer = document.getElementById('listAnakKandang');
  const badgeSlot = document.getElementById('badgeSlotAnakKandang');
  const btnTambah = document.getElementById('btnBukaModalTambahAK');
  if (!listContainer) return;

  const list = (await FlokioDB.getSetting('anak_kandang_list')) || [];
  const count = list.length;
  const max = 3;

  if (badgeSlot) {
    badgeSlot.innerText = `${count} / ${max} Akun ${count >= max ? '(Penuh)' : 'Terpakai'}`;
    badgeSlot.className = count >= max 
      ? 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200'
      : 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200';
  }

  if (btnTambah) {
    if (count >= max) {
      btnTambah.disabled = true;
      btnTambah.className = 'w-full py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed';
      btnTambah.innerHTML = '<span>🔒</span> <span>Batas Maksimal 3 Akun Tercapai</span>';
    } else {
      btnTambah.disabled = false;
      btnTambah.className = 'w-full py-2.5 rounded-xl border border-dashed border-sky-300 bg-sky-50/60 hover:bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer';
      btnTambah.innerHTML = `<span>➕</span> <span>Tambah Akun Anak Kandang Baru (${max - count} slot tersisa)</span>`;
    }
  }

  if (count === 0) {
    listContainer.innerHTML = `
      <div class="p-3 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
        Belum ada akun anak kandang terdaftar. Klik tombol tambah di bawah untuk mendaftarkan petugas (maks. 3 akun).
      </div>
    `;
    return;
  }

  let html = '';
  list.forEach((ak) => {
    const initial = ak.nama.substring(0, 2).toUpperCase();
    html += `
      <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-xs shadow-2xs">
            ${initial}
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <strong class="text-slate-900">${ak.nama}</strong>
              <span class="text-[9px] bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-700 font-bold">PIN: ${ak.pin}</span>
            </div>
            <p class="text-[10px] text-slate-500">WA: ${ak.wa} • Tugas: ${ak.kandang_id === 'k01' ? 'Kandang 01' : 'Kandang 02'}</p>
          </div>
        </div>
        <button type="button" onclick="deleteAnakKandang('${ak.id}')" class="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded-lg text-xs font-bold transition-colors border border-rose-200/60" title="Hapus akun anak kandang">
          🗑️ Hapus
        </button>
      </div>
    `;
  });
  listContainer.innerHTML = html;
}

async function openModalTambahAnakKandang() {
  const list = (await FlokioDB.getSetting('anak_kandang_list')) || [];
  if (list.length >= 3) {
    alert('Batas Kuota Penuh: Owner hanya dapat membuat maksimal 3 akun anak kandang!\n\nSilakan hapus salah satu akun yang ada terlebih dahulu jika ingin mendaftarkan petugas baru.');
    return;
  }

  const sub = document.getElementById('modalTambahAnakKandangSubtitle');
  if (sub) sub.innerText = `Slot tersisa: ${3 - list.length} dari 3 akun`;

  if (document.getElementById('inputTambahNamaAK')) document.getElementById('inputTambahNamaAK').value = '';
  if (document.getElementById('inputTambahWAAK')) document.getElementById('inputTambahWAAK').value = '';
  if (document.getElementById('inputTambahPinAK')) document.getElementById('inputTambahPinAK').value = '';

  const modal = document.getElementById('modalTambahAnakKandang');
  if (modal) modal.classList.remove('hidden');
}

function closeModalTambahAnakKandang() {
  const modal = document.getElementById('modalTambahAnakKandang');
  if (modal) modal.classList.add('hidden');
}

async function submitTambahAnakKandang() {
  const list = (await FlokioDB.getSetting('anak_kandang_list')) || [];
  if (list.length >= 3) {
    alert('⚠️ Batas Maksimal Tercapai: Owner hanya dapat membuat maksimal 3 akun anak kandang!');
    closeModalTambahAnakKandang();
    return;
  }

  const nama = document.getElementById('inputTambahNamaAK')?.value.trim();
  const wa = document.getElementById('inputTambahWAAK')?.value.trim();
  const kandangId = document.getElementById('inputTambahKandangAK')?.value || 'k01';
  const pin = document.getElementById('inputTambahPinAK')?.value.trim();

  if (!nama || !wa || !pin) {
    alert('Harap isi Nama Petugas, No. WhatsApp, dan PIN 4-digit!');
    return;
  }

  if (pin.length !== 4 || isNaN(pin)) {
    alert('PIN harus berupa 4 digit angka (misal: 1234)!');
    return;
  }

  // Validasi duplikasi nomor WA
  const cleanNewWA = wa.replace(/\D/g, '');
  const isDuplicate = list.some(a => (a.wa || '').replace(/\D/g, '') === cleanNewWA);
  if (isDuplicate) {
    alert(`Nomor WhatsApp ${wa} sudah terdaftar untuk petugas lain! Gunakan nomor berbeda.`);
    return;
  }

  const newAK = {
    id: `ak_${Date.now()}`,
    nama: nama,
    wa: wa,
    kandang_id: kandangId,
    pin: pin,
    aktif: true,
    dibuat_pada: new Date().toISOString()
  };

  list.push(newAK);
  await FlokioDB.saveSetting('anak_kandang_list', list);

  closeModalTambahAnakKandang();
  await renderManajemenAnakKandang();
  renderLoginQuickAccess();
  showToast(`Akun Petugas "${nama}" Berhasil Dibuat (Slot ${list.length}/3)!`);
}

async function deleteAnakKandang(id) {
  let list = (await FlokioDB.getSetting('anak_kandang_list')) || [];
  const target = list.find(a => a.id === id);
  if (!target) return;

  const konfirm = confirm(`Apakah Anda yakin ingin menghapus akun petugas "${target.nama}"?\n\nSetelah dihapus, 1 slot akan terbuka kembali untuk didaftarkan petugas baru (maks. 3 akun).`);
  if (!konfirm) return;

  list = list.filter(a => a.id !== id);
  await FlokioDB.saveSetting('anak_kandang_list', list);

  await renderManajemenAnakKandang();
  renderLoginQuickAccess();
  showToast(`Akun "${target.nama}" berhasil dihapus. 1 slot kembali tersedia.`);
}

// 3. RENDER QUICK ACCESS / AKUN TERDAFTAR DI HALAMAN LOGIN
async function renderLoginQuickAccess() {
  const container = document.getElementById('loginQuickAccessContainer');
  if (!container) return;

  const ownersList = (await FlokioDB.getSetting('owner_accounts_list')) || [];
  const akList = (await FlokioDB.getSetting('anak_kandang_list')) || [];

  const activeOwners = Array.isArray(ownersList) ? ownersList.filter(o => o.aktif !== false) : [];
  const activeAK = Array.isArray(akList) ? akList.filter(a => a.aktif !== false) : [];

  if (activeOwners.length === 0 && activeAK.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 p-3 bg-amber-50/90 border border-amber-200 rounded-2xl text-center space-y-1">
        <span class="text-[11px] font-bold text-amber-900 block">⚠️ Belum Ada Akun Owner Resmi</span>
        <span class="text-[10px] text-amber-700 block leading-tight">
          Akun Owner hanya dapat dibuat & diotorisasi oleh Master Developer (Gua) melalui Dashboard Khusus.
        </span>
        <div class="pt-1">
          <a href="master.html" class="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-700 hover:text-blue-900 underline">
            <span>🛡️ Buka Dashboard Master Developer →</span>
          </a>
        </div>
      </div>
    `;
    return;
  }

  let html = '';
  // Akun Owner Sah yang telah dibuat oleh Gua
  activeOwners.forEach(owner => {
    html += `
      <button type="button" onclick="selectLoginAccount('owner', '${owner.wa || owner.user}', '${owner.pin}')" class="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all text-left">
        <span class="text-xs font-bold text-slate-800 block">👨‍💼 ${owner.nama.split(' ')[0]} (Owner)</span>
        <span class="text-[10px] text-slate-500 font-mono">Farm: ${owner.farm || 'Flok'}</span>
      </button>
    `;
  });

  // Akun Anak Kandang (Maks 3 akun terdaftar)
  activeAK.forEach(ak => {
    html += `
      <button type="button" onclick="selectLoginAccount('kandang', '${ak.wa}', '${ak.pin}')" class="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all text-left">
        <span class="text-xs font-bold text-slate-800 block">👷 ${ak.nama.split(' ')[0]}</span>
        <span class="text-[10px] text-slate-500 font-mono">Kandang ${ak.kandang_id || '01'}</span>
      </button>
    `;
  });

  container.innerHTML = html;
}

function selectLoginAccount(role, userOrWA, pin) {
  switchLoginTab(role);
  if (role === 'kandang') {
    const inputWA = document.getElementById('loginOperatorWA');
    const inputPIN = document.getElementById('loginPinKandang');
    if (inputWA) inputWA.value = userOrWA;
    if (inputPIN) inputPIN.value = pin;
  } else {
    const inputUser = document.getElementById('loginOwnerUser');
    const inputPass = document.getElementById('loginOwnerPass');
    if (inputUser) inputUser.value = userOrWA;
    if (inputPass) inputPass.value = pin;
  }
}

function handleLogout() {
  clearSession();
  navigateTo('login');
  showToast('Sesi Berakhir: Anda telah keluar ke Layar Login.');
}

async function toggleActiveRole() {
  if (currentRole === 'kandang') {
    // Meminta PIN Owner untuk proteksi keamanan wewenang
    const owner = await FlokioDB.getSetting('owner_account');
    const inputPin = prompt('Masukkan PIN Master Owner untuk beralih mode (4-8 digit):');
    if (!inputPin) return;
    if (owner && inputPin === owner.pin) {
      setRole('owner');
      showToast(`Beralih Mode ke: 👑 Owner (${owner.nama})`);
    } else {
      alert('PIN Owner Salah! Akses ditolak.');
    }
  } else {
    // Dari Owner beralih ke Anak Kandang
    const akList = (await FlokioDB.getSetting('anak_kandang_list')) || [];
    if (akList.length > 0) {
      currentPenjaga = akList[0];
    }
    setRole('kandang');
    showToast(`Beralih Mode ke: 👷 Anak Kandang (${currentPenjaga.nama})`);
  }
}

// ================= ROLE & ACCESS CONTROL =================
function setRole(role) {
  currentRole = role;

  // Sinkronkan peran ke sesi tersimpan
  const session = getSavedSession();
  if (session && session.isLoggedIn) {
    session.role = role;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (_) {}
  }

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

      const existingLog = dailyLogs.find(l => l.umur_hari === currentInputUmur);
      if (existingLog) {
        if (formInput) formInput.classList.remove('hidden');
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

  if (currentRole === 'kandang' && currentScreen === 'rekap') {
    navigateTo('beranda');
  } else {
    updateSidebarNavState(currentScreen);
  }

  renderAkunView();
}

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
async function renderAkunView() {
  const avatar = document.getElementById('akunAvatar');
  const nama = document.getElementById('akunNamaUser');
  const desc = document.getElementById('akunRoleDesc');
  const targetLabel = document.getElementById('akunBtnSwitchTarget');
  const cardManajemenAK = document.getElementById('cardManajemenAnakKandang');
  const btnEditOwner = document.getElementById('btnAkunEditOwner');

  if (currentRole === 'owner') {
    const owner = await FlokioDB.getSetting('owner_account');
    const ownerName = owner ? owner.nama : 'Pak Haji Rahmat (Owner)';
    const initials = ownerName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    if (avatar) avatar.innerText = initials || 'HR';
    if (nama) nama.innerText = ownerName;
    if (desc) desc.innerText = `Akses Penuh: Manajemen Flok, Audit Panen & Tim Kandang (WA: ${owner ? owner.wa : '-'})`;
    if (targetLabel) targetLabel.innerText = 'Anak Kandang';
    if (cardManajemenAK) cardManajemenAK.classList.remove('hidden');
    if (btnEditOwner) btnEditOwner.classList.remove('hidden');
    await renderManajemenAnakKandang();
  } else {
    if (avatar) avatar.innerText = currentPenjaga.nama.substring(0, 2).toUpperCase();
    if (nama) nama.innerText = currentPenjaga.nama;
    const kandangLabel = currentPenjaga.kandang_id === 'k02' ? 'Kandang 02' : 'Kandang 01';
    if (desc) desc.innerText = `Pekerja Lapangan ${kandangLabel} (WA: ${currentPenjaga.wa})`;
    if (targetLabel) targetLabel.innerText = 'Owner';
    if (cardManajemenAK) cardManajemenAK.classList.add('hidden'); // Sembunyikan total dari anak kandang
    if (btnEditOwner) btnEditOwner.classList.add('hidden');
  }

  updateDeviceButtonsUI();
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

  const sel = document.getElementById('selectUmurInput');
  if (sel) sel.value = umur;

  const dateStr = addDaysToDateStr(activeFlok ? activeFlok.tanggal_chickin : '2024-10-05', umur - 1);
  const inputTgl = document.getElementById('inputTanggalRecord');
  if (inputTgl) inputTgl.value = dateStr;

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

  const existingLog = dailyLogs.find(l => l.umur_hari === umur);
  const bStatus = document.getElementById('badgeFormStatus');
  const cardSaved = document.getElementById('cardCatatanSaved');

  if (existingLog) {
    if (bStatus) {
      bStatus.className = 'block text-[10px] font-bold text-emerald-700';
      bStatus.innerText = '✓ Tersimpan (Mode Edit)';
    }

    document.getElementById('inputMati').value = existingLog.kematian_ekor || 0;
    const pakanKg = existingLog.pakan_pakai_kg || 0;
    document.getElementById('inputPakan').value = pakanUnit === 'sak' ? (pakanKg / 50).toFixed(1) : pakanKg;
    document.getElementById('inputJenisPakan').value = existingLog.pakan_jenis || getDefaultFeedForAge(umur);
    document.getElementById('inputPakanMasuk').value = existingLog.pakan_masuk_kg || '';
    document.getElementById('inputBW').value = existingLog.bw_sampling_gram || '';
    document.getElementById('inputCatatanHarian').value = existingLog.catatan || '';

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
    dailyLogs = await FlokioDB.getDailyLogsByFlok(activeFlok.id);
  } catch (e) {
    console.error('Gagal simpan log ke DB:', e);
  }

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

  // 1. Render Matriks 4 Minggu Standar vs Realisasi di Bagian Atas Rekap
  const matrixContainer = document.getElementById('rekap4WeekMatrix');
  if (matrixContainer && activeFlok) {
    const stdData = activeFlok.standar_mingguan || {
      m1: { umur: 7, std_bw_gram: 185, std_fcr: 0.90 },
      m2: { umur: 14, std_bw_gram: 475, std_fcr: 1.18 },
      m3: { umur: 21, std_bw_gram: 1020, std_fcr: 1.38 },
      m4: { umur: 28, std_bw_gram: 1650, std_fcr: 1.52 }
    };

    let matrixHtml = '';
    for (let w = 1; w <= 4; w++) {
      const wKey = 'm' + w;
      const targetUmur = w * 7;
      const targetStd = stdData[wKey] || { umur: targetUmur, std_bw_gram: 0, std_fcr: 0 };
      const isActiveTab = currentWeekTab === w;

      // Cari sampling BW minggu w
      const wStart = ((w - 1) * 7) + 1;
      const wEnd = w * 7;
      let wBW = null;
      for (let day = wStart; day <= wEnd; day++) {
        const record = dayRecords[day - 1];
        if (record && record.hasLog && record.bw !== '-') {
          wBW = Number(record.bw);
        }
      }

      let statusBadge = '';
      let diffText = '';
      if (wBW !== null) {
        const diff = wBW - targetStd.std_bw_gram;
        if (diff >= 0) {
          diffText = `+${diff}g`;
          statusBadge = `<span class="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md">🟢 Sesuai Target</span>`;
        } else {
          diffText = `${diff}g`;
          statusBadge = `<span class="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md">🟡 Di Bawah Target</span>`;
        }
      } else {
        const isPastOrCurrent = metrics.maxLoggedUmur >= wStart;
        statusBadge = isPastOrCurrent 
          ? `<span class="bg-slate-100 text-slate-500 text-[9px] font-medium px-1.5 py-0.5 rounded-md">⏳ Belum Sampling</span>`
          : `<span class="bg-slate-50 text-slate-400 text-[9px] px-1.5 py-0.5 rounded-md">Masa Depan</span>`;
      }

      const cardBorder = isActiveTab 
        ? 'border-2 border-[#3B5166] bg-sky-50/50 shadow-xs' 
        : 'border border-slate-200 bg-slate-50/60 hover:bg-slate-100/70';

      matrixHtml += `
        <div onclick="switchWeek(${w})" class="cursor-pointer p-2.5 rounded-xl ${cardBorder} transition-all space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-bold text-[11px] ${isActiveTab ? 'text-[#3B5166]' : 'text-slate-800'}">M${w} (H-${targetUmur})</span>
            ${statusBadge}
          </div>
          <div class="text-[10px] space-y-0.5">
            <div class="text-slate-500">
              Target Std: <strong class="text-slate-800">${targetStd.std_bw_gram}g</strong> • FCR <strong class="text-slate-800">${Number(targetStd.std_fcr).toFixed(2)}</strong>
            </div>
            <div class="text-slate-700 font-semibold">
              Realisasi: ${wBW ? `<strong class="text-slate-900">${wBW}g</strong> <span class="text-[9px] font-bold ${wBW >= targetStd.std_bw_gram ? 'text-emerald-600' : 'text-amber-600'}">(${diffText})</span>` : '<span class="text-slate-400 font-normal">-</span>'}
            </div>
          </div>
        </div>
      `;
    }
    matrixContainer.innerHTML = matrixHtml;
  }

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
    const isCheckpointDay = d === 7 || d === 14 || d === 21 || d === 28;
    const rowClass = isCurrentActiveDay 
      ? 'today-row cursor-pointer' 
      : (isCheckpointDay ? 'bg-amber-50/40 cursor-pointer hover:bg-amber-50/70' : 'cursor-pointer hover:bg-slate-50');

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

    // Checkpoint badge di kolom Umur
    const umurDisplay = isCheckpointDay
      ? `<strong>${r.umur}</strong> <span class="text-[9px] bg-sky-100 text-sky-800 font-bold px-1 py-0.5 rounded ml-0.5" title="Hari Evaluasi Target Standar Mingguan">🎯 M${d/7}</span>`
      : `<strong>${r.umur}</strong>`;

    // Target Standar di Kolom BW
    let bwDisplay = r.bw;
    if (isCheckpointDay && activeFlok.standar_mingguan) {
      const wKey = 'm' + (d / 7);
      const stdBW = activeFlok.standar_mingguan[wKey]?.std_bw_gram;
      if (stdBW) {
        if (r.bw !== '-') {
          const diff = Number(r.bw) - stdBW;
          const diffColor = diff >= 0 ? 'text-emerald-600' : 'text-amber-600';
          bwDisplay = `<strong>${r.bw}</strong><br><span class="text-[9px] text-slate-400 font-normal">Std ${stdBW}g <span class="${diffColor} font-bold">(${diff >= 0 ? '+' : ''}${diff})</span></span>`;
        } else {
          bwDisplay = `<span class="text-[10px] text-slate-400 italic">Target: ${stdBW}g</span>`;
        }
      }
    }

    htmlRows += `
      <tr class="${rowClass}" onclick="selectUmur(${d}); navigateTo('beranda');" title="Klik untuk edit hari ke-${d}">
        <td>${shortDate}</td>
        <td>${umurDisplay}</td>
        <td>${r.jenisPakan ? r.jenisPakan.split(' ')[0] : '-'}</td>
        <td>${r.pakanPakaiKg > 0 ? r.pakanPakaiKg : '-'}</td>
        <td>${r.pakanMasukKg > 0 ? r.pakanMasukKg : '-'}</td>
        <td>${r.sisaPakanKg.toLocaleString('id-ID')}</td>
        <td>${r.fi}</td>
        <td>${bwDisplay}</td>
        <td>${matiDisplay}</td>
        <td class="font-bold text-slate-900">${r.sisaAyam.toLocaleString('id-ID')}</td>
      </tr>
    `;
  }

  tbody.innerHTML = htmlRows;

  // Render Footer Rekap Mingguan & Row Komparasi Target Standar
  const avgFI = fiCount > 0 ? (sumFI / fiCount).toFixed(1) : '-';
  if (tfoot) {
    let targetRowHtml = '';
    if (currentWeekTab <= 4 && activeFlok.standar_mingguan) {
      const weekKey = 'm' + currentWeekTab;
      const targetUmur = currentWeekTab * 7;
      const defBW = [185, 475, 1020, 1650][currentWeekTab - 1];
      const defFCR = [0.90, 1.18, 1.38, 1.52][currentWeekTab - 1];
      const weekStd = activeFlok.standar_mingguan[weekKey] || { umur: targetUmur, std_bw_gram: defBW, std_fcr: defFCR };

      let actBWVal = lastBW !== '-' ? Number(lastBW) : null;
      let diffSign = '';
      let diffBadge = '';
      if (actBWVal !== null) {
        const diff = actBWVal - weekStd.std_bw_gram;
        diffSign = diff >= 0 ? `+${diff}g` : `${diff}g`;
        diffBadge = diff >= 0
          ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">🟢 Target Tercapai (${diffSign})</span>`
          : `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">🟡 Di Bawah Target (${diffSign})</span>`;
      } else {
        diffBadge = `<span class="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">⏳ Belum Sampling H-${targetUmur}</span>`;
      }

      targetRowHtml = `
        <tr class="bg-sky-50/90 text-slate-800 border-t border-sky-200 font-semibold text-[10px] sm:text-xs">
          <td colspan="3" class="text-left px-2 font-bold text-sky-900">🎯 Target Standar M${currentWeekTab} (H-${targetUmur}):</td>
          <td colspan="3" class="text-left text-slate-600">
            Target FCR: <strong class="text-slate-900">${Number(weekStd.std_fcr).toFixed(2)}</strong> 
            (Aktual Flok: <strong class="text-slate-900">${metrics.fcr}</strong>)
          </td>
          <td>-</td>
          <td class="font-bold text-sky-950">
            Std: ${weekStd.std_bw_gram}g
            ${actBWVal ? `<br><span class="text-[9px] ${actBWVal >= weekStd.std_bw_gram ? 'text-emerald-700' : 'text-amber-700'}">Aktual: ${actBWVal}g</span>` : ''}
          </td>
          <td colspan="2" class="text-center">
            ${diffBadge}
          </td>
        </tr>
      `;
    }

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
      ${targetRowHtml}
    `;
  }

  // Render Banner Komparasi Target Standar vs Aktual Minggu Aktif
  const stdTitle = document.getElementById('rekapStdTitle');
  const stdTargetText = document.getElementById('rekapStdTargetText');
  const stdActualText = document.getElementById('rekapStdActualText');

  if (activeFlok.standar_mingguan && stdTitle && stdTargetText && stdActualText) {
    if (currentWeekTab <= 4) {
      const weekKey = 'm' + currentWeekTab;
      const targetUmur = currentWeekTab * 7;
      const defBW = [185, 475, 1020, 1650][currentWeekTab - 1];
      const defFCR = [0.90, 1.18, 1.38, 1.52][currentWeekTab - 1];
      const weekStd = activeFlok.standar_mingguan[weekKey] || { umur: targetUmur, std_bw_gram: defBW, std_fcr: defFCR };

      stdTitle.innerText = `Target Standar Minggu ${currentWeekTab} (H-${targetUmur})`;
      stdTargetText.innerText = `Target Std: BW ${weekStd.std_bw_gram}g • FCR ${Number(weekStd.std_fcr).toFixed(2)}`;

      // Ambil sampling BW minggu ini, atau sampling terakhir s.d. minggu ini
      let actBW = null;
      if (lastBW !== '-') {
        actBW = Number(lastBW);
      } else {
        const prevLogsWithBW = dayRecords.slice(0, endDay).filter(r => r.hasLog && r.bw !== '-');
        if (prevLogsWithBW.length > 0) {
          actBW = Number(prevLogsWithBW[prevLogsWithBW.length - 1].bw);
        }
      }

      if (actBW) {
        const diffBW = actBW - Number(weekStd.std_bw_gram);
        const diffFormatted = diffBW >= 0 ? `+${diffBW}g 🟢` : `${diffBW}g 🟡`;
        stdActualText.innerHTML = `Aktual: Sampling BW <strong>${actBW}g</strong> (${diffFormatted}) • FCR <strong>${metrics.fcr}</strong>`;
      } else {
        stdActualText.innerHTML = `Aktual: Belum sampling BW • FCR <strong>${metrics.fcr}</strong>`;
      }
    } else {
      stdTitle.innerText = `Target Standar Minggu 5 (H-35 / Panen)`;
      stdTargetText.innerText = `Target Panen / Akhir Siklus`;
      stdActualText.innerHTML = `Aktual: BW <strong>${metrics.latestBW}g</strong> • FCR <strong>${metrics.fcr}</strong>`;
    }
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

// ================= PRESET STANDAR MINGGUAN =================
function applyPresetStd(preset) {
  if (preset === 'cobb') {
    if (document.getElementById('inputStdBW_M1')) document.getElementById('inputStdBW_M1').value = 185;
    if (document.getElementById('inputStdFCR_M1')) document.getElementById('inputStdFCR_M1').value = '0.90';
    if (document.getElementById('inputStdBW_M2')) document.getElementById('inputStdBW_M2').value = 475;
    if (document.getElementById('inputStdFCR_M2')) document.getElementById('inputStdFCR_M2').value = '1.18';
    if (document.getElementById('inputStdBW_M3')) document.getElementById('inputStdBW_M3').value = 1020;
    if (document.getElementById('inputStdFCR_M3')) document.getElementById('inputStdFCR_M3').value = '1.38';
    if (document.getElementById('inputStdBW_M4')) document.getElementById('inputStdBW_M4').value = 1650;
    if (document.getElementById('inputStdFCR_M4')) document.getElementById('inputStdFCR_M4').value = '1.52';
  } else if (preset === 'ross') {
    if (document.getElementById('inputStdBW_M1')) document.getElementById('inputStdBW_M1').value = 195;
    if (document.getElementById('inputStdFCR_M1')) document.getElementById('inputStdFCR_M1').value = '0.88';
    if (document.getElementById('inputStdBW_M2')) document.getElementById('inputStdBW_M2').value = 490;
    if (document.getElementById('inputStdFCR_M2')) document.getElementById('inputStdFCR_M2').value = '1.15';
    if (document.getElementById('inputStdBW_M3')) document.getElementById('inputStdBW_M3').value = 1050;
    if (document.getElementById('inputStdFCR_M3')) document.getElementById('inputStdFCR_M3').value = '1.35';
    if (document.getElementById('inputStdBW_M4')) document.getElementById('inputStdBW_M4').value = 1700;
    if (document.getElementById('inputStdFCR_M4')) document.getElementById('inputStdFCR_M4').value = '1.49';
  }
}

function applyPresetStdToEdit(preset) {
  if (preset === 'cobb') {
    if (document.getElementById('editStdBW_M1')) document.getElementById('editStdBW_M1').value = 185;
    if (document.getElementById('editStdFCR_M1')) document.getElementById('editStdFCR_M1').value = '0.90';
    if (document.getElementById('editStdBW_M2')) document.getElementById('editStdBW_M2').value = 475;
    if (document.getElementById('editStdFCR_M2')) document.getElementById('editStdFCR_M2').value = '1.18';
    if (document.getElementById('editStdBW_M3')) document.getElementById('editStdBW_M3').value = 1020;
    if (document.getElementById('editStdFCR_M3')) document.getElementById('editStdFCR_M3').value = '1.38';
    if (document.getElementById('editStdBW_M4')) document.getElementById('editStdBW_M4').value = 1650;
    if (document.getElementById('editStdFCR_M4')) document.getElementById('editStdFCR_M4').value = '1.52';
  } else if (preset === 'ross') {
    if (document.getElementById('editStdBW_M1')) document.getElementById('editStdBW_M1').value = 195;
    if (document.getElementById('editStdFCR_M1')) document.getElementById('editStdFCR_M1').value = '0.88';
    if (document.getElementById('editStdBW_M2')) document.getElementById('editStdBW_M2').value = 490;
    if (document.getElementById('editStdFCR_M2')) document.getElementById('editStdFCR_M2').value = '1.15';
    if (document.getElementById('editStdBW_M3')) document.getElementById('editStdBW_M3').value = 1050;
    if (document.getElementById('editStdFCR_M3')) document.getElementById('editStdFCR_M3').value = '1.35';
    if (document.getElementById('editStdBW_M4')) document.getElementById('editStdBW_M4').value = 1700;
    if (document.getElementById('editStdFCR_M4')) document.getElementById('editStdFCR_M4').value = '1.49';
  }
}

// ================= MODAL EDIT TARGET STANDAR =================
function openModalEditStandar() {
  if (!activeFlok) return;
  const std = activeFlok.standar_mingguan || {
    m1: { umur: 7, std_bw_gram: 185, std_fcr: 0.90 },
    m2: { umur: 14, std_bw_gram: 475, std_fcr: 1.18 },
    m3: { umur: 21, std_bw_gram: 1020, std_fcr: 1.38 },
    m4: { umur: 28, std_bw_gram: 1650, std_fcr: 1.52 }
  };

  if (document.getElementById('editStdBW_M1')) document.getElementById('editStdBW_M1').value = std.m1?.std_bw_gram || 185;
  if (document.getElementById('editStdFCR_M1')) document.getElementById('editStdFCR_M1').value = Number(std.m1?.std_fcr || 0.90).toFixed(2);
  if (document.getElementById('editStdBW_M2')) document.getElementById('editStdBW_M2').value = std.m2?.std_bw_gram || 475;
  if (document.getElementById('editStdFCR_M2')) document.getElementById('editStdFCR_M2').value = Number(std.m2?.std_fcr || 1.18).toFixed(2);
  if (document.getElementById('editStdBW_M3')) document.getElementById('editStdBW_M3').value = std.m3?.std_bw_gram || 1020;
  if (document.getElementById('editStdFCR_M3')) document.getElementById('editStdFCR_M3').value = Number(std.m3?.std_fcr || 1.38).toFixed(2);
  if (document.getElementById('editStdBW_M4')) document.getElementById('editStdBW_M4').value = std.m4?.std_bw_gram || 1650;
  if (document.getElementById('editStdFCR_M4')) document.getElementById('editStdFCR_M4').value = Number(std.m4?.std_fcr || 1.52).toFixed(2);

  const modal = document.getElementById('modalEditStandar');
  if (modal) modal.classList.remove('hidden');
}

function closeModalEditStandar() {
  const modal = document.getElementById('modalEditStandar');
  if (modal) modal.classList.add('hidden');
}

async function saveEditedStandar() {
  if (!activeFlok) return;

  const m1BW = parseFloat(document.getElementById('editStdBW_M1')?.value) || 185;
  const m1FCR = parseFloat(document.getElementById('editStdFCR_M1')?.value) || 0.90;
  const m2BW = parseFloat(document.getElementById('editStdBW_M2')?.value) || 475;
  const m2FCR = parseFloat(document.getElementById('editStdFCR_M2')?.value) || 1.18;
  const m3BW = parseFloat(document.getElementById('editStdBW_M3')?.value) || 1020;
  const m3FCR = parseFloat(document.getElementById('editStdFCR_M3')?.value) || 1.38;
  const m4BW = parseFloat(document.getElementById('editStdBW_M4')?.value) || 1650;
  const m4FCR = parseFloat(document.getElementById('editStdFCR_M4')?.value) || 1.52;

  activeFlok.standar_mingguan = {
    m1: { umur: 7, std_bw_gram: m1BW, std_fcr: m1FCR },
    m2: { umur: 14, std_bw_gram: m2BW, std_fcr: m2FCR },
    m3: { umur: 21, std_bw_gram: m3BW, std_fcr: m3FCR },
    m4: { umur: 28, std_bw_gram: m4BW, std_fcr: m4FCR }
  };

  try {
    await FlokioDB.saveFlok(activeFlok);
  } catch (err) {
    console.error('Gagal update standar mingguan:', err);
  }

  closeModalEditStandar();
  renderRekapTable();
  showToast('🎯 Target Standar 4 Minggu Berhasil Diperbarui!');
}

// ================= MODAL CHICK-IN FLOK BARU =================
function openModalChickin() {
  const nextNum = (activeFlok ? activeFlok.nomor_flok : 4) + 1;
  const inputNum = document.getElementById('inputFlokNumber');
  if (inputNum) inputNum.value = nextNum;

  const inputDate = document.getElementById('inputChickinDate');
  if (inputDate) inputDate.value = new Date().toISOString().split('T')[0];

  applyPresetStd('cobb');

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

  const m1BW = parseFloat(document.getElementById('inputStdBW_M1')?.value) || 185;
  const m1FCR = parseFloat(document.getElementById('inputStdFCR_M1')?.value) || 0.90;
  const m2BW = parseFloat(document.getElementById('inputStdBW_M2')?.value) || 475;
  const m2FCR = parseFloat(document.getElementById('inputStdFCR_M2')?.value) || 1.18;
  const m3BW = parseFloat(document.getElementById('inputStdBW_M3')?.value) || 1020;
  const m3FCR = parseFloat(document.getElementById('inputStdFCR_M3')?.value) || 1.38;
  const m4BW = parseFloat(document.getElementById('inputStdBW_M4')?.value) || 1650;
  const m4FCR = parseFloat(document.getElementById('inputStdFCR_M4')?.value) || 1.52;

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
    standar_mingguan: {
      m1: { umur: 7, std_bw_gram: m1BW, std_fcr: m1FCR },
      m2: { umur: 14, std_bw_gram: m2BW, std_fcr: m2FCR },
      m3: { umur: 21, std_bw_gram: m3BW, std_fcr: m3FCR },
      m4: { umur: 28, std_bw_gram: m4BW, std_fcr: m4FCR }
    },
    panen_jarang: [],
    panen_total: null
  };

  try {
    await FlokioDB.saveFlok(newFlok);
    await FlokioDB.clearDailyLogsByFlok(newFlokId);

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

  const inJarangTgl = document.getElementById('inputPanenJarangDate');
  if (inJarangTgl) inJarangTgl.value = todayStr;
  const inJarangUmur = document.getElementById('inputPanenJarangUmur');
  if (inJarangUmur) inJarangUmur.value = metrics.maxLoggedUmur || 28;
  const inJarangEkor = document.getElementById('inputPanenJarangEkor');
  if (inJarangEkor) inJarangEkor.value = Math.min(1000, Math.floor(metrics.sisaAyam * 0.3));

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

    let weightedUmur = 0;
    (activeFlok.panen_jarang || []).forEach(pj => {
      weightedUmur += (pj.umur_hari * pj.ekor);
    });
    weightedUmur += (umurTotal * ekorTotal);
    const avgUmurPanen = totalEkorTerpanen > 0 ? (weightedUmur / totalEkorTerpanen) : umurTotal;

    // FORMULA RESMI INDEKS PERFORMA (IP):
    let ipOfficial = 0;
    if (fcrFinal > 0 && avgUmurPanen > 0) {
      ipOfficial = Math.round(((livabilityPct * bobotRataRataKg) / (fcrFinal * avgUmurPanen)) * 100);
    }

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

    const kandang = await FlokioDB.getKandang(activeKandangId);
    if (kandang) {
      kandang.status = 'kosong';
      await FlokioDB.saveKandang(kandang);
    }

    closeModalPanen();
    renderAllViews();
    setRole(currentRole);

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

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flokio_backup_flok${activeFlok ? activeFlok.nomor_flok : '4'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

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
