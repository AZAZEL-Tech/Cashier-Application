#!/usr/bin/env python3
"""
WarungKu POS - Database Adapter (MySQL / MariaDB & SQLite Engine)
Supports High-Performance Relational SQL with Zero External System Dependencies.
"""

import os
import sys
import json
import time
import hmac
import sqlite3
import threading


def to_rupiah(val):
    """Normalize monetary value to exact integer Rupiah (no floating-point drift)."""
    try:
        return int(round(float(val or 0)))
    except (ValueError, TypeError):
        return 0

# Add bundled pure-python libraries in lib/
LIB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib")
if os.path.exists(LIB_DIR) and LIB_DIR not in sys.path:
    sys.path.insert(0, LIB_DIR)

try:
    import pymysql
    import pymysql.cursors
    PYMYSQL_AVAILABLE = True
except ImportError:
    PYMYSQL_AVAILABLE = False


DEFAULT_SETTINGS = {
    "storeName": "Warung Berkah Jaya",
    "storeAddress": "Jl. Merdeka No. 45, Jakarta Selatan",
    "storePhone": "0812-3456-7890",
    "receiptFooter": "Terima kasih atas kunjungan Anda!\nBarang yang sudah dibeli tidak dapat ditukar.",
    "currency": "Rp",
    "taxRate": 0,
    "adminPassword": "admin",
    "cashierPin": "1234",
    "qrisNmid": "ID1020304050607",
    "qrisMerchantName": "WARUNG BERKAH JAYA",
    "bankName": "BCA",
    "bankAccountNumber": "8830-1928-4412",
    "bankAccountHolder": "Warung Berkah Jaya",
    "paperSize": "58mm",
    "soundEnabled": True
}

DEFAULT_CATEGORIES = [
    { "id": "all", "name": "Semua Produk", "icon": "layout-grid" },
    { "id": "sembako", "name": "Sembako", "icon": "wheat" },
    { "id": "minuman", "name": "Minuman", "icon": "cup-soda" },
    { "id": "makanan", "name": "Makanan & Mie", "icon": "utensils" },
    { "id": "snack", "name": "Snack & Jajanan", "icon": "cookie" },
    { "id": "rokok", "name": "Rokok", "icon": "flame" },
    { "id": "kebersihan", "name": "Sabun & Cuci", "icon": "sparkles" },
    { "id": "lainnya", "name": "Lain-lain", "icon": "package" }
]

DEFAULT_PRODUCTS = []


