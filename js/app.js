/**
 * WARUNGKU POS - APPLICATION ROOT CONTROLLER & ROUTER
 */

window.currentTab = 'pos'; // 'pos' | 'admin-dashboard' | 'admin-products' | 'admin-finance' | 'admin-transactions' | 'admin-settings'
window.loginRoleTab = 'cashier'; // 'cashier' | 'admin'
window.loginErrorMsg = '';
window.isLoggingIn = false;

function selectLoginRole(role) {
  window.loginRoleTab = role;
  window.loginErrorMsg = '';
  window.renderApp();
  setTimeout(() => {
    const inp = document.getElementById('login-secret-input');
    if (inp) inp.focus();
  }, 40);
}

async function handleLoginSubmit(event) {
  if (event) event.preventDefault();
  if (window.isLoggingIn) return;

  const store = window.store;
  const role = window.loginRoleTab || 'cashier';
  const secretEl = document.getElementById('login-secret-input');
  const cashierEl = document.getElementById('login-cashier-name');

  const secret = secretEl ? secretEl.value : '';
  const cashierName = cashierEl ? cashierEl.value.trim() : store.cashierName;

  if (!secret) {
    window.loginErrorMsg = role === 'admin' ? 'Masukkan Password Admin!' : 'Masukkan PIN Kasir!';
    window.renderApp();
    return;
  }

  window.isLoggingIn = true;
  window.loginErrorMsg = '';
  window.renderApp();

  const res = await store.login(role, secret, cashierName || (role === 'admin' ? 'Admin' : 'Kasir 1'));
  window.isLoggingIn = false;

  if (!res.success) {
    window.loginErrorMsg = res.message || 'Autentikasi gagal.';
    if (store.settings.soundEnabled && typeof soundFx !== 'undefined') {
      soundFx.playError();
    }
    window.renderApp();
    return;
  }

  if (store.settings.soundEnabled && typeof soundFx !== 'undefined') {
    soundFx.playSuccess();
  }
  window.currentTab = role === 'admin' ? 'admin-dashboard' : 'pos';
  window.renderApp();
}

