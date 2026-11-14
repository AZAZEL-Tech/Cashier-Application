#!/usr/bin/env python3
"""
WarungKu POS - Native ESC/POS 58mm & 80mm Thermal Printer Engine
Dioptimalkan khusus untuk VSC Desktop Thermal Printer Model: VSC TM-58D PRO
(58mm, USB+BT / GEZHI micro-printer VID_28E9&PID_0289, Power: 9V2A).
"""

import os
import time
import ctypes
from ctypes import wintypes
import subprocess

if os.name == "nt":
    import winreg


VIRTUAL_PRINTER_KEYWORDS = (
    "print to pdf",
    "xps document writer",
    "onenote",
    "fax",
    "send to",
    "adobe pdf",
    "foxit",
)

USBPRINT_GUID = "{28d78fad-5a12-11d1-ae5b-0000f803a8c2}"
GENERIC_WRITE = 0x40000000
FILE_SHARE_READ = 0x00000001
FILE_SHARE_WRITE = 0x00000002
OPEN_EXISTING = 3
INVALID_HANDLE_VALUE = ctypes.c_void_p(-1).value


def fmt_rp(val):
    try:
        n = int(round(float(val or 0)))
        return "Rp " + f"{n:,}".replace(",", ".")
    except Exception:
        return "Rp 0"


def lr_line(left_text, right_text, width=32):
    """Format left and right aligned text on a single thermal line (32 chars for 58mm)."""
    left_str = str(left_text or "")
    right_str = str(right_text or "")
    max_left = max(1, width - len(right_str) - 1)
    if len(left_str) > max_left:
        left_str = left_str[:max_left]
    spaces = max(1, width - len(left_str) - len(right_str))
    return left_str + (" " * spaces) + right_str


def build_escpos_receipt(trx, settings=None, paper_size="58mm"):
    """
    Build raw ESC/POS byte stream specifically calibrated for VSC TM-58D PRO (GEZHI VID_28E9&PID_0289).
    Uses standard POS-58 ESC ! commands, CR+LF (\r\n) line termination, and explicit heating density.
    """
    settings = settings or {}
    width = 48 if paper_size == "80mm" else 32
    sep = "-" * width
    double_sep = "=" * width

    store_name = str(settings.get("storeName") or "Warung Berkah Jaya").strip()
    store_addr = str(settings.get("storeAddress") or "").strip()
    store_phone = str(settings.get("storePhone") or "").strip()
    footer = str(settings.get("receiptFooter") or "Terima kasih atas kunjungan Anda!").strip()

    ESC = b"\x1b"

    # Standard POS-58 / VSC TM-58D PRO Initialization Sequence
    INIT = ESC + b"@"
    # Set Code Page 0 (PC437 Standard ASCII)
    CODEPAGE_PC437 = ESC + b"t\x00"
    # Set Line Spacing to default (ESC 2)
    LINE_SPACE_DEFAULT = ESC + b"2"
    # Alignment
    ALIGN_LEFT = ESC + b"a\x00"
    ALIGN_CENTER = ESC + b"a\x01"
    # Print modes via universal ESC ! n (supported by 100% of 58mm GEZHI/VSC printers)
    MODE_NORMAL = ESC + b"!\x00"
    MODE_BOLD = ESC + b"!\x08"
    MODE_HEADER = ESC + b"!\x18"  # Double height + Bold

    out = bytearray()
    out.extend(INIT)
    out.extend(CODEPAGE_PC437)
    out.extend(LINE_SPACE_DEFAULT)
    out.extend(MODE_NORMAL)

    def write_line(text=""):
        clean = (
            str(text)
            .replace("•", "-")
            .replace("—", "-")
            .replace("–", "-")
            .encode("ascii", errors="replace")
        )
        # Use CR+LF (\r\n) so all GEZHI/POS-58 firmwares latch and print the line buffer
        out.extend(clean + b"\r\n")

    # Header (Centered)
    out.extend(ALIGN_CENTER)
    out.extend(MODE_HEADER)
    write_line(store_name.upper())
    out.extend(MODE_NORMAL)

    if store_addr:
        write_line(store_addr)
    if store_phone:
        write_line(f"Telp/WA: {store_phone}")
    write_line(double_sep)

    # Metadata (Left Aligned)
    out.extend(ALIGN_LEFT)
    trx_id = str(trx.get("id") or "-")
    trx_date = str(trx.get("date") or trx.get("createdAt") or "")
    if "T" in trx_date:
        trx_date = trx_date.replace("T", " ")[:16]
    cashier = str(trx.get("cashier") or trx.get("cashierName") or "Kasir")
    customer = str(trx.get("customerName") or "Umum")

    write_line(lr_line("No.Nota:", trx_id, width))
    write_line(lr_line("Waktu  :", trx_date, width))
    write_line(lr_line("Kasir  :", cashier, width))
    write_line(lr_line("Plg    :", customer, width))
    write_line(sep)

    # Items
    items = trx.get("items") or []
    for item in items:
        name = str(item.get("name") or "Produk")
        qty = int(item.get("qty") or 1)
        price = item.get("sellPrice") if item.get("sellPrice") is not None else (item.get("price") or 0)
        sub = item.get("subtotal") if item.get("subtotal") is not None else (qty * float(price))
        write_line(name[:width])
        write_line(lr_line(f"  {qty} x {fmt_rp(price)}", fmt_rp(sub), width))

    write_line(sep)

    # Totals
    subtotal = trx.get("subtotal") or 0
    discount = float(trx.get("discount") or 0)
    tax = float(trx.get("tax") or 0)
    total = trx.get("total") or 0
    amount_paid = trx.get("amountPaid") if trx.get("amountPaid") is not None else total
    change = trx.get("change") or 0
    method = str(trx.get("paymentMethod") or "TUNAI").upper()

    write_line(lr_line("Subtotal", fmt_rp(subtotal), width))
    if discount > 0:
        write_line(lr_line("Diskon", "-" + fmt_rp(discount), width))
    if tax > 0:
        write_line(lr_line("PPN", fmt_rp(tax), width))

    out.extend(MODE_BOLD)
    write_line(lr_line("TOTAL", fmt_rp(total), width))
    out.extend(MODE_NORMAL)

    write_line(lr_line(f"Bayar ({method})", fmt_rp(amount_paid), width))
    out.extend(MODE_BOLD)
    write_line(lr_line("Kembali", fmt_rp(change), width))
    out.extend(MODE_NORMAL)
    write_line(sep)

    # Footer
    out.extend(ALIGN_CENTER)
    for line in footer.splitlines():
        if line.strip():
            write_line(line.strip())

    # Feed 4 lines for manual tear bar on 58mm VSC TM-58D PRO
    out.extend(ALIGN_LEFT)
    out.extend(b"\r\n\r\n\r\n\r\n")
    return bytes(out)


