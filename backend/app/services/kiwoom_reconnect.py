"""
kiwoom_reconnect.py
M07 개선: 이벤트 기반 즉각 재연결 + 긴급 매도 안전망

연결 끊김 감지 방식 2가지:
1. OnEventConnect 이벤트 (즉각) → KiwoomOpenApiAdapter에서 호출
2. 폴링 감시 (포지션 보유 중 3초, 미보유 중 30초) → 이벤트 누락 대비

매도 안전망 3단계:
1. 연결 끊김 감지 순간 → 긴급 매도 큐 즉시 생성
2. 재연결 성공 순간 → 긴급 매도 즉시 실행
3. 목표: 연결 끊김 → 매도 실행까지 5초 이내
"""
from __future__ import annotations
import asyncio
import logging

logger = logging.getLogger(__name__)

_reconnect_task: asyncio.Task | None = None
_reconnect_count: int = 0
_is_reconnecting: bool = False

MAX_RECONNECT = 3
POLL_INTERVAL_HOLDING = 3    # 포지션 보유 중 감시 주기 (초)
POLL_INTERVAL_IDLE    = 30   # 포지션 없을 때 감시 주기 (초)
RECONNECT_DELAYS      = [0, 3, 6]  # 재연결 시도 간격 (초)


def _create_emergency_sell_queue(session_factory):
    """연결 끊김 감지 즉시 보유 포지션 전체를 긴급 매도 큐에 삽입."""
    try:
        from sqlmodel import select
        from app.models.entities import Position, OrderQueueItem

        with session_factory() as session:
            positions = session.exec(
                select(Position).where(Position.status == "HOLDING")
            ).all()

            if not positions:
                logger.info("[긴급매도] 보유 포지션 없음")
                return 0

            created = 0
            for pos in positions:
                existing = session.exec(
                    select(OrderQueueItem).where(
                        OrderQueueItem.code == pos.code,
                        OrderQueueItem.status == "QUEUED",
                        OrderQueueItem.order_kind == "SELL_EMERGENCY",
                    )
                ).first()
                if existing:
                    continue

                emergency_order = OrderQueueItem(
                    priority=0,
                    order_kind="SELL_EMERGENCY",
                    code=pos.code,
                    qty=pos.quantity,
                    order_type="MARKET",
                    status="QUEUED",
                )
                session.add(emergency_order)
                created += 1
                logger.warning(
                    f"[긴급매도] 큐 생성: {pos.code} {pos.quantity}주 "
                    f"(현재가: {pos.current_price}, 손절가: {pos.stop_loss_price})"
                )

            session.commit()
            return created

    except Exception as e:
        logger.error(f"[긴급매도] 큐 생성 실패: {e}")
        return 0


async def _flush_emergency_orders(session_factory, get_adapter_fn):
    """재연결 성공 직후 긴급 매도 큐를 즉시 처리."""
    try:
        from sqlmodel import select
        from app.models.entities import OrderQueueItem

        with session_factory() as session:
            emergency_orders = session.exec(
                select(OrderQueueItem).where(
                    OrderQueueItem.status == "QUEUED",
                    OrderQueueItem.order_kind == "SELL_EMERGENCY",
                ).order_by(OrderQueueItem.created_at)
            ).all()

            if not emergency_orders:
                return

            adapter = get_adapter_fn()
            for order in emergency_orders:
                logger.warning(f"[긴급매도] 즉시 실행: {order.code} {order.qty}주")
                result = adapter.send_sell(
                    code=order.code,
                    qty=order.qty,
                    order_type="MARKET",
                )
                order.status = "SENT" if result.get("ok") else "FAILED"
                session.add(order)
                await asyncio.sleep(0.4)

            session.commit()
            logger.info(f"[긴급매도] {len(emergency_orders)}건 처리 완료")

    except Exception as e:
        logger.error(f"[긴급매도] 즉시 실행 실패: {e}")


