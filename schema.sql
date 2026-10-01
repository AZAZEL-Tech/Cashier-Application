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

-- 8. DISCOUNTS & PROMO VOUCHERS TABLE
CREATE TABLE IF NOT EXISTS `discounts` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(128) NOT NULL,
  `code` VARCHAR(64) DEFAULT '',
  `type` VARCHAR(32) NOT NULL DEFAULT 'percentage', -- 'percentage' | 'fixed'
  `value` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `minPurchase` DECIMAL(15,2) DEFAULT 0,
  `maxDiscount` DECIMAL(15,2) DEFAULT 0,
  `isActive` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_discount_code` (`code`)
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

