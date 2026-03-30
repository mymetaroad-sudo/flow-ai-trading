from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session
from app.api.routes import router
from app.api.settings_routes import router as settings_router
from app.api.analysis_routes import router as analysis_router
from app.api.connection_log_routes import router as conn_log_router
from app.api.trade_log_routes import router as trade_log_router
from app.db.database import engine, init_db
from app.services.bootstrap import seed_data
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # DB 초기화
    init_db()
    with Session(engine) as session:
        seed_data(session)

    # A01 수정: Windows 슬립 방지 (장중 자동 활성화)
    try:
        from app.services.sleep_prevent import apply_by_market_hours
        apply_by_market_hours()
    except Exception as e:
        print(f"[슬립방지] 초기화 실패 (무시): {e}")

    # M07 수정: Kiwoom 모드일 때만 재연결 감시 시작
    if settings.broker_mode == "kiwoom":
        try:
            from app.adapter.kiwoom.factory import get_broker_adapter
            from app.services.kiwoom_reconnect import start_reconnect_watcher
            from app.api.connection_log_routes import add_log

            def on_status_change(event: str, message: str):
                connected = event == "RECONNECTED"
                add_log(event, message, connected)

            start_reconnect_watcher(get_broker_adapter, on_status_change)
        except Exception as e:
            print(f"[재연결 감시] 초기화 실패 (무시): {e}")

    yield

    # 종료 시 슬립 방지 해제
    try:
        from app.services.sleep_prevent import allow_sleep
        allow_sleep()
    except Exception:
        pass

    # 종료 시 재연결 감시 중지
    try:
        from app.services.kiwoom_reconnect import stop_reconnect_watcher
        stop_reconnect_watcher()
    except Exception:
        pass


app = FastAPI(
    title="Flow AI Trading",
    version="0.3.0",
    lifespan=lifespan,
)

# H07 수정: CORS 로컬 전용 제한
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "app://.",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(analysis_router, prefix="/api")
app.include_router(conn_log_router, prefix="/api")
app.include_router(trade_log_router, prefix="/api")
