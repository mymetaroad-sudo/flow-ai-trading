from __future__ import annotations
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.database import get_session, engine
from app.models.entities import (
    Recommendation, Position, OrderQueueItem,
    ScoreAdjustmentProposal, DecisionLog, DailyRiskState,
)
from app.schemas.broker import ManualOrderRequest, RealRegRequest
from app.services.broker_service import (
    broker_accounts, broker_conditions, broker_connect,
    broker_disconnect, broker_status,
)
from app.services.market import get_market_summary
from app.services.order_worker import process_next_order_sync
from app.core.config import settings

router = APIRouter()


@router.get("/health")
def health():
    return {"ok": True, "timestamp": datetime.utcnow().isoformat(), "version": settings.app_version}


@router.get("/dashboard/summary")
def dashboard_summary():
    return get_market_summary()


# ── 브로커 ──────────────────────────────────────────────────────

@router.get("/broker/status")
def get_broker_status():
    return broker_status()

@router.post("/broker/connect")
def connect_broker():
    return broker_connect()

@router.post("/broker/disconnect")
def disconnect_broker():
    return broker_disconnect()

@router.get("/broker/accounts")
def get_broker_accounts():
    return {"accounts": broker_accounts()}

@router.get("/broker/conditions")
def get_broker_conditions():
    return broker_conditions()

@router.post("/broker/real/register")
def register_real(payload: RealRegRequest):
    from app.adapter.kiwoom.factory import get_broker_adapter
    return get_broker_adapter().register_real(payload.screen_no, payload.code, payload.fids)

@router.post("/broker/real/remove")
def remove_real(payload: RealRegRequest):
    from app.adapter.kiwoom.factory import get_broker_adapter
    return get_broker_adapter().remove_real(payload.screen_no, payload.code)


# ── 추천 / 포지션 ────────────────────────────────────────────────

@router.get("/recommendations")
def list_recommendations(session: Session = Depends(get_session)):
    return session.exec(select(Recommendation).order_by(Recommendation.rank)).all()

@router.get("/positions")
def list_positions(session: Session = Depends(get_session)):
    return session.exec(select(Position)).all()


# ── 주문 큐 ──────────────────────────────────────────────────────

@router.get("/order-queue")
def list_queue(session: Session = Depends(get_session)):
    return session.exec(select(OrderQueueItem).order_by(OrderQueueItem.priority)).all()

@router.post("/order-queue/process-next")
def run_order_queue(session: Session = Depends(get_session)):
    return process_next_order_sync(session)


# ── 매수 주문 ────────────────────────────────────────────────────

