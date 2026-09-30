/**
 * WARUNGKU POS - ADMIN TRANSACTIONS HISTORY & REPORT COMPONENT
 */

let trxSearchQuery = '';
let trxPaymentFilter = 'all';

function renderAdminTransactions() {
  const store = window.store;

  const filtered = store.transactions.filter(t => {
    const matchPayment = trxPaymentFilter === 'all' || t.paymentMethod === trxPaymentFilter;
    const matchSearch = t.id.toLowerCase().includes(trxSearchQuery.toLowerCase()) ||
                        (t.customerName && t.customerName.toLowerCase().includes(trxSearchQuery.toLowerCase())) ||
                        (t.cashier && t.cashier.toLowerCase().includes(trxSearchQuery.toLowerCase()));
    return matchPayment && matchSearch;
  });

  const totalOmset = filtered.reduce((acc, t) => acc + t.total, 0);
  const totalLaba = filtered.reduce((acc, t) => acc + (t.profit || 0), 0);

  return `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-8">
      
      <!-- Top Actions Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <i data-lucide="receipt" class="w-6 h-6 text-indigo-600 dark:text-indigo-400"></i>
            <span>Riwayat Transaksi Penjualan</span>
          </h2>
          <p class="text-xs text-slate-400 mt-0.5">Daftar semua struk transaksi kasir, detail item pembelian, dan cetak ulang nota.</p>
        </div>

        <button 
          onclick="exportTransactionsCSV()"
          class="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20 transition self-start sm:self-auto"
        >
          <i data-lucide="file-spreadsheet" class="w-4 h-4"></i>
          <span>Export Laporan Excel (CSV)</span>
        </button>
      </div>

      <!-- Filters & Summary Bar -->
      <div class="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-1">
          <div class="relative flex-1">
            <i data-lucide="search" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
            <input 
              type="text" 
              placeholder="Cari No. Nota / Pelanggan / Kasir..."
              value="${trxSearchQuery}"
              oninput="trxSearchQuery = this.value; window.renderApp();"
              class="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select 
            onchange="trxPaymentFilter = this.value; window.renderApp();"
            class="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none"
          >
            <option value="all">Semua Metode Bayar</option>
            <option value="cash" ${trxPaymentFilter === 'cash' ? 'selected' : ''}>Tunai (Cash)</option>
            <option value="qris" ${trxPaymentFilter === 'qris' ? 'selected' : ''}>QRIS</option>
            <option value="transfer" ${trxPaymentFilter === 'transfer' ? 'selected' : ''}>Transfer / E-Wallet</option>
          </select>
        </div>

        <div class="flex items-center space-x-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <div>Total Transaksi: <span class="font-bold text-slate-900 dark:text-white">${filtered.length}</span></div>
          <div>Total Omset: <span class="font-bold text-emerald-600 dark:text-emerald-400">${formatRupiah(totalOmset)}</span></div>
          <div>Total Laba: <span class="font-bold text-indigo-600 dark:text-indigo-400">${formatRupiah(totalLaba)}</span></div>
        </div>
      </div>

      <!-- Transactions Table -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="py-3.5 px-4">No. Nota</th>
                <th class="py-3.5 px-4">Tanggal</th>
                <th class="py-3.5 px-4">Kasir / Pelanggan</th>
                <th class="py-3.5 px-4">Total Item</th>
                <th class="py-3.5 px-4">Metode Bayar</th>
                <th class="py-3.5 px-4 text-right">Total Transaksi</th>
                <th class="py-3.5 px-4 text-right">Laba / Profit</th>
                <th class="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              ${filtered.length > 0 ? filtered.map(t => {
                const totalItems = t.items.reduce((sum, i) => sum + i.qty, 0);

                return `
                  <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">${t.id}</td>
                    <td class="py-3 px-4 font-mono text-slate-500">${formatDateTime(t.date)}</td>
                    <td class="py-3 px-4">
                      <div class="font-semibold">${t.customerName || 'Umum'}</div>
                      <div class="text-[10px] text-slate-400">${t.cashier}</div>
                    </td>
                    <td class="py-3 px-4 font-medium">${totalItems} item</td>
                    <td class="py-3 px-4">
                      <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                        t.paymentMethod === 'cash' 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' 
                          : t.paymentMethod === 'qris' 
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' 
                            : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      }">
                        ${t.paymentMethod}
                      </span>
                    </td>
                    <td class="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">${formatRupiah(t.total)}</td>
                    <td class="py-3 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">+${formatRupiah(t.profit)}</td>
                    <td class="py-3 px-4 text-center">
                      <button 
                        onclick="openReceiptModal(${JSON.stringify(t).replace(/"/g, '&quot;')})"
                        title="Lihat / Cetak Ulang Struk"
                        class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                      >
                        <i data-lucide="printer" class="w-4 h-4"></i>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="8" class="py-12 text-center text-slate-400">Tidak ada riwayat transaksi ditemukan.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

function exportTransactionsCSV() {
  const store = window.store;
  if (store.transactions.length === 0) {
    alert("Belum ada transaksi untuk diexport!");
    return;
  }

  let csv = "No. Nota,Tanggal,Kasir,Pelanggan,Total Item,Subtotal,Diskon,Total Bayar,Laba,Metode Bayar\n";
  store.transactions.forEach(t => {
    const totalItems = t.items.reduce((s, i) => s + i.qty, 0);
    const dateFormatted = `"${formatDateTime(t.date)}"`;
    csv += `"${t.id}",${dateFormatted},"${t.cashier}","${t.customerName || 'Umum'}",${totalItems},${t.subtotal},${t.discount},${t.total},${t.profit || 0},"${t.paymentMethod}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laporan_penjualan_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
