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

PORT = 3000
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DB_FILE = os.path.join(DATA_DIR, "pos_database.json")

# Ensure data directory exists
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

# Default Seed Data
DEFAULT_DATABASE = {
    "settings": {
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
    },
    "categories": [
        { "id": "all", "name": "Semua Produk", "icon": "layout-grid" },
        { "id": "sembako", "name": "Sembako", "icon": "wheat" },
        { "id": "minuman", "name": "Minuman", "icon": "cup-soda" },
        { "id": "makanan", "name": "Makanan & Mie", "icon": "utensils" },
        { "id": "snack", "name": "Snack & Jajanan", "icon": "cookie" },
        { "id": "rokok", "name": "Rokok", "icon": "flame" },
        { "id": "kebersihan", "name": "Sabun & Cuci", "icon": "sparkles" },
        { "id": "lainnya", "name": "Lain-lain", "icon": "package" }
    ],
    "products": [
        {
            "id": "P001",
            "name": "Beras Rojolele 5kg",
            "barcode": "8991001",
            "category": "sembako",
            "costPrice": 65000,
            "sellPrice": 75000,
            "stock": 24,
            "minStock": 5,
            "unit": "sak",
            "image": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=60"
        },
        {
            "id": "P002",
            "name": "Minyak Goreng Bimoli 2L",
            "barcode": "8991002",
            "category": "sembako",
            "costPrice": 32000,
            "sellPrice": 37000,
            "stock": 18,
            "minStock": 5,
            "unit": "pouch",
            "image": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=60"
        },
        {
            "id": "P003",
            "name": "Gula Pasir Gulaku 1kg",
            "barcode": "8991003",
            "category": "sembako",
            "costPrice": 15500,
            "sellPrice": 18000,
            "stock": 35,
            "minStock": 10,
            "unit": "kg",
            "image": "https://images.unsplash.com/photo-1622484216805-4c07914fa679?w=400&auto=format&fit=crop&q=60"
        },
        {
            "id": "P004",
            "name": "Telur Ayam 1kg",
            "barcode": "8991004",
            "category": "sembako",
            "costPrice": 26000,
            "sellPrice": 29000,
            "stock": 40,
            "minStock": 8,
            "unit": "kg",
            "image": "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&auto=format&fit=crop&q=60"
        },
        {
            "id": "P005",
            "name": "Indomie Goreng Original",
            "barcode": "8991005",
            "category": "makanan",
            "costPrice": 2700,
            "sellPrice": 3500,
            "stock": 120,
            "minStock": 20,
            "unit": "bks",
            "image": "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&auto=format&fit=crop&q=60"
        },
        {
            "id": "P006",
            "name": "Indomie Kuah Ayam Bawang",
            "barcode": "8991006",
            "category": "makanan",
            "costPrice": 2700,
            "sellPrice": 3500,
            "stock": 80,
            "minStock": 15,
            "unit": "bks",
            "image": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop&q=60"
        },
        {
            "id": "P007",
            "name": "Teh Pucuk Harum 350ml",
            "barcode": "8991007",
            "category": "minuman",
            "costPrice": 3000,
            "sellPrice": 4000,
            "stock": 48,
            "minStock": 12,
            "unit": "btl",
            "image": "https://images.unsplash.com/photo-1556881286-fc6915169721?w=400&auto=format&fit=crop&q=60"
        },
        {
            "id": "P008",
            "name": "Aqua Botol 600ml",
            "barcode": "8991008",
            "category": "minuman",
            "costPrice": 2500,
            "sellPrice": 3500,
            "stock": 60,
            "minStock": 12,
            "unit": "btl",
            "image": "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&auto=format&fit=crop&q=60"
        },
        {
            "id": "P009",
            "name": "Kopi Kapal Api Spesial Mix",
            "barcode": "8991009",
            "category": "minuman",
            "costPrice": 1500,
            "sellPrice": 2000,
            "stock": 90,
            "minStock": 15,
            "unit": "sachet",
            "image": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=60"
        },
        {
            "id": "P010",
            "name": "Chitato Sapi Panggang 68g",
            "barcode": "8991010",
            "category": "snack",
            "costPrice": 9500,
            "sellPrice": 12000,
            "stock": 25,
            "minStock": 5,
            "unit": "bks",
            "image": "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&auto=format&fit=crop&q=60"
        },
        {
            "id": "P011",
            "name": "Oreo Vanilla 133g",
            "barcode": "8991011",
            "category": "snack",
            "costPrice": 8000,
            "sellPrice": 10000,
            "stock": 30,
            "minStock": 6,
            "unit": "pack",
            "image": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=60"
        },
        {
            "id": "P012",
            "name": "Sampoerna Mild 16",
            "barcode": "8991012",
            "category": "rokok",
            "costPrice": 31000,
            "sellPrice": 34000,
            "stock": 3,
            "minStock": 10,
            "unit": "bks",
            "image": "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=60"
        },
        {
            "id": "P013",
            "name": "Gudang Garam Surya 12",
            "barcode": "8991013",
            "category": "rokok",
            "costPrice": 24000,
            "sellPrice": 27000,
            "stock": 2,
            "minStock": 10,
            "unit": "bks",
            "image": "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=60"
        },
        {
            "id": "P014",
            "name": "Sunlight Pencuci Piring 700ml",
            "barcode": "8991014",
            "category": "kebersihan",
            "costPrice": 13000,
            "sellPrice": 16000,
            "stock": 15,
            "minStock": 4,
            "unit": "pouch",
            "image": "https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?w=400&auto=format&fit=crop&q=60"
        },
        {
            "id": "P015",
            "name": "Rinso Anti Noda 770g",
            "barcode": "8991015",
            "category": "kebersihan",
            "costPrice": 20000,
            "sellPrice": 24500,
            "stock": 12,
            "minStock": 4,
            "unit": "bks",
            "image": "https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?w=400&auto=format&fit=crop&q=60"
        }
    ],
    "transactions": [
        {
            "id": "TRX-DEMO-001",
            "date": "2026-09-30T01:30:00.000Z",
            "cashier": "Kasir 1",
            "customerName": "Umum",
            "items": [
                { "id": "P001", "name": "Beras Rojolele 5kg", "qty": 1, "costPrice": 65000, "sellPrice": 75000, "subtotal": 75000 },
                { "id": "P002", "name": "Minyak Goreng Bimoli 2L", "qty": 1, "costPrice": 32000, "sellPrice": 37000, "subtotal": 37000 }
            ],
            "subtotal": 112000,
            "discount": 0,
            "tax": 0,
            "total": 112000,
            "totalCost": 97000,
            "profit": 15000,
            "paymentMethod": "cash",
            "amountPaid": 120000,
            "change": 8000,
            "status": "completed"
        }
    ],
    "expenses": [
        {
            "id": "EXP-001",
            "date": "2026-09-29T08:00:00.000Z",
            "category": "Stok Barang",
            "description": "Restock Beras & Minyak Goreng Agen Utama",
            "amount": 550000,
            "recordedBy": "Admin"
        },
        {
            "id": "EXP-002",
            "date": "2026-09-30T02:00:00.000Z",
            "category": "Operasional",
            "description": "Plastik Kantong & Kertas Struk 58mm",
            "amount": 45000,
            "recordedBy": "Admin"
        }
    ],
    "stockHistory": [
        {
            "id": "STK-001",
            "date": "2026-09-29T08:00:00.000Z",
            "productId": "P001",
            "productName": "Beras Rojolele 5kg",
            "type": "in",
            "qty": 30,
            "reason": "Restock Supplier PT Beras Nusantara",
            "user": "Admin"
        }
    ]
}

