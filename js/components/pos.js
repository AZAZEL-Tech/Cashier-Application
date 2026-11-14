/**
 * WARUNGKU POS - CASHIER POINT OF SALE (POS) COMPONENT
 */

let activeCategory = 'all';
let searchQuery = '';
let isMobileCartOpen = false;
let scanMultiplier = 1;
window.lastScannedItem = null;
let _searchDebounceTimer = null;

function renderPOS() {
  const store = window.store;
  const calc = store.getCartCalculations();
  const lastScan = window.lastScannedItem;
  const lastScanInCart = lastScan ? store.cart.find(i => i.id === lastScan.id) : null;
  
  // Filter products by category and search
  const filteredProducts = store.products.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  return `
    <div class="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 pb-24 md:pb-6">
      
      <!-- ALFAMART / INDOMARET STYLE BARCODE SCANNER MONITOR BAR -->
      <div class="mb-3 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 text-white rounded-3xl p-3.5 sm:p-4 shadow-xl border border-emerald-500/30">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          
          <!-- Left: Laser Barcode Scanner Input & Multiplier (7 Cols) -->
          <div class="lg:col-span-7 space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1.5"></span>
                  Scanner Aktif (ULT-1808 USB Ready)
                </span>
                <span class="text-[11px] text-slate-300 hidden sm:inline">
                  Tembak langsung barcode produk kapan saja (tanpa perlu klik kotak)
                </span>
              </div>
              <span class="text-[10px] font-mono text-emerald-300 bg-white/10 px-2 py-0.5 rounded-lg">
                Tips: Ketik <b>5*</b> lalu scan = 5 pcs
              </span>
            </div>

            <div class="flex flex-col sm:flex-row gap-2">
              <!-- Multiplier Qty Selector -->
              <div class="flex items-center bg-slate-800/90 border border-slate-700 rounded-2xl px-2.5 py-1.5 shrink-0">
                <span class="text-[10px] font-bold text-slate-400 uppercase mr-2">Qty Scan:</span>
                <div class="flex items-center space-x-1">
                  ${[1, 2, 5, 10].map(mult => `
                    <button 
                      type="button"
                      onclick="setScanMultiplier(${mult})"
                      class="px-2 py-1 rounded-lg text-xs font-extrabold font-mono transition ${
                        scanMultiplier === mult 
                          ? 'bg-emerald-500 text-slate-950 shadow-sm' 
                          : 'bg-slate-700/70 text-slate-300 hover:bg-slate-700'
                      }"
                    >
                      ${mult}x
                    </button>
                  `).join('')}
                  <input 
                    type="number" 
                    min="1" 
                    max="999"
                    value="${scanMultiplier}"
                    onchange="setScanMultiplier(this.value)"
                    title="Jumlah barang per 1x tembak scan"
                    class="w-12 text-center bg-slate-900 border border-slate-700 rounded-lg py-1 text-xs font-mono font-extrabold text-emerald-400 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <!-- Main Barcode Gun Input -->
              <div class="relative flex-1">
                <i data-lucide="scan-barcode" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400"></i>
                <input 
                  type="text" 
                  id="pos-barcode-input"
                  autocomplete="off"
                  placeholder="Tembak Barcode dengan Alat Scanner / Ketik Kode SKU lalu Enter..."
                  onkeydown="handleBarcodeKey(event)"
                  class="w-full pl-11 pr-24 py-2.5 bg-slate-950/90 border-2 border-emerald-500/60 focus:border-emerald-400 rounded-2xl text-sm font-mono font-bold text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 shadow-inner"
                />
                <button 
                  type="button"
                  onclick="triggerManualBarcodeSubmit()"
                  class="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1"
                >
                  <span>Input</span>
                  <i data-lucide="corner-down-left" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Right: Alfamart/Indomaret Digital Cashier Display (Last Scanned Item) (5 Cols) -->
          <div class="lg:col-span-5 bg-slate-950/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between min-h-[76px]">
            ${lastScan && lastScanInCart ? `
              <div class="min-w-0 flex-1 pr-3">
                <div class="flex items-center space-x-1.5">
                  <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
                    ✓ BARANG TERAKHIR DI-SCAN
                  </span>
                  <span class="text-[10px] font-mono text-slate-400">${escapeHtml(lastScan.barcode)}</span>
                </div>
                <div class="font-extrabold text-sm sm:text-base text-white truncate mt-0.5">
                  ${escapeHtml(lastScan.name)}
                </div>
                <div class="text-xs text-slate-400 font-mono">
                  ${formatRupiah(lastScan.sellPrice)} x <b class="text-emerald-400">${lastScanInCart.qty} ${escapeHtml(lastScan.unit || 'pcs')}</b>
                </div>
              </div>
              <div class="text-right shrink-0">
                <div class="text-[10px] text-slate-400 uppercase font-bold">Subtotal Item</div>
                <div class="text-lg sm:text-xl font-black font-mono text-emerald-400">
                  ${formatRupiah(lastScanInCart.subtotal)}
                </div>
              </div>
            ` : `
              <div class="w-full flex items-center justify-between text-slate-400 px-1">
                <div class="flex items-center space-x-2.5">
                  <div class="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400">
                    <i data-lucide="scan-line" class="w-5 h-5"></i>
                  </div>
                  <div>
                    <div class="text-xs font-bold text-slate-200">Siap Memindai Barang Belanjaan</div>
                    <div class="text-[11px] text-slate-400">Arahkan alat scanner ke barcode kemasan produk</div>
                  </div>
                </div>
                <div class="text-right hidden sm:block">
                  <div class="text-[10px] font-mono text-slate-500">TOTAL TAGIHAN</div>
                  <div class="text-base font-black font-mono text-emerald-400">${formatRupiah(calc.total)}</div>
                </div>
              </div>
            `}
          </div>

        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        <!-- LEFT COLUMN: PRODUCT CATALOG (8 COLS) -->
        <div class="lg:col-span-7 xl:col-span-8 flex flex-col space-y-3">
          
          <!-- Search Bar & Camera Scanner Input -->
          <div class="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-2">
            <div class="relative flex-1">
              <i data-lucide="search" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
              <input 
                type="text" 
                id="pos-search-input"
                placeholder="Cari manual nama barang di katalog (atau tekan F2)..."
                value="${escapeHtml(searchQuery)}"
                oninput="handleSearchInput(this.value)"
                onkeydown="handleBarcodeKey(event)"
                class="w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />
              ${searchQuery ? `
                <button onclick="clearSearch()" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <i data-lucide="x" class="w-4 h-4"></i>
                </button>
              ` : `
                <span title="Cari Katalog" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <i data-lucide="filter" class="w-3.5 h-3.5"></i>
                </span>
              `}
            </div>

            <!-- Fast Camera Barcode Scanner trigger -->
            <button onclick="openCameraScannerModal()" class="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition">
              <i data-lucide="camera" class="w-4 h-4"></i>
              <span>Scan Kamera HP</span>
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
              <div class="col-span-full py-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8 space-y-3">
                <div class="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                  <i data-lucide="package-open" class="w-8 h-8"></i>
                </div>
                <div>
                  <h4 class="font-bold text-sm text-slate-700 dark:text-slate-200">
                    ${store.products.length === 0 ? 'Belum Ada Produk Ditambahkan' : 'Produk Tidak Ditemukan'}
                  </h4>
                  <p class="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    ${store.products.length === 0 
                      ? 'Katalog produk saat ini masih kosong. Silakan tambahkan produk baru di menu Admin > Kelola Produk untuk memulai penjualan.' 
                      : 'Tidak ada produk yang cocok dengan pencarian atau filter kategori ini.'}
                  </p>
                </div>
                ${store.products.length === 0 ? `
                  <button 
                    onclick="window.store.currentRole === 'admin' ? navigate('admin-products') : openRoleSwitchModal()"
                    class="mt-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20 transition"
                  >
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    <span>Tambah Produk Pertama</span>
                  </button>
                ` : `
                  <button onclick="setCategory('all'); clearSearch();" class="mt-2 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition">
                    Reset Filter & Pencarian
                  </button>
                `}
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
              id="pos-customer-input-${isMobile ? 'mobile' : 'desktop'}"
              value="${escapeHtml(store.customerName)}" 
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
          <button onclick="openDiscountModalPos()" class="text-pink-600 dark:text-pink-400 hover:underline flex items-center space-x-1">
            <i data-lucide="ticket-percent" class="w-3.5 h-3.5"></i>
            <span>${store.activeDiscountInfo ? store.activeDiscountInfo.name : 'Voucher / Diskon'}</span>
          </button>
          <div class="flex items-center space-x-1.5">
            <span class="font-bold ${calc.discount > 0 ? 'text-rose-500' : 'text-slate-400'}">
              ${calc.discount > 0 ? `- ${formatRupiah(calc.discount)}` : 'Rp 0'}
            </span>
            ${calc.discount > 0 ? `
              <button onclick="window.store.removeDiscount(); window.renderApp();" title="Hapus Diskon" class="p-0.5 text-slate-300 hover:text-rose-500 transition">
                <i data-lucide="x" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
          </div>
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

