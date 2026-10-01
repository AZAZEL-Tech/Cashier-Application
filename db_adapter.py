#!/usr/bin/env python3
"""
WarungKu POS - Database Adapter (MySQL / MariaDB & SQLite Engine)
Supports High-Performance Relational SQL with Zero External System Dependencies.
"""

import os
import sys
import json
import time
import sqlite3
import threading

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
                costPrice REAL DEFAULT 0,
                sellPrice REAL DEFAULT 0,
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
                subtotal REAL DEFAULT 0,
                discount REAL DEFAULT 0,
                tax REAL DEFAULT 0,
                total REAL DEFAULT 0,
                totalCost REAL DEFAULT 0,
                profit REAL DEFAULT 0,
                paymentMethod TEXT DEFAULT 'cash',
                amountPaid REAL DEFAULT 0,
                changeAmount REAL DEFAULT 0,
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
                costPrice REAL DEFAULT 0,
                sellPrice REAL DEFAULT 0,
                subtotal REAL DEFAULT 0,
                FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
            );
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS expenses (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT,
                amount REAL DEFAULT 0,
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
                value REAL NOT NULL DEFAULT 0,
                minPurchase REAL DEFAULT 0,
                maxDiscount REAL DEFAULT 0,
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
    def get_all(self):
        with self.lock:
            if self.driver_type == "mysql":
                return self._get_all_mysql()
            return self._get_all_sqlite()

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
                    items_by_trx[t_id].append(item_clean)

                for trx in transactions:
                    trx["items"] = items_by_trx.get(trx["id"], [])

                # Expenses
                cur.execute("SELECT id, date, category, description, CAST(amount AS SIGNED) as amount, recordedBy FROM expenses ORDER BY date DESC LIMIT 500")
                expenses = cur.fetchall()

                # Stock History
                cur.execute("SELECT id, date, productId, productName, type, qty, reason, user FROM stock_history ORDER BY date DESC LIMIT 500")
                stock_history = cur.fetchall()

                # Discounts
                try:
                    cur.execute("SELECT id, name, code, type, CAST(value AS SIGNED) as value, CAST(minPurchase AS SIGNED) as minPurchase, CAST(maxDiscount AS SIGNED) as maxDiscount, isActive FROM discounts ORDER BY created_at DESC")
                    discounts = cur.fetchall()
                    for d in discounts:
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
                items_by_trx[t_id].append(item_clean)

            for trx in transactions:
                trx["items"] = items_by_trx.get(trx["id"], [])

            # Expenses
            cur.execute("SELECT id, date, category, description, amount, recordedBy FROM expenses ORDER BY date DESC LIMIT 500")
            expenses = [dict(r) for r in cur.fetchall()]

            # Stock History
            cur.execute("SELECT id, date, productId, productName, type, qty, reason, user FROM stock_history ORDER BY date DESC LIMIT 500")
            stock_history = [dict(r) for r in cur.fetchall()]

            # Discounts
            try:
                cur.execute("SELECT id, name, code, type, value, minPurchase, maxDiscount, isActive FROM discounts ORDER BY created_at DESC")
                discounts = [dict(r) for r in cur.fetchall()]
                for d in discounts:
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

    def process_checkout(self, trx):
        with self.lock:
            trx_id = trx.get("id")
            trx_date = trx.get("date") or time.strftime("%Y-%m-%dT%H:%M:%SZ")
            cashier = trx.get("cashier", "Kasir 1")
            customer_name = trx.get("customerName", "Umum")
            subtotal = trx.get("subtotal", 0)
            discount = trx.get("discount", 0)
            tax = trx.get("tax", 0)
            total = trx.get("total", 0)
            total_cost = trx.get("totalCost", 0)
            profit = trx.get("profit", 0)
            payment_method = trx.get("paymentMethod", "cash")
            amount_paid = trx.get("amountPaid", total)
            change_amount = trx.get("change", 0)
            status = trx.get("status", "completed")
            items = trx.get("items", [])

            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("""
                        INSERT INTO transactions (id, date, cashier, customerName, subtotal, discount, tax, total, totalCost, profit, paymentMethod, amountPaid, changeAmount, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE status=VALUES(status)
                        """, (trx_id, trx_date, cashier, customer_name, subtotal, discount, tax, total, total_cost, profit, payment_method, amount_paid, change_amount, status))

                        for item in items:
                            prod_id = item.get("id", "")
                            qty = item.get("qty", 1)
                            cost_p = item.get("costPrice", 0)
                            sell_p = item.get("sellPrice", 0)
                            sub_p = item.get("subtotal", sell_p * qty)
                            item_name = item.get("name", "")

                            cur.execute("""
                            INSERT INTO transaction_items (transaction_id, product_id, name, qty, costPrice, sellPrice, subtotal)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            """, (trx_id, prod_id, item_name, qty, cost_p, sell_p, sub_p))

                            # Deduct stock
                            cur.execute("UPDATE products SET stock = GREATEST(0, stock - %s) WHERE id = %s", (qty, prod_id))

                            # Record Stock Mutation
                            stk_id = f"STK-{int(time.time()*1000)}"
                            cur.execute("""
                            INSERT INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                            VALUES (%s, %s, %s, %s, 'out', %s, %s, %s)
                            """, (stk_id, trx_date, prod_id, item_name, qty, f"Penjualan #{trx_id}", cashier))
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("""
                    INSERT OR REPLACE INTO transactions (id, date, cashier, customerName, subtotal, discount, tax, total, totalCost, profit, paymentMethod, amountPaid, changeAmount, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (trx_id, trx_date, cashier, customer_name, subtotal, discount, tax, total, total_cost, profit, payment_method, amount_paid, change_amount, status))

                    for item in items:
                        prod_id = item.get("id", "")
                        qty = item.get("qty", 1)
                        cost_p = item.get("costPrice", 0)
                        sell_p = item.get("sellPrice", 0)
                        sub_p = item.get("subtotal", sell_p * qty)
                        item_name = item.get("name", "")

                        cur.execute("""
                        INSERT INTO transaction_items (transaction_id, product_id, name, qty, costPrice, sellPrice, subtotal)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, (trx_id, prod_id, item_name, qty, cost_p, sell_p, sub_p))

                        # Deduct stock
                        cur.execute("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?", (qty, prod_id))

                        # Record Stock Mutation
                        stk_id = f"STK-{int(time.time()*1000)}"
                        cur.execute("""
                        INSERT INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                        VALUES (?, ?, ?, ?, 'out', ?, ?, ?)
                        """, (stk_id, trx_date, prod_id, item_name, qty, f"Penjualan #{trx_id}", cashier))
                    conn.commit()
                finally:
                    conn.close()

            return self.get_all()

    def save_product(self, product):
        with self.lock:
            prod_id = product.get("id")
            if not prod_id:
                prod_id = f"P{str(int(time.time()*1000))[-6:]}"
                product["id"] = prod_id

            name = product.get("name", "")
            barcode = product.get("barcode", "")
            category = product.get("category", "sembako")
            cost_price = product.get("costPrice", 0)
            sell_price = product.get("sellPrice", 0)
            stock = product.get("stock", 0)
            min_stock = product.get("minStock", 5)
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
                                cost = float(prod.get("costPrice", 0)) * qty
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
                        cost_p = row["costPrice"]
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
            amount = expense.get("amount", 0)
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
            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        for k, v in new_settings.items():
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
                    for k, v in new_settings.items():
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
            value = float(discount_data.get("value", 0))
            min_purchase = float(discount_data.get("minPurchase", 0))
            max_discount = float(discount_data.get("maxDiscount", 0))
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
                    cur.execute("DELETE FROM products")
                    cur.execute("DELETE FROM categories")
                    cur.execute("DELETE FROM settings")
                    conn.commit()
                    self._seed_if_empty_sqlite()
                finally:
                    conn.close()
            return self.get_all()
