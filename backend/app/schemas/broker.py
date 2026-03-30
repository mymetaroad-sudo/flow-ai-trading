from pydantic import BaseModel

class ManualOrderRequest(BaseModel):
    code: str
    qty: int = 1
    price: int | None = None

class RealRegRequest(BaseModel):
    screen_no: str
    code: str
    fids: list[int]
