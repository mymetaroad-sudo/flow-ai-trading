from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Roadflow AI Lite V1"
    app_version: str = "0.3.0"
    database_url: str = "sqlite:///./roadflow.db"
    broker_mode: str = "mock"
    kiwoom_account_no: str = ""
    kiwoom_user_id: str = ""
    kiwoom_screen_base: str = "7000"
    enable_order_worker: bool = True
    order_poll_interval_ms: int = 800
    daily_loss_limit_pct: float = 2.0
    consecutive_stop_limit: int = 2
    total_capital: int = 300_000_000

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
