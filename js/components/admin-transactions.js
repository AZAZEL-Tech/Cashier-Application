/**
 * WARUNGKU POS - ADMIN TRANSACTIONS HISTORY & REPORT COMPONENT
 */

let trxSearchQuery = '';
let trxPaymentFilter = 'all';
let trxDateFilter = 'today'; // 'today' | 'custom' | '7days' | 'month' | 'all'
let trxCustomDate = getLocalDateKey(new Date());

function setTrxCalendarDate(dateVal) {
  if (!dateVal) return;
  trxCustomDate = dateVal;
  trxDateFilter = 'custom';
  window.renderApp();
}

function shiftTrxDate(deltaDays) {
  try {
    const base = trxCustomDate || getLocalDateKey(new Date());
    const parts = base.split('-');
    const curDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    curDate.setDate(curDate.getDate() + deltaDays);
    trxCustomDate = getLocalDateKey(curDate);
    trxDateFilter = 'custom';
    window.renderApp();
  } catch (e) {
    trxCustomDate = getLocalDateKey(new Date());
    trxDateFilter = 'custom';
    window.renderApp();
  }
}

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
    } else if (trxDateFilter === 'custom') {
      matchDate = getLocalDateKey(t.date) === trxCustomDate;
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

  const activeFiltered = filtered.filter(t => t.status !== 'void');
  const voidFiltered = filtered.filter(t => t.status === 'void');
  const totalOmset = activeFiltered.reduce((acc, t) => acc + Number(t.total || 0), 0);
  const totalLaba = activeFiltered.reduce((acc, t) => acc + Number(t.profit || 0), 0);
  const totalItemsSold = activeFiltered.reduce((acc, t) => {
    const items = t.items || [];
    return acc + items.reduce((sum, i) => sum + Number(i.qty || 0), 0);
  }, 0);

  // Label periode terpilih
  let periodLabel = 'Hari Ini';
  if (trxDateFilter === 'all') periodLabel = 'Semua Waktu';
  else if (trxDateFilter === '7days') periodLabel = '7 Hari Terakhir';
  else if (trxDateFilter === 'month') periodLabel = 'Bulan Ini';
  else if (trxDateFilter === 'custom') {
    try {
      const parts = trxCustomDate.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      periodLabel = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      periodLabel = trxCustomDate;
    }
  }

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

      <!-- Date Navigator & Quick Filters Bar -->
      <div class="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        
        <!-- Date Selector with Prev / Next & Calendar Picker -->
        <div class="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span class="text-xs font-bold text-slate-500 flex items-center space-x-1.5 shrink-0">
            <i data-lucide="calendar" class="w-4 h-4 text-indigo-600"></i>
            <span>Pilih Tanggal:</span>
          </span>

          <div class="flex items-center space-x-1">
            <button 
              type="button"
              onclick="shiftTrxDate(-1)"
              class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 transition"
              title="Hari Sebelumnya"
            >
              <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>

            <input 
              type="date"
              value="${escapeHtml(trxDateFilter === 'custom' ? trxCustomDate : todayKey)}"
              onchange="setTrxCalendarDate(this.value)"
              class="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <button 
              type="button"
              onclick="shiftTrxDate(1)"
              class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 transition"
              title="Hari Berikutnya"
            >
              <i data-lucide="chevron-right" class="w-4 h-4"></i>
            </button>
          </div>

          <div class="flex items-center space-x-1">
            <button 
              type="button"
              onclick="trxDateFilter = 'today'; trxCustomDate = '${todayKey}'; window.renderApp();"
              class="px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                trxDateFilter === 'today'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }"
            >
              Hari Ini
            </button>

            <button 
              type="button"
              onclick="trxDateFilter = '7days'; window.renderApp();"
              class="px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                trxDateFilter === '7days'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }"
            >
              7 Hari
            </button>

            <button 
              type="button"
              onclick="trxDateFilter = 'month'; window.renderApp();"
              class="px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                trxDateFilter === 'month'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }"
            >
              Bulan Ini
            </button>

            <button 
              type="button"
              onclick="trxDateFilter = 'all'; window.renderApp();"
              class="px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                trxDateFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }"
            >
              Semua
            </button>
          </div>
        </div>

        <!-- Search & Payment Method Filter -->
        <div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div class="relative flex-1 sm:w-60">
            <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"></i>
            <input 
              type="text" 
              id="admin-trx-search"
              placeholder="Cari No. Nota / Pelanggan..."
              value="${escapeHtml(trxSearchQuery)}"
              oninput="trxSearchQuery = this.value; window.debouncedRenderApp();"
              class="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select 
            onchange="trxPaymentFilter = this.value; window.renderApp();"
            class="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-bold focus:outline-none"
          >
            <option value="all">Semua Metode</option>
            <option value="cash" ${trxPaymentFilter === 'cash' ? 'selected' : ''}>💵 Tunai</option>
            <option value="qris" ${trxPaymentFilter === 'qris' ? 'selected' : ''}>📱 QRIS</option>
            <option value="transfer" ${trxPaymentFilter === 'transfer' ? 'selected' : ''}>🏦 Transfer / Bank</option>
          </select>
        </div>

      </div>

      <!-- Summary Pills (Total Struk, Total Omset, Item Terjual, Void, Total Laba) -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div class="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span class="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Total Struk</span>
          <span class="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">${activeFiltered.length} struk</span>
          <span class="text-[10px] text-slate-400 block mt-0.5 truncate">${escapeHtml(periodLabel)}</span>
        </div>

        <div class="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 shadow-sm">
          <span class="text-[10px] text-emerald-600 dark:text-emerald-400 block font-bold uppercase tracking-wider">Total Omset</span>
          <span class="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">${formatRupiah(totalOmset)}</span>
          <span class="text-[10px] text-slate-400 block mt-0.5">Penjualan bersih</span>
        </div>

        <div class="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span class="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Item Terjual</span>
          <span class="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">${totalItemsSold} pcs</span>
          <span class="text-[10px] text-slate-400 block mt-0.5">Total kuantitas barang</span>
        </div>

        <div class="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-rose-200/60 dark:border-rose-900/40 shadow-sm">
          <span class="text-[10px] text-rose-600 dark:text-rose-400 block font-bold uppercase tracking-wider">Transaksi Void</span>
          <span class="text-base sm:text-lg font-black ${voidFiltered.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'} font-mono">${voidFiltered.length} nota</span>
          <span class="text-[10px] text-slate-400 block mt-0.5">Dibatalkan / retur</span>
        </div>

        <div class="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40 shadow-sm col-span-2 sm:col-span-1">
          <span class="text-[10px] text-indigo-600 dark:text-indigo-400 block font-bold uppercase tracking-wider">Laba Bersih</span>
          <span class="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">${formatRupiah(totalLaba)}</span>
          <span class="text-[10px] text-slate-400 block mt-0.5">Omset - HPP</span>
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
    const isVoid = t.status === 'void';

    return `
                  <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${isVoid ? 'opacity-60 bg-rose-50/20 dark:bg-rose-950/10' : ''}">
                    <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      <div class="flex items-center space-x-1.5">
                        <span class="${isVoid ? 'line-through text-slate-400' : ''}">${escapeHtml(t.id)}</span>
                        ${isVoid ? `<span class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-[9px] font-extrabold uppercase">VOID</span>` : ''}
                      </div>
                    </td>
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
                      <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${t.paymentMethod === 'cash'
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
        : t.paymentMethod === 'qris'
          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
          : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
      }">
                        ${escapeHtml(t.paymentMethod)}
                      </span>
                    </td>
                    <td class="py-3 px-4 text-right font-mono font-bold ${isVoid ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}">${formatRupiah(t.total)}</td>
                    <td class="py-3 px-4 text-right font-mono font-semibold ${isVoid ? 'line-through text-slate-400' : 'text-emerald-600 dark:text-emerald-400'}">${isVoid ? 'Rp 0 (Void)' : `${t.profit >= 0 ? '+' : ''}${formatRupiah(t.profit)}`}</td>
                    <td class="py-3 px-4 text-center">
                      <div class="flex items-center justify-center space-x-1.5">
                        <button 
                          onclick="openReceiptModalById('${t.id}')"
                          title="Lihat / Cetak Ulang Struk"
                          class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                        >
                          <i data-lucide="printer" class="w-4 h-4"></i>
                        </button>
                        ${!isVoid ? `
                          <button 
                            onclick="confirmVoidTransaction('${t.id}')"
                            title="Void / Batalkan Transaksi & Kembalikan Stok (Audit Trail)"
                            class="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 transition"
                          >
                            <i data-lucide="ban" class="w-4 h-4"></i>
                          </button>
                        ` : `
                          <span class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-bold" title="Transaksi telah dibatalkan (Void)">
                            Dibatalkan
                          </span>
                        `}
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
  const reason = prompt(`Masukkan alasan pembatalan (VOID) untuk nota "${trxId}":\n(Stok barang akan dikembalikan & riwayat transaksi tetap tersimpan dengan status VOID untuk audit)`, 'Salah input item / pembatalan pelanggan');
  if (reason === null) return;
  await window.store.voidTransaction(trxId, reason.trim() || 'Dibatalkan oleh Admin');
  window.renderApp();
  window.store.showRealtimeToast(`🔄 Transaksi ${trxId} ditandai VOID & stok dikembalikan.`);
}

function exportTransactionsCSV() {
  const store = window.store;
  if (store.transactions.length === 0) {
    alert("Belum ada transaksi untuk diexport!");
    return;
  }

  let csv = "\uFEFFNo. Nota,Tanggal,Status,Kasir,Pelanggan,Total Item,Subtotal,Diskon,PPN,Total Bayar,Modal HPP,Laba,Metode Bayar\n";
  store.transactions.forEach(t => {
    const totalItems = (t.items || []).reduce((s, i) => s + Number(i.qty || 0), 0);
    const dateFormatted = `"${formatDateTime(t.date)}"`;
    const statusLabel = (t.status || 'completed').toUpperCase();
    csv += `"${t.id}",${dateFormatted},"${statusLabel}","${(t.cashier || '').replace(/"/g, '""')}","${(t.customerName || 'Umum').replace(/"/g, '""')}",${totalItems},${t.subtotal || 0},${t.discount || 0},${t.tax || 0},${t.total || 0},${t.totalCost || 0},${t.profit || 0},"${t.paymentMethod}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laporan_penjualan_${getLocalDateKey(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
