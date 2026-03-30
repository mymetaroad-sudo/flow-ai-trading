# 구현 메모

## 기획서 반영 항목
- PC 전용 구조
- Electron + React + FastAPI + SQLite
- 매수 수동, 매도 자동 구조를 UI/API에 분리
- Top4/대안2 추천 테이블
- 장초반 GO/WATCH/REJECT 표시
- 포지션 카드에 손절가/Trailing 보호선/분할 단계 표시
- 주문 큐와 비상탈출 버튼 분리
- 점수 보정 제안 수락/거부/보류 API 포함

## 실제 개발 시 1차 추가 작업
1. PyKiwoom 또는 win32com 기반 키움 adapter 추가
2. 조건검색식 인덱스/이름 관리 화면 추가
3. OnReceiveRealData / OnReceiveChejanData 이벤트 브리지 구현
4. 포지션별 상태머신 전환 로직 백엔드 서비스화
5. order_queue 직렬 실행 워커 추가
6. SQLite 백업 스케줄러 추가
7. Excel 리포트 생성기 추가
8. Windows 인스톨러(electron-builder) 적용

## 권장 분리 구조
- `adapter/kiwoom/` : 키움 전용 연동
- `domain/` : 점수, 상태머신, 리스크 엔진
- `infrastructure/` : DB, 백업, 리포트, 로깅
- `ui/` : 대시보드, 판정, 포지션, 결산
