"""
kiwoom_worker.py
Qt mainthread + Kiwoom OpenAPI + socket server
Run: C:\Python39_32\python.exe kiwoom_worker.py
"""
import sys
import os
import json
import socket
import threading
from datetime import datetime

os.environ.setdefault("QT_QPA_PLATFORM_PLUGIN_PATH",
    r"C:\Python39_32\Lib\site-packages\PyQt5\Qt5\plugins\platforms")

from PyQt5.QtWidgets import QApplication
from PyQt5.QAxContainer import QAxWidget
from PyQt5.QtCore import QTimer

HOST = "127.0.0.1"
PORT = 19200  # FastAPI <-> worker socket port

app = QApplication(sys.argv)
ocx = QAxWidget("KHOPENAPI.KHOpenAPICtrl.1")

state = {
    "connected": False,
    "accounts": [],
    "message": "init",
    "last_event_at": None,
}

clients = []
clients_lock = threading.Lock()


def broadcast(msg: dict):
    data = (json.dumps(msg, ensure_ascii=False) + "\n").encode()
    with clients_lock:
        dead = []
        for c in clients:
            try:
                c.sendall(data)
            except Exception:
                dead.append(c)
        for c in dead:
            clients.remove(c)


def mark(message: str):
    state["message"] = message
    state["last_event_at"] = datetime.utcnow().isoformat()


# ── Kiwoom callbacks ──────────────────────────────────────────

def on_event_connect(err_code):
    state["connected"] = err_code == 0
    if state["connected"]:
        raw = ocx.dynamicCall("GetLoginInfo(QString)", "ACCNO")
        state["accounts"] = [x for x in str(raw).split(";") if x]
    mark(f"connect err_code={err_code}")
    broadcast({"event": "connect", "err_code": err_code,
               "connected": state["connected"], "accounts": state["accounts"]})


def on_receive_real_data(code, real_type, real_data):
    try:
        raw = ocx.dynamicCall("GetCommRealData(QString,int)", code, 10)
        price = abs(int(raw or 0))
        if price > 0:
            broadcast({"event": "price", "code": code, "price": price})
    except Exception:
        pass


def on_receive_chejan_data(gubun, item_cnt, fid_list):
    try:
        def get(fid):
            return str(ocx.dynamicCall("GetChejanData(int)", fid) or "").strip()
        code = get(9001).lstrip("A")
        filled_qty   = abs(int(get(910) or 0))
        remain_qty   = abs(int(get(902) or 0))
        filled_price = abs(int(get(911) or 0))
        broadcast({"event": "chejan", "code": code,
                   "filled_qty": filled_qty, "remain_qty": remain_qty,
                   "filled_price": filled_price})
    except Exception:
        pass


ocx.OnEventConnect.connect(on_event_connect)
ocx.OnReceiveRealData.connect(on_receive_real_data)
ocx.OnReceiveChejanData.connect(on_receive_chejan_data)


# ── Command handler ───────────────────────────────────────────

def handle_command(cmd: dict) -> dict:
    action = cmd.get("action", "")

    if action == "status":
        return {"ok": True, "connected": state["connected"],
                "accounts": state["accounts"], "message": state["message"]}

    if action == "connect":
        ocx.dynamicCall("CommConnect()")
        mark("login popup requested")
        return {"ok": True, "message": "CommConnect called"}

    if action == "disconnect":
        state["connected"] = False
        mark("disconnected")
        return {"ok": True}

    if action == "buy":
        code = cmd["code"]; qty = cmd["qty"]; price = cmd.get("price", 0)
        hoga = "00" if price else "03"
        acct = state["accounts"][0] if state["accounts"] else ""
        ret = ocx.dynamicCall(
            "SendOrder(QString,QString,QString,int,QString,int,int,QString,QString)",
            ["buy", "0101", acct, 1, code, qty, price, hoga, ""]
        )
        return {"ok": ret == 0, "code": code, "qty": qty, "price": price}

    if action == "sell":
        code = cmd["code"]; qty = cmd["qty"]
        order_type = cmd.get("order_type", "MARKET")
        price = cmd.get("price", 0)
        hoga = "03" if order_type == "MARKET" else "00"
        acct = state["accounts"][0] if state["accounts"] else ""
        ret = ocx.dynamicCall(
            "SendOrder(QString,QString,QString,int,QString,int,int,QString,QString)",
            ["sell", "0102", acct, 2, code, qty, price, hoga, ""]
        )
        return {"ok": ret == 0, "code": code, "qty": qty}

    if action == "get_cash":
        if not state["connected"] or not state["accounts"]:
            return {"ok": False, "cash": 0}
        try:
            acct = state["accounts"][0]
            pw = cmd.get("password", "")
            ocx.dynamicCall("SetInputValue(QString,QString)", "계좌번호", acct)
            ocx.dynamicCall("SetInputValue(QString,QString)", "비밀번호", pw)
            ocx.dynamicCall("SetInputValue(QString,QString)", "비밀번호입력매체구분", "00")
            ocx.dynamicCall("SetInputValue(QString,QString)", "조회구분", "2")
            ocx.dynamicCall("CommRqData(QString,QString,int,QString)", "잔고조회", "opw00001", 0, "7001")
            raw = ocx.dynamicCall("GetCommData(QString,QString,int,QString)", "opw00001", "잔고조회", 0, "주문가능금액")
            return {"ok": True, "cash": abs(int(str(raw).strip() or 0))}
        except Exception as e:
            return {"ok": False, "cash": 0, "error": str(e)}

    return {"ok": False, "error": f"unknown action: {action}"}


# ── Socket server (thread) ────────────────────────────────────

def client_thread(conn, addr):
    with clients_lock:
        clients.append(conn)
    buf = b""
    try:
        while True:
            data = conn.recv(4096)
            if not data:
                break
            buf += data
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                try:
                    cmd = json.loads(line.decode())
                    resp = handle_command(cmd)
                    conn.sendall((json.dumps(resp) + "\n").encode())
                except Exception as e:
                    conn.sendall((json.dumps({"ok": False, "error": str(e)}) + "\n").encode())
    except Exception:
        pass
    finally:
        with clients_lock:
            if conn in clients:
                clients.remove(conn)
        conn.close()


def socket_server():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((HOST, PORT))
    srv.listen(5)
    print(f"[kiwoom_worker] socket listening on {HOST}:{PORT}")
    while True:
        conn, addr = srv.accept()
        t = threading.Thread(target=client_thread, args=(conn, addr), daemon=True)
        t.start()


t = threading.Thread(target=socket_server, daemon=True)
t.start()

# Qt event loop - must run in main thread
timer = QTimer()
timer.start(100)  # keep Qt responsive
print("[kiwoom_worker] Qt main loop started")
sys.exit(app.exec_())
