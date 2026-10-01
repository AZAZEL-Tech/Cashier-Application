-- ============================================================
-- WARUNGKU POS - MYSQL DATABASE SCHEMA
-- Compatible with MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+
-- ============================================================

CREATE DATABASE IF NOT EXISTS `warungku_pos` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `warungku_pos`;

-- 1. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS `settings` (
  `setting_key` VARCHAR(64) NOT NULL PRIMARY KEY,
  `setting_val` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS `categories` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(128) NOT NULL,
  `icon` VARCHAR(64) DEFAULT 'package'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `barcode` VARCHAR(128) DEFAULT '',
  `category` VARCHAR(64) DEFAULT 'sembako',
  `costPrice` DECIMAL(15,2) DEFAULT 0,
  `sellPrice` DECIMAL(15,2) DEFAULT 0,
  `stock` INT DEFAULT 0,
  `minStock` INT DEFAULT 5,
  `unit` VARCHAR(32) DEFAULT 'pcs',
  `image` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_category` (`category`),
  INDEX `idx_barcode` (`barcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `date` VARCHAR(64) NOT NULL,
  `cashier` VARCHAR(128) DEFAULT 'Kasir 1',
  `customerName` VARCHAR(128) DEFAULT 'Umum',
  `subtotal` DECIMAL(15,2) DEFAULT 0,
  `discount` DECIMAL(15,2) DEFAULT 0,
  `tax` DECIMAL(15,2) DEFAULT 0,
  `total` DECIMAL(15,2) DEFAULT 0,
  `totalCost` DECIMAL(15,2) DEFAULT 0,
  `profit` DECIMAL(15,2) DEFAULT 0,
  `paymentMethod` VARCHAR(32) DEFAULT 'cash',
  `amountPaid` DECIMAL(15,2) DEFAULT 0,
  `changeAmount` DECIMAL(15,2) DEFAULT 0,
  `status` VARCHAR(32) DEFAULT 'completed',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. TRANSACTION ITEMS TABLE
CREATE TABLE IF NOT EXISTS `transaction_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transaction_id` VARCHAR(64) NOT NULL,
  `product_id` VARCHAR(64) DEFAULT '',
  `name` VARCHAR(255) NOT NULL,
  `qty` INT DEFAULT 1,
  `costPrice` DECIMAL(15,2) DEFAULT 0,
  `sellPrice` DECIMAL(15,2) DEFAULT 0,
  `subtotal` DECIMAL(15,2) DEFAULT 0,
  INDEX `idx_trx_id` (`transaction_id`),
  FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. EXPENSES TABLE (PENGELUARAN / OPERASIONAL)
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `date` VARCHAR(64) NOT NULL,
  `category` VARCHAR(128) NOT NULL,
  `description` TEXT,
  `amount` DECIMAL(15,2) DEFAULT 0,
  `recordedBy` VARCHAR(128) DEFAULT 'Admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_exp_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. STOCK HISTORY (MUTASI STOK)
CREATE TABLE IF NOT EXISTS `stock_history` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `date` VARCHAR(64) NOT NULL,
  `productId` VARCHAR(64) NOT NULL,
  `productName` VARCHAR(255) NOT NULL,
  `type` VARCHAR(16) NOT NULL, -- 'in' | 'out'
  `qty` INT DEFAULT 0,
  `reason` TEXT,
  `user` VARCHAR(128) DEFAULT 'Admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_stk_prod` (`productId`),
  INDEX `idx_stk_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED DEFAULT SETTINGS & CATEGORIES
-- ============================================================
INSERT IGNORE INTO `settings` (`setting_key`, `setting_val`) VALUES
('storeName', 'Warung Berkah Jaya'),
('storeAddress', 'Jl. Merdeka No. 45, Jakarta Selatan'),
('storePhone', '0812-3456-7890'),
('receiptFooter', 'Terima kasih atas kunjungan Anda!\\nBarang yang sudah dibeli tidak dapat ditukar.'),
('currency', 'Rp'),
('taxRate', '0'),
('adminPassword', 'admin'),
('cashierPin', '1234'),
('qrisNmid', 'ID1020304050607'),
('qrisMerchantName', 'WARUNG BERKAH JAYA'),
('paperSize', '58mm'),
('soundEnabled', 'true');

INSERT IGNORE INTO `categories` (`id`, `name`, `icon`) VALUES
('all', 'Semua Produk', 'layout-grid'),
('sembako', 'Sembako', 'wheat'),
('minuman', 'Minuman', 'cup-soda'),
('makanan', 'Makanan & Mie', 'utensils'),
('snack', 'Snack & Jajanan', 'cookie'),
('rokok', 'Rokok', 'flame'),
('kebersihan', 'Sabun & Cuci', 'sparkles'),
('lainnya', 'Lain-lain', 'package');

-- SEED INITIAL SAMPLE PRODUCTS
INSERT IGNORE INTO `products` (`id`, `name`, `barcode`, `category`, `costPrice`, `sellPrice`, `stock`, `minStock`, `unit`, `image`) VALUES
('P001', 'Beras Rojolele 5kg', '8991001', 'sembako', 65000, 75000, 24, 5, 'sak', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=60'),
('P002', 'Minyak Goreng Bimoli 2L', '8991002', 'sembako', 32000, 37000, 18, 5, 'pouch', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=60'),
('P003', 'Gula Pasir Gulaku 1kg', '8991003', 'sembako', 15500, 18000, 35, 10, 'kg', 'https://images.unsplash.com/photo-1622484216805-4c07914fa679?w=400&auto=format&fit=crop&q=60'),
('P004', 'Telur Ayam 1kg', '8991004', 'sembako', 26000, 29000, 40, 8, 'kg', 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&auto=format&fit=crop&q=60'),
('P005', 'Indomie Goreng Original', '8991005', 'makanan', 2700, 3500, 120, 20, 'bks', 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&auto=format&fit=crop&q=60'),
('P006', 'Indomie Kuah Ayam Bawang', '8991006', 'makanan', 2700, 3500, 80, 15, 'bks', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop&q=60'),
('P007', 'Teh Pucuk Harum 350ml', '8991007', 'minuman', 3000, 4000, 48, 12, 'btl', 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=400&auto=format&fit=crop&q=60'),
('P008', 'Aqua Botol 600ml', '8991008', 'minuman', 2500, 3500, 60, 12, 'btl', 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&auto=format&fit=crop&q=60'),
('P009', 'Kopi Kapal Api Spesial Mix', '8991009', 'minuman', 1500, 2000, 90, 15, 'sachet', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=60'),
('P010', 'Chitato Sapi Panggang 68g', '8991010', 'snack', 9500, 12000, 25, 5, 'bks', 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&auto=format&fit=crop&q=60'),
('P011', 'Oreo Vanilla 133g', '8991011', 'snack', 8000, 10000, 30, 6, 'pack', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=60'),
('P012', 'Sampoerna Mild 16', '8991012', 'rokok', 31000, 34000, 3, 10, 'bks', 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=60'),
('P013', 'Gudang Garam Surya 12', '8991013', 'rokok', 24000, 27000, 2, 10, 'bks', 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=60'),
('P014', 'Sunlight Pencuci Piring 700ml', '8991014', 'kebersihan', 13000, 16000, 15, 4, 'pouch', 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?w=400&auto=format&fit=crop&q=60'),
('P015', 'Rinso Anti Noda 770g', '8991015', 'kebersihan', 20000, 24500, 12, 4, 'bks', 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?w=400&auto=format&fit=crop&q=60');