def _list_registry_usbprint_candidates():
    """Return candidate USBPRINT device paths registered in Windows without opening handles."""
    if os.name != "nt":
        return []
    candidates = []
    try:
        key_path = rf"SYSTEM\CurrentControlSet\Control\DeviceClasses\{USBPRINT_GUID}"
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, key_path) as k:
            i = 0
            while True:
                try:
                    sub = winreg.EnumKey(k, i)
                    i += 1
                    if not sub.startswith("##?#"):
                        continue
                    dev_path = "\\\\?\\" + sub[4:]
                    label = "USB Direct: VSC TM-58D PRO (58mm)"
                    parts = sub.split("#")
                    if len(parts) >= 3:
                        hw_id = parts[2]
                        if "28E9" in hw_id.upper():
                            label = f"USB Direct: VSC TM-58D PRO ({hw_id})"
                        else:
                            label = f"USB Direct: Thermal Printer ({hw_id})"
                    candidates.append({
                        "label": label,
                        "devicePath": dev_path,
                    })
                except OSError:
                    break
    except Exception:
        pass
    return candidates


def find_active_usbprint_devices():
    """
    Scan Windows USB Printing Support (GUID_DEVINTERFACE_USBPRINT) interfaces
    and return all currently connected & writable USB thermal printers.
    """
    if os.name != "nt":
        return []

    active_devices = []
    try:
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.CreateFileW.argtypes = [
            wintypes.LPCWSTR,
            wintypes.DWORD,
            wintypes.DWORD,
            wintypes.LPVOID,
            wintypes.DWORD,
            wintypes.DWORD,
            wintypes.HANDLE,
        ]
        kernel32.CreateFileW.restype = wintypes.HANDLE
        kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel32.CloseHandle.restype = wintypes.BOOL

        for cand in _list_registry_usbprint_candidates():
            h = kernel32.CreateFileW(
                cand["devicePath"],
                GENERIC_WRITE,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                None,
                OPEN_EXISTING,
                0,
                None,
            )
            if h != INVALID_HANDLE_VALUE and h is not None:
                kernel32.CloseHandle(h)
                active_devices.append(cand)
    except Exception:
        pass

    return active_devices


