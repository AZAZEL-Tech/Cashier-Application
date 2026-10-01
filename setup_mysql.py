#!/usr/bin/env python3
"""
WarungKu POS - Quick MySQL Database Setup & Import Tool
Mengimpor schema.sql secara otomatis ke server MySQL / MariaDB / phpMyAdmin.
"""

import os
import sys
import json
import re

LIB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib")
if os.path.exists(LIB_DIR) and LIB_DIR not in sys.path:
    sys.path.insert(0, LIB_DIR)

try:
    import pymysql
except ImportError:
    print("❌ Error: Driver PyMySQL tidak ditemukan di folder lib/.")
    sys.exit(1)

def run_setup():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    config_file = os.path.join(base_dir, "db_config.json")
    schema_file = os.path.join(base_dir, "schema.sql")

    if not os.path.exists(config_file):
        print("❌ Error: File db_config.json tidak ditemukan.")
        return

    with open(config_file, "r", encoding="utf-8") as f:
        config = json.load(f).get("mysql", {})

    host = config.get("host", "localhost")
    port = int(config.get("port", 3306))
    user = config.get("user", "root")
    password = config.get("password", "")
    db_name = config.get("database", "warungku_pos")

    print("=" * 60)
    print("  🚀 SETUP & IMPORT DATABASE MYSQL WARUNGKU POS 🚀")
    print("=" * 60)
    print(f"Target Host    : {host}:{port}")
    print(f"Target User    : {user}")
    print(f"Target Database: {db_name}")
    print("-" * 60)

    try:
        print(f"Menghubungkan ke MySQL Server {host}:{port}...")
        conn = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            charset='utf8mb4',
            autocommit=True
        )
        print("✅ Terhubung ke MySQL Server!")

        with conn.cursor() as cur:
            print(f"Membuat database `{db_name}` jika belum ada...")
            cur.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            cur.execute(f"USE `{db_name}`")
            print(f"✅ Database `{db_name}` siap!")

            print(f"Membaca file {schema_file}...")
            with open(schema_file, "r", encoding="utf-8") as sf:
                sql_content = sf.read()

            # Clean comments
            clean_lines = []
            for line in sql_content.splitlines():
                stripped = line.strip()
                if stripped.startswith("--") or stripped.startswith("/*"):
                    continue
                clean_lines.append(line)
            clean_sql = "\n".join(clean_lines)

            # Split statements by semicolon
            statements = [s.strip() for s in clean_sql.split(";") if s.strip()]
            for stmt in statements:
                if not stmt or stmt.upper().startswith("USE "):
                    continue
                cur.execute(stmt)

        conn.close()
        print("=" * 60)
        print("🎉 BERHASIL! Seluruh tabel & data awal telah dimasukkan ke MySQL.")
        print(f"Tabel: settings, categories, products, transactions, expenses, stock_history.")
        print("Aplikasi siap digunakan dengan database MySQL!")
        print("=" * 60)

    except pymysql.MySQLError as e:
        print("❌ Gagal terhubung / import ke MySQL:")
        print(f"   {e}")
        print("\n💡 Tips:")
        print("1. Pastikan service MySQL / MariaDB / XAMPP sudah berjalan (Start).")
        print("2. Sesuaikan user & password di file 'db_config.json'.")

if __name__ == "__main__":
    run_setup()
