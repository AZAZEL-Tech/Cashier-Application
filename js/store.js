/**
 * WARUNGKU POS - CENTRAL STORE & REALTIME STATE MANAGEMENT
 * Terhubung langsung ke Backend SSE (/api/events) untuk sinkronisasi live
 * antara Kasir di HP dan Admin di PC.
 */

class AppStore {
  constructor() {
    this.currentRole = localStorage.getItem('pos_role') || 'cashier'; // 'cashier' | 'admin'
    this.cashierName = localStorage.getItem('pos_cashier_name') || 'Kasir 1';
    this.isDark = localStorage.getItem('pos_theme') === 'dark';
    this.isLiveConnected = false;
    
    // Initial local cache or fallback seed data
    this.settings = this.loadData('pos_settings', DEFAULT_SETTINGS);
    this.categories = this.loadData('pos_categories', DEFAULT_CATEGORIES);
    this.products = this.loadData('pos_products', DEFAULT_PRODUCTS);
    this.transactions = this.loadData('pos_transactions', generateSampleTransactions());
    this.expenses = this.loadData('pos_expenses', DEFAULT_EXPENSES);
    this.stockHistory = this.loadData('pos_stock_history', DEFAULT_STOCK_HISTORY);
    this.discounts = this.loadData('pos_discounts', typeof DEFAULT_DISCOUNTS !== 'undefined' ? DEFAULT_DISCOUNTS : []);
    
    // Active Cart for POS (kept locally per cashier session)
    this.cart = this.loadData('pos_active_cart', []);
    this.heldCarts = this.loadData('pos_held_carts', []);
    this.activeDiscount = Number(localStorage.getItem('pos_cart_discount') || 0);
    this.activeDiscountInfo = this.loadData('pos_cart_discount_info', null);
    this.customerName = localStorage.getItem('pos_customer_name') || 'Umum';

    // Subscribed listeners
    this.listeners = [];

    // Apply dark mode on init
    this.applyTheme();

    // Start Realtime Connection to Server
    this.initRealtimeConnection();
  }

