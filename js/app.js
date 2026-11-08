/**
 * Flokio Main Application Logic
 * Menangani state, routing, manipulasi antarmuka, dan sinkronisasi data IndexedDB
 */

// Global State
let currentRole = 'kandang';    // 'kandang' | 'owner'
let currentDevice = 'phone';     // 'phone' | 'tablet'
let currentScreen = 'login';     // 'login' | 'beranda' | 'kandang' | 'rekap' | 'akun'
let isTodaySaved = false;
let kandang01Status = 'aktif';   // 'aktif' | 'kosong'
let currentFlokId = 'flok_k01_4';
let activeFlokNum = 4;
let tanggalChickin = '2024-10-05';
let sisaAyam = 4205;
let stokPakan = 800;
let pakanUnit = 'kg';
let currentWeekTab = 2; // Default Minggu 2

let currentPenjaga = {
  nama: 'Budi Santoso',
  wa: '081234567890'
};

// ================= INITIALIZATION & SERVICE WORKER =================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Daftarkan PWA Service Worker untuk Dukungan Offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] Service Worker terdaftar dengan scope:', reg.scope))
      .catch(err => console.warn('[PWA] Pendaftaran Service Worker gagal:', err));
  }

  // 2. Inisialisasi Database Lokal IndexedDB
  try {
    await FlokioDB.open();
    const savedPenjaga = await FlokioDB.getSetting('current_penjaga');
    if (savedPenjaga) {
      currentPenjaga.nama = savedPenjaga.nama;
      currentPenjaga.wa = savedPenjaga.wa;
      const inputNama = document.getElementById('loginOperatorNama');
      const inputWA = document.getElementById('loginOperatorWA');
      if (inputNama) inputNama.value = currentPenjaga.nama;
      if (inputWA) inputWA.value = currentPenjaga.wa;
    }
  } catch (e) {
    console.warn('[DB] Fallback memory mode aktif:', e);
  }

  // 3. Render Status Awal & Deteksi Ukuran Layar Otomatis
  updatePenjagaWAInfo();
  recalc();
  setRole('kandang');
  detectAndApplyDevice();
  navigateTo('login');
});

// ================= SCREEN NAVIGATION ROUTER =================
function navigateTo(screenName) {
  currentScreen = screenName;

  // Sembunyikan semua layar
  document.querySelectorAll('.screen-view').forEach(el => el.classList.add('hidden'));

  const badge = document.getElementById('activeScreenBadge');

  // Layar Login: Sembunyikan Header & Navigasi
  if (screenName === 'login') {
    document.getElementById('screenLogin').classList.remove('hidden');
    if (badge) badge.innerText = 'Layar: Login';
    document.getElementById('mainTopHeader').classList.add('hidden');
    document.getElementById('bottomNav').classList.add('hidden');
    if (currentDevice === 'tablet') {
      const sb = document.getElementById('sidebar');
      if (sb) {
        sb.classList.add('hidden');
        sb.classList.remove('flex');
      }
    }
    return;
  }

  // Layar Kerja: Aktifkan Header & Navigasi sesuai Device
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

  // Router Target
  if (screenName === 'beranda') {
    document.getElementById('screenBeranda').classList.remove('hidden');
    if (badge) badge.innerText = 'Layar: Beranda';
  } else if (screenName === 'kandang') {
    document.getElementById('screenKandang').classList.remove('hidden');
    if (badge) badge.innerText = 'Layar: Daftar Kandang';
  } else if (screenName === 'rekap') {
    // ROUTE GUARD: Lindungi Lembar Rekap Kertas hanya untuk Owner
    if (currentRole === 'kandang') {
      showToast('Akses Dibatasi: Lembar Rekap Kertas hanya wewenang Owner.');
      navigateTo('beranda');
      return;
    }
    document.getElementById('screenRekap').classList.remove('hidden');
    if (badge) badge.innerText = 'Layar: Lembar Rekap Fisik';
    renderRekapTable();
  } else if (screenName === 'akun') {
    document.getElementById('screenAkun').classList.remove('hidden');
    if (badge) badge.innerText = 'Layar: Akun & PIN';
  }

  // Update Navigasi
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

  // Jaminan Konsistensi Role: Lembar Rekap Kertas HANYA untuk Owner di Tablet
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
    updatePenjagaWAInfo();

    // Simpan ke IndexedDB
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
      updatePenjagaWAInfo();
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
  showToast('Sesi Berakhir: Anda telah keluar ke Layar Login');
}

