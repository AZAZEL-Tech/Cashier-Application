/**
 * WARUNGKU POS - ADMIN DASHBOARD & ANALYTICS COMPONENT
 */

function renderAdminDashboard() {
  const store = window.store;

  // Calculate statistics
  const now = new Date();
  const todayDateStr = now.toISOString().split('T')[0];

  // Transactions metrics
  const totalRevenue = store.transactions.reduce((acc, t) => acc + t.total, 0);
  const totalGrossProfit = store.transactions.reduce((acc, t) => acc + (t.profit || 0), 0);
  const totalExpenses = store.expenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = totalGrossProfit - totalExpenses;
  const totalTransactions = store.transactions.length;
  const totalItemsSold = store.transactions.reduce((acc, t) => acc + t.items.reduce((sum, i) => sum + i.qty, 0), 0);

  // Today's metrics
  const todayTransactions = store.transactions.filter(t => t.date.startsWith(todayDateStr));
  const todayRevenue = todayTransactions.reduce((acc, t) => acc + t.total, 0);
  const todayExpenses = store.expenses.filter(e => e.date.startsWith(todayDateStr)).reduce((acc, e) => acc + e.amount, 0);
  const todayGrossProfit = todayTransactions.reduce((acc, t) => acc + (t.profit || 0), 0);
  const todayNetProfit = todayGrossProfit - todayExpenses;

  // Low stock products
  const lowStockProducts = store.products.filter(p => p.stock <= p.minStock);

  // Top selling products calculation
  const productSalesMap = {};
  store.transactions.forEach(t => {
    t.items.forEach(i => {
      if (!productSalesMap[i.id]) {
        productSalesMap[i.id] = { name: i.name, qty: 0, revenue: 0 };
      }
      productSalesMap[i.id].qty += i.qty;
      productSalesMap[i.id].revenue += i.subtotal;
    });
  });
  const topSelling = Object.values(productSalesMap).sort((a, b) => b.qty - a.qty).slice(0, 5);

  return `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-8">
      
      <!-- Welcome & Quick Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
        <div>
          <span class="px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
            Admin Backoffice
          </span>
          <h2 class="text-2xl font-bold mt-2">Ringkasan Bisnis & Keuangan</h2>
          <p class="text-xs text-slate-300 mt-1">Pantau omset, arus kas keluar-masuk, stok gudang, dan laba bersih toko secara realtime.</p>
        </div>
        <div class="flex items-center space-x-2">
          <button onclick="navigate('pos')" class="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 transition">
            <i data-lucide="shopping-cart" class="w-4 h-4"></i>
            <span>Buka Kasir POS</span>
          </button>
          <button onclick="openAddExpenseModal()" class="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center space-x-1.5 transition">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>Catat Pengeluaran</span>
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards (Grid) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <!-- Card 1: Total Pemasukan / Omset -->
        <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-xs font-semibold">Total Pemasukan (Omset)</span>
            <div class="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <i data-lucide="trending-up" class="w-5 h-5"></i>
            </div>
          </div>
          <div class="mt-3">
            <h3 class="text-2xl font-extrabold text-slate-900 dark:text-white">${formatRupiah(totalRevenue)}</h3>
            <p class="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center space-x-1">
              <i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i>
              <span>Hari ini: ${formatRupiah(todayRevenue)}</span>
            </p>
          </div>
        </div>

        <!-- Card 2: Total Pengeluaran Uang -->
        <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-xs font-semibold">Total Pengeluaran Toko</span>
            <div class="w-9 h-9 rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <i data-lucide="arrow-down-right" class="w-5 h-5"></i>
            </div>
          </div>
          <div class="mt-3">
            <h3 class="text-2xl font-extrabold text-slate-900 dark:text-white">${formatRupiah(totalExpenses)}</h3>
            <p class="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-1 flex items-center space-x-1">
              <i data-lucide="arrow-down-right" class="w-3.5 h-3.5"></i>
              <span>Hari ini: ${formatRupiah(todayExpenses)}</span>
            </p>
          </div>
        </div>

        <!-- Card 3: Keuntungan Bersih (Net Profit) -->
        <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-xs font-semibold">Keuntungan Bersih (Net)</span>
            <div class="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <i data-lucide="badge-percent" class="w-5 h-5"></i>
            </div>
          </div>
          <div class="mt-3">
            <h3 class="text-2xl font-extrabold ${netProfit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}">
              ${formatRupiah(netProfit)}
            </h3>
            <p class="text-xs text-slate-400 mt-1">
              Hari ini: <span class="font-bold ${todayNetProfit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}">${formatRupiah(todayNetProfit)}</span>
            </p>
          </div>
        </div>

        <!-- Card 4: Total Transaksi & Item Terjual -->
        <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-xs font-semibold">Total Transaksi</span>
            <div class="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <i data-lucide="receipt" class="w-5 h-5"></i>
            </div>
          </div>
          <div class="mt-3">
            <h3 class="text-2xl font-extrabold text-slate-900 dark:text-white">${totalTransactions} Struk</h3>
            <p class="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1">
              ${totalItemsSold} item barang terjual
            </p>
          </div>
        </div>

      </div>

      <!-- Main Analytics Section (Chart & Low Stock Warning) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <!-- Left: Sales Chart (8 Cols) -->
        <div class="lg:col-span-8 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-bold text-base text-slate-800 dark:text-white">Tren Penjualan & Keuntungan</h3>
              <p class="text-xs text-slate-400">Grafik omset harian vs laba toko</p>
            </div>
            <span class="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300">
              7 Hari Terakhir
            </span>
          </div>

          <div class="h-64 sm:h-72 w-full relative">
            <canvas id="salesChart"></canvas>
          </div>
        </div>

        <!-- Right: Low Stock Alert & Top Selling (4 Cols) -->
        <div class="lg:col-span-4 space-y-6">
          
          <!-- Low Stock Alert Card -->
          <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="font-bold text-sm text-slate-800 dark:text-white flex items-center space-x-2">
                <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-500"></i>
                <span>Peringatan Stok Menipis</span>
              </h3>
              <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                ${lowStockProducts.length}
              </span>
            </div>

            <div class="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto pr-1">
              ${lowStockProducts.length > 0 ? lowStockProducts.map(p => `
                <div class="py-2.5 flex items-center justify-between">
                  <div class="min-w-0 pr-2">
                    <h5 class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">${p.name}</h5>
                    <p class="text-[11px] text-rose-500 font-semibold">Sisa: ${p.stock} ${p.unit} (Min: ${p.minStock})</p>
                  </div>
                  <button 
                    onclick="openRestockModal('${p.id}')"
                    class="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 text-xs font-bold transition flex items-center space-x-1"
                  >
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    <span>Restock</span>
                  </button>
                </div>
              `).join('') : `
                <div class="py-6 text-center text-slate-400 text-xs">
                  <i data-lucide="check-circle-2" class="w-8 h-8 mx-auto text-emerald-500 mb-1"></i>
                  <span>Semua stok barang dalam kondisi aman.</span>
                </div>
              `}
            </div>
          </div>

          <!-- Top Selling Items Card -->
          <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 class="font-bold text-sm text-slate-800 dark:text-white flex items-center space-x-2">
              <i data-lucide="award" class="w-4 h-4 text-indigo-500"></i>
              <span>Produk Terlaris</span>
            </h3>

            <div class="divide-y divide-slate-100 dark:divide-slate-800">
              ${topSelling.length > 0 ? topSelling.map((item, idx) => `
                <div class="py-2 flex items-center justify-between">
                  <div class="flex items-center space-x-2 min-w-0">
                    <span class="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center">
                      ${idx + 1}
                    </span>
                    <span class="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">${item.name}</span>
                  </div>
                  <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                    ${item.qty} terjual
                  </span>
                </div>
              `).join('') : `
                <div class="py-4 text-center text-slate-400 text-xs">Belum ada data penjualan</div>
              `}
            </div>
          </div>

        </div>

      </div>

    </div>
  `;
}

