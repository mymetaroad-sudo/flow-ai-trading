"""
sleep_prevent.py
A01 수정: Windows 슬립/화면보호기 방지
장중(09:00~15:35) 자동 활성화, 장외 시간 자동 해제
"""
from __future__ import annotations
import ctypes
import logging
import platform
from datetime import datetime, time

logger = logging.getLogger(__name__)

# Windows API 상수
ES_CONTINUOUS       = 0x80000000
ES_SYSTEM_REQUIRED  = 0x00000001
ES_DISPLAY_REQUIRED = 0x00000002

MARKET_START = time(8, 50)   # 장 시작 전 여유
MARKET_END   = time(15, 35)  # 장 마감 후 여유


def _is_windows() -> bool:
    return platform.system() == "Windows"


def prevent_sleep():
    """Windows 슬립/화면보호기 방지 활성화."""
    if not _is_windows():
        return
    try:
        ctypes.windll.kernel32.SetThreadExecutionState(
            ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED
        )
        logger.info("[슬립방지] 활성화")
    except Exception as e:
        logger.warning(f"[슬립방지] 활성화 실패: {e}")


def allow_sleep():
    """Windows 슬립/화면보호기 방지 해제."""
    if not _is_windows():
        return
    try:
        ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS)
        logger.info("[슬립방지] 해제")
    except Exception as e:
        logger.warning(f"[슬립방지] 해제 실패: {e}")


def is_market_hours() -> bool:
    """현재 시각이 장 운영 시간(08:50~15:35)인지 확인."""
    now = datetime.now().time()
    return MARKET_START <= now <= MARKET_END


def apply_by_market_hours():
    """장중이면 슬립 방지, 장외면 해제."""
    if is_market_hours():
        prevent_sleep()
    else:
        allow_sleep()
