from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class Recommendation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str
    name: str
    theme: str
    rank: int
    final_score: float
    # L01 수정: FinalScore 합계 구성 요소
    base_score: float = 0.0
    theme_score: float = 0.0
    leader_score: float = 0.0
    expansion_score: float = 0.0
    preopen_score: float = 0.0
    risk_penalty: float = 0.0
    market_score: float = 0.0
    preopen_status: str = "WATCH"
    is_alternative: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Position(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str
    name: str
    quantity: int
    avg_price: float
    current_price: float
    stop_loss_price: float
    trailing_guard_price: float
    trailing_peak_pct: float = 0.0
    status: str = "READY"
    pnl_percent: float = 0.0
    split_stage: int = 0
    # L02 수정: ImpactRatio 퍼센트 계산 필드 추가
    daily_volume: int = 0
    close_decision: str = ""
    close_reason: str = ""
    closed_at: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class OrderQueueItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    priority: int
    order_kind: str
    code: str
    qty: int
    order_type: str
    status: str = "QUEUED"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ScoreAdjustmentProposal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    field_name: str
    current_value: float
    proposed_value: float
    reason: str
    decision: str = "PENDING"
    created_at: datetime = Field(default_factory=datetime.utcnow)


# H05 추가: 전체 이벤트 결정 로그 (Rev5 항목 18)
class DecisionLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_date: str
    stock_code: str
    stock_name: str = ""                    # ← 추가
    event_type: str                         # RECOMMEND / BUY / SELL_STOP / SELL_TRAIL / SELL_SPLIT / SELL_EMERGENCY / REJECT
    event_time: datetime = Field(default_factory=datetime.utcnow)
    final_score: float = 0.0
    score_base: float = 0.0
    score_theme: float = 0.0
    score_leader: float = 0.0
    score_expansion: float = 0.0
    score_preopen: float = 0.0
    score_penalty: float = 0.0
    go_watch_reject: str = ""
    gwr_reason: str = ""
    bid1_price: int = 0
    ask1_price: int = 0
    bid1_qty: int = 0
    entry_price: float = 0.0               # ← 추가 (진입 희망가)
    filled_price: float = 0.0
    slippage_pct: float = 0.0
    qty: int = 0                            # ← 추가 (체결 수량)
    realized_pnl: float = 0.0              # ← 추가 (실현 손익)
    pnl_pct: float = 0.0                   # ← 추가 (수익률 %)
    sell_trigger: str = ""
    is_manual: bool = False
    market_score: float = 0.0
    cash_ratio_applied: float = 0.0


# H06 추가: 계좌 위험 일일 상태 (Rev5 항목 17)
class DailyRiskState(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    trade_date: str
    realized_loss_pct: float = 0.0
    consecutive_stops: int = 0
    emergency_triggered: bool = False
    buy_blocked: bool = False
    block_reason: str = ""
    reset_at: Optional[datetime] = None


# ── 신규 추가 ──────────────────────────────────────────────────

# 가중치 자동조정 이력 (게시판용)
class WeightAdjustLog(SQLModel, table=True):
    __tablename__ = "weightadjustlog"

    id: Optional[int] = Field(default=None, primary_key=True)
    adjusted_at: datetime = Field(default_factory=datetime.utcnow)
    indicator_name: str                     # 조정된 지표명
    old_weight: float                       # 이전 가중치
    new_weight: float                       # 새 가중치
    change_ratio: float = 0.0              # 변화율 (배수)
    hit_count: int = 0                     # 적중 횟수
    miss_count: int = 0                    # 미적중 횟수
    hit_rate: float = 0.0                  # 적중률
    reason: str = ""                       # 조정 사유
    is_auto: bool = True                   # True=자동, False=수동


# 지표별 적중/미적중 이력
class AccuracyLog(SQLModel, table=True):
    __tablename__ = "accuracylog"

    id: Optional[int] = Field(default=None, primary_key=True)
    logged_at: datetime = Field(default_factory=datetime.utcnow)
    indicator_name: str
    stock_code: str
    predicted_direction: str               # "UP" | "DOWN"
    actual_direction: str = ""             # "UP" | "DOWN"
    is_hit: Optional[bool] = None
    score_contribution: float = 0.0