function renderLoginPage() {
  const store = window.store;
  const isCashierTab = (window.loginRoleTab || 'cashier') === 'cashier';

  return `
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div class="w-full max-w-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        
        <!-- Header Brand -->
        <div class="p-6 pb-5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-center relative">
          <button onclick="window.store.toggleTheme()" type="button" title="Toggle Dark/Light Mode" class="absolute top-4 right-4 p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition">
            <i data-lucide="${store.isDark ? 'sun' : 'moon'}" class="w-4 h-4"></i>
          </button>
          <div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg">
            <i data-lucide="store" class="w-7 h-7 text-white"></i>
          </div>
          <h1 class="text-xl font-black tracking-tight">${escapeHtml(store.settings.storeName || 'WarungKu POS')}</h1>
          <p class="text-xs text-emerald-50/90 mt-1 font-medium">Sistem Kasir & Inventaris Realtime Terproteksi</p>
        </div>

        <div class="p-6 space-y-5">
          <!-- Role Selector Tabs -->
          <div class="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button type="button" onclick="selectLoginRole('cashier')" class="py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition ${
              isCashierTab
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }">
              <i data-lucide="shopping-cart" class="w-4 h-4"></i>
              <span>Kasir POS</span>
            </button>
            <button type="button" onclick="selectLoginRole('admin')" class="py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition ${
              !isCashierTab
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }">
              <i data-lucide="shield" class="w-4 h-4"></i>
              <span>Admin Backoffice</span>
            </button>
          </div>

          <form onsubmit="handleLoginSubmit(event)" class="space-y-4">
            ${isCashierTab ? `
              <div>
                <label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Nama Operator Kasir</label>
                <div class="relative">
                  <i data-lucide="user" class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"></i>
                  <input type="text" id="login-cashier-name" value="${escapeHtml(store.cashierName || 'Kasir 1')}" placeholder="Misal: Budi / Shift Pagi" required
                    class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                </div>
              </div>
            ` : ''}

            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                ${isCashierTab ? 'PIN Akses Kasir' : 'Password Administrator'}
              </label>
              <div class="relative">
                <i data-lucide="lock" class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"></i>
                <input type="password" id="login-secret-input" placeholder="${isCashierTab ? 'Masukkan PIN Kasir...' : 'Masukkan Password Admin...'}" required autofocus
                  class="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center text-lg font-black tracking-widest focus:outline-none focus:ring-2 ${isCashierTab ? 'focus:ring-emerald-500' : 'focus:ring-indigo-500'}">
              </div>
            </div>

            ${window.loginErrorMsg ? `
              <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center space-x-2">
                <i data-lucide="alert-circle" class="w-4 h-4 shrink-0"></i>
                <span>${escapeHtml(window.loginErrorMsg)}</span>
              </div>
            ` : ''}

            <button type="submit" ${window.isLoggingIn ? 'disabled' : ''} class="w-full py-3.5 rounded-xl font-bold text-sm text-white shadow-lg transition flex items-center justify-center space-x-2 ${
              isCashierTab
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/25'
            } disabled:opacity-60">
              <i data-lucide="${window.isLoggingIn ? 'loader' : 'log-in'}" class="w-4 h-4 ${window.isLoggingIn ? 'animate-spin' : ''}"></i>
              <span>${window.isLoggingIn ? 'Memverifikasi Sesi...' : (isCashierTab ? 'Masuk ke Kasir POS' : 'Masuk ke Panel Admin')}</span>
            </button>
          </form>

          <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span class="flex items-center"><i data-lucide="shield-check" class="w-3.5 h-3.5 mr-1 text-emerald-500"></i> Server-Side RBAC Auth</span>
            <span>${isCashierTab ? 'Default PIN: 1234' : 'Default Pass: admin123'}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function navigate(tabName) {
  const store = window.store;

  // Protect admin tabs
  if (tabName.startsWith('admin') && store.currentRole !== 'admin') {
    openRoleSwitchModal();
    return;
  }

  window.currentTab = tabName;
  window.renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderApp() {
  const appRoot = document.getElementById('app-root');
  if (!appRoot) return;

  // Ensure modal-container exists outside app-root so background sync doesn't close active modals
  if (!document.getElementById('modal-container')) {
    const modalDiv = document.createElement('div');
    modalDiv.id = 'modal-container';
    document.body.appendChild(modalDiv);
  }

  // Preserve active input focus and cursor position before re-rendering
  const activeEl = document.activeElement;
  const shouldRestoreFocus = activeEl && appRoot.contains(activeEl) && activeEl.id && ['INPUT', 'TEXTAREA'].includes(activeEl.tagName);
  const focusState = shouldRestoreFocus ? {
    id: activeEl.id,
    selectionStart: typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null,
    selectionEnd: typeof activeEl.selectionEnd === 'number' ? activeEl.selectionEnd : null
  } : null;

  const store = window.store;

  // Render dedicated Login Page when unauthenticated
  if (!store.isAuthenticated) {
    appRoot.innerHTML = renderLoginPage();
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    return;
  }

  // If cashier role, always default to 'pos'
  if (store.currentRole === 'cashier' && window.currentTab.startsWith('admin')) {
    window.currentTab = 'pos';
  }

  let mainContent = '';
  switch (window.currentTab) {
    case 'pos':
      mainContent = renderPOS();
      break;
    case 'admin-dashboard':
      mainContent = renderAdminDashboard();
      break;
    case 'admin-products':
      mainContent = renderAdminProducts();
      break;
    case 'admin-discounts':
      mainContent = renderAdminDiscounts();
      break;
    case 'admin-finance':
      mainContent = renderAdminFinance();
      break;
    case 'admin-transactions':
      mainContent = renderAdminTransactions();
      break;
    case 'admin-settings':
      mainContent = renderAdminSettings();
      break;
    default:
      mainContent = renderPOS();
  }

  appRoot.innerHTML = `
    <div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      ${renderNavbar()}
      <main class="flex-1">
        ${mainContent}
      </main>
    </div>
  `;

  // Restore focus & cursor position if user was typing in an input inside appRoot
  if (focusState) {
    const newEl = document.getElementById(focusState.id);
    if (newEl) {
      newEl.focus();
      try {
        if (focusState.selectionStart !== null && newEl.type !== 'number') {
          newEl.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
        }
      } catch (e) {}
    }
  }

  // Render Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // If admin dashboard is active, render chart
  if (window.currentTab === 'admin-dashboard') {
    setTimeout(() => {
      initSalesChart();
    }, 50);
  }
}

// Global Keyboard Shortcuts for Pro Cashiers (PC / Laptop)
document.addEventListener('keydown', (e) => {
  // Ignore if typing inside input / textarea
  const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

  // Esc closes modal
  if (e.key === 'Escape') {
    closeModal();
    return;
  }

  // F2: Focus Search
  if (e.key === 'F2') {
    e.preventDefault();
    const searchInput = document.getElementById('pos-search-input');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  // F8: Fast Checkout (if cart not empty)
  if (e.key === 'F8') {
    e.preventDefault();
    if (window.store.cart.length > 0) {
      openCheckoutModal();
    }
  }

  // F4: Hold Order
  if (e.key === 'F4') {
    e.preventDefault();
    if (window.store.cart.length > 0) {
      promptHoldCart();
    }
  }
});

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  // Subscribe to store updates
  window.store.subscribe(() => {
    window.renderApp();
  });

  // Initial render
  window.renderApp();
});
