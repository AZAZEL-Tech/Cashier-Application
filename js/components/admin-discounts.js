/**
 * WARUNGKU POS - ADMIN DISCOUNTS & PROMO MANAGEMENT COMPONENT
 * Mengelola voucher promo, diskon persentase, potongan nominal, syarat minimal belanja, dll.
 */

let discountSearchQuery = '';
let discountStatusFilter = 'all'; // 'all' | 'active' | 'inactive'
let discountTypeFilter = 'all'; // 'all' | 'percentage' | 'fixed'

function renderAdminDiscounts() {
  const store = window.store;
  const discounts = store.discounts || [];

  const filteredDiscounts = discounts.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(discountSearchQuery.toLowerCase()) ||
                        (d.code && d.code.toLowerCase().includes(discountSearchQuery.toLowerCase()));
    const matchStatus = discountStatusFilter === 'all' ||
                        (discountStatusFilter === 'active' && Boolean(d.isActive)) ||
                        (discountStatusFilter === 'inactive' && !d.isActive);
    const matchType = discountTypeFilter === 'all' || d.type === discountTypeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const totalPromos = discounts.length;
  const activePromos = discounts.filter(d => Boolean(d.isActive)).length;
  const percentCount = discounts.filter(d => d.type === 'percentage').length;
  const fixedCount = discounts.filter(d => d.type === 'fixed').length;

  return `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-8 animate-in fade-in duration-200">
      
      <!-- Top Header & Action Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <div class="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center">
              <i data-lucide="ticket-percent" class="w-5 h-5"></i>
            </div>
            <span>Manajemen Diskon & Promo Voucher</span>
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Buat kupon promo, diskon persentase (%), potongan nominal (Rp), dan syarat minimal belanja untuk kasir.
          </p>
        </div>

        <div class="flex items-center space-x-2">
          <!-- Add Discount Button -->
          <button 
            onclick="openDiscountModal()" 
            class="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-pink-600/20 active:scale-95 transition"
          >
            <i data-lucide="plus-circle" class="w-4 h-4"></i>
            <span>Tambah Diskon / Promo</span>
          </button>
        </div>
      </div>

      <!-- Quick Summary Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Promo</span>
            <span class="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <i data-lucide="tags" class="w-4 h-4"></i>
            </span>
          </div>
          <p class="text-2xl font-black text-slate-900 dark:text-white mt-2">${totalPromos}</p>
          <p class="text-[10px] text-slate-400 mt-1">Diskon terdaftar di sistem</p>
        </div>

        <div class="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Promo Aktif</span>
            <span class="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
              <i data-lucide="check-circle-2" class="w-4 h-4"></i>
            </span>
          </div>
          <p class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">${activePromos}</p>
          <p class="text-[10px] text-slate-400 mt-1">Dapat digunakan saat checkout</p>
        </div>

        <div class="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Tipe Persen (%)</span>
            <span class="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
              <i data-lucide="percent" class="w-4 h-4"></i>
            </span>
          </div>
          <p class="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">${percentCount}</p>
          <p class="text-[10px] text-slate-400 mt-1">Diskon berbasis persentase</p>
        </div>

        <div class="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-amber-600 dark:text-amber-400">Potongan Tetap (Rp)</span>
            <span class="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600">
              <i data-lucide="banknote" class="w-4 h-4"></i>
            </span>
          </div>
          <p class="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">${fixedCount}</p>
          <p class="text-[10px] text-slate-400 mt-1">Potongan nominal langsung</p>
        </div>
      </div>

      <!-- Filters & Search Bar -->
      <div class="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-3">
        <div class="relative flex-1">
          <i data-lucide="search" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
          <input 
            type="text" 
            placeholder="Cari nama promo atau kode voucher..."
            value="${discountSearchQuery}"
            oninput="discountSearchQuery = this.value; window.renderApp();"
            class="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div class="flex gap-2">
          <select 
            onchange="discountStatusFilter = this.value; window.renderApp();"
            class="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none"
          >
            <option value="all" ${discountStatusFilter === 'all' ? 'selected' : ''}>Semua Status</option>
            <option value="active" ${discountStatusFilter === 'active' ? 'selected' : ''}>Hanya Aktif</option>
            <option value="inactive" ${discountStatusFilter === 'inactive' ? 'selected' : ''}>Hanya Nonaktif</option>
          </select>

          <select 
            onchange="discountTypeFilter = this.value; window.renderApp();"
            class="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none"
          >
            <option value="all" ${discountTypeFilter === 'all' ? 'selected' : ''}>Semua Tipe</option>
            <option value="percentage" ${discountTypeFilter === 'percentage' ? 'selected' : ''}>Persentase (%)</option>
            <option value="fixed" ${discountTypeFilter === 'fixed' ? 'selected' : ''}>Potongan Tetap (Rp)</option>
          </select>
        </div>
      </div>

      <!-- Discounts Table / List -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="py-3.5 px-4">Nama Promo / Voucher</th>
                <th class="py-3.5 px-4">Kode Kupon</th>
                <th class="py-3.5 px-4 text-center">Tipe & Nilai</th>
                <th class="py-3.5 px-4">Syarat Min. Belanja</th>
                <th class="py-3.5 px-4">Maks. Potongan</th>
                <th class="py-3.5 px-4 text-center">Status</th>
                <th class="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              ${filteredDiscounts.length > 0 ? filteredDiscounts.map(d => `
                <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                  <td class="py-3.5 px-4">
                    <div class="flex items-center space-x-3">
                      <div class="w-9 h-9 rounded-xl ${d.type === 'percentage' ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400' : 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400'} flex items-center justify-center font-bold">
                        <i data-lucide="${d.type === 'percentage' ? 'percent' : 'banknote'}" class="w-5 h-5"></i>
                      </div>
                      <div>
                        <p class="font-bold text-slate-900 dark:text-white text-xs">${d.name}</p>
                        <p class="text-[10px] text-slate-400 font-mono">ID: ${d.id}</p>
                      </div>
                    </div>
                  </td>
                  <td class="py-3.5 px-4 font-mono">
                    ${d.code ? `
                      <span class="inline-flex items-center px-2 py-1 rounded-lg bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-bold border border-pink-200 dark:border-pink-800/60">
                        <i data-lucide="tag" class="w-3 h-3 mr-1"></i>
                        ${d.code}
                      </span>
                    ` : `
                      <span class="text-slate-400 italic text-[11px]">(Tanpa Kode)</span>
                    `}
                  </td>
                  <td class="py-3.5 px-4 text-center font-bold">
                    ${d.type === 'percentage' ? `
                      <span class="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold">
                        ${d.value}%
                      </span>
                    ` : `
                      <span class="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold">
                        ${formatRupiah(d.value)}
                      </span>
                    `}
                  </td>
                  <td class="py-3.5 px-4 font-medium">
                    ${d.minPurchase && Number(d.minPurchase) > 0 ? `
                      <span class="text-slate-700 dark:text-slate-200">${formatRupiah(d.minPurchase)}</span>
                    ` : `
                      <span class="text-emerald-600 dark:text-emerald-400 font-semibold">Tanpa Min. Belanja</span>
                    `}
                  </td>
                  <td class="py-3.5 px-4 font-medium">
                    ${d.type === 'percentage' ? (
                      d.maxDiscount && Number(d.maxDiscount) > 0 ? `
                        <span class="text-slate-700 dark:text-slate-200">${formatRupiah(d.maxDiscount)}</span>
                      ` : `
                        <span class="text-slate-400 italic">Tanpa Batas</span>
                      `
                    ) : `
                      <span class="text-slate-400">-</span>
                    `}
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <button 
                      onclick="handleToggleDiscount('${d.id}')"
                      class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition ${
                        Boolean(d.isActive)
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-200' 
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                      }"
                      title="Klik untuk mengubah status aktif/nonaktif"
                    >
                      <span class="w-1.5 h-1.5 rounded-full ${Boolean(d.isActive) ? 'bg-emerald-500' : 'bg-slate-400'} mr-1.5"></span>
                      ${Boolean(d.isActive) ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <div class="flex items-center justify-center space-x-1.5">
                      <button 
                        onclick="openDiscountModal('${d.id}')"
                        class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 transition"
                        title="Edit Diskon"
                      >
                        <i data-lucide="pencil" class="w-4 h-4"></i>
                      </button>
                      <button 
                        onclick="promptDeleteDiscount('${d.id}', '${d.name.replace(/'/g, "\\'")}')"
                        class="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 transition"
                        title="Hapus Diskon"
                      >
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="7" class="py-16 text-center">
                    <div class="max-w-xs mx-auto space-y-3">
                      <div class="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-pink-950/60 text-pink-500 flex items-center justify-center mx-auto">
                        <i data-lucide="ticket" class="w-6 h-6"></i>
                      </div>
                      <p class="font-bold text-slate-700 dark:text-slate-300 text-sm">Belum Ada Promo / Diskon</p>
                      <p class="text-xs text-slate-400">
                        Buat promo voucher pertama Anda untuk meningkatkan transaksi pelanggan di kasir!
                      </p>
                      <button 
                        onclick="openDiscountModal()" 
                        class="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs inline-flex items-center space-x-1.5 shadow-md transition"
                      >
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        <span>Buat Diskon Baru</span>
                      </button>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

// Modal: Tambah atau Edit Diskon / Promo
function openDiscountModal(discountId = null) {
  const store = window.store;
  const isEdit = Boolean(discountId);
  const d = isEdit ? (store.discounts || []).find(item => item.id === discountId) : null;

  const container = document.getElementById('modal-container');
  if (!container) return;

  const initialType = d ? d.type : 'percentage';

  container.innerHTML = `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in zoom-in-95 duration-150">
        
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 class="font-bold text-base text-slate-800 dark:text-white flex items-center space-x-2">
            <div class="w-7 h-7 rounded-lg bg-pink-500/10 text-pink-600 flex items-center justify-center">
              <i data-lucide="${isEdit ? 'pencil' : 'plus-circle'}" class="w-4 h-4"></i>
            </div>
            <span>${isEdit ? 'Edit Diskon & Promo' : 'Tambah Diskon / Promo Baru'}</span>
          </h3>
          <button onclick="closeModal()" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <form onsubmit="handleSaveDiscount(event, '${discountId || ''}')" class="space-y-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Nama Promo / Voucher *</label>
            <input 
              type="text" 
              name="name" 
              required 
              value="${d ? d.name : ''}"
              placeholder="Contoh: Promo Weekend 10% atau Potongan Belanja Rp 5.000"
              class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-pink-500 focus:outline-none"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Kode Voucher (Opsional)</label>
              <input 
                type="text" 
                name="code" 
                value="${d ? (d.code || '') : ''}"
                placeholder="Contoh: HEMAT10"
                style="text-transform: uppercase;"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-mono font-bold focus:ring-2 focus:ring-pink-500 focus:outline-none"
              />
              <p class="text-[10px] text-slate-400 mt-0.5">Dapat diketik oleh kasir saat checkout.</p>
            </div>
            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Tipe Diskon *</label>
              <select 
                id="discount-type-select"
                name="type"
                onchange="toggleDiscountTypeFields(this.value)"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-pink-500 focus:outline-none"
              >
                <option value="percentage" ${initialType === 'percentage' ? 'selected' : ''}>Persentase (%)</option>
                <option value="fixed" ${initialType === 'fixed' ? 'selected' : ''}>Potongan Tetap (Rp)</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label id="discount-value-label" class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                ${initialType === 'percentage' ? 'Besar Diskon (%) *' : 'Nominal Potongan (Rp) *'}
              </label>
              <input 
                type="number" 
                name="value" 
                step="any"
                min="0"
                required 
                value="${d ? d.value : ''}"
                placeholder="${initialType === 'percentage' ? 'Contoh: 10' : 'Contoh: 5000'}"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-bold text-sm focus:ring-2 focus:ring-pink-500 focus:outline-none"
              />
            </div>

            <div id="max-discount-container" style="${initialType === 'percentage' ? '' : 'display: none;'}">
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Maks. Potongan Diskon (Rp)</label>
              <input 
                type="number" 
                name="maxDiscount" 
                min="0"
                value="${d ? (d.maxDiscount || 0) : 0}"
                placeholder="0 = Tanpa Batas Maksimal"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-pink-500 focus:outline-none"
              />
              <p class="text-[10px] text-slate-400 mt-0.5">Isi 0 jika tidak dibatasi.</p>
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Syarat Minimal Pembelian (Rp)</label>
            <input 
              type="number" 
              name="minPurchase" 
              min="0"
              value="${d ? (d.minPurchase || 0) : 0}"
              placeholder="0 = Tanpa Syarat Minimal Belanja"
              class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-pink-500 focus:outline-none"
            />
            <p class="text-[10px] text-slate-400 mt-0.5">Diskon hanya bisa dipakai jika total belanja mencapai nominal ini.</p>
          </div>

          <div class="flex items-center space-x-2 pt-2">
            <input 
              type="checkbox" 
              id="discount-active-checkbox" 
              name="isActive" 
              ${d ? (Boolean(d.isActive) ? 'checked' : '') : 'checked'}
              class="w-4 h-4 rounded text-pink-600 focus:ring-pink-500 border-slate-300 dark:border-slate-700"
            />
            <label for="discount-active-checkbox" class="font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
              Aktifkan promo voucher ini sekarang
            </label>
          </div>

          <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
            <button 
              type="button" 
              onclick="closeModal()" 
              class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button 
              type="submit" 
              class="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold flex items-center space-x-1.5 shadow-lg shadow-pink-600/20 active:scale-95 transition"
            >
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>${isEdit ? 'Simpan Perubahan' : 'Tambah Promo'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleDiscountTypeFields(type) {
  const valueLabel = document.getElementById('discount-value-label');
  const maxDiscountContainer = document.getElementById('max-discount-container');
  if (type === 'percentage') {
    if (valueLabel) valueLabel.innerText = 'Besar Diskon (%) *';
    if (maxDiscountContainer) maxDiscountContainer.style.display = 'block';
  } else {
    if (valueLabel) valueLabel.innerText = 'Nominal Potongan (Rp) *';
    if (maxDiscountContainer) maxDiscountContainer.style.display = 'none';
  }
}

async function handleSaveDiscount(e, discountId) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = {
    id: discountId || '',
    name: formData.get('name').trim(),
    code: formData.get('code') ? formData.get('code').trim().toUpperCase() : '',
    type: formData.get('type'),
    value: Number(formData.get('value')) || 0,
    minPurchase: Number(formData.get('minPurchase')) || 0,
    maxDiscount: Number(formData.get('maxDiscount')) || 0,
    isActive: formData.get('isActive') ? 1 : 0
  };

  await window.store.saveDiscount(data);
  closeModal();
  window.renderApp();

  // Show Toast
  window.store.showRealtimeToast(`✅ Diskon "${data.name}" berhasil disimpan!`);
}

async function handleToggleDiscount(discountId) {
  await window.store.toggleDiscount(discountId);
  window.renderApp();
}

function promptDeleteDiscount(discountId, discountName) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in zoom-in-95 duration-150 text-center">
        
        <div class="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600 mx-auto flex items-center justify-center">
          <i data-lucide="alert-triangle" class="w-6 h-6"></i>
        </div>

        <div>
          <h3 class="font-bold text-base text-slate-800 dark:text-white">Hapus Promo Ini?</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Apakah Anda yakin ingin menghapus promo <strong>"${discountName}"</strong>? Diskon ini tidak akan bisa digunakan lagi oleh kasir.
          </p>
        </div>

        <div class="flex justify-center space-x-2 pt-2">
          <button 
            type="button" 
            onclick="closeModal()" 
            class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 font-semibold"
          >
            Batal
          </button>
          <button 
            type="button" 
            onclick="confirmDeleteDiscount('${discountId}')" 
            class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20"
          >
            Ya, Hapus
          </button>
        </div>

      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function confirmDeleteDiscount(discountId) {
  await window.store.deleteDiscount(discountId);
  closeModal();
  window.renderApp();
  window.store.showRealtimeToast('🗑️ Diskon promo berhasil dihapus.');
}
