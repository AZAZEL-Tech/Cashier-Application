/**
 * WARUNGKU POS - SIDEBAR NAVIGATION & LIVE CLOCK COMPONENT
 * Mengubah navigasi menjadi Sidebar Vertikal modern (Desktop Sidebar + Mobile Drawer)
 * Terintegrasi dengan jam & tanggal waktu nyata (Real-Life Live Clock) WIB
 * dan menu Kas Harian telah disatukan ke dalam menu Keuangan & Laba.
 */

window.isMobileSidebarOpen = false;

function toggleMobileSidebar(force) {
  if (typeof force === 'boolean') {
    window.isMobileSidebarOpen = force;
  } else {
    window.isMobileSidebarOpen = !window.isMobileSidebarOpen;
  }
  const drawer = document.getElementById('mobile-sidebar-drawer');
  const overlay = document.getElementById('mobile-sidebar-overlay');
  if (drawer && overlay) {
    if (window.isMobileSidebarOpen) {
      drawer.classList.remove('-translate-x-full');
      overlay.classList.remove('hidden');
    } else {
      drawer.classList.add('-translate-x-full');
      overlay.classList.add('hidden');
    }
  }
}

// Global Real-Life Live Clock Engine
let _liveClockTimer = null;
function updateLiveClockDisplay() {
  const now = new Date();
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const pad = (n) => String(n).padStart(2, '0');
  const dayName = days[now.getDay()];
  const dateNum = now.getDate();
  const monthName = months[now.getMonth()];
  const year = now.getFullYear();

  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  const timeStr = `${hours}:${minutes}:${seconds} WIB`;
  const dateStr = `${dayName}, ${dateNum} ${monthName} ${year}`;

  const timeEls = document.querySelectorAll('.live-clock-time-display');
  timeEls.forEach(el => { el.textContent = timeStr; });

  const dateEls = document.querySelectorAll('.live-clock-date-display');
  dateEls.forEach(el => { el.textContent = dateStr; });
}

if (!_liveClockTimer) {
  _liveClockTimer = setInterval(updateLiveClockDisplay, 1000);
}

