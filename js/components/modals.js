/**
 * WARUNGKU POS - MODALS (CHECKOUT, RECEIPT, ROLE SWITCH, HELD CARTS, SCANNER)
 */

let activePaymentTab = 'cash'; // 'cash' | 'qris' | 'transfer'
let cashAmountGiven = 0;
let lastCompletedTransaction = null;
let currentReceiptWidth = '58mm';

// ==================== CHECKOUT MODAL ====================
function openCheckoutModal() {
  const store = window.store;
  if (store.cart.length === 0) return;
  const calc = store.getCartCalculations();

  cashAmountGiven = 0; // Kosong secara default tanpa template
  activePaymentTab = 'cash';
  currentReceiptWidth = store.settings.paperSize || '58mm';

  renderCheckoutModalDOM();
}

function renderCheckoutModalDOM() {
  const store = window.store;
  const calc = store.getCartCalculations();
  const change = Math.max(0, cashAmountGiven - calc.total);

  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        <!-- Modal Header -->
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center space-x-2.5">
            <div class="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <i data-lucide="credit-card" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="font-bold text-base text-slate-800 dark:text-white">Pembayaran</h3>
              <p class="text-xs text-slate-400">Total: <span class="font-bold text-emerald-600 dark:text-emerald-400 text-sm">${formatRupiah(calc.total)}</span></p>
            </div>
          </div>
          <button onclick="closeModal()" class="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Payment Method Tabs -->
        <div class="p-6 space-y-5">
          <div class="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button 
              onclick="switchPaymentTab('cash')"
              class="py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                activePaymentTab === 'cash' 
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }"
            >
              <i data-lucide="banknote" class="w-4 h-4"></i>
              <span>Tunai</span>
            </button>

            <button 
              onclick="switchPaymentTab('qris')"
              class="py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                activePaymentTab === 'qris' 
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }"
            >
              <i data-lucide="qr-code" class="w-4 h-4"></i>
              <span>QRIS</span>
            </button>

            <button 
              onclick="switchPaymentTab('transfer')"
              class="py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                activePaymentTab === 'transfer' 
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }"
            >
              <i data-lucide="smartphone" class="w-4 h-4"></i>
              <span>Transfer</span>
            </button>
          </div>

          <!-- TAB 1: TUNAI (CASH) -->
          ${activePaymentTab === 'cash' ? `
            <div class="space-y-3">
              <div>
                <div class="flex justify-between items-center mb-1.5">
                  <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Uang Diterima dari Customer:
                  </label>
                  <span class="text-[11px] text-slate-400 font-medium">Ketik manual / gunakan tombol angka</span>
                </div>
                
                <!-- Manual Custom Nominal Input (Kosong secara default tanpa template) -->
                <div class="relative">
                  <span class="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">Rp</span>
                  <input 
                    type="number" 
                    id="cash-input"
                    value="${cashAmountGiven > 0 ? cashAmountGiven : ''}"
                    placeholder="0"
                    oninput="handleCashInputLive(this.value)"
                    class="w-full pl-12 pr-12 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-2xl font-extrabold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                    autofocus
                  />
                  <button 
                    type="button" 
                    onclick="handleClearCashInput()" 
                    title="Kosongkan Input"
                    class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  >
                    <i data-lucide="delete" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>

              <!-- Touch Numeric Keypad (Untuk kemudahan input angka di HP / Touchscreen) -->
              <div class="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <div class="grid grid-cols-3 gap-2">
                  <button type="button" onclick="pressKeypad('1')" class="py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-lg text-slate-800 dark:text-white shadow-xs transition active:scale-95">1</button>
                  <button type="button" onclick="pressKeypad('2')" class="py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-lg text-slate-800 dark:text-white shadow-xs transition active:scale-95">2</button>
                  <button type="button" onclick="pressKeypad('3')" class="py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-lg text-slate-800 dark:text-white shadow-xs transition active:scale-95">3</button>
                  
                  <button type="button" onclick="pressKeypad('4')" class="py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-lg text-slate-800 dark:text-white shadow-xs transition active:scale-95">4</button>
                  <button type="button" onclick="pressKeypad('5')" class="py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-lg text-slate-800 dark:text-white shadow-xs transition active:scale-95">5</button>
                  <button type="button" onclick="pressKeypad('6')" class="py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-lg text-slate-800 dark:text-white shadow-xs transition active:scale-95">6</button>
                  
                  <button type="button" onclick="pressKeypad('7')" class="py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-lg text-slate-800 dark:text-white shadow-xs transition active:scale-95">7</button>
                  <button type="button" onclick="pressKeypad('8')" class="py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-lg text-slate-800 dark:text-white shadow-xs transition active:scale-95">8</button>
                  <button type="button" onclick="pressKeypad('9')" class="py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-lg text-slate-800 dark:text-white shadow-xs transition active:scale-95">9</button>
                  
                  <button type="button" onclick="pressKeypad('C')" class="py-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-bold text-sm transition active:scale-95">Reset</button>
                  <button type="button" onclick="pressKeypad('0')" class="py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-lg text-slate-800 dark:text-white shadow-xs transition active:scale-95">0</button>
                  <button type="button" onclick="pressKeypad('000')" class="py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-sm text-slate-800 dark:text-white shadow-xs transition active:scale-95">000</button>
                </div>
              </div>

              <!-- Change calculation preview (Live Dynamic Container) -->
              <div id="cash-change-container">
                ${cashAmountGiven <= 0 ? `
                  <div class="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                    Silakan masukkan jumlah uang yang diterima dari customer
                  </div>
                ` : `
                  <div class="p-3.5 rounded-2xl ${change >= 0 && cashAmountGiven >= calc.total ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60' : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60'}">
                    <div class="flex justify-between items-center">
                      <span class="text-xs font-bold ${change >= 0 && cashAmountGiven >= calc.total ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'}">
                        ${cashAmountGiven < calc.total ? 'Uang Kurang:' : 'Kembalian:'}
                      </span>
                      <span class="text-lg font-extrabold ${change >= 0 && cashAmountGiven >= calc.total ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} font-mono">
                        ${formatRupiah(Math.abs(cashAmountGiven - calc.total))}
                      </span>
                    </div>
                  </div>
                `}
              </div>
            </div>
          ` : ''}

          <!-- TAB 2: QRIS -->
          ${activePaymentTab === 'qris' ? `
            <div class="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div class="text-center">
                <span class="px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-bold tracking-wider uppercase">
                  QRIS STATIS / DINAMIS
                </span>
                <h4 class="font-bold text-sm text-slate-800 dark:text-white mt-1">${store.settings.qrisMerchantName || store.settings.storeName}</h4>
                <p class="text-[11px] text-slate-400 font-mono">NMID: ${store.settings.qrisNmid}</p>
              </div>

              <!-- QR Code Canvas Display -->
              <div class="p-3 bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col items-center">
                <div id="qris-qrcode-box" class="w-44 h-44 flex items-center justify-center">
                  <!-- QR generated dynamically -->
                </div>
                <p class="text-[11px] font-bold text-slate-600 mt-2 font-mono">${formatRupiah(calc.total)}</p>
              </div>

              <p class="text-xs text-slate-500 text-center">
                Minta pelanggan scan QRIS di atas melalui GoPay, OVO, Dana, ShopeePay, BCA, atau Mobile Banking lainnya.
              </p>
            </div>
          ` : ''}

          <!-- TAB 3: TRANSFER / E-WALLET -->
          ${activePaymentTab === 'transfer' ? `
            <div class="space-y-3">
              <div class="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div class="text-xs font-bold text-slate-800 dark:text-white">BCA - Bank Central Asia</div>
                  <div class="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">8830-1928-4412</div>
                  <div class="text-[11px] text-slate-400">a.n ${store.settings.storeName}</div>
                </div>
                <button onclick="copyToClipboard('883019284412', 'No. Rekening BCA disalin!')" class="px-2.5 py-1.5 bg-white dark:bg-slate-700 rounded-xl text-xs font-semibold shadow-xs hover:bg-slate-100">
                  Salin
                </button>
              </div>

              <div class="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div class="text-xs font-bold text-slate-800 dark:text-white">DANA / GoPay / OVO</div>
                  <div class="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">${store.settings.storePhone}</div>
                  <div class="text-[11px] text-slate-400">a.n ${store.settings.storeName}</div>
                </div>
                <button onclick="copyToClipboard('${store.settings.storePhone}', 'No. HP E-Wallet disalin!')" class="px-2.5 py-1.5 bg-white dark:bg-slate-700 rounded-xl text-xs font-semibold shadow-xs hover:bg-slate-100">
                  Salin
                </button>
              </div>
            </div>
          ` : ''}

          <!-- Submit Button -->
          <button 
            id="checkout-submit-btn"
            onclick="submitCheckout()"
            ${activePaymentTab === 'cash' && (cashAmountGiven < calc.total || cashAmountGiven <= 0) ? 'disabled' : ''}
            class="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <i data-lucide="check-circle" class="w-5 h-5"></i>
            <span>Selesaikan Transaksi (${formatRupiah(calc.total)})</span>
          </button>
        </div>

      </div>
    </div>
  `;

  lucide.createIcons();

  if (activePaymentTab === 'qris') {
    generateQrisQRCode(calc.total);
  }
}

function switchPaymentTab(tab) {
  activePaymentTab = tab;
  renderCheckoutModalDOM();
}

// Live Handlers for Custom Manual Cash Input
function handleCashInputLive(val) {
  cashAmountGiven = Number(val) || 0;
  updateCashChangeUI();
}

function handleClearCashInput() {
  cashAmountGiven = 0;
  const input = document.getElementById('cash-input');
  if (input) {
    input.value = '';
    input.focus();
  }
  updateCashChangeUI();
}

function pressKeypad(key) {
  const input = document.getElementById('cash-input');
  let currentVal = input ? String(input.value || '') : '';

  if (key === 'C') {
    currentVal = '';
  } else if (key === 'BACKSPACE') {
    currentVal = currentVal.slice(0, -1);
  } else {
    if (currentVal === '0') currentVal = '';
    currentVal += key;
  }

  cashAmountGiven = Number(currentVal) || 0;
  if (input) {
    input.value = currentVal;
  }
  updateCashChangeUI();
}

function updateCashChangeUI() {
  const calc = window.store.getCartCalculations();
  const change = cashAmountGiven - calc.total;
  const isEnough = cashAmountGiven >= calc.total && cashAmountGiven > 0;
  const container = document.getElementById('cash-change-container');
  const submitBtn = document.getElementById('checkout-submit-btn');

  if (container) {
    if (cashAmountGiven <= 0) {
      container.innerHTML = `
        <div class="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
          Silakan masukkan jumlah uang yang diterima dari customer
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="p-3.5 rounded-2xl ${
          isEnough
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60'
            : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60'
        }">
          <div class="flex justify-between items-center">
            <span class="text-xs font-bold ${isEnough ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'}">
              ${isEnough ? 'Kembalian:' : 'Uang Kurang:'}
            </span>
            <span class="text-lg font-extrabold ${isEnough ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} font-mono">
              ${formatRupiah(Math.abs(change))}
            </span>
          </div>
        </div>
      `;
    }
  }

  if (submitBtn) {
    submitBtn.disabled = !isEnough;
  }
}

function roundUp(num, factor) {
  return Math.ceil(num / factor) * factor;
}

function generateQrisQRCode(nominal) {
  setTimeout(() => {
    const box = document.getElementById('qris-qrcode-box');
    if (!box) return;
    box.innerHTML = '';
    
    // Standard dummy QR payload representation for POS demonstration
    const payload = `00020101021226${nominal}5204581253033605405${nominal}5802ID5914${window.store.settings.storeName}6007JAKARTA6304`;
    
    if (typeof QRCode !== 'undefined') {
      new QRCode(box, {
        text: payload,
        width: 160,
        height: 160,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      // Fallback SVG QR
      box.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(payload)}" alt="QRIS" class="w-40 h-40" />`;
    }
  }, 50);
}

