/**
 * WARUNGKU POS - ADMIN TRANSACTIONS HISTORY & REPORT COMPONENT
 */

let trxSearchQuery = '';
let trxPaymentFilter = 'all';
let trxDateFilter = 'all'; // 'all' | 'today' | '7days' | 'month'

function renderAdminTransactions() {
  const store = window.store;
  const now = new Date();
  const todayKey = getLocalDateKey(now);

  const filtered = store.transactions.filter(t => {
    const matchPayment = trxPaymentFilter === 'all' || t.paymentMethod === trxPaymentFilter;
    const matchSearch = t.id.toLowerCase().includes(trxSearchQuery.toLowerCase()) ||
                        (t.customerName && t.customerName.toLowerCase().includes(trxSearchQuery.toLowerCase())) ||
                        (t.cashier && t.cashier.toLowerCase().includes(trxSearchQuery.toLowerCase()));

    let matchDate = true;
    if (trxDateFilter === 'today') {
      matchDate = getLocalDateKey(t.date) === todayKey;
    } else if (trxDateFilter === '7days') {
      const d = new Date(t.date);
      const diffDays = (now - d) / (1000 * 60 * 60 * 24);
      matchDate = diffDays <= 7;
    } else if (trxDateFilter === 'month') {
      const d = new Date(t.date);
      matchDate = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }

    return matchPayment && matchSearch && matchDate;
  });

  const totalOmset = filtered.reduce((acc, t) => acc + Number(t.total || 0), 0);
  const totalLaba = filtered.reduce((acc, t) => acc + Number(t.profit || 0), 0);

  return `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-8">
      
      <!-- Top Actions Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <i data-lucide="receipt" class="w-6 h-6 text-indigo-600 dark:text-indigo-400"></i>
            <span>Riwayat Transaksi Penjualan</span>
          </h2>
          <p class="text-xs text-slate-400 mt-0.5">Daftar semua struk transaksi kasir, detail item pembelian, cetak ulang nota, atau batalkan transaksi.</p>
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
      <div class="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row gap-3 items-center justify-between">
        <div class="flex flex-col sm:flex-row gap-2 w-full lg:w-auto flex-1">
          <div class="relative flex-1">
            <i data-lucide="search" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
            <input 
              type="text" 
              id="admin-trx-search"
              placeholder="Cari No. Nota / Pelanggan / Kasir..."
              value="${escapeHtml(trxSearchQuery)}"
              oninput="trxSearchQuery = this.value; window.renderApp();"
              class="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select 
            onchange="trxDateFilter = this.value; window.renderApp();"
            class="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none"
          >
            <option value="all" ${trxDateFilter === 'all' ? 'selected' : ''}>Semua Waktu</option>
            <option value="today" ${trxDateFilter === 'today' ? 'selected' : ''}>Hari Ini</option>
            <option value="7days" ${trxDateFilter === '7days' ? 'selected' : ''}>7 Hari Terakhir</option>
            <option value="month" ${trxDateFilter === 'month' ? 'selected' : ''}>Bulan Ini</option>
          </select>

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

        <div class="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
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
                <th class="py-3.5 px-4">Rincian Item</th>
                <th class="py-3.5 px-4">Metode Bayar</th>
                <th class="py-3.5 px-4 text-right">Total Transaksi</th>
                <th class="py-3.5 px-4 text-right">Laba / Profit</th>
                <th class="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              ${filtered.length > 0 ? filtered.map(t => {
                const items = t.items || [];
                const totalItems = items.reduce((sum, i) => sum + Number(i.qty || 0), 0);
                const itemSummary = items.slice(0, 2).map(i => `${i.name} (x${i.qty})`).join(', ') + (items.length > 2 ? ` +${items.length - 2} lainnya` : '');

                return `
                  <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">${escapeHtml(t.id)}</td>
                    <td class="py-3 px-4 font-mono text-slate-500">${formatDateTime(t.date)}</td>
                    <td class="py-3 px-4">
                      <div class="font-semibold">${escapeHtml(t.customerName || 'Umum')}</div>
                      <div class="text-[10px] text-slate-400">${escapeHtml(t.cashier)}</div>
                    </td>
                    <td class="py-3 px-4">
                      <div class="font-semibold text-slate-800 dark:text-slate-200">${totalItems} item</div>
                      <div class="text-[10px] text-slate-400 truncate max-w-[200px]" title="${escapeHtml(itemSummary)}">${escapeHtml(itemSummary)}</div>
                    </td>
                    <td class="py-3 px-4">
                      <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                        t.paymentMethod === 'cash' 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' 
                          : t.paymentMethod === 'qris' 
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' 
                            : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      }">
                        ${escapeHtml(t.paymentMethod)}
                      </span>
                    </td>
                    <td class="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">${formatRupiah(t.total)}</td>
                    <td class="py-3 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">${t.profit >= 0 ? '+' : ''}${formatRupiah(t.profit)}</td>
                    <td class="py-3 px-4 text-center">
                      <div class="flex items-center justify-center space-x-1.5">
                        <button 
                          onclick="openReceiptModalById('${t.id}')"
                          title="Lihat / Cetak Ulang Struk"
                          class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                        >
                          <i data-lucide="printer" class="w-4 h-4"></i>
                        </button>
                        <button 
                          onclick="confirmVoidTransaction('${t.id}')"
                          title="Batalkan Transaksi & Kembalikan Stok"
                          class="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 transition"
                        >
                          <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                      </div>
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

async function confirmVoidTransaction(trxId) {
  if (confirm(`Batalkan & hapus transaksi "${trxId}"?\nStok barang pada nota ini akan otomatis dikembalikan ke stok gudang.`)) {
    await window.store.deleteTransaction(trxId);
    window.renderApp();
    window.store.showRealtimeToast(`🔄 Transaksi ${trxId} dibatalkan & stok dikembalikan.`);
  }
}

function exportTransactionsCSV() {
  const store = window.store;
  if (store.transactions.length === 0) {
    alert("Belum ada transaksi untuk diexport!");
    return;
  }

  let csv = "\uFEFFNo. Nota,Tanggal,Kasir,Pelanggan,Total Item,Subtotal,Diskon,PPN,Total Bayar,Modal HPP,Laba,Metode Bayar\n";
  store.transactions.forEach(t => {
    const totalItems = (t.items || []).reduce((s, i) => s + Number(i.qty || 0), 0);
    const dateFormatted = `"${formatDateTime(t.date)}"`;
    csv += `"${t.id}",${dateFormatted},"${(t.cashier || '').replace(/"/g, '""')}","${(t.customerName || 'Umum').replace(/"/g, '""')}",${totalItems},${t.subtotal || 0},${t.discount || 0},${t.tax || 0},${t.total || 0},${t.totalCost || 0},${t.profit || 0},"${t.paymentMethod}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laporan_penjualan_${getLocalDateKey(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