function renderSidebarNavigationItems(isMobile = false) {
  const store = window.store;
  const isCashier = store.currentRole === 'cashier';
  const heldCount = store.heldCarts.length;

  const itemClass = (tabName, activeColor = 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50') => {
    const isActive = window.currentTab === tabName;
    return `w-full flex items-center px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-150 ${
      isActive 
        ? `${activeColor} shadow-sm font-extrabold` 
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
    }`;
  };

  const clickHandler = (tab) => isMobile 
    ? `navigate('${tab}'); toggleMobileSidebar(false);` 
    : `navigate('${tab}');`;

  return `
    <div class="space-y-1">
      
      <!-- 1. Kasir POS (Selalu Tersedia untuk Kasir maupun Admin) -->
      <button 
        type="button"
        onclick="${clickHandler('pos')}" 
        class="${itemClass('pos', 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50')}"
      >
        <div class="w-7 h-7 rounded-xl ${window.currentTab === 'pos' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'} flex items-center justify-center mr-3 shrink-0">
          <i data-lucide="shopping-cart" class="w-4 h-4"></i>
        </div>
        <span class="flex-1 text-left">Kasir POS</span>
        ${store.cart && store.cart.length > 0 ? `
          <span class="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold">${store.cart.length}</span>
        ` : ''}
      </button>

      ${isCashier ? `
        <!-- Fitur Kasir: Pesanan Tertunda (Held Carts) -->
        <button 
          type="button"
          onclick="openHeldCartsModal(); ${isMobile ? 'toggleMobileSidebar(false);' : ''}" 
          class="w-full flex items-center px-3.5 py-2.5 rounded-2xl text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition"
        >
          <div class="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center mr-3 shrink-0">
            <i data-lucide="clock" class="w-4 h-4"></i>
          </div>
          <span class="flex-1 text-left">Pesanan Tertunda</span>
          ${heldCount > 0 ? `
            <span class="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold">${heldCount}</span>
          ` : ''}
        </button>
      ` : `
        <!-- Menu Admin Backoffice -->
        <div class="pt-3 pb-1 px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Manajemen & Keuangan
        </div>

        <!-- 2. Ringkasan / Dashboard -->
        <button 
          type="button"
          onclick="${clickHandler('admin-dashboard')}" 
          class="${itemClass('admin-dashboard')}"
        >
          <div class="w-7 h-7 rounded-xl ${window.currentTab === 'admin-dashboard' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'} flex items-center justify-center mr-3 shrink-0">
            <i data-lucide="layout-dashboard" class="w-4 h-4"></i>
          </div>
          <span class="flex-1 text-left">Ringkasan</span>
        </button>

        <!-- 3. Produk & Stok -->
        <button 
          type="button"
          onclick="${clickHandler('admin-products')}" 
          class="${itemClass('admin-products')}"
        >
          <div class="w-7 h-7 rounded-xl ${window.currentTab === 'admin-products' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'} flex items-center justify-center mr-3 shrink-0">
            <i data-lucide="package" class="w-4 h-4"></i>
          </div>
          <span class="flex-1 text-left">Produk & Stok</span>
        </button>

        <!-- 4. Diskon & Promo -->
        <button 
          type="button"
          onclick="${clickHandler('admin-discounts')}" 
          class="${itemClass('admin-discounts', 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/50')}"
        >
          <div class="w-7 h-7 rounded-xl ${window.currentTab === 'admin-discounts' ? 'bg-pink-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'} flex items-center justify-center mr-3 shrink-0">
            <i data-lucide="ticket-percent" class="w-4 h-4"></i>
          </div>
          <span class="flex-1 text-left">Diskon & Promo</span>
        </button>

        <!-- 5. Keuangan & Laba (Menyatu dengan Kas Harian & Pengeluaran) -->
        <button 
          type="button"
          onclick="${clickHandler('admin-finance')}" 
          class="${itemClass('admin-finance', 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50')}"
          title="Laporan Pembukuan, Buku Kas Harian, dan Pengeluaran Toko"
        >
          <div class="w-7 h-7 rounded-xl ${window.currentTab === 'admin-finance' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'} flex items-center justify-center mr-3 shrink-0">
            <i data-lucide="wallet" class="w-4 h-4"></i>
          </div>
          <div class="flex-1 text-left">
            <div>Keuangan & Laba</div>
            <div class="text-[10px] font-normal text-slate-400 -mt-0.5">Kas Harian & Laba Rugi</div>
          </div>
        </button>

        <!-- 6. Transaksi -->
        <button 
          type="button"
          onclick="${clickHandler('admin-transactions')}" 
          class="${itemClass('admin-transactions')}"
        >
          <div class="w-7 h-7 rounded-xl ${window.currentTab === 'admin-transactions' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'} flex items-center justify-center mr-3 shrink-0">
            <i data-lucide="receipt" class="w-4 h-4"></i>
          </div>
          <span class="flex-1 text-left">Transaksi & Struk</span>
        </button>

        <!-- 7. Pengaturan -->
        <button 
          type="button"
          onclick="${clickHandler('admin-settings')}" 
          class="${itemClass('admin-settings')}"
        >
          <div class="w-7 h-7 rounded-xl ${window.currentTab === 'admin-settings' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'} flex items-center justify-center mr-3 shrink-0">
            <i data-lucide="settings" class="w-4 h-4"></i>
          </div>
          <span class="flex-1 text-left">Pengaturan</span>
        </button>
      `}

    </div>
  `;
}

