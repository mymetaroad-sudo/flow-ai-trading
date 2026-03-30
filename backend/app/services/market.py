"""
market.py
A01 수정: 글로벌 뉴스 소스 미정의 → NASDAQ 선물 데이터 기반으로 대체
PreOpenScore(글로벌 반영) = NASDAQ 선물 등락률 기반 점수
"""
from __future__ import annotations
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


# ── NASDAQ 선물 등락률 → PreOpen 점수 환산표 ──────────────────────
# 출처: yfinance 또는 Kiwoom 해외지수 TR (OPT10028)
NASDAQ_SCORE_TABLE = [
    (2.0,  10),   # +2% 이상 → 10점 (최고)
    (1.0,  8),    # +1~2%   → 8점
    (0.3,  6),    # +0.3~1% → 6점
    (-0.3, 4),    # ±0.3%   → 4점 (보합)
    (-1.0, 2),    # -0.3~-1%→ 2점
    (-2.0, 1),    # -1~-2%  → 1점
    (float('-inf'), 0),  # -2% 이하 → 0점
]


def nasdaq_futures_to_score(change_pct: float) -> int:
    """NASDAQ 선물 등락률(%) → PreOpenScore(0~10점) 환산."""
    for threshold, score in NASDAQ_SCORE_TABLE:
        if change_pct >= threshold:
            return score
    return 0


def get_preopen_score_from_nasdaq(nasdaq_change_pct: float | None) -> dict:
    """
    NASDAQ 선물 데이터로 PreOpenScore 계산.
    nasdaq_change_pct: NASDAQ 선물 등락률 (%). None이면 보합(4점) 처리.
    """
    if nasdaq_change_pct is None:
        logger.warning("[글로벌반영] NASDAQ 선물 데이터 없음 → 보합(4점) 기본값 사용")
        return {
            "preopen_score": 4,
            "nasdaq_change_pct": None,
            "source": "default",
            "note": "데이터 없음 → 보합 처리",
        }

    score = nasdaq_futures_to_score(nasdaq_change_pct)
    direction = "상승" if nasdaq_change_pct > 0.3 else "하락" if nasdaq_change_pct < -0.3 else "보합"

    logger.info(f"[글로벌반영] NASDAQ 선물 {nasdaq_change_pct:+.2f}% → PreOpenScore {score}점 ({direction})")

    return {
        "preopen_score": score,
        "nasdaq_change_pct": nasdaq_change_pct,
        "direction": direction,
        "source": "nasdaq_futures",
        "calculated_at": datetime.now().isoformat(),
    }


def get_market_summary() -> dict:
    """
    routes.py에서 호출하는 대시보드 요약 함수.
    V1에서는 NASDAQ 선물 데이터 없이 기본값(보합) 사용.
    실제 연동 시 nasdaq_change_pct 값을 주입하면 됨.
    """
    return get_market_score(nasdaq_change_pct=None)


def get_market_score(nasdaq_change_pct: float | None = None) -> dict:
    """
    전체 시장 점수 계산.
    V1에서는 NASDAQ 선물만 사용.
    V1.5부터 S&P500, VIX, 환율 추가 예정.
    """
    preopen = get_preopen_score_from_nasdaq(nasdaq_change_pct)

    # MarketScore: NASDAQ 선물 기반 시장 분위기 (0~100)
    nasdaq_score = preopen["preopen_score"]
    market_score = 30 + (nasdaq_score * 7)  # 30 ~ 100 범위

    risk_mode = (
        "RISK_ON"  if market_score >= 65 else
        "RISK_OFF" if market_score <= 40 else
        "NEUTRAL"
    )

    return {
        "marketScore": market_score,
        "riskMode": risk_mode,
        "preopen": preopen,
        "cashRatio": 10 if risk_mode == "RISK_ON" else 20 if risk_mode == "NEUTRAL" else 30,
        "scanCompletedAt": datetime.now().strftime("%H:%M:%S"),
    }
