#!/usr/bin/env python3
"""
WarungKu POS - Realtime Backend Server & Synchronization Engine
Menyediakan REST API & Server-Sent Events (SSE) dengan:
- Persistent Session Management (data/sessions.json)
- Brute-Force Login Rate Limiting
- Strict RFC-1918 Private Network CORS Validation
- Cookie-Authenticated SSE (Tanpa Bocor Token di URL Log)
- Safe Port Listener Cleanup (Khusus Proses Python WarungKu)
"""

import http.server
import socketserver
import socket
import webbrowser
import os
import re
import sys
import json
import threading
import queue
import time
import secrets
import ipaddress
from http.cookies import SimpleCookie
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
        s.connect(("10.255.255.255", 1))
        ip_addr = s.getsockname()[0]
    except Exception:
        ip_addr = "127.0.0.1"
    finally:
        s.close()
    return ip_addr


def is_allowed_lan_or_local_host(hostname):
    """
    Strictly validate whether hostname is localhost or an RFC-1918 private LAN IP
    (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, ::1).
    Prevents public 172.x.x.x (e.g. 172.64.x.x / 172.217.x.x) from passing CORS!
    """
    if not hostname:
        return False
    clean_host = hostname.strip().lower()
    if clean_host == "localhost" or clean_host.endswith(".local"):
        return True
    try:
        ip_obj = ipaddress.ip_address(clean_host)
        return bool(ip_obj.is_loopback or ip_obj.is_private or ip_obj.is_link_local)
    except ValueError:
        return False


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


# Persistent Server-Side Session & Role-Based Access Control (RBAC) Manager
class SessionManager:
    SESSION_TTL_SECONDS = 86400 * 7  # 7 days

    def __init__(self, storage_path):
        self.storage_path = storage_path
        self.sessions = {}
        self.lock = threading.Lock()
        self._load_from_disk()

    def _load_from_disk(self):
        if not os.path.exists(self.storage_path):
            return
        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, dict):
                now = time.time()
                self.sessions = {
                    k: v for k, v in raw.items()
                    if isinstance(v, dict) and v.get("expiresAt", 0) > now
                }
        except Exception:
            self.sessions = {}

    def _save_to_disk_unlocked(self):
        try:
            tmp_path = self.storage_path + ".tmp"
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(self.sessions, f)
            os.replace(tmp_path, self.storage_path)
        except Exception:
            pass

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
            self._save_to_disk_unlocked()
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
                self._save_to_disk_unlocked()
                return None
            return dict(sess)

    def revoke_session(self, token):
        if not token:
            return
        with self.lock:
            if token in self.sessions:
                self.sessions.pop(token, None)
                self._save_to_disk_unlocked()

    def _cleanup_expired_unlocked(self, now):
        expired = [k for k, v in self.sessions.items() if v.get("expiresAt", 0) < now]
        for k in expired:
            self.sessions.pop(k, None)


sessions = SessionManager(os.path.join(DATA_DIR, "sessions.json"))


# Brute-Force Protection Rate Limiter for /api/auth/login
class LoginRateLimiter:
    MAX_FAILURES = 5
    WINDOW_SECONDS = 60
    LOCKOUT_SECONDS = 60

    def __init__(self):
        self.attempts = {}  # ip -> {"fails": [timestamps], "locked_until": float}
        self.lock = threading.Lock()

    def check_allowed(self, ip_addr):
        now = time.time()
        with self.lock:
            rec = self.attempts.get(ip_addr)
            if not rec:
                return True, 0
            if rec["locked_until"] > now:
                wait_sec = int(round(rec["locked_until"] - now))
                return False, max(1, wait_sec)
            return True, 0

    def record_failure(self, ip_addr):
        now = time.time()
        with self.lock:
            rec = self.attempts.setdefault(ip_addr, {"fails": [], "locked_until": 0.0})
            rec["fails"] = [t for t in rec["fails"] if now - t < self.WINDOW_SECONDS]
            rec["fails"].append(now)
            if len(rec["fails"]) >= self.MAX_FAILURES:
                rec["locked_until"] = now + self.LOCKOUT_SECONDS
                rec["fails"] = []
                return self.LOCKOUT_SECONDS
            return 0

    def record_success(self, ip_addr):
        with self.lock:
            self.attempts.pop(ip_addr, None)


