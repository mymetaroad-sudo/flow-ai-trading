from app.adapter.kiwoom.factory import get_broker_adapter

def broker_status() -> dict:
    return get_broker_adapter().get_status().to_dict()

def broker_connect() -> dict:
    return get_broker_adapter().connect().to_dict()

def broker_disconnect() -> dict:
    return get_broker_adapter().disconnect().to_dict()

def broker_accounts() -> list[str]:
    return get_broker_adapter().get_accounts()

def broker_conditions() -> list[dict]:
    return get_broker_adapter().load_condition_list()