class DatabaseManager:
    def __init__(self, filepath):
        self.filepath = filepath
        self.lock = threading.Lock()
        self.data = self._load()

    def _load(self):
        if not os.path.exists(self.filepath):
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_DATABASE, f, indent=2, ensure_ascii=False)
            return json.loads(json.dumps(DEFAULT_DATABASE))
        try:
            with open(self.filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print("Error loading DB, restoring default:", e)
            return json.loads(json.dumps(DEFAULT_DATABASE))

    def save(self):
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(self.data, f, indent=2, ensure_ascii=False)

    def get_all(self):
        with self.lock:
            return json.loads(json.dumps(self.data))

    def reset(self):
        with self.lock:
            self.data = json.loads(json.dumps(DEFAULT_DATABASE))
            self.save()
            return self.data

    def process_checkout(self, trx):
        with self.lock:
            # 1. Deduct stock and record stock mutation
            items = trx.get("items", [])
            cashier = trx.get("cashier", "Kasir 1")
            trx_id = trx.get("id")

            for item in items:
                prod_id = item.get("id")
                qty = item.get("qty", 1)
                for p in self.data["products"]:
                    if p["id"] == prod_id:
                        p["stock"] = max(0, p.get("stock", 0) - qty)
                        self.data["stockHistory"].insert(0, {
                            "id": f"STK-{int(time.time()*1000)}",
                            "date": trx.get("date"),
                            "productId": p["id"],
                            "productName": p["name"],
                            "type": "out",
                            "qty": qty,
                            "reason": f"Penjualan #{trx_id}",
                            "user": cashier
                        })
                        break

            # 2. Add transaction to beginning of list
            self.data["transactions"].insert(0, trx)
            self.save()
            return self.data

    def save_product(self, product):
        with self.lock:
            prod_id = product.get("id")
            found = False
            if prod_id:
                for idx, p in enumerate(self.data["products"]):
                    if p["id"] == prod_id:
                        self.data["products"][idx] = product
                        found = True
                        break
            if not found:
                if not prod_id:
                    prod_id = f"P{str(int(time.time()*1000))[-6:]}"
                    product["id"] = prod_id
                self.data["products"].insert(0, product)
                if product.get("stock", 0) > 0:
                    self.data["stockHistory"].insert(0, {
                        "id": f"STK-{int(time.time()*1000)}",
                        "date": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        "productId": product["id"],
                        "productName": product["name"],
                        "type": "in",
                        "qty": product.get("stock", 0),
                        "reason": "Stok Awal Produk Baru",
                        "user": "Admin"
                    })
            self.save()
            return self.data

    def delete_product(self, prod_id):
        with self.lock:
            self.data["products"] = [p for p in self.data["products"] if p["id"] != prod_id]
            self.save()
            return self.data

    def adjust_stock(self, payload):
        with self.lock:
            prod_id = payload.get("productId")
            qty = abs(int(payload.get("qty", 0)))
            mutation_type = payload.get("type", "in")
            reason = payload.get("reason", "")
            record_expense = payload.get("recordExpense", False)
            user = payload.get("user", "Admin")

            target_product = None
            for p in self.data["products"]:
                if p["id"] == prod_id:
                    target_product = p
                    if mutation_type == "in":
                        p["stock"] = p.get("stock", 0) + qty
                    else:
                        p["stock"] = max(0, p.get("stock", 0) - qty)
                    break

            if target_product:
                self.data["stockHistory"].insert(0, {
                    "id": f"STK-{int(time.time()*1000)}",
                    "date": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "productId": target_product["id"],
                    "productName": target_product["name"],
                    "type": mutation_type,
                    "qty": qty,
                    "reason": reason or ("Restock Barang Masuk" if mutation_type == "in" else "Penyesuaian Stok"),
                    "user": user
                })

                if mutation_type == "in" and record_expense:
                    cost = target_product.get("costPrice", 0) * qty
                    self.data["expenses"].insert(0, {
                        "id": f"EXP-{str(int(time.time()*1000))[-6:]}",
                        "date": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        "category": "Stok Barang",
                        "description": f"Restock {qty} {target_product.get('unit','pcs')} {target_product['name']}",
                        "amount": cost,
                        "recordedBy": user
                    })

            self.save()
            return self.data

    def add_expense(self, expense):
        with self.lock:
            if not expense.get("id"):
                expense["id"] = f"EXP-{str(int(time.time()*1000))[-6:]}"
            if not expense.get("date"):
                expense["date"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
            self.data["expenses"].insert(0, expense)
            self.save()
            return self.data

    def delete_expense(self, exp_id):
        with self.lock:
            self.data["expenses"] = [e for e in self.data["expenses"] if e["id"] != exp_id]
            self.save()
            return self.data

    def update_settings(self, new_settings):
        with self.lock:
            self.data["settings"].update(new_settings)
            self.save()
            return self.data

    def import_database(self, full_db):
        with self.lock:
            for key in ["settings", "categories", "products", "transactions", "expenses", "stockHistory"]:
                if key in full_db:
                    self.data[key] = full_db[key]
            self.save()
            return self.data

db = DatabaseManager(DB_FILE)

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
    print(f"\n💻 Buka di PC / Laptop Ini (Admin / Kasir):")
    print(f"   👉 http://localhost:{PORT}")
    print(f"\n📱 Buka di HP Android / iPhone (Kasir / Admin Realtime):")
    print(f"   👉 http://{local_ip}:{PORT}")
    print("\n⚡ Sinkronisasi Realtime (SSE):")
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
