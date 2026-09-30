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

const DEFAULT_PRODUCTS = [
  {
    id: "P001",
    name: "Beras Rojolele 5kg",
    barcode: "8991001",
    category: "sembako",
    costPrice: 65000,
    sellPrice: 75000,
    stock: 24,
    minStock: 5,
    unit: "sak",
    image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "P002",
    name: "Minyak Goreng Bimoli 2L",
    barcode: "8991002",
    category: "sembako",
    costPrice: 32000,
    sellPrice: 37000,
    stock: 18,
    minStock: 5,
    unit: "pouch",
    image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "P003",
    name: "Gula Pasir Gulaku 1kg",
    barcode: "8991003",
    category: "sembako",
    costPrice: 15500,
    sellPrice: 18000,
    stock: 35,
    minStock: 10,
    unit: "kg",
    image: "https://images.unsplash.com/photo-1622484216805-4c07914fa679?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "P004",
    name: "Telur Ayam 1kg",
    barcode: "8991004",
    category: "sembako",
    costPrice: 26000,
    sellPrice: 29000,
    stock: 40,
    minStock: 8,
    unit: "kg",
    image: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "P005",
    name: "Indomie Goreng Original",
    barcode: "8991005",
    category: "makanan",
    costPrice: 2700,
    sellPrice: 3500,
    stock: 120,
    minStock: 20,
    unit: "bks",
    image: "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "P006",
    name: "Indomie Kuah Ayam Bawang",
    barcode: "8991006",
    category: "makanan",
    costPrice: 2700,
    sellPrice: 3500,
    stock: 80,
    minStock: 15,
    unit: "bks",
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "P007",
    name: "Teh Pucuk Harum 350ml",
    barcode: "8991007",
    category: "minuman",
    costPrice: 3000,
    sellPrice: 4000,
    stock: 48,
    minStock: 12,
    unit: "btl",
    image: "https://images.unsplash.com/photo-1556881286-fc6915169721?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "P008",
    name: "Aqua Botol 600ml",
    barcode: "8991008",
    category: "minuman",
    costPrice: 2500,
    sellPrice: 3500,
    stock: 60,
    minStock: 12,
    unit: "btl",
    image: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "P009",
    name: "Kopi Kapal Api Spesial Mix",
    barcode: "8991009",
    category: "minuman",
    costPrice: 1500,
    sellPrice: 2000,
    stock: 90,
    minStock: 15,
    unit: "sachet",
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "P010",
    name: "Chitato Sapi Panggang 68g",
    barcode: "8991010",
    category: "snack",
    costPrice: 9500,
    sellPrice: 12000,
    stock: 25,
    minStock: 5,
    unit: "bks",
    image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "P011",
    name: "Oreo Vanilla 133g",
    barcode: "8991011",
    category: "snack",
    costPrice: 8000,
    sellPrice: 10000,
    stock: 30,
    minStock: 6,
    unit: "pack",
    image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "P012",
    name: "Sampoerna Mild 16",
    barcode: "8991012",
    category: "rokok",
    costPrice: 31000,
    sellPrice: 34000,
    stock: 3, // LOW STOCK DEMO
    minStock: 10,
    unit: "bks",
    image: "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "P013",
    name: "Gudang Garam Surya 12",
    barcode: "8991013",
    category: "rokok",
    costPrice: 24000,
    sellPrice: 27000,
    stock: 2, // LOW STOCK DEMO
    minStock: 10,
    unit: "bks",
    image: "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "P014",
    name: "Sunlight Pencuci Piring 700ml",
    barcode: "8991014",
    category: "kebersihan",
    costPrice: 13000,
    sellPrice: 16000,
    stock: 15,
    minStock: 4,
    unit: "pouch",
    image: "https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "P015",
    name: "Rinso Anti Noda 770g",
    barcode: "8991015",
    category: "kebersihan",
    costPrice: 20000,
    sellPrice: 24500,
    stock: 12,
    minStock: 4,
    unit: "bks",
    image: "https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?w=400&auto=format&fit=crop&q=60"
  }
];

