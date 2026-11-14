/**
 * WARUNGKU POS - ADMIN SETTINGS & BACKUP COMPONENT
 */

function renderAdminSettings() {
  const store = window.store;
  const s = store.settings;

  return `
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-8">
      
      <!-- Top Title -->
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <i data-lucide="settings" class="w-6 h-6 text-indigo-600 dark:text-indigo-400"></i>
          <span>Pengaturan Toko & Keamanan</span>
        </h2>
        <p class="text-xs text-slate-400 mt-0.5">Konfigurasi profil warung, format struk printer thermal, password login, dan backup data.</p>
      </div>

      <!-- Settings Form -->
      <form onsubmit="handleSaveSettings(event)" class="space-y-6">
        
        <!-- SECTION 1: PROFIL TOKO -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <h3 class="font-bold text-sm text-slate-800 dark:text-white flex items-center space-x-2">
            <i data-lucide="store" class="w-4 h-4 text-indigo-600"></i>
            <span>Identitas & Profil Toko</span>
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Nama Toko / Warung *</label>
              <input 
                type="text" 
                name="storeName" 
                required 
                value="${s.storeName}"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Nomor HP / WhatsApp Toko *</label>
              <input 
                type="text" 
                name="storePhone" 
                required 
                value="${s.storePhone}"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Alamat Lengkap Toko *</label>
              <input 
                type="text" 
                name="storeAddress" 
                required 
                value="${s.storeAddress}"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <!-- SECTION 2: FORMAT CETAK STRUK, PAJAK & METODE PEMBAYARAN -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <h3 class="font-bold text-sm text-slate-800 dark:text-white flex items-center space-x-2">
            <i data-lucide="printer" class="w-4 h-4 text-emerald-600"></i>
            <span>Format Struk, Pajak (PPN) & Metode Pembayaran</span>
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Ukuran Kertas Thermal Printer</label>
              <select 
                name="paperSize"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-medium focus:outline-none"
              >
                <option value="58mm" ${s.paperSize === '58mm' ? 'selected' : ''}>Thermal 58mm (VSC TM-58D PRO / Mini POS)</option>
                <option value="80mm" ${s.paperSize === '80mm' ? 'selected' : ''}>Thermal 80mm (Lebar)</option>
              </select>
            </div>

            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Pajak PPN (%) — Isi 0 jika Tanpa Pajak</label>
              <input 
                type="number" 
                name="taxRate" 
                min="0"
                max="100"
                step="any"
                value="${s.taxRate || 0}"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-bold focus:outline-none"
              />
            </div>

            <div class="sm:col-span-2 p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 space-y-2.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center space-x-2">
                  <i data-lucide="printer" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
                  <span class="font-bold text-slate-800 dark:text-white text-xs">Konfigurasi Printer Struk Thermal (VSC TM-58D PRO — 58mm USB+BT)</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    onclick="detectInstalledPrinters()"
                    class="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center space-x-1 transition"
                  >
                    <i data-lucide="refresh-cw" class="w-3 h-3"></i>
                    <span>Deteksi Printer USB</span>
                  </button>
                  <button
                    type="button"
                    onclick="testThermalPrinterNow()"
                    class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center space-x-1 shadow-sm transition"
                  >
                    <i data-lucide="printer" class="w-3.5 h-3.5"></i>
                    <span>Test Cetak 58mm</span>
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Nama Printer Windows (Kosongkan = Otomatis Deteksi POS-58 / VSC)</label>
                  <input
                    type="text"
                    id="settings-printer-name"
                    name="printerName"
                    value="${escapeHtml(s.printerName || localStorage.getItem('WARUNGKU_PRINTER_NAME') || '')}"
                    placeholder="Otomatis pilih printer VSC / POS-58..."
                    class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-mono text-xs focus:outline-none"
                  />
                </div>
                <div class="flex items-end">
                  <label class="inline-flex items-center space-x-2 cursor-pointer py-2">
                    <input
                      type="checkbox"
                      name="autoPrintReceipt"
                      ${localStorage.getItem('pos_auto_print') === 'true' ? 'checked' : ''}
                      class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span class="font-bold text-slate-700 dark:text-slate-200 text-xs">Otomatis Cetak Struk Saat Pembayaran Selesai</span>
                  </label>
                </div>
              </div>
              <div id="printer-detect-status" class="text-[11px] text-slate-500 dark:text-slate-400">
                Mendukung cetak langsung <strong>USB ESC/POS (32 karakter / 58mm)</strong>, <strong>Dialog Print 58mm</strong>, dan <strong>Bluetooth WebBT</strong>.
              </div>
            </div>

            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Nama Merchant QRIS</label>
              <input 
                type="text" 
                name="qrisMerchantName" 
                value="${escapeHtml(s.qrisMerchantName || s.storeName || '')}"
                placeholder="WARUNG BERKAH JAYA"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">NMID QRIS (Opsional)</label>
              <input 
                type="text" 
                name="qrisNmid" 
                value="${escapeHtml(s.qrisNmid || '')}"
                placeholder="ID1020304050607"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-mono focus:outline-none"
              />
            </div>

            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Nama Bank Transfer</label>
              <input 
                type="text" 
                name="bankName" 
                value="${escapeHtml(s.bankName || 'BCA')}"
                placeholder="Contoh: BCA / BRI / Mandiri"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Nomor Rekening Bank</label>
              <input 
                type="text" 
                name="bankAccountNumber" 
                value="${escapeHtml(s.bankAccountNumber || '8830-1928-4412')}"
                placeholder="Contoh: 8830-1928-4412"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-mono font-bold focus:outline-none"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Atas Nama Rekening Bank</label>
              <input 
                type="text" 
                name="bankAccountHolder" 
                value="${escapeHtml(s.bankAccountHolder || s.storeName || '')}"
                placeholder="Nama pemilik rekening..."
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium focus:outline-none"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Catatan Kaki Struk (Footer)</label>
              <textarea 
                name="receiptFooter" 
                rows="2"
                class="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium focus:outline-none"
              >${escapeHtml(s.receiptFooter)}</textarea>
            </div>

            <div class="sm:col-span-2 pt-1">
              <label class="inline-flex items-center space-x-2.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  name="soundEnabled" 
                  ${s.soundEnabled !== false ? 'checked' : ''}
                  class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span class="font-semibold text-slate-700 dark:text-slate-200">Aktifkan Efek Suara Kasir (Beep Scan & Notifikasi Pembayaran)</span>
              </label>
            </div>
          </div>
        </div>

        <!-- SECTION 3: KEAMANAN & OPERATOR KASIR -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <h3 class="font-bold text-sm text-slate-800 dark:text-white flex items-center space-x-2">
            <i data-lucide="shield" class="w-4 h-4 text-indigo-600"></i>
            <span>Keamanan & Operator Kasir</span>
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Nama Operator Kasir Default</label>
              <input 
                type="text" 
                name="cashierName" 
                value="${escapeHtml(store.cashierName || 'Kasir 1')}"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-semibold focus:outline-none"
              />
              <p class="text-[10px] text-slate-400 mt-1">Tercetak pada struk kasir perangkat ini</p>
            </div>

            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Password Admin Baru</label>
              <input 
                type="password" 
                name="adminPassword" 
                value=""
                placeholder="Kosongkan jika tidak diubah"
                autocomplete="new-password"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-mono font-bold focus:outline-none"
              />
              <p class="text-[10px] text-slate-400 mt-1">Disimpan terenkripsi/terproteksi di server (tidak diekspos ke publik)</p>
            </div>

            <div>
              <label class="block font-semibold text-slate-600 dark:text-slate-300 mb-1">PIN Kasir Baru</label>
              <input 
                type="password" 
                name="cashierPin" 
                value=""
                placeholder="Kosongkan jika tidak diubah"
                autocomplete="new-password"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-mono font-bold focus:outline-none"
              />
              <p class="text-[10px] text-slate-400 mt-1">Digunakan saat login atau berpindah ke mode kasir</p>
            </div>
          </div>
        </div>

        <!-- Save Button -->
        <div class="flex justify-end">
          <button 
            type="submit" 
            class="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center space-x-2 transition"
          >
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Simpan Perubahan Pengaturan</span>
          </button>
        </div>

      </form>

      <!-- SECTION 4: BACKUP & RESTORE DATABASE JSON -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <h3 class="font-bold text-sm text-slate-800 dark:text-white flex items-center space-x-2">
          <i data-lucide="database" class="w-4 h-4 text-emerald-600"></i>
          <span>Backup & Restore Database Toko</span>
        </h3>
        <p class="text-xs text-slate-400">Amankan seluruh data produk, transaksi kasir, pengeluaran, dan riwayat stok ke file cadangan (JSON) agar tidak hilang saat ganti perangkat HP / PC.</p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <!-- Backup -->
          <button 
            onclick="window.store.exportBackupJSON()"
            class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition flex items-center space-x-3"
          >
            <div class="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <i data-lucide="download" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="font-bold text-xs text-slate-800 dark:text-white">Download Backup</div>
              <div class="text-[10px] text-slate-400">Simpan data ke file JSON</div>
            </div>
          </button>

          <!-- Restore -->
          <label class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition flex items-center space-x-3 cursor-pointer">
            <div class="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <i data-lucide="upload" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="font-bold text-xs text-slate-800 dark:text-white">Restore Backup</div>
              <div class="text-[10px] text-slate-400">Pulihkan dari file JSON</div>
            </div>
            <input type="file" accept=".json" onchange="handleImportFile(event)" class="hidden" />
          </label>

          <!-- Reset -->
          <button 
            onclick="confirmResetAll()"
            class="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left transition flex items-center space-x-3 text-rose-600"
          >
            <div class="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center">
              <i data-lucide="refresh-cw" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="font-bold text-xs text-rose-600 dark:text-rose-400">Reset Data Demo</div>
              <div class="text-[10px] text-rose-400">Kembalikan ke data awal</div>
            </div>
          </button>
        </div>
      </div>

    </div>
  `;
}

