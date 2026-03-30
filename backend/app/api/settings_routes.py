from __future__ import annotations
import re
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.config import settings

router = APIRouter(prefix="/settings", tags=["settings"])

_account_password: str = ""


def get_account_password() -> str:
    return _account_password


# B07 수정: __file__ 기준 절대 경로 (CWD와 무관)
def _env_path() -> Path:
    # settings_routes.py → api/ → app/ → backend/ → .env
    return Path(__file__).parent.parent.parent / ".env"


def _read_env() -> dict:
    p = _env_path()
    result = {}
    if not p.exists():
        return result
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            result[k.strip()] = v.strip()
    return result


def _write_env(data: dict) -> None:
    _env_path().write_text(
        "\n".join(f"{k}={v}" for k, v in data.items()) + "\n",
        encoding="utf-8"
    )


class AppSettings(BaseModel):
    broker_mode: str
    kiwoom_account_no: str
    kiwoom_user_id: str
    total_capital: int
    daily_loss_limit_pct: float
    consecutive_stop_limit: int
    has_password: bool = False
    env_path: str = ""   # 디버그용: 실제 .env 경로 표시


class UpdateSettingsRequest(BaseModel):
    broker_mode: str | None = None
    kiwoom_account_no: str | None = None
    kiwoom_user_id: str | None = None
    kiwoom_account_password: str | None = None
    total_capital: int | None = None
    daily_loss_limit_pct: float | None = None
    consecutive_stop_limit: int | None = None


@router.get("", response_model=AppSettings)
def get_settings():
    env = _read_env()
    return AppSettings(
        broker_mode=env.get("BROKER_MODE", settings.broker_mode),
        kiwoom_account_no=env.get("KIWOOM_ACCOUNT_NO", settings.kiwoom_account_no),
        kiwoom_user_id=env.get("KIWOOM_USER_ID", settings.kiwoom_user_id),
        total_capital=int(env.get("TOTAL_CAPITAL", settings.total_capital)),
        daily_loss_limit_pct=float(env.get("DAILY_LOSS_LIMIT_PCT", settings.daily_loss_limit_pct)),
        consecutive_stop_limit=int(env.get("CONSECUTIVE_STOP_LIMIT", settings.consecutive_stop_limit)),
        has_password=bool(_account_password),
        env_path=str(_env_path()),
    )


@router.post("")
def update_settings(req: UpdateSettingsRequest):
    global _account_password
    env = _read_env()

    if req.broker_mode is not None:
        if req.broker_mode not in ("mock", "kiwoom"):
            raise HTTPException(400, "broker_mode는 mock 또는 kiwoom만 가능합니다.")
        env["BROKER_MODE"] = req.broker_mode

    if req.kiwoom_account_no is not None:
        if req.kiwoom_account_no and not re.match(r"^\d{8,12}$", req.kiwoom_account_no):
            raise HTTPException(400, "계좌번호는 8~12자리 숫자입니다.")
        env["KIWOOM_ACCOUNT_NO"] = req.kiwoom_account_no

    if req.kiwoom_user_id is not None:
        env["KIWOOM_USER_ID"] = req.kiwoom_user_id

    if req.total_capital is not None:
        if req.total_capital < 1_000_000:
            raise HTTPException(400, "운용자금은 최소 100만원 이상입니다.")
        env["TOTAL_CAPITAL"] = str(req.total_capital)

    if req.daily_loss_limit_pct is not None:
        if not 0.5 <= req.daily_loss_limit_pct <= 10.0:
            raise HTTPException(400, "일일 손실 한도는 0.5~10% 범위입니다.")
        env["DAILY_LOSS_LIMIT_PCT"] = str(req.daily_loss_limit_pct)

    if req.consecutive_stop_limit is not None:
        if not 1 <= req.consecutive_stop_limit <= 10:
            raise HTTPException(400, "연속 손절 차단은 1~10회 범위입니다.")
        env["CONSECUTIVE_STOP_LIMIT"] = str(req.consecutive_stop_limit)

    if req.kiwoom_account_password is not None:
        _account_password = req.kiwoom_account_password

    _write_env(env)
    return {
        "ok": True,
        "message": "설정이 저장되었습니다. 브로커 모드 변경 시 앱을 재시작하세요.",
        "restart_required": req.broker_mode is not None,
    }


@router.delete("/password")
def clear_password():
    global _account_password
    _account_password = ""
    return {"ok": True, "message": "비밀번호가 초기화되었습니다."}