// ================= ROLE & ACCESS CONTROL =================
function setRole(role) {
  currentRole = role;
  const btnKandang = document.getElementById('btnRoleKandang');
  const btnOwner = document.getElementById('btnRoleOwner');

  const homeCardOwner = document.getElementById('cardFlokOwnerActive');
  const homeCardOwnerEmpty = document.getElementById('cardFlokOwnerEmpty');
  const homeCardKandang = document.getElementById('cardFlokKandangActive');
  const cardKandangWorkerEmpty = document.getElementById('cardFlokKandangEmpty');

  const formInput = document.getElementById('sectionFormInput');
  const cardCatatanSaved = document.getElementById('cardCatatanSaved');
  const ownerAudit = document.getElementById('sectionOwnerAudit');
  const ownerAuditEmpty = document.getElementById('sectionOwnerAuditEmpty');

  const btnRekapHome = document.getElementById('btnNavRekapOwnerOnly');
  const sideNavRekap = document.getElementById('sideNavRekap');
  const sideOwnerGroup = document.getElementById('sideOwnerGroup');

  const topBadge = document.getElementById('topHeaderBadge');
  const sidebarRoleTag = document.getElementById('sidebarRoleTag');
  const sidebarUserLabel = document.getElementById('sidebarUserLabel');
  const sidebarSubLabel = document.getElementById('sidebarSubLabel');
  const akunNamaUser = document.getElementById('akunNamaUser');
  const akunRoleDesc = document.getElementById('akunRoleDesc');
  const akunAvatar = document.getElementById('akunAvatar');

  if (role === 'owner') {
    if (btnOwner) btnOwner.className = 'px-2.5 py-1 rounded-lg font-bold bg-white text-slate-900 shadow-xs transition-all';
    if (btnKandang) btnKandang.className = 'px-2.5 py-1 rounded-lg font-medium text-slate-500 hover:text-slate-900 transition-all';

    // Sembunyikan form input anak kandang
    if (formInput) formInput.classList.add('hidden');
    if (cardCatatanSaved) cardCatatanSaved.classList.add('hidden');
    if (homeCardKandang) homeCardKandang.classList.add('hidden');
    if (cardKandangWorkerEmpty) cardKandangWorkerEmpty.classList.add('hidden');

    // Tampilkan View Owner
    if (kandang01Status === 'kosong') {
      if (homeCardOwner) homeCardOwner.classList.add('hidden');
      if (homeCardOwnerEmpty) homeCardOwnerEmpty.classList.remove('hidden');
      if (ownerAudit) ownerAudit.classList.add('hidden');
      if (ownerAuditEmpty) ownerAuditEmpty.classList.remove('hidden');
    } else {
      if (homeCardOwner) homeCardOwner.classList.remove('hidden');
      if (homeCardOwnerEmpty) homeCardOwnerEmpty.classList.add('hidden');
      if (ownerAudit) ownerAudit.classList.remove('hidden');
      if (ownerAuditEmpty) ownerAuditEmpty.classList.add('hidden');
    }

    // Tampilkan Akses Khusus Owner
    if (btnRekapHome) {
      btnRekapHome.classList.remove('hidden');
      btnRekapHome.classList.add('flex');
    }
    if (sideNavRekap) {
      sideNavRekap.classList.remove('hidden');
      sideNavRekap.classList.add('flex');
    }
    if (sideOwnerGroup) sideOwnerGroup.classList.remove('hidden');

    const btnTambahKandang = document.getElementById('btnTambahKandangInScreen');
    if (btnTambahKandang) btnTambahKandang.classList.remove('hidden');

    const optK2 = document.getElementById('optKandang2Tablet');
    if (optK2) optK2.disabled = false;

    updatePenjagaWAInfo();

    // Labels
    if (topBadge) topBadge.innerText = '👑 Pak Haji (Owner)';
    if (sidebarRoleTag) sidebarRoleTag.innerText = 'Mode: Owner / Mandor';
    if (sidebarUserLabel) sidebarUserLabel.innerText = 'Pak Haji (Owner)';
    if (sidebarSubLabel) sidebarSubLabel.innerText = 'Pemilik Peternakan';
    if (akunNamaUser) akunNamaUser.innerText = 'Haji Rahmat (Owner)';
    if (akunRoleDesc) akunRoleDesc.innerText = 'Akses Penuh: Manajemen Kandang, Panen & Finansial';
    if (akunAvatar) akunAvatar.innerText = 'HR';
  } else {
    // Mode Anak Kandang
    if (btnKandang) btnKandang.className = 'px-2.5 py-1 rounded-lg font-bold bg-white text-slate-900 shadow-xs transition-all';
    if (btnOwner) btnOwner.className = 'px-2.5 py-1 rounded-lg font-medium text-slate-500 hover:text-slate-900 transition-all';

    // Sembunyikan semua kartu Owner
    if (homeCardOwner) homeCardOwner.classList.add('hidden');
    if (homeCardOwnerEmpty) homeCardOwnerEmpty.classList.add('hidden');
    if (ownerAudit) ownerAudit.classList.add('hidden');
    if (ownerAuditEmpty) ownerAuditEmpty.classList.add('hidden');

    // Tampilkan Tampilan Anak Kandang
    if (kandang01Status === 'kosong') {
      if (homeCardKandang) homeCardKandang.classList.add('hidden');
      if (cardKandangWorkerEmpty) cardKandangWorkerEmpty.classList.remove('hidden');
      if (formInput) formInput.classList.add('hidden');
      if (cardCatatanSaved) cardCatatanSaved.classList.add('hidden');
    } else {
      if (cardKandangWorkerEmpty) cardKandangWorkerEmpty.classList.add('hidden');
      if (homeCardKandang) homeCardKandang.classList.remove('hidden');
      if (isTodaySaved) {
        if (formInput) formInput.classList.add('hidden');
        if (cardCatatanSaved) cardCatatanSaved.classList.remove('hidden');
      } else {
        if (formInput) formInput.classList.remove('hidden');
        if (cardCatatanSaved) cardCatatanSaved.classList.add('hidden');
      }
    }

    // Sembunyikan Akses Owner
    if (btnRekapHome) {
      btnRekapHome.classList.add('hidden');
      btnRekapHome.classList.remove('flex');
    }
    if (sideNavRekap) {
      sideNavRekap.classList.add('hidden');
      sideNavRekap.classList.remove('flex');
    }
    if (sideOwnerGroup) sideOwnerGroup.classList.add('hidden');

    const btnTambahKandang = document.getElementById('btnTambahKandangInScreen');
    if (btnTambahKandang) btnTambahKandang.classList.add('hidden');

    const optK2 = document.getElementById('optKandang2Tablet');
    if (optK2) optK2.disabled = true;

    // Labels
    if (topBadge) topBadge.innerText = `👷 ${currentPenjaga.nama} (Penjaga)`;
    if (sidebarRoleTag) sidebarRoleTag.innerText = 'Mode: Penjaga Kandang';
    if (sidebarUserLabel) sidebarUserLabel.innerText = currentPenjaga.nama;
    if (sidebarSubLabel) sidebarSubLabel.innerText = 'Operator Kandang 01';
    if (akunNamaUser) akunNamaUser.innerText = currentPenjaga.nama;
    if (akunRoleDesc) akunRoleDesc.innerText = `Pekerja Lapangan (WA: ${currentPenjaga.wa})`;
    if (akunAvatar) akunAvatar.innerText = currentPenjaga.nama.substring(0, 2).toUpperCase();
  }

  // Jika sedang di layar Rekap saat berubah ke Anak Kandang, alihkan ke Beranda
  if (currentRole === 'kandang' && currentScreen === 'rekap') {
    navigateTo('beranda');
  } else {
    updateSidebarNavState(currentScreen);
  }
}

