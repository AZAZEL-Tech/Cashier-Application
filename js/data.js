/**
 * WARUNGKU POS - INITIAL DEMO DATA & STORAGE ENGINE
 */

const DEFAULT_SETTINGS = {
  storeName: "Warung Berkah Jaya",
  storeAddress: "Jl. Merdeka No. 45, Jakarta Selatan",
  storePhone: "0812-3456-7890",
  receiptFooter: "Terima kasih atas kunjungan Anda!\nBarang yang sudah dibeli tidak dapat ditukar.",
  currency: "Rp",
  taxRate: 0, // persentase PPN jika ada
  adminPassword: "admin", // default password admin
  cashierPin: "1234", // default PIN kasir
  qrisNmid: "ID1020304050607",
  qrisMerchantName: "WARUNG BERKAH JAYA",
  paperSize: "58mm", // "58mm" | "80mm"
  soundEnabled: true
};

const DEFAULT_CATEGORIES = [
  { id: "all", name: "Semua Produk", icon: "layout-grid" },
  { id: "sembako", name: "Sembako", icon: "wheat" },
  { id: "minuman", name: "Minuman", icon: "cup-soda" },
  { id: "makanan", name: "Makanan & Mie", icon: "utensils" },
  { id: "snack", name: "Snack & Jajanan", icon: "cookie" },
  { id: "rokok", name: "Rokok", icon: "flame" },
  { id: "kebersihan", name: "Sabun & Cuci", icon: "sparkles" },
  { id: "lainnya", name: "Lain-lain", icon: "package" }
];

const DEFAULT_PRODUCTS = [];

function generateSampleTransactions() {
  return [];
}

const DEFAULT_EXPENSES = [];

const DEFAULT_STOCK_HISTORY = [];

const DEFAULT_DISCOUNTS = [];

// Sound Synthesizer via Web Audio API
class SoundFX {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playBeep() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {
      console.warn("Sound error:", e);
    }
  }

  playSuccess() {
    try {
      this.init();
      if (!this.ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Major Arpeggio)
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + (idx * 0.08));
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime + (idx * 0.08));
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (idx * 0.08) + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + (idx * 0.08));
        osc.stop(this.ctx.currentTime + (idx * 0.08) + 0.25);
      });
    } catch (e) {
      console.warn("Sound error:", e);
    }
  }

  playError() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(140, this.ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch (e) {
      console.warn("Sound error:", e);
    }
  }
}

window.soundFx = new SoundFX();
