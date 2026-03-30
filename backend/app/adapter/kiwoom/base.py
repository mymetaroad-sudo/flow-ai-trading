from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any

@dataclass
class BrokerStatus:
    mode: str
    connected: bool
    account_no: str
    message: str = ""
    last_event_at: str | None = None
    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

class BrokerAdapter:
    def connect(self) -> BrokerStatus: raise NotImplementedError
    def disconnect(self) -> BrokerStatus: raise NotImplementedError
    def get_status(self) -> BrokerStatus: raise NotImplementedError
    def get_accounts(self) -> list[str]: raise NotImplementedError
    def send_manual_buy(self, code: str, qty: int, price: int | None = None) -> dict[str, Any]: raise NotImplementedError
    def send_sell(self, code: str, qty: int, order_type: str = "MARKET", price: int | None = None) -> dict[str, Any]: raise NotImplementedError
    def load_condition_list(self) -> list[dict[str, Any]]: raise NotImplementedError
    def run_condition(self, screen_no: str, condition_name: str, condition_index: int) -> list[str]: raise NotImplementedError
    def register_real(self, screen_no: str, code: str, fids: list[int]) -> dict[str, Any]: raise NotImplementedError
    def remove_real(self, screen_no: str, code: str) -> dict[str, Any]: raise NotImplementedError