// Helper to seed initial sample transactions and expenses for realistic reports
function generateSampleTransactions() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  return [
    {
      id: "TRX-20260930-001",
      date: new Date(now.getTime() - 1000 * 60 * 120).toISOString(),
      cashier: "Kasir 1 (Rina)",
      items: [
        { id: "P001", name: "Beras Rojolele 5kg", qty: 1, costPrice: 65000, sellPrice: 75000, subtotal: 75000 },
        { id: "P002", name: "Minyak Goreng Bimoli 2L", qty: 1, costPrice: 32000, sellPrice: 37000, subtotal: 37000 }
      ],
      subtotal: 112000,
      discount: 0,
      tax: 0,
      total: 112000,
      totalCost: 97000,
      profit: 15000,
      paymentMethod: "cash",
      amountPaid: 120000,
      change: 8000,
      customerName: "Umum",
      status: "completed"
    },
    {
      id: "TRX-20260930-002",
      date: new Date(now.getTime() - 1000 * 60 * 60).toISOString(),
      cashier: "Kasir 1 (Rina)",
      items: [
        { id: "P005", name: "Indomie Goreng Original", qty: 5, costPrice: 2700, sellPrice: 3500, subtotal: 17500 },
        { id: "P007", name: "Teh Pucuk Harum 350ml", qty: 2, costPrice: 3000, sellPrice: 4000, subtotal: 8000 },
        { id: "P010", name: "Chitato Sapi Panggang 68g", qty: 1, costPrice: 9500, sellPrice: 12000, subtotal: 12000 }
      ],
      subtotal: 37500,
      discount: 0,
      tax: 0,
      total: 37500,
      totalCost: 29000,
      profit: 8500,
      paymentMethod: "qris",
      amountPaid: 37500,
      change: 0,
      customerName: "Bpk. Hendra",
      status: "completed"
    },
    {
      id: "TRX-20260930-003",
      date: new Date(now.getTime() - 1000 * 60 * 20).toISOString(),
      cashier: "Kasir 1 (Rina)",
      items: [
        { id: "P003", name: "Gula Pasir Gulaku 1kg", qty: 2, costPrice: 15500, sellPrice: 18000, subtotal: 36000 },
        { id: "P004", name: "Telur Ayam 1kg", qty: 1, costPrice: 26000, sellPrice: 29000, subtotal: 29000 }
      ],
      subtotal: 65000,
      discount: 2000,
      tax: 0,
      total: 63000,
      totalCost: 57000,
      profit: 6000,
      paymentMethod: "cash",
      amountPaid: 100000,
      change: 37000,
      customerName: "Ibu Siti",
      status: "completed"
    }
  ];
}

const DEFAULT_EXPENSES = [
  {
    id: "EXP-001",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    category: "Stok Barang",
    description: "Restock Beras & Minyak Goreng Agen Utama",
    amount: 550000,
    recordedBy: "Admin"
  },
  {
    id: "EXP-002",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    category: "Listrik & Air",
    description: "Token Listrik Toko Bulanan",
    amount: 150000,
    recordedBy: "Admin"
  },
  {
    id: "EXP-003",
    date: new Date().toISOString(),
    category: "Operasional",
    description: "Plastik Kantong & Kertas Struk 58mm",
    amount: 45000,
    recordedBy: "Admin"
  }
];

const DEFAULT_STOCK_HISTORY = [
  {
    id: "STK-001",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    productId: "P001",
    productName: "Beras Rojolele 5kg",
    type: "in", // "in" | "out"
    qty: 30,
    reason: "Restock Supplier PT Beras Nusantara",
    user: "Admin"
  },
  {
    id: "STK-002",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    productId: "P012",
    productName: "Sampoerna Mild 16",
    type: "out",
    qty: 1,
    reason: "Rusak / Basah kemasan",
    user: "Admin"
  }
];

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