login_limiter = LoginRateLimiter()


class RealtimePOSHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        """Sanitize any token query parameter so session tokens never leak in terminal logs."""
        try:
            msg = fmt % args
            msg = re.sub(r"token=[^&\s\"']+", "token=***REDACTED***", msg)
            sys.stderr.write("%s - - [%s] %s\n" % (
                self.address_string(),
                self.log_date_time_string(),
                msg
            ))
        except Exception:
            pass

    def _send_cors_headers(self):
        origin = self.headers.get("Origin")
        host = self.headers.get("Host", f"localhost:{PORT}")
        if origin:
            parsed_origin = urlparse(origin)
            origin_host = parsed_origin.netloc
            if origin_host == host or is_allowed_lan_or_local_host(parsed_origin.hostname):
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Access-Control-Allow-Credentials", "true")
                self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def _get_auth_session(self, query_params=None):
        auth_header = self.headers.get("Authorization", "")
        token = None
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:].strip()

        # Also check HttpOnly session cookie (used by EventSource /api/events so token is not needed in URL)
        if not token:
            cookie_hdr = self.headers.get("Cookie", "")
            if cookie_hdr:
                try:
                    cookie = SimpleCookie()
                    cookie.load(cookie_hdr)
                    if "warungku_session" in cookie:
                        token = cookie["warungku_session"].value
                except Exception:
                    pass

        if not token and query_params and "token" in query_params:
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
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def send_json(self, data, status=200, extra_headers=None):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._send_cors_headers()
        if extra_headers:
            for hk, hv in extra_headers.items():
                self.send_header(hk, hv)
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
            }, extra_headers={
                "Set-Cookie": f"warungku_session={sess['token']}; Path=/; HttpOnly; SameSite=Lax; Max-Age={SessionManager.SESSION_TTL_SECONDS}"
            })
            return

        # 1. SSE Realtime Stream Endpoint (Requires Auth via Cookie or Header)
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

        # Prevent direct download of database/config/session files via static file handler
        if path.startswith("/data/") or path.endswith((".py", ".sqlite", ".db", ".sql")) or path == "/db_config.json":
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

        client_ip = self.client_address[0] if self.client_address else "unknown"

        # 0A. Auth Login Endpoint (Public, Protected by Brute-Force Rate Limiter)
        if path == "/api/auth/login":
            allowed, wait_sec = login_limiter.check_allowed(client_ip)
            if not allowed:
                self.send_json({
                    "error": f"Terlalu banyak percobaan login gagal. Silakan tunggu {wait_sec} detik lagi."
                }, status=429)
                return

            role = (payload.get("role") or "cashier").strip().lower()
            secret = payload.get("password") if "password" in payload else payload.get("secret", "")
            cashier_name = (payload.get("cashierName") or ("Admin" if role == "admin" else "Kasir 1")).strip()

            if role not in ("cashier", "admin"):
                self.send_json({"error": "Role tidak valid."}, status=400)
                return

            if not db.verify_credentials(role, secret):
                lock_dur = login_limiter.record_failure(client_ip)
                err_msg = "Password Admin salah!" if role == "admin" else "PIN Kasir salah!"
                if lock_dur > 0:
                    err_msg += f" Terlalu banyak percobaan gagal, akun dikunci sementara selama {lock_dur} detik."
                self.send_json({"error": err_msg}, status=401)
                return

            login_limiter.record_success(client_ip)
            sess = sessions.create_session(role=role, cashier_name=cashier_name)
            cookie_val = f"warungku_session={sess['token']}; Path=/; HttpOnly; SameSite=Lax; Max-Age={SessionManager.SESSION_TTL_SECONDS}"
            self.send_json({
                "success": True,
                "token": sess["token"],
                "role": sess["role"],
                "cashierName": sess["cashierName"],
                "data": db.get_all()
            }, extra_headers={"Set-Cookie": cookie_val})
            return

        # 0B. Auth Logout Endpoint
        if path == "/api/auth/logout":
            sess = self._get_auth_session()
            if sess and sess.get("token"):
                sessions.revoke_session(sess["token"])
            self.send_json(
                {"success": True},
                extra_headers={"Set-Cookie": "warungku_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"}
            )
            return

        # 0C. Verify Admin Password for Sensitive Cashier Operations (e.g. Manual Discount Authorization)
        if path == "/api/auth/verify-admin":
            sess = self._require_auth(allowed_roles=("cashier", "admin"))
            if not sess:
                return
            allowed, wait_sec = login_limiter.check_allowed(client_ip)
            if not allowed:
                self.send_json({"error": f"Terlalu banyak percobaan gagal. Tunggu {wait_sec} detik."}, status=429)
                return
            admin_pass = payload.get("password", "")
            if not db.verify_credentials("admin", admin_pass):
                login_limiter.record_failure(client_ip)
                self.send_json({"success": False, "error": "Password Admin tidak valid!"}, status=401)
                return
            login_limiter.record_success(client_ip)
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
                updated_data = db.process_checkout(payload, user_role=sess.get("role", "cashier"))
            except ValueError as e:
                self.send_json({"error": str(e)}, status=400)
                return
            except Exception as e:
                self.send_json({"error": f"Gagal memproses transaksi: {str(e)}"}, status=500)
                return

            # Remove inline adminAuthPassword before broadcasting
            payload.pop("adminAuthPassword", None)
            if isinstance(payload.get("discountInfo"), dict):
                payload["discountInfo"].pop("adminAuthPassword", None)

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

        # 1C. Close Store / Record Daily Financial Report & Auto-Consolidate (Accessible by Cashier & Admin)
        if path == "/api/reports/close-day":
            sess = self._require_auth(allowed_roles=("cashier", "admin"))
            if not sess:
                return
            is_admin = sess.get("role") == "admin"
            target_date = (payload.get("date") or None) if is_admin else None
            closed_by = payload.get("closedBy") or f"{sess.get('cashierName', 'Kasir')} (Tutup Toko)"
            force_new = bool(payload.get("forceNew", False)) if is_admin else False
            try:
                res = db.close_daily_report(
                    target_date=target_date,
                    closed_by=closed_by,
                    force_new_entry=force_new
                )
                events.broadcast("report_update", {
                    "closedDate": res["closedDate"],
                    "consolidatedEvents": res["consolidatedEvents"],
                    "fullData": res["data"]
                })
                self.send_json({
                    "success": True,
                    "closedDate": res["closedDate"],
                    "consolidatedEvents": res["consolidatedEvents"],
                    "data": res["data"]
                })
            except Exception as e:
                self.send_json({"error": f"Gagal menutup buku harian: {str(e)}"}, status=500)
            return

        # 1D. Record Daily Cashbook Entry (Accessible by Cashier & Admin)
        if path == "/api/cashbook":
            sess = self._require_auth(allowed_roles=("cashier", "admin"))
            if not sess:
                return
            entry_type = (payload.get("type") or "in").strip().lower()
            if entry_type == "out" and sess.get("role") != "admin":
                # Expense recording requires Admin role or Admin Password authorization
                admin_pass = payload.get("adminAuthPassword") or payload.get("adminPassword")
                if not admin_pass or not db.verify_credentials("admin", admin_pass):
                    self.send_json({"error": "Pencatatan uang keluar (beban toko) memerlukan otorisasi Password Admin!"}, status=403)
                    return
            if not payload.get("user"):
                payload["user"] = sess.get("cashierName", "Admin")
            try:
                updated_data = db.add_cashbook_entry(payload)
                events.broadcast("cashbook_update", {
                    "entry": payload,
                    "fullData": updated_data
                })
                self.send_json({"success": True, "data": updated_data})
            except ValueError as ve:
                self.send_json({"error": str(ve)}, status=400)
            except Exception as e:
                self.send_json({"error": f"Gagal mencatat mutasi kas: {str(e)}"}, status=500)
            return

        # All endpoints below require ADMIN role
        sess = self._require_auth(allowed_roles=("admin",))
        if not sess:
            return

        # 1E. Void Daily Cashbook Entry (Admin Only)
        if path == "/api/cashbook/void":
            entry_id = payload.get("id")
            reason = payload.get("reason", "Dibatalkan oleh Admin")
            if entry_id:
                try:
                    updated_data = db.void_cashbook_entry(entry_id, reason=reason, user=sess.get("cashierName", "Admin"))
                    events.broadcast("cashbook_void", {
                        "id": entry_id,
                        "reason": reason,
                        "fullData": updated_data
                    })
                    self.send_json({"success": True, "data": updated_data})
                    return
                except Exception as e:
                    self.send_json({"error": f"Gagal membatalkan transaksi kas: {str(e)}"}, status=500)
                    return
            self.send_json({"error": "Missing cashbook entry ID"}, status=400)
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

        # Delete Product (Soft Delete)
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

        # Delete Financial Report (Admin Only)
        if path == "/api/reports":
            rpt_id = query.get("id", [None])[0]
            if rpt_id:
                updated_data = db.delete_financial_report(rpt_id)
                events.broadcast("report_update", {
                    "id": rpt_id,
                    "fullData": updated_data
                })
                self.send_json({"success": True, "data": updated_data})
                return
            self.send_json({"error": "Missing report ID"}, status=400)
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
    """
    Safely clean up only stale Python instances listening on the exact local port on Windows.
    Never terminates non-Python processes (e.g. Node.js, React, other apps).
    """
    if os.name != "nt":
        return
    try:
        import subprocess
        out = subprocess.check_output(["netstat", "-ano", "-p", "TCP"], text=True, errors="ignore")
        my_pid = str(os.getpid())
        candidate_pids = set()
        for line in out.splitlines():
            parts = line.split()
            # Format: Proto  Local Address  Foreign Address  State  PID
            if len(parts) >= 5 and parts[0].upper() == "TCP" and parts[3].upper() == "LISTENING":
                local_addr = parts[1]
                pid = parts[4]
                if local_addr.endswith(f":{port}") and pid.isdigit() and pid != "0" and pid != my_pid:
                    candidate_pids.add(pid)

        killed_any = False
        for pid in candidate_pids:
            # Verify the PID actually belongs to a python executable before killing!
            t_out = subprocess.check_output(
                ["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
                text=True,
                errors="ignore"
            ).lower()
            if "python" in t_out:
                subprocess.run(
                    ["taskkill", "/F", "/PID", pid],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                killed_any = True
        if killed_any:
            time.sleep(0.4)
    except Exception:
        pass


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = (os.name != "nt")


def _auto_close_scheduler_worker():
    """
    Background worker that checks every 30 seconds whether the store closing time
    has been reached (or if past unclosed dates exist) and automatically records
    the daily financial report + consolidates 7d -> 1w -> 4w -> 1m -> 12m -> 1y.
    """
    while True:
        try:
            changed, updated_data = db.auto_check_and_close_reports()
            if changed and updated_data:
                events.broadcast("report_update", {
                    "autoClosed": True,
                    "fullData": updated_data
                })
        except Exception:
            pass
        time.sleep(30)


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    _cleanup_stale_port_listeners(PORT)
    local_ip = get_ip()

    # Run initial check for any past unclosed days & start background auto-close scheduler
    try:
        db.auto_check_and_close_reports()
    except Exception:
        pass
    threading.Thread(target=_auto_close_scheduler_worker, daemon=True).start()

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


if __name__ == "__main__":
    main()
