from __future__ import annotations
from typing import Literal

PositionAction = Literal[
    "HOLD", "STOP_LOSS", "TRAILING_SELL",
    "SPLIT_SELL", "EMERGENCY_EXIT"
]

# Step Trailing 단계 정의 (Rev5 설계서 섹션 7.3)
TRAILING_STEPS = [
    (7.0, 3.0),
    (12.0, 7.0),
    (17.0, 12.0),
    (25.0, 17.0),
]


def calc_trailing_guard(pnl_percent: float) -> float:
    """최고 수익률 기준 보호선 반환. 7% 미만이면 보호선 없음(-999)."""
    guard = -999.0
    for peak, lock in TRAILING_STEPS:
        if pnl_percent >= peak:
            guard = lock
    if pnl_percent > 25.0:
        extra = int((pnl_percent - 25.0) / 5.0)
        guard = 17.0 + extra * 5.0
    return guard


def calc_impact_ratio(position_value: float, daily_volume: int) -> float:
    """ImpactRatio = 보유금액 / 당일 거래대금. 거래대금 0이면 0 반환."""
    if daily_volume <= 0:
        return 0.0
    return position_value / daily_volume


def decide_split_count(impact_ratio: float) -> int:
    """ImpactRatio 기준 분할 횟수 결정 (Rev5 설계서 섹션 7.4)."""
    if impact_ratio < 0.003:
        return 1   # 전량
    elif impact_ratio < 0.008:
        return 2
    elif impact_ratio < 0.015:
        return 3
    else:
        return 4


def determine_exit_action(
    pnl_percent: float,
    current_price: float,
    stop_loss_price: float,
    trailing_guard_price: float,
    split_stage: int,
    position_value: float = 0.0,
    daily_volume: int = 0,
    emergency: bool = False,
) -> PositionAction:
    """
    C04 수정: 우선순위 재정립
    1. 비상탈출
    2. 손절 (Trailing 비활성 구간 pnl < 7%)
    3. Trailing (pnl >= 7%)
    4. 분할 매도 (ImpactRatio 기반)
    5. HOLD
    """
    if emergency:
        return "EMERGENCY_EXIT"

    # 손절: Trailing 미활성(pnl < 7%) 구간에서만 동작
    if pnl_percent < 7.0 and current_price <= stop_loss_price:
        return "STOP_LOSS"

    # Trailing: pnl >= 7% 이후 보호선 도달 시
    if pnl_percent >= 7.0 and current_price <= trailing_guard_price:
        return "TRAILING_SELL"

    # 분할 매도: Trailing 미발동 상태에서 수익 구간 진입
    if pnl_percent >= 10.0 and split_stage == 0:
        if position_value > 0 and daily_volume > 0:
            impact = calc_impact_ratio(position_value, daily_volume)
            if decide_split_count(impact) >= 2:
                return "SPLIT_SELL"

    return "HOLD"