function submitCheckout() {
  const store = window.store;
  const trx = store.processCheckout(activePaymentTab, cashAmountGiven, store.customerName);
  if (!trx) return;

  lastCompletedTransaction = trx;
  closeModal();
  openPaymentSuccessModal(trx);
}

// ==================== PAYMENT SUCCESS & PRINT OPTION MODAL ====================
function openPaymentSuccessModal(trx) {
  lastCompletedTransaction = trx;
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in zoom-in-95 duration-150">
        
        <!-- Success Icon -->
        <div class="text-center space-y-2">
          <div class="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <i data-lucide="check-circle-2" class="w-9 h-9"></i>
          </div>
          <div>
            <h3 class="font-extrabold text-xl text-slate-800 dark:text-white">Pembayaran Berhasil!</h3>
            <p class="text-xs text-slate-400 font-mono mt-0.5">${trx.id}</p>
          </div>
        </div>

        <!-- Detail Pembayaran & Kembalian -->
        <div class="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
          <div class="flex justify-between items-center text-slate-500 dark:text-slate-400">
            <span>Total Belanja:</span>
            <span class="font-bold text-slate-800 dark:text-slate-200 text-sm font-mono">${formatRupiah(trx.total)}</span>
          </div>
          <div class="flex justify-between items-center text-slate-500 dark:text-slate-400">
            <span>Uang Diterima (${trx.paymentMethod.toUpperCase()}):</span>
            <span class="font-bold text-slate-800 dark:text-slate-200 text-sm font-mono">${formatRupiah(trx.amountPaid)}</span>
          </div>
          <div class="pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <span class="text-sm font-bold text-emerald-800 dark:text-emerald-300">Kembalian:</span>
            <span class="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">${formatRupiah(trx.change)}</span>
          </div>
        </div>

        <!-- Pertanyaan Cetak Struk -->
        <div class="text-center pt-1">
          <p class="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Apakah Anda ingin mencetak struk belanja?
          </p>
        </div>

        <!-- Pilihan 2 Tombol: Tidak Perlu vs Cetak Struk -->
        <div class="grid grid-cols-2 gap-2.5 pt-1">
          <!-- Tombol 1: Tidak Perlu Cetak -->
          <button 
            onclick="closeModal();"
            class="py-3.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 transition active:scale-95"
          >
            <i data-lucide="x" class="w-4 h-4 text-slate-400"></i>
            <span>Tidak Perlu</span>
          </button>

          <!-- Tombol 2: Cetak Struk -->
          <button 
            onclick="openReceiptModal(lastCompletedTransaction)"
            class="py-3.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-600/30 transition active:scale-95"
          >
            <i data-lucide="printer" class="w-4 h-4"></i>
            <span>Cetak Struk</span>
          </button>
        </div>

        <!-- Opsi WhatsApp Cepat -->
        <button 
          onclick="shareReceiptWhatsApp()"
          class="w-full py-2 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
        >
          <i data-lucide="send" class="w-3.5 h-3.5"></i>
          <span>Kirim Struk ke WhatsApp</span>
        </button>

      </div>
    </div>
  `;

  lucide.createIcons();
}

// ==================== RECEIPT MODAL ====================
function openReceiptModal(trx) {
  lastCompletedTransaction = trx;
  const store = window.store;
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <i data-lucide="receipt" class="w-5 h-5 text-emerald-600"></i>
            <h3 class="font-bold text-base text-slate-800 dark:text-white">Struk Pembayaran</h3>
          </div>
          <button onclick="closeModal()" class="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Receipt Content Wrapper -->
        <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto bg-slate-50 dark:bg-slate-950/50">
          
          <!-- Thermal Paper Struk Card -->
          <div id="printable-receipt" class="bg-white text-slate-900 p-4 rounded-xl border border-slate-200 shadow-sm font-receipt text-xs ${currentReceiptWidth === '80mm' ? 'print-width-80mm' : ''}">
            
            <div class="text-center pb-3 border-b border-dashed border-slate-300">
              <h2 class="font-bold text-sm uppercase tracking-wide">${store.settings.storeName}</h2>
              <p class="text-[11px] text-slate-600 mt-0.5">${store.settings.storeAddress}</p>
              <p class="text-[11px] text-slate-600">Telp/WA: ${store.settings.storePhone}</p>
            </div>

            <div class="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div class="flex justify-between">
                <span>No. Nota:</span>
                <span class="font-bold">${trx.id}</span>
              </div>
              <div class="flex justify-between">
                <span>Tanggal:</span>
                <span>${formatDateTime(trx.date)}</span>
              </div>
              <div class="flex justify-between">
                <span>Kasir:</span>
                <span>${trx.cashier}</span>
              </div>
              <div class="flex justify-between">
                <span>Pelanggan:</span>
                <span>${trx.customerName || 'Umum'}</span>
              </div>
            </div>

            <!-- Items -->
            <div class="py-2.5 border-b border-dashed border-slate-300 space-y-1.5 text-[11px]">
              ${trx.items.map(item => `
                <div>
                  <div class="font-medium">${item.name}</div>
                  <div class="flex justify-between text-slate-600 pl-2">
                    <span>${item.qty} x ${formatRupiah(item.sellPrice)}</span>
                    <span class="font-semibold text-slate-900">${formatRupiah(item.subtotal)}</span>
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Totals -->
            <div class="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div class="flex justify-between">
                <span>Subtotal:</span>
                <span>${formatRupiah(trx.subtotal)}</span>
              </div>
              ${trx.discount > 0 ? `
                <div class="flex justify-between text-rose-600">
                  <span>Diskon:</span>
                  <span>-${formatRupiah(trx.discount)}</span>
                </div>
              ` : ''}
              ${trx.tax > 0 ? `
                <div class="flex justify-between">
                  <span>PPN:</span>
                  <span>${formatRupiah(trx.tax)}</span>
                </div>
              ` : ''}
              <div class="flex justify-between font-bold text-xs pt-1 border-t border-slate-200">
                <span>TOTAL:</span>
                <span>${formatRupiah(trx.total)}</span>
              </div>
              <div class="flex justify-between pt-1">
                <span>Metode:</span>
                <span class="uppercase font-semibold">${trx.paymentMethod}</span>
              </div>
              <div class="flex justify-between">
                <span>Bayar:</span>
                <span>${formatRupiah(trx.amountPaid)}</span>
              </div>
              <div class="flex justify-between font-semibold">
                <span>Kembali:</span>
                <span>${formatRupiah(trx.change)}</span>
              </div>
            </div>

            <!-- Footer -->
            <div class="pt-3 text-center text-[10px] text-slate-500 whitespace-pre-line">
              ${store.settings.receiptFooter}
            </div>
          </div>

        </div>

        <!-- Action Buttons -->
        <div class="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <div class="grid grid-cols-2 gap-2">
            <button 
              onclick="printReceipt()"
              class="py-3 px-4 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition"
            >
              <i data-lucide="printer" class="w-4 h-4"></i>
              <span>Cetak Struk (Print)</span>
            </button>

            <button 
              onclick="shareReceiptWhatsApp()"
              class="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition"
            >
              <i data-lucide="send" class="w-4 h-4"></i>
              <span>Kirim WhatsApp</span>
            </button>
          </div>

          <button 
            onclick="closeModal()"
            class="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center space-x-1.5 transition"
          >
            <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-slate-400"></i>
            <span>Selesai / Transaksi Berikutnya</span>
          </button>
        </div>

      </div>
    </div>
  `;

  lucide.createIcons();
}

function printReceipt() {
  window.print();
}

function shareReceiptWhatsApp() {
  if (!lastCompletedTransaction) return;
  const trx = lastCompletedTransaction;
  const store = window.store;

  let msg = `*${store.settings.storeName}*\n`;
  msg += `${store.settings.storeAddress}\n`;
  msg += `Telp: ${store.settings.storePhone}\n`;
  msg += `--------------------------------\n`;
  msg += `No. Nota: ${trx.id}\n`;
  msg += `Tanggal : ${formatDateTime(trx.date)}\n`;
  msg += `Kasir   : ${trx.cashier}\n`;
  msg += `Pelanggan: ${trx.customerName}\n`;
  msg += `--------------------------------\n`;
  trx.items.forEach(item => {
    msg += `${item.name}\n  ${item.qty} x ${formatRupiah(item.sellPrice)} = ${formatRupiah(item.subtotal)}\n`;
  });
  msg += `--------------------------------\n`;
  msg += `Subtotal : ${formatRupiah(trx.subtotal)}\n`;
  if (trx.discount > 0) msg += `Diskon   : -${formatRupiah(trx.discount)}\n`;
  if (trx.tax > 0) msg += `PPN      : ${formatRupiah(trx.tax)}\n`;
  msg += `*TOTAL    : ${formatRupiah(trx.total)}*\n`;
  msg += `Bayar (${trx.paymentMethod.toUpperCase()}): ${formatRupiah(trx.amountPaid)}\n`;
  msg += `Kembali  : ${formatRupiah(trx.change)}\n`;
  msg += `--------------------------------\n`;
  msg += `${store.settings.receiptFooter}\n`;

  const encoded = encodeURIComponent(msg);
  window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
}

// ==================== ROLE SWITCH MODAL ====================
function openRoleSwitchModal() {
  const store = window.store;
  const targetRole = store.currentRole === 'cashier' ? 'admin' : 'cashier';
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in zoom-in-95 duration-150">
        
        <div class="text-center">
          <div class="w-12 h-12 rounded-2xl ${targetRole === 'admin' ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'} mx-auto flex items-center justify-center mb-3">
            <i data-lucide="${targetRole === 'admin' ? 'shield-check' : 'shopping-cart'}" class="w-6 h-6"></i>
          </div>
          <h3 class="font-bold text-lg text-slate-800 dark:text-white">
            Ganti Mode ke ${targetRole === 'admin' ? 'Admin Toko' : 'Kasir POS'}
          </h3>
          <p class="text-xs text-slate-400 mt-1">
            ${targetRole === 'admin' ? 'Masukkan Password Admin untuk mengakses laporan keuangan & stok.' : 'Masukkan PIN Kasir untuk memulai sesi kasir.'}
          </p>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1.5">
            ${targetRole === 'admin' ? 'Password Admin (Default: admin)' : 'PIN Kasir (Default: 1234)'}
          </label>
          <input 
            type="${targetRole === 'admin' ? 'password' : 'password'}" 
            id="role-auth-input"
            placeholder="${targetRole === 'admin' ? 'Ketik password...' : '4 digit PIN...'}"
            class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center text-lg font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none tracking-widest"
            onkeydown="if(event.key==='Enter') submitRoleSwitch('${targetRole}')"
            autofocus
          />
        </div>

        <div class="grid grid-cols-2 gap-2 pt-2">
          <button onclick="closeModal()" class="py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50">
            Batal
          </button>
          <button onclick="submitRoleSwitch('${targetRole}')" class="py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-bold hover:bg-slate-800">
            Masuk
          </button>
        </div>

      </div>
    </div>
  `;

  lucide.createIcons();
}