async function handleSaveSettings(e) {
  e.preventDefault();
  const form = e.target;
  if (form.cashierName && form.cashierName.value.trim()) {
    window.store.setCashierName(form.cashierName.value.trim());
  }
  const printerNameVal = form.printerName ? form.printerName.value.trim() : '';
  localStorage.setItem('WARUNGKU_PRINTER_NAME', printerNameVal);
  if (form.autoPrintReceipt) {
    localStorage.setItem('pos_auto_print', form.autoPrintReceipt.checked ? 'true' : 'false');
  }
  await window.store.updateSettings({
    storeName: form.storeName.value.trim(),
    storePhone: form.storePhone.value.trim(),
    storeAddress: form.storeAddress.value.trim(),
    paperSize: form.paperSize.value,
    printerName: printerNameVal,
    taxRate: Number(form.taxRate.value) || 0,
    qrisMerchantName: form.qrisMerchantName.value.trim(),
    qrisNmid: form.qrisNmid.value.trim(),
    bankName: form.bankName.value.trim() || 'BCA',
    bankAccountNumber: form.bankAccountNumber.value.trim(),
    bankAccountHolder: form.bankAccountHolder.value.trim(),
    receiptFooter: form.receiptFooter.value.trim(),
    soundEnabled: Boolean(form.soundEnabled.checked),
    adminPassword: form.adminPassword.value.trim(),
    cashierPin: form.cashierPin.value.trim()
  });
  window.renderApp();
  window.store.showRealtimeToast("✅ Pengaturan toko & printer berhasil disimpan!");
}