@router.post("/orders/buy")
def manual_buy(payload: ManualOrderRequest, session: Session = Depends(get_session)):
    today = str(date.today())

    risk = session.exec(
        select(DailyRiskState).where(DailyRiskState.trade_date == today)
    ).first()
    if risk and (risk.buy_blocked or risk.emergency_triggered):
        raise HTTPException(
            status_code=403,
            detail=f"매수 차단: {risk.block_reason or '비상탈출 발동'}"
        )

    rec = session.exec(
        select(Recommendation).where(Recommendation.code == payload.code)
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="추천 종목이 없습니다.")
    if rec.preopen_status == "REJECT":
        raise HTTPException(status_code=400, detail="REJECT 종목은 매수 불가합니다.")

    # 비중 기반 수량 계산
    qty = payload.qty
    if qty <= 1:
        from app.adapter.kiwoom.factory import get_broker_adapter
        adapter = get_broker_adapter()
        available = adapter.get_available_cash()
        if available > 0:
            summary = get_market_summary()
            invest_pct = (100 - summary["cashRatio"]) / 100
            rank_weights = {1: 0.37, 2: 0.27, 3: 0.22, 4: 0.14}
            w = rank_weights.get(rec.rank, 0.10)
            target_amount = int(settings.total_capital * invest_pct * w)
            target_amount = min(target_amount, available)
            pos = session.exec(
                select(Position).where(Position.code == payload.code)
            ).first()
            cur_price = int(pos.current_price) if pos and pos.current_price > 0 else 0
            if cur_price > 0:
                qty = max(1, target_amount // cur_price)

    queue_item = OrderQueueItem(
        priority=4, order_kind="BUY",
        code=payload.code, qty=qty, order_type="LIMIT",
    )
    session.add(queue_item)

    log = DecisionLog(
        session_date=today, stock_code=payload.code,
        event_type="BUY",
        final_score=rec.final_score, score_base=rec.base_score,
        score_theme=rec.theme_score, score_leader=rec.leader_score,
        score_expansion=rec.expansion_score, score_preopen=rec.preopen_score,
        score_penalty=rec.risk_penalty,
        go_watch_reject=rec.preopen_status,
        gwr_reason="수동 매수",
        is_manual=True, market_score=rec.market_score,
    )
    session.add(log)
    session.commit()
    session.refresh(queue_item)

    return {
        "message": "매수 주문이 큐에 등록되었습니다.",
        "item_id": queue_item.id,
        "code": payload.code,
        "qty": qty,
    }


# ── 비상탈출 ────────────────────────────────────────────────────

@router.post("/orders/emergency-exit")
def emergency_exit(session: Session = Depends(get_session)):
    positions = session.exec(select(Position).where(Position.status == "HOLDING")).all()
    count = 0
    for pos in positions:
        session.add(OrderQueueItem(
            priority=1, order_kind="EMERGENCY_SELL",
            code=pos.code, qty=pos.quantity, order_type="MARKET",
        ))
        count += 1

    today = str(date.today())
    risk = session.exec(
        select(DailyRiskState).where(DailyRiskState.trade_date == today)
    ).first()
    if not risk:
        risk = DailyRiskState(trade_date=today)
    risk.emergency_triggered = True
    risk.buy_blocked = True
    risk.block_reason = "비상탈출 발동 — 당일 재진입 금지"
    session.add(risk)
    session.commit()

    return {"message": "비상탈출 주문 등록", "count": count}


# ── Mock 전용 시뮬레이션 ─────────────────────────────────────────

def _get_mock_adapter():
    from app.adapter.kiwoom.factory import get_broker_adapter
    from app.adapter.kiwoom.mock import MockBrokerAdapter
    adapter = get_broker_adapter()
    if not isinstance(adapter, MockBrokerAdapter):
        raise HTTPException(status_code=400, detail="mock 모드에서만 사용 가능합니다.")
    return adapter


@router.post("/mock/simulate-fill")
def mock_simulate_fill(code: str, qty: int, price: int, remain: int = 0):
    """체결 콜백 강제 시뮬레이션 (1번·3번 검증용)"""
    adapter = _get_mock_adapter()
    adapter.simulate_fill(code, qty, price, remain)
    return {"ok": True, "code": code, "qty": qty, "price": price, "remain": remain}


@router.post("/mock/simulate-tick")
def mock_simulate_tick(code: str, price: int):
    """현재가 변동 시뮬레이션 (4번 검증용)"""
    adapter = _get_mock_adapter()
    adapter.simulate_price_tick(code, price)
    return {"ok": True, "code": code, "price": price}


@router.post("/mock/auto-tick")
def mock_auto_tick():
    """보유 종목 전체 랜덤 시세 변동"""
    adapter = _get_mock_adapter()
    with Session(engine) as s:
        positions = s.exec(
            select(Position).where(Position.status == "HOLDING")
        ).all()
        results = []
        for pos in positions:
            new_p = adapter.simulate_random_tick(pos.code, int(pos.current_price))
            results.append({"code": pos.code, "new_price": new_p})
    return {"ok": True, "ticks": results}


# ── 보정 제안 ────────────────────────────────────────────────────

@router.get("/adjustments")
def list_adjustments(session: Session = Depends(get_session)):
    return session.exec(select(ScoreAdjustmentProposal)).all()

@router.post("/adjustments/{proposal_id}/{decision}")
def decide_adjustment(
    proposal_id: int, decision: str,
    session: Session = Depends(get_session),
):
    proposal = session.get(ScoreAdjustmentProposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="보정 제안이 없습니다.")
    if decision not in {"OK", "REJECT", "HOLD"}:
        raise HTTPException(status_code=400, detail="허용되지 않은 결정값입니다.")
    proposal.decision = decision
    session.add(proposal)
    session.commit()
    session.refresh(proposal)
    return proposal


# ── 판정 로그 / 리스크 ──────────────────────────────────────────

@router.get("/decision-logs")
def list_decision_logs(session: Session = Depends(get_session)):
    return session.exec(
        select(DecisionLog).order_by(DecisionLog.event_time.desc()).limit(50)
    ).all()

@router.get("/risk-state")
def get_risk_state(session: Session = Depends(get_session)):
    today = str(date.today())
    state = session.exec(
        select(DailyRiskState).where(DailyRiskState.trade_date == today)
    ).first()
    if not state:
        return {"trade_date": today, "buy_blocked": False,
                "emergency_triggered": False, "consecutive_stops": 0}
    return state
