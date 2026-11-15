/**
 * WARUNGKU POS - BUKU KAS HARIAN (OPERATIONAL CASHBOOK COMPONENT)
 * Mengelola arus pergerakan uang riil kas toko secara kronologis per hari:
 * - Pemilihan tanggal (Date navigation: kalender, Hari Ini, Prev/Next)
 * - Saldo Awal, Total Masuk (Penjualan + Modal Lain), Total Keluar (Belanja Stok + Beban Operasional), Saldo Akhir
 * - Rincian kanal pembayaran: Kas Tunai Laci, Rekening Bank, QRIS/E-Wallet
 * - Pencatatan Uang Masuk (Modal Tambahan, dll) & Uang Keluar (Beban operasional/belanja)
 * - Anti-duplikasi: Terkoneksi otomatis dengan transaksi penjualan kasir (reference = trx.id)
 */

let cashbookSelectedDate = getLocalDateKey(new Date());
let cashbookTypeFilter = 'all'; // 'all' | 'in' | 'out'
let cashbookMethodFilter = 'all'; // 'all' | 'cash' | 'bank' | 'qris'
let cashbookSearchQuery = '';

function setCashbookDate(newDateStr) {
  if (!newDateStr) return;
  cashbookSelectedDate = newDateStr;
  window.renderApp();
}

function shiftCashbookDate(deltaDays) {
  try {
    const parts = (cashbookSelectedDate || getLocalDateKey(new Date())).split('-');
    const curDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    curDate.setDate(curDate.getDate() + deltaDays);
    cashbookSelectedDate = getLocalDateKey(curDate);
    window.renderApp();
  } catch (e) {
    cashbookSelectedDate = getLocalDateKey(new Date());
    window.renderApp();
  }
}