// ================= DEVICE CONTROLLER (HP VS TABLET - OTOMATIS) =================
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
    // Mode Tablet (Layar Lebar)
    shell.className = currentScreen === 'login'
      ? 'w-full max-w-md mx-auto flex-1 flex flex-col bg-white rounded-3xl shadow-xl min-h-[720px] my-auto border border-slate-200'
      : 'w-full max-w-5xl mx-auto flex-1 flex flex-row bg-white rounded-3xl shadow-xl min-h-[820px] my-4 overflow-hidden border border-slate-200';

    if (currentScreen === 'login') {
      if (sidebar) {
        sidebar.classList.add('hidden');
        sidebar.classList.remove('flex');
      }
    } else {
      if (sidebar) {
        sidebar.classList.remove('hidden');
        sidebar.classList.add('flex');
        updateSidebarNavState(currentScreen);
      }
    }
    if (bottomNav) bottomNav.classList.add('hidden');
  }
}

window.addEventListener('resize', () => {
  detectAndApplyDevice();
});

// ================= FORM INPUT & KALKULASI OPERASIONAL =================
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

  const currentPopulasi = Math.max(0, sisaAyam - mati);
  const fi = currentPopulasi > 0 ? ((pakanKg * 1000) / currentPopulasi).toFixed(1) : 0;

  const dispFI = document.getElementById('dispFI');
  if (dispFI) dispFI.innerText = `${fi} g/ekor`;

  // Update card badge
  const bMati = document.getElementById('badgeMatiHariIni');
  if (bMati) bMati.innerText = `${mati} Ekor`;
  const bPakan = document.getElementById('badgePakanHariIni');
  if (bPakan) bPakan.innerText = `${pakanKg} Kg`;

  // Update Owner Audit Card
  const oMati = document.getElementById('ownerViewMati');
  if (oMati) oMati.innerText = `${mati} Ekor`;
  const oPakan = document.getElementById('ownerViewPakan');
  if (oPakan) oPakan.innerText = `${pakanKg} Kg (B11A)`;
  const oFI = document.getElementById('ownerViewFI');
  if (oFI) oFI.innerText = `${fi} g/ekor`;
}

