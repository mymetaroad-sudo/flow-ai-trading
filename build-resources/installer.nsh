; Roadflow AI Lite V1 - NSIS 커스텀 인스톨러 스크립트
; Python 가상환경 설치 자동화

!macro customInstall
  ; 설치 후 Python 패키지 자동 설치
  DetailPrint "Python 패키지 설치 중..."
  nsExec::ExecToLog '"$INSTDIR\resources\python-embedded\python.exe" -m pip install -r "$INSTDIR\resources\backend\requirements.txt" --no-warn-script-location'
  DetailPrint "패키지 설치 완료"
!macroend

!macro customUnInstall
  DetailPrint "Roadflow AI Lite V1 제거 중..."
!macroend
