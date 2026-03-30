from __future__ import annotations
import random
from datetime import datetime
from typing import Any, Callable, Optional
from .base import BrokerAdapter, BrokerStatus


class MockBrokerAdapter(BrokerAdapter):
    """
    Mock 브로커 — 실 API 없이 전체 흐름 테스트용.
    - send_manual_buy / send_sell → 즉시 ok=True 반환
    - simulate_fill() → 체결 콜백 강제 시뮬레이션
    - simulate_price_tick() → 현재가 변동 시뮬레이션
    - get_available_cash() → 설정 금액 반환
    """

    def __init__(
        self,
        on_price_update: Optional[Callable[[str, int], None]] = None,
        on_chejan: Optional[Callable[[str, int, int, int], None]] = None,
    ) -> None:
        self.connected = False
        self.account_no = "1234567890"
        self.last_event_at: str | None = None
        self._on_price_update = on_price_update
        self._on_chejan = on_chejan
        # 모의 계좌 잔고
        self._available_cash = 300_000_000
        # 종목별 현재가 (시뮬레이션용)
        self._prices: dict[str, int] = {}
        # 미체결 주문 추적 (order_key → qty)
        self._pending_orders: dict[str, dict] = {}

    def _now(self) -> str:
        t = datetime.utcnow().isoformat()
        self.last_event_at = t
        return t

    def _status(self, message: str) -> BrokerStatus:
        return BrokerStatus(
            mode="mock", connected=self.connected,
            account_no=self.account_no,
            message=message, last_event_at=self.last_event_at,
        )

    # ── 연결 ───────────────────────────────────────────────────

    def connect(self) -> BrokerStatus:
        self.connected = True
        self._now()
        try:
            from app.api.connection_log_routes import add_log
            add_log("CONNECTED", "Mock 브로커 연결됨", True)
        except Exception:
            pass
        return self._status("모의 브로커 연결 완료")

    def disconnect(self) -> BrokerStatus:
        self.connected = False
        self._now()
        try:
            from app.api.connection_log_routes import add_log
            add_log("DISCONNECTED", "Mock 브로커 연결 해제됨", False)
        except Exception:
            pass
        return self._status("모의 브로커 연결 해제")

    def get_status(self) -> BrokerStatus:
        return self._status("모의 브로커 상태")

    def get_accounts(self) -> list[str]:
        return [self.account_no]

    def get_available_cash(self) -> int:
        """1번 수정: routes.py에서 사용하는 잔고 조회"""
        return self._available_cash

    # ── 주문 ───────────────────────────────────────────────────

    def send_manual_buy(self, code: str, qty: int, price: int | None = None) -> dict[str, Any]:
        """2번 수정: 즉시 ok=True + pending 주문 등록"""
        self._now()
        order_key = f"BUY_{code}_{self._now()}"
        self._pending_orders[order_key] = {
            "action": "BUY", "code": code, "qty": qty,
            "filled": 0, "price": price or self._prices.get(code, 0),
        }
        return {
            "ok": True, "mode": "mock", "action": "BUY",
            "code": code, "qty": qty, "price": price,
            "order_key": order_key,
        }

    def send_sell(self, code: str, qty: int, order_type: str = "MARKET", price: int | None = None) -> dict[str, Any]:
        self._now()
        order_key = f"SELL_{code}_{self._now()}"
        self._pending_orders[order_key] = {
            "action": "SELL", "code": code, "qty": qty,
            "filled": 0, "price": price or self._prices.get(code, 0),
        }
        return {
            "ok": True, "mode": "mock", "action": "SELL",
            "order_type": order_type, "code": code, "qty": qty, "price": price,
            "order_key": order_key,
        }

    # ── 시뮬레이션 ──────────────────────────────────────────────

    def simulate_fill(self, code: str, qty: int, price: int, remain: int = 0) -> None:
        """3번 수정: 체결 콜백 직접 호출 시뮬레이션"""
        self._prices[code] = price
        if self._on_chejan:
            # (code, filled_qty, remain_qty, filled_price)
            self._on_chejan(code, qty, remain, price)

    def simulate_price_tick(self, code: str, price: int) -> None:
        """4번 수정: 현재가 변동 시뮬레이션"""
        self._prices[code] = price
        if self._on_price_update:
            self._on_price_update(code, price)

    def simulate_random_tick(self, code: str, base_price: int, pct: float = 0.5) -> int:
        """랜덤 ±pct% 가격 변동"""
        delta = int(base_price * pct / 100)
        new_price = base_price + random.randint(-delta, delta)
        new_price = max(1, new_price)
        self.simulate_price_tick(code, new_price)
        return new_price

    # ── 조건검색 / 실시간 ──────────────────────────────────────

    def load_condition_list(self) -> list[dict[str, Any]]:
        return [
            {"index": 0, "name": "거래대금 급증"},
            {"index": 1, "name": "신고가 근접"},
            {"index": 2, "name": "테마 주도주"},
        ]

    def run_condition(self, screen_no: str, condition_name: str, condition_index: int) -> list[str]:
        return ["005930", "000660", "196170"]

    def register_real(self, screen_no: str, code: str, fids: list[int]) -> dict[str, Any]:
        self._now()
        return {"ok": True, "screen_no": screen_no, "code": code, "fids": fids}

    def remove_real(self, screen_no: str, code: str) -> dict[str, Any]:
        self._now()
        return {"ok": True, "screen_no": screen_no, "code": code}
