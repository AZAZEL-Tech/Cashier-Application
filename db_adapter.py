#!/usr/bin/env python3
"""
WarungKu POS - Database Adapter (MySQL / MariaDB & SQLite Engine)
Supports High-Performance Relational SQL with Atomic Transactions, Row Locking,
Soft-Delete Integrity, Bounded Queries, and Zero External System Dependencies.
"""

import os
import sys
import json
import time
import uuid
import hmac
import sqlite3
import threading
from datetime import datetime, timezone


MONTH_NAMES_ID = [
    "", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
]


def to_local_date_key(iso_or_date_str):
    """Convert ISO-8601 timestamp or YYYY-MM-DD string into local YYYY-MM-DD key."""
    s = str(iso_or_date_str or "").strip()
    if not s:
        return datetime.now().strftime("%Y-%m-%d")
    if len(s) == 10 and s[4] == "-" and s[7] == "-":
        return s
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is not None:
            dt = dt.astimezone()
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return s[:10]


def format_id_date(date_key):
    """Format YYYY-MM-DD into '14 Nov 2026'."""
    s = str(date_key or "").strip()[:10]
    parts = s.split("-")
    if len(parts) == 3:
        try:
            yr, mo, dy = int(parts[0]), int(parts[1]), int(parts[2])
            if 1 <= mo <= 12:
                return f"{dy:02d} {MONTH_NAMES_ID[mo]} {yr}"
        except Exception:
            pass
    return s


def to_rupiah(val):
    """Normalize monetary value to exact integer Rupiah (no floating-point drift)."""
    try:
        return int(round(float(val or 0)))
    except (ValueError, TypeError):
        return 0


def generate_uid(prefix):
    """Generate collision-free unique ID using millisecond timestamp + 6-hex UUID suffix."""
    return f"{prefix}-{int(time.time() * 1000)}-{uuid.uuid4().hex[:6].upper()}"


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
    "soundEnabled": True,
    "storeCloseTime": "22:00",
    "autoCloseEnabled": True
}

DEFAULT_CATEGORIES = [
    {"id": "all", "name": "Semua Produk", "icon": "layout-grid"},
    {"id": "sembako", "name": "Sembako", "icon": "wheat"},
    {"id": "minuman", "name": "Minuman", "icon": "cup-soda"},
    {"id": "makanan", "name": "Makanan & Mie", "icon": "utensils"},
    {"id": "snack", "name": "Snack & Jajanan", "icon": "cookie"},
    {"id": "rokok", "name": "Rokok", "icon": "flame"},
    {"id": "kebersihan", "name": "Sabun & Cuci", "icon": "sparkles"},
    {"id": "lainnya", "name": "Lain-lain", "icon": "package"}
]

DEFAULT_PRODUCTS = []


