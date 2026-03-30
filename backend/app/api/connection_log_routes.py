from __future__ import annotations
"""
연결 로그 API - 브로커 연결/해제 이벤트를 최근 20건 보관
"""
from datetime import datetime
from collections import deque
from threading import Lock
from fastapi import APIRouter

router = APIRouter(prefix="/connection-log", tags=["connection-log"])

_logs: deque = deque(maxlen=20)
_lock = Lock()


def add_log(event: str, message: str, connected: bool) -> None:
    """position_manager나 어댑터에서 호출"""
    with _lock:
        _logs.appendleft({
            "time": datetime.now().strftime("%H:%M:%S"),
            "event": event,
            "message": message,
            "connected": connected,
        })


@router.get("")
def get_logs():
    with _lock:
        return list(_logs)


@router.delete("")
def clear_logs():
    with _lock:
        _logs.clear()
    return {"ok": True}
