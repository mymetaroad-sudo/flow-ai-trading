from __future__ import annotations
from datetime import datetime
from typing import Any, Callable, Optional
from app.core.config import settings
from .base import BrokerAdapter, BrokerStatus

try:
    from PyQt5.QtWidgets import QApplication
    from PyQt5.QAxContainer import QAxWidget
except Exception:
    QApplication = None
    QAxWidget = None


class KiwoomOpenApiAdapter(BrokerAdapter):
    # C02 수정: FID 910=체결량, 911=체결가
    REAL_FIDS = {
        "CURRENT_PRICE": 10,
        "CHANGE_RATE": 12,
        "BEST_ASK": 27,
        "BEST_BID": 28,
        "VOLUME": 13,
        "ACC_VOLUME": 15,
        "EXEC_STRENGTH": 228,
        "MARKET_TYPE": 290,
    }
    CHEJAN_FIDS = {
        "ORDER_NO": 9203,
        "CODE": 9001,
        "FILLED_QTY": 910,    # C02 수정: 체결량
        "FILLED_PRICE": 911,  # C02 수정: 체결가
        "REMAIN_QTY": 902,    # 미체결수량 (0이면 완전체결)
        "FILL_TYPE": 920,     # 1=매수체결, 2=매도체결
    }

    def __init__(
        self,
        on_price_update: Optional[Callable[[str, int], None]] = None,
        on_chejan: Optional[Callable[[str, int, int, int], None]] = None,
        session_factory=None,  # M07: 긴급 매도 큐 생성용
    ) -> None:
        self._connected = False
        self._last_message = "초기화 완료"
        self._last_event_at: str | None = None
        self._accounts: list[str] = (
            [settings.kiwoom_account_no] if settings.kiwoom_account_no else []
        )
        self._on_price_update = on_price_update
        self._on_chejan = on_chejan
        self._session_factory = session_factory  # M07 추가

        if QApplication is None or QAxWidget is None:
            self._app = None
            self._ocx = None
            self._last_message = "Kiwoom OpenAPI+ 환경 없음 (Windows 전용)"
            return

        self._app = QApplication.instance() or QApplication([])
        self._ocx = QAxWidget("KHOPENAPI.KHOpenAPICtrl.1")
        self._ocx.OnEventConnect.connect(self._on_event_connect)
        self._ocx.OnReceiveMsg.connect(self._on_receive_msg)
        self._ocx.OnReceiveTrData.connect(self._on_receive_tr_data)
        self._ocx.OnReceiveRealData.connect(self._on_receive_real_data)
        self._ocx.OnReceiveChejanData.connect(self._on_receive_chejan_data)

    def _mark(self, message: str) -> None:
        self._last_message = message
        self._last_event_at = datetime.utcnow().isoformat()

    # ── 이벤트 핸들러 ────────────────────────────────────────────────

    def _on_event_connect(self, err_code: int) -> None:
        prev_connected = self._connected
        self._connected = err_code == 0

        if self._connected and self._ocx is not None:
            raw = self._ocx.dynamicCall("GetLoginInfo(QString)", "ACCNO")
            self._accounts = [x for x in str(raw).split(";") if x]

        self._mark(f"연결 결과 코드={err_code}")

        # 연결 로그 기록
        try:
            from app.api.connection_log_routes import add_log
            if self._connected:
                add_log("CONNECTED", f"Kiwoom 연결 성공 (코드={err_code})", True)
            else:
                add_log("DISCONNECTED", f"Kiwoom 연결 끊김 (코드={err_code})", False)
        except Exception:
            pass

        # M07: 연결 끊김 감지 → 즉각 재연결 + 긴급 매도 발동
        if prev_connected and not self._connected:
            try:
                from app.services.kiwoom_reconnect import on_disconnect_event
                from app.adapter.kiwoom.factory import get_broker_adapter
                on_disconnect_event(
                    get_adapter_fn=get_broker_adapter,
                    on_status_change_fn=self._on_reconnect_status,
                    session_factory=self._session_factory,
                )
            except Exception as e:
                self._mark(f"[재연결] 즉각 대응 실패: {e}")

    def _on_reconnect_status(self, event: str, message: str):
        """재연결 상태 변경 콜백."""
        self._mark(f"[재연결] {event}: {message}")
        try:
            from app.api.connection_log_routes import add_log
            connected = event == "RECONNECTED"
            add_log(event, message, connected)
        except Exception:
            pass

    def _on_receive_msg(self, screen_no: str, rq_name: str, tr_code: str, msg: str) -> None:
        self._mark(f"[MSG] {screen_no}/{rq_name}/{tr_code}: {msg}")

    def _on_receive_tr_data(
        self, screen_no: str, rq_name: str, tr_code: str,
        record_name: str, prev_next: str, *_args
    ) -> None:
        self._mark(f"[TR] {screen_no}/{rq_name}/{tr_code}/next={prev_next}")

    def _on_receive_real_data(self, code: str, real_type: str, real_data: str) -> None:
        """H02 수정: FID 10 현재가 수신 후 콜백 호출."""
        if self._ocx is None:
            return
        current_price = 0
        try:
            raw = self._ocx.dynamicCall("GetCommRealData(QString,int)", code, 10)
            current_price = abs(int(raw or 0))
            if current_price > 0 and self._on_price_update:
                self._on_price_update(code, current_price)
        except Exception as e:
            self._mark(f"[REAL ERROR] {code}: {e}")
        self._mark(f"[REAL] {code}/{real_type} price={current_price if current_price else '?'}")

    def _on_receive_chejan_data(self, gubun: str, item_cnt: int, fid_list: str) -> None:
        """H01 수정: FID 수신 후 체결 콜백 호출."""
        if self._ocx is None:
            return
        try:
            def get(fid: int) -> str:
                return str(self._ocx.dynamicCall("GetChejanData(int)", fid) or "").strip()

            code = get(9001).lstrip("A")
            filled_qty   = abs(int(get(910) or 0))
            remain_qty   = abs(int(get(902) or 0))
            filled_price = abs(int(get(911) or 0))

            if self._on_chejan:
                self._on_chejan(code, filled_qty, remain_qty, filled_price)

            self._mark(
                f"[CHEJAN] gubun={gubun} code={code} "
                f"filled={filled_qty}@{filled_price} remain={remain_qty}"
            )
        except Exception as e:
            self._mark(f"[CHEJAN ERROR] {e}")

    # ── 공개 메서드 ────────────────────────────────────────────────

    def connect(self) -> BrokerStatus:
        if self._ocx is None:
            return self.get_status()
        self._ocx.dynamicCall("CommConnect()")
        self._mark("로그인 요청 중")
        return self.get_status()

    def disconnect(self) -> BrokerStatus:
        self._connected = False
        self._mark("연결 해제(수동)")
        try:
            from app.api.connection_log_routes import add_log
            add_log("DISCONNECTED", "연결 해제", False)
        except Exception:
            pass
        return self.get_status()

    def get_status(self) -> BrokerStatus:
        acct = self._accounts[0] if self._accounts else ""
        return BrokerStatus(
            mode="kiwoom", connected=self._connected,
            account_no=acct, message=self._last_message,
            last_event_at=self._last_event_at,
        )

    def get_accounts(self) -> list[str]:
        return self._accounts

    def get_available_cash(self) -> int:
        if self._ocx is None or not self._connected or not self._accounts:
            return 0
        try:
            acct = self._accounts[0]
            self._ocx.dynamicCall("SetInputValue(QString,QString)", "계좌번호", acct)
            from app.api.settings_routes import get_account_password
            pw = get_account_password()
            self._ocx.dynamicCall("SetInputValue(QString,QString)", "비밀번호", pw)
            self._ocx.dynamicCall("SetInputValue(QString,QString)", "비밀번호입력매체구분", "00")
            self._ocx.dynamicCall("SetInputValue(QString,QString)", "조회구분", "2")
            self._ocx.dynamicCall(
                "CommRqData(QString,QString,int,QString)",
                "주문가능금액조회", "opw00001", 0, "7001"
            )
            raw = self._ocx.dynamicCall(
                "GetCommData(QString,QString,int,QString)",
                "opw00001", "계좌평가잔고내역", 0, "주문가능금액"
            )
            return abs(int(str(raw).strip() or 0))
        except Exception:
            return 0

    def send_manual_buy(self, code: str, qty: int, price: int | None = None) -> dict[str, Any]:
        """C03 수정: SendOrder 실제 호출."""
        if self._ocx is None or not self._connected or not self._accounts:
            self._mark(f"BUY 실패(미연결) code={code}")
            return {"ok": False, "sent": False, "reason": "미연결"}
        hoga_gb = "00" if price else "03"
        order_price = price or 0
        ret = self._ocx.dynamicCall(
            "SendOrder(QString,QString,QString,int,QString,int,int,QString,QString)",
            ["매수주문", "0101", self._accounts[0], 1, code, qty, order_price, hoga_gb, ""]
        )
        self._mark(f"BUY 전송 code={code} qty={qty} price={order_price} ret={ret}")
        return {"ok": ret == 0, "sent": True, "mode": "kiwoom",
                "code": code, "qty": qty, "price": order_price}

    def send_sell(self, code: str, qty: int, order_type: str = "MARKET", price: int | None = None) -> dict[str, Any]:
        """C03 수정: SendOrder 실제 호출."""
        if self._ocx is None or not self._connected or not self._accounts:
            self._mark(f"SELL 실패(미연결) code={code}")
            return {"ok": False, "sent": False, "reason": "미연결"}
        hoga_gb = "03" if order_type == "MARKET" else "00"
        order_price = price or 0
        ret = self._ocx.dynamicCall(
            "SendOrder(QString,QString,QString,int,QString,int,int,QString,QString)",
            ["매도주문", "0102", self._accounts[0], 2, code, qty, order_price, hoga_gb, ""]
        )
        self._mark(f"SELL 전송 code={code} qty={qty} type={order_type} ret={ret}")
        return {"ok": ret == 0, "sent": True, "mode": "kiwoom",
                "code": code, "qty": qty, "order_type": order_type}

    def load_condition_list(self) -> list[dict[str, Any]]:
        if self._ocx is None:
            return []
        self._ocx.dynamicCall("GetConditionLoad()")
        raw = self._ocx.dynamicCall("GetConditionNameList()")
        result = []
        for item in str(raw).split(";"):
            if "^" in item:
                idx, name = item.split("^", 1)
                result.append({"index": int(idx), "name": name})
        return result

    def run_condition(self, screen_no: str, condition_name: str, condition_index: int) -> list[str]:
        if self._ocx is None:
            return []
        self._ocx.dynamicCall(
            "SendCondition(QString,QString,int,int)",
            screen_no, condition_name, condition_index, 0
        )
        return []

    def register_real(self, screen_no: str, code: str, fids: list[int]) -> dict[str, Any]:
        if self._ocx is not None:
            fid_str = ";".join(map(str, fids))
            self._ocx.dynamicCall(
                "SetRealReg(QString,QString,QString,QString)",
                screen_no, code, fid_str, "0"
            )
        self._mark(f"실시간 등록 screen={screen_no} code={code}")
        return {"ok": True, "screen_no": screen_no, "code": code, "fids": fids}

    def remove_real(self, screen_no: str, code: str) -> dict[str, Any]:
        if self._ocx is not None:
            self._ocx.dynamicCall("SetRealRemove(QString,QString)", screen_no, code)
        self._mark(f"실시간 해제 screen={screen_no} code={code}")
        return {"ok": True, "screen_no": screen_no, "code": code}