function renderNavbar() {
  const store = window.store;
  const isCashier = store.currentRole === 'cashier';
  const isLive = store.isLiveConnected;
  const heldCount = store.heldCarts.length;

  setTimeout(updateLiveClockDisplay, 20);

  return `
    <!-- ==================== DESKTOP FIXED SIDEBAR (>= 768px) ==================== -->
    <aside class="hidden md:flex flex-col fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-30 select-none shadow-sm transition-colors duration-200">
      
      <!-- Store Brand Header -->
      <div class="p-5 border-b border-slate-100 dark:border-slate-800/80">
        <div class="flex items-center space-x-3 cursor-pointer" onclick="navigate('pos')">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 shrink-0">
            <i data-lucide="store" class="w-6 h-6"></i>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center space-x-1.5">
              <span class="font-extrabold text-base text-slate-900 dark:text-white truncate">
                ${escapeHtml(store.settings.storeName || 'WarungKu POS')}
              </span>
            </div>
            <div class="flex items-center space-x-1.5 mt-0.5">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isCashier 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
              }">
                ${isCashier ? 'Kasir POS' : 'Admin'}
              </span>

              <!-- Live Sync Badge -->
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${
                isLive 
                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40' 
                  : 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300/40'
              }">
                <span class="w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'} mr-1"></span>
                ${isLive ? 'Live Sync' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        <!-- Real-Life Live Clock Widget (Mengikuti Jam & Tanggal Asli Real Life) -->
        <div class="mt-3.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-emerald-500 animate-pulse"></i>
              <span>Waktu Real Life</span>
            </span>
            <span class="inline-flex items-center px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[9px] font-extrabold font-mono">
              WIB
            </span>
          </div>
          <div class="text-base font-black text-slate-900 dark:text-white font-mono mt-1 live-clock-time-display">
            --:--:-- WIB
          </div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5 live-clock-date-display">
            Memuat tanggal...
          </div>
        </div>

      </div>

      <!-- Scrollable Navigation Items -->
      <nav class="flex-1 p-3 space-y-1 overflow-y-auto">
        ${renderSidebarNavigationItems(false)}
      </nav>

      <!-- Sidebar Footer (User Info & Quick Controls) -->
      <div class="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
        
        <div class="flex items-center justify-between mb-2 px-1">
          <div class="min-w-0">
            <div class="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">
              ${isCashier ? escapeHtml(store.cashierName || 'Kasir 1') : 'Administrator'}
            </div>
            <div class="text-[10px] text-slate-400 truncate">
              ${isCashier ? 'Shift Kasir Aktif' : 'Hak Akses Penuh'}
            </div>
          </div>

          <div class="flex items-center space-x-1">
            <!-- Theme Toggle -->
            <button 
              type="button"
              onclick="window.store.toggleTheme()" 
              title="Ganti Tema Gelap / Terang" 
              class="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <i data-lucide="${store.isDark ? 'sun' : 'moon'}" class="w-4 h-4"></i>
            </button>

            <!-- Logout -->
            <button 
              type="button"
              onclick="window.store.logout()" 
              title="Keluar Sesi (Logout)" 
              class="p-2 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
            >
              <i data-lucide="log-out" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Role Switch Button -->
        <button 
          type="button"
          onclick="openRoleSwitchModal()" 
          class="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-sm transition active:scale-98"
        >
          <i data-lucide="${isCashier ? 'shield' : 'shopping-bag'}" class="w-3.5 h-3.5 text-emerald-500"></i>
          <span>Ganti ke ${isCashier ? 'Admin' : 'Kasir POS'}</span>
        </button>

      </div>
    </aside>

    <!-- ==================== MOBILE TOP BAR (< 768px) ==================== -->
    <header class="md:hidden sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3.5 h-14 flex items-center justify-between">
      
      <div class="flex items-center space-x-2.5">
        <button 
          type="button"
          onclick="toggleMobileSidebar(true)" 
          class="p-2 -ml-1 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Buka Menu Sidebar"
        >
          <i data-lucide="menu" class="w-5 h-5"></i>
        </button>

        <div class="flex items-center space-x-2" onclick="navigate('pos')">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shrink-0">
            <i data-lucide="store" class="w-4 h-4"></i>
          </div>
          <span class="font-extrabold text-sm text-slate-900 dark:text-white truncate max-w-[120px] sm:max-w-xs">
            ${escapeHtml(store.settings.storeName || 'WarungKu')}
          </span>
        </div>
      </div>

      <!-- Real-Time Clock Badge on Mobile Top Bar -->
      <div class="flex items-center space-x-1.5">
        <div class="hidden xs:flex flex-col items-end px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200">
          <span class="live-clock-time-display leading-tight">--:-- WIB</span>
        </div>

        <!-- Theme Toggle -->
        <button 
          type="button"
          onclick="window.store.toggleTheme()" 
          class="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <i data-lucide="${store.isDark ? 'sun' : 'moon'}" class="w-4 h-4"></i>
        </button>

        <!-- Role Switch -->
        <button 
          type="button"
          onclick="openRoleSwitchModal()" 
          class="p-2 rounded-xl text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50"
          title="Ganti Role"
        >
          <i data-lucide="${isCashier ? 'shield' : 'shopping-bag'}" class="w-4 h-4"></i>
        </button>
      </div>

    </header>

    <!-- ==================== MOBILE SLIDE-OUT SIDEBAR DRAWER (< 768px) ==================== -->
    <div id="mobile-sidebar-overlay" onclick="toggleMobileSidebar(false)" class="hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"></div>
    <div id="mobile-sidebar-drawer" class="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl transform -translate-x-full transition-transform duration-200 ease-in-out flex flex-col md:hidden">
      
      <!-- Drawer Header -->
      <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div class="flex items-center space-x-2.5">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md">
            <i data-lucide="store" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="font-black text-sm text-slate-900 dark:text-white truncate">
              ${escapeHtml(store.settings.storeName || 'WarungKu POS')}
            </div>
            <div class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              ${isCashier ? `Kasir: ${escapeHtml(store.cashierName)}` : 'Admin Backoffice'}
            </div>
          </div>
        </div>

        <button type="button" onclick="toggleMobileSidebar(false)" class="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- Live Clock Widget in Drawer -->
      <div class="m-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
            <i data-lucide="clock" class="w-3.5 h-3.5 text-emerald-500 animate-pulse"></i>
            <span>Waktu Real Life</span>
          </span>
          <span class="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[9px] font-extrabold font-mono">WIB</span>
        </div>
        <div class="text-base font-black text-slate-900 dark:text-white font-mono mt-1 live-clock-time-display">
          --:--:-- WIB
        </div>
        <div class="text-[11px] text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5 live-clock-date-display">
          Memuat tanggal...
        </div>
      </div>

      <!-- Drawer Nav Items -->
      <nav class="flex-1 p-3 space-y-1 overflow-y-auto">
        ${renderSidebarNavigationItems(true)}
      </nav>

      <!-- Drawer Footer -->
      <div class="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
        <button 
          type="button"
          onclick="openRoleSwitchModal(); toggleMobileSidebar(false);" 
          class="w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-sm"
        >
          <i data-lucide="${isCashier ? 'shield' : 'shopping-bag'}" class="w-4 h-4 text-emerald-500"></i>
          <span>Ganti ke ${isCashier ? 'Admin' : 'Kasir POS'}</span>
        </button>

        <button 
          type="button"
          onclick="window.store.logout(); toggleMobileSidebar(false);" 
          class="w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 text-xs font-bold"
        >
          <i data-lucide="log-out" class="w-4 h-4"></i>
          <span>Keluar Sesi (Logout)</span>
        </button>
      </div>

    </div>

    <!-- ==================== MOBILE BOTTOM NAV (< 768px, Kas Harian Dihapus) ==================== -->
    <nav class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex justify-around items-center text-xs">
      ${isCashier ? `
        <button onclick="navigate('pos')" class="flex flex-col items-center py-1 px-3 ${window.currentTab === 'pos' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400'}">
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
        <button onclick="navigate('admin-dashboard')" class="flex flex-col items-center py-1 px-1.5 ${window.currentTab === 'admin-dashboard' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'}">
          <i data-lucide="layout-dashboard" class="w-4 h-4 mb-0.5"></i>
          <span class="text-[10px]">Ringkasan</span>
        </button>
        <button onclick="navigate('admin-products')" class="flex flex-col items-center py-1 px-1.5 ${window.currentTab === 'admin-products' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'}">
          <i data-lucide="package" class="w-4 h-4 mb-0.5"></i>
          <span class="text-[10px]">Produk</span>
        </button>
        <button onclick="navigate('admin-finance')" class="flex flex-col items-center py-1 px-1 ${window.currentTab === 'admin-finance' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400'}">
          <i data-lucide="wallet" class="w-4 h-4 mb-0.5"></i>
          <span class="text-[10px]">Keuangan</span>
        </button>
        <button onclick="navigate('admin-transactions')" class="flex flex-col items-center py-1 px-1 ${window.currentTab === 'admin-transactions' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'}">
          <i data-lucide="receipt" class="w-4 h-4 mb-0.5"></i>
          <span class="text-[10px]">Transaksi</span>
        </button>
        <button onclick="toggleMobileSidebar(true)" class="flex flex-col items-center py-1 px-1.5 text-slate-500 dark:text-slate-400">
          <i data-lucide="menu" class="w-4 h-4 mb-0.5"></i>
          <span class="text-[10px]">Lainnya</span>
        </button>
      `}
    </nav>
  `;
}