function setScanMultiplier(val) {
  const num = Math.max(1, Math.min(999, parseInt(val, 10) || 1));
  scanMultiplier = num;
  window.renderApp();
  const barcodeEl = document.getElementById('pos-barcode-input');
  if (barcodeEl) barcodeEl.focus();
}

function handleSearchInput(val) {
  searchQuery = val;
  if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
  _searchDebounceTimer = setTimeout(() => {
    window.renderApp();
  }, 120);
}

function clearSearch() {
  searchQuery = '';
  window.renderApp();
}

function triggerManualBarcodeSubmit() {
  const barcodeEl = document.getElementById('pos-barcode-input');
  if (barcodeEl && barcodeEl.value.trim()) {
    processPosBarcodeScan(barcodeEl.value.trim(), barcodeEl);
  } else if (barcodeEl) {
    barcodeEl.focus();
  }
}

function handleBarcodeKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    const val = e.target.value.trim();
    if (!val) return;
    processPosBarcodeScan(val, e.target);
  }
}

function processPosBarcodeScan(rawVal, inputEl = null) {
  const clean = String(rawVal || '').trim();
  if (!clean) return;

  // Support Alfamart/Indomaret multiplier syntax: "5*" (set multiplier to 5) or "5*899..." (scan 5 pcs of 899...)
  const multOnlyMatch = clean.match(/^(\d{1,3})[\*xX]$/);
  if (multOnlyMatch) {
    scanMultiplier = Math.max(1, parseInt(multOnlyMatch[1], 10));
    if (inputEl) inputEl.value = '';
    window.store.showRealtimeToast(`🔢 Multiplier diset ke ${scanMultiplier}x untuk scan berikutnya!`);
    window.renderApp();
    return;
  }

  let qtyToScan = scanMultiplier || 1;
  let targetCode = clean;

  const multWithCodeMatch = clean.match(/^(\d{1,3})[\*xX](.+)$/);
  if (multWithCodeMatch) {
    qtyToScan = Math.max(1, parseInt(multWithCodeMatch[1], 10));
    targetCode = multWithCodeMatch[2].trim();
  }

  // 1. Exact Barcode or Product ID/SKU match
  let match = window.store.products.find(
    p => String(p.barcode || '').trim().toLowerCase() === targetCode.toLowerCase() ||
         String(p.id || '').trim().toLowerCase() === targetCode.toLowerCase()
  );

  // 2. Fallback: if typed in search input and exactly 1 product matches name or partial barcode
  if (!match && inputEl && inputEl.id === 'pos-search-input') {
    const nameMatches = window.store.products.filter(
      p => p.name.toLowerCase().includes(targetCode.toLowerCase()) ||
           String(p.barcode || '').includes(targetCode)
    );
    if (nameMatches.length === 1) {
      match = nameMatches[0];
    }
  }

  if (match) {
    const res = window.store.addToCart(match.id, qtyToScan);
    if (!res.success) {
      alert(res.message);
    } else {
      window.lastScannedItem = {
        id: match.id,
        name: match.name,
        barcode: match.barcode,
        sellPrice: match.sellPrice,
        unit: match.unit || 'pcs',
        addedQty: qtyToScan,
        timestamp: Date.now()
      };
      scanMultiplier = 1;
      searchQuery = '';
      if (inputEl) inputEl.value = '';
      window.renderApp();
      window.store.showRealtimeToast(`✅ +${qtyToScan} ${match.name} (${formatRupiah(match.sellPrice * qtyToScan)})`);
      setTimeout(() => {
        const bInput = document.getElementById('pos-barcode-input');
        if (bInput) {
          bInput.value = '';
          bInput.focus();
        }
      }, 20);
    }
  } else {
    if (window.store.settings.soundEnabled && typeof soundFx !== 'undefined') soundFx.playError();
    if (inputEl) inputEl.value = '';
    openUnregisteredBarcodeModal(targetCode);
  }
}