function renderAdminCashbook(embedded = false) {
  const store = window.store;
  const targetDateKey = cashbookSelectedDate || getLocalDateKey(new Date());

  // Format tanggal ramah bahasa Indonesia
  let dateDisplay = targetDateKey;
  try {
    const parts = targetDateKey.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    dateDisplay = d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) {}

  const allCashEntries = store.dailyCashbook || [];

  // 1. Hitung Saldo Awal: akumulasi seluruh mutasi kas aktif sebelum tanggal terpilih
  const priorActiveEntries = allCashEntries.filter(e => {
    if (e.status === 'void') return false;
    const entryDateKey = getLocalDateKey(e.date);
    return entryDateKey < targetDateKey;
  });

  const priorIn = priorActiveEntries.filter(e => e.type === 'in').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const priorOut = priorActiveEntries.filter(e => e.type === 'out').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const openingBalance = priorIn - priorOut; // Tetap menghitung utang/minus tanpa Math.max(0)

  // Saldo awal per masing-masing kanal pembayaran
  const priorCashIn = priorActiveEntries.filter(e => e.type === 'in' && e.method === 'cash').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const priorCashOut = priorActiveEntries.filter(e => e.type === 'out' && e.method === 'cash').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const openingCash = priorCashIn - priorCashOut;

  const priorBankIn = priorActiveEntries.filter(e => e.type === 'in' && (e.method === 'bank' || e.method === 'transfer')).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const priorBankOut = priorActiveEntries.filter(e => e.type === 'out' && (e.method === 'bank' || e.method === 'transfer')).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const openingBank = priorBankIn - priorBankOut;

  const priorQrisIn = priorActiveEntries.filter(e => e.type === 'in' && e.method === 'qris').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const priorQrisOut = priorActiveEntries.filter(e => e.type === 'out' && e.method === 'qris').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const openingQris = priorQrisIn - priorQrisOut;

  // 2. Data mutasi kas pada hari terpilih
  const currentDayEntries = allCashEntries.filter(e => {
    const entryDateKey = getLocalDateKey(e.date);
    return entryDateKey === targetDateKey;
  });

  // Filter tampilan berdasarkan tipe, metode, dan pencarian
  const filteredEntries = currentDayEntries.filter(e => {
    const matchType = cashbookTypeFilter === 'all' || e.type === cashbookTypeFilter;
    let matchMethod = true;
    if (cashbookMethodFilter === 'cash') matchMethod = e.method === 'cash';
    else if (cashbookMethodFilter === 'bank') matchMethod = e.method === 'bank' || e.method === 'transfer';
    else if (cashbookMethodFilter === 'qris') matchMethod = e.method === 'qris';

    const q = cashbookSearchQuery.toLowerCase().trim();
    const matchSearch = !q ||
      (e.description && e.description.toLowerCase().includes(q)) ||
      (e.category && e.category.toLowerCase().includes(q)) ||
      (e.reference && e.reference.toLowerCase().includes(q)) ||
      (e.user && e.user.toLowerCase().includes(q));

    return matchType && matchMethod && matchSearch;
  });

  // Hitung total ringkasan hari ini (hanya yang statusnya aktif / bukan void)
  const activeDayEntries = currentDayEntries.filter(e => e.status !== 'void');

  const inEntries = activeDayEntries.filter(e => e.type === 'in');
  const outEntries = activeDayEntries.filter(e => e.type === 'out');

  const totalIn = inEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalOut = outEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const closingBalance = openingBalance + totalIn - totalOut;

  // Breakdown kanal pembayaran hari ini
  const cashIn = inEntries.filter(e => e.method === 'cash').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const cashOut = outEntries.filter(e => e.method === 'cash').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const cashNet = cashIn - cashOut;
  const cashClosing = openingCash + cashNet;

  const bankIn = inEntries.filter(e => e.method === 'bank' || e.method === 'transfer').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const bankOut = outEntries.filter(e => e.method === 'bank' || e.method === 'transfer').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const bankNet = bankIn - bankOut;
  const bankClosing = openingBank + bankNet;

  const qrisIn = inEntries.filter(e => e.method === 'qris').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const qrisOut = outEntries.filter(e => e.method === 'qris').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const qrisNet = qrisIn - qrisOut;
  const qrisClosing = openingQris + qrisNet;

  const isToday = targetDateKey === getLocalDateKey(new Date());

  const topHeaderHTML = `
      <!-- Top Actions Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <i data-lucide="coins" class="w-6 h-6 text-emerald-600 dark:text-emerald-400"></i>
            <span>Buku Kas Harian (Arus Kas Toko)</span>
          </h2>
          <p class="text-xs text-slate-400 mt-0.5">
            Pencatatan saldo awal, uang masuk riil kasir/modal, pengeluaran operasional toko, dan saldo kas laci secara kronologis.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Button: Add Income -->
          <button 
            type="button"
            onclick="openAddCashbookIncomeModal()"
            class="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20 active:scale-95 transition"
          >
            <i data-lucide="arrow-down-left" class="w-4 h-4"></i>
            <span>Catat Uang Masuk</span>
          </button>

          <!-- Button: Add Expense -->
          <button 
            type="button"
            onclick="openAddCashbookExpenseModal()"
            class="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-rose-600/20 active:scale-95 transition"
          >
            <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
            <span>Catat Uang Keluar</span>
          </button>
        </div>
      </div>
  `;

  return `
    <div class="${embedded ? 'space-y-6' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-8'}">
      
      ${embedded ? '' : topHeaderHTML}

      <!-- Date Navigation Banner -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="flex items-center space-x-2 w-full sm:w-auto">
          <div class="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
            <i data-lucide="calendar" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tanggal Kas Terpilih:</div>
            <div class="font-extrabold text-slate-800 dark:text-white text-sm sm:text-base">${escapeHtml(dateDisplay)}</div>
          </div>
        </div>

        <div class="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <button 
            type="button"
            onclick="shiftCashbookDate(-1)"
            class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 transition"
            title="Hari Sebelumnya"
          >
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
          </button>

          <input 
            type="date"
            value="${escapeHtml(targetDateKey)}"
            onchange="setCashbookDate(this.value)"
            class="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <button 
            type="button"
            onclick="shiftCashbookDate(1)"
            class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 transition"
            title="Hari Berikutnya"
          >
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </button>

          <button 
            type="button"
            onclick="setCashbookDate('${getLocalDateKey(new Date())}')"
            class="px-3 py-2 rounded-xl text-xs font-bold transition ${
              isToday 
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/40' 
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }"
          >
            Hari Ini
          </button>
        </div>
      </div>

      <!-- Main Financial Summary Cards (Saldo Awal, Masuk, Keluar, Saldo Akhir) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <!-- Saldo Awal -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm relative overflow-hidden">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Saldo Awal Kas</span>
            <div class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
              <i data-lucide="landmark" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="text-2xl font-black text-slate-900 dark:text-white font-mono">${formatRupiah(openingBalance)}</div>
          <p class="text-[11px] text-slate-400 mt-1">Akumulasi saldo kas sebelum hari ini</p>
        </div>

        <!-- Total Uang Masuk -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-emerald-200/60 dark:border-emerald-900/40 p-5 shadow-sm relative overflow-hidden bg-gradient-to-br from-emerald-50/20 via-transparent to-transparent">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">(+) Total Uang Masuk</span>
            <div class="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
              <i data-lucide="arrow-down-left" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">${formatRupiah(totalIn)}</div>
          <p class="text-[11px] text-slate-400 mt-1">Penjualan + Modal Tambahan / Lainnya</p>
        </div>

        <!-- Total Uang Keluar -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-rose-200/60 dark:border-rose-900/40 p-5 shadow-sm relative overflow-hidden bg-gradient-to-br from-rose-50/20 via-transparent to-transparent">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">(-) Total Uang Keluar</span>
            <div class="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center">
              <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">-${formatRupiah(totalOut)}</div>
          <p class="text-[11px] text-slate-400 mt-1">Belanja Stok + Beban Operasional</p>
        </div>

        <!-- Saldo Kas Akhir -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl border-2 border-indigo-500/40 dark:border-indigo-500/30 p-5 shadow-sm relative overflow-hidden bg-gradient-to-br from-indigo-50/30 via-transparent to-transparent">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">(=) Saldo Kas Akhir</span>
            <div class="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
              <i data-lucide="wallet-cards" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">${formatRupiah(closingBalance)}</div>
          <p class="text-[11px] text-slate-400 mt-1">Saldo Awal + Masuk - Keluar</p>
        </div>

      </div>

      <!-- Payment Channels Breakdown (Kas Tunai Fisik Laci, Bank Transfer, QRIS) -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <h3 class="font-bold text-sm text-slate-800 dark:text-white flex items-center space-x-2">
            <i data-lucide="layers" class="w-4 h-4 text-emerald-600"></i>
            <span>Rincian Arus Kas Berdasarkan Jalur Pembayaran (Hari Ini)</span>
          </h3>
          <span class="text-[11px] text-slate-400">Pemisahan fisik kas laci & saldo digital</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <!-- Kas Tunai (Laci Kasir) -->
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
                <i data-lucide="banknote" class="w-4 h-4 text-emerald-500"></i>
                <span>Kas Tunai (Laci Fisik)</span>
              </span>
              <span class="text-xs font-mono font-extrabold ${cashClosing >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}">
                ${formatRupiah(cashClosing)}
              </span>
            </div>
            <div class="text-[10px] text-slate-400 flex flex-wrap justify-between pt-1 border-t border-slate-200 dark:border-slate-700/40 gap-1">
              <span>Awal: <b>${formatRupiah(openingCash)}</b></span>
              <span>Masuk: <b class="text-emerald-600">+${formatRupiah(cashIn)}</b></span>
              <span>Keluar: <b class="text-rose-600">-${formatRupiah(cashOut)}</b></span>
            </div>
          </div>

          <!-- Rekening Bank / Transfer -->
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
                <i data-lucide="credit-card" class="w-4 h-4 text-blue-500"></i>
                <span>Rekening Bank / Transfer</span>
              </span>
              <span class="text-xs font-mono font-extrabold ${bankClosing >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600'}">
                ${formatRupiah(bankClosing)}
              </span>
            </div>
            <div class="text-[10px] text-slate-400 flex flex-wrap justify-between pt-1 border-t border-slate-200 dark:border-slate-700/40 gap-1">
              <span>Awal: <b>${formatRupiah(openingBank)}</b></span>
              <span>Masuk: <b class="text-blue-600">+${formatRupiah(bankIn)}</b></span>
              <span>Keluar: <b class="text-rose-600">-${formatRupiah(bankOut)}</b></span>
            </div>
          </div>

          <!-- QRIS / E-Wallet -->
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
                <i data-lucide="qr-code" class="w-4 h-4 text-purple-500"></i>
                <span>QRIS & Digital Wallet</span>
              </span>
              <span class="text-xs font-mono font-extrabold ${qrisClosing >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-rose-600'}">
                ${formatRupiah(qrisClosing)}
              </span>
            </div>
            <div class="text-[10px] text-slate-400 flex flex-wrap justify-between pt-1 border-t border-slate-200 dark:border-slate-700/40 gap-1">
              <span>Awal: <b>${formatRupiah(openingQris)}</b></span>
              <span>Masuk: <b class="text-purple-600">+${formatRupiah(qrisIn)}</b></span>
              <span>Keluar: <b class="text-rose-600">-${formatRupiah(qrisOut)}</b></span>
            </div>
          </div>

        </div>
      </div>

      <!-- Filters & Table of Daily Cash Mutations -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        
        <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select 
            onchange="cashbookTypeFilter = this.value; window.renderApp();"
            class="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-bold focus:outline-none"
          >
            <option value="all" ${cashbookTypeFilter === 'all' ? 'selected' : ''}>Semua Tipe Kas</option>
            <option value="in" ${cashbookTypeFilter === 'in' ? 'selected' : ''}>🟢 Uang Masuk (+)</option>
            <option value="out" ${cashbookTypeFilter === 'out' ? 'selected' : ''}>🔴 Uang Keluar (-)</option>
          </select>

          <select 
            onchange="cashbookMethodFilter = this.value; window.renderApp();"
            class="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-bold focus:outline-none"
          >
            <option value="all" ${cashbookMethodFilter === 'all' ? 'selected' : ''}>Semua Metode</option>
            <option value="cash" ${cashbookMethodFilter === 'cash' ? 'selected' : ''}>💵 Tunai (Cash)</option>
            <option value="bank" ${cashbookMethodFilter === 'bank' ? 'selected' : ''}>🏦 Bank Transfer</option>
            <option value="qris" ${cashbookMethodFilter === 'qris' ? 'selected' : ''}>📱 QRIS / E-Wallet</option>
          </select>
        </div>

        <div class="relative w-full sm:w-72">
          <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"></i>
          <input 
            type="text" 
            placeholder="Cari transaksi / keterangan kas..."
            value="${escapeHtml(cashbookSearchQuery)}"
            oninput="cashbookSearchQuery = this.value; window.debouncedRenderApp();"
            class="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

      </div>

      <!-- Cash Mutations Table -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="py-3.5 px-4">Waktu</th>
                <th class="py-3.5 px-4">Tipe Kas</th>
                <th class="py-3.5 px-4">Kategori</th>
                <th class="py-3.5 px-4">Keterangan / Referensi</th>
                <th class="py-3.5 px-4">Metode</th>
                <th class="py-3.5 px-4 text-right">Nominal (Rp)</th>
                <th class="py-3.5 px-4">Operator</th>
                <th class="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              ${filteredEntries.length > 0 ? filteredEntries.map(e => {
                const isVoid = e.status === 'void';
                const isIn = e.type === 'in';
                const isFromTrx = Boolean(e.reference && e.reference.startsWith('TRX'));
                const timeStr = e.date ? formatTimeOnly(e.date) : '-';

                const methodBadge = {
                  cash: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">Tunai</span>',
                  bank: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">Bank</span>',
                  transfer: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">Bank</span>',
                  qris: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">QRIS</span>'
                }[e.method] || `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">${escapeHtml(e.method || 'cash')}</span>`;

                return `
                  <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${isVoid ? 'opacity-60 bg-rose-50/20 dark:bg-rose-950/10' : ''}">
                    <td class="py-3 px-4 font-mono text-slate-500">${escapeHtml(timeStr)}</td>
                    <td class="py-3 px-4">
                      ${isIn ? `
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <i data-lucide="arrow-down-left" class="w-3 h-3 mr-1"></i> Masuk
                        </span>
                      ` : `
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          <i data-lucide="arrow-up-right" class="w-3 h-3 mr-1"></i> Keluar
                        </span>
                      `}
                      ${isVoid ? `<span class="ml-1 px-1.5 py-0.2 rounded bg-rose-200 text-rose-800 dark:bg-rose-900 text-[9px] font-extrabold">VOID</span>` : ''}
                    </td>
                    <td class="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      ${escapeHtml(e.category || '-')}
                    </td>
                    <td class="py-3 px-4">
                      <div>${escapeHtml(e.description || '-')}</div>
                      ${e.reference ? `<div class="text-[10px] text-slate-400 font-mono">Ref: ${escapeHtml(e.reference)}</div>` : ''}
                    </td>
                    <td class="py-3 px-4">${methodBadge}</td>
                    <td class="py-3 px-4 text-right font-mono font-bold ${isVoid ? 'line-through text-slate-400' : (isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}">
                      ${isIn ? '+' : '-'}${formatRupiah(e.amount)}
                    </td>
                    <td class="py-3 px-4 text-slate-500">${escapeHtml(e.user || 'Admin')}</td>
                    <td class="py-3 px-4 text-center">
                      ${!isVoid && store.currentRole === 'admin' ? `
                        ${isFromTrx ? `
                          <button 
                            type="button" 
                            onclick="navigate('admin-transactions')" 
                            class="px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                            title="Buka menu Transaksi untuk void struk dan mengembalikan stok otomatis"
                          >
                            Lihat Struk
                          </button>
                        ` : `
                          <button 
                            type="button" 
                            onclick="promptVoidCashbookEntry('${escapeHtml(e.id)}')" 
                            class="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title="Batalkan (Void) Mutasi Kas Ini"
                          >
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                          </button>
                        `}
                      ` : '-'}
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="8" class="py-12 text-center text-slate-400">
                    <div class="max-w-xs mx-auto space-y-2">
                      <div class="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                        <i data-lucide="inbox" class="w-5 h-5"></i>
                      </div>
                      <p class="font-bold text-slate-600 dark:text-slate-300">Belum Ada Catatan Kas Pada Tanggal Ini</p>
                      <p class="text-xs">Uang masuk dari penjualan kasir otomatis masuk ke sini, atau klik tombol di atas untuk mencatat modal/biaya operasional.</p>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

function formatTimeOnly(isoString) {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '-';
  }
}

// ==================== MODALS FOR CASHBOOK ====================

function openAddCashbookIncomeModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center space-x-2.5">
            <div class="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
              <i data-lucide="arrow-down-left" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="font-bold text-base text-slate-800 dark:text-white">Catat Uang Masuk</h3>
              <p class="text-xs text-slate-400">Modal tambahan, suntikan dana kasir, atau pemasukan lain</p>
            </div>
          </div>
          <button onclick="closeModal()" class="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <form onsubmit="handleSaveCashbookIncome(event)" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Nominal Uang Masuk (Rp) *</label>
            <input 
              type="number" 
              id="csh-in-amount" 
              placeholder="Contoh: 100000" 
              required 
              min="100"
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Kategori Pemasukan *</label>
            <select 
              id="csh-in-category" 
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="Modal Tambahan">Modal Tambahan (Dari Pemilik / Kasir Awal)</option>
              <option value="Pemasukan Lain">Pemasukan Lain-lain</option>
              <option value="Pelunasan Kasbon">Pelunasan Kasbon / Piutang</option>
              <option value="Pendapatan Jasa">Pendapatan Jasa / Komisi</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Metode Penerimaan *</label>
            <select 
              id="csh-in-method" 
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="cash">💵 Tunai (Kas Fisik Laci)</option>
              <option value="bank">🏦 Rekening Bank / Transfer</option>
              <option value="qris">📱 QRIS / E-Wallet</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Keterangan Catatan *</label>
            <input 
              type="text" 
              id="csh-in-desc" 
              placeholder="Contoh: Tambahan uang kembalian kasir dari bos" 
              required
              class="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
            />
          </div>

          <div class="pt-2 flex items-center justify-end space-x-2">
            <button 
              type="button" 
              onclick="closeModal()" 
              class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button 
              type="submit" 
              class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition"
            >
              Simpan Uang Masuk
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();
  setTimeout(() => {
    const el = document.getElementById('csh-in-amount');
    if (el) el.focus();
  }, 50);
}

async function handleSaveCashbookIncome(event) {
  event.preventDefault();
  const store = window.store;

  const amount = Number(document.getElementById('csh-in-amount').value) || 0;
  const category = document.getElementById('csh-in-category').value;
  const method = document.getElementById('csh-in-method').value;
  const description = document.getElementById('csh-in-desc').value.trim();

  if (amount <= 0 || !description) {
    alert('Harap isi nominal dan keterangan dengan benar.');
    return;
  }

  const payload = {
    date: getLocalISOString(),
    type: 'in',
    category,
    method,
    description,
    amount,
    user: store.cashierName || 'Admin'
  };

  const res = await store.addCashbookEntry(payload);
  if (res.success) {
    closeModal();
    window.renderApp();
    store.showRealtimeToast(`✅ Uang masuk ${formatRupiah(amount)} berhasil dicatat di buku kas.`);
  } else {
    alert(res.error || 'Gagal menyimpan catatan kas.');
  }
}

function openAddCashbookExpenseModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center space-x-2.5">
            <div class="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center">
              <i data-lucide="arrow-up-right" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="font-bold text-base text-slate-800 dark:text-white">Catat Uang Keluar</h3>
              <p class="text-xs text-slate-400">Belanja stok barang, listrik, gaji, atau beban operasional</p>
            </div>
          </div>
          <button onclick="closeModal()" class="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <form onsubmit="handleSaveCashbookExpense(event)" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Nominal Pengeluaran (Rp) *</label>
            <input 
              type="number" 
              id="csh-out-amount" 
              placeholder="Contoh: 50000" 
              required 
              min="100"
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Kategori Beban *</label>
            <select 
              id="csh-out-category" 
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="Stok Barang">Stok Barang (Restock Kulakan)</option>
              <option value="Operasional">Operasional & Plastik/ATK</option>
              <option value="Listrik & Air">Listrik & Air Toko</option>
              <option value="Gaji Karyawan">Gaji / Uang Makan Karyawan</option>
              <option value="Sewa Tempat">Sewa Tempat / Kebersihan</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Diambil Dari Saldo *</label>
            <select 
              id="csh-out-method" 
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="cash">💵 Kas Tunai (Laci Fisik)</option>
              <option value="bank">🏦 Rekening Bank / Transfer</option>
              <option value="qris">📱 QRIS / E-Wallet</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Keterangan Keperluan *</label>
            <input 
              type="text" 
              id="csh-out-desc" 
              placeholder="Contoh: Beli es batu kristal 3 karung" 
              required
              class="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
            />
          </div>

          <div class="pt-2 flex items-center justify-end space-x-2">
            <button 
              type="button" 
              onclick="closeModal()" 
              class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button 
              type="submit" 
              class="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 active:scale-95 transition"
            >
              Simpan Pengeluaran
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();
  setTimeout(() => {
    const el = document.getElementById('csh-out-amount');
    if (el) el.focus();
  }, 50);
}

async function handleSaveCashbookExpense(event) {
  event.preventDefault();
  const store = window.store;

  const amount = Number(document.getElementById('csh-out-amount').value) || 0;
  const category = document.getElementById('csh-out-category').value;
  const method = document.getElementById('csh-out-method').value;
  const description = document.getElementById('csh-out-desc').value.trim();

  if (amount <= 0 || !description) {
    alert('Harap isi nominal dan keterangan dengan benar.');
    return;
  }

  let adminPassword = undefined;
  if (store.currentRole !== 'admin') {
    adminPassword = prompt('Pencatatan uang keluar memerlukan otorisasi Admin.\nMasukkan Password Admin:');
    if (!adminPassword || !adminPassword.trim()) {
      alert('Pencatatan pengeluaran dibatalkan (memerlukan password Admin).');
      return;
    }
  }

  const payload = {
    date: getLocalISOString(),
    type: 'out',
    category,
    method,
    description,
    amount,
    user: store.cashierName || 'Kasir',
    adminPassword: adminPassword || undefined
  };

  const res = await store.addCashbookEntry(payload);
  if (res.success) {
    closeModal();
    window.renderApp();
    store.showRealtimeToast(`🔴 Pengeluaran ${formatRupiah(amount)} berhasil dicatat di buku kas.`);
  } else {
    alert(res.error || 'Gagal menyimpan pengeluaran kas.');
  }
}

async function promptVoidCashbookEntry(entryId) {
  const store = window.store;
  if (store.currentRole !== 'admin') {
    alert('Hanya Admin yang dapat membatalkan mutasi kas.');
    return;
  }

  const reason = prompt('Masukkan alasan pembatalan (Void) catatan kas ini:');
  if (!reason || !reason.trim()) return;

  const res = await store.voidCashbookEntry(entryId, reason.trim());
  if (res.success) {
    window.renderApp();
    store.showRealtimeToast('Catatan kas berhasil dibatalkan (VOID).');
  } else {
    alert(res.error || 'Gagal membatalkan catatan kas.');
  }
}
