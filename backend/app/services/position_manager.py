from __future__ import annotations
import logging
from datetime import datetime, date, timezone
from typing import Optional

from sqlmodel import Session, select

from app.db.database import engine
from app.domain.execution import determine_exit_action, calc_trailing_guard
from app.models.entities import Position, OrderQueueItem, DailyRiskState, DecisionLog

logger = logging.getLogger(__name__)

KST = timezone(datetime.now(timezone.utc).astimezone().utcoffset() or __import__('datetime').timedelta(hours=9))


def _session() -> Session:
    return Session(engine)


def _now_kst() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── 체결 콜백 ─────────────────────────────────────────────────────
def on_chejan(code: str, filled_qty: int, remain_qty: int, filled_price: int) -> None:
    if filled_qty <= 0:
        return

    with _session() as session:
        pos = session.exec(select(Position).where(Position.code == code)).first()

        if pos is None:
            # B09 수정: 종목명 조회 (키움 어댑터에서)
            name = _get_stock_name(code)
            pos = Position(
                code=code, name=name,
                quantity=filled_qty,
                avg_price=float(filled_price),
                current_price=float(filled_price),
                stop_loss_price=float(filled_price) * 0.965,
                trailing_guard_price=0.0,
                status="BUY_PARTIAL" if remain_qty > 0 else "HOLDING",
                pnl_percent=0.0, split_stage=0,
            )
            session.add(pos)
            logger.info(f"Position 생성: {code} qty={filled_qty} price={filled_price}")
        else:
            if pos.status in ("BUY_PARTIAL", "READY", "HOLDING"):
                total_qty = pos.quantity + filled_qty
                avg = (pos.avg_price * pos.quantity + filled_price * filled_qty) / total_qty
                pos.quantity = total_qty
                pos.avg_price = round(avg, 2)
                pos.stop_loss_price = round(avg * 0.965, 2)
                pos.status = "HOLDING" if remain_qty == 0 else "BUY_PARTIAL"
                pos.updated_at = _now_kst()
            elif pos.status in ("SELL_REQUEST", "HOLDING"):
                if remain_qty == 0:
                    pos.status = "SELL_DONE"
                    pos.quantity = 0
                    pos.closed_at = _now_kst()
                else:
                    pos.quantity = remain_qty
                pos.updated_at = _now_kst()

        # B04 수정: commit 전에 log 추가 → 한 번의 commit으로 처리
        log = DecisionLog(
            session_date=str(date.today()), stock_code=code,
            event_type="CHEJAN",
            gwr_reason=f"filled={filled_qty}@{filled_price} remain={remain_qty}",
            filled_price=float(filled_price),
        )
        session.add(log)
        session.commit()  # 한 번만 commit


def _get_stock_name(code: str) -> str:
    """종목명 조회 - 어댑터 통해 GetMasterCodeName 호출"""
    try:
        from app.adapter.kiwoom.factory import get_broker_adapter
        from app.adapter.kiwoom.openapi_bridge import KiwoomOpenApiAdapter
        adapter = get_broker_adapter()
        if isinstance(adapter, KiwoomOpenApiAdapter) and adapter._ocx is not None:
            name = adapter._ocx.dynamicCall("GetMasterCodeName(QString)", code)
            return str(name).strip() or code
    except Exception:
        pass
    return code  # fallback: 코드를 이름으로


# ── 현재가 수신 콜백 ──────────────────────────────────────────────
def on_price_update(code: str, current_price: int) -> None:
    if current_price <= 0:
        return

    with _session() as session:
        pos = session.exec(select(Position).where(Position.code == code)).first()
        if pos is None or pos.status != "HOLDING":
            return

        pos.current_price = float(current_price)
        pnl = (current_price - pos.avg_price) / pos.avg_price * 100
        pos.pnl_percent = round(pnl, 2)

        # Trailing 보호선 업데이트
        new_guard_pct = calc_trailing_guard(pnl)
        if new_guard_pct > -999:
            new_guard_price = round(pos.avg_price * (1 + new_guard_pct / 100), 0)
            if new_guard_price > pos.trailing_guard_price:
                pos.trailing_guard_price = new_guard_price
            pos.trailing_peak_pct = max(pos.trailing_peak_pct or 0.0, pnl)

        # B06 수정: 매도 판단 먼저, commit 전에 _enqueue_sell 호출
        action = determine_exit_action(
            pnl_percent=pnl,
            current_price=float(current_price),
            stop_loss_price=pos.stop_loss_price,
            trailing_guard_price=pos.trailing_guard_price,
            split_stage=pos.split_stage,
            position_value=float(current_price * pos.quantity),
            daily_volume=pos.daily_volume,
        )

        if action != "HOLD":
            _enqueue_sell(session, pos, action, current_price)
        else:
            pos.updated_at = _now_kst()
            session.commit()  # HOLD면 여기서 한 번만 commit


def _enqueue_sell(session: Session, pos: Position, action: str, current_price: int) -> None:
    # 중복 방지
    existing = session.exec(
        select(OrderQueueItem).where(
            OrderQueueItem.code == pos.code,
            OrderQueueItem.status == "QUEUED",
            OrderQueueItem.order_kind.in_(
                ["SELL_STOP", "TRAILING_SELL", "SPLIT_SELL", "EMERGENCY_SELL"]
            ),
        )
    ).first()
    if existing:
        return

    priority_map = {"EMERGENCY_EXIT": 1, "STOP_LOSS": 2, "TRAILING_SELL": 3, "SPLIT_SELL": 3}
    kind_map = {"EMERGENCY_EXIT": "EMERGENCY_SELL", "STOP_LOSS": "SELL_STOP",
                "TRAILING_SELL": "TRAILING_SELL", "SPLIT_SELL": "SPLIT_SELL"}

    priority = priority_map.get(action, 3)
    kind = kind_map.get(action, "SELL_STOP")
    order_type = "MARKET" if action in ("STOP_LOSS", "EMERGENCY_EXIT") else "BEST"
    qty = pos.quantity
    if action == "SPLIT_SELL":
        qty = max(1, pos.quantity // 2)

    item = OrderQueueItem(priority=priority, order_kind=kind,
                          code=pos.code, qty=qty, order_type=order_type)
    session.add(item)

    pos.status = "SELL_REQUEST"
    pos.updated_at = _now_kst()

    # B14 수정: consecutive_stop_limit 설정값 반영
    today = str(date.today())
    risk = session.exec(
        select(DailyRiskState).where(DailyRiskState.trade_date == today)
    ).first()
    if risk and action == "STOP_LOSS":
        risk.consecutive_stops = (risk.consecutive_stops or 0) + 1
        # B14 수정: config에서 한도값 가져오기
        from app.core.config import settings
        limit = settings.consecutive_stop_limit
        if risk.consecutive_stops >= limit:
            risk.buy_blocked = True
            risk.block_reason = f"연속 손절 {risk.consecutive_stops}회 — 매수 차단"

    # log 추가
    log = DecisionLog(
        session_date=today, stock_code=pos.code, event_type=kind,
        gwr_reason=f"action={action} pnl={pos.pnl_percent}%",
        filled_price=float(current_price), sell_trigger=action,
    )
    session.add(log)

    # B05 수정: 마지막에 한 번만 commit
    session.commit()
    logger.info(f"자동 매도 큐 등록: {pos.code} action={action} qty={qty}")