async function detectInstalledPrinters() {
  const statusEl = document.getElementById('printer-detect-status');
  const inputEl = document.getElementById('settings-printer-name');
  if (statusEl) statusEl.innerHTML = '⏳ Memindai printer USB VSC TM-58D PRO yang terhubung...';
  try {
    const res = await window.store.apiFetch('/api/printers');
    const data = await res.json();
    if (res.ok && data) {
      const printers = data.printers || [];
      const rec = data.recommendedPrinter || '';
      if (rec && inputEl) {
        inputEl.value = rec;
        localStorage.setItem('WARUNGKU_PRINTER_NAME', rec);
      }
      if (printers.length > 0) {
        const badges = printers.map(p => {
          const escaped = escapeHtml(p).replace(/'/g, "\\'");
          return `<button type="button" onclick="document.getElementById('settings-printer-name').value='${escaped}'; localStorage.setItem('WARUNGKU_PRINTER_NAME','${escaped}');" class="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 font-mono text-[10px] hover:bg-emerald-200 transition">${escapeHtml(p)}</button>`;
        }).join(' ');
        if (statusEl) {
          statusEl.innerHTML = `✅ Printer USB terdeteksi (klik untuk memilih): ${badges}`;
        }
      } else {
        if (statusEl) statusEl.innerHTML = '⚠️ Printer VSC TM-58D PRO belum terdeteksi di USB. Pastikan kabel USB terpasang & tombol power printer menyala.';
      }
    } else {
      if (statusEl) statusEl.innerHTML = '⚠️ Gagal mengambil daftar printer dari server.';
    }
  } catch (err) {
    if (statusEl) statusEl.innerHTML = '⚠️ Gagal menghubungi server printer.';
  }
}

async function testThermalPrinterNow() {
  const inputEl = document.getElementById('settings-printer-name');
  if (inputEl && inputEl.value.trim()) {
    localStorage.setItem('WARUNGKU_PRINTER_NAME', inputEl.value.trim());
  }
  const sampleTrx = {
    id: 'TEST-' + String(Date.now()).slice(-6),
    date: new Date().toISOString(),
    cashier: window.store.cashierName || 'Kasir 1',
    customerName: 'TEST PRINTER VSC TM-58D',
    paymentMethod: 'Tunai',
    items: [
      { name: 'TEST CETAK VSC TM-58D PRO 58MM', qty: 1, sellPrice: 15000, subtotal: 15000 }
    ],
    subtotal: 15000,
    discount: 0,
    tax: 0,
    total: 15000,
    amountPaid: 20000,
    change: 5000
  };
  if (typeof printThermalReceiptNow === 'function') {
    await printThermalReceiptNow(sampleTrx);
  }
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(evt) {
    const result = await window.store.importBackupJSON(evt.target.result);
    alert(result.message);
    if (result.success) {
      window.renderApp();
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

function confirmResetAll() {
  if (confirm("PERINGATAN: Semua data penjualan dan perubahan produk akan dikembalikan ke data awal demo. Lanjutkan?")) {
    window.store.resetToDefault();
  }
}
