from __future__ import annotations
from app.core.config import settings
from .base import BrokerAdapter
from .mock import MockBrokerAdapter
from .openapi_bridge import KiwoomOpenApiAdapter

_adapter: BrokerAdapter | None = None


def get_broker_adapter() -> BrokerAdapter:
    """싱글톤 어댑터 반환. PositionManager 콜백을 주입한다."""
    global _adapter
    if _adapter is None:
        _adapter = _create_adapter()
    return _adapter


def _create_adapter() -> BrokerAdapter:
    from app.services.position_manager import on_chejan, on_price_update

    if settings.broker_mode == "kiwoom":
        return KiwoomOpenApiAdapter(
            on_price_update=on_price_update,
            on_chejan=on_chejan,
        )
    else:
        return MockBrokerAdapter(
            on_price_update=on_price_update,
            on_chejan=on_chejan,
        )


def reset_broker_adapter() -> None:
    """테스트 또는 재시작 시 어댑터 초기화"""
    global _adapter
    _adapter = None