// Chart.js Renderer
function initSalesChart() {
  const canvas = document.getElementById('salesChart');
  if (!canvas) return;

  const store = window.store;
  const isDark = store.isDark;

  // Build last 7 days labels & values
  const labels = [];
  const revenueData = [];
  const profitData = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
    labels.push(label);

    const dayTrxs = store.transactions.filter(t => t.date.startsWith(dateStr));
    const dayRev = dayTrxs.reduce((sum, t) => sum + t.total, 0);
    const dayProf = dayTrxs.reduce((sum, t) => sum + (t.profit || 0), 0);

    revenueData.push(dayRev);
    profitData.push(dayProf);
  }

  // Destroy previous chart if exists
  if (window._salesChartInstance) {
    window._salesChartInstance.destroy();
  }

  if (typeof Chart !== 'undefined') {
    const ctx = canvas.getContext('2d');
    window._salesChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Omset Penjualan (Rp)',
            data: revenueData,
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderRadius: 8,
            barThickness: 16
          },
          {
            label: 'Keuntungan / Laba (Rp)',
            data: profitData,
            backgroundColor: 'rgba(99, 102, 241, 0.8)',
            borderRadius: 8,
            barThickness: 16
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: isDark ? '#94a3b8' : '#475569',
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + formatRupiah(context.raw);
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: isDark ? '#64748b' : '#94a3b8', font: { size: 10 } }
          },
          y: {
            grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
            ticks: {
              color: isDark ? '#64748b' : '#94a3b8',
              font: { size: 10 },
              callback: function(value) {
                return 'Rp ' + (value / 1000) + 'k';
              }
            }
          }
        }
      }
    });
  }
}