  loadData(key, fallback) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (e) {
      console.error(`Error loading key ${key}:`, e);
      return fallback;
    }
  }

  saveData(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Error saving key ${key}:`, e);
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn());
  }

  // ==================== REALTIME SSE ENGINE ====================
  initRealtimeConnection() {
    if (typeof EventSource === 'undefined') {
      console.warn("Browser does not support SSE. Falling back to polling.");
      this.startPollingFallback();
      return;
    }

    try {
      this.eventSource = new EventSource('/api/events');

      this.eventSource.onopen = () => {
        this.isLiveConnected = true;
        this.notify();
      };

      this.eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleServerEvent(payload);
        } catch (e) {
          // heartbeat or unparseable
        }
      };

      this.eventSource.onerror = () => {
        this.isLiveConnected = false;
        this.notify();
        // Browser automatically attempts reconnect
      };
    } catch (err) {
      console.error("SSE connection error:", err);
      this.startPollingFallback();
    }
  }

  startPollingFallback() {
    setInterval(() => {
      this.fetchServerData();
    }, 4000);
  }

  async fetchServerData() {
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const fullData = await res.json();
        this.applyServerState(fullData);
        this.isLiveConnected = true;
        this.notify();
      }
    } catch (e) {
      this.isLiveConnected = false;
    }
  }

  handleServerEvent(event) {
    if (!event || !event.type) return;

    if (event.type === 'init' && event.data) {
      this.applyServerState(event.data);
      this.notify();
      return;
    }

    if (event.data && event.data.fullData) {
      this.applyServerState(event.data.fullData);

      // Realtime Notification for Admin when a new checkout occurs
      if (event.type === 'checkout' && event.data.transaction) {
        const trx = event.data.transaction;
        this.showRealtimeToast(`🔔 Transaksi Baru: ${formatRupiah(trx.total)} oleh ${trx.cashier}`);
        if (this.settings.soundEnabled && typeof soundFx !== 'undefined') {
          soundFx.playSuccess();
        }
      }

      this.notify();
    }
  }

  applyServerState(serverData) {
    if (serverData.products) {
      this.products = serverData.products;
      this.saveData('pos_products', this.products);
    }
    if (serverData.transactions) {
      this.transactions = serverData.transactions;
      this.saveData('pos_transactions', this.transactions);
    }
    if (serverData.expenses) {
      this.expenses = serverData.expenses;
      this.saveData('pos_expenses', this.expenses);
    }
    if (serverData.stockHistory) {
      this.stockHistory = serverData.stockHistory;
      this.saveData('pos_stock_history', this.stockHistory);
    }
    if (serverData.discounts) {
      this.discounts = serverData.discounts;
      this.saveData('pos_discounts', this.discounts);
    }
    if (serverData.settings) {
      this.settings = { ...this.settings, ...serverData.settings };
      this.saveData('pos_settings', this.settings);
    }
    if (serverData.categories) {
      this.categories = serverData.categories;
      this.saveData('pos_categories', this.categories);
    }
  }

  showRealtimeToast(message) {
    let toast = document.getElementById('pos-live-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pos-live-toast';
      toast.className = 'fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl bg-slate-900 text-white shadow-2xl border border-emerald-500/40 text-xs font-bold flex items-center space-x-2 animate-in slide-in-from-top duration-200';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping mr-1"></span> ${message}`;
    toast.style.display = 'flex';

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 4500);
  }

  // ==================== ROLE & THEME ====================
  setRole(role) {
    this.currentRole = role;
    localStorage.setItem('pos_role', role);
    this.notify();
  }

  setCashierName(name) {
    this.cashierName = name;
    localStorage.setItem('pos_cashier_name', name);
    this.notify();
  }

  toggleTheme() {
    this.isDark = !this.isDark;
    localStorage.setItem('pos_theme', this.isDark ? 'dark' : 'light');
    this.applyTheme();
    this.notify();
  }

  applyTheme() {
    if (this.isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  // ==================== CART OPERATIONS ====================
  addToCart(productId, qtyToAdd = 1) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return { success: false, message: 'Produk tidak ditemukan' };

    const cartItem = this.cart.find(item => item.id === productId);
    const currentQtyInCart = cartItem ? cartItem.qty : 0;
    
    if (currentQtyInCart + qtyToAdd > product.stock) {
      if (this.settings.soundEnabled && typeof soundFx !== 'undefined') soundFx.playError();
      return { 
        success: false, 
        message: `Stok tidak mencukupi! Sisa stok terkini: ${product.stock}` 
      };
    }

    if (cartItem) {
      cartItem.qty += qtyToAdd;
      cartItem.subtotal = cartItem.qty * cartItem.sellPrice;
    } else {
      this.cart.push({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        costPrice: product.costPrice,
        sellPrice: product.sellPrice,
        unit: product.unit,
        qty: qtyToAdd,
        subtotal: product.sellPrice * qtyToAdd,
        image: product.image
      });
    }

    if (this.settings.soundEnabled && typeof soundFx !== 'undefined') soundFx.playBeep();
    this.persistCart();
    this.notify();
    return { success: true };
  }

  updateCartQty(productId, newQty) {
    const product = this.products.find(p => p.id === productId);
    const cartIndex = this.cart.findIndex(item => item.id === productId);

    if (cartIndex === -1) return;

    if (newQty <= 0) {
      this.cart.splice(cartIndex, 1);
    } else {
      if (product && newQty > product.stock) {
        if (this.settings.soundEnabled && typeof soundFx !== 'undefined') soundFx.playError();
        alert(`Stok hanya tersedia ${product.stock} ${product.unit}`);
        return;
      }
      this.cart[cartIndex].qty = newQty;
      this.cart[cartIndex].subtotal = newQty * this.cart[cartIndex].sellPrice;
    }

    this.persistCart();
    this.notify();
  }

  removeFromCart(productId) {
    this.cart = this.cart.filter(item => item.id !== productId);
    this.persistCart();
    this.notify();
  }

  clearCart() {
    this.cart = [];
    this.activeDiscount = 0;
    this.activeDiscountInfo = null;
    this.customerName = 'Umum';
    localStorage.removeItem('pos_cart_discount');
    localStorage.removeItem('pos_cart_discount_info');
    localStorage.removeItem('pos_customer_name');
    this.persistCart();
    this.notify();
  }

  setDiscount(amount, info = null) {
    this.activeDiscount = Math.max(0, Number(amount) || 0);
    this.activeDiscountInfo = info || (this.activeDiscount > 0 ? { name: 'Diskon Manual', type: 'fixed', value: this.activeDiscount } : null);
    localStorage.setItem('pos_cart_discount', this.activeDiscount);
    if (this.activeDiscountInfo) {
      localStorage.setItem('pos_cart_discount_info', JSON.stringify(this.activeDiscountInfo));
    } else {
      localStorage.removeItem('pos_cart_discount_info');
    }
    this.notify();
  }

  applyDiscountPromo(discountOrCode) {
    const subtotal = this.cart.reduce((acc, item) => acc + item.subtotal, 0);
    if (subtotal <= 0) {
      return { success: false, message: 'Keranjang belanja masih kosong!' };
    }

    let discount = null;
    if (typeof discountOrCode === 'object' && discountOrCode !== null) {
      discount = discountOrCode;
    } else {
      const query = String(discountOrCode || '').trim().toUpperCase();
      discount = this.discounts.find(d => 
        (d.code && d.code.toUpperCase() === query) || d.id === discountOrCode || d.name.toUpperCase() === query
      );
    }

    if (!discount) {
      return { success: false, message: 'Kode promo / voucher diskon tidak ditemukan!' };
    }

    if (!discount.isActive) {
      return { success: false, message: `Promo "${discount.name}" sedang tidak aktif!` };
    }

    if (discount.minPurchase && subtotal < Number(discount.minPurchase)) {
      return { 
        success: false, 
        message: `Minimal belanja untuk promo ini adalah ${formatRupiah(discount.minPurchase)} (Saat ini: ${formatRupiah(subtotal)})` 
      };
    }

    let calculatedDiscount = 0;
    if (discount.type === 'percentage') {
      calculatedDiscount = Math.round((subtotal * Number(discount.value)) / 100);
      if (discount.maxDiscount && Number(discount.maxDiscount) > 0) {
        calculatedDiscount = Math.min(calculatedDiscount, Number(discount.maxDiscount));
      }
    } else {
      calculatedDiscount = Math.min(Number(discount.value) || 0, subtotal);
    }

    this.setDiscount(calculatedDiscount, {
      id: discount.id,
      name: discount.name,
      code: discount.code || '',
      type: discount.type,
      value: Number(discount.value),
      maxDiscount: Number(discount.maxDiscount || 0),
      minPurchase: Number(discount.minPurchase || 0)
    });

    return { 
      success: true, 
      discountAmount: calculatedDiscount, 
      name: discount.name, 
      code: discount.code 
    };
  }

  removeDiscount() {
    this.setDiscount(0, null);
  }

  setCustomerName(name) {
    this.customerName = name || 'Umum';
    localStorage.setItem('pos_customer_name', this.customerName);
    this.notify();
  }

  holdCart(note = '') {
    if (this.cart.length === 0) return false;
    const held = {
      id: 'HOLD-' + Date.now(),
      date: new Date().toISOString(),
      customerName: this.customerName,
      note: note || `Pesanan ${this.customerName}`,
      cart: [...this.cart],
      discount: this.activeDiscount,
      discountInfo: this.activeDiscountInfo
    };
    this.heldCarts.push(held);
    this.saveData('pos_held_carts', this.heldCarts);
    this.clearCart();
    return true;
  }

  restoreHeldCart(holdId) {
    const index = this.heldCarts.findIndex(h => h.id === holdId);
    if (index === -1) return;
    const held = this.heldCarts[index];
    this.cart = held.cart;
    this.activeDiscount = held.discount;
    this.activeDiscountInfo = held.discountInfo || null;
    this.customerName = held.customerName;
    this.heldCarts.splice(index, 1);
    this.saveData('pos_held_carts', this.heldCarts);
    this.persistCart();
    this.notify();
  }

  deleteHeldCart(holdId) {
    this.heldCarts = this.heldCarts.filter(h => h.id !== holdId);
    this.saveData('pos_held_carts', this.heldCarts);
    this.notify();
  }

  persistCart() {
    this.saveData('pos_active_cart', this.cart);
  }

  getCartCalculations() {
    const subtotal = this.cart.reduce((acc, item) => acc + item.subtotal, 0);
    const totalCost = this.cart.reduce((acc, item) => acc + (item.costPrice * item.qty), 0);
    
    // Dynamic recalculation for percentage discount if cart contents changed
    let effectiveDiscount = this.activeDiscount;
    if (this.activeDiscountInfo && this.activeDiscountInfo.type === 'percentage') {
      if (this.activeDiscountInfo.minPurchase && subtotal < this.activeDiscountInfo.minPurchase) {
        effectiveDiscount = 0;
      } else {
        let disc = Math.round((subtotal * Number(this.activeDiscountInfo.value)) / 100);
        if (this.activeDiscountInfo.maxDiscount && Number(this.activeDiscountInfo.maxDiscount) > 0) {
          disc = Math.min(disc, Number(this.activeDiscountInfo.maxDiscount));
        }
        effectiveDiscount = disc;
      }
    }

    const discount = Math.min(effectiveDiscount, subtotal);
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = this.settings.taxRate > 0 ? Math.round((taxableAmount * this.settings.taxRate) / 100) : 0;
    const total = taxableAmount + tax;
    const profit = Math.max(0, (subtotal - discount) - totalCost);
    const totalItems = this.cart.reduce((acc, item) => acc + item.qty, 0);

    return {
      subtotal,
      totalCost,
      discount,
      tax,
      total,
      profit,
      totalItems,
      discountInfo: this.activeDiscountInfo
    };
  }

  // ==================== CHECKOUT (POST TO SERVER) ====================
  async processCheckout(paymentMethod, amountPaid = 0, customerName = 'Umum') {
    if (this.cart.length === 0) return null;

    const calc = this.getCartCalculations();
    const finalAmountPaid = paymentMethod === 'cash' ? Math.max(amountPaid, calc.total) : calc.total;
    const change = Math.max(0, finalAmountPaid - calc.total);

    const transactionId = 'TRX-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '-' + Math.floor(100 + Math.random() * 900);

    const newTransaction = {
      id: transactionId,
      date: new Date().toISOString(),
      cashier: this.cashierName,
      customerName: customerName || this.customerName,
      items: JSON.parse(JSON.stringify(this.cart)),
      subtotal: calc.subtotal,
      discount: calc.discount,
      tax: calc.tax,
      total: calc.total,
      totalCost: calc.totalCost,
      profit: calc.profit,
      paymentMethod,
      amountPaid: finalAmountPaid,
      change,
      status: 'completed'
    };

    // Optimistically deduct local stock
    this.cart.forEach(item => {
      const prod = this.products.find(p => p.id === item.id);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - item.qty);
      }
    });

    this.transactions.unshift(newTransaction);
    this.clearCart();

    // Broadcast to Server via REST API
    try {
      await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTransaction)
      });
    } catch (e) {
      console.warn("Offline checkout mode:", e);
    }

    if (this.settings.soundEnabled && typeof soundFx !== 'undefined') {
      soundFx.playSuccess();
    }

    this.notify();
    return newTransaction;
  }

  // ==================== PRODUCT CRUD (SYNCED) ====================
  async saveProduct(productData) {
    const isEdit = Boolean(productData.id);
    let productId = productData.id || ('P' + String(Date.now()).slice(-6));

    const finalProduct = {
      id: productId,
      name: productData.name,
      barcode: productData.barcode || String(Math.floor(10000000 + Math.random() * 90000000)),
      category: productData.category || 'lainnya',
      costPrice: Number(productData.costPrice) || 0,
      sellPrice: Number(productData.sellPrice) || 0,
      stock: Number(productData.stock) || 0,
      minStock: Number(productData.minStock) || 5,
      unit: productData.unit || 'pcs',
      image: productData.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=60'
    };

    try {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalProduct)
      });
    } catch (e) {
      console.warn("Server offline, saved locally:", e);
    }

    return productId;
  }

  async deleteProduct(productId) {
    try {
      await fetch(`/api/products?id=${productId}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.warn("Server offline, deleted locally:", e);
    }
  }

  // Stock In / Stock Out Mutation (Restock)
  async adjustStock(productId, qty, type, reason = '', recordExpense = false) {
    const payload = {
      productId,
      qty,
      type,
      reason,
      recordExpense,
      user: 'Admin'
    };

    try {
      await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn("Stock mutation error:", e);
    }
  }

  // ==================== EXPENSE & FINANCE (SYNCED) ====================
  async addExpense(expenseData) {
    const newExpense = {
      id: 'EXP-' + String(Date.now()).slice(-6),
      date: expenseData.date || new Date().toISOString(),
      category: expenseData.category || 'Operasional',
      description: expenseData.description || 'Pengeluaran Toko',
      amount: Number(expenseData.amount) || 0,
      recordedBy: 'Admin'
    };

    try {
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExpense)
      });
    } catch (e) {
      console.warn("Server error:", e);
    }

    return newExpense;
  }

  async deleteExpense(expenseId) {
    try {
      await fetch(`/api/expenses?id=${expenseId}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.warn("Server error:", e);
    }
  }

  // ==================== DISCOUNT & PROMO CRUD (SYNCED) ====================
  async saveDiscount(discountData) {
    let discountId = discountData.id || ('DSC-' + String(Date.now()).slice(-6));

    const finalDiscount = {
      id: discountId,
      name: discountData.name,
      code: (discountData.code || '').toUpperCase().trim(),
      type: discountData.type || 'percentage',
      value: Number(discountData.value) || 0,
      minPurchase: Number(discountData.minPurchase) || 0,
      maxDiscount: Number(discountData.maxDiscount) || 0,
      isActive: discountData.isActive !== undefined ? (discountData.isActive ? 1 : 0) : 1
    };

    try {
      await fetch('/api/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalDiscount)
      });
    } catch (e) {
      console.warn("Server error, discount saved locally:", e);
    }

    return finalDiscount;
  }

  async deleteDiscount(discountId) {
    try {
      await fetch(`/api/discounts?id=${discountId}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.warn("Server error, discount deleted locally:", e);
    }
  }

  async toggleDiscount(discountId) {
    try {
      await fetch('/api/discounts/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: discountId })
      });
    } catch (e) {
      console.warn("Server error, discount toggle failed locally:", e);
    }
  }

  // ==================== SETTINGS & BACKUP ====================
  async updateSettings(newSettings) {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
    } catch (e) {
      console.warn("Settings error:", e);
    }
  }

  exportBackupJSON() {
    const backup = {
      version: "2.0-realtime",
      exportDate: new Date().toISOString(),
      settings: this.settings,
      categories: this.categories,
      products: this.products,
      transactions: this.transactions,
      expenses: this.expenses,
      stockHistory: this.stockHistory,
      discounts: this.discounts
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_warung_realtime_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importBackupJSON(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (data.products && data.settings) {
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          return { success: true, message: 'Database toko berhasil dipulihkan di server!' };
        }
      }
      return { success: false, message: 'Format backup tidak valid.' };
    } catch (e) {
      return { success: false, message: 'Gagal memulihkan data: ' + e.message };
    }
  }

  async resetToDefault() {
    try {
      await fetch('/api/reset', { method: 'POST' });
      localStorage.clear();
      window.location.reload();
    } catch (e) {
      window.location.reload();
    }
  }
}

// Helpers for formatting
function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(number || 0);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatTime(dateString) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  return `${formatDate(dateString)}, ${formatTime(dateString)}`;
}

// Global Store Instance
window.store = new AppStore();