function updateCatatanLive(val) {
  const clean = val.trim() || 'Aman terkendali.';
  const elOwner = document.getElementById('ownerViewCatatan');
  if (elOwner) elOwner.innerText = `"${clean}"`;
  const elSaved = document.getElementById('savedCatatanSummary');
  if (elSaved) elSaved.innerText = `"${clean}"`;
}

function updatePenjagaWAInfo() {
  let rawWA = (currentPenjaga.wa || '081234567890').trim();
  let cleanWA = rawWA.replace(/[^0-9]/g, '');
  if (cleanWA.startsWith('0')) {
    cleanWA = '62' + cleanWA.substring(1);
  } else if (!cleanWA.startsWith('62')) {
    cleanWA = '62' + cleanWA;
  }

  const btnWA = document.getElementById('btnOwnerChatWA');
  if (btnWA) {
    const textMsg = encodeURIComponent(`Halo Penjaga (${currentPenjaga.nama}), saya sudah cek laporan harian Kandang 01 H-16. Kondisi aman dan terkendali.`);
    btnWA.href = `https://wa.me/${cleanWA}?text=${textMsg}`;
  }
  const opName = document.getElementById('ownerViewOperatorName');
  if (opName) opName.innerText = currentPenjaga.nama;
  const opWA = document.getElementById('ownerViewOperatorWA');
  if (opWA) opWA.innerText = currentPenjaga.wa;
}

