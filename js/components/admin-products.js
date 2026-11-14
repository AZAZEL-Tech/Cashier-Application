/**
 * WARUNGKU POS - ADMIN PRODUCTS & INVENTORY MANAGEMENT COMPONENT
 */

let productSearchQuery = '';
let productCategoryFilter = 'all';
let productTab = 'list'; // 'list' | 'stock-history'

function renderAdminProducts() {
  const store = window.store;

  const filteredProducts = store.products.filter(p => {
    const matchCat = productCategoryFilter === 'all' || p.category === productCategoryFilter;
    const matchSearch = p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                        p.barcode.includes(productSearchQuery);
    return matchCat && matchSearch;
  });

  return `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-8">
      
      <!-- Top Actions Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <i data-lucide="package" class="w-6 h-6 text-indigo-600 dark:text-indigo-400"></i>
            <span>Manajemen Produk & Stok Barang</span>
          </h2>
          <p class="text-xs text-slate-400 mt-0.5">Kelola data barang masuk, stok gudang, harga modal & harga jual.</p>
        </div>

        <div class="flex items-center space-x-2">
          <!-- Switch Tabs -->
          <div class="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl flex text-xs font-semibold">
            <button 
              onclick="setAdminProductTab('list')" 
              class="px-3 py-1.5 rounded-xl transition ${productTab === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500'}"
            >
              Katalog Produk (${store.products.length})
            </button>
            <button 
              onclick="setAdminProductTab('stock-history')" 
              class="px-3 py-1.5 rounded-xl transition ${productTab === 'stock-history' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500'}"
            >
              Riwayat Stok Masuk/Keluar
            </button>
          </div>

          <!-- Add Product Button -->
          <button 
            onclick="openProductModal()" 
            class="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-indigo-600/20 transition"
          >
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>Tambah Produk</span>
          </button>
        </div>
      </div>

      ${productTab === 'list' ? `
        <!-- Quick Barcode Scanner Registration Bar (Alfamart/Indomaret Backoffice Style) -->
        <div class="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 text-white p-4 rounded-3xl border border-indigo-500/30 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="flex items-center space-x-3">
            <div class="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
              <i data-lucide="scan-barcode" class="w-6 h-6"></i>
            </div>
            <div>
              <div class="flex items-center space-x-2">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 uppercase">
                  Scanner USB Aktif (ULT-1808)
                </span>
                <h4 class="font-bold text-xs sm:text-sm text-white">Input / Cari Produk via Tembak Barcode</h4>
              </div>
              <p class="text-[11px] text-slate-300 mt-0.5">
                Tembak barcode produk dengan alat scanner kapan saja: jika belum terdaftar akan langsung membuka form <b>Tambah Produk Baru</b> otomatis!
              </p>
            </div>
          </div>
          <button 
            type="button"
            onclick="openProductModal()" 
            class="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center space-x-1.5 shadow-md transition shrink-0"
          >
            <i data-lucide="scan-line" class="w-4 h-4"></i>
            <span>Scan / Input Produk Baru</span>
          </button>
        </div>

        <!-- Filters & Search -->
        <div class="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-3">
          <div class="relative flex-1">
            <i data-lucide="search" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
            <input 
              type="text" 
              id="admin-product-search"
              placeholder="Cari nama barang atau tembak barcode di sini (Enter untuk tambah/edit)..."
              value="${escapeHtml(productSearchQuery)}"
              oninput="productSearchQuery = this.value; window.renderApp();"
              onkeydown="handleAdminSearchBarcodeKey(event)"
              class="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select 
            onchange="productCategoryFilter = this.value; window.renderApp();"
            class="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none"
          >
            <option value="all">Semua Kategori</option>
            ${store.categories.filter(c => c.id !== 'all').map(c => `
              <option value="${c.id}" ${productCategoryFilter === c.id ? 'selected' : ''}>${c.name}</option>
            `).join('')}
          </select>
        </div>

        <!-- Products Table -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th class="py-3.5 px-4">Produk</th>
                  <th class="py-3.5 px-4">Barcode / SKU</th>
                  <th class="py-3.5 px-4">Kategori</th>
                  <th class="py-3.5 px-4 text-right">Harga Modal</th>
                  <th class="py-3.5 px-4 text-right">Harga Jual</th>
                  <th class="py-3.5 px-4 text-right">Margin Untung</th>
                  <th class="py-3.5 px-4 text-center">Stok</th>
                  <th class="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                ${filteredProducts.length > 0 ? filteredProducts.map(p => {
                  const margin = p.sellPrice - p.costPrice;
                  const marginPct = p.costPrice > 0 ? ((margin / p.costPrice) * 100).toFixed(0) : 0;
                  const isLow = p.stock <= p.minStock;

                  return `
                    <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td class="py-3 px-4 flex items-center space-x-3">
                        <img 
                          src="${p.image}" 
                          alt="${p.name}" 
                          onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=60'"
                          class="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" 
                        />
                        <div>
                          <div class="font-bold text-slate-900 dark:text-white">${p.name}</div>
                          <div class="text-[10px] text-slate-400">Satuan: ${p.unit || 'pcs'}</div>
                        </div>
                      </td>
                      <td class="py-3 px-4 font-mono font-medium text-slate-500">${p.barcode}</td>
                      <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-[11px] capitalize">
                          ${p.category}
                        </span>
                      </td>
                      <td class="py-3 px-4 text-right font-mono text-slate-500">${formatRupiah(p.costPrice)}</td>
                      <td class="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">${formatRupiah(p.sellPrice)}</td>
                      <td class="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        +${formatRupiah(margin)} <span class="text-[10px] text-slate-400">(${marginPct}%)</span>
                      </td>
                      <td class="py-3 px-4 text-center">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          p.stock <= 0 
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' 
                            : isLow 
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' 
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }">
                          ${p.stock} ${p.unit}
                        </span>
                      </td>
                      <td class="py-3 px-4 text-center">
                        <div class="flex items-center justify-center space-x-1.5">
                          <button 
                            onclick="openRestockModal('${p.id}')" 
                            title="Restock Barang Masuk / Keluar"
                            class="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 hover:bg-amber-100 transition"
                          >
                            <i data-lucide="arrow-left-right" class="w-4 h-4"></i>
                          </button>
                          <button 
                            onclick="openProductModal('${p.id}')" 
                            title="Edit Data Produk"
                            class="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 hover:bg-indigo-100 transition"
                          >
                            <i data-lucide="pencil" class="w-4 h-4"></i>
                          </button>
                          <button 
                            onclick="confirmDeleteProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}')" 
                            title="Hapus Produk"
                            class="p-1.5 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 hover:bg-rose-100 transition"
                          >
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="8" class="py-16 text-center text-slate-400">
                      <div class="max-w-xs mx-auto space-y-3">
                        <i data-lucide="package-open" class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600"></i>
                        <div>
                          <p class="font-bold text-sm text-slate-700 dark:text-slate-300">
                            ${store.products.length === 0 ? 'Katalog Produk Masih Kosong' : 'Tidak ada produk yang cocok'}
                          </p>
                          <p class="text-xs text-slate-400 mt-0.5">
                            ${store.products.length === 0 ? 'Mulai tambahkan produk jualan Anda dengan klik tombol Tambah Produk.' : 'Coba cari dengan kata kunci atau kategori lain.'}
                          </p>
                        </div>
                        ${store.products.length === 0 ? `
                          <button 
                            onclick="openProductModal()"
                            class="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 transition"
                          >
                            <i data-lucide="plus" class="w-4 h-4"></i>
                            <span>Tambah Produk Baru</span>
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      ` : `
        <!-- STOCK IN / STOCK OUT HISTORY -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 class="font-bold text-sm text-slate-800 dark:text-white">Riwayat Mutasi Stok (Masuk & Keluar)</h3>
            <span class="text-xs text-slate-400">${store.stockHistory.length} Riwayat Tercatat</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th class="py-3 px-4">Waktu</th>
                  <th class="py-3 px-4">Produk</th>
                  <th class="py-3 px-4">Tipe Mutasi</th>
                  <th class="py-3 px-4 text-center">Jumlah (Qty)</th>
                  <th class="py-3 px-4">Keterangan / Alasan</th>
                  <th class="py-3 px-4">Oleh</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                ${store.stockHistory.length > 0 ? store.stockHistory.map(item => `
                  <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td class="py-3 px-4 font-mono text-slate-500">${formatDateTime(item.date)}</td>
                    <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">${item.productName}</td>
                    <td class="py-3 px-4">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        item.type === 'in' 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }">
                        <i data-lucide="${item.type === 'in' ? 'arrow-down-left' : 'arrow-up-right'}" class="w-3 h-3 mr-1"></i>
                        ${item.type === 'in' ? 'Barang Masuk' : 'Barang Keluar'}
                      </span>
                    </td>
                    <td class="py-3 px-4 text-center font-bold font-mono">
                      ${item.type === 'in' ? '+' : '-'}${item.qty}
                    </td>
                    <td class="py-3 px-4 text-slate-600 dark:text-slate-300">${item.reason}</td>
                    <td class="py-3 px-4 text-slate-400">${item.user || 'Admin'}</td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="6" class="py-12 text-center text-slate-400">Belum ada riwayat mutasi stok.</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      `}

    </div>
  `;
}

function setAdminProductTab(tab) {
  productTab = tab;
  window.renderApp();
}

// Modal: Add or Edit Product
function openProductModal(productId = null, prefillBarcode = '') {
  const store = window.store;
  const isEdit = Boolean(productId);
  const p = isEdit ? store.products.find(item => item.id === productId) : null;
  const initialBarcode = p ? p.barcode : (prefillBarcode || '');

  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in zoom-in-95 duration-150">
        
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 class="font-bold text-base text-slate-800 dark:text-white flex items-center space-x-2">
            <i data-lucide="${isEdit ? 'pencil' : 'scan-barcode'}" class="w-5 h-5 text-indigo-600"></i>
            <span>${isEdit ? 'Edit Data Produk' : 'Tambah Produk (Siap Scan Barcode)'}</span>
          </h3>
          <button onclick="closeModal()" class="p-1.5 text-slate-400 hover:text-slate-600">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <form id="admin-product-form" onsubmit="handleSaveProduct(event, '${productId || ''}')" class="space-y-3.5 text-xs">
          
          <!-- BARCODE / SKU SCANNER FIELD (TOP PRIORITY) -->
          <div class="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border-2 border-indigo-400/60 dark:border-indigo-500/40 space-y-2">
            <div class="flex items-center justify-between">
              <label class="font-extrabold text-indigo-900 dark:text-indigo-200 flex items-center space-x-1.5">
                <i data-lucide="scan-barcode" class="w-4 h-4 text-indigo-600 dark:text-indigo-400"></i>
                <span>1. Scan Barcode Kemasan / Kode SKU *</span>
              </label>
              <button 
                type="button" 
                onclick="generateAutoSkuInModal()"
                class="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 transition"
                title="Gunakan jika barang curah / tidak punya barcode kemasan"
              >
                + Buat Kode Otomatis
              </button>
            </div>

            <div class="relative">
              <input 
                type="text" 
                id="product-barcode-input"
                name="barcode" 
                required 
                autocomplete="off"
                value="${escapeHtml(initialBarcode)}"
                placeholder="Tembak barcode produk dengan alat scanner ULT-1808..."
                onkeydown="handleProductModalBarcodeKey(event, '${productId || ''}')"
                class="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl text-slate-900 dark:text-white font-mono font-extrabold text-sm tracking-wider focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div id="barcode-scan-status" class="text-[11px] font-semibold ${prefillBarcode ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'} flex items-center space-x-1">
              <i data-lucide="${prefillBarcode ? 'check-circle-2' : 'zap'}" class="w-3.5 h-3.5"></i>
              <span>${prefillBarcode ? `Barcode "${escapeHtml(prefillBarcode)}" berhasil di-scan! Silakan isi Nama & Harga di bawah.` : 'Arahkan scanner ke produk & tekan pelatuk (otomatis pindah ke Nama Produk).'}</span>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="sm:col-span-2">
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">2. Nama Produk *</label>
              <input 
                type="text" 
                id="product-name-input"
                name="name" 
                required 
                value="${p ? escapeHtml(p.name) : ''}"
                placeholder="Contoh: Indomie Goreng 85g / Aqua 600ml"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Kategori *</label>
              <select 
                name="category"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                ${store.categories.filter(c => c.id !== 'all').map(c => `
                  <option value="${c.id}" ${p && p.category === c.id ? 'selected' : ''}>${c.name}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">3. Harga Modal / Beli (Rp) *</label>
              <input 
                type="number" 
                id="product-cost-input"
                name="costPrice" 
                required 
                min="0"
                value="${p ? p.costPrice : ''}"
                placeholder="Contoh: 2800"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">4. Harga Jual Kasir (Rp) *</label>
              <input 
                type="number" 
                id="product-sell-input"
                name="sellPrice" 
                required 
                min="0"
                value="${p ? p.sellPrice : ''}"
                placeholder="Contoh: 3500"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-emerald-600 dark:text-emerald-400 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Stok Awal *</label>
              <input 
                type="number" 
                name="stock" 
                required 
                value="${p ? p.stock : 10}"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Min. Alert Stok</label>
              <input 
                type="number" 
                name="minStock" 
                value="${p ? p.minStock : 5}"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Satuan</label>
              <input 
                type="text" 
                name="unit" 
                value="${p ? escapeHtml(p.unit) : 'pcs'}"
                placeholder="pcs, kg, bks"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">URL Foto Produk (Opsional)</label>
            <input 
              type="text" 
              name="image" 
              value="${p ? escapeHtml(p.image) : ''}"
              placeholder="https://..."
              class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
            <button type="button" onclick="closeModal()" class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50">
              Batal
            </button>
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30">
              Simpan Produk
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Focus appropriate field immediately
  setTimeout(() => {
    if (prefillBarcode || isEdit) {
      const nameEl = document.getElementById('product-name-input');
      if (nameEl) nameEl.focus();
    } else {
      const barcodeEl = document.getElementById('product-barcode-input');
      if (barcodeEl) barcodeEl.focus();
    }
  }, 40);
}

function generateAutoSkuInModal() {
  const barcodeEl = document.getElementById('product-barcode-input');
  if (!barcodeEl) return;
  const randomCode = 'SKU-' + String(Math.floor(100000 + Math.random() * 900000));
  barcodeEl.value = randomCode;
  const statusEl = document.getElementById('barcode-scan-status');
  if (statusEl) {
    statusEl.className = 'text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center space-x-1';
    statusEl.innerHTML = `<span>✓ Kode SKU otomatis dibuat: <b>${randomCode}</b></span>`;
  }
  const nameEl = document.getElementById('product-name-input');
  if (nameEl) nameEl.focus();
}

function handleProductModalBarcodeKey(e, currentProductId = '') {
  if (e.key === 'Enter') {
    // Prevent USB scanner's trailing Enter key from submitting the form prematurely!
    e.preventDefault();
    e.stopPropagation();
    const scannedCode = e.target.value.trim();
    if (!scannedCode) return;

    if (window.store.settings.soundEnabled && typeof soundFx !== 'undefined') {
      soundFx.playBeep();
    }

    // Check if this barcode already belongs to an existing product
    const existing = window.store.products.find(
      item => String(item.barcode || '').trim().toLowerCase() === scannedCode.toLowerCase() && item.id !== currentProductId
    );
    if (existing) {
      if (confirm(`Barcode "${scannedCode}" sudah terdaftar untuk produk "${existing.name}".\n\nIngin membuka data produk "${existing.name}" untuk diedit?`)) {
        openProductModal(existing.id);
        return;
      }
    }

    const statusEl = document.getElementById('barcode-scan-status');
    if (statusEl) {
      statusEl.className = 'text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1';
      statusEl.innerHTML = `<span>✓ Barcode <b>${escapeHtml(scannedCode)}</b> berhasil terbaca! Silakan isi Nama Produk & Harga.</span>`;
    }

    const nameEl = document.getElementById('product-name-input');
    if (nameEl) {
      nameEl.focus();
      nameEl.select();
    }
  }
}

function handleAdminSearchBarcodeKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const code = e.target.value.trim();
    if (!code) return;
    handleAdminBarcodeScanAction(code);
  }
}