class DatabaseEngine:
    def __init__(self, base_dir):
        self.base_dir = base_dir
        self.config_path = os.path.join(base_dir, "db_config.json")
        self.data_dir = os.path.join(base_dir, "data")
        os.makedirs(self.data_dir, exist_ok=True)
        self.sqlite_file = os.path.join(self.data_dir, "pos_database.db")
        self.lock = threading.RLock()
        self.driver_type = "sqlite"
        self.mysql_config = {}

        self._load_config()
        self._init_database()

    def _load_config(self):
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    self.driver_type = cfg.get("driver", "mysql")
                    self.mysql_config = cfg.get("mysql", {})
            except Exception as e:
                print(f"[DB] Error loading db_config.json: {e}")

        # Override from Environment Variables if present
        if os.environ.get("DB_HOST"):
            self.driver_type = "mysql"
            self.mysql_config["host"] = os.environ.get("DB_HOST", "localhost")
            self.mysql_config["port"] = int(os.environ.get("DB_PORT", 3306))
            self.mysql_config["user"] = os.environ.get("DB_USER", "root")
            self.mysql_config["password"] = os.environ.get("DB_PASSWORD", "")
            self.mysql_config["database"] = os.environ.get("DB_NAME", "warungku_pos")

    def _get_mysql_connection(self, create_db=False):
        if not PYMYSQL_AVAILABLE:
            raise RuntimeError("PyMySQL driver not available")

        host = self.mysql_config.get("host", "localhost")
        port = int(self.mysql_config.get("port", 3306))
        user = self.mysql_config.get("user", "root")
        password = self.mysql_config.get("password", "")
        db_name = self.mysql_config.get("database", "warungku_pos")

        if create_db:
            conn = pymysql.connect(
                host=host, port=port, user=user, password=password,
                charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor
            )
            with conn.cursor() as cur:
                cur.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            conn.commit()
            conn.close()

        return pymysql.connect(
            host=host, port=port, user=user, password=password,
            database=db_name, charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True
        )

    def _get_sqlite_connection(self):
        conn = sqlite3.connect(self.sqlite_file, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_database(self):
        # 1. Try MySQL if configured
        if self.driver_type == "mysql" and PYMYSQL_AVAILABLE:
            try:
                print(f"[DB] Connecting to MySQL ({self.mysql_config.get('host')}:{self.mysql_config.get('port')}, db: {self.mysql_config.get('database')})...")
                self._get_mysql_connection(create_db=True)
                self._create_mysql_tables()
                self._seed_if_empty_mysql()
                print("✅ [DB] Database Engine Active: MySQL / MariaDB (High Performance)")
                return
            except Exception as e:
                print(f"⚠️ [DB] MySQL connection failed ({e}). Falling back to Relational SQLite Engine...")
                self.driver_type = "sqlite"

        # 2. SQLite Engine Fallback
        self.driver_type = "sqlite"
        self._create_sqlite_tables()
        self._seed_if_empty_sqlite()
        print(f"✅ [DB] Database Engine Active: SQLite ({self.sqlite_file})")

    def _create_mysql_tables(self):
        conn = self._get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                CREATE TABLE IF NOT EXISTS `settings` (
                    `setting_key` VARCHAR(64) NOT NULL PRIMARY KEY,
                    `setting_val` TEXT NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                """)
                cur.execute("""
                CREATE TABLE IF NOT EXISTS `categories` (
                    `id` VARCHAR(64) NOT NULL PRIMARY KEY,
                    `name` VARCHAR(128) NOT NULL,
                    `icon` VARCHAR(64) DEFAULT 'package'
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                """)
                cur.execute("""
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
                """)
                cur.execute("""
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
                """)
                cur.execute("""
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
                """)
                cur.execute("""
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
                """)
                cur.execute("""
                CREATE TABLE IF NOT EXISTS `stock_history` (
                    `id` VARCHAR(64) NOT NULL PRIMARY KEY,
                    `date` VARCHAR(64) NOT NULL,
                    `productId` VARCHAR(64) NOT NULL,
                    `productName` VARCHAR(255) NOT NULL,
                    `type` VARCHAR(16) NOT NULL,
                    `qty` INT DEFAULT 0,
                    `reason` TEXT,
                    `user` VARCHAR(128) DEFAULT 'Admin',
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX `idx_stk_prod` (`productId`),
                    INDEX `idx_stk_date` (`date`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                """)
                cur.execute("""
                CREATE TABLE IF NOT EXISTS `discounts` (
                    `id` VARCHAR(64) NOT NULL PRIMARY KEY,
                    `name` VARCHAR(128) NOT NULL,
                    `code` VARCHAR(64) DEFAULT '',
                    `type` VARCHAR(32) NOT NULL DEFAULT 'percentage',
                    `value` DECIMAL(15,2) NOT NULL DEFAULT 0,
                    `minPurchase` DECIMAL(15,2) DEFAULT 0,
                    `maxDiscount` DECIMAL(15,2) DEFAULT 0,
                    `isActive` TINYINT(1) DEFAULT 1,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX `idx_discount_code` (`code`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                """)
        finally:
            conn.close()

    def _create_sqlite_tables(self):
        conn = self._get_sqlite_connection()
        try:
            cur = conn.cursor()
            cur.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                setting_key TEXT PRIMARY KEY,
                setting_val TEXT NOT NULL
            );
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT DEFAULT 'package'
            );
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                barcode TEXT DEFAULT '',
                category TEXT DEFAULT 'sembako',
                costPrice INTEGER DEFAULT 0,
                sellPrice INTEGER DEFAULT 0,
                stock INTEGER DEFAULT 0,
                minStock INTEGER DEFAULT 5,
                unit TEXT DEFAULT 'pcs',
                image TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                cashier TEXT DEFAULT 'Kasir 1',
                customerName TEXT DEFAULT 'Umum',
                subtotal INTEGER DEFAULT 0,
                discount INTEGER DEFAULT 0,
                tax INTEGER DEFAULT 0,
                total INTEGER DEFAULT 0,
                totalCost INTEGER DEFAULT 0,
                profit INTEGER DEFAULT 0,
                paymentMethod TEXT DEFAULT 'cash',
                amountPaid INTEGER DEFAULT 0,
                changeAmount INTEGER DEFAULT 0,
                status TEXT DEFAULT 'completed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS transaction_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id TEXT NOT NULL,
                product_id TEXT DEFAULT '',
                name TEXT NOT NULL,
                qty INTEGER DEFAULT 1,
                costPrice INTEGER DEFAULT 0,
                sellPrice INTEGER DEFAULT 0,
                subtotal INTEGER DEFAULT 0,
                FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
            );
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS expenses (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT,
                amount INTEGER DEFAULT 0,
                recordedBy TEXT DEFAULT 'Admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS stock_history (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                productId TEXT NOT NULL,
                productName TEXT NOT NULL,
                type TEXT NOT NULL,
                qty INTEGER DEFAULT 0,
                reason TEXT,
                user TEXT DEFAULT 'Admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS discounts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                code TEXT DEFAULT '',
                type TEXT NOT NULL DEFAULT 'percentage',
                value INTEGER NOT NULL DEFAULT 0,
                minPurchase INTEGER DEFAULT 0,
                maxDiscount INTEGER DEFAULT 0,
                isActive INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)
            conn.commit()
        finally:
            conn.close()

    def _seed_if_empty_mysql(self):
        conn = self._get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) as count FROM settings")
                if cur.fetchone()["count"] == 0:
                    for k, v in DEFAULT_SETTINGS.items():
                        cur.execute("INSERT INTO settings (setting_key, setting_val) VALUES (%s, %s)", (k, json.dumps(v)))

                cur.execute("SELECT COUNT(*) as count FROM categories")
                if cur.fetchone()["count"] == 0:
                    for cat in DEFAULT_CATEGORIES:
                        cur.execute("INSERT INTO categories (id, name, icon) VALUES (%s, %s, %s)", (cat["id"], cat["name"], cat["icon"]))
        finally:
            conn.close()

    def _seed_if_empty_sqlite(self):
        conn = self._get_sqlite_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) as count FROM settings")
            if cur.fetchone()[0] == 0:
                for k, v in DEFAULT_SETTINGS.items():
                    cur.execute("INSERT INTO settings (setting_key, setting_val) VALUES (?, ?)", (k, json.dumps(v)))

            cur.execute("SELECT COUNT(*) as count FROM categories")
            if cur.fetchone()[0] == 0:
                for cat in DEFAULT_CATEGORIES:
                    cur.execute("INSERT INTO categories (id, name, icon) VALUES (?, ?, ?)", (cat["id"], cat["name"], cat["icon"]))
            conn.commit()
        finally:
            conn.close()

    # ==================== PUBLIC API METHODS ====================
    def _get_raw_settings(self):
        if self.driver_type == "mysql":
            conn = self._get_mysql_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT setting_key, setting_val FROM settings")
                    rows = cur.fetchall()
            finally:
                conn.close()
        else:
            conn = self._get_sqlite_connection()
            try:
                cur = conn.cursor()
                cur.execute("SELECT setting_key, setting_val FROM settings")
                rows = [dict(r) for r in cur.fetchall()]
            finally:
                conn.close()

        settings_map = {}
        for row in rows:
            try:
                settings_map[row["setting_key"]] = json.loads(row["setting_val"])
            except Exception:
                settings_map[row["setting_key"]] = row["setting_val"]
        return settings_map

    def verify_credentials(self, role, secret):
        with self.lock:
            settings_map = self._get_raw_settings()
            secret_str = str(secret or "").strip()
            if role == "admin":
                expected = str(settings_map.get("adminPassword", "admin"))
                if expected in ("admin", "admin123"):
                    return hmac.compare_digest(secret_str, "admin") or hmac.compare_digest(secret_str, "admin123")
                return hmac.compare_digest(secret_str, expected)
            elif role == "cashier":
                expected_pin = str(settings_map.get("cashierPin", "1234"))
                expected_admin = str(settings_map.get("adminPassword", "admin"))
                if expected_admin in ("admin", "admin123"):
                    is_admin_match = hmac.compare_digest(secret_str, "admin") or hmac.compare_digest(secret_str, "admin123")
                else:
                    is_admin_match = hmac.compare_digest(secret_str, expected_admin)
                return hmac.compare_digest(secret_str, expected_pin) or is_admin_match
            return False

    def get_all(self, include_secrets=False):
        with self.lock:
            if self.driver_type == "mysql":
                result = self._get_all_mysql()
            else:
                result = self._get_all_sqlite()

            if not include_secrets and "settings" in result:
                result["settings"] = dict(result["settings"])
                result["settings"].pop("adminPassword", None)
                result["settings"].pop("cashierPin", None)
                result["settings"]["hasAuth"] = True
            return result

    def _get_all_mysql(self):
        conn = self._get_mysql_connection()
        try:
            with conn.cursor() as cur:
                # Settings
                cur.execute("SELECT setting_key, setting_val FROM settings")
                settings_map = {}
                for row in cur.fetchall():
                    try:
                        settings_map[row["setting_key"]] = json.loads(row["setting_val"])
                    except Exception:
                        settings_map[row["setting_key"]] = row["setting_val"]

                # Categories
                cur.execute("SELECT id, name, icon FROM categories")
                categories = cur.fetchall()

                # Products
                cur.execute("SELECT id, name, barcode, category, CAST(costPrice AS SIGNED) as costPrice, CAST(sellPrice AS SIGNED) as sellPrice, stock, minStock, unit, image FROM products ORDER BY id ASC")
                products = cur.fetchall()
                for p in products:
                    p["costPrice"] = to_rupiah(p.get("costPrice", 0))
                    p["sellPrice"] = to_rupiah(p.get("sellPrice", 0))

                # Transactions
                cur.execute("SELECT id, date, cashier, customerName, CAST(subtotal AS SIGNED) as subtotal, CAST(discount AS SIGNED) as discount, CAST(tax AS SIGNED) as tax, CAST(total AS SIGNED) as total, CAST(totalCost AS SIGNED) as totalCost, CAST(profit AS SIGNED) as profit, paymentMethod, CAST(amountPaid AS SIGNED) as amountPaid, CAST(changeAmount AS SIGNED) as `change`, status FROM transactions ORDER BY date DESC LIMIT 1000")
                transactions = cur.fetchall()

                # Transaction items
                cur.execute("SELECT transaction_id, product_id as id, name, qty, CAST(costPrice AS SIGNED) as costPrice, CAST(sellPrice AS SIGNED) as sellPrice, CAST(subtotal AS SIGNED) as subtotal FROM transaction_items")
                items = cur.fetchall()
                items_by_trx = {}
                for item in items:
                    t_id = item["transaction_id"]
                    if t_id not in items_by_trx:
                        items_by_trx[t_id] = []
                    item_clean = {k: v for k, v in item.items() if k != "transaction_id"}
                    item_clean["costPrice"] = to_rupiah(item_clean.get("costPrice", 0))
                    item_clean["sellPrice"] = to_rupiah(item_clean.get("sellPrice", 0))
                    item_clean["subtotal"] = to_rupiah(item_clean.get("subtotal", 0))
                    items_by_trx[t_id].append(item_clean)

                for trx in transactions:
                    trx["subtotal"] = to_rupiah(trx.get("subtotal", 0))
                    trx["discount"] = to_rupiah(trx.get("discount", 0))
                    trx["tax"] = to_rupiah(trx.get("tax", 0))
                    trx["total"] = to_rupiah(trx.get("total", 0))
                    trx["totalCost"] = to_rupiah(trx.get("totalCost", 0))
                    trx["profit"] = to_rupiah(trx.get("profit", 0))
                    trx["amountPaid"] = to_rupiah(trx.get("amountPaid", 0))
                    trx["change"] = to_rupiah(trx.get("change", 0))
                    trx["items"] = items_by_trx.get(trx["id"], [])

                # Expenses
                cur.execute("SELECT id, date, category, description, CAST(amount AS SIGNED) as amount, recordedBy FROM expenses ORDER BY date DESC LIMIT 500")
                expenses = cur.fetchall()
                for e in expenses:
                    e["amount"] = to_rupiah(e.get("amount", 0))

                # Stock History
                cur.execute("SELECT id, date, productId, productName, type, qty, reason, user FROM stock_history ORDER BY date DESC LIMIT 500")
                stock_history = cur.fetchall()

                # Discounts
                try:
                    cur.execute("SELECT id, name, code, type, CAST(value AS SIGNED) as value, CAST(minPurchase AS SIGNED) as minPurchase, CAST(maxDiscount AS SIGNED) as maxDiscount, isActive FROM discounts ORDER BY created_at DESC")
                    discounts = cur.fetchall()
                    for d in discounts:
                        d["value"] = to_rupiah(d.get("value", 0))
                        d["minPurchase"] = to_rupiah(d.get("minPurchase", 0))
                        d["maxDiscount"] = to_rupiah(d.get("maxDiscount", 0))
                        d["isActive"] = bool(d["isActive"])
                except Exception:
                    discounts = []

                return {
                    "settings": settings_map,
                    "categories": categories,
                    "products": products,
                    "discounts": discounts,
                    "transactions": transactions,
                    "expenses": expenses,
                    "stockHistory": stock_history
                }
        finally:
            conn.close()

    def _get_all_sqlite(self):
        conn = self._get_sqlite_connection()
        try:
            cur = conn.cursor()
            # Settings
            cur.execute("SELECT setting_key, setting_val FROM settings")
            settings_map = {}
            for row in cur.fetchall():
                try:
                    settings_map[row["setting_key"]] = json.loads(row["setting_val"])
                except Exception:
                    settings_map[row["setting_key"]] = row["setting_val"]

            # Categories
            cur.execute("SELECT id, name, icon FROM categories")
            categories = [dict(r) for r in cur.fetchall()]

            # Products
            cur.execute("SELECT id, name, barcode, category, costPrice, sellPrice, stock, minStock, unit, image FROM products ORDER BY id ASC")
            products = [dict(r) for r in cur.fetchall()]
            for p in products:
                p["costPrice"] = to_rupiah(p.get("costPrice", 0))
                p["sellPrice"] = to_rupiah(p.get("sellPrice", 0))

            # Transactions
            cur.execute("SELECT id, date, cashier, customerName, subtotal, discount, tax, total, totalCost, profit, paymentMethod, amountPaid, changeAmount as `change`, status FROM transactions ORDER BY date DESC LIMIT 1000")
            transactions = [dict(r) for r in cur.fetchall()]

            # Transaction items
            cur.execute("SELECT transaction_id, product_id as id, name, qty, costPrice, sellPrice, subtotal FROM transaction_items")
            items = [dict(r) for r in cur.fetchall()]
            items_by_trx = {}
            for item in items:
                t_id = item["transaction_id"]
                if t_id not in items_by_trx:
                    items_by_trx[t_id] = []
                item_clean = {k: v for k, v in item.items() if k != "transaction_id"}
                item_clean["costPrice"] = to_rupiah(item_clean.get("costPrice", 0))
                item_clean["sellPrice"] = to_rupiah(item_clean.get("sellPrice", 0))
                item_clean["subtotal"] = to_rupiah(item_clean.get("subtotal", 0))
                items_by_trx[t_id].append(item_clean)

            for trx in transactions:
                trx["subtotal"] = to_rupiah(trx.get("subtotal", 0))
                trx["discount"] = to_rupiah(trx.get("discount", 0))
                trx["tax"] = to_rupiah(trx.get("tax", 0))
                trx["total"] = to_rupiah(trx.get("total", 0))
                trx["totalCost"] = to_rupiah(trx.get("totalCost", 0))
                trx["profit"] = to_rupiah(trx.get("profit", 0))
                trx["amountPaid"] = to_rupiah(trx.get("amountPaid", 0))
                trx["change"] = to_rupiah(trx.get("change", 0))
                trx["items"] = items_by_trx.get(trx["id"], [])

            # Expenses
            cur.execute("SELECT id, date, category, description, amount, recordedBy FROM expenses ORDER BY date DESC LIMIT 500")
            expenses = [dict(r) for r in cur.fetchall()]
            for e in expenses:
                e["amount"] = to_rupiah(e.get("amount", 0))

            # Stock History
            cur.execute("SELECT id, date, productId, productName, type, qty, reason, user FROM stock_history ORDER BY date DESC LIMIT 500")
            stock_history = [dict(r) for r in cur.fetchall()]

            # Discounts
            try:
                cur.execute("SELECT id, name, code, type, value, minPurchase, maxDiscount, isActive FROM discounts ORDER BY created_at DESC")
                discounts = [dict(r) for r in cur.fetchall()]
                for d in discounts:
                    d["value"] = to_rupiah(d.get("value", 0))
                    d["minPurchase"] = to_rupiah(d.get("minPurchase", 0))
                    d["maxDiscount"] = to_rupiah(d.get("maxDiscount", 0))
                    d["isActive"] = bool(d["isActive"])
            except Exception:
                discounts = []

            return {
                "settings": settings_map,
                "categories": categories,
                "products": products,
                "discounts": discounts,
                "transactions": transactions,
                "expenses": expenses,
                "stockHistory": stock_history
            }
        finally:
            conn.close()

    def _calculate_discount_amount(self, subtotal, trx, disc_row):
        if disc_row:
            is_active = bool(disc_row.get("isActive", 1))
            min_purchase = to_rupiah(disc_row.get("minPurchase", 0))
            if is_active and subtotal >= min_purchase:
                disc_type = disc_row.get("type", "percentage")
                val = float(disc_row.get("value", 0))
                max_disc = to_rupiah(disc_row.get("maxDiscount", 0))
                if disc_type == "percentage":
                    calc = to_rupiah(subtotal * (val / 100.0))
                    if max_disc > 0:
                        calc = min(calc, max_disc)
                else:
                    calc = to_rupiah(val)
                return min(max(0, calc), subtotal)
            return 0
        # Manual nominal discount fallback (clamped to [0, subtotal])
        manual_disc = to_rupiah(trx.get("discount", 0))
        return min(max(0, manual_disc), subtotal)

    def process_checkout(self, trx):
        with self.lock:
            trx_id = (trx.get("id") or "").strip() or f"TRX-{int(time.time()*1000)}"
            trx["id"] = trx_id
            trx_date = trx.get("date") or time.strftime("%Y-%m-%dT%H:%M:%SZ")
            cashier = trx.get("cashier", "Kasir 1")
            customer_name = trx.get("customerName", "Umum")
            payment_method = trx.get("paymentMethod", "cash")
            raw_items = trx.get("items", [])

            if not raw_items or not isinstance(raw_items, list):
                raise ValueError("Keranjang transaksi kosong.")

            disc_info = trx.get("discountInfo") or {}
            disc_id = disc_info.get("id") if isinstance(disc_info, dict) else None
            disc_code = (disc_info.get("code") or "").strip().upper() if isinstance(disc_info, dict) else ""

            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        # 1. Idempotency Check: prevent double stock deduction on duplicate request
                        cur.execute("SELECT id FROM transactions WHERE id = %s", (trx_id,))
                        if cur.fetchone():
                            return self.get_all()

                        # 2. Server-side item validation & price calculation
                        validated_items = []
                        subtotal = 0
                        total_cost = 0
                        for item in raw_items:
                            prod_id = item.get("id", "")
                            qty = int(item.get("qty", 0))
                            if qty <= 0:
                                raise ValueError(f"Jumlah item tidak valid untuk produk {prod_id}.")
                            cur.execute("SELECT id, name, costPrice, sellPrice, stock, unit FROM products WHERE id = %s FOR UPDATE", (prod_id,))
                            prod = cur.fetchone()
                            if not prod:
                                raise ValueError(f"Produk dengan ID '{prod_id}' tidak ditemukan di database.")
                            avail_stock = int(prod.get("stock", 0))
                            if avail_stock < qty:
                                raise ValueError(f"Stok '{prod['name']}' tidak mencukupi (tersedia: {avail_stock}, diminta: {qty}).")

                            cost_p = to_rupiah(prod.get("costPrice", 0))
                            sell_p = to_rupiah(prod.get("sellPrice", 0))
                            sub_p = sell_p * qty
                            subtotal += sub_p
                            total_cost += cost_p * qty
                            validated_items.append({
                                "id": prod["id"],
                                "name": prod["name"],
                                "qty": qty,
                                "costPrice": cost_p,
                                "sellPrice": sell_p,
                                "subtotal": sub_p,
                                "unit": prod.get("unit", "pcs")
                            })

                        # 3. Server-side discount lookup
                        disc_row = None
                        if disc_id:
                            cur.execute("SELECT * FROM discounts WHERE id = %s", (disc_id,))
                            disc_row = cur.fetchone()
                        elif disc_code:
                            cur.execute("SELECT * FROM discounts WHERE UPPER(code) = %s", (disc_code,))
                            disc_row = cur.fetchone()
                        discount = self._calculate_discount_amount(subtotal, trx, disc_row)

                        # 4. Server-side tax & total calculation
                        cur.execute("SELECT setting_val FROM settings WHERE setting_key = 'taxRate'")
                        tax_row = cur.fetchone()
                        try:
                            tax_rate = float(json.loads(tax_row["setting_val"])) if tax_row else 0.0
                        except Exception:
                            tax_rate = float(tax_row["setting_val"]) if tax_row else 0.0

                        after_discount = max(0, subtotal - discount)
                        tax = to_rupiah(after_discount * (max(0.0, tax_rate) / 100.0))
                        total = after_discount + tax
                        profit = after_discount - total_cost

                        if payment_method == "cash":
                            amount_paid = to_rupiah(trx.get("amountPaid", total))
                            if amount_paid < total:
                                raise ValueError(f"Nominal bayar tunai (Rp {amount_paid:,}) kurang dari total tagihan (Rp {total:,}).")
                            change_amount = amount_paid - total
                        else:
                            amount_paid = total
                            change_amount = 0

                        status = "completed"

                        cur.execute("""
                        INSERT INTO transactions (id, date, cashier, customerName, subtotal, discount, tax, total, totalCost, profit, paymentMethod, amountPaid, changeAmount, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (trx_id, trx_date, cashier, customer_name, subtotal, discount, tax, total, total_cost, profit, payment_method, amount_paid, change_amount, status))

                        for idx, v_item in enumerate(validated_items):
                            cur.execute("""
                            INSERT INTO transaction_items (transaction_id, product_id, name, qty, costPrice, sellPrice, subtotal)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            """, (trx_id, v_item["id"], v_item["name"], v_item["qty"], v_item["costPrice"], v_item["sellPrice"], v_item["subtotal"]))

                            cur.execute("UPDATE products SET stock = GREATEST(0, stock - %s) WHERE id = %s", (v_item["qty"], v_item["id"]))

                            stk_id = f"STK-{int(time.time()*1000)}-{idx}"
                            cur.execute("""
                            INSERT INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                            VALUES (%s, %s, %s, %s, 'out', %s, %s, %s)
                            ON DUPLICATE KEY UPDATE qty=VALUES(qty)
                            """, (stk_id, trx_date, v_item["id"], v_item["name"], v_item["qty"], f"Penjualan #{trx_id}", cashier))

                        trx.update({
                            "date": trx_date,
                            "subtotal": subtotal,
                            "discount": discount,
                            "tax": tax,
                            "total": total,
                            "totalCost": total_cost,
                            "profit": profit,
                            "amountPaid": amount_paid,
                            "change": change_amount,
                            "status": status,
                            "items": validated_items
                        })
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    # 1. Idempotency Check: prevent double stock deduction on duplicate request
                    cur.execute("SELECT id FROM transactions WHERE id = ?", (trx_id,))
                    if cur.fetchone():
                        return self.get_all()

                    # 2. Server-side item validation & price calculation
                    validated_items = []
                    subtotal = 0
                    total_cost = 0
                    for item in raw_items:
                        prod_id = item.get("id", "")
                        qty = int(item.get("qty", 0))
                        if qty <= 0:
                            raise ValueError(f"Jumlah item tidak valid untuk produk {prod_id}.")
                        cur.execute("SELECT id, name, costPrice, sellPrice, stock, unit FROM products WHERE id = ?", (prod_id,))
                        row = cur.fetchone()
                        if not row:
                            raise ValueError(f"Produk dengan ID '{prod_id}' tidak ditemukan di database.")
                        prod = dict(row)
                        avail_stock = int(prod.get("stock", 0))
                        if avail_stock < qty:
                            raise ValueError(f"Stok '{prod['name']}' tidak mencukupi (tersedia: {avail_stock}, diminta: {qty}).")

                        cost_p = to_rupiah(prod.get("costPrice", 0))
                        sell_p = to_rupiah(prod.get("sellPrice", 0))
                        sub_p = sell_p * qty
                        subtotal += sub_p
                        total_cost += cost_p * qty
                        validated_items.append({
                            "id": prod["id"],
                            "name": prod["name"],
                            "qty": qty,
                            "costPrice": cost_p,
                            "sellPrice": sell_p,
                            "subtotal": sub_p,
                            "unit": prod.get("unit", "pcs")
                        })

                    # 3. Server-side discount lookup
                    disc_row = None
                    if disc_id:
                        cur.execute("SELECT * FROM discounts WHERE id = ?", (disc_id,))
                        r = cur.fetchone()
                        disc_row = dict(r) if r else None
                    elif disc_code:
                        cur.execute("SELECT * FROM discounts WHERE UPPER(code) = ?", (disc_code,))
                        r = cur.fetchone()
                        disc_row = dict(r) if r else None
                    discount = self._calculate_discount_amount(subtotal, trx, disc_row)

                    # 4. Server-side tax & total calculation
                    cur.execute("SELECT setting_val FROM settings WHERE setting_key = 'taxRate'")
                    tax_row = cur.fetchone()
                    try:
                        tax_rate = float(json.loads(tax_row["setting_val"])) if tax_row else 0.0
                    except Exception:
                        tax_rate = float(tax_row["setting_val"]) if tax_row else 0.0

                    after_discount = max(0, subtotal - discount)
                    tax = to_rupiah(after_discount * (max(0.0, tax_rate) / 100.0))
                    total = after_discount + tax
                    profit = after_discount - total_cost

                    if payment_method == "cash":
                        amount_paid = to_rupiah(trx.get("amountPaid", total))
                        if amount_paid < total:
                            raise ValueError(f"Nominal bayar tunai (Rp {amount_paid:,}) kurang dari total tagihan (Rp {total:,}).")
                        change_amount = amount_paid - total
                    else:
                        amount_paid = total
                        change_amount = 0

                    status = "completed"

                    cur.execute("""
                    INSERT INTO transactions (id, date, cashier, customerName, subtotal, discount, tax, total, totalCost, profit, paymentMethod, amountPaid, changeAmount, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (trx_id, trx_date, cashier, customer_name, subtotal, discount, tax, total, total_cost, profit, payment_method, amount_paid, change_amount, status))

                    for idx, v_item in enumerate(validated_items):
                        cur.execute("""
                        INSERT INTO transaction_items (transaction_id, product_id, name, qty, costPrice, sellPrice, subtotal)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, (trx_id, v_item["id"], v_item["name"], v_item["qty"], v_item["costPrice"], v_item["sellPrice"], v_item["subtotal"]))

                        cur.execute("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?", (v_item["qty"], v_item["id"]))

                        stk_id = f"STK-{int(time.time()*1000)}-{idx}"
                        cur.execute("""
                        INSERT OR REPLACE INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                        VALUES (?, ?, ?, ?, 'out', ?, ?, ?)
                        """, (stk_id, trx_date, v_item["id"], v_item["name"], v_item["qty"], f"Penjualan #{trx_id}", cashier))

                    conn.commit()
                    trx.update({
                        "date": trx_date,
                        "subtotal": subtotal,
                        "discount": discount,
                        "tax": tax,
                        "total": total,
                        "totalCost": total_cost,
                        "profit": profit,
                        "amountPaid": amount_paid,
                        "change": change_amount,
                        "status": status,
                        "items": validated_items
                    })
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()

            return self.get_all()

    def void_transaction(self, trx_id, reason="Dibatalkan oleh Admin", user="Admin"):
        with self.lock:
            date_str = time.strftime("%Y-%m-%dT%H:%M:%SZ")
            clean_reason = (reason or "Dibatalkan oleh Admin").strip()
            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("SELECT id, status FROM transactions WHERE id = %s FOR UPDATE", (trx_id,))
                        trx_row = cur.fetchone()
                        if not trx_row or trx_row.get("status") == "void":
                            return self.get_all()

                        cur.execute("SELECT product_id, name, qty FROM transaction_items WHERE transaction_id = %s", (trx_id,))
                        items = cur.fetchall()
                        for idx, item in enumerate(items):
                            prod_id = item.get("product_id", "")
                            qty = int(item.get("qty", 0))
                            item_name = item.get("name", "")
                            if prod_id and qty > 0:
                                cur.execute("UPDATE products SET stock = stock + %s WHERE id = %s", (qty, prod_id))
                                stk_id = f"STK-{int(time.time()*1000)}-VOID-{idx}"
                                cur.execute("""
                                INSERT INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                                VALUES (%s, %s, %s, %s, 'in', %s, %s, %s)
                                ON DUPLICATE KEY UPDATE qty=VALUES(qty)
                                """, (stk_id, date_str, prod_id, item_name, qty, f"Void Nota #{trx_id}: {clean_reason}", user))
                        cur.execute("UPDATE transactions SET status = 'void' WHERE id = %s", (trx_id,))
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("SELECT id, status FROM transactions WHERE id = ?", (trx_id,))
                    trx_row = cur.fetchone()
                    if not trx_row or trx_row["status"] == "void":
                        return self.get_all()

                    cur.execute("SELECT product_id, name, qty FROM transaction_items WHERE transaction_id = ?", (trx_id,))
                    items = [dict(r) for r in cur.fetchall()]
                    for idx, item in enumerate(items):
                        prod_id = item.get("product_id", "")
                        qty = int(item.get("qty", 0))
                        item_name = item.get("name", "")
                        if prod_id and qty > 0:
                            cur.execute("UPDATE products SET stock = stock + ? WHERE id = ?", (qty, prod_id))
                            stk_id = f"STK-{int(time.time()*1000)}-VOID-{idx}"
                            cur.execute("""
                            INSERT OR REPLACE INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                            VALUES (?, ?, ?, ?, 'in', ?, ?, ?)
                            """, (stk_id, date_str, prod_id, item_name, qty, f"Void Nota #{trx_id}: {clean_reason}", user))
                    cur.execute("UPDATE transactions SET status = 'void' WHERE id = ?", (trx_id,))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()
            return self.get_all()

    def delete_transaction(self, trx_id, reason="Dibatalkan oleh Admin", user="Admin"):
        return self.void_transaction(trx_id, reason=reason, user=user)

    def save_product(self, product):
        with self.lock:
            prod_id = product.get("id")
            if not prod_id:
                prod_id = f"P{str(int(time.time()*1000))[-6:]}"
                product["id"] = prod_id

            name = product.get("name", "")
            barcode = product.get("barcode", "")
            category = product.get("category", "sembako")
            cost_price = to_rupiah(product.get("costPrice", 0))
            sell_price = to_rupiah(product.get("sellPrice", 0))
            stock = int(product.get("stock", 0))
            min_stock = int(product.get("minStock", 5))
            unit = product.get("unit", "pcs")
            image = product.get("image", "")

            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("""
                        INSERT INTO products (id, name, barcode, category, costPrice, sellPrice, stock, minStock, unit, image)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE
                            name=VALUES(name), barcode=VALUES(barcode), category=VALUES(category),
                            costPrice=VALUES(costPrice), sellPrice=VALUES(sellPrice), stock=VALUES(stock),
                            minStock=VALUES(minStock), unit=VALUES(unit), image=VALUES(image)
                        """, (prod_id, name, barcode, category, cost_price, sell_price, stock, min_stock, unit, image))
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("""
                    INSERT OR REPLACE INTO products (id, name, barcode, category, costPrice, sellPrice, stock, minStock, unit, image)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (prod_id, name, barcode, category, cost_price, sell_price, stock, min_stock, unit, image))
                    conn.commit()
                finally:
                    conn.close()

            return self.get_all()

    def delete_product(self, prod_id):
        with self.lock:
            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("DELETE FROM products WHERE id = %s", (prod_id,))
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("DELETE FROM products WHERE id = ?", (prod_id,))
                    conn.commit()
                finally:
                    conn.close()
            return self.get_all()

    def adjust_stock(self, payload):
        with self.lock:
            prod_id = payload.get("productId")
            qty = abs(int(payload.get("qty", 0)))
            mutation_type = payload.get("type", "in")
            reason = payload.get("reason", "")
            record_expense = payload.get("recordExpense", False)
            user = payload.get("user", "Admin")
            date_str = time.strftime("%Y-%m-%dT%H:%M:%SZ")

            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("SELECT name, costPrice, unit FROM products WHERE id = %s", (prod_id,))
                        prod = cur.fetchone()
                        if prod:
                            if mutation_type == "in":
                                cur.execute("UPDATE products SET stock = stock + %s WHERE id = %s", (qty, prod_id))
                            else:
                                cur.execute("UPDATE products SET stock = GREATEST(0, stock - %s) WHERE id = %s", (qty, prod_id))

                            stk_id = f"STK-{int(time.time()*1000)}"
                            cur.execute("""
                            INSERT INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """, (stk_id, date_str, prod_id, prod["name"], mutation_type, qty, reason or ("Restock Masuk" if mutation_type == "in" else "Penyesuaian"), user))

                            if mutation_type == "in" and record_expense:
                                exp_id = f"EXP-{str(int(time.time()*1000))[-6:]}"
                                cost = to_rupiah(prod.get("costPrice", 0)) * qty
                                cur.execute("""
                                INSERT INTO expenses (id, date, category, description, amount, recordedBy)
                                VALUES (%s, %s, 'Stok Barang', %s, %s, %s)
                                """, (exp_id, date_str, f"Restock {qty} {prod.get('unit','pcs')} {prod['name']}", cost, user))
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("SELECT name, costPrice, unit FROM products WHERE id = ?", (prod_id,))
                    row = cur.fetchone()
                    if row:
                        prod_name = row["name"]
                        cost_p = to_rupiah(row["costPrice"])
                        unit = row["unit"]

                        if mutation_type == "in":
                            cur.execute("UPDATE products SET stock = stock + ? WHERE id = ?", (qty, prod_id))
                        else:
                            cur.execute("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?", (qty, prod_id))

                        stk_id = f"STK-{int(time.time()*1000)}"
                        cur.execute("""
                        INSERT INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (stk_id, date_str, prod_id, prod_name, mutation_type, qty, reason or ("Restock Masuk" if mutation_type == "in" else "Penyesuaian"), user))

                        if mutation_type == "in" and record_expense:
                            exp_id = f"EXP-{str(int(time.time()*1000))[-6:]}"
                            cost = cost_p * qty
                            cur.execute("""
                            INSERT INTO expenses (id, date, category, description, amount, recordedBy)
                            VALUES (?, ?, 'Stok Barang', ?, ?, ?)
                            """, (exp_id, date_str, f"Restock {qty} {unit} {prod_name}", cost, user))
                    conn.commit()
                finally:
                    conn.close()

            return self.get_all()

    def add_expense(self, expense):
        with self.lock:
            exp_id = expense.get("id") or f"EXP-{str(int(time.time()*1000))[-6:]}"
            exp_date = expense.get("date") or time.strftime("%Y-%m-%dT%H:%M:%SZ")
            cat = expense.get("category", "Operasional")
            desc = expense.get("description", "")
            amount = to_rupiah(expense.get("amount", 0))
            user = expense.get("recordedBy", "Admin")

            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("""
                        INSERT INTO expenses (id, date, category, description, amount, recordedBy)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """, (exp_id, exp_date, cat, desc, amount, user))
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("""
                    INSERT INTO expenses (id, date, category, description, amount, recordedBy)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, (exp_id, exp_date, cat, desc, amount, user))
                    conn.commit()
                finally:
                    conn.close()

            return self.get_all()

    def delete_expense(self, exp_id):
        with self.lock:
            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("DELETE FROM expenses WHERE id = %s", (exp_id,))
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("DELETE FROM expenses WHERE id = ?", (exp_id,))
                    conn.commit()
                finally:
                    conn.close()
            return self.get_all()

    def update_settings(self, new_settings):
        with self.lock:
            filtered_settings = {}
            for k, v in (new_settings or {}).items():
                if k == "hasAuth":
                    continue
                if k in ("adminPassword", "cashierPin") and (v is None or str(v).strip() == ""):
                    continue
                filtered_settings[k] = v

            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        for k, v in filtered_settings.items():
                            cur.execute("""
                            INSERT INTO settings (setting_key, setting_val)
                            VALUES (%s, %s)
                            ON DUPLICATE KEY UPDATE setting_val = VALUES(setting_val)
                            """, (k, json.dumps(v)))
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    for k, v in filtered_settings.items():
                        cur.execute("""
                        INSERT OR REPLACE INTO settings (setting_key, setting_val)
                        VALUES (?, ?)
                        """, (k, json.dumps(v)))
                    conn.commit()
                finally:
                    conn.close()
            return self.get_all()

    def save_discount(self, discount_data):
        with self.lock:
            disc_id = discount_data.get("id")
            if not disc_id:
                disc_id = f"DSC-{str(int(time.time()*1000))[-6:]}"
                discount_data["id"] = disc_id

            name = discount_data.get("name", "")
            code = (discount_data.get("code") or "").strip().upper()
            disc_type = discount_data.get("type", "percentage")
            value = to_rupiah(discount_data.get("value", 0))
            min_purchase = to_rupiah(discount_data.get("minPurchase", 0))
            max_discount = to_rupiah(discount_data.get("maxDiscount", 0))
            is_active = 1 if discount_data.get("isActive", True) else 0

            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("""
                        INSERT INTO discounts (id, name, code, type, value, minPurchase, maxDiscount, isActive)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE
                            name=VALUES(name), code=VALUES(code), type=VALUES(type),
                            value=VALUES(value), minPurchase=VALUES(minPurchase),
                            maxDiscount=VALUES(maxDiscount), isActive=VALUES(isActive)
                        """, (disc_id, name, code, disc_type, value, min_purchase, max_discount, is_active))
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("""
                    INSERT OR REPLACE INTO discounts (id, name, code, type, value, minPurchase, maxDiscount, isActive)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (disc_id, name, code, disc_type, value, min_purchase, max_discount, is_active))
                    conn.commit()
                finally:
                    conn.close()

            return self.get_all()

    def delete_discount(self, disc_id):
        with self.lock:
            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("DELETE FROM discounts WHERE id = %s", (disc_id,))
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("DELETE FROM discounts WHERE id = ?", (disc_id,))
                    conn.commit()
                finally:
                    conn.close()
            return self.get_all()

    def toggle_discount(self, disc_id):
        with self.lock:
            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("UPDATE discounts SET isActive = CASE WHEN isActive = 1 THEN 0 ELSE 1 END WHERE id = %s", (disc_id,))
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("UPDATE discounts SET isActive = CASE WHEN isActive = 1 THEN 0 ELSE 1 END WHERE id = ?", (disc_id,))
                    conn.commit()
                finally:
                    conn.close()
            return self.get_all()

    def import_database(self, data):
        with self.lock:
            settings_data = data.get("settings") or {}
            categories_data = data.get("categories") or DEFAULT_CATEGORIES
            products_data = data.get("products") or []
            discounts_data = data.get("discounts") or []
            transactions_data = data.get("transactions") or []
            expenses_data = data.get("expenses") or []
            stock_history_data = data.get("stockHistory") or []

            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("TRUNCATE TABLE transaction_items")
                        cur.execute("DELETE FROM transactions")
                        cur.execute("DELETE FROM expenses")
                        cur.execute("DELETE FROM stock_history")
                        cur.execute("DELETE FROM discounts")
                        cur.execute("DELETE FROM products")
                        cur.execute("DELETE FROM categories")
                        cur.execute("DELETE FROM settings")

                        merged_settings = {**DEFAULT_SETTINGS, **settings_data}
                        for k, v in merged_settings.items():
                            cur.execute("INSERT INTO settings (setting_key, setting_val) VALUES (%s, %s)", (k, json.dumps(v)))

                        for cat in categories_data:
                            cur.execute("INSERT INTO categories (id, name, icon) VALUES (%s, %s, %s)", (cat.get("id", ""), cat.get("name", ""), cat.get("icon", "package")))

                        for p in products_data:
                            cur.execute("""
                            INSERT INTO products (id, name, barcode, category, costPrice, sellPrice, stock, minStock, unit, image)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """, (p.get("id"), p.get("name", ""), p.get("barcode", ""), p.get("category", "sembako"), p.get("costPrice", 0), p.get("sellPrice", 0), p.get("stock", 0), p.get("minStock", 5), p.get("unit", "pcs"), p.get("image", "")))

                        for d in discounts_data:
                            cur.execute("""
                            INSERT INTO discounts (id, name, code, type, value, minPurchase, maxDiscount, isActive)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """, (d.get("id"), d.get("name", ""), d.get("code", ""), d.get("type", "percentage"), d.get("value", 0), d.get("minPurchase", 0), d.get("maxDiscount", 0), 1 if d.get("isActive", True) else 0))

                        for t in transactions_data:
                            t_id = t.get("id")
                            cur.execute("""
                            INSERT INTO transactions (id, date, cashier, customerName, subtotal, discount, tax, total, totalCost, profit, paymentMethod, amountPaid, changeAmount, status)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """, (t_id, t.get("date", ""), t.get("cashier", "Kasir 1"), t.get("customerName", "Umum"), t.get("subtotal", 0), t.get("discount", 0), t.get("tax", 0), t.get("total", 0), t.get("totalCost", 0), t.get("profit", 0), t.get("paymentMethod", "cash"), t.get("amountPaid", 0), t.get("change", 0), t.get("status", "completed")))
                            for item in t.get("items", []):
                                cur.execute("""
                                INSERT INTO transaction_items (transaction_id, product_id, name, qty, costPrice, sellPrice, subtotal)
                                VALUES (%s, %s, %s, %s, %s, %s, %s)
                                """, (t_id, item.get("id", ""), item.get("name", ""), item.get("qty", 1), item.get("costPrice", 0), item.get("sellPrice", 0), item.get("subtotal", 0)))

                        for e in expenses_data:
                            cur.execute("""
                            INSERT INTO expenses (id, date, category, description, amount, recordedBy)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            """, (e.get("id"), e.get("date", ""), e.get("category", "Operasional"), e.get("description", ""), e.get("amount", 0), e.get("recordedBy", "Admin")))

                        for s in stock_history_data:
                            cur.execute("""
                            INSERT INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """, (s.get("id"), s.get("date", ""), s.get("productId", ""), s.get("productName", ""), s.get("type", "in"), s.get("qty", 0), s.get("reason", ""), s.get("user", "Admin")))
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("DELETE FROM transaction_items")
                    cur.execute("DELETE FROM transactions")
                    cur.execute("DELETE FROM expenses")
                    cur.execute("DELETE FROM stock_history")
                    cur.execute("DELETE FROM discounts")
                    cur.execute("DELETE FROM products")
                    cur.execute("DELETE FROM categories")
                    cur.execute("DELETE FROM settings")

                    merged_settings = {**DEFAULT_SETTINGS, **settings_data}
                    for k, v in merged_settings.items():
                        cur.execute("INSERT OR REPLACE INTO settings (setting_key, setting_val) VALUES (?, ?)", (k, json.dumps(v)))

                    for cat in categories_data:
                        cur.execute("INSERT OR REPLACE INTO categories (id, name, icon) VALUES (?, ?, ?)", (cat.get("id", ""), cat.get("name", ""), cat.get("icon", "package")))

                    for p in products_data:
                        cur.execute("""
                        INSERT OR REPLACE INTO products (id, name, barcode, category, costPrice, sellPrice, stock, minStock, unit, image)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (p.get("id"), p.get("name", ""), p.get("barcode", ""), p.get("category", "sembako"), p.get("costPrice", 0), p.get("sellPrice", 0), p.get("stock", 0), p.get("minStock", 5), p.get("unit", "pcs"), p.get("image", "")))

                    for d in discounts_data:
                        cur.execute("""
                        INSERT OR REPLACE INTO discounts (id, name, code, type, value, minPurchase, maxDiscount, isActive)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (d.get("id"), d.get("name", ""), d.get("code", ""), d.get("type", "percentage"), d.get("value", 0), d.get("minPurchase", 0), d.get("maxDiscount", 0), 1 if d.get("isActive", True) else 0))

                    for t in transactions_data:
                        t_id = t.get("id")
                        cur.execute("""
                        INSERT OR REPLACE INTO transactions (id, date, cashier, customerName, subtotal, discount, tax, total, totalCost, profit, paymentMethod, amountPaid, changeAmount, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (t_id, t.get("date", ""), t.get("cashier", "Kasir 1"), t.get("customerName", "Umum"), t.get("subtotal", 0), t.get("discount", 0), t.get("tax", 0), t.get("total", 0), t.get("totalCost", 0), t.get("profit", 0), t.get("paymentMethod", "cash"), t.get("amountPaid", 0), t.get("change", 0), t.get("status", "completed")))
                        for item in t.get("items", []):
                            cur.execute("""
                            INSERT INTO transaction_items (transaction_id, product_id, name, qty, costPrice, sellPrice, subtotal)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                            """, (t_id, item.get("id", ""), item.get("name", ""), item.get("qty", 1), item.get("costPrice", 0), item.get("sellPrice", 0), item.get("subtotal", 0)))

                    for e in expenses_data:
                        cur.execute("""
                        INSERT OR REPLACE INTO expenses (id, date, category, description, amount, recordedBy)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """, (e.get("id"), e.get("date", ""), e.get("category", "Operasional"), e.get("description", ""), e.get("amount", 0), e.get("recordedBy", "Admin")))

                    for s in stock_history_data:
                        cur.execute("""
                        INSERT OR REPLACE INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (s.get("id"), s.get("date", ""), s.get("productId", ""), s.get("productName", ""), s.get("type", "in"), s.get("qty", 0), s.get("reason", ""), s.get("user", "Admin")))

                    conn.commit()
                finally:
                    conn.close()

            return self.get_all()

    def reset(self):
        with self.lock:
            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("TRUNCATE TABLE transaction_items")
                        cur.execute("DELETE FROM transactions")
                        cur.execute("DELETE FROM expenses")
                        cur.execute("DELETE FROM stock_history")
                        cur.execute("DELETE FROM discounts")
                        cur.execute("DELETE FROM products")
                        cur.execute("DELETE FROM categories")
                        cur.execute("DELETE FROM settings")
                    self._seed_if_empty_mysql()
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("DELETE FROM transaction_items")
                    cur.execute("DELETE FROM transactions")
                    cur.execute("DELETE FROM expenses")
                    cur.execute("DELETE FROM stock_history")
                    cur.execute("DELETE FROM discounts")
                    cur.execute("DELETE FROM products")
                    cur.execute("DELETE FROM categories")
                    cur.execute("DELETE FROM settings")
                    conn.commit()
                    self._seed_if_empty_sqlite()
                finally:
                    conn.close()
            return self.get_all()
