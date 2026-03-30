"""
order_worker.py
C06 수정: asyncio.Lock으로 직렬 처리 보장 + 400ms 딜레이
M04 수정: 주문 상태머신 전환 트리거 명시
"""
from __future__ import annotations
import asyncio
import logging
from datetime import date
from sqlmodel import Session, select
from app.adapter.kiwoom.factory import get_broker_adapter
from app.models.entities import OrderQueueItem, DailyRiskState

logger = logging.getLogger(__name__)

# C06 수정: 동시 실행 방지 Lock
_order_lock = asyncio.Lock()


def _get_or_create_risk_state(session: Session) -> DailyRiskState:
    today = str(date.today())
    state = session.exec(
        select(DailyRiskState).where(DailyRiskState.trade_date == today)
    ).first()
    if not state:
        state = DailyRiskState(trade_date=today)
        session.add(state)
        session.commit()
        session.refresh(state)
    return state


# ── 주문 상태머신 전환 트리거 (M04 수정) ──────────────────────────
# READY       → BUY_REQUEST  : 매수 버튼 클릭 (수동)
# BUY_REQUEST → BUY_FILLED   : 키움 체결 콜백 수신 (on_chejan)
# BUY_REQUEST → ERROR        : 주문 전송 실패 또는 60초 타임아웃
# BUY_FILLED  → HOLDING      : 체결 확인 후 포지션 등록 완료
# HOLDING     → SELL_REQUEST : 자동매도 조건 충족 (execution.py)
# HOLDING     → SELL_REQUEST : 비상탈출 버튼 클릭 (수동)
# SELL_REQUEST→ SELL_DONE    : 키움 매도 체결 콜백 수신
# SELL_REQUEST→ ERROR        : 매도 전송 실패 또는 60초 타임아웃
# ERROR       → READY        : 사용자 확인 후 재시도
# ──────────────────────────────────────────────────────────────────


async def process_next_order(session: Session) -> dict:
    """C06 수정: asyncio.Lock으로 직렬 처리 보장 + 400ms 딜레이."""
    async with _order_lock:
        item = session.exec(
            select(OrderQueueItem)
            .where(OrderQueueItem.status == "QUEUED")
            .order_by(OrderQueueItem.priority, OrderQueueItem.created_at)
        ).first()

        if not item:
            return {"processed": False, "message": "처리할 주문이 없습니다."}

        # 매수 주문이면 일일 손실/비상탈출 차단 확인
        if item.order_kind == "BUY":
            risk = _get_or_create_risk_state(session)
            if risk.buy_blocked or risk.emergency_triggered:
                return {
                    "processed": False,
                    "message": f"매수 차단: {risk.block_reason or '비상탈출 실행'}",
                }

        adapter = get_broker_adapter()
        if item.order_kind == "BUY":
            result = adapter.send_manual_buy(code=item.code, qty=item.qty)
        else:
            result = adapter.send_sell(
                code=item.code, qty=item.qty, order_type=item.order_type
            )

        # 상태 전환: QUEUED → SENT | FAILED
        item.status = "SENT" if result.get("ok") else "FAILED"
        session.add(item)
        session.commit()
        session.refresh(item)

        # 400ms 딜레이 (다음 주문 간격 보장)
        await asyncio.sleep(0.4)

        return {
            "processed": True,
            "item_id": item.id,
            "result": result,
            "queue_status": item.status,
        }


def process_next_order_sync(session: Session) -> dict:
    """동기 버전 (FastAPI 동기 엔드포인트용)."""
    item = session.exec(
        select(OrderQueueItem)
        .where(OrderQueueItem.status == "QUEUED")
        .order_by(OrderQueueItem.priority, OrderQueueItem.created_at)
    ).first()

    if not item:
        return {"processed": False, "message": "처리할 주문이 없습니다."}

    if item.order_kind == "BUY":
        risk = _get_or_create_risk_state(session)
        if risk.buy_blocked or risk.emergency_triggered:
            return {"processed": False, "message": f"매수 차단: {risk.block_reason}"}

    adapter = get_broker_adapter()
    if item.order_kind == "BUY":
        result = adapter.send_manual_buy(code=item.code, qty=item.qty)
    else:
        result = adapter.send_sell(
            code=item.code, qty=item.qty, order_type=item.order_type
        )

    item.status = "SENT" if result.get("ok") else "FAILED"
    session.add(item)
    session.commit()
    session.refresh(item)
    return {
        "processed": True,
        "item_id": item.id,
        "result": result,
        "queue_status": item.status,
    }