function handleAdminBarcodeScanAction(scannedBarcode) {
  const cleanCode = String(scannedBarcode || '').trim();
  if (!cleanCode) return;

  // If Product Modal is already open, inject scanned barcode directly into #product-barcode-input!
  const modalBarcodeInput = document.getElementById('product-barcode-input');
  if (modalBarcodeInput) {
    modalBarcodeInput.value = cleanCode;
    handleProductModalBarcodeKey({ key: 'Enter', target: modalBarcodeInput, preventDefault: () => {}, stopPropagation: () => {} });
    return;
  }

  // Otherwise check if product already exists in catalog
  const existing = window.store.products.find(
    p => String(p.barcode || '').trim().toLowerCase() === cleanCode.toLowerCase() ||
         String(p.id || '').trim().toLowerCase() === cleanCode.toLowerCase()
  );

  if (existing) {
    if (window.store.settings.soundEnabled && typeof soundFx !== 'undefined') soundFx.playBeep();
    productSearchQuery = '';
    window.renderApp();
    openProductModal(existing.id);
    window.store.showRealtimeToast(`📦 Barcode ditemukan: "${existing.name}"`);
  } else {
    if (window.store.settings.soundEnabled && typeof soundFx !== 'undefined') soundFx.playBeep();
    productSearchQuery = '';
    window.renderApp();
    openProductModal(null, cleanCode);
    window.store.showRealtimeToast(`✨ Barcode baru "${cleanCode}" terbaca! Silakan lengkapi Nama & Harga.`);
  }
}