def write_raw_to_usbprint_device(device_path, raw_bytes):
    """
    Write raw ESC/POS bytes to a Windows USBPRINT device interface path in 64-byte chunks
    (matching the 64-byte USB Full-Speed Bulk OUT endpoint of GEZHI VID_28E9&PID_0289).
    """
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateFileW.argtypes = [
        wintypes.LPCWSTR,
        wintypes.DWORD,
        wintypes.DWORD,
        wintypes.LPVOID,
        wintypes.DWORD,
        wintypes.DWORD,
        wintypes.HANDLE,
    ]
    kernel32.CreateFileW.restype = wintypes.HANDLE
    kernel32.WriteFile.argtypes = [
        wintypes.HANDLE,
        wintypes.LPCVOID,
        wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD),
        wintypes.LPVOID,
    ]
    kernel32.WriteFile.restype = wintypes.BOOL
    kernel32.FlushFileBuffers.argtypes = [wintypes.HANDLE]
    kernel32.FlushFileBuffers.restype = wintypes.BOOL
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL

    h = kernel32.CreateFileW(
        device_path,
        GENERIC_WRITE,
        FILE_SHARE_READ | FILE_SHARE_WRITE,
        None,
        OPEN_EXISTING,
        0,
        None,
    )
    if h == INVALID_HANDLE_VALUE or h is None:
        err = ctypes.get_last_error()
        raise RuntimeError(f"Gagal membuka jalur USB printer '{device_path}' (Error code: {err}).")

    total_written = 0
    try:
        chunk_size = 64
        for offset in range(0, len(raw_bytes), chunk_size):
            chunk = raw_bytes[offset:offset + chunk_size]
            written = wintypes.DWORD(0)
            buf = ctypes.create_string_buffer(chunk, len(chunk))
            ok = kernel32.WriteFile(h, buf, len(chunk), ctypes.byref(written), None)
            if not ok:
                err = ctypes.get_last_error()
                raise RuntimeError(f"Gagal mengirim data ke USB printer (Error code: {err}).")
            total_written += written.value
            time.sleep(0.008)

        kernel32.FlushFileBuffers(h)
        time.sleep(0.10)
        return {
            "success": True,
            "printerName": "VSC TM-58D PRO (USB Direct)",
            "devicePath": device_path,
            "bytesWritten": total_written,
        }
    finally:
        kernel32.CloseHandle(h)


def _is_virtual_printer(name):
    low = str(name or "").lower()
    return any(k in low for k in VIRTUAL_PRINTER_KEYWORDS)


def list_windows_printers():
    """
    Return list of available thermal printers:
    1. Active Direct USB Printing Support devices (VSC TM-58D PRO / USBPRINT)
    2. Physical Windows Spooler printers (excluding PDF/XPS/OneNote/Fax virtual printers)
    """
    if os.name != "nt":
        return {"printers": [], "defaultPrinter": None, "recommendedPrinter": None}

    usb_devices = find_active_usbprint_devices()
    printers = [d["label"] for d in usb_devices]

    default_printer = None
    try:
        winspool = ctypes.WinDLL("winspool.drv", use_last_error=True)
        buf_size = wintypes.DWORD(260)
        buf = ctypes.create_unicode_buffer(260)
        if winspool.GetDefaultPrinterW(buf, ctypes.byref(buf_size)):
            if not _is_virtual_printer(buf.value):
                default_printer = buf.value
    except Exception:
        pass

    spooler_printers = []
    try:
        cmd = ["powershell", "-NoProfile", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=4)
        if res.returncode == 0 and res.stdout.strip():
            for line in res.stdout.splitlines():
                name = line.strip()
                if name and not _is_virtual_printer(name):
                    spooler_printers.append(name)
    except Exception:
        pass

    thermal_keywords = ("vsc", "58", "pos", "tm-", "thermal", "receipt", "generic", "gezhi")

    def sort_key(p_name):
        low = p_name.lower()
        is_thermal = any(k in low for k in thermal_keywords)
        is_default = (p_name == default_printer)
        return (0 if is_thermal else 1, 0 if is_default else 1, p_name)

    spooler_printers.sort(key=sort_key)
    printers.extend(spooler_printers)

    recommended = printers[0] if printers else default_printer
    return {
        "printers": printers,
        "usbDevices": usb_devices,
        "defaultPrinter": default_printer,
        "recommendedPrinter": recommended,
    }


