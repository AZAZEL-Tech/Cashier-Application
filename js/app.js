/**
 * WARUNGKU POS - APPLICATION ROOT CONTROLLER & ROUTER
 */

window.currentTab = 'pos'; // 'pos' | 'admin-dashboard' | 'admin-products' | 'admin-finance' | 'admin-transactions' | 'admin-settings'

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

  const store = window.store;

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
      <div id="modal-container"></div>
    </div>
  `;

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