async function handleSaveProduct(e, id) {
  e.preventDefault();
  const form = e.target;
  const productData = {
    id: id || undefined,
    name: form.name.value.trim(),
    barcode: form.barcode.value.trim(),
    category: form.category.value,
    costPrice: form.costPrice.value,
    sellPrice: form.sellPrice.value,
    stock: form.stock.value,
    minStock: form.minStock.value,
    unit: form.unit.value.trim() || 'pcs',
    image: form.image.value.trim()
  };

  await window.store.saveProduct(productData);
  closeModal();
  window.renderApp();
  window.store.showRealtimeToast(`✅ Produk "${productData.name}" berhasil disimpan!`);
}

async function confirmDeleteProduct(id, name) {
  if (confirm(`Apakah Anda yakin ingin menghapus produk "${name}"?`)) {
    await window.store.deleteProduct(id);
    window.renderApp();
    window.store.showRealtimeToast(`🗑️ Produk "${name}" telah dihapus.`);
  }
}

// Modal: Restock / Stock In & Out
function openRestockModal(productId) {
  const store = window.store;
  const p = store.products.find(item => item.id === productId);
  if (!p) return;

  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 class="font-bold text-base text-slate-800 dark:text-white flex items-center space-x-2">
            <i data-lucide="boxes" class="w-5 h-5 text-amber-500"></i>
            <span>Mutasi Stok: ${escapeHtml(p.name)}</span>
          </h3>
          <button onclick="closeModal()" class="p-1.5 text-slate-400">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <form onsubmit="handleSubmitRestock(event, '${p.id}')" class="space-y-4 text-xs">
          <div class="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl flex justify-between items-center font-semibold">
            <span class="text-slate-500">Stok Saat Ini:</span>
            <span class="text-sm font-bold text-slate-800 dark:text-white font-mono">${p.stock} ${escapeHtml(p.unit)}</span>
          </div>

          <div>
            <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Tipe Mutasi</label>
            <div class="grid grid-cols-2 gap-2">
              <label class="flex items-center space-x-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer bg-slate-50 dark:bg-slate-800">
                <input type="radio" name="type" value="in" checked onchange="const el=document.getElementById('restock-expense-box'); if(el) el.style.display='block';" class="text-emerald-600" />
                <span class="font-bold text-emerald-600 dark:text-emerald-400">+ Barang Masuk (Restock)</span>
              </label>
              <label class="flex items-center space-x-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer bg-slate-50 dark:bg-slate-800">
                <input type="radio" name="type" value="out" onchange="const el=document.getElementById('restock-expense-box'); if(el) el.style.display='none';" class="text-rose-600" />
                <span class="font-bold text-rose-600 dark:text-rose-400">- Barang Keluar (Rusak/Hilang)</span>
              </label>
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Jumlah (${escapeHtml(p.unit)}) *</label>
            <input 
              type="number" 
              name="qty" 
              required 
              min="1" 
              value="10" 
              class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Alasan / Catatan Supplier</label>
            <input 
              type="text" 
              name="reason" 
              placeholder="Contoh: Pembelian dari Supplier PT Beras Makmur"
              class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium focus:outline-none"
            />
          </div>

          <div id="restock-expense-box" class="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl">
            <label class="flex items-center space-x-2 text-indigo-900 dark:text-indigo-200 cursor-pointer font-semibold">
              <input type="checkbox" name="recordExpense" checked class="rounded text-indigo-600" />
              <span>Otomatis catat total belanja ke Pengeluaran Toko (Buku Kas)</span>
            </label>
          </div>

          <div class="pt-2 flex justify-end space-x-2">
            <button type="button" onclick="closeModal()" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold">Batal</button>
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md">Simpan Mutasi</button>
          </div>
        </form>

      </div>
    </div>
  `;

  lucide.createIcons();
}

async function handleSubmitRestock(e, productId) {
  e.preventDefault();
  const form = e.target;
  const qty = form.qty.value;
  const type = form.type.value;
  const reason = form.reason.value;
  const recordExpense = type === 'in' && form.recordExpense.checked;

  await window.store.adjustStock(productId, qty, type, reason, recordExpense);
  closeModal();
  window.renderApp();
  window.store.showRealtimeToast(`📦 Mutasi stok (${type === 'in' ? '+' : '-'}${qty}) berhasil disimpan!`);
}