class DatabaseEngine:
    def __init__(self, base_dir):
        self.base_dir = base_dir
        self.config_path = os.path.join(base_dir, "db_config.json")
        self.data_dir = os.path.join(base_dir, "data")
        os.makedirs(self.data_dir, exist_ok=True)
        self.sqlite_file = os.path.join(self.data_dir, "pos_database.db")
        self.engine_lock_file = os.path.join(self.data_dir, "active_engine.json")
        self.lock = threading.RLock()
        self.driver_type = "sqlite"
        self.strict_driver = False
        self.mysql_config = {}

        self._load_config()
        self._init_database()

    def _load_config(self):
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    self.driver_type = (cfg.get("driver") or "sqlite").strip().lower()
                    self.strict_driver = bool(cfg.get("strict_driver", False))
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
                charset="utf8mb4", cursorclass=pymysql.cursors.DictCursor,
                autocommit=True
            )
            with conn.cursor() as cur:
                cur.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            conn.close()

        # autocommit=False so SELECT ... FOR UPDATE holds InnoDB row locks and multi-statement writes are atomic!
        return pymysql.connect(
            host=host, port=port, user=user, password=password,
            database=db_name, charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=False
        )

    def _get_sqlite_connection(self):
        conn = sqlite3.connect(self.sqlite_file, timeout=15.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _record_active_engine(self, engine_name):
        try:
            with open(self.engine_lock_file, "w", encoding="utf-8") as f:
                json.dump({"active_driver": engine_name, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")}, f)
        except Exception:
            pass

    def _get_last_active_engine(self):
        if os.path.exists(self.engine_lock_file):
            try:
                with open(self.engine_lock_file, "r", encoding="utf-8") as f:
                    return json.load(f).get("active_driver")
            except Exception:
                pass
        return None

    def _init_database(self):
        last_engine = self._get_last_active_engine()

        # Prevent silent split-brain: if SQLite was already used and has transactions, stay on SQLite unless explicitly forced
        if self.driver_type == "mysql" and PYMYSQL_AVAILABLE:
            last_err = None
            # Retry up to 3 times if MySQL service is still starting up on boot
            for attempt in range(1, 4):
                try:
                    print(f"[DB] Connecting to MySQL ({self.mysql_config.get('host')}:{self.mysql_config.get('port')}, db: {self.mysql_config.get('database')}) [Attempt {attempt}/3]...")
                    self._get_mysql_connection(create_db=True).close()
                    self._create_mysql_tables()
                    self._seed_if_empty_mysql()
                    self._record_active_engine("mysql")
                    print("✅ [DB] Database Engine Active: MySQL / MariaDB (Atomic InnoDB Mode)")
                    return
                except Exception as e:
                    last_err = e
                    if attempt < 3:
                        time.sleep(1.0)

            if self.strict_driver or last_engine == "mysql":
                raise RuntimeError(
                    f"[CRITICAL SPLIT-BRAIN PROTECTION] MySQL dikonfigurasi sebagai database utama tetapi gagal dihubungi ({last_err}). "
                    f"Server dihentikan agar data transaksi tidak terbelah ke SQLite. Nyalakan service MySQL atau ubah 'driver' menjadi 'sqlite' di db_config.json."
                )

            print(f"⚠️ [DB] MySQL tidak tersedia ({last_err}). Mengunci engine ke SQLite agar tidak terjadi Split-Brain...")
            self.driver_type = "sqlite"
            try:
                if os.path.exists(self.config_path):
                    with open(self.config_path, "r", encoding="utf-8") as f:
                        cfg = json.load(f)
                    cfg["driver"] = "sqlite"
                    with open(self.config_path, "w", encoding="utf-8") as f:
                        json.dump(cfg, f, indent=2)
            except Exception:
                pass

        self.driver_type = "sqlite"
        self._create_sqlite_tables()
        self._seed_if_empty_sqlite()
        self._record_active_engine("sqlite")
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
                    `is_deleted` TINYINT(1) DEFAULT 0,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX `idx_category` (`category`),
                    INDEX `idx_barcode` (`barcode`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                """)
                try:
                    cur.execute("ALTER TABLE `products` ADD COLUMN `is_deleted` TINYINT(1) DEFAULT 0")
                except Exception:
                    pass
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
                cur.execute("""
                CREATE TABLE IF NOT EXISTS `financial_reports` (
                    `id` VARCHAR(64) NOT NULL PRIMARY KEY,
                    `report_type` VARCHAR(32) NOT NULL,
                    `period_key` VARCHAR(64) NOT NULL,
                    `label` VARCHAR(255) NOT NULL,
                    `start_date` VARCHAR(64) NOT NULL,
                    `end_date` VARCHAR(64) NOT NULL,
                    `total_transactions` INT DEFAULT 0,
                    `total_items` INT DEFAULT 0,
                    `total_revenue` DECIMAL(15,2) DEFAULT 0,
                    `total_discount` DECIMAL(15,2) DEFAULT 0,
                    `total_tax` DECIMAL(15,2) DEFAULT 0,
                    `total_cost` DECIMAL(15,2) DEFAULT 0,
                    `gross_profit` DECIMAL(15,2) DEFAULT 0,
                    `total_expenses` DECIMAL(15,2) DEFAULT 0,
                    `net_profit` DECIMAL(15,2) DEFAULT 0,
                    `breakdown_json` LONGTEXT,
                    `is_consolidated` TINYINT(1) DEFAULT 0,
                    `closed_by` VARCHAR(128) DEFAULT 'Otomatis (Tutup Toko)',
                    `closed_at` VARCHAR(64) NOT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX `idx_rpt_type_cons` (`report_type`, `is_consolidated`),
                    INDEX `idx_rpt_period` (`period_key`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                """)
                cur.execute("""
                CREATE TABLE IF NOT EXISTS `daily_cashbook` (
                    `id` VARCHAR(64) NOT NULL PRIMARY KEY,
                    `date` VARCHAR(64) NOT NULL,
                    `type` VARCHAR(16) NOT NULL,
                    `category` VARCHAR(128) NOT NULL,
                    `description` TEXT,
                    `amount` DECIMAL(15,2) DEFAULT 0,
                    `method` VARCHAR(32) DEFAULT 'cash',
                    `user` VARCHAR(128) DEFAULT 'Admin',
                    `reference` VARCHAR(128) DEFAULT '',
                    `status` VARCHAR(32) DEFAULT 'active',
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX `idx_cash_date` (`date`),
                    INDEX `idx_cash_type` (`type`),
                    INDEX `idx_cash_ref` (`reference`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                """)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
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
                is_deleted INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)
            try:
                cur.execute("ALTER TABLE products ADD COLUMN is_deleted INTEGER DEFAULT 0")
            except Exception:
                pass
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
            cur.execute("CREATE INDEX IF NOT EXISTS idx_trx_items_trx_id ON transaction_items(transaction_id);")
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
            cur.execute("""
            CREATE TABLE IF NOT EXISTS financial_reports (
                id TEXT PRIMARY KEY,
                report_type TEXT NOT NULL,
                period_key TEXT NOT NULL,
                label TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                total_transactions INTEGER DEFAULT 0,
                total_items INTEGER DEFAULT 0,
                total_revenue INTEGER DEFAULT 0,
                total_discount INTEGER DEFAULT 0,
                total_tax INTEGER DEFAULT 0,
                total_cost INTEGER DEFAULT 0,
                gross_profit INTEGER DEFAULT 0,
                total_expenses INTEGER DEFAULT 0,
                net_profit INTEGER DEFAULT 0,
                breakdown_json TEXT DEFAULT '[]',
                is_consolidated INTEGER DEFAULT 0,
                closed_by TEXT DEFAULT 'Otomatis (Tutup Toko)',
                closed_at TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_fin_rpt_type ON financial_reports(report_type, is_consolidated);")
            cur.execute("""
            CREATE TABLE IF NOT EXISTS daily_cashbook (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                type TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT,
                amount INTEGER DEFAULT 0,
                method TEXT DEFAULT 'cash',
                user TEXT DEFAULT 'Admin',
                reference TEXT DEFAULT '',
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_cb_date ON daily_cashbook(date);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_cb_type ON daily_cashbook(type);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_cb_ref ON daily_cashbook(reference);")
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
            conn.commit()
        except Exception:
            conn.rollback()
            raise
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
            if not secret_str:
                return False
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

                # Active Products Only (Soft Delete filter)
                cur.execute("SELECT id, name, barcode, category, CAST(costPrice AS SIGNED) as costPrice, CAST(sellPrice AS SIGNED) as sellPrice, stock, minStock, unit, image FROM products WHERE COALESCE(is_deleted, 0) = 0 ORDER BY id ASC")
                products = cur.fetchall()
                for p in products:
                    p["costPrice"] = to_rupiah(p.get("costPrice", 0))
                    p["sellPrice"] = to_rupiah(p.get("sellPrice", 0))

                # Transactions (bounded to 1000 recent records)
                cur.execute("SELECT id, date, cashier, customerName, CAST(subtotal AS SIGNED) as subtotal, CAST(discount AS SIGNED) as discount, CAST(tax AS SIGNED) as tax, CAST(total AS SIGNED) as total, CAST(totalCost AS SIGNED) as totalCost, CAST(profit AS SIGNED) as profit, paymentMethod, CAST(amountPaid AS SIGNED) as amountPaid, CAST(changeAmount AS SIGNED) as `change`, status FROM transactions ORDER BY date DESC LIMIT 1000")
                transactions = cur.fetchall()

                # Bounded Transaction items: only fetch items belonging to the returned 1000 transactions!
                items_by_trx = {}
                if transactions:
                    cur.execute("""
                        SELECT ti.transaction_id, ti.product_id as id, ti.name, ti.qty,
                               CAST(ti.costPrice AS SIGNED) as costPrice,
                               CAST(ti.sellPrice AS SIGNED) as sellPrice,
                               CAST(ti.subtotal AS SIGNED) as subtotal
                        FROM transaction_items ti
                        INNER JOIN (SELECT id FROM transactions ORDER BY date DESC LIMIT 1000) recent_t
                            ON ti.transaction_id = recent_t.id
                    """)
                    for item in cur.fetchall():
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

                # Financial Reports (Harian -> 7 Hari Mingguan -> 4 Minggu Bulanan -> 12 Bulan Tahunan)
                try:
                    cur.execute("""
                        SELECT id, report_type, period_key, label, start_date, end_date,
                               total_transactions, total_items,
                               CAST(total_revenue AS SIGNED) as total_revenue,
                               CAST(total_discount AS SIGNED) as total_discount,
                               CAST(total_tax AS SIGNED) as total_tax,
                               CAST(total_cost AS SIGNED) as total_cost,
                               CAST(gross_profit AS SIGNED) as gross_profit,
                               CAST(total_expenses AS SIGNED) as total_expenses,
                               CAST(net_profit AS SIGNED) as net_profit,
                               breakdown_json, is_consolidated, closed_by, closed_at
                        FROM financial_reports
                        ORDER BY end_date DESC, created_at DESC
                        LIMIT 500
                    """)
                    financial_reports = [self._format_report_row(r) for r in cur.fetchall()]
                except Exception:
                    financial_reports = []

                # Daily Cashbook (Buku Kas Harian - Arus Kas Masuk & Keluar)
                try:
                    cur.execute("""
                        SELECT id, date, type, category, description,
                               CAST(amount AS SIGNED) as amount, method, user, reference, status
                        FROM daily_cashbook
                        ORDER BY date DESC, created_at DESC
                        LIMIT 1000
                    """)
                    daily_cashbook = cur.fetchall()
                    for cb in daily_cashbook:
                        cb["amount"] = to_rupiah(cb.get("amount", 0))
                except Exception:
                    daily_cashbook = []

                return {
                    "settings": settings_map,
                    "categories": categories,
                    "products": products,
                    "discounts": discounts,
                    "transactions": transactions,
                    "expenses": expenses,
                    "stockHistory": stock_history,
                    "financialReports": financial_reports,
                    "dailyCashbook": daily_cashbook
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

            # Active Products Only (Soft Delete filter)
            cur.execute("SELECT id, name, barcode, category, costPrice, sellPrice, stock, minStock, unit, image FROM products WHERE COALESCE(is_deleted, 0) = 0 ORDER BY id ASC")
            products = [dict(r) for r in cur.fetchall()]
            for p in products:
                p["costPrice"] = to_rupiah(p.get("costPrice", 0))
                p["sellPrice"] = to_rupiah(p.get("sellPrice", 0))

            # Transactions (bounded to 1000 recent records)
            cur.execute("SELECT id, date, cashier, customerName, subtotal, discount, tax, total, totalCost, profit, paymentMethod, amountPaid, changeAmount as `change`, status FROM transactions ORDER BY date DESC LIMIT 1000")
            transactions = [dict(r) for r in cur.fetchall()]

            # Bounded Transaction items: only fetch items belonging to the 1000 recent transactions!
            items_by_trx = {}
            if transactions:
                cur.execute("""
                    SELECT transaction_id, product_id as id, name, qty, costPrice, sellPrice, subtotal
                    FROM transaction_items
                    WHERE transaction_id IN (SELECT id FROM transactions ORDER BY date DESC LIMIT 1000)
                """)
                for r in cur.fetchall():
                    item = dict(r)
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

            # Financial Reports (Harian -> 7 Hari Mingguan -> 4 Minggu Bulanan -> 12 Bulan Tahunan)
            try:
                cur.execute("""
                    SELECT id, report_type, period_key, label, start_date, end_date,
                           total_transactions, total_items, total_revenue, total_discount,
                           total_tax, total_cost, gross_profit, total_expenses, net_profit,
                           breakdown_json, is_consolidated, closed_by, closed_at
                    FROM financial_reports
                    ORDER BY end_date DESC, created_at DESC
                    LIMIT 500
                """)
                financial_reports = [self._format_report_row(dict(r)) for r in cur.fetchall()]
            except Exception:
                financial_reports = []

            # Daily Cashbook (Buku Kas Harian - Arus Kas Masuk & Keluar)
            try:
                cur.execute("""
                    SELECT id, date, type, category, description,
                           amount, method, user, reference, status
                    FROM daily_cashbook
                    ORDER BY date DESC, created_at DESC
                    LIMIT 1000
                """)
                daily_cashbook = [dict(r) for r in cur.fetchall()]
                for cb in daily_cashbook:
                    cb["amount"] = to_rupiah(cb.get("amount", 0))
            except Exception:
                daily_cashbook = []

            return {
                "settings": settings_map,
                "categories": categories,
                "products": products,
                "discounts": discounts,
                "transactions": transactions,
                "expenses": expenses,
                "stockHistory": stock_history,
                "financialReports": financial_reports,
                "dailyCashbook": daily_cashbook
            }
        finally:
            conn.close()

    def _calculate_discount_amount(self, subtotal, trx, disc_row, disc_id_or_code_given=False, is_admin_authorized=False):
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

        # If a promo ID or code was specified but not found in DB, do NOT fall back to raw manual discount
        if disc_id_or_code_given:
            return 0

        manual_disc = to_rupiah(trx.get("discount", 0))
        if manual_disc <= 0:
            return 0

        # SECURITY FIX (CRITICAL #1): Arbitrary manual discount requires Admin role or Admin Password authorization!
        if not is_admin_authorized:
            raise ValueError(
                "Diskon manual memerlukan otorisasi Password Admin! Gunakan Kode Promo/Voucher resmi atau minta persetujuan Admin."
            )

        return min(max(0, manual_disc), subtotal)

    def process_checkout(self, trx, user_role="cashier"):
        with self.lock:
            trx_id = (trx.get("id") or "").strip() or generate_uid("TRX")
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
            disc_id_or_code_given = bool(disc_id or disc_code)

            # Check whether manual discount is authorized by Admin role or inline adminAuthPassword
            admin_auth_pass = trx.get("adminAuthPassword") or (disc_info.get("adminAuthPassword") if isinstance(disc_info, dict) else "")
            is_admin_authorized = (user_role == "admin") or (bool(admin_auth_pass) and self.verify_credentials("admin", admin_auth_pass))

            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    conn.begin()
                    with conn.cursor() as cur:
                        # 1. Idempotency Check: prevent double stock deduction on duplicate request
                        cur.execute("SELECT id FROM transactions WHERE id = %s FOR UPDATE", (trx_id,))
                        if cur.fetchone():
                            conn.rollback()
                            return self.get_all()

                        # 2. Server-side item validation & price calculation with active InnoDB row lock
                        validated_items = []
                        subtotal = 0
                        total_cost = 0
                        for item in raw_items:
                            prod_id = item.get("id", "")
                            qty = int(item.get("qty", 0))
                            if qty <= 0:
                                raise ValueError(f"Jumlah item tidak valid untuk produk {prod_id}.")
                            cur.execute(
                                "SELECT id, name, costPrice, sellPrice, stock, unit FROM products WHERE id = %s AND COALESCE(is_deleted, 0) = 0 FOR UPDATE",
                                (prod_id,)
                            )
                            prod = cur.fetchone()
                            if not prod:
                                raise ValueError(f"Produk dengan ID '{prod_id}' tidak ditemukan atau sudah dihapus.")
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
                        discount = self._calculate_discount_amount(
                            subtotal, trx, disc_row,
                            disc_id_or_code_given=disc_id_or_code_given,
                            is_admin_authorized=is_admin_authorized
                        )

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

                            stk_id = f"{generate_uid('STK')}-{idx}"
                            cur.execute("""
                            INSERT INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                            VALUES (%s, %s, %s, %s, 'out', %s, %s, %s)
                            """, (stk_id, trx_date, v_item["id"], v_item["name"], v_item["qty"], f"Penjualan #{trx_id}", cashier))

                        # 5. Integrasi Otomatis ke Kas Harian (Daily Cashbook)
                        cash_id = generate_uid("CSH")
                        cur.execute("""
                        INSERT INTO daily_cashbook (id, date, type, category, description, amount, method, user, reference, status)
                        VALUES (%s, %s, 'in', 'Penjualan', %s, %s, %s, %s, %s, 'active')
                        """, (cash_id, trx_date, f"Penjualan #{trx_id} ({customer_name})", total, payment_method, cashier, trx_id))

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
                        cur.execute(
                            "SELECT id, name, costPrice, sellPrice, stock, unit FROM products WHERE id = ? AND COALESCE(is_deleted, 0) = 0",
                            (prod_id,)
                        )
                        row = cur.fetchone()
                        if not row:
                            raise ValueError(f"Produk dengan ID '{prod_id}' tidak ditemukan atau sudah dihapus.")
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
                    discount = self._calculate_discount_amount(
                        subtotal, trx, disc_row,
                        disc_id_or_code_given=disc_id_or_code_given,
                        is_admin_authorized=is_admin_authorized
                    )

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

                        stk_id = f"{generate_uid('STK')}-{idx}"
                        cur.execute("""
                        INSERT INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                        VALUES (?, ?, ?, ?, 'out', ?, ?, ?)
                        """, (stk_id, trx_date, v_item["id"], v_item["name"], v_item["qty"], f"Penjualan #{trx_id}", cashier))

                    # 5. Integrasi Otomatis ke Kas Harian (Daily Cashbook)
                    cash_id = generate_uid("CSH")
                    cur.execute("""
                    INSERT INTO daily_cashbook (id, date, type, category, description, amount, method, user, reference, status)
                    VALUES (?, ?, 'in', 'Penjualan', ?, ?, ?, ?, ?, 'active')
                    """, (cash_id, trx_date, f"Penjualan #{trx_id} ({customer_name})", total, payment_method, cashier, trx_id))

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
                    conn.begin()
                    with conn.cursor() as cur:
                        cur.execute("SELECT id, status FROM transactions WHERE id = %s FOR UPDATE", (trx_id,))
                        trx_row = cur.fetchone()
                        if not trx_row or trx_row.get("status") == "void":
                            conn.rollback()
                            return self.get_all()

                        cur.execute("SELECT product_id, name, qty FROM transaction_items WHERE transaction_id = %s", (trx_id,))
                        items = cur.fetchall()
                        for idx, item in enumerate(items):
                            prod_id = item.get("product_id", "")
                            qty = int(item.get("qty", 0))
                            item_name = item.get("name", "")
                            if prod_id and qty > 0:
                                cur.execute("UPDATE products SET stock = stock + %s WHERE id = %s", (qty, prod_id))
                                if cur.rowcount > 0:
                                    stk_id = f"{generate_uid('STK')}-V{idx}"
                                    cur.execute("""
                                    INSERT INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                                    VALUES (%s, %s, %s, %s, 'in', %s, %s, %s)
                                    """, (stk_id, date_str, prod_id, item_name, qty, f"Void Nota #{trx_id}: {clean_reason}", user))
                        cur.execute("UPDATE transactions SET status = 'void' WHERE id = %s", (trx_id,))
                        # Update status di buku kas harian agar tidak dihitung ganda
                        cur.execute("UPDATE daily_cashbook SET status = 'void' WHERE reference = %s", (trx_id,))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
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
                            if cur.rowcount > 0:
                                stk_id = f"{generate_uid('STK')}-V{idx}"
                                cur.execute("""
                                INSERT INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                                VALUES (?, ?, ?, ?, 'in', ?, ?, ?)
                                """, (stk_id, date_str, prod_id, item_name, qty, f"Void Nota #{trx_id}: {clean_reason}", user))
                    cur.execute("UPDATE transactions SET status = 'void' WHERE id = ?", (trx_id,))
                    # Update status di buku kas harian agar tidak dihitung ganda
                    cur.execute("UPDATE daily_cashbook SET status = 'void' WHERE reference = ?", (trx_id,))
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
            prod_id = (product.get("id") or "").strip()
            if not prod_id:
                prod_id = generate_uid("P")
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
                        INSERT INTO products (id, name, barcode, category, costPrice, sellPrice, stock, minStock, unit, image, is_deleted)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0)
                        ON DUPLICATE KEY UPDATE
                            name=VALUES(name), barcode=VALUES(barcode), category=VALUES(category),
                            costPrice=VALUES(costPrice), sellPrice=VALUES(sellPrice), stock=VALUES(stock),
                            minStock=VALUES(minStock), unit=VALUES(unit), image=VALUES(image), is_deleted=0
                        """, (prod_id, name, barcode, category, cost_price, sell_price, stock, min_stock, unit, image))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("""
                    INSERT OR REPLACE INTO products (id, name, barcode, category, costPrice, sellPrice, stock, minStock, unit, image, is_deleted)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                    """, (prod_id, name, barcode, category, cost_price, sell_price, stock, min_stock, unit, image))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()

            return self.get_all()

    def delete_product(self, prod_id):
        """
        Soft-delete product (is_deleted = 1) so historical transactions & void stock restoration
        preserve referential integrity, while freeing the barcode for reuse.
        """
        with self.lock:
            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("UPDATE products SET is_deleted = 1, barcode = '' WHERE id = %s", (prod_id,))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("UPDATE products SET is_deleted = 1, barcode = '' WHERE id = ?", (prod_id,))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
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
                    conn.begin()
                    with conn.cursor() as cur:
                        cur.execute("SELECT name, costPrice, unit FROM products WHERE id = %s FOR UPDATE", (prod_id,))
                        prod = cur.fetchone()
                        if prod:
                            if mutation_type == "in":
                                cur.execute("UPDATE products SET stock = stock + %s WHERE id = %s", (qty, prod_id))
                            else:
                                cur.execute("UPDATE products SET stock = GREATEST(0, stock - %s) WHERE id = %s", (qty, prod_id))

                            stk_id = generate_uid("STK")
                            cur.execute("""
                            INSERT INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """, (stk_id, date_str, prod_id, prod["name"], mutation_type, qty, reason or ("Restock Masuk" if mutation_type == "in" else "Penyesuaian"), user))

                            if mutation_type == "in" and record_expense:
                                exp_id = generate_uid("EXP")
                                cost = to_rupiah(prod.get("costPrice", 0)) * qty
                                method = (payload.get("method") or payload.get("paymentMethod") or "cash").strip().lower()
                                if method not in ("cash", "bank", "qris", "transfer"):
                                    method = "cash"
                                cur.execute("""
                                INSERT INTO expenses (id, date, category, description, amount, recordedBy)
                                VALUES (%s, %s, 'Stok Barang', %s, %s, %s)
                                """, (exp_id, date_str, f"Restock {qty} {prod.get('unit','pcs')} {prod['name']}", cost, user))

                                cash_id = generate_uid("CSH")
                                cur.execute("""
                                INSERT INTO daily_cashbook (id, date, type, category, description, amount, method, user, reference, status)
                                VALUES (%s, %s, 'out', 'Stok Barang', %s, %s, %s, %s, %s, 'active')
                                """, (cash_id, date_str, f"Restock {qty} {prod.get('unit','pcs')} {prod['name']}", cost, method, user, exp_id))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
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

                        stk_id = generate_uid("STK")
                        cur.execute("""
                        INSERT INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (stk_id, date_str, prod_id, prod_name, mutation_type, qty, reason or ("Restock Masuk" if mutation_type == "in" else "Penyesuaian"), user))

                        if mutation_type == "in" and record_expense:
                            exp_id = generate_uid("EXP")
                            cost = cost_p * qty
                            method = (payload.get("method") or payload.get("paymentMethod") or "cash").strip().lower()
                            if method not in ("cash", "bank", "qris", "transfer"):
                                method = "cash"
                            cur.execute("""
                            INSERT INTO expenses (id, date, category, description, amount, recordedBy)
                            VALUES (?, ?, 'Stok Barang', ?, ?, ?)
                            """, (exp_id, date_str, f"Restock {qty} {unit} {prod_name}", cost, user))

                            cash_id = generate_uid("CSH")
                            cur.execute("""
                            INSERT INTO daily_cashbook (id, date, type, category, description, amount, method, user, reference, status)
                            VALUES (?, ?, 'out', 'Stok Barang', ?, ?, ?, ?, ?, 'active')
                            """, (cash_id, date_str, f"Restock {qty} {unit} {prod_name}", cost, method, user, exp_id))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()

            return self.get_all()

    def add_expense(self, expense):
        with self.lock:
            exp_id = (expense.get("id") or "").strip() or generate_uid("EXP")
            exp_date = expense.get("date") or time.strftime("%Y-%m-%dT%H:%M:%SZ")
            cat = expense.get("category", "Operasional")
            desc = expense.get("description", "")
            amount = to_rupiah(expense.get("amount", 0))
            user = expense.get("recordedBy", "Admin")
            method = (expense.get("method") or expense.get("paymentMethod") or "cash").strip().lower()
            if method not in ("cash", "bank", "qris", "transfer"):
                method = "cash"

            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("""
                        INSERT INTO expenses (id, date, category, description, amount, recordedBy)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """, (exp_id, exp_date, cat, desc, amount, user))

                        cash_id = generate_uid("CSH")
                        cur.execute("""
                        INSERT INTO daily_cashbook (id, date, type, category, description, amount, method, user, reference, status)
                        VALUES (%s, %s, 'out', %s, %s, %s, %s, %s, %s, 'active')
                        """, (cash_id, exp_date, cat, desc, amount, method, user, exp_id))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
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

                    cash_id = generate_uid("CSH")
                    cur.execute("""
                    INSERT INTO daily_cashbook (id, date, type, category, description, amount, method, user, reference, status)
                    VALUES (?, ?, 'out', ?, ?, ?, ?, ?, ?, 'active')
                    """, (cash_id, exp_date, cat, desc, amount, method, user, exp_id))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
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
                        cur.execute("DELETE FROM daily_cashbook WHERE reference = %s OR id = %s", (exp_id, exp_id))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("DELETE FROM expenses WHERE id = ?", (exp_id,))
                    cur.execute("DELETE FROM daily_cashbook WHERE reference = ? OR id = ?", (exp_id, exp_id))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()
            return self.get_all()

    def add_cashbook_entry(self, payload):
        """
        Record a manual money in/out entry into daily_cashbook.
        type: 'in' | 'out'
        category: e.g. 'Modal Tambahan', 'Pemasukan Lain', 'Operasional', 'Listrik', etc.
        amount: integer rupiah > 0
        method: 'cash' | 'bank' | 'qris'
        """
        with self.lock:
            cb_id = (payload.get("id") or "").strip() or generate_uid("CSH")
            cb_date = payload.get("date") or time.strftime("%Y-%m-%dT%H:%M:%SZ")
            entry_type = (payload.get("type") or "in").strip().lower()
            if entry_type not in ("in", "out"):
                entry_type = "in"
            category = (payload.get("category") or ("Pemasukan Lain" if entry_type == "in" else "Operasional")).strip()
            desc = (payload.get("description") or "").strip()
            amount = to_rupiah(payload.get("amount", 0))
            if amount <= 0:
                raise ValueError("Nominal kas harus lebih besar dari 0.")
            method = (payload.get("method") or "cash").strip().lower()
            user = (payload.get("user") or "Admin").strip()
            ref = (payload.get("reference") or "").strip()
            status = "active"

            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("""
                        INSERT INTO daily_cashbook (id, date, type, category, description, amount, method, user, reference, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (cb_id, cb_date, entry_type, category, desc, amount, method, user, ref, status))
                        # If this was an operational expense, also keep in expenses for backward compatibility
                        if entry_type == "out" and not ref:
                            cur.execute("""
                            INSERT INTO expenses (id, date, category, description, amount, recordedBy)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            """, (cb_id, cb_date, category, desc, amount, user))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("""
                    INSERT INTO daily_cashbook (id, date, type, category, description, amount, method, user, reference, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (cb_id, cb_date, entry_type, category, desc, amount, method, user, ref, status))
                    if entry_type == "out" and not ref:
                        cur.execute("""
                        INSERT INTO expenses (id, date, category, description, amount, recordedBy)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """, (cb_id, cb_date, category, desc, amount, user))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()

            return self.get_all()

    def void_cashbook_entry(self, entry_id, reason="Dibatalkan oleh Admin", user="Admin"):
        """Void a cashbook entry with audit trail."""
        with self.lock:
            clean_reason = (reason or "Dibatalkan").strip()
            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("UPDATE daily_cashbook SET status = 'void' WHERE id = %s OR reference = %s", (entry_id, entry_id))
                        cur.execute("DELETE FROM expenses WHERE id = %s", (entry_id,))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("UPDATE daily_cashbook SET status = 'void' WHERE id = ? OR reference = ?", (entry_id, entry_id))
                    cur.execute("DELETE FROM expenses WHERE id = ?", (entry_id,))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
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
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
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
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()
            return self.get_all()

    def save_discount(self, discount_data):
        with self.lock:
            disc_id = (discount_data.get("id") or "").strip()
            if not disc_id:
                disc_id = generate_uid("DSC")
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
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
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
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()

            return self.get_all()

    def _format_report_row(self, r):
        try:
            breakdown = json.loads(r.get("breakdown_json") or "[]")
        except Exception:
            breakdown = []
        return {
            "id": r.get("id", ""),
            "reportType": r.get("report_type", "daily"),
            "periodKey": r.get("period_key", ""),
            "label": r.get("label", ""),
            "startDate": r.get("start_date", ""),
            "endDate": r.get("end_date", ""),
            "totalTransactions": int(r.get("total_transactions", 0) or 0),
            "totalItems": int(r.get("total_items", 0) or 0),
            "totalRevenue": to_rupiah(r.get("total_revenue", 0)),
            "totalDiscount": to_rupiah(r.get("total_discount", 0)),
            "totalTax": to_rupiah(r.get("total_tax", 0)),
            "totalCost": to_rupiah(r.get("total_cost", 0)),
            "grossProfit": to_rupiah(r.get("gross_profit", 0)),
            "totalExpenses": to_rupiah(r.get("total_expenses", 0)),
            "netProfit": to_rupiah(r.get("net_profit", 0)),
            "breakdown": breakdown,
            "isConsolidated": bool(r.get("is_consolidated", 0)),
            "closedBy": r.get("closed_by") or "Otomatis (Tutup Toko)",
            "closedAt": r.get("closed_at") or ""
        }

    def _compute_day_metrics(self, target_date_key, cur=None, is_mysql=False):
        """Calculate exact revenue, HPP, gross profit, expenses, and net profit for a single YYYY-MM-DD via direct SQL."""
        day_trxs = []
        day_exps = []
        total_items = 0

        if cur is not None:
            if is_mysql:
                cur.execute("""
                    SELECT id,
                           CAST(total AS SIGNED) as total,
                           CAST(discount AS SIGNED) as discount,
                           CAST(tax AS SIGNED) as tax,
                           CAST(totalCost AS SIGNED) as totalCost,
                           CAST(profit AS SIGNED) as profit,
                           CAST(subtotal AS SIGNED) as subtotal,
                           paymentMethod
                    FROM transactions
                    WHERE COALESCE(status, 'completed') != 'void'
                      AND (date LIKE %s OR SUBSTRING(date, 1, 10) = %s)
                """, (f"{target_date_key}%", target_date_key))
                day_trxs = list(cur.fetchall())

                cur.execute("""
                    SELECT COALESCE(SUM(ti.qty), 0) as total_qty
                    FROM transaction_items ti
                    JOIN transactions t ON ti.transaction_id = t.id
                    WHERE COALESCE(t.status, 'completed') != 'void'
                      AND (t.date LIKE %s OR SUBSTRING(t.date, 1, 10) = %s)
                """, (f"{target_date_key}%", target_date_key))
                qty_row = cur.fetchone()
                total_items = int((qty_row.get("total_qty") if isinstance(qty_row, dict) else qty_row[0]) or 0)

                cur.execute("""
                    SELECT category, CAST(amount AS SIGNED) as amount
                    FROM expenses
                    WHERE date LIKE %s OR SUBSTRING(date, 1, 10) = %s
                """, (f"{target_date_key}%", target_date_key))
                day_exps = list(cur.fetchall())
            else:
                cur.execute("""
                    SELECT id, total, discount, tax, totalCost, profit, subtotal, paymentMethod
                    FROM transactions
                    WHERE COALESCE(status, 'completed') != 'void'
                      AND (date LIKE ? OR substr(date, 1, 10) = ?)
                """, (f"{target_date_key}%", target_date_key))
                day_trxs = [dict(r) for r in cur.fetchall()]

                cur.execute("""
                    SELECT COALESCE(SUM(ti.qty), 0) as total_qty
                    FROM transaction_items ti
                    JOIN transactions t ON ti.transaction_id = t.id
                    WHERE COALESCE(t.status, 'completed') != 'void'
                      AND (t.date LIKE ? OR substr(t.date, 1, 10) = ?)
                """, (f"{target_date_key}%", target_date_key))
                qty_row = cur.fetchone()
                total_items = int(qty_row[0] if qty_row else 0)

                cur.execute("""
                    SELECT category, amount
                    FROM expenses
                    WHERE date LIKE ? OR substr(date, 1, 10) = ?
                """, (f"{target_date_key}%", target_date_key))
                day_exps = [dict(r) for r in cur.fetchall()]

        total_transactions = len(day_trxs)
        total_revenue = 0
        total_discount = 0
        total_tax = 0
        total_cost = 0
        gross_profit = 0
        payment_summary = {"cash": 0, "qris": 0, "transfer": 0}

        for t in day_trxs:
            rev = to_rupiah(t.get("total", 0))
            disc = to_rupiah(t.get("discount", 0))
            tax = to_rupiah(t.get("tax", 0))
            cost = to_rupiah(t.get("totalCost", 0))
            sub = to_rupiah(t.get("subtotal", rev))
            prof = to_rupiah(t.get("profit")) if t.get("profit") is not None else ((sub - disc) - cost)

            total_revenue += rev
            total_discount += disc
            total_tax += tax
            total_cost += cost
            gross_profit += prof

            pm = str(t.get("paymentMethod") or "cash").lower()
            if pm in payment_summary:
                payment_summary[pm] += rev
            elif pm == "bank":
                payment_summary["transfer"] += rev
            else:
                payment_summary["cash"] += rev

        total_expenses = sum(to_rupiah(e.get("amount", 0)) for e in day_exps)
        net_profit = gross_profit - total_expenses

        expense_categories = {}
        for e in day_exps:
            cat = str(e.get("category") or "Operasional")
            expense_categories[cat] = expense_categories.get(cat, 0) + to_rupiah(e.get("amount", 0))

        breakdown = [{
            "type": "daily_detail",
            "date": target_date_key,
            "label": f"Harian: {format_id_date(target_date_key)}",
            "paymentSummary": payment_summary,
            "expenseCategories": expense_categories,
            "totalTransactions": total_transactions,
            "totalItems": total_items,
            "totalRevenue": total_revenue,
            "totalCost": total_cost,
            "grossProfit": gross_profit,
            "totalExpenses": total_expenses,
            "netProfit": net_profit
        }]

        return {
            "total_transactions": total_transactions,
            "total_items": total_items,
            "total_revenue": total_revenue,
            "total_discount": total_discount,
            "total_tax": total_tax,
            "total_cost": total_cost,
            "gross_profit": gross_profit,
            "total_expenses": total_expenses,
            "net_profit": net_profit,
            "breakdown_json": json.dumps(breakdown)
        }

    def _run_consolidation_sqlite(self, cur, closed_by="Otomatis (Konsolidasi)"):
        """
        Hierarchical Roll-up Engine (SQLite):
        - 7 Distinct Active Daily reports -> 1 Weekly report
        - 4 Distinct Active Weekly reports -> 1 Monthly report
        - 12 Distinct Active Monthly reports -> 1 Yearly report
        """
        now_iso = datetime.now().isoformat()

        tiers = [
            ("daily", "weekly", 7, "RPT-WK", "Mingguan (7 Hari)"),
            ("weekly", "monthly", 4, "RPT-MO", "Bulanan (4 Minggu)"),
            ("monthly", "yearly", 12, "RPT-YR", "Tahunan (12 Bulan)")
        ]

        consolidated_events = []

        for src_type, dst_type, threshold, id_prefix, title_prefix in tiers:
            cur.execute("""
                SELECT id, report_type, period_key, label, start_date, end_date,
                       total_transactions, total_items, total_revenue, total_discount,
                       total_tax, total_cost, gross_profit, total_expenses, net_profit,
                       breakdown_json, is_consolidated, closed_by, closed_at
                FROM financial_reports
                WHERE report_type = ? AND COALESCE(is_consolidated, 0) = 0
                ORDER BY start_date ASC, created_at ASC
            """, (src_type,))
            active_rows = [dict(r) for r in cur.fetchall()]

            # Group / deduplicate by unique start_date to prevent duplicate reports on the same day consolidating into a fake week
            unique_date_map = {}
            for r in active_rows:
                sd = r["start_date"]
                if sd not in unique_date_map:
                    unique_date_map[sd] = r
            unique_rows = list(unique_date_map.values())

            while len(unique_rows) >= threshold:
                batch = unique_rows[:threshold]
                unique_rows = unique_rows[threshold:]

                start_d = batch[0]["start_date"]
                end_d = batch[-1]["end_date"]
                new_id = generate_uid(id_prefix)
                period_key = f"{id_prefix}-{start_d}_{end_d}-{uuid.uuid4().hex[:4].upper()}"
                label = f"{title_prefix}: {format_id_date(start_d)} – {format_id_date(end_d)}"

                sum_trx = sum(int(r.get("total_transactions", 0) or 0) for r in batch)
                sum_items = sum(int(r.get("total_items", 0) or 0) for r in batch)
                sum_rev = sum(to_rupiah(r.get("total_revenue", 0)) for r in batch)
                sum_disc = sum(to_rupiah(r.get("total_discount", 0)) for r in batch)
                sum_tax = sum(to_rupiah(r.get("total_tax", 0)) for r in batch)
                sum_cost = sum(to_rupiah(r.get("total_cost", 0)) for r in batch)
                sum_gross = sum(to_rupiah(r.get("gross_profit", 0)) for r in batch)
                sum_exp = sum(to_rupiah(r.get("total_expenses", 0)) for r in batch)
                sum_net = sum(to_rupiah(r.get("net_profit", 0)) for r in batch)

                children_summary = [self._format_report_row(r) for r in batch]
                for c in children_summary:
                    c.pop("breakdown", None)

                cur.execute("""
                    INSERT INTO financial_reports (
                        id, report_type, period_key, label, start_date, end_date,
                        total_transactions, total_items, total_revenue, total_discount,
                        total_tax, total_cost, gross_profit, total_expenses, net_profit,
                        breakdown_json, is_consolidated, closed_by, closed_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                """, (
                    new_id, dst_type, period_key, label, start_d, end_d,
                    sum_trx, sum_items, sum_rev, sum_disc,
                    sum_tax, sum_cost, sum_gross, sum_exp, sum_net,
                    json.dumps(children_summary), closed_by, now_iso
                ))

                batch_dates = [r["start_date"] for r in batch]
                date_placeholders = ",".join(["?"] * len(batch_dates))
                cur.execute(f"UPDATE financial_reports SET is_consolidated = 1 WHERE report_type = ? AND start_date IN ({date_placeholders})", [src_type] + batch_dates)
                consolidated_events.append({"from": src_type, "to": dst_type, "label": label, "id": new_id})

        return consolidated_events

    def _run_consolidation_mysql(self, cur, closed_by="Otomatis (Konsolidasi)"):
        """
        Hierarchical Roll-up Engine (MySQL):
        - 7 Distinct Active Daily reports -> 1 Weekly report
        - 4 Distinct Active Weekly reports -> 1 Monthly report
        - 12 Distinct Active Monthly reports -> 1 Yearly report
        """
        now_iso = datetime.now().isoformat()

        tiers = [
            ("daily", "weekly", 7, "RPT-WK", "Mingguan (7 Hari)"),
            ("weekly", "monthly", 4, "RPT-MO", "Bulanan (4 Minggu)"),
            ("monthly", "yearly", 12, "RPT-YR", "Tahunan (12 Bulan)")
        ]

        consolidated_events = []

        for src_type, dst_type, threshold, id_prefix, title_prefix in tiers:
            cur.execute("""
                SELECT id, report_type, period_key, label, start_date, end_date,
                       total_transactions, total_items,
                       CAST(total_revenue AS SIGNED) as total_revenue,
                       CAST(total_discount AS SIGNED) as total_discount,
                       CAST(total_tax AS SIGNED) as total_tax,
                       CAST(total_cost AS SIGNED) as total_cost,
                       CAST(gross_profit AS SIGNED) as gross_profit,
                       CAST(total_expenses AS SIGNED) as total_expenses,
                       CAST(net_profit AS SIGNED) as net_profit,
                       breakdown_json, is_consolidated, closed_by, closed_at
                FROM financial_reports
                WHERE report_type = %s AND COALESCE(is_consolidated, 0) = 0
                ORDER BY start_date ASC, created_at ASC
            """, (src_type,))
            active_rows = list(cur.fetchall())

            # Group / deduplicate by unique start_date to prevent duplicate reports on the same day consolidating into a fake week
            unique_date_map = {}
            for r in active_rows:
                sd = r["start_date"]
                if sd not in unique_date_map:
                    unique_date_map[sd] = r
            unique_rows = list(unique_date_map.values())

            while len(unique_rows) >= threshold:
                batch = unique_rows[:threshold]
                unique_rows = unique_rows[threshold:]

                start_d = batch[0]["start_date"]
                end_d = batch[-1]["end_date"]
                new_id = generate_uid(id_prefix)
                period_key = f"{id_prefix}-{start_d}_{end_d}-{uuid.uuid4().hex[:4].upper()}"
                label = f"{title_prefix}: {format_id_date(start_d)} – {format_id_date(end_d)}"

                sum_trx = sum(int(r.get("total_transactions", 0) or 0) for r in batch)
                sum_items = sum(int(r.get("total_items", 0) or 0) for r in batch)
                sum_rev = sum(to_rupiah(r.get("total_revenue", 0)) for r in batch)
                sum_disc = sum(to_rupiah(r.get("total_discount", 0)) for r in batch)
                sum_tax = sum(to_rupiah(r.get("total_tax", 0)) for r in batch)
                sum_cost = sum(to_rupiah(r.get("total_cost", 0)) for r in batch)
                sum_gross = sum(to_rupiah(r.get("gross_profit", 0)) for r in batch)
                sum_exp = sum(to_rupiah(r.get("total_expenses", 0)) for r in batch)
                sum_net = sum(to_rupiah(r.get("net_profit", 0)) for r in batch)

                children_summary = [self._format_report_row(r) for r in batch]
                for c in children_summary:
                    c.pop("breakdown", None)

                cur.execute("""
                    INSERT INTO financial_reports (
                        id, report_type, period_key, label, start_date, end_date,
                        total_transactions, total_items, total_revenue, total_discount,
                        total_tax, total_cost, gross_profit, total_expenses, net_profit,
                        breakdown_json, is_consolidated, closed_by, closed_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0, %s, %s)
                """, (
                    new_id, dst_type, period_key, label, start_d, end_d,
                    sum_trx, sum_items, sum_rev, sum_disc,
                    sum_tax, sum_cost, sum_gross, sum_exp, sum_net,
                    json.dumps(children_summary), closed_by, now_iso
                ))

                batch_dates = [r["start_date"] for r in batch]
                date_placeholders = ",".join(["%s"] * len(batch_dates))
                cur.execute(f"UPDATE financial_reports SET is_consolidated = 1 WHERE report_type = %s AND start_date IN ({date_placeholders})", [src_type] + batch_dates)
                consolidated_events.append({"from": src_type, "to": dst_type, "label": label, "id": new_id})

        return consolidated_events

    def close_daily_report(self, target_date=None, closed_by="Otomatis (Tutup Toko)", force_new_entry=False, return_full_data=True):
        """
        Record or update the Daily Financial Report for `target_date` (YYYY-MM-DD),
        and automatically consolidate:
          - 7 Daily -> 1 Weekly
          - 4 Weekly -> 1 Monthly
          - 12 Monthly -> 1 Yearly
        """
        with self.lock:
            date_key = to_local_date_key(target_date) if target_date else datetime.now().strftime("%Y-%m-%d")
            now_iso = datetime.now().isoformat()
            label = f"Harian: {format_id_date(date_key)}"
            consolidated_events = []

            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    conn.begin()
                    with conn.cursor() as cur:
                        metrics = self._compute_day_metrics(date_key, cur=cur, is_mysql=True)

                        cur.execute("""
                            SELECT id, is_consolidated FROM financial_reports
                            WHERE report_type = 'daily' AND period_key = %s
                            ORDER BY is_consolidated ASC, created_at DESC LIMIT 1
                        """, (date_key,))
                        existing = cur.fetchone()

                        if existing and not int(existing.get("is_consolidated", 0)) and not force_new_entry:
                            rpt_id = existing["id"]
                            cur.execute("""
                                UPDATE financial_reports SET
                                    label = %s,
                                    total_transactions = %s,
                                    total_items = %s,
                                    total_revenue = %s,
                                    total_discount = %s,
                                    total_tax = %s,
                                    total_cost = %s,
                                    gross_profit = %s,
                                    total_expenses = %s,
                                    net_profit = %s,
                                    breakdown_json = %s,
                                    closed_by = %s,
                                    closed_at = %s
                                WHERE id = %s
                            """, (
                                label,
                                metrics["total_transactions"], metrics["total_items"],
                                metrics["total_revenue"], metrics["total_discount"],
                                metrics["total_tax"], metrics["total_cost"],
                                metrics["gross_profit"], metrics["total_expenses"],
                                metrics["net_profit"], metrics["breakdown_json"],
                                closed_by, now_iso, rpt_id
                            ))
                        else:
                            rpt_id = generate_uid("RPT-DAY")
                            p_key = date_key if not (existing and force_new_entry) else f"{date_key}-{uuid.uuid4().hex[:4].upper()}"
                            cur.execute("""
                                INSERT INTO financial_reports (
                                    id, report_type, period_key, label, start_date, end_date,
                                    total_transactions, total_items, total_revenue, total_discount,
                                    total_tax, total_cost, gross_profit, total_expenses, net_profit,
                                    breakdown_json, is_consolidated, closed_by, closed_at
                                ) VALUES (%s, 'daily', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0, %s, %s)
                            """, (
                                rpt_id, p_key, label, date_key, date_key,
                                metrics["total_transactions"], metrics["total_items"],
                                metrics["total_revenue"], metrics["total_discount"],
                                metrics["total_tax"], metrics["total_cost"],
                                metrics["gross_profit"], metrics["total_expenses"],
                                metrics["net_profit"], metrics["breakdown_json"],
                                closed_by, now_iso
                            ))

                        consolidated_events = self._run_consolidation_mysql(cur, closed_by=closed_by)
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    metrics = self._compute_day_metrics(date_key, cur=cur, is_mysql=False)

                    cur.execute("""
                        SELECT id, is_consolidated FROM financial_reports
                        WHERE report_type = 'daily' AND period_key = ?
                        ORDER BY is_consolidated ASC, created_at DESC LIMIT 1
                    """, (date_key,))
                    row = cur.fetchone()
                    existing = dict(row) if row else None

                    if existing and not int(existing.get("is_consolidated", 0)) and not force_new_entry:
                        rpt_id = existing["id"]
                        cur.execute("""
                            UPDATE financial_reports SET
                                label = ?,
                                total_transactions = ?,
                                total_items = ?,
                                total_revenue = ?,
                                total_discount = ?,
                                total_tax = ?,
                                total_cost = ?,
                                gross_profit = ?,
                                total_expenses = ?,
                                net_profit = ?,
                                breakdown_json = ?,
                                closed_by = ?,
                                closed_at = ?
                            WHERE id = ?
                        """, (
                            label,
                            metrics["total_transactions"], metrics["total_items"],
                            metrics["total_revenue"], metrics["total_discount"],
                            metrics["total_tax"], metrics["total_cost"],
                            metrics["gross_profit"], metrics["total_expenses"],
                            metrics["net_profit"], metrics["breakdown_json"],
                            closed_by, now_iso, rpt_id
                        ))
                    else:
                        rpt_id = generate_uid("RPT-DAY")
                        p_key = date_key if not (existing and force_new_entry) else f"{date_key}-{uuid.uuid4().hex[:4].upper()}"
                        cur.execute("""
                            INSERT INTO financial_reports (
                                id, report_type, period_key, label, start_date, end_date,
                                total_transactions, total_items, total_revenue, total_discount,
                                total_tax, total_cost, gross_profit, total_expenses, net_profit,
                                breakdown_json, is_consolidated, closed_by, closed_at
                            ) VALUES (?, 'daily', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                        """, (
                            rpt_id, p_key, label, date_key, date_key,
                            metrics["total_transactions"], metrics["total_items"],
                            metrics["total_revenue"], metrics["total_discount"],
                            metrics["total_tax"], metrics["total_cost"],
                            metrics["gross_profit"], metrics["total_expenses"],
                            metrics["net_profit"], metrics["breakdown_json"],
                            closed_by, now_iso
                        ))

                    consolidated_events = self._run_consolidation_sqlite(cur, closed_by=closed_by)
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()

            return {
                "closedDate": date_key,
                "consolidatedEvents": consolidated_events,
                "data": self.get_all() if return_full_data else None
            }

    def auto_check_and_close_reports(self):
        """
        Lightweight check:
        1. Any past dates (< today) that have transactions or expenses but no daily report yet.
        2. Today's report if `autoCloseEnabled` is True and current local time >= `storeCloseTime`.
        Returns (changed: bool, full_data_or_none).
        Does NOT call self.get_all() every 30s unless reports are actually created/updated!
        """
        with self.lock:
            # 1. Quick fetch settings directly without get_all()
            settings = {}
            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("SELECT setting_key, setting_val FROM settings")
                        for row in cur.fetchall():
                            settings[row["setting_key"]] = row["setting_val"]
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("SELECT setting_key, setting_val FROM settings")
                    for row in cur.fetchall():
                        settings[row[0]] = row[1]
                finally:
                    conn.close()

            auto_enabled = settings.get("autoCloseEnabled", True)
            if str(auto_enabled).lower() == "false":
                return False, None

            close_time_str = str(settings.get("storeCloseTime") or "22:00").strip()
            now_dt = datetime.now()
            today_key = now_dt.strftime("%Y-%m-%d")
            now_hhmm = now_dt.strftime("%H:%M")

            # 2. Lightweight query for past dates with transactions/expenses and existing reports
            candidate_dates = set()
            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("SELECT DISTINCT start_date FROM financial_reports WHERE report_type = 'daily'")
                        closed_daily_keys = {r["start_date"] for r in cur.fetchall()}

                        cur.execute("""
                            SELECT DISTINCT SUBSTRING(date, 1, 10) as dt FROM transactions
                            WHERE COALESCE(status, 'completed') != 'void' AND SUBSTRING(date, 1, 10) < %s
                        """, (today_key,))
                        for r in cur.fetchall():
                            if r["dt"] and r["dt"] not in closed_daily_keys:
                                candidate_dates.add(r["dt"])

                        cur.execute("""
                            SELECT DISTINCT SUBSTRING(date, 1, 10) as dt FROM expenses
                            WHERE SUBSTRING(date, 1, 10) < %s
                        """, (today_key,))
                        for r in cur.fetchall():
                            if r["dt"] and r["dt"] not in closed_daily_keys:
                                candidate_dates.add(r["dt"])
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("SELECT DISTINCT start_date FROM financial_reports WHERE report_type = 'daily'")
                    closed_daily_keys = {r[0] for r in cur.fetchall()}

                    cur.execute("""
                        SELECT DISTINCT substr(date, 1, 10) as dt FROM transactions
                        WHERE COALESCE(status, 'completed') != 'void' AND substr(date, 1, 10) < ?
                    """, (today_key,))
                    for r in cur.fetchall():
                        if r[0] and r[0] not in closed_daily_keys:
                            candidate_dates.add(r[0])

                    cur.execute("""
                        SELECT DISTINCT substr(date, 1, 10) as dt FROM expenses
                        WHERE substr(date, 1, 10) < ?
                    """, (today_key,))
                    for r in cur.fetchall():
                        if r[0] and r[0] not in closed_daily_keys:
                            candidate_dates.add(r[0])
                finally:
                    conn.close()

            # Check if current time has reached storeCloseTime for today
            if len(close_time_str) == 5 and now_hhmm >= close_time_str:
                if today_key not in closed_daily_keys:
                    candidate_dates.add(today_key)

            if not candidate_dates:
                return False, None

            for dk in sorted(candidate_dates):
                self.close_daily_report(target_date=dk, closed_by="Otomatis (Jam Tutup Toko)", force_new_entry=False, return_full_data=False)

            return True, self.get_all()

    def delete_financial_report(self, report_id):
        with self.lock:
            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("DELETE FROM financial_reports WHERE id = %s", (report_id,))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("DELETE FROM financial_reports WHERE id = ?", (report_id,))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
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
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("DELETE FROM discounts WHERE id = ?", (disc_id,))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
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
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()
            else:
                conn = self._get_sqlite_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("UPDATE discounts SET isActive = CASE WHEN isActive = 1 THEN 0 ELSE 1 END WHERE id = ?", (disc_id,))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
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
                    conn.begin()
                    with conn.cursor() as cur:
                        cur.execute("DELETE FROM transaction_items")
                        cur.execute("DELETE FROM transactions")
                        cur.execute("DELETE FROM expenses")
                        cur.execute("DELETE FROM stock_history")
                        cur.execute("DELETE FROM discounts")
                        cur.execute("DELETE FROM financial_reports")
                        cur.execute("DELETE FROM daily_cashbook")
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
                            INSERT INTO products (id, name, barcode, category, costPrice, sellPrice, stock, minStock, unit, image, is_deleted)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """, (p.get("id") or generate_uid("P"), p.get("name", ""), p.get("barcode", ""), p.get("category", "sembako"), p.get("costPrice", 0), p.get("sellPrice", 0), p.get("stock", 0), p.get("minStock", 5), p.get("unit", "pcs"), p.get("image", ""), 1 if p.get("is_deleted") else 0))

                        for d in discounts_data:
                            cur.execute("""
                            INSERT INTO discounts (id, name, code, type, value, minPurchase, maxDiscount, isActive)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """, (d.get("id") or generate_uid("DSC"), d.get("name", ""), d.get("code", ""), d.get("type", "percentage"), d.get("value", 0), d.get("minPurchase", 0), d.get("maxDiscount", 0), 1 if d.get("isActive", True) else 0))

                        for t in transactions_data:
                            t_id = t.get("id") or generate_uid("TRX")
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
                            """, (e.get("id") or generate_uid("EXP"), e.get("date", ""), e.get("category", "Operasional"), e.get("description", ""), e.get("amount", 0), e.get("recordedBy", "Admin")))

                        for s in stock_history_data:
                            cur.execute("""
                            INSERT INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """, (s.get("id") or generate_uid("STK"), s.get("date", ""), s.get("productId", ""), s.get("productName", ""), s.get("type", "in"), s.get("qty", 0), s.get("reason", ""), s.get("user", "Admin")))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
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
                    cur.execute("DELETE FROM financial_reports")
                    cur.execute("DELETE FROM daily_cashbook")
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
                        INSERT OR REPLACE INTO products (id, name, barcode, category, costPrice, sellPrice, stock, minStock, unit, image, is_deleted)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (p.get("id") or generate_uid("P"), p.get("name", ""), p.get("barcode", ""), p.get("category", "sembako"), p.get("costPrice", 0), p.get("sellPrice", 0), p.get("stock", 0), p.get("minStock", 5), p.get("unit", "pcs"), p.get("image", ""), 1 if p.get("is_deleted") else 0))

                    for d in discounts_data:
                        cur.execute("""
                        INSERT OR REPLACE INTO discounts (id, name, code, type, value, minPurchase, maxDiscount, isActive)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (d.get("id") or generate_uid("DSC"), d.get("name", ""), d.get("code", ""), d.get("type", "percentage"), d.get("value", 0), d.get("minPurchase", 0), d.get("maxDiscount", 0), 1 if d.get("isActive", True) else 0))

                    for t in transactions_data:
                        t_id = t.get("id") or generate_uid("TRX")
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
                        """, (e.get("id") or generate_uid("EXP"), e.get("date", ""), e.get("category", "Operasional"), e.get("description", ""), e.get("amount", 0), e.get("recordedBy", "Admin")))

                    for s in stock_history_data:
                        cur.execute("""
                        INSERT OR REPLACE INTO stock_history (id, date, productId, productName, type, qty, reason, user)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (s.get("id") or generate_uid("STK"), s.get("date", ""), s.get("productId", ""), s.get("productName", ""), s.get("type", "in"), s.get("qty", 0), s.get("reason", ""), s.get("user", "Admin")))

                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()

            return self.get_all()

    def reset(self):
        with self.lock:
            if self.driver_type == "mysql":
                conn = self._get_mysql_connection()
                try:
                    conn.begin()
                    with conn.cursor() as cur:
                        cur.execute("DELETE FROM transaction_items")
                        cur.execute("DELETE FROM transactions")
                        cur.execute("DELETE FROM expenses")
                        cur.execute("DELETE FROM stock_history")
                        cur.execute("DELETE FROM discounts")
                        cur.execute("DELETE FROM financial_reports")
                        cur.execute("DELETE FROM daily_cashbook")
                        cur.execute("DELETE FROM products")
                        cur.execute("DELETE FROM categories")
                        cur.execute("DELETE FROM settings")
                    conn.commit()
                    self._seed_if_empty_mysql()
                except Exception:
                    conn.rollback()
                    raise
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
                    cur.execute("DELETE FROM financial_reports")
                    cur.execute("DELETE FROM daily_cashbook")
                    cur.execute("DELETE FROM products")
                    cur.execute("DELETE FROM categories")
                    cur.execute("DELETE FROM settings")
                    conn.commit()
                    self._seed_if_empty_sqlite()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()
            return self.get_all()
