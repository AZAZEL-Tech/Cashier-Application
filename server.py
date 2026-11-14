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
import secrets
from urllib.parse import urlparse, parse_qs

from db_adapter import DatabaseEngine
from escpos_printer import build_escpos_receipt, list_windows_printers, send_raw_to_windows_printer

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

# Server-Side Session & Role-Based Access Control (RBAC) Manager
class SessionManager:
    SESSION_TTL_SECONDS = 86400 * 7  # 7 days

    def __init__(self):
        self.sessions = {}
        self.lock = threading.Lock()

    def create_session(self, role, cashier_name="Kasir 1"):
        token = secrets.token_urlsafe(32)
        now = time.time()
        session_data = {
            "token": token,
            "role": role,
            "cashierName": cashier_name or ("Admin" if role == "admin" else "Kasir 1"),
            "createdAt": now,
            "expiresAt": now + self.SESSION_TTL_SECONDS
        }
        with self.lock:
            self._cleanup_expired_unlocked(now)
            self.sessions[token] = session_data
        return session_data

    def get_session(self, token):
        if not token:
            return None
        now = time.time()
        with self.lock:
            sess = self.sessions.get(token)
            if not sess:
                return None
            if sess["expiresAt"] < now:
                self.sessions.pop(token, None)
                return None
            return dict(sess)

    def revoke_session(self, token):
        if not token:
            return
        with self.lock:
            self.sessions.pop(token, None)

    def _cleanup_expired_unlocked(self, now):
        expired = [k for k, v in self.sessions.items() if v["expiresAt"] < now]
        for k in expired:
            self.sessions.pop(k, None)

sessions = SessionManager()