class DOC_INFO_1W(ctypes.Structure):
    _fields_ = [
        ("pDocName", wintypes.LPWSTR),
        ("pOutputFile", wintypes.LPWSTR),
        ("pDatatype", wintypes.LPWSTR),
    ]


def send_raw_to_windows_printer(printer_name, raw_bytes):
    """
    Send raw ESC/POS bytes to the VSC TM-58D PRO thermal printer.
    Opens the USB handle only ONCE per print job to avoid resetting USB endpoint state.
    """
    if os.name != "nt":
        raise RuntimeError("Fitur Direct Thermal Print hanya tersedia di Windows.")

    req_name = str(printer_name or "").strip()
    if _is_virtual_printer(req_name):
        req_name = ""

    # 1. Try Direct USB Thermal Printer candidates first without double-opening the handle
    candidates = _list_registry_usbprint_candidates()
    if candidates and (not req_name or req_name.lower().startswith("usb direct") or req_name.startswith("\\\\?\\")):
        last_err = None
        for cand in candidates:
            if req_name and req_name not in (cand["label"], cand["devicePath"]) and not req_name.lower().startswith("usb direct"):
                continue
            try:
                res = write_raw_to_usbprint_device(cand["devicePath"], raw_bytes)
                res["printerName"] = cand["label"]
                return res
            except Exception as e:
                last_err = e
        # If specific label didn't match, try all candidates
        for cand in candidates:
            try:
                res = write_raw_to_usbprint_device(cand["devicePath"], raw_bytes)
                res["printerName"] = cand["label"]
                return res
            except Exception as e:
                last_err = e

    # 2. Windows Spooler queue fallback
    if not req_name:
        info = list_windows_printers()
        req_name = info.get("recommendedPrinter") or ""

    if not req_name:
        raise RuntimeError(
            "Printer VSC TM-58D PRO tidak terdeteksi di USB. Pastikan kabel USB printer terpasang ke PC dan tombol power printer menyala."
        )

    winspool = ctypes.WinDLL("winspool.drv", use_last_error=True)

    winspool.OpenPrinterW.argtypes = [wintypes.LPWSTR, ctypes.POINTER(wintypes.HANDLE), wintypes.LPVOID]
    winspool.OpenPrinterW.restype = wintypes.BOOL

    winspool.StartDocPrinterW.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(DOC_INFO_1W)]
    winspool.StartDocPrinterW.restype = wintypes.DWORD

    winspool.StartPagePrinter.argtypes = [wintypes.HANDLE]
    winspool.StartPagePrinter.restype = wintypes.BOOL

    winspool.WritePrinter.argtypes = [wintypes.HANDLE, wintypes.LPVOID, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
    winspool.WritePrinter.restype = wintypes.BOOL

    winspool.EndPagePrinter.argtypes = [wintypes.HANDLE]
    winspool.EndPagePrinter.restype = wintypes.BOOL

    winspool.EndDocPrinter.argtypes = [wintypes.HANDLE]
    winspool.EndDocPrinter.restype = wintypes.BOOL

    winspool.ClosePrinter.argtypes = [wintypes.HANDLE]
    winspool.ClosePrinter.restype = wintypes.BOOL

    h_printer = wintypes.HANDLE()
    if not winspool.OpenPrinterW(req_name, ctypes.byref(h_printer), None):
        err = ctypes.get_last_error()
        raise RuntimeError(f"Gagal membuka printer '{req_name}' (Error code: {err}).")

    try:
        doc_info = DOC_INFO_1W()
        doc_info.pDocName = "WarungKu POS Thermal Receipt"
        doc_info.pOutputFile = None
        doc_info.pDatatype = "RAW"

        job_id = winspool.StartDocPrinterW(h_printer, 1, ctypes.byref(doc_info))
        if job_id == 0:
            err = ctypes.get_last_error()
            raise RuntimeError(f"StartDocPrinterW gagal pada '{req_name}' (Error code: {err}).")

        try:
            winspool.StartPagePrinter(h_printer)
            written = wintypes.DWORD(0)
            buf = ctypes.create_string_buffer(raw_bytes)
            ok = winspool.WritePrinter(h_printer, buf, len(raw_bytes), ctypes.byref(written))
            winspool.EndPagePrinter(h_printer)
            if not ok:
                err = ctypes.get_last_error()
                raise RuntimeError(f"WritePrinter gagal (Error code: {err}).")
        finally:
            winspool.EndDocPrinter(h_printer)
    finally:
        winspool.ClosePrinter(h_printer)

    return {"success": True, "printerName": req_name, "bytesWritten": len(raw_bytes)}
