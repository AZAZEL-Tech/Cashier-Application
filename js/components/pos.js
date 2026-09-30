/**
 * WARUNGKU POS - CASHIER POINT OF SALE (POS) COMPONENT
 */

let activeCategory = 'all';
let searchQuery = '';
let isMobileCartOpen = false;

function renderPOS() {
  const store = window.store;
  const calc = store.getCartCalculations();
  
  // Filter products by category and search
  const filteredProducts = store.products.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.barcode.includes(searchQuery);
    return matchCat && matchSearch;
  });

  return `
    <div class="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 pb-24 md:pb-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        <!-- LEFT COLUMN: PRODUCT CATALOG (8 COLS) -->
        <div class="lg:col-span-7 xl:col-span-8 flex flex-col space-y-3">
          
          <!-- Search Bar & Barcode Scanner Input -->
          <div class="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-2">
            <div class="relative flex-1">
              <i data-lucide="search" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
              <input 
                type="text" 
                id="pos-search-input"
                placeholder="Cari nama barang atau scan barcode..."
                value="${searchQuery}"
                oninput="handleSearchInput(this.value)"
                onkeydown="handleBarcodeKey(event)"
                class="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />
              ${searchQuery ? `
                <button onclick="clearSearch()" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <i data-lucide="x" class="w-4 h-4"></i>
                </button>
              ` : `
                <span title="Scan Barcode Ready" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <i data-lucide="scan-barcode" class="w-4 h-4"></i>
                </span>
              `}
            </div>

            <!-- Fast Camera Barcode Scanner trigger -->
            <button onclick="openCameraScannerModal()" class="px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition">
              <i data-lucide="camera" class="w-4 h-4"></i>
              <span>Scan Kamera</span>
            </button>
          </div>

          <!-- Category Chips Bar -->
          <div class="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
            ${store.categories.map(cat => `
              <button 
                onclick="setCategory('${cat.id}')"
                class="px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center space-x-1.5 ${
                  activeCategory === cat.id 
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' 
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }"
              >
                <i data-lucide="${cat.icon || 'tag'}" class="w-3.5 h-3.5"></i>
                <span>${cat.name}</span>
              </button>
            `).join('')}
          </div>

          <!-- Product Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
            ${filteredProducts.length > 0 ? filteredProducts.map(p => {
              const isLowStock = p.stock <= p.minStock;
              const isOutOfStock = p.stock <= 0;
              const cartItem = store.cart.find(item => item.id === p.id);
              const qtyInCart = cartItem ? cartItem.qty : 0;

              return `
                <div 
                  onclick="${isOutOfStock ? '' : `handleProductClick('${p.id}')`}"
                  class="product-card group relative bg-white dark:bg-slate-900 rounded-2xl border ${
                    qtyInCart > 0 
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                      : 'border-slate-200 dark:border-slate-800'
                  } ${isOutOfStock ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg hover:border-emerald-400'} p-2.5 flex flex-col justify-between overflow-hidden shadow-sm"
                >
                  <!-- Badge for Low Stock or Qty In Cart -->
                  <div class="flex justify-between items-start mb-2">
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      isOutOfStock 
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' 
                        : isLowStock 
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse-subtle' 
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }">
                      ${isOutOfStock ? 'Habis' : `Stok: ${p.stock} ${p.unit}`}
                    </span>

                    ${qtyInCart > 0 ? `
                      <span class="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-md">
                        ${qtyInCart}
                      </span>
                    ` : ''}
                  </div>

                  <!-- Product Image -->
                  <div class="w-full h-24 sm:h-28 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-2 relative flex items-center justify-center">
                    <img 
                      src="${p.image}" 
                      alt="${p.name}" 
                      loading="lazy"
                      onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=60'"
                      class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div class="absolute bottom-1 right-1 bg-black/60 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                      ${p.barcode}
                    </div>
                  </div>

                  <!-- Product Details -->
                  <div class="flex-1 flex flex-col justify-between">
                    <h4 class="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-100 line-clamp-2 mb-1" title="${p.name}">
                      ${p.name}
                    </h4>
                    
                    <div class="mt-2 flex items-center justify-between">
                      <span class="font-bold text-sm sm:text-base text-emerald-600 dark:text-emerald-400">
                        ${formatRupiah(p.sellPrice)}
                      </span>
                      <button 
                        class="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white transition"
                        title="Tambah ke Keranjang"
                      >
                        <i data-lucide="plus" class="w-4 h-4"></i>
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join('') : `
              <div class="col-span-full py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <i data-lucide="package-search" class="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3"></i>
                <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Tidak ada produk ditemukan</p>
                <p class="text-xs text-slate-400 mt-1">Coba kata kunci lain atau pilih kategori Semua Produk</p>
                <button onclick="setCategory('all'); clearSearch();" class="mt-3 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200">
                  Reset Pencarian
                </button>
              </div>
            `}
          </div>
        </div>

        <!-- RIGHT COLUMN: SHOPPING CART & CHECKOUT (4 COLS DESKTOP / STICKY DRAWER) -->
        <div class="hidden lg:block lg:col-span-5 xl:col-span-4 sticky top-20">
          ${renderCartPanel(calc)}
        </div>

      </div>
    </div>

    <!-- Mobile Floating Cart Bar (Bottom) -->
    <div class="lg:hidden fixed bottom-14 left-0 right-0 p-3 z-30 pointer-events-none">
      <div class="max-w-md mx-auto pointer-events-auto">
        <button 
          onclick="toggleMobileCart(true)"
          class="w-full py-3 px-4 bg-slate-900 dark:bg-emerald-600 text-white rounded-2xl shadow-xl flex items-center justify-between font-medium active:scale-95 transition"
        >
          <div class="flex items-center space-x-2.5">
            <div class="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-bold text-sm">
              ${calc.totalItems}
            </div>
            <div class="text-left">
              <div class="text-xs text-slate-300 dark:text-emerald-100">Total Belanja</div>
              <div class="font-bold text-base leading-tight">${formatRupiah(calc.total)}</div>
            </div>
          </div>
          <div class="flex items-center space-x-1 font-semibold text-sm">
            <span>Lihat Keranjang</span>
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </div>
        </button>
      </div>
    </div>

    <!-- Mobile Cart Bottom Sheet Modal -->
    <div id="mobile-cart-modal" class="${isMobileCartOpen ? 'block' : 'hidden'} lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end">
      <div class="bg-white dark:bg-slate-900 rounded-t-3xl max-h-[85vh] flex flex-col p-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center space-x-2">
            <i data-lucide="shopping-cart" class="w-5 h-5 text-emerald-600"></i>
            <h3 class="font-bold text-base text-slate-800 dark:text-white">Keranjang Belanja</h3>
          </div>
          <button onclick="toggleMobileCart(false)" class="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div class="overflow-y-auto flex-1 my-2">
          ${renderCartPanel(calc, true)}
        </div>
      </div>
    </div>
  `;
}

function renderCartPanel(calc, isMobile = false) {
  const store = window.store;
  const cart = store.cart;

  return `
    <div class="bg-white dark:bg-slate-900 ${isMobile ? '' : 'rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg'} p-4 flex flex-col">
      
      <!-- Cart Header & Customer Selector -->
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 class="font-bold text-base text-slate-800 dark:text-white flex items-center space-x-2">
            <span>Keranjang Kasir</span>
            <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              ${calc.totalItems} item
            </span>
          </h3>
          <div class="flex items-center space-x-1.5 mt-1 text-xs text-slate-500">
            <i data-lucide="user" class="w-3.5 h-3.5"></i>
            <span>Pelanggan:</span>
            <input 
              type="text" 
              value="${store.customerName}" 
              placeholder="Nama pelanggan..."
              onchange="window.store.setCustomerName(this.value)"
              class="bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none px-1 text-xs"
            />
          </div>
        </div>

        <div class="flex items-center space-x-1">
          <!-- Hold Order Button -->
          <button 
            onclick="promptHoldCart()" 
            title="Tahan Pesanan (Hold)"
            class="p-2 rounded-xl text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition"
          >
            <i data-lucide="pause-circle" class="w-5 h-5"></i>
          </button>

          <!-- Clear Cart Button -->
          <button 
            onclick="confirmClearCart()" 
            title="Kosongkan Keranjang"
            class="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
          >
            <i data-lucide="trash-2" class="w-5 h-5"></i>
          </button>
        </div>
      </div>

      <!-- Cart Item List -->
      <div class="flex-1 overflow-y-auto max-h-[340px] divide-y divide-slate-100 dark:divide-slate-800/60 my-2 pr-1">
        ${cart.length > 0 ? cart.map(item => `
          <div class="py-2.5 flex items-center justify-between space-x-2">
            <div class="flex-1 min-w-0">
              <h5 class="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">${item.name}</h5>
              <p class="text-[11px] text-slate-400 font-mono">${formatRupiah(item.sellPrice)} / ${item.unit || 'pcs'}</p>
              <p class="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">${formatRupiah(item.subtotal)}</p>
            </div>

            <!-- Qty Stepper Controls -->
            <div class="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5">
              <button 
                onclick="window.store.updateCartQty('${item.id}', ${item.qty - 1})"
                class="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition shadow-xs text-xs font-bold"
              >
                -
              </button>
              <input 
                type="number" 
                value="${item.qty}" 
                min="1"
                onchange="window.store.updateCartQty('${item.id}', parseInt(this.value) || 1)"
                class="w-8 text-center text-xs font-bold bg-transparent text-slate-800 dark:text-slate-100 focus:outline-none"
              />
              <button 
                onclick="window.store.updateCartQty('${item.id}', ${item.qty + 1})"
                class="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 transition shadow-xs text-xs font-bold"
              >
                +
              </button>
            </div>

            <!-- Delete Item Button -->
            <button 
              onclick="window.store.removeFromCart('${item.id}')"
              class="text-slate-300 hover:text-rose-500 p-1 transition"
            >
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        `).join('') : `
          <div class="py-12 text-center text-slate-400">
            <i data-lucide="shopping-bag" class="w-10 h-10 mx-auto mb-2 opacity-40"></i>
            <p class="text-xs">Keranjang masih kosong.</p>
            <p class="text-[11px] text-slate-400">Klik produk di sebelah kiri untuk menambahkan.</p>
          </div>
        `}
      </div>

      <!-- Cart Calculations Breakdown -->
      <div class="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
        <div class="flex justify-between text-slate-500 dark:text-slate-400">
          <span>Subtotal</span>
          <span class="font-semibold text-slate-800 dark:text-slate-200">${formatRupiah(calc.subtotal)}</span>
        </div>

        <!-- Discount row -->
        <div class="flex justify-between items-center text-slate-500 dark:text-slate-400">
          <button onclick="promptDiscount()" class="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1">
            <i data-lucide="tag" class="w-3 h-3"></i>
            <span>Diskon Potongan</span>
          </button>
          <span class="font-semibold text-rose-500">
            ${calc.discount > 0 ? `- ${formatRupiah(calc.discount)}` : 'Rp 0'}
          </span>
        </div>

        ${store.settings.taxRate > 0 ? `
          <div class="flex justify-between text-slate-500 dark:text-slate-400">
            <span>PPN (${store.settings.taxRate}%)</span>
            <span class="font-semibold text-slate-800 dark:text-slate-200">${formatRupiah(calc.tax)}</span>
          </div>
        ` : ''}

        <div class="pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 flex justify-between items-baseline">
          <span class="font-bold text-sm text-slate-800 dark:text-white">Total Tagihan</span>
          <span class="font-extrabold text-xl text-emerald-600 dark:text-emerald-400">${formatRupiah(calc.total)}</span>
        </div>
      </div>

      <!-- Checkout Action Button -->
      <div class="mt-4">
        <button 
          onclick="openCheckoutModal()"
          ${cart.length === 0 ? 'disabled' : ''}
          class="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-98 transition duration-150"
        >
          <i data-lucide="credit-card" class="w-5 h-5"></i>
          <span>Bayar Sekarang (${formatRupiah(calc.total)})</span>
        </button>
      </div>

    </div>
  `;
}

// POS Event Handlers
function setCategory(catId) {
  activeCategory = catId;
  window.renderApp();
}

function handleSearchInput(val) {
  searchQuery = val;
  window.renderApp();
}

function clearSearch() {
  searchQuery = '';
  window.renderApp();
}

function handleBarcodeKey(e) {
  if (e.key === 'Enter') {
    const val = e.target.value.trim();
    if (!val) return;

    // Search exact barcode
    const match = window.store.products.find(p => p.barcode === val || p.id.toLowerCase() === val.toLowerCase());
    if (match) {
      window.store.addToCart(match.id, 1);
      searchQuery = '';
      e.target.value = '';
    }
  }
}

function handleProductClick(productId) {
  const res = window.store.addToCart(productId, 1);
  if (!res.success) {
    alert(res.message);
  }
}

function toggleMobileCart(open) {
  isMobileCartOpen = open;
  window.renderApp();
}

function promptDiscount() {
  const current = window.store.activeDiscount;
  const input = prompt("Masukkan nominal diskon potongan (Rp):", current);
  if (input !== null) {
    const val = Math.max(0, parseInt(input) || 0);
    window.store.setDiscount(val);
  }
}

function promptHoldCart() {
  if (window.store.cart.length === 0) {
    alert("Keranjang masih kosong!");
    return;
  }
  const note = prompt("Catatan untuk pesanan tertunda (Contoh: Bpk Ahmad / Meja 2):", `Pesanan ${window.store.customerName}`);
  if (note !== null) {
    window.store.holdCart(note);
    if (window.store.settings.soundEnabled) soundFx.playBeep();
    alert("Pesanan berhasil disimpan di Pesanan Tertunda!");
  }
}

function confirmClearCart() {
  if (window.store.cart.length === 0) return;
  if (confirm("Kosongkan semua barang di keranjang?")) {
    window.store.clearCart();
  }
}