class RealtimePOSHandler(http.server.SimpleHTTPRequestHandler):
    def _send_cors_headers(self):
        origin = self.headers.get("Origin")
        host = self.headers.get("Host", f"localhost:{PORT}")
        if origin:
            parsed_origin = urlparse(origin)
            origin_host = parsed_origin.netloc
            if origin_host == host or parsed_origin.hostname in ("localhost", "127.0.0.1") or (parsed_origin.hostname and parsed_origin.hostname.startswith(("192.168.", "10.", "172."))):
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def _get_auth_session(self, query_params=None):
        auth_header = self.headers.get("Authorization", "")
        token = None
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:].strip()
        elif query_params and "token" in query_params:
            token = query_params.get("token", [None])[0]
        return sessions.get_session(token)

    def _require_auth(self, allowed_roles=("cashier", "admin"), query_params=None):
        sess = self._get_auth_session(query_params=query_params)
        if not sess:
            self.send_json({"error": "Unauthorized: Sesi login diperlukan. Silakan login terlebih dahulu."}, status=401)
            return None
        if sess.get("role") not in allowed_roles:
            self.send_json({"error": "Forbidden: Akses ditolak. Hanya Admin yang diizinkan melakukan aksi ini."}, status=403)
            return None
        return sess

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._send_cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # 0. Check Current Session Status
        if path == "/api/auth/session":
            sess = self._get_auth_session(query_params=query)
            if not sess:
                self.send_json({"authenticated": False}, status=401)
                return
            self.send_json({
                "authenticated": True,
                "role": sess["role"],
                "cashierName": sess["cashierName"]
            })
            return

        # 1. SSE Realtime Stream Endpoint (Requires Auth)
        if path == "/api/events":
            sess = self._require_auth(allowed_roles=("cashier", "admin"), query_params=query)
            if not sess:
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self._send_cors_headers()
            self.end_headers()

            q = queue.Queue(maxsize=100)
            events.add_client(q)
            try:
                # Send immediate connection ack with current database state (secrets stripped)
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
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
                pass
            finally:
                events.remove_client(q)
            return

        # 2. REST API: Get All Data (Requires Auth)
        if path == "/api/data":
            sess = self._require_auth(allowed_roles=("cashier", "admin"), query_params=query)
            if not sess:
                return
            self.send_json(db.get_all())
            return

        # 3. REST API: Get Installed Windows Thermal Printers
        if path == "/api/printers":
            sess = self._require_auth(allowed_roles=("cashier", "admin"), query_params=query)
            if not sess:
                return
            self.send_json(list_windows_printers())
            return

        # Prevent direct download of database/config files via static file handler
        if path.startswith("/data/") or path.endswith((".py", ".sqlite", ".db", ".sql")):
            self.send_json({"error": "Forbidden"}, status=403)
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

        # 0A. Auth Login Endpoint (Public)
        if path == "/api/auth/login":
            role = (payload.get("role") or "cashier").strip().lower()
            secret = payload.get("password") if "password" in payload else payload.get("secret", "")
            cashier_name = (payload.get("cashierName") or ("Admin" if role == "admin" else "Kasir 1")).strip()

            if role not in ("cashier", "admin"):
                self.send_json({"error": "Role tidak valid."}, status=400)
                return

            if not db.verify_credentials(role, secret):
                err_msg = "Password Admin salah!" if role == "admin" else "PIN Kasir salah!"
                self.send_json({"error": err_msg}, status=401)
                return

            sess = sessions.create_session(role=role, cashier_name=cashier_name)
            self.send_json({
                "success": True,
                "token": sess["token"],
                "role": sess["role"],
                "cashierName": sess["cashierName"],
                "data": db.get_all()
            })
            return

        # 0B. Auth Logout Endpoint
        if path == "/api/auth/logout":
            auth_header = self.headers.get("Authorization", "")
            if auth_header.lower().startswith("bearer "):
                sessions.revoke_session(auth_header[7:].strip())
            self.send_json({"success": True})
            return

        # 1. Checkout (Kasir Transaksi Baru - Accessible by Cashier & Admin)
        if path == "/api/checkout":
            sess = self._require_auth(allowed_roles=("cashier", "admin"))
            if not sess:
                return
            try:
                if not payload.get("cashier"):
                    payload["cashier"] = sess.get("cashierName", "Kasir 1")
                updated_data = db.process_checkout(payload)
            except ValueError as e:
                self.send_json({"error": str(e)}, status=400)
                return
            except Exception as e:
                self.send_json({"error": f"Gagal memproses transaksi: {str(e)}"}, status=500)
                return

            events.broadcast("checkout", {
                "transaction": payload,
                "fullData": updated_data
            })
            self.send_json({"success": True, "transaction": payload, "data": updated_data})
            return

        # 1B. Direct ESC/POS Thermal Receipt Print (Accessible by Cashier & Admin)
        if path == "/api/print":
            sess = self._require_auth(allowed_roles=("cashier", "admin"))
            if not sess:
                return
            trx = payload.get("transaction") or payload
            printer_name = (payload.get("printerName") or "").strip() or None
            state = db.get_all()
            settings = state.get("settings", {})
            if not printer_name:
                printer_name = (settings.get("printerName") or "").strip() or None
            paper_size = settings.get("paperSize", "58mm")
            try:
                raw_bytes = build_escpos_receipt(trx, settings=settings, paper_size=paper_size)
                result = send_raw_to_windows_printer(printer_name, raw_bytes)
                self.send_json(result)
            except Exception as e:
                self.send_json({"success": False, "error": str(e)}, status=400)
            return

        # All endpoints below require ADMIN role
        sess = self._require_auth(allowed_roles=("admin",))
        if not sess:
            return

        # 2. Add / Edit Product (Admin Only)
        if path == "/api/products":
            updated_data = db.save_product(payload)
            events.broadcast("product_update", {
                "product": payload,
                "fullData": updated_data
            })
            self.send_json({"success": True, "data": updated_data})
            return

        # 3. Stock In / Stock Out Mutation (Admin Only)
        if path == "/api/stock":
            updated_data = db.adjust_stock(payload)
            events.broadcast("stock_update", {
                "mutation": payload,
                "fullData": updated_data
            })
            self.send_json({"success": True, "data": updated_data})
            return

        # 4. Add Expense (Admin Only)
        if path == "/api/expenses":
            updated_data = db.add_expense(payload)
            events.broadcast("expense_update", {
                "expense": payload,
                "fullData": updated_data
            })
            self.send_json({"success": True, "data": updated_data})
            return

        # 5. Add / Edit Discount Promo (Admin Only)
        if path == "/api/discounts":
            updated_data = db.save_discount(payload)
            events.broadcast("discount_update", {
                "discount": payload,
                "fullData": updated_data
            })
            self.send_json({"success": True, "data": updated_data})
            return

        # 6. Toggle Discount Active Status (Admin Only)
        if path == "/api/discounts/toggle":
            disc_id = payload.get("id")
            if disc_id:
                updated_data = db.toggle_discount(disc_id)
                events.broadcast("discount_update", {
                    "id": disc_id,
                    "fullData": updated_data
                })
                self.send_json({"success": True, "data": updated_data})
                return
            self.send_json({"error": "Missing discount ID"}, status=400)
            return

        # 7. Void Transaction with Audit Trail (Admin Only)
        if path == "/api/transactions/void":
            trx_id = payload.get("id")
            reason = payload.get("reason", "Dibatalkan oleh Admin")
            if trx_id:
                updated_data = db.void_transaction(trx_id, reason=reason, user=sess.get("cashierName", "Admin"))
                events.broadcast("transaction_void", {
                    "id": trx_id,
                    "reason": reason,
                    "fullData": updated_data
                })
                self.send_json({"success": True, "data": updated_data})
                return
            self.send_json({"error": "Missing transaction ID"}, status=400)
            return

        # 8. Update Settings (Admin Only)
        if path == "/api/settings":
            updated_data = db.update_settings(payload)
            events.broadcast("settings_update", {
                "settings": updated_data.get("settings", {}),
                "fullData": updated_data
            })
            self.send_json({"success": True, "data": updated_data})
            return

        # 9. Import Full Database (Admin Only)
        if path == "/api/import":
            updated_data = db.import_database(payload)
            events.broadcast("db_sync", {
                "fullData": updated_data
            })
            self.send_json({"success": True, "data": updated_data})
            return

        # 10. Reset Database (Admin Only)
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

        # All DELETE operations require ADMIN role
        sess = self._require_auth(allowed_roles=("admin",), query_params=query)
        if not sess:
            return

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

        # Delete Discount Promo
        if path == "/api/discounts":
            disc_id = query.get("id", [None])[0]
            if disc_id:
                updated_data = db.delete_discount(disc_id)
                events.broadcast("discount_delete", {
                    "id": disc_id,
                    "fullData": updated_data
                })
                self.send_json({"success": True, "data": updated_data})
                return
            self.send_json({"error": "Missing discount ID"}, status=400)
            return

        # Void Transaction (Audit Trail - preserves record with status='void' and restores stock)
        if path == "/api/transactions":
            trx_id = query.get("id", [None])[0]
            reason = query.get("reason", ["Dibatalkan oleh Admin"])[0]
            if trx_id:
                updated_data = db.void_transaction(trx_id, reason=reason, user=sess.get("cashierName", "Admin"))
                events.broadcast("transaction_void", {
                    "id": trx_id,
                    "reason": reason,
                    "fullData": updated_data
                })
                self.send_json({"success": True, "data": updated_data})
                return
            self.send_json({"error": "Missing transaction ID"}, status=400)
            return

        self.send_json({"error": "Endpoint not found"}, status=404)