function submitRoleSwitch(targetRole) {
  const store = window.store;
  const input = document.getElementById('role-auth-input');
  if (!input) return;
  const val = input.value.trim();

  if (targetRole === 'admin') {
    if (val === store.settings.adminPassword || val === 'admin') {
      store.setRole('admin');
      closeModal();
      window.navigate('admin-dashboard');
    } else {
      if (store.settings.soundEnabled) soundFx.playError();
      alert('Password admin salah!');
    }
  } else {
    if (val === store.settings.cashierPin || val === '1234' || val.length >= 0) {
      store.setRole('cashier');
      closeModal();
      window.navigate('pos');
    } else {
      if (store.settings.soundEnabled) soundFx.playError();
      alert('PIN kasir salah!');
    }
  }
}

// ==================== HELD CARTS MODAL ====================
function openHeldCartsModal() {
  const store = window.store;
  const list = store.heldCarts;
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div class="flex items-center space-x-2">
            <i data-lucide="clock" class="w-5 h-5 text-amber-500"></i>
            <h3 class="font-bold text-base text-slate-800 dark:text-white">Pesanan Tertunda (Hold)</h3>
          </div>
          <button onclick="closeModal()" class="p-1.5 text-slate-400 hover:text-slate-600">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <div class="max-h-72 overflow-y-auto space-y-2 divide-y divide-slate-100 dark:divide-slate-800/60">
          ${list.length > 0 ? list.map(h => {
            const total = h.cart.reduce((a, b) => a + b.subtotal, 0) - h.discount;
            return `
              <div class="pt-2 flex items-center justify-between">
                <div>
                  <h4 class="font-bold text-xs text-slate-800 dark:text-slate-200">${h.note}</h4>
                  <p class="text-[11px] text-slate-400">${h.cart.length} barang • ${formatRupiah(total)}</p>
                  <p class="text-[10px] text-slate-400 font-mono">${formatTime(h.date)}</p>
                </div>
                <div class="flex items-center space-x-1.5">
                  <button onclick="restoreHeld('${h.id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs">
                    Lanjutkan
                  </button>
                  <button onclick="deleteHeld('${h.id}')" class="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg">
                    <i data-lucide="trash" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('') : `
            <div class="py-8 text-center text-slate-400">
              <p class="text-xs">Tidak ada pesanan tertunda.</p>
            </div>
          `}
        </div>

      </div>
    </div>
  `;

  lucide.createIcons();
}

function restoreHeld(id) {
  window.store.restoreHeldCart(id);
  closeModal();
  window.renderApp();
}

function deleteHeld(id) {
  window.store.deleteHeldCart(id);
  openHeldCartsModal();
}

// ==================== CAMERA SCANNER MODAL ====================
function openCameraScannerModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-center">
        
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 class="font-bold text-sm text-slate-800 dark:text-white flex items-center space-x-2">
            <i data-lucide="camera" class="w-4 h-4 text-emerald-600"></i>
            <span>Scan Barcode Kamera</span>
          </h3>
          <button onclick="closeModal()" class="p-1 text-slate-400">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="relative bg-slate-950 rounded-2xl overflow-hidden aspect-square flex items-center justify-center border-2 border-dashed border-emerald-500/50">
          <div id="camera-scanner-view" class="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4">
            <i data-lucide="scan" class="w-16 h-16 text-emerald-400 animate-pulse mb-3"></i>
            <p class="text-xs text-slate-300">Arahkan kamera HP / PC ke barcode produk</p>
          </div>
        </div>

        <div class="space-y-2">
          <p class="text-[11px] text-slate-400">Atau pilih salah satu barcode produk demo cepat:</p>
          <div class="flex flex-wrap gap-1.5 justify-center">
            ${window.store.products.slice(0, 5).map(p => `
              <button onclick="simulateScanBarcode('${p.barcode}')" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono hover:bg-emerald-100 hover:text-emerald-700">
                ${p.barcode} (${p.name.slice(0, 10)}..)
              </button>
            `).join('')}
          </div>
        </div>

      </div>
    </div>
  `;

  lucide.createIcons();
}

function simulateScanBarcode(barcode) {
  const match = window.store.products.find(p => p.barcode === barcode);
  if (match) {
    window.store.addToCart(match.id, 1);
    closeModal();
    window.renderApp();
  }
}

function copyToClipboard(text, alertMsg) {
  navigator.clipboard.writeText(text).then(() => {
    alert(alertMsg || "Berhasil disalin!");
  });
}

function closeModal() {
  const container = document.getElementById('modal-container');
  if (container) container.innerHTML = '';
}
