"""
trade_log_routes.py
- GET  /api/trade-logs    : 매수/매도 실현 이력 (최근 30건)
- GET  /api/asset-summary : 자산 현황 (총평가금액, 현금, 실현손익 등)
"""
from fastapi import APIRouter
from sqlmodel import Session, select, desc
from app.db.database import engine
from app.models.entities import DecisionLog, Position
from datetime import datetime

router = APIRouter()


@router.get("/trade-logs")
def get_trade_logs():
    with Session(engine) as session:
        logs = session.exec(
            select(DecisionLog)
            .where(DecisionLog.event_type.in_([
                "BUY", "SELL_STOP", "SELL_TRAIL", "SELL_SPLIT", "SELL_EMERGENCY"
            ]))
            .order_by(desc(DecisionLog.event_time))
            .limit(30)
        ).all()

        return [
            {
                "time": log.event_time.strftime("%H:%M:%S") if log.event_time else "",
                "code": log.stock_code,
                "name": log.stock_name or log.stock_code,
                "type": _type_label(log.event_type),
                "qty": log.qty,
                "price": log.filled_price or log.entry_price,
                "pnl": log.realized_pnl,
                "pnl_pct": log.pnl_pct,
                "is_manual": log.is_manual,
            }
            for log in logs
        ]


def _type_label(event_type: str) -> str:
    return {
        "BUY": "매수",
        "SELL_STOP": "손절매도",
        "SELL_TRAIL": "트레일매도",
        "SELL_SPLIT": "분할매도",
        "SELL_EMERGENCY": "긴급매도",
    }.get(event_type, event_type)


@router.get("/asset-summary")
def get_asset_summary():
    with Session(engine) as session:
        positions = session.exec(
            select(Position).where(Position.status != "CLOSED")
        ).all()

        stock_value = sum(
            pos.current_price * pos.quantity for pos in positions
        )
        unrealized_pnl = sum(
            (pos.current_price - pos.avg_price) * pos.quantity for pos in positions
        )

        # 당일 실현손익
        today_str = datetime.now().strftime("%Y-%m-%d")
        sell_logs = session.exec(
            select(DecisionLog)
            .where(DecisionLog.session_date == today_str)
            .where(DecisionLog.event_type.in_([
                "SELL_STOP", "SELL_TRAIL", "SELL_SPLIT", "SELL_EMERGENCY"
            ]))
        ).all()
        realized_pnl = sum(log.realized_pnl for log in sell_logs)

        # 총 자본 (기본값 3억)
        total_capital = 300_000_000
        cash = max(total_capital - stock_value, 0)
        total_value = cash + stock_value

        return {
            "total_value": int(total_value),
            "cash": int(cash),
            "stock_value": int(stock_value),
            "realized_pnl": int(realized_pnl),
            "unrealized_pnl": int(unrealized_pnl),
            "total_capital": int(total_capital),
            "cash_ratio": round(cash / total_value * 100, 1) if total_value > 0 else 100,
            "positions": [
                {
                    "code": pos.code,
                    "name": pos.name,
                    "qty": pos.quantity,
                    "avg_price": pos.avg_price,
                    "current_price": pos.current_price,
                    "value": int(pos.current_price * pos.quantity),
                    "pnl_pct": pos.pnl_percent,
                    "weight_pct": round(pos.current_price * pos.quantity / total_value * 100, 1) if total_value > 0 else 0,
                }
                for pos in positions
            ],
        }
