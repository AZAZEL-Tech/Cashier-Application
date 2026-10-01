/**
 * WARUNGKU POS - NAVBAR & ROLE SWITCHER COMPONENT
 */

function renderNavbar() {
  const store = window.store;
  const isCashier = store.currentRole === 'cashier';
  const heldCount = store.heldCarts.length;
  const isLive = store.isLiveConnected;

  return `
    <header class="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          
          <!-- Store Brand & Logo -->
          <div class="flex items-center space-x-3 cursor-pointer" onclick="navigate('pos')">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <i data-lucide="store" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="flex items-center space-x-2">
                <span class="font-bold text-lg text-slate-800 dark:text-white leading-tight">
                  ${store.settings.storeName}
                </span>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                  isCashier 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                    : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                }">
                  ${isCashier ? 'Kasir' : 'Admin'}
                </span>

                <!-- Realtime Sync Badge -->
                <span class="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isLive 
                    ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40' 
                    : 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300/40'
                }">
                  <span class="w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'} mr-1"></span>
                  ${isLive ? 'Live Sync' : 'Menghubungkan...'}
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                ${isCashier ? `Operator: ${store.cashierName}` : 'Panel Manajemen & Keuangan Realtime'}
              </p>
            </div>
          </div>

          <!-- Desktop Navigation (Admin Only) -->
          ${!isCashier ? `
            <nav class="hidden md:flex items-center space-x-1">
              <button onclick="navigate('admin-dashboard')" class="nav-link px-3 py-2 rounded-lg text-sm font-medium transition ${window.currentTab === 'admin-dashboard' ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'}">
                <i data-lucide="layout-dashboard" class="w-4 h-4 inline mr-1.5"></i> Ringkasan
              </button>
              <button onclick="navigate('admin-products')" class="nav-link px-3 py-2 rounded-lg text-sm font-medium transition ${window.currentTab === 'admin-products' ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'}">
                <i data-lucide="package" class="w-4 h-4 inline mr-1.5"></i> Produk & Stok
              </button>
              <button onclick="navigate('admin-discounts')" class="nav-link px-3 py-2 rounded-lg text-sm font-medium transition ${window.currentTab === 'admin-discounts' ? 'bg-slate-100 dark:bg-slate-800 text-pink-600 dark:text-pink-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'}">
                <i data-lucide="ticket-percent" class="w-4 h-4 inline mr-1.5"></i> Diskon & Promo
              </button>
              <button onclick="navigate('admin-finance')" class="nav-link px-3 py-2 rounded-lg text-sm font-medium transition ${window.currentTab === 'admin-finance' ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'}">
                <i data-lucide="wallet" class="w-4 h-4 inline mr-1.5"></i> Keuangan & Laba
              </button>
              <button onclick="navigate('admin-transactions')" class="nav-link px-3 py-2 rounded-lg text-sm font-medium transition ${window.currentTab === 'admin-transactions' ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'}">
                <i data-lucide="receipt" class="w-4 h-4 inline mr-1.5"></i> Transaksi
              </button>
              <button onclick="navigate('admin-settings')" class="nav-link px-3 py-2 rounded-lg text-sm font-medium transition ${window.currentTab === 'admin-settings' ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'}">
                <i data-lucide="settings" class="w-4 h-4 inline mr-1.5"></i> Pengaturan
              </button>
            </nav>
          ` : `
            <div class="hidden md:flex items-center space-x-2">
              <button onclick="openHeldCartsModal()" class="relative px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition flex items-center space-x-1.5">
                <i data-lucide="clock" class="w-4 h-4"></i>
                <span>Pesanan Tertunda</span>
                ${heldCount > 0 ? `<span class="ml-1 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold">${heldCount}</span>` : ''}
              </button>
            </div>
          `}

          <!-- Right Action Controls -->
          <div class="flex items-center space-x-2">
            <!-- Theme Toggle -->
            <button onclick="window.store.toggleTheme()" title="Toggle Dark/Light Mode" class="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <i data-lucide="${store.isDark ? 'sun' : 'moon'}" class="w-5 h-5"></i>
            </button>

            <!-- Role Switch Button -->
            <button onclick="openRoleSwitchModal()" class="flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-sm transition">
              <i data-lucide="${isCashier ? 'shield' : 'shopping-bag'}" class="w-4 h-4 text-emerald-500"></i>
              <span class="hidden sm:inline">Ganti ke ${isCashier ? 'Admin' : 'Kasir POS'}</span>
              <span class="sm:hidden">${isCashier ? 'Admin' : 'Kasir'}</span>
            </button>
          </div>

        </div>
      </div>
    </header>

    <!-- Mobile Bottom Navigation (Visible on Small Screens) -->
    <nav class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex justify-around items-center text-xs">
      ${isCashier ? `
        <button onclick="navigate('pos')" class="flex flex-col items-center py-1 px-3 ${window.currentTab === 'pos' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}">
          <i data-lucide="shopping-cart" class="w-5 h-5 mb-0.5"></i>
          <span>Kasir POS</span>
        </button>
        <button onclick="openHeldCartsModal()" class="relative flex flex-col items-center py-1 px-3 text-slate-500 dark:text-slate-400">
          <i data-lucide="clock" class="w-5 h-5 mb-0.5"></i>
          <span>Pending</span>
          ${heldCount > 0 ? `<span class="absolute top-0 right-3 w-4 h-4 bg-amber-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">${heldCount}</span>` : ''}
        </button>
        <button onclick="openRoleSwitchModal()" class="flex flex-col items-center py-1 px-3 text-slate-500 dark:text-slate-400">
          <i data-lucide="shield" class="w-5 h-5 mb-0.5"></i>
          <span>Ke Admin</span>
        </button>
      ` : `
        <button onclick="navigate('admin-dashboard')" class="flex flex-col items-center py-1 px-1.5 ${window.currentTab === 'admin-dashboard' ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}">
          <i data-lucide="layout-dashboard" class="w-4 h-4 mb-0.5"></i>
          <span class="text-[10px]">Ringkasan</span>
        </button>
        <button onclick="navigate('admin-products')" class="flex flex-col items-center py-1 px-1.5 ${window.currentTab === 'admin-products' ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}">
          <i data-lucide="package" class="w-4 h-4 mb-0.5"></i>
          <span class="text-[10px]">Produk</span>
        </button>
        <button onclick="navigate('admin-discounts')" class="flex flex-col items-center py-1 px-1.5 ${window.currentTab === 'admin-discounts' ? 'text-pink-600 dark:text-pink-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}">
          <i data-lucide="ticket-percent" class="w-4 h-4 mb-0.5"></i>
          <span class="text-[10px]">Promo</span>
        </button>
        <button onclick="navigate('admin-finance')" class="flex flex-col items-center py-1 px-1.5 ${window.currentTab === 'admin-finance' ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}">
          <i data-lucide="wallet" class="w-4 h-4 mb-0.5"></i>
          <span class="text-[10px]">Keuangan</span>
        </button>
        <button onclick="navigate('admin-transactions')" class="flex flex-col items-center py-1 px-1.5 ${window.currentTab === 'admin-transactions' ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}">
          <i data-lucide="receipt" class="w-4 h-4 mb-0.5"></i>
          <span class="text-[10px]">Transaksi</span>
        </button>
        <button onclick="navigate('admin-settings')" class="flex flex-col items-center py-1 px-1.5 ${window.currentTab === 'admin-settings' ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}">
          <i data-lucide="settings" class="w-4 h-4 mb-0.5"></i>
          <span class="text-[10px]">Setting</span>
        </button>
      `}
    </nav>
  `;
}
