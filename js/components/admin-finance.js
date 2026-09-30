/**
 * WARUNGKU POS - ADMIN FINANCE, EXPENSES & PROFIT/LOSS COMPONENT
 */

let expenseCategoryFilter = 'all';

function renderAdminFinance() {
  const store = window.store;

  // Calculate financials
  const totalRevenue = store.transactions.reduce((acc, t) => acc + t.total, 0);
  const totalCostOfGoods = store.transactions.reduce((acc, t) => acc + (t.totalCost || 0), 0);
  const grossProfit = totalRevenue - totalCostOfGoods;
  const totalExpenses = store.expenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = grossProfit - totalExpenses;

  // Filter expenses
  const filteredExpenses = store.expenses.filter(e => {
    return expenseCategoryFilter === 'all' || e.category === expenseCategoryFilter;
  });

  return `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-8">
      
      <!-- Top Actions Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <i data-lucide="wallet" class="w-6 h-6 text-indigo-600 dark:text-indigo-400"></i>
            <span>Buku Kas & Laporan Laba Rugi</span>
          </h2>
          <p class="text-xs text-slate-400 mt-0.5">Pantau arus kas toko, biaya operasional, belanja stok, dan kalkulasi profit bersih.</p>
        </div>

        <button 
          onclick="openAddExpenseModal()" 
          class="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-rose-600/20 transition self-start sm:self-auto"
        >
          <i data-lucide="plus-circle" class="w-4 h-4"></i>
          <span>Catat Pengeluaran Baru</span>
        </button>
      </div>

      <!-- Financial Profit & Loss Statement Summary -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 class="font-bold text-sm text-slate-800 dark:text-white mb-4 flex items-center space-x-2">
          <i data-lucide="calculator" class="w-4 h-4 text-emerald-600"></i>
          <span>Kalkulasi Laba / Rugi Toko Realtime</span>
        </h3>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
          
          <div class="pt-2 sm:pt-0 sm:pr-4">
            <span class="text-xs font-semibold text-slate-400 block mb-1">(+) Total Penjualan (Omset)</span>
            <span class="text-xl font-extrabold text-slate-900 dark:text-white">${formatRupiah(totalRevenue)}</span>
            <span class="text-[11px] text-slate-400 block mt-1">Dari ${store.transactions.length} transaksi</span>
          </div>

          <div class="pt-3 sm:pt-0 sm:px-4">
            <span class="text-xs font-semibold text-slate-400 block mb-1">(-) Modal Pokok Barang (HPP)</span>
            <span class="text-xl font-extrabold text-slate-700 dark:text-slate-300">${formatRupiah(totalCostOfGoods)}</span>
            <span class="text-[11px] text-emerald-600 font-semibold block mt-1">Laba Kotor: ${formatRupiah(grossProfit)}</span>
          </div>

          <div class="pt-3 sm:pt-0 sm:px-4">
            <span class="text-xs font-semibold text-slate-400 block mb-1">(-) Biaya & Pengeluaran Toko</span>
            <span class="text-xl font-extrabold text-rose-600 dark:text-rose-400">${formatRupiah(totalExpenses)}</span>
            <span class="text-[11px] text-slate-400 block mt-1">Operasional, listrik, restock, dll</span>
          </div>

          <div class="pt-3 sm:pt-0 sm:pl-4">
            <span class="text-xs font-semibold text-slate-400 block mb-1">(=) Keuntungan Bersih (Net Profit)</span>
            <span class="text-2xl font-extrabold ${netProfit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}">
              ${formatRupiah(netProfit)}
            </span>
            <span class="text-[11px] font-semibold ${netProfit >= 0 ? 'text-indigo-500' : 'text-rose-500'} block mt-1">
              ${netProfit >= 0 ? 'Margin Profit Toko Positif' : 'Perlu Evaluasi Pengeluaran'}
            </span>
          </div>

        </div>
      </div>

      <!-- Expense List & Filters -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        
        <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center space-x-2">
            <h3 class="font-bold text-sm text-slate-800 dark:text-white">Daftar Pengeluaran & Biaya</h3>
            <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              ${filteredExpenses.length} catatan
            </span>
          </div>

          <!-- Category filter -->
          <div class="flex items-center space-x-2">
            <span class="text-xs text-slate-400">Filter Kategori:</span>
            <select 
              onchange="expenseCategoryFilter = this.value; window.renderApp();"
              class="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none"
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
                      ${item.category}
                    </span>
                  </td>
                  <td class="py-3 px-4 font-medium text-slate-800 dark:text-slate-100">${item.description}</td>
                  <td class="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                    -${formatRupiah(item.amount)}
                  </td>
                  <td class="py-3 px-4 text-slate-400">${item.recordedBy || 'Admin'}</td>
                  <td class="py-3 px-4 text-center">
                    <button 
                      onclick="confirmDeleteExpense('${item.id}')"
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

    </div>
  `;
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

  lucide.createIcons();
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
