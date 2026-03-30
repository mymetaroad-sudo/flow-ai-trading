from sqlmodel import Session, select
from app.core.config import settings
from app.models.entities import (
    Recommendation, Position, OrderQueueItem,
    ScoreAdjustmentProposal, DailyRiskState,
)
from datetime import date


def seed_data(session: Session) -> None:
    # M02 수정: kiwoom 모드에서는 샘플 데이터 삽입 생략
    if settings.broker_mode != "mock":
        return

    has_data = session.exec(select(Recommendation)).first()
    if has_data:
        return

    recommendations = [
        Recommendation(
            code="005930", name="삼성전자", theme="AI반도체", rank=1,
            final_score=83, base_score=38, theme_score=17, leader_score=13,
            expansion_score=8, preopen_score=8, risk_penalty=-1,
            market_score=73, preopen_status="GO",
        ),
        Recommendation(
            code="000660", name="SK하이닉스", theme="AI반도체", rank=2,
            final_score=80, base_score=36, theme_score=17, leader_score=13,
            expansion_score=7, preopen_score=7, risk_penalty=0,
            market_score=73, preopen_status="GO",
        ),
        Recommendation(
            code="247540", name="에코프로비엠", theme="2차전지", rank=3,
            final_score=77, base_score=34, theme_score=15, leader_score=12,
            expansion_score=8, preopen_score=8, risk_penalty=0,
            market_score=73, preopen_status="WATCH",
        ),
        Recommendation(
            code="196170", name="알테오젠", theme="바이오", rank=4,
            final_score=75, base_score=33, theme_score=14, leader_score=11,
            expansion_score=8, preopen_score=9, risk_penalty=0,
            market_score=73, preopen_status="GO",
        ),
        Recommendation(
            code="042700", name="한미반도체", theme="AI반도체", rank=5,
            final_score=74, base_score=32, theme_score=16, leader_score=12,
            expansion_score=8, preopen_score=6, risk_penalty=0,
            market_score=73, preopen_status="REJECT", is_alternative=True,
        ),
        Recommendation(
            code="058470", name="리노공업", theme="반도체소부장", rank=6,
            final_score=73, base_score=31, theme_score=14, leader_score=11,
            expansion_score=8, preopen_score=9, risk_penalty=0,
            market_score=73, preopen_status="WATCH", is_alternative=True,
        ),
    ]

    positions = [
        Position(
            code="005930", name="삼성전자", quantity=120,
            avg_price=81200, current_price=83600,
            stop_loss_price=78360, trailing_guard_price=0.0,
            trailing_peak_pct=2.96, status="HOLDING",
            pnl_percent=2.96, split_stage=0, daily_volume=500_000_000_000,
        ),
        Position(
            code="196170", name="알테오젠", quantity=18,
            avg_price=287000, current_price=301500,
            stop_loss_price=276000, trailing_guard_price=294000,
            trailing_peak_pct=5.05, status="HOLDING",
            pnl_percent=5.05, split_stage=1, daily_volume=120_000_000_000,
        ),
    ]

    queue = [
        OrderQueueItem(priority=4, order_kind="BUY", code="005930", qty=120, order_type="LIMIT"),
        OrderQueueItem(priority=2, order_kind="SELL_STOP", code="196170", qty=18, order_type="MARKET"),
    ]

    proposals = [
        ScoreAdjustmentProposal(
            field_name="뉴스 점수",
            current_value=5, proposed_value=4,
            reason="최근 10건의 기여도 하락",
        ),
        ScoreAdjustmentProposal(
            field_name="기관/외인 수급",
            current_value=5, proposed_value=6,
            reason="Leader 종목을 주도 세력 판별에 필요",
        ),
    ]

    risk_state = DailyRiskState(trade_date=str(date.today()))

    for item in recommendations + positions + queue + proposals + [risk_state]:
        session.add(item)
    session.commit()
