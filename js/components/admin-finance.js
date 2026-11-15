/**
 * WARUNGKU POS - ADMIN FINANCE, EXPENSES & AUTOMATIC PERIODIC REPORTS COMPONENT
 * Mendukung pembukuan otomatis harian (Tutup Toko),
 * roll-up bertingkat (7 Hari -> 1 Minggu -> 4 Minggu -> 1 Bulan -> 12 Bulan -> 1 Tahun),
 * filter dropdown rapi agar tidak memenuhi layar, serta ekspor & download PDF.
 */

let expenseCategoryFilter = 'all';
let expensePeriodFilter = 'all'; // 'all' | 'today' | '7days' | 'month' | 'year'
let expenseSearchQuery = '';
let financeActiveTab = 'reports'; // 'reports' | 'daily_cashbook' | 'expenses'
let selectedReportPeriodType = 'all'; // 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly'
let selectedReportId = ''; // for detail view modal
let reportSearchQuery = '';
let financeSummaryPeriod = 'today'; // 'today' | 'all'

function setFinanceSummaryPeriod(period) {
  financeSummaryPeriod = period;
  window.renderApp();
}

function renderAdminFinance() {
  const store = window.store;
  const reports = store.financialReports || [];
  const now = new Date();
  const todayDateStr = getLocalDateKey(now);

  // Filtered reports by dropdown type & search
  const filteredReports = reports.filter(r => {
    const matchType = selectedReportPeriodType === 'all' || r.reportType === selectedReportPeriodType;
    const q = reportSearchQuery.toLowerCase().trim();
    const matchQuery = !q || (r.label && r.label.toLowerCase().includes(q)) || (r.id && r.id.toLowerCase().includes(q));
    return matchType && matchQuery;
  });

  // Calculate realtime financials from active transactions (excluding void)
  const allActiveTransactions = store.transactions.filter(t => t.status !== 'void');
  const validTransactions = financeSummaryPeriod === 'today'
    ? allActiveTransactions.filter(t => getLocalDateKey(t.date) === todayDateStr)
    : allActiveTransactions;

  // Filter expenses based on summary period
  const validExpenses = financeSummaryPeriod === 'today'
    ? store.expenses.filter(e => getLocalDateKey(e.date) === todayDateStr)
    : store.expenses;

  const totalRevenue = validTransactions.reduce((acc, t) => acc + Number(t.total || 0), 0);
  const totalTax = validTransactions.reduce((acc, t) => acc + Number(t.tax || 0), 0);
  const netSales = validTransactions.reduce((acc, t) => acc + (Number(t.subtotal || t.total || 0) - Number(t.discount || 0)), 0);
  const totalCostOfGoods = validTransactions.reduce((acc, t) => acc + Number(t.totalCost || 0), 0);
  const grossProfit = validTransactions.reduce((acc, t) => {
    const netSale = Number(t.subtotal || t.total || 0) - Number(t.discount || 0);
    const cost = Number(t.totalCost || 0);
    return acc + (t.profit !== undefined ? Number(t.profit) : (netSale - cost));
  }, 0);
  const totalExpenses = validExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const netProfit = grossProfit - totalExpenses;

  // Filter expenses for cashbook
  const filteredExpenses = store.expenses.filter(e => {
    const matchCat = expenseCategoryFilter === 'all' || e.category === expenseCategoryFilter;
    
    const expDateStr = getLocalDateKey(e.date);
    let matchPeriod = true;
    if (expensePeriodFilter === 'today') {
      matchPeriod = expDateStr === todayDateStr;
    } else if (expensePeriodFilter === '7days') {
      const d = new Date(e.date);
      const diffDays = (now - d) / (1000 * 60 * 60 * 24);
      matchPeriod = diffDays <= 7;
    } else if (expensePeriodFilter === 'month') {
      const d = new Date(e.date);
      matchPeriod = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    } else if (expensePeriodFilter === 'year') {
      const d = new Date(e.date);
      matchPeriod = d.getFullYear() === now.getFullYear();
    }

    const q = expenseSearchQuery.toLowerCase().trim();
    const matchSearch = !q || 
      (e.description && e.description.toLowerCase().includes(q)) ||
      (e.category && e.category.toLowerCase().includes(q)) ||
      (e.recordedBy && e.recordedBy.toLowerCase().includes(q));

    return matchCat && matchPeriod && matchSearch;
  });

  const totalFilteredExpenseAmount = filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  // Report counts for badge counters
  const dailyCount = reports.filter(r => r.reportType === 'daily').length;
  const weeklyCount = reports.filter(r => r.reportType === 'weekly').length;
  const monthlyCount = reports.filter(r => r.reportType === 'monthly').length;
  const yearlyCount = reports.filter(r => r.reportType === 'yearly').length;

  return `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-8">
      
      <!-- Top Actions Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <i data-lucide="wallet" class="w-6 h-6 text-indigo-600 dark:text-indigo-400"></i>
            <span>Buku Kas & Laporan Finansial Toko</span>
          </h2>
          <p class="text-xs text-slate-400 mt-0.5">
            Laporan keuntungan harian otomatis saat tutup toko, roll-up 7 hari (mingguan), 4 minggu (bulanan), 12 bulan (tahunan), & download PDF.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Button: Manual Close Store Day -->
          <button 
            type="button"
            onclick="promptCloseStoreDay()" 
            class="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20 active:scale-95 transition"
            title="Bukukan & tutup keuangan hari ini sekarang (server juga otomatis menutup saat jam tutup toko)"
          >
            <i data-lucide="lock" class="w-4 h-4"></i>
            <span>Tutup Buku Hari Ini</span>
          </button>

          <!-- Button: Add Cash Income -->
          <button 
            type="button"
            onclick="openAddCashbookIncomeModal()" 
            class="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20 active:scale-95 transition"
            title="Catat uang masuk kasir atau modal tambahan toko"
          >
            <i data-lucide="arrow-down-left" class="w-4 h-4"></i>
            <span>Catat Uang Masuk</span>
          </button>

          <!-- Button: Add Expense -->
          <button 
            type="button"
            onclick="openAddExpenseModal()" 
            class="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-rose-600/20 active:scale-95 transition"
          >
            <i data-lucide="plus-circle" class="w-4 h-4"></i>
            <span>Catat Biaya Toko</span>
          </button>
        </div>
      </div>

      <!-- Financial Profit & Loss Statement Summary (Realtime Live Card) -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4 gap-2">
          <div class="flex items-center space-x-2.5">
            <div class="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0">
              <i data-lucide="calculator" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="font-bold text-sm text-slate-800 dark:text-white flex items-center space-x-2">
                <span>Ringkasan Laba / Rugi (${financeSummaryPeriod === 'today' ? 'Hari Ini • Realtime' : 'Semua Periode • Akumulasi'})</span>
              </h3>
              <p class="text-[11px] text-slate-400">
                ${financeSummaryPeriod === 'today' 
                  ? 'Menampilkan omset & pengeluaran hari ini (sinkron dengan Buku Kas Harian)' 
                  : 'Menampilkan total seluruh transaksi & pengeluaran sejak awal'}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <!-- Toggle Filter: Hari Ini vs Semua Periode -->
            <div class="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold">
              <button 
                type="button" 
                onclick="setFinanceSummaryPeriod('today')" 
                class="px-3 py-1.5 rounded-lg transition ${
                  financeSummaryPeriod === 'today' 
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }"
              >
                📅 Hari Ini
              </button>
              <button 
                type="button" 
                onclick="setFinanceSummaryPeriod('all')" 
                class="px-3 py-1.5 rounded-lg transition ${
                  financeSummaryPeriod === 'all' 
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }"
              >
                📋 Semua Waktu
              </button>
            </div>

            <span class="text-[11px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl">
              Jam Tutup: <b>${escapeHtml(store.settings.storeCloseTime || '22:00')} WIB</b>
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
          
          <div class="pt-2 sm:pt-0 sm:pr-4">
            <span class="text-xs font-semibold text-slate-400 block mb-1">(+) Total Penjualan (Omset)</span>
            <span class="text-xl font-extrabold text-slate-900 dark:text-white">${formatRupiah(totalRevenue)}</span>
            <span class="text-[11px] text-slate-400 block mt-1">
              ${totalTax > 0 ? `Penjualan Bersih: ${formatRupiah(netSales)} (PPN: ${formatRupiah(totalTax)})` : `Dari ${validTransactions.length} transaksi ${financeSummaryPeriod === 'today' ? 'hari ini' : 'aktif'}`}
            </span>
          </div>

          <div class="pt-3 sm:pt-0 sm:px-4">
            <span class="text-xs font-semibold text-slate-400 block mb-1">(-) Modal Pokok Barang (HPP)</span>
            <span class="text-xl font-extrabold text-slate-700 dark:text-slate-300">${formatRupiah(totalCostOfGoods)}</span>
            <span class="text-[11px] text-emerald-600 font-semibold block mt-1">Laba Kotor (Net - HPP): ${formatRupiah(grossProfit)}</span>
          </div>

          <div class="pt-3 sm:pt-0 sm:px-4">
            <span class="text-xs font-semibold text-slate-400 block mb-1">(-) Biaya & Pengeluaran Toko</span>
            <span class="text-xl font-extrabold text-rose-600 dark:text-rose-400">${formatRupiah(totalExpenses)}</span>
            <span class="text-[11px] text-slate-400 block mt-1">
              ${validExpenses.length} catatan biaya ${financeSummaryPeriod === 'today' ? 'hari ini' : 'total'}
            </span>
          </div>

          <div class="pt-3 sm:pt-0 sm:pl-4">
            <span class="text-xs font-semibold text-slate-400 block mb-1">(=) Keuntungan Bersih (Net Profit)</span>
            <span class="text-2xl font-extrabold ${netProfit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}">
              ${formatRupiah(netProfit)}
            </span>
            <span class="text-[11px] font-semibold ${netProfit >= 0 ? 'text-indigo-500' : 'text-rose-500'} block mt-1">
              ${netProfit >= 0 ? 'Margin Keuntungan Toko Positif' : 'Perlu Evaluasi Pengeluaran'}
            </span>
          </div>

        </div>
      </div>

      <!-- Navigation Tabs: Laporan Pembukuan vs Buku Kas Harian vs Buku Kas Pengeluaran -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
        <div class="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl text-xs font-bold overflow-x-auto">
          <button 
            type="button"
            onclick="setFinanceActiveTab('reports')"
            class="px-4 py-2 rounded-xl transition flex items-center space-x-2 shrink-0 ${
              financeActiveTab === 'reports'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }"
          >
            <i data-lucide="file-text" class="w-4 h-4"></i>
            <span>Laporan Pembukuan (${reports.length})</span>
          </button>
          <button 
            type="button"
            onclick="setFinanceActiveTab('daily_cashbook')"
            class="px-4 py-2 rounded-xl transition flex items-center space-x-2 shrink-0 ${
              financeActiveTab === 'daily_cashbook'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }"
          >
            <i data-lucide="coins" class="w-4 h-4"></i>
            <span>Buku Kas Harian (${(store.dailyCashbook || []).length})</span>
          </button>
          <button 
            type="button"
            onclick="setFinanceActiveTab('expenses')"
            class="px-4 py-2 rounded-xl transition flex items-center space-x-2 shrink-0 ${
              financeActiveTab === 'expenses'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }"
          >
            <i data-lucide="receipt" class="w-4 h-4"></i>
            <span>Buku Kas Pengeluaran (${store.expenses.length})</span>
          </button>
        </div>

        <span class="text-xs text-slate-400 hidden lg:inline">
          ${financeActiveTab === 'reports' ? 'Sistem Roll-Up Bertingkat: 7d → 4w → 12m' : (financeActiveTab === 'daily_cashbook' ? 'Arus Kas Harian & Laci Kasir' : 'Arus Kas Keluar')}
        </span>
      </div>

      ${financeActiveTab === 'daily_cashbook' ? (typeof renderAdminCashbook === 'function' ? renderAdminCashbook(true) : '') : (financeActiveTab === 'reports' ? `
        <!-- ==================== TAB 1: LAPORAN BERKALA (DROPDOWN FILTER) ==================== -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
          
          <!-- Dropdown Period Filter (Agar tidak memenuhi layar sesuai request user) -->
          <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <span class="text-xs font-bold text-slate-500 flex items-center space-x-1.5 shrink-0">
              <i data-lucide="filter" class="w-3.5 h-3.5 text-indigo-600"></i>
              <span>Pilih Periode Laporan:</span>
            </span>

            <select 
              id="finance-period-dropdown"
              onchange="selectedReportPeriodType = this.value; window.renderApp();"
              class="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-indigo-400/40 rounded-xl text-xs text-slate-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            >
              <option value="all" ${selectedReportPeriodType === 'all' ? 'selected' : ''}>📋 Semua Periode (${reports.length})</option>
              <option value="daily" ${selectedReportPeriodType === 'daily' ? 'selected' : ''}>📅 Laporan Harian (${dailyCount})</option>
              <option value="weekly" ${selectedReportPeriodType === 'weekly' ? 'selected' : ''}>📆 Laporan Mingguan / 7 Hari (${weeklyCount})</option>
              <option value="monthly" ${selectedReportPeriodType === 'monthly' ? 'selected' : ''}>📊 Laporan Bulanan / 4 Minggu (${monthlyCount})</option>
              <option value="yearly" ${selectedReportPeriodType === 'yearly' ? 'selected' : ''}>📈 Laporan Tahunan / 12 Bulan (${yearlyCount})</option>
            </select>
          </div>

          <!-- Search Input -->
          <div class="relative w-full sm:w-72">
            <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"></i>
            <input 
              type="text" 
              placeholder="Cari tanggal / label laporan..."
              value="${escapeHtml(reportSearchQuery)}"
              oninput="reportSearchQuery = this.value; window.debouncedRenderApp();"
              class="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <!-- Reports Table -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th class="py-3.5 px-4">Periode & Label</th>
                  <th class="py-3.5 px-4">Tipe Periode</th>
                  <th class="py-3.5 px-4 text-center">Transaksi / Qty</th>
                  <th class="py-3.5 px-4 text-right">Omset (Rp)</th>
                  <th class="py-3.5 px-4 text-right">Modal HPP (Rp)</th>
                  <th class="py-3.5 px-4 text-right">Biaya Toko (Rp)</th>
                  <th class="py-3.5 px-4 text-right">Laba Bersih (Rp)</th>
                  <th class="py-3.5 px-4 text-center">Status / Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                ${filteredReports.length > 0 ? filteredReports.map(r => {
                  const typeBadge = {
                    daily: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200',
                    weekly: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200',
                    monthly: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200',
                    yearly: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200'
                  }[r.reportType] || 'bg-slate-100 text-slate-700';

                  const typeName = {
                    daily: 'Harian',
                    weekly: 'Mingguan (7 Hari)',
                    monthly: 'Bulanan (4 Minggu)',
                    yearly: 'Tahunan (12 Bulan)'
                  }[r.reportType] || r.reportType;

                  return `
                    <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td class="py-3 px-4 font-medium">
                        <div class="font-bold text-slate-900 dark:text-white">${escapeHtml(r.label)}</div>
                        <div class="text-[10px] text-slate-400 font-mono">
                          ${escapeHtml(r.startDate)} s/d ${escapeHtml(r.endDate)} • Ditutup: ${escapeHtml(r.closedBy)}
                        </div>
                      </td>
                      <td class="py-3 px-4">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${typeBadge}">
                          ${typeName}
                        </span>
                        ${r.isConsolidated ? `
                          <span class="block text-[9px] font-bold text-slate-400 mt-0.5">
                            ✓ Terkonsolidasi
                          </span>
                        ` : ''}
                      </td>
                      <td class="py-3 px-4 text-center font-mono font-medium">
                        <div><b>${r.totalTransactions}</b> Struk</div>
                        <div class="text-[10px] text-slate-400">${r.totalItems} item</div>
                      </td>
                      <td class="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        ${formatRupiah(r.totalRevenue)}
                      </td>
                      <td class="py-3 px-4 text-right font-mono text-slate-500">
                        ${formatRupiah(r.totalCost)}
                      </td>
                      <td class="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        -${formatRupiah(r.totalExpenses)}
                      </td>
                      <td class="py-3 px-4 text-right font-mono font-extrabold ${r.netProfit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}">
                        ${formatRupiah(r.netProfit)}
                      </td>
                      <td class="py-3 px-4 text-center">
                        <div class="flex items-center justify-center space-x-1.5">
                          <!-- View Details Button -->
                          <button 
                            type="button"
                            onclick="openReportDetailModal('${escapeHtml(r.id)}')" 
                            class="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300 hover:bg-indigo-100 transition"
                            title="Buka Rincian Laporan"
                          >
                            <i data-lucide="eye" class="w-4 h-4"></i>
                          </button>

                          <!-- Download PDF Button (Direct) -->
                          <button 
                            type="button"
                            onclick="downloadFinancialReportPDF('${escapeHtml(r.id)}')" 
                            class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100 transition"
                            title="Download PDF Laporan Ini"
                          >
                            <i data-lucide="file-down" class="w-4 h-4"></i>
                          </button>

                          <!-- Delete Report Button -->
                          <button 
                            type="button"
                            onclick="confirmDeleteFinancialReport('${escapeHtml(r.id)}', '${escapeHtml(r.label).replace(/'/g, "\\'")}')" 
                            class="p-1.5 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 hover:bg-rose-100 transition"
                            title="Hapus Laporan Ini"
                          >
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="8" class="py-16 text-center">
                      <div class="max-w-sm mx-auto space-y-3">
                        <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center mx-auto">
                          <i data-lucide="calendar" class="w-6 h-6"></i>
                        </div>
                        <p class="font-bold text-slate-700 dark:text-slate-300 text-sm">
                          ${reports.length === 0 ? 'Belum Ada Laporan Tutup Buku' : 'Tidak Ada Laporan yang Cocok'}
                        </p>
                        <p class="text-xs text-slate-400">
                          ${reports.length === 0 
                            ? 'Laporan harian otomatis dibuat setiap jam tutup toko atau bisa langsung klik tombol "Tutup Buku Hari Ini". Setelah 7 hari, sistem otomatis menyatukannya menjadi laporan mingguan, 4 minggu menjadi bulanan, dan 12 bulan menjadi tahunan.'
                            : 'Coba ubah pilihan dropdown periode di atas.'}
                        </p>
                        ${reports.length === 0 ? `
                          <button 
                            type="button"
                            onclick="promptCloseStoreDay()"
                            class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center space-x-1.5 shadow-md transition"
                          >
                            <i data-lucide="lock" class="w-4 h-4"></i>
                            <span>Tutup Buku Hari Ini Sekarang</span>
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      ` : `
        <!-- ==================== TAB 2: BUKU KAS PENGELUARAN ==================== -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
          
          <!-- Dropdown Period & Category Filter (Sama rapinya seperti tab Laporan Pembukuan) -->
          <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <span class="text-xs font-bold text-slate-500 flex items-center space-x-1.5 shrink-0">
              <i data-lucide="filter" class="w-3.5 h-3.5 text-rose-600"></i>
              <span>Filter Periode:</span>
            </span>

            <select 
              id="expense-period-dropdown"
              onchange="expensePeriodFilter = this.value; window.renderApp();"
              class="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-rose-400/40 rounded-xl text-xs text-slate-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-sm"
            >
              <option value="all" ${expensePeriodFilter === 'all' ? 'selected' : ''}>📋 Semua Waktu</option>
              <option value="today" ${expensePeriodFilter === 'today' ? 'selected' : ''}>📅 Hari Ini</option>
              <option value="7days" ${expensePeriodFilter === '7days' ? 'selected' : ''}>📆 7 Hari Terakhir</option>
              <option value="month" ${expensePeriodFilter === 'month' ? 'selected' : ''}>📊 Bulan Ini</option>
              <option value="year" ${expensePeriodFilter === 'year' ? 'selected' : ''}>📈 Tahun Ini</option>
            </select>

            <select 
              onchange="expenseCategoryFilter = this.value; window.renderApp();"
              class="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-semibold focus:outline-none"
            >
              <option value="all">Semua Kategori</option>
              <option value="Stok Barang" ${expenseCategoryFilter === 'Stok Barang' ? 'selected' : ''}>Stok Barang (Restock)</option>
              <option value="Listrik & Air" ${expenseCategoryFilter === 'Listrik & Air' ? 'selected' : ''}>Listrik & Air</option>
              <option value="Gaji Karyawan" ${expenseCategoryFilter === 'Gaji Karyawan' ? 'selected' : ''}>Gaji Karyawan / Kasir</option>
              <option value="Sewa Tempat" ${expenseCategoryFilter === 'Sewa Tempat' ? 'selected' : ''}>Sewa Tempat / Warung</option>
              <option value="Operasional" ${expenseCategoryFilter === 'Operasional' ? 'selected' : ''}>Operasional & Plastik</option>
              <option value="Lainnya" ${expenseCategoryFilter === 'Lainnya' ? 'selected' : ''}>Lainnya</option>
            </select>
          </div>

          <!-- Search Input & Direct PDF Download Button -->
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <div class="relative flex-1 sm:w-60">
              <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"></i>
              <input 
                type="text" 
                placeholder="Cari keterangan / kategori..."
                value="${escapeHtml(expenseSearchQuery)}"
                oninput="expenseSearchQuery = this.value; window.debouncedRenderApp();"
                class="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <button 
              type="button"
              onclick="downloadExpensesPDF()"
              class="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-md shadow-rose-600/20 shrink-0"
              title="Download PDF Rekap Buku Kas Pengeluaran"
            >
              <i data-lucide="file-down" class="w-4 h-4"></i>
              <span class="hidden sm:inline">Download PDF</span>
            </button>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          
          <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold">
            <div class="flex items-center space-x-2">
              <span class="font-bold text-slate-800 dark:text-white">Daftar Pengeluaran Toko</span>
              <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                ${filteredExpenses.length} catatan
              </span>
            </div>
            <div class="text-slate-500">
              Total Pengeluaran: <b class="text-rose-600 font-mono text-sm">${formatRupiah(totalFilteredExpenseAmount)}</b>
            </div>
          </div>

          <!-- Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th class="py-3.5 px-4">Tanggal & Waktu</th>
                  <th class="py-3.5 px-4">Kategori Biaya</th>
                  <th class="py-3.5 px-4">Keterangan Pengeluaran</th>
                  <th class="py-3.5 px-4 text-right">Nominal (Rp)</th>
                  <th class="py-3.5 px-4">Dicatat Oleh</th>
                  <th class="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                ${filteredExpenses.length > 0 ? filteredExpenses.map(item => `
                  <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td class="py-3 px-4 font-mono text-slate-500">${formatDateTime(item.date)}</td>
                    <td class="py-3 px-4">
                      <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                        ${escapeHtml(item.category)}
                      </span>
                    </td>
                    <td class="py-3 px-4 font-medium text-slate-800 dark:text-slate-100">${escapeHtml(item.description)}</td>
                    <td class="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      -${formatRupiah(item.amount)}
                    </td>
                    <td class="py-3 px-4 text-slate-400">${escapeHtml(item.recordedBy || 'Admin')}</td>
                    <td class="py-3 px-4 text-center">
                      <button 
                        type="button"
                        onclick="confirmDeleteExpense('${escapeHtml(item.id)}')"
                        class="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                        title="Hapus Catatan Pengeluaran"
                      >
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                      </button>
                    </td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="6" class="py-12 text-center text-slate-400">Belum ada catatan pengeluaran.</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>

        </div>
      `)}

    </div>
  `;
}

function setFinanceActiveTab(tab) {
  if (tab === 'cashbook') tab = 'daily_cashbook';
  financeActiveTab = tab;
  window.renderApp();
}

// Modal: Tutup Toko & Buku Harian Sekarang
function promptCloseStoreDay() {
  const store = window.store;
  const now = new Date();
  const todayKey = getLocalDateKey(now);

  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in zoom-in-95 duration-150">
        
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 class="font-bold text-base text-slate-800 dark:text-white flex items-center space-x-2">
            <i data-lucide="lock" class="w-5 h-5 text-emerald-600"></i>
            <span>Tutup Buku Keuangan Toko</span>
          </h3>
          <button type="button" onclick="closeModal()" class="p-1.5 text-slate-400 hover:text-slate-600">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <div class="space-y-3 text-xs text-slate-600 dark:text-slate-300">
          <p>
            Tindakan ini akan <b>merekam omset, modal pokok (HPP), pengeluaran, dan laba bersih toko</b> pada tanggal terpilih secara permanen.
          </p>

          <div class="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] space-y-1">
            <div class="font-bold text-emerald-800 dark:text-emerald-200 flex items-center space-x-1">
              <i data-lucide="layers" class="w-3.5 h-3.5 text-emerald-600"></i>
              <span>Otomatisasi Roll-Up Bertingkat:</span>
            </div>
            <ul class="list-disc list-inside space-y-0.5 text-emerald-700 dark:text-emerald-300">
              <li>Mencapai <b>7 hari</b> berturut-turut → Otomatis jadi <b>Laporan Mingguan</b></li>
              <li>Mencapai <b>4 minggu</b> → Otomatis jadi <b>Laporan Bulanan</b></li>
              <li>Mencapai <b>12 bulan</b> → Otomatis jadi <b>Laporan Tahunan</b></li>
            </ul>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Pilih Tanggal Tutup Buku *</label>
            <input 
              type="date" 
              id="close-store-target-date"
              value="${todayKey}"
              class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
          <button type="button" onclick="closeModal()" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs">
            Batal
          </button>
          <button 
            type="button" 
            onclick="executeCloseStoreDay()"
            class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition flex items-center space-x-1.5"
          >
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Simpan & Tutup Buku</span>
          </button>
        </div>

      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function executeCloseStoreDay() {
  const dateInput = document.getElementById('close-store-target-date');
  const targetDate = dateInput ? dateInput.value : null;

  closeModal();
  window.store.showRealtimeToast("⏳ Memproses pembukuan toko & konsolidasi laporan...");

  const res = await window.store.closeStoreDay(targetDate);
  if (!res.success) {
    alert(res.message || "Gagal menutup buku.");
    return;
  }

  let msg = `✅ Laporan Harian (${res.closedDate}) berhasil dibukukan!`;
  if (res.consolidatedEvents && res.consolidatedEvents.length > 0) {
    const consNames = res.consolidatedEvents.map(e => e.label).join(", ");
    msg += `\n🎉 Konsolidasi Otomatis Terbentuk: ${consNames}`;
  }

  window.renderApp();
  window.store.showRealtimeToast(msg);
}

// Modal: Detail View of Financial Report + PDF Download Preview
function buildStructuredReportHTML(r, store) {
  const typeName = {
    daily: 'Laporan Harian',
    weekly: 'Laporan Mingguan (7 Hari)',
    monthly: 'Laporan Bulanan (4 Minggu)',
    semester: 'Laporan 6-Bulanan (Semester)',
    yearly: 'Laporan Tahunan (12 Bulan)'
  }[r.reportType] || r.reportType;

  const breakdown = r.breakdown || [];
  const grossSales = (r.totalRevenue || 0) + (r.totalDiscount || 0);
  const netSales = r.totalRevenue || 0;
  const totalCost = r.totalCost || 0;
  const grossProfit = r.grossProfit !== undefined ? r.grossProfit : (netSales - totalCost);
  const totalExpenses = r.totalExpenses || 0;
  const netProfit = r.netProfit !== undefined ? r.netProfit : (grossProfit - totalExpenses);
  const totalTrx = r.totalTransactions || 0;
  const totalItems = r.totalItems || 0;
  const avgBasket = totalTrx > 0 ? Math.round(netSales / totalTrx) : 0;
  const netMargin = netSales > 0 ? ((netProfit / netSales) * 100).toFixed(1) : '0.0';
  const grossMargin = netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(1) : '0.0';

  // Aggregate payment channels & expense categories
  let paymentSummary = { cash: 0, qris: 0, transfer: 0 };
  let expenseCategories = {};

  if (breakdown.length > 0) {
    breakdown.forEach(b => {
      if (b.paymentSummary) {
        paymentSummary.cash += Number(b.paymentSummary.cash || 0);
        paymentSummary.qris += Number(b.paymentSummary.qris || 0);
        paymentSummary.transfer += Number(b.paymentSummary.transfer || b.paymentSummary.bank || 0);
      }
      if (b.expenseCategories) {
        Object.entries(b.expenseCategories).forEach(([cat, val]) => {
          expenseCategories[cat] = (expenseCategories[cat] || 0) + Number(val || 0);
        });
      }
    });
  }

  // Fallback to active store transactions/expenses in date range if not in breakdown
  if (paymentSummary.cash === 0 && paymentSummary.qris === 0 && paymentSummary.transfer === 0) {
    const trxs = (store.transactions || []).filter(t => {
      if (t.status === 'void') return false;
      const d = getLocalDateKey(t.date);
      return d >= r.startDate && d <= r.endDate;
    });
    trxs.forEach(t => {
      const pm = (t.paymentMethod || 'cash').toLowerCase();
      if (pm === 'qris') paymentSummary.qris += Number(t.total || 0);
      else if (pm === 'transfer' || pm === 'bank') paymentSummary.transfer += Number(t.total || 0);
      else paymentSummary.cash += Number(t.total || 0);
    });
  }

  if (Object.keys(expenseCategories).length === 0) {
    const exps = (store.expenses || []).filter(e => {
      const d = getLocalDateKey(e.date);
      return d >= r.startDate && d <= r.endDate;
    });
    exps.forEach(e => {
      const cat = e.category || 'Operasional';
      expenseCategories[cat] = (expenseCategories[cat] || 0) + Number(e.amount || 0);
    });
  }

  const printTimeStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return `
    <div style="background: #ffffff; color: #0f172a; font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; line-height: 1.45; padding: 24px; border-radius: 16px;">
      
      <!-- 1. IDENTITAS USAHA & HEADER LAPORAN (Sec 2.3) -->
      <div style="border-bottom: 2px solid #047857; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: -0.5px;">
            ${escapeHtml(store.settings.storeName || 'WarungKu POS')}
          </h2>
          <p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b;">
            ${escapeHtml(store.settings.storeAddress || 'Alamat Toko')} • Telp/WA: ${escapeHtml(store.settings.storePhone || '-')}
          </p>
          <div style="margin-top: 6px; font-size: 13px; font-weight: 700; color: #1e293b;">
            LAPORAN KEUANGAN & LABA RUGI RESMI
          </div>
        </div>

        <div style="text-align: right;">
          <div style="display: inline-block; padding: 4px 10px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; border-radius: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
            ${escapeHtml(typeName)}
          </div>
          <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 600; color: #475569;">
            ${escapeHtml(r.label)}
          </p>
          <p style="margin: 2px 0 0 0; font-size: 10px; color: #94a3b8; font-family: monospace;">
            ID: ${escapeHtml(r.id)}
          </p>
        </div>
      </div>

      <!-- 2. RINGKASAN EKSEKUTIF LABA RUGI (Sec 2.3) -->
      <div style="margin-bottom: 16px;">
        <div style="font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
          I. Ringkasan Eksekutif Laba Rugi
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <tbody>
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 7px 12px; font-weight: 600; color: #334155;">(+) Penjualan Kotor (Gross Sales)</td>
              <td style="padding: 7px 12px; text-align: right; font-weight: 700; font-family: monospace; color: #0f172a;">${formatRupiah(grossSales)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 7px 12px; color: #e11d48;">(-) Potongan Diskon & Voucher Penjualan</td>
              <td style="padding: 7px 12px; text-align: right; font-weight: 700; font-family: monospace; color: #e11d48;">-${formatRupiah(r.totalDiscount || 0)}</td>
            </tr>
            ${(r.totalTax && r.totalTax > 0) ? `
              <tr style="background: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 7px 12px; font-weight: 700; color: #0f172a;">(=) Total Penerimaan Kasir (Termasuk PPN)</td>
                <td style="padding: 7px 12px; text-align: right; font-weight: 700; font-family: monospace; color: #0f172a;">${formatRupiah(netSales)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 7px 12px; color: #64748b;">(-) Titipan Pajak PPN (Pajak Pertambahan Nilai)</td>
                <td style="padding: 7px 12px; text-align: right; font-weight: 700; font-family: monospace; color: #64748b;">-${formatRupiah(r.totalTax)}</td>
              </tr>
              <tr style="background: #f8fafc; border-bottom: 1.5px solid #cbd5e1;">
                <td style="padding: 8px 12px; font-weight: 800; color: #047857;">(=) Penjualan Bersih Usaha (Net Sales Ekskl. Pajak)</td>
                <td style="padding: 8px 12px; text-align: right; font-weight: 800; font-family: monospace; font-size: 13px; color: #047857;">${formatRupiah(netSales - r.totalTax)}</td>
              </tr>
            ` : `
              <tr style="background: #f1f5f9; border-bottom: 1.5px solid #cbd5e1;">
                <td style="padding: 8px 12px; font-weight: 800; color: #0f172a;">(=) Penjualan Bersih (Net Sales / Omset)</td>
                <td style="padding: 8px 12px; text-align: right; font-weight: 800; font-family: monospace; font-size: 13px; color: #047857;">${formatRupiah(netSales)}</td>
              </tr>
            `}
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 7px 12px; color: #475569;">(-) Harga Pokok Penjualan (HPP / Modal Barang)</td>
              <td style="padding: 7px 12px; text-align: right; font-weight: 700; font-family: monospace; color: #475569;">-${formatRupiah(totalCost)}</td>
            </tr>
            <tr style="background: #f8fafc; border-bottom: 1.5px solid #cbd5e1;">
              <td style="padding: 8px 12px; font-weight: 800; color: #0f172a;">(=) Laba Kotor (Gross Profit)</td>
              <td style="padding: 8px 12px; text-align: right; font-weight: 800; font-family: monospace; font-size: 13px; color: #0f172a;">
                ${formatRupiah(grossProfit)} <span style="font-size: 10px; font-weight: normal; color: #64748b;">(${grossMargin}%)</span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 7px 12px; color: #e11d48;">(-) Beban & Biaya Operasional Toko</td>
              <td style="padding: 7px 12px; text-align: right; font-weight: 700; font-family: monospace; color: #e11d48;">-${formatRupiah(totalExpenses)}</td>
            </tr>
            <tr style="background: ${netProfit >= 0 ? '#ecfdf5' : '#fff1f2'}; border-top: 2px solid ${netProfit >= 0 ? '#059669' : '#e11d48'};">
              <td style="padding: 9px 12px; font-weight: 900; font-size: 12px; color: ${netProfit >= 0 ? '#065f46' : '#9f1239'};">
                (=) LABA BERSIH OPERASIONAL (NET PROFIT)
              </td>
              <td style="padding: 9px 12px; text-align: right; font-weight: 900; font-size: 15px; font-family: monospace; color: ${netProfit >= 0 ? '#059669' : '#e11d48'};">
                ${formatRupiah(netProfit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 3. RINCIAN UANG MASUK PER JALUR PEMBAYARAN & BIAYA PENGELUARAN (Sec 2.3) -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        
        <!-- Jalur Pembayaran (Uang Masuk) -->
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #fafafa;">
          <div style="font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            II. Uang Masuk per Jalur Pembayaran
          </div>
          <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
            <tr>
              <td style="padding: 3px 0; color: #64748b;">💵 Kas Tunai (Cash Laci):</td>
              <td style="padding: 3px 0; text-align: right; font-weight: 700; font-family: monospace;">${formatRupiah(paymentSummary.cash)}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #64748b;">📱 QRIS & E-Wallet:</td>
              <td style="padding: 3px 0; text-align: right; font-weight: 700; font-family: monospace;">${formatRupiah(paymentSummary.qris)}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #64748b;">🏦 Rekening Bank / Transfer:</td>
              <td style="padding: 3px 0; text-align: right; font-weight: 700; font-family: monospace;">${formatRupiah(paymentSummary.transfer)}</td>
            </tr>
            <tr style="border-top: 1px dashed #cbd5e1; font-weight: 800;">
              <td style="padding: 5px 0 2px 0; color: #047857;">Total Uang Masuk:</td>
              <td style="padding: 5px 0 2px 0; text-align: right; color: #047857; font-family: monospace;">${formatRupiah(paymentSummary.cash + paymentSummary.qris + paymentSummary.transfer)}</td>
            </tr>
          </table>
        </div>

        <!-- Rincian Biaya Pengeluaran -->
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #fafafa;">
          <div style="font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            III. Rincian Kategori Pengeluaran
          </div>
          <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
            ${Object.keys(expenseCategories).length > 0 ? Object.entries(expenseCategories).map(([cat, val]) => `
              <tr>
                <td style="padding: 3px 0; color: #64748b;">${escapeHtml(cat)}:</td>
                <td style="padding: 3px 0; text-align: right; font-weight: 700; font-family: monospace; color: #e11d48;">-${formatRupiah(val)}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="2" style="padding: 6px 0; color: #94a3b8; font-style: italic;">Tidak ada catatan pengeluaran operasional.</td>
              </tr>
            `}
            <tr style="border-top: 1px dashed #cbd5e1; font-weight: 800;">
              <td style="padding: 5px 0 2px 0; color: #e11d48;">Total Pengeluaran:</td>
              <td style="padding: 5px 0 2px 0; text-align: right; color: #e11d48; font-family: monospace;">-${formatRupiah(totalExpenses)}</td>
            </tr>
          </table>
        </div>

      </div>

      <!-- 4. ANALISIS KINERJA PENJUALAN (Sec 2.3) -->
      <div style="margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #f8fafc;">
        <div style="font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 6px;">
          IV. Analisis Kinerja Penjualan Toko
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center; font-size: 10px;">
          <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div style="color: #64748b;">Jumlah Struk / Nota</div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px;">${totalTrx} Transaksi</div>
          </div>
          <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div style="color: #64748b;">Total Kuantitas Terjual</div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px;">${totalItems} Unit/Pcs</div>
          </div>
          <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div style="color: #64748b;">Rata-rata per Struk</div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px;">${formatRupiah(avgBasket)}</div>
          </div>
          <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div style="color: #64748b;">Profit Margin Bersih</div>
            <div style="font-size: 13px; font-weight: 800; color: ${netProfit >= 0 ? '#059669' : '#e11d48'}; margin-top: 2px;">${netMargin}%</div>
          </div>
        </div>
      </div>

      <!-- 5. RINCIAN KOMPONEN PEMBENTUK (Jika Mingguan/Bulanan/Tahunan) -->
      ${breakdown.length > 0 ? `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 6px;">
            V. Rincian Komponen Pembentuk Periode (${breakdown.length} Catatan)
          </div>
          <table style="width: 100%; font-size: 10px; border-collapse: collapse; border: 1px solid #e2e8f0;">
            <thead>
              <tr style="background: #f1f5f9; text-align: left;">
                <th style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">Periode / Bagian</th>
                <th style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">Trx</th>
                <th style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">Omset</th>
                <th style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">HPP</th>
                <th style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">Biaya Toko</th>
                <th style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">Laba Bersih</th>
              </tr>
            </thead>
            <tbody>
              ${breakdown.map(b => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 5px 8px; font-weight: 600;">${escapeHtml(b.label || b.periodKey || '-')}</td>
                  <td style="padding: 5px 8px; text-align: center;">${b.totalTransactions || 0}</td>
                  <td style="padding: 5px 8px; text-align: right; font-family: monospace;">${formatRupiah(b.totalRevenue)}</td>
                  <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: #64748b;">${formatRupiah(b.totalCost)}</td>
                  <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: #e11d48;">-${formatRupiah(b.totalExpenses)}</td>
                  <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 700; color: ${b.netProfit >= 0 ? '#059669' : '#e11d48'};">${formatRupiah(b.netProfit)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- 6. PENGESAHAN DOKUMEN & AUDIT FOOTER -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 20px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <div>Dicetak pada: <b>${escapeHtml(printTimeStr)}</b></div>
          <div>Ditutup / Dibukukan oleh: <b>${escapeHtml(r.closedBy)}</b></div>
          <div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Sistem Kasir & Keuangan WarungKu POS Realtime</div>
        </div>

        <div style="text-align: center; width: 140px;">
          <div style="font-size: 10px; color: #475569; margin-bottom: 40px;">Penanggung Jawab / Pemilik</div>
          <div style="border-top: 1px solid #475569; font-weight: 700; color: #1e293b;">( ..................................... )</div>
        </div>
      </div>

    </div>
  `;
}

function openReportDetailModal(reportId) {
  const store = window.store;
  const r = (store.financialReports || []).find(item => item.id === reportId);
  if (!r) return;

  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in zoom-in-95 duration-150">
        
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div class="flex items-center space-x-2.5">
            <div class="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
              <i data-lucide="file-text" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="font-bold text-base text-slate-800 dark:text-white">${escapeHtml(r.label)}</h3>
              <p class="text-[11px] text-slate-400 font-mono">${escapeHtml(r.startDate)} s/d ${escapeHtml(r.endDate)} • ID: ${escapeHtml(r.id)}</p>
            </div>
          </div>
          <button type="button" onclick="closeModal()" class="p-1.5 text-slate-400 hover:text-slate-600">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Printable / PDF Target Container -->
        <div id="pdf-printable-area" class="max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
          ${buildStructuredReportHTML(r, store)}
        </div>

        <!-- Action Buttons -->
        <div class="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button 
            type="button" 
            onclick="confirmDeleteFinancialReport('${escapeHtml(r.id)}', '${escapeHtml(r.label).replace(/'/g, "\\'")}')" 
            class="text-rose-600 hover:text-rose-700 text-xs font-semibold flex items-center space-x-1"
          >
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            <span>Hapus Laporan Ini</span>
          </button>

          <div class="flex items-center space-x-2">
            <button 
              type="button" 
              onclick="closeModal()" 
              class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 font-semibold"
            >
              Tutup
            </button>
            <button 
              type="button" 
              onclick="downloadFinancialReportPDF('${escapeHtml(r.id)}')" 
              class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20 active:scale-95 transition"
            >
              <i data-lucide="download" class="w-4 h-4"></i>
              <span>Download Dokumen PDF</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Download PDF Generator Engine using html2pdf.js
async function downloadFinancialReportPDF(reportId) {
  const store = window.store;
  const r = (store.financialReports || []).find(item => item.id === reportId);
  if (!r) return;

  const targetFilename = `Laporan_${r.reportType.toUpperCase()}_${r.periodKey || r.startDate}.pdf`;

  // Construct dedicated off-screen container for crisp A4 PDF rendering
  const temporaryWrapper = document.createElement('div');
  temporaryWrapper.style.position = 'fixed';
  temporaryWrapper.style.top = '-9999px';
  temporaryWrapper.style.left = '-9999px';
  temporaryWrapper.style.width = '720px';
  temporaryWrapper.style.background = '#ffffff';
  temporaryWrapper.style.color = '#0f172a';
  temporaryWrapper.innerHTML = buildStructuredReportHTML(r, store);

  document.body.appendChild(temporaryWrapper);
  const printableEl = temporaryWrapper;

  // Trigger PDF conversion
  window.store.showRealtimeToast(`📄 Menyiapkan file PDF: "${targetFilename}"...`);

  const opt = {
    margin: [10, 10, 10, 10],
    filename: targetFilename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    if (typeof html2pdf !== 'undefined') {
      await html2pdf().set(opt).from(printableEl).save();
      window.store.showRealtimeToast(`✅ File PDF "${targetFilename}" berhasil diunduh!`);
    } else {
      // Fallback: window.print() if html2pdf CDN blocked
      window.print();
    }
  } catch (err) {
    alert("Gagal membuat PDF: " + err.message);
  } finally {
    if (temporaryWrapper) {
      document.body.removeChild(temporaryWrapper);
    }
  }
}

// Download PDF Generator Engine for Expenses / Buku Kas
async function downloadExpensesPDF() {
  const store = window.store;
  const now = new Date();
  const todayDateStr = getLocalDateKey(now);

  const filtered = store.expenses.filter(e => {
    const matchCat = expenseCategoryFilter === 'all' || e.category === expenseCategoryFilter;
    const expDateStr = getLocalDateKey(e.date);
    let matchPeriod = true;
    if (expensePeriodFilter === 'today') {
      matchPeriod = expDateStr === todayDateStr;
    } else if (expensePeriodFilter === '7days') {
      const d = new Date(e.date);
      const diffDays = (now - d) / (1000 * 60 * 60 * 24);
      matchPeriod = diffDays <= 7;
    } else if (expensePeriodFilter === 'month') {
      const d = new Date(e.date);
      matchPeriod = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    } else if (expensePeriodFilter === 'year') {
      const d = new Date(e.date);
      matchPeriod = d.getFullYear() === now.getFullYear();
    }
    const q = expenseSearchQuery.toLowerCase().trim();
    const matchSearch = !q || 
      (e.description && e.description.toLowerCase().includes(q)) ||
      (e.category && e.category.toLowerCase().includes(q)) ||
      (e.recordedBy && e.recordedBy.toLowerCase().includes(q));
    return matchCat && matchPeriod && matchSearch;
  });

  if (filtered.length === 0) {
    alert("Tidak ada data pengeluaran untuk diunduh sebagai PDF pada filter ini.");
    return;
  }

  const periodLabel = {
    all: 'Semua Waktu',
    today: 'Hari Ini',
    '7days': '7 Hari Terakhir',
    month: 'Bulan Ini',
    year: 'Tahun Ini'
  }[expensePeriodFilter] || expensePeriodFilter;

  const targetFilename = `Buku_Kas_Pengeluaran_${expensePeriodFilter}_${todayDateStr}.pdf`;
  const totalAmount = filtered.reduce((acc, item) => acc + Number(item.amount || 0), 0);

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.top = '-9999px';
  wrapper.style.left = '-9999px';
  wrapper.style.width = '680px';
  wrapper.style.background = '#ffffff';
  wrapper.style.color = '#0f172a';
  wrapper.style.padding = '24px';
  wrapper.style.fontFamily = "'Plus Jakarta Sans', sans-serif";

  wrapper.innerHTML = `
    <div style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px;">
      <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #e11d48; text-transform: uppercase;">${escapeHtml(store.settings.storeName || 'WarungKu POS')}</h2>
      <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">${escapeHtml(store.settings.storeAddress || '')} • Telp: ${escapeHtml(store.settings.storePhone || '')}</p>
      <div style="margin-top: 8px; display: inline-block; padding: 4px 12px; background: #e11d48; color: #ffffff; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
        Buku Kas Pengeluaran: ${escapeHtml(periodLabel)} (Kategori: ${escapeHtml(expenseCategoryFilter)})
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; margin-bottom: 16px;">
      <div>
        <div style="font-size: 11px; color: #9f1239; font-weight: 600;">Jumlah Catatan Pengeluaran</div>
        <div style="font-size: 16px; font-weight: 800; color: #881337;">${filtered.length} Transaksi</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; color: #9f1239; font-weight: 600;">Total Biaya / Uang Keluar</div>
        <div style="font-size: 18px; font-weight: 900; color: #e11d48;">-${formatRupiah(totalAmount)}</div>
      </div>
    </div>

    <table style="width: 100%; font-size: 10px; border-collapse: collapse; border: 1px solid #e2e8f0; margin-bottom: 16px;">
      <thead>
        <tr style="background: #f1f5f9; text-align: left;">
          <th style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">Tanggal & Waktu</th>
          <th style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">Kategori</th>
          <th style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">Keterangan Rincian</th>
          <th style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">Nominal (Rp)</th>
          <th style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">Dicatat</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(item => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 8px; font-family: monospace; color: #64748b;">${formatDateTime(item.date)}</td>
            <td style="padding: 6px 8px; font-weight: 700; color: #e11d48;">${escapeHtml(item.category)}</td>
            <td style="padding: 6px 8px;">${escapeHtml(item.description)}</td>
            <td style="padding: 6px 8px; text-align: right; font-weight: 700; font-family: monospace; color: #e11d48;">-${formatRupiah(item.amount)}</td>
            <td style="padding: 6px 8px; color: #64748b;">${escapeHtml(item.recordedBy || 'Admin')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between;">
      <span>Dokumen Resmi Buku Kas • WarungKu POS</span>
      <span>Dicetak: ${formatDateTime(getLocalISOString())}</span>
    </div>
  `;

  document.body.appendChild(wrapper);
  window.store.showRealtimeToast(`📄 Menyiapkan file PDF Buku Kas: "${targetFilename}"...`);

  const opt = {
    margin: [10, 10, 10, 10],
    filename: targetFilename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    if (typeof html2pdf !== 'undefined') {
      await html2pdf().set(opt).from(wrapper).save();
      window.store.showRealtimeToast(`✅ File PDF Buku Kas "${targetFilename}" berhasil diunduh!`);
    } else {
      window.print();
    }
  } catch (err) {
    alert("Gagal membuat PDF: " + err.message);
  } finally {
    document.body.removeChild(wrapper);
  }
}

async function confirmDeleteFinancialReport(reportId, reportLabel) {
  if (confirm(`Apakah Anda yakin ingin menghapus laporan "${reportLabel}"?`)) {
    const res = await window.store.deleteFinancialReport(reportId);
    if (res.success) {
      closeModal();
      window.renderApp();
      window.store.showRealtimeToast("🗑️ Laporan berhasil dihapus.");
    } else {
      alert(res.message || "Gagal menghapus laporan.");
    }
  }
}

// Modal: Add Expense
function openAddExpenseModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in zoom-in-95 duration-150">
        
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 class="font-bold text-base text-slate-800 dark:text-white flex items-center space-x-2">
            <i data-lucide="receipt-text" class="w-5 h-5 text-rose-500"></i>
            <span>Catat Pengeluaran Toko</span>
          </h3>
          <button onclick="closeModal()" class="p-1.5 text-slate-400 hover:text-slate-600">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <form onsubmit="handleSaveExpense(event)" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Kategori Pengeluaran *</label>
            <select 
              name="category"
              required
              class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="Operasional">Operasional & Kantong Plastik</option>
              <option value="Stok Barang">Stok Barang (Belanja Grosir)</option>
              <option value="Listrik & Air">Listrik & Air Toko</option>
              <option value="Gaji Karyawan">Gaji Karyawan / Uang Makan</option>
              <option value="Sewa Tempat">Sewa Tempat / Lapak</option>
              <option value="Lainnya">Lain-lain</option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Keterangan / Rincian *</label>
            <input 
              type="text" 
              name="description" 
              required
              placeholder="Contoh: Beli token listrik 100rb & kresek mini"
              class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Nominal Pengeluaran (Rp) *</label>
            <div class="relative">
              <span class="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</span>
              <input 
                type="number" 
                name="amount" 
                required
                min="1"
                placeholder="50000"
                class="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
            <button type="button" onclick="closeModal()" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold">Batal</button>
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md shadow-rose-600/20">Simpan Pengeluaran</button>
          </div>
        </form>

      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function handleSaveExpense(e) {
  e.preventDefault();
  const form = e.target;
  window.store.addExpense({
    category: form.category.value,
    description: form.description.value.trim(),
    amount: form.amount.value
  });
  closeModal();
  window.renderApp();
}

function confirmDeleteExpense(id) {
  if (confirm("Hapus catatan pengeluaran ini?")) {
    window.store.deleteExpense(id);
    window.renderApp();
  }
}