async def _attempt_reconnect(get_adapter_fn, on_status_change_fn, session_factory):
    """재연결 시도 (최대 3회, 간격: 0→3→6초)."""
    global _reconnect_count, _is_reconnecting

    if _is_reconnecting:
        return
    _is_reconnecting = True

    try:
        for attempt, delay in enumerate(RECONNECT_DELAYS, 1):
            if delay > 0:
                await asyncio.sleep(delay)

            logger.warning(f"[재연결] 시도 {attempt}/{MAX_RECONNECT}")
            if on_status_change_fn:
                on_status_change_fn("RECONNECTING", f"재연결 시도 중 {attempt}/{MAX_RECONNECT}")

            try:
                adapter = get_adapter_fn()
                adapter.connect()
                await asyncio.sleep(2)

                status = adapter.get_status()
                if status.get("connected"):
                    _reconnect_count = 0
                    logger.info(f"[재연결] 성공 ({attempt}회차)")
                    if on_status_change_fn:
                        on_status_change_fn("RECONNECTED", f"재연결 성공 ({attempt}회차)")

                    if session_factory:
                        await _flush_emergency_orders(session_factory, get_adapter_fn)
                    return True

            except Exception as e:
                logger.error(f"[재연결] {attempt}회차 오류: {e}")

        logger.error(f"[재연결] 최대 횟수({MAX_RECONNECT}회) 초과")
        if on_status_change_fn:
            on_status_change_fn("RECONNECT_FAILED", f"재연결 {MAX_RECONNECT}회 실패 — 수동 확인 필요")
        return False

    finally:
        _is_reconnecting = False


def on_disconnect_event(get_adapter_fn, on_status_change_fn=None, session_factory=None):
    """
    KiwoomOpenApiAdapter._on_event_connect(err_code != 0) 에서 호출.
    연결 끊김 즉각 대응:
    1. 긴급 매도 큐 즉시 생성
    2. 재연결 시도 (비동기)
    """
    logger.warning("[재연결] OnEventConnect 끊김 이벤트 → 즉각 대응")

    if session_factory:
        created = _create_emergency_sell_queue(session_factory)
        if created > 0:
            logger.warning(f"[긴급매도] {created}건 긴급 매도 큐 생성됨")

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(
                _attempt_reconnect(get_adapter_fn, on_status_change_fn, session_factory)
            )
        else:
            asyncio.run(
                _attempt_reconnect(get_adapter_fn, on_status_change_fn, session_factory)
            )
    except Exception as e:
        logger.error(f"[재연결] 비동기 실행 실패: {e}")


async def _poll_loop(get_adapter_fn, on_status_change_fn, session_factory):
    """폴링 감시 (이벤트 누락 대비 백업). 포지션 보유 중: 3초, 미보유: 30초."""
    while True:
        try:
            interval = POLL_INTERVAL_IDLE
            if session_factory:
                try:
                    from sqlmodel import select, func
                    from app.models.entities import Position
                    with session_factory() as session:
                        count = session.exec(
                            select(func.count(Position.id)).where(Position.status == "HOLDING")
                        ).one()
                        if count > 0:
                            interval = POLL_INTERVAL_HOLDING
                except Exception:
                    pass

            await asyncio.sleep(interval)

            if _is_reconnecting:
                continue

            adapter = get_adapter_fn()
            status = adapter.get_status()
            if not status.get("connected"):
                logger.warning(f"[폴링감시] 연결 끊김 감지 (주기: {interval}초)")
                on_disconnect_event(get_adapter_fn, on_status_change_fn, session_factory)

        except Exception as e:
            logger.error(f"[폴링감시] 오류: {e}")


def start_reconnect_watcher(get_adapter_fn, on_status_change_fn=None, session_factory=None):
    """재연결 감시 시작 (kiwoom 모드에서만 호출)."""
    global _reconnect_task
    if _reconnect_task and not _reconnect_task.done():
        return
    loop = asyncio.get_event_loop()
    _reconnect_task = loop.create_task(
        _poll_loop(get_adapter_fn, on_status_change_fn, session_factory)
    )
    logger.info(
        f"[재연결] 감시 시작 "
        f"(보유중: {POLL_INTERVAL_HOLDING}초, 미보유: {POLL_INTERVAL_IDLE}초)"
    )


def stop_reconnect_watcher():
    """재연결 감시 중지."""
    global _reconnect_task
    if _reconnect_task and not _reconnect_task.done():
        _reconnect_task.cancel()
        _reconnect_task = None
        logger.info("[재연결] 감시 중지")


def reset_reconnect_count():
    global _reconnect_count
    _reconnect_count = 0
