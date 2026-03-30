# Roadflow AI Lite V1

반자동 테마 트레이딩 시스템 · PC 전용 · 키움 OpenAPI+ 연동

---

## 설치 방법 (Windows)

### 방법 A: 설치 파일(.exe) 직접 사용 — 권장

1. `Roadflow AI Lite V1 Setup.exe` 실행
2. 설치 경로 선택 후 설치
3. 바탕화면 바로가기로 실행

### 방법 B: 소스에서 직접 빌드

#### 사전 준비
- Node.js 18 이상 (https://nodejs.org)
- Python 3.11 64bit (https://python.org)
- Git (선택)

#### 빌드 순서

```
1. Python Embedded 준비 (최초 1회)
   PowerShell에서:
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   .\scripts\download-python.ps1

2. 설치 파일 빌드
   build.bat 더블클릭

3. 완료 후 dist-electron\ 폴더에서 .exe 실행
```

---

## 개발 모드 실행

```
start-dev.bat       → 브라우저에서 개발
start-electron-dev.bat → Electron 앱으로 개발
```

브라우저 접속: http://localhost:5173
API 문서: http://localhost:8000/docs

---

## 키움 실거래 모드 전환

1. 키움증권 HTS 설치
2. OpenAPI+ 신청 (https://www1.kiwoom.com/nkw.templateFrameSet.do?m=m1408000000)
3. 모의투자 계좌 개설
4. `backend\.env` 파일 수정:

```env
BROKER_MODE=kiwoom
KIWOOM_ACCOUNT_NO=모의계좌번호
```

5. 앱 재시작 → 브로커 연결 버튼 → 로그인 팝업

> ⚠️ 키움 OpenAPI+는 **Windows 32bit COM** 방식이므로
> Python도 **32bit 버전**이 필요합니다.

---

## 폴더 구조

```
roadflow-ai-lite/
├── build.bat              ← 설치 파일 빌드 (더블클릭)
├── start-dev.bat          ← 개발 모드 실행
├── start-electron-dev.bat ← Electron 개발 모드
├── scripts/
│   └── download-python.ps1 ← Python Embedded 다운로드
├── python-embedded/       ← 번들 Python (빌드 후 생성)
├── build-resources/       ← 아이콘 등 빌드 리소스
├── backend/               ← FastAPI 백엔드
├── frontend/              ← React 프론트엔드
├── electron/              ← Electron 메인
│   ├── main.js
│   └── preload.js
└── dist-electron/         ← 빌드 결과물 (빌드 후 생성)
```

---

## 버전 이력

| 버전 | 내용 |
|------|------|
| v0.3.1 | Mock 매수 오류 수정, 체결 상태 전환 완성, PositionManager 추가 |
| v0.3.0 | 21개 이슈 수정, DecisionLog/DailyRiskState 추가 |
| v0.2.0 | 키움 어댑터 구조, 주문 큐, 브로커 API |
| v0.1.0 | 초기 프로토타입 |

---

## 로그 파일 위치

```
Windows: C:\Users\사용자명\AppData\Roaming\roadflow-ai-lite\logs\
```