def _cleanup_stale_port_listeners(port):
    """Ensure no stale zombie process is holding the port on Windows before binding."""
    if os.name != "nt":
        return
    try:
        import subprocess
        out = subprocess.check_output(["netstat", "-ano"], text=True, errors="ignore")
        my_pid = str(os.getpid())
        pids_to_kill = set()
        for line in out.splitlines():
            if f":{port} " in line and "LISTENING" in line:
                parts = line.split()
                if parts:
                    pid = parts[-1]
                    if pid.isdigit() and pid != "0" and pid != my_pid:
                        pids_to_kill.add(pid)
        for pid in pids_to_kill:
            subprocess.run(["taskkill", "/F", "/PID", pid], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if pids_to_kill:
            time.sleep(0.5)
    except Exception:
        pass


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = (os.name != "nt")


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    _cleanup_stale_port_listeners(PORT)
    local_ip = get_ip()

    with ThreadingHTTPServer(("0.0.0.0", PORT), RealtimePOSHandler) as httpd:
        print("=" * 65, flush=True)
        print("  🚀 WARUNGKU POS - REALTIME BACKEND SERVER BERHASIL AKTIF! 🚀", flush=True)
        print("=" * 65, flush=True)
        db_name = "MySQL / MariaDB" if db.driver_type == "mysql" else "SQLite Relational Database"
        print(f"🗄️  Database Engine : {db_name}", flush=True)
        print(f"📄  Schema SQL      : schema.sql (Bisa diimpor ke phpMyAdmin)", flush=True)
        print(f"⚙️  Konfigurasi DB  : db_config.json", flush=True)
        print("-" * 65, flush=True)
        print(f"💻 Buka di PC / Laptop Ini (Admin / Kasir):", flush=True)
        print(f"   👉 http://localhost:{PORT}", flush=True)
        print(f"   👉 http://127.0.0.1:{PORT}", flush=True)
        print(f"\n📱 Buka di HP Android / iPhone / PC Lain (Wi-Fi Sama):", flush=True)
        print(f"   👉 http://{local_ip}:{PORT}", flush=True)
        print("-" * 65, flush=True)
        print("⚡ Sinkronisasi Realtime (SSE):", flush=True)
        print(f"   Setiap transaksi di Kasir HP langsung update stok, laba,", flush=True)
        print(f"   dan omset di PC Admin secara LIVE tanpa perlu refresh!", flush=True)
        print("=" * 65, flush=True)
        print("Tekan Ctrl + C untuk menghentikan server.\n", flush=True)

        if "--no-browser" not in sys.argv:
            threading.Timer(0.8, lambda: webbrowser.open(f"http://127.0.0.1:{PORT}")).start()

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer dihentikan.", flush=True)
            sys.exit(0)

if __name__ == '__main__':
    main()