async function simpanLog() {
  isTodaySaved = true;
  const mati = parseInt(document.getElementById('inputMati').value) || 6;
  let pakanVal = parseFloat(document.getElementById('inputPakan').value) || 350;
  const pakanKg = pakanUnit === 'sak' ? pakanVal * 50 : pakanVal;
  const jenis = document.getElementById('inputJenisPakan').value;
  const catatan = (document.getElementById('inputCatatanHarian').value || '').trim() || 'Aman terkendali.';

  document.getElementById('savedMatiSummary').innerText = `${mati} Ekor`;
  document.getElementById('savedPakanSummary').innerText = `${pakanKg} Kg (${jenis})`;
  document.getElementById('savedCatatanSummary').innerText = `"${catatan}"`;
  document.getElementById('ownerViewCatatan').innerText = `"${catatan}"`;

  document.getElementById('sectionFormInput').classList.add('hidden');
  document.getElementById('cardCatatanSaved').classList.remove('hidden');

  // Simpan ke IndexedDB
  try {
    await FlokioDB.saveDailyLog({
      id: `log_f4_h16`,
      flok_id: currentFlokId,
      umur_hari: 16,
      tanggal: document.getElementById('inputTanggalRecord')?.value || '2024-10-21',
      kematian_ekor: mati,
      afkir_ekor: 0,
      pakan_jenis: jenis,
      pakan_pakai_kg: pakanKg,
      pakan_masuk_kg: parseFloat(document.getElementById('inputPakanMasuk')?.value) || 0,
      bw_sampling_gram: parseFloat(document.getElementById('inputBW')?.value) || null,
      sisa_ayam_terhitung: sisaAyam - mati,
      sisa_stok_pakan_kg: stokPakan,
      catatan: catatan,
      diinput_oleh: currentPenjaga.nama,
      waktu_input: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Gagal simpan ke IndexedDB:', e);
  }

  showToast('Catatan Harian Berhasil Disimpan & Tersinkron!');
}

function unlockEditForm() {
  isTodaySaved = false;
  document.getElementById('sectionFormInput').classList.remove('hidden');
  document.getElementById('cardCatatanSaved').classList.add('hidden');
  showToast('Form Terbuka Kembali: Silakan koreksi dan simpan ulang.');
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

  if (m === 2) {
    document.getElementById('viewMinggu2').classList.remove('hidden');
    document.getElementById('viewMingguOther').classList.add('hidden');
  } else {
    document.getElementById('viewMinggu2').classList.add('hidden');
    document.getElementById('viewMingguOther').classList.remove('hidden');
    document.getElementById('emptyWeekText').innerText = `Data Rekapitulasi Minggu ke-${m} (Hari ${getWeekDayRange(m)})`;
    showToast(`Minggu ke-${m} belum berjalan (Flok saat ini di Hari ke-16 / Minggu 3).`);
  }
}

function getWeekDayRange(m) {
  if (m === 1) return 'H1 s.d H7';
  if (m === 2) return 'H8 s.d H14';
  if (m === 3) return 'H15 s.d H21';
  if (m === 4) return 'H22 s.d H28';
  return 'H29 s.d H35';
}

function renderRekapTable() {
  // Pastikan render tabel minggu aktif
  switchWeek(currentWeekTab);
}

// ================= WHATSAPP REPORT GENERATOR =================
function previewWA() {
  const mati = document.getElementById('inputMati')?.value || 6;
  let pakanVal = parseFloat(document.getElementById('inputPakan')?.value) || 350;
  const pakanKg = pakanUnit === 'sak' ? pakanVal * 50 : pakanVal;
  const jenis = document.getElementById('inputJenisPakan')?.value || 'B11A';
  const fi = document.getElementById('dispFI')?.innerText || '83.2 g/ekor';
  const catatan = (document.getElementById('inputCatatanHarian')?.value || '').trim() || 'Aman terkendali.';

  const txt = 
`*LAPORAN RECORDING HARIAN BROILER*
Kandang: Kandang 01 (Flok #4)
Hari/Tgl: H-16 (Senin, 21 Okt 2024)
Pengirim: ${currentRole === 'owner' ? 'Pak Haji (Owner)' : (currentPenjaga.nama + ' (Penjaga)')}
-----------------------------------
• Kematian/Afkir : ${mati} ekor
• Pakan Pakai    : ${pakanKg} kg (${jenis})
• Feed Intake    : ${fi}
• Catatan Kondisi: "${catatan}"`;

  document.getElementById('textWAPreview').innerText = txt;
  document.getElementById('modalWA').classList.remove('hidden');
}

function closeModalWA() {
  document.getElementById('modalWA').classList.add('hidden');
}

function copyWA() {
  navigator.clipboard.writeText(document.getElementById('textWAPreview').innerText);
  showToast('Teks Laporan Berhasil Disalin!');
  closeModalWA();
}

// ================= MODAL HELPERS =================
function openModalChickin(newFlokNum = null) {
  if (newFlokNum) {
    document.getElementById('inputFlokNumber').value = newFlokNum;
  }
  document.getElementById('modalChickin').classList.remove('hidden');
}

function closeModalChickin() {
  document.getElementById('modalChickin').classList.add('hidden');
}

function submitChickin() {
  const flokNum = document.getElementById('inputFlokNumber').value;
  activeFlokNum = parseInt(flokNum) || 5;
  kandang01Status = 'aktif';
  closeModalChickin();
  setRole(currentRole);
  showToast(`Siklus Flok #${activeFlokNum} Berhasil Dimulai! Kandang Aktif.`);
}

function openModalPanen() {
  document.getElementById('modalPanen').classList.remove('hidden');
}

function closeModalPanen() {
  document.getElementById('modalPanen').classList.add('hidden');
}

function setPanenType(type) {
  const btnJarang = document.getElementById('btnPanenJarang');
  const btnTotal = document.getElementById('btnPanenTotal');
  const warning = document.getElementById('warningPanenTotal');

  if (type === 'jarang') {
    btnJarang.className = 'flex-1 py-2 font-bold rounded-lg bg-white text-slate-800 shadow-xs border border-slate-200';
    btnTotal.className = 'flex-1 py-2 font-medium rounded-lg text-slate-500 hover:text-slate-800';
    warning.classList.add('hidden');
  } else {
    btnTotal.className = 'flex-1 py-2 font-bold rounded-lg bg-rose-50 text-rose-800 shadow-xs border border-rose-300';
    btnJarang.className = 'flex-1 py-2 font-medium rounded-lg text-slate-500 hover:text-slate-800';
    warning.classList.remove('hidden');
  }
}

function submitPanen() {
  closeModalPanen();
  kandang01Status = 'kosong';
  setRole(currentRole);
  showToast('Panen Total Berhasil Dicatat! Kandang 01 masuk Masa Sanitasi.');
}

function openModalTambahKandang() {
  document.getElementById('modalTambahKandang').classList.remove('hidden');
}

function closeModalTambahKandang() {
  document.getElementById('modalTambahKandang').classList.add('hidden');
}

function submitTambahKandang() {
  closeModalTambahKandang();
  showToast('Master Gedung Berhasil Didaftarkan!');
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
  }, 2600);
}