function openUnregisteredBarcodeModal(scannedBarcode) {
  const container = document.getElementById('modal-container');
  if (!container) {
    window.store.showRealtimeToast(`⚠️ Barcode "${escapeHtml(scannedBarcode)}" belum terdaftar!`);
    return;
  }

  const isAdmin = window.store.currentRole === 'admin';
  const safeCode = escapeHtml(scannedBarcode);

  container.innerHTML = `
    <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in zoom-in-95 duration-150 text-center">
        <div class="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
          <i data-lucide="scan-barcode" class="w-7 h-7"></i>
        </div>
        <div>
          <h3 class="font-bold text-base text-slate-900 dark:text-white">Barcode Belum Terdaftar di Katalog</h3>
          <p class="text-xs text-slate-400 mt-1">Alat scanner berhasil membaca kode barcode produk berikut:</p>
          <div class="mt-2.5 py-2.5 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-extrabold text-base text-emerald-600 dark:text-emerald-400 tracking-wider">
            ${safeCode}
          </div>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          ${isAdmin 
            ? 'Ingin langsung mendaftarkan produk baru dengan kode barcode ini?' 
            : 'Produk dengan barcode ini belum diinput oleh Admin. Anda dapat mendaftarkannya sekarang (memerlukan akses Admin).'}
        </p>
        <div class="grid grid-cols-2 gap-2 pt-2">
          <button type="button" onclick="closeModal()" class="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50">
            Tutup (Esc)
          </button>
          <button type="button" onclick="registerProductFromScannedBarcode('${safeCode.replace(/'/g, "\\'")}')" class="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-1.5">
            <i data-lucide="plus-circle" class="w-4 h-4"></i>
            <span>Daftarkan Produk</span>
          </button>
        </div>
      </div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function registerProductFromScannedBarcode(barcode) {
  closeModal();
  if (window.store.currentRole === 'admin') {
    window.currentTab = 'admin-products';
    window.renderApp();
    openProductModal(null, barcode);
  } else {
    window._pendingRegisterBarcode = barcode;
    openRoleSwitchModal();
  }
}

function handleProductClick(productId) {
  const qty = scanMultiplier || 1;
  const prod = window.store.products.find(p => p.id === productId);
  const res = window.store.addToCart(productId, qty);
  if (!res.success) {
    alert(res.message);
  } else if (prod) {
    window.lastScannedItem = {
      id: prod.id,
      name: prod.name,
      barcode: prod.barcode,
      sellPrice: prod.sellPrice,
      unit: prod.unit || 'pcs',
      addedQty: qty,
      timestamp: Date.now()
    };
    scanMultiplier = 1;
    window.renderApp();
  }
}

function toggleMobileCart(open) {
  isMobileCartOpen = open;
  window.renderApp();
}

function promptDiscount() {
  openDiscountModalPos();
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
