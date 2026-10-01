#!/usr/bin/env python3
"""
WarungKu POS - Realtime Backend Server & Synchronization Engine
Menyediakan REST API & Server-Sent Events (SSE) agar data transaksi kasir,
pengurangan stok, dan laporan keuangan tersinkronisasi secara REALTIME antara PC & HP.
"""

import http.server
import socketserver
import socket
import webbrowser
import os
import sys
import json
import threading
import queue
import time
from urllib.parse import urlparse, parse_qs

from db_adapter import DatabaseEngine

PORT = 3000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

# Initialize Relational Database Engine (MySQL / SQLite)
db = DatabaseEngine(BASE_DIR)

# Event Manager for Server-Sent Events (SSE) Realtime Broadcast
class EventManager:
    def __init__(self):
        self.clients = []
        self.lock = threading.Lock()

    def add_client(self, q):
        with self.lock:
            self.clients.append(q)

    def remove_client(self, q):
        with self.lock:
            if q in self.clients:
                self.clients.remove(q)

    def broadcast(self, event_type, payload):
        msg = json.dumps({"type": event_type, "data": payload})
        with self.lock:
            for q in list(self.clients):
                try:
                    q.put_nowait(msg)
                except Exception:
                    pass

events = EventManager()

class RealtimePOSHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # 1. SSE Realtime Stream Endpoint
        if path == "/api/events":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            q = queue.Queue(maxsize=100)
            events.add_client(q)
            try:
                # Send immediate connection ack with current database state
                current_state = db.get_all()
                init_msg = json.dumps({"type": "init", "data": current_state})
                self.wfile.write(f"data: {init_msg}\n\n".encode("utf-8"))
                self.wfile.flush()

                while True:
                    try:
                        msg = q.get(timeout=15)
                        self.wfile.write(f"data: {msg}\n\n".encode("utf-8"))
                        self.wfile.flush()
                    except queue.Empty:
                        # Heartbeat ping
                        self.wfile.write(b": ping\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                events.remove_client(q)
            return

        # 2. REST API: Get All Data
        if path == "/api/data":
            self.send_json(db.get_all())
            return

        # Default static file handler
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            payload = json.loads(body)
        except Exception:
            payload = {}

        # 1. Checkout (Kasir Transaksi Baru)
        if path == "/api/checkout":
            updated_data = db.process_checkout(payload)
            events.broadcast("checkout", {
                "transaction": payload,
                "fullData": updated_data
            })
            self.send_json({"success": True, "transaction": payload})
            return

        # 2. Add / Edit Product
        if path == "/api/products":
            updated_data = db.save_product(payload)
            events.broadcast("product_update", {
                "product": payload,
                "fullData": updated_data
            })
            self.send_json({"success": True, "data": updated_data})
            return

        # 3. Stock In / Stock Out Mutation
        if path == "/api/stock":
            updated_data = db.adjust_stock(payload)
            events.broadcast("stock_update", {
                "mutation": payload,
                "fullData": updated_data
            })
            self.send_json({"success": True, "data": updated_data})
            return

        # 4. Add Expense
        if path == "/api/expenses":
            updated_data = db.add_expense(payload)
            events.broadcast("expense_update", {
                "expense": payload,
                "fullData": updated_data
            })
            self.send_json({"success": True, "data": updated_data})
            return

        # 5. Update Settings
        if path == "/api/settings":
            updated_data = db.update_settings(payload)
            events.broadcast("settings_update", {
                "settings": payload,
                "fullData": updated_data
            })
            self.send_json({"success": True, "data": updated_data})
            return

        # 6. Import Full Database
        if path == "/api/import":
            updated_data = db.import_database(payload)
            events.broadcast("db_sync", {
                "fullData": updated_data
            })
            self.send_json({"success": True, "data": updated_data})
            return

        # 7. Reset Database
        if path == "/api/reset":
            updated_data = db.reset()
            events.broadcast("db_sync", {
                "fullData": updated_data
            })
            self.send_json({"success": True, "data": updated_data})
            return

        self.send_json({"error": "Endpoint not found"}, status=404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # Delete Product
        if path == "/api/products":
            prod_id = query.get("id", [None])[0]
            if prod_id:
                updated_data = db.delete_product(prod_id)
                events.broadcast("product_delete", {
                    "id": prod_id,
                    "fullData": updated_data
                })
                self.send_json({"success": True, "data": updated_data})
                return
            self.send_json({"error": "Missing product ID"}, status=400)
            return

        # Delete Expense
        if path == "/api/expenses":
            exp_id = query.get("id", [None])[0]
            if exp_id:
                updated_data = db.delete_expense(exp_id)
                events.broadcast("expense_delete", {
                    "id": exp_id,
                    "fullData": updated_data
                })
                self.send_json({"success": True, "data": updated_data})
                return
            self.send_json({"error": "Missing expense ID"}, status=400)
            return

        self.send_json({"error": "Endpoint not found"}, status=404)

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    local_ip = get_ip()

    print("=" * 65)
    print("  🚀 WARUNGKU POS - REALTIME BACKEND SERVER BERHASIL AKTIF! 🚀")
    print("=" * 65)
    db_name = "MySQL / MariaDB" if db.driver_type == "mysql" else "SQLite Relational Database"
    print(f"🗄️  Database Engine : {db_name}")
    print(f"📄  Schema SQL      : schema.sql (Bisa diimpor ke phpMyAdmin)")
    print(f"⚙️  Konfigurasi DB  : db_config.json")
    print("-" * 65)
    print(f"💻 Buka di PC / Laptop Ini (Admin / Kasir):")
    print(f"   👉 http://localhost:{PORT}")
    print(f"\n📱 Buka di HP Android / iPhone (Kasir / Admin Realtime):")
    print(f"   👉 http://{local_ip}:{PORT}")
    print("-" * 65)
    print("⚡ Sinkronisasi Realtime (SSE):")
    print(f"   Setiap transaksi di Kasir HP langsung update stok, laba,")
    print(f"   dan omset di PC Admin secara LIVE tanpa perlu refresh!")
    print("=" * 65)
    print("Tekan Ctrl + C untuk menghentikan server.\n")

    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), RealtimePOSHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer dihentikan.")
            sys.exit(0)

if __name__ == '__main__':
    main()
