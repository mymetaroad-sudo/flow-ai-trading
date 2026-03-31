"""
KiwoomSocketAdapter
FastAPI side - communicates with kiwoom_worker.py via socket
"""
from __future__ import annotations
import json
import socket
import threading
from datetime import datetime
from typing import Any, Callable, Optional
from .base import BrokerAdapter, BrokerStatus

WORKER_HOST = "127.0.0.1"
WORKER_PORT = 19200


class KiwoomSocketAdapter(BrokerAdapter):

    def __init__(
        self,
        on_price_update: Optional[Callable[[str, int], None]] = None,
        on_chejan: Optional[Callable[[str, int, int, int], None]] = None,
    ) -> None:
        self._on_price_update = on_price_update
        self._on_chejan = on_chejan
        self._connected = False
        self._accounts: list[str] = []
        self._message = "worker not connected"
        self._last_event_at: str | None = None
        self._sock: socket.socket | None = None
        self._lock = threading.Lock()
        self._connect_to_worker()

    def _connect_to_worker(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.connect((WORKER_HOST, WORKER_PORT))
            self._sock = s
            self._message = "worker connected"
            t = threading.Thread(target=self._listen_events, daemon=True)
            t.start()
        except Exception as e:
            self._message = f"worker unavailable: {e}"
            self._sock = None

    def _listen_events(self):
        buf = b""
        try:
            while True:
                data = self._sock.recv(4096)
                if not data:
                    break
                buf += data
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    try:
                        msg = json.loads(line.decode())
                        self._handle_event(msg)
                    except Exception:
                        pass
        except Exception:
            pass
        self._message = "worker disconnected"

    def _handle_event(self, msg: dict):
        event = msg.get("event")
        if event == "connect":
            self._connected = msg.get("connected", False)
            self._accounts = msg.get("accounts", [])
            self._message = f"kiwoom err_code={msg.get('err_code')}"
            self._last_event_at = datetime.utcnow().isoformat()
            try:
                from app.api.connection_log_routes import add_log
                if self._connected:
                    add_log("CONNECTED", "Kiwoom login success", True)
                else:
                    add_log("DISCONNECTED", f"Kiwoom login failed err={msg.get('err_code')}", False)
            except Exception:
                pass
        elif event == "price":
            if self._on_price_update:
                self._on_price_update(msg["code"], msg["price"])
        elif event == "chejan":
            if self._on_chejan:
                self._on_chejan(msg["code"], msg["filled_qty"],
                                msg["remain_qty"], msg["filled_price"])

    def _send(self, cmd: dict) -> dict:
        if self._sock is None:
            self._connect_to_worker()
        if self._sock is None:
            return {"ok": False, "error": "kiwoom_worker not running"}
        try:
            with self._lock:
                self._sock.sendall((json.dumps(cmd) + "\n").encode())
                resp = b""
                while b"\n" not in resp:
                    chunk = self._sock.recv(4096)
                    if not chunk:
                        break
                    resp += chunk
                return json.loads(resp.split(b"\n")[0].decode())
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # ── BrokerAdapter interface ───────────────────────────────

    def connect(self) -> BrokerStatus:
        result = self._send({"action": "connect"})
        self._message = result.get("message", "connect sent")
        return self.get_status()

    def disconnect(self) -> BrokerStatus:
        self._send({"action": "disconnect"})
        self._connected = False
        return self.get_status()

    def get_status(self) -> BrokerStatus:
        # sync state from worker
        result = self._send({"action": "status"})
        if result.get("ok"):
            self._connected = result.get("connected", False)
            self._accounts = result.get("accounts", [])
            self._message = result.get("message", "")
        acct = self._accounts[0] if self._accounts else ""
        return BrokerStatus(
            mode="kiwoom", connected=self._connected,
            account_no=acct, message=self._message,
            last_event_at=self._last_event_at,
        )

    def get_accounts(self) -> list[str]:
        return self._accounts

    def get_available_cash(self) -> int:
        result = self._send({"action": "get_cash"})
        return result.get("cash", 0)

    def send_manual_buy(self, code: str, qty: int, price: int | None = None) -> dict[str, Any]:
        return self._send({"action": "buy", "code": code, "qty": qty, "price": price or 0})

    def send_sell(self, code: str, qty: int, order_type: str = "MARKET", price: int | None = None) -> dict[str, Any]:
        return self._send({"action": "sell", "code": code, "qty": qty,
                           "order_type": order_type, "price": price or 0})

    def load_condition_list(self) -> list[dict[str, Any]]:
        return []

    def run_condition(self, screen_no: str, condition_name: str, condition_index: int) -> list[str]:
        return []

    def register_real(self, screen_no: str, code: str, fids: list[int]) -> dict[str, Any]:
        return {"ok": True}

    def remove_real(self, screen_no: str, code: str) -> dict[str, Any]:
        return {"ok": True}
