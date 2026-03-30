# 키움 연동 구현 계획

## 현재 반영된 구조
- `adapter/kiwoom/base.py` : 브로커 인터페이스
- `adapter/kiwoom/mock.py` : 모의 브로커
- `adapter/kiwoom/openapi_bridge.py` : Windows용 키움 ActiveX 브리지 구조
- `services/order_worker.py` : 주문 큐 1건 처리
- `api/routes.py` : 브로커 상태 / 연결 / 조건검색 / 실시간 등록 API

## 실제 구현 순서
1. 로그인 및 계좌번호 조회
2. 조건검색식 목록 불러오기
3. 전일 16:05 스캔 실행
4. 후보 종목만 TR 상세조회
5. 보유 종목별 SetRealReg
6. 체결 콜백으로 주문 상태 동기화
7. 매수 버튼 클릭 -> queue 등록 -> worker 순차 실행
8. 자동 손절/Trailing/분할 매도 주문 생성
