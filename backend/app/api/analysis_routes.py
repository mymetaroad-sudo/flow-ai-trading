from __future__ import annotations
"""
분석 API - 수동 재분석 트리거 + DB 실제 저장
"""
import time
import random
import threading
from datetime import datetime
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/analysis", tags=["analysis"])

_analysis_state = {
    "full_scan":   {"status": "idle", "started_at": None, "finished_at": None,
                    "progress": 0, "message": "", "result_count": 0},
    "top200_scan": {"status": "idle", "started_at": None, "finished_at": None,
                    "progress": 0, "message": "", "result_count": 0},
}
_lock = threading.Lock()


# ── 공통 헬퍼 ─────────────────────────────────────────────────────
def _set_state(key: str, **kwargs):
    with _lock:
        _analysis_state[key].update(kwargs)


def _mock_recommendations(count: int) -> list[dict]:
    """
    Mock 분석 결과 생성 - 실제 키움 연동 시 이 함수를 TR 조회로 교체
    실제 구현: 키움 조건검색 → 종목 수집 → FinalScore 계산 → 정렬
    """
    pool = [
        ("005930", "삼성전자",   "AI반도체",    85, 39, 18, 14, 8, 7, -1),
        ("000660", "SK하이닉스", "AI반도체",    82, 37, 18, 14, 7, 7,  1),
        ("247540", "에코프로비엠","2차전지",     78, 35, 15, 12, 8, 8,  0),
        ("196170", "알테오젠",   "바이오",       76, 33, 14, 11, 9, 9,  0),
        ("042700", "한미반도체", "AI반도체",    74, 32, 16, 12, 8, 6,  0),
        ("058470", "리노공업",   "반도체소부장", 73, 31, 14, 11, 8, 9,  0),
        ("035720", "카카오",     "플랫폼",       71, 30, 13, 10, 9, 9,  0),
        ("035420", "NAVER",      "플랫폼",       70, 29, 13, 10, 8, 9,  1),
        ("006400", "삼성SDI",    "2차전지",      69, 28, 14, 11, 8, 8,  0),
        ("051910", "LG화학",     "2차전지",      68, 27, 13, 10, 9, 9,  0),
    ]
    # 약간의 랜덤 변동 추가 (실제 시세 반영 흉내)
    results = []
    for i, (code, name, theme, fs, bs, ts, ls, es, ps, rp) in enumerate(pool[:count]):
        variance = random.randint(-3, 3)
        preopen = random.choice(["GO", "GO", "WATCH", "REJECT"])
        results.append({
            "code": code, "name": name, "theme": theme,
            "rank": i + 1,
            "final_score": max(60, fs + variance),
            "base_score": bs, "theme_score": ts, "leader_score": ls,
            "expansion_score": es, "preopen_score": ps, "risk_penalty": rp,
            "market_score": 73.0,
            "preopen_status": preopen if i >= 4 else ("GO" if i < 2 else "WATCH"),
            "is_alternative": i >= 4,
        })
    return results


def _save_recommendations(recs: list[dict]) -> int:
    """분석 결과를 DB Recommendation 테이블에 upsert"""
    from app.db.database import engine
    from app.models.entities import Recommendation
    from sqlmodel import Session, select

    with Session(engine) as session:
        # 기존 전체 삭제 후 새로 삽입 (단순 교체 방식)
        existing = session.exec(select(Recommendation)).all()
        for rec in existing:
            session.delete(rec)
        session.commit()

        for r in recs:
            obj = Recommendation(
                code=r["code"], name=r["name"], theme=r["theme"],
                rank=r["rank"], final_score=r["final_score"],
                base_score=r["base_score"], theme_score=r["theme_score"],
                leader_score=r["leader_score"], expansion_score=r["expansion_score"],
                preopen_score=r["preopen_score"], risk_penalty=r["risk_penalty"],
                market_score=r["market_score"],
                preopen_status=r["preopen_status"],
                is_alternative=r["is_alternative"],
            )
            session.add(obj)
        session.commit()
    return len(recs)


# ── 전체 스캔 ─────────────────────────────────────────────────────
def _run_full_scan():
    key = "full_scan"
    try:
        _set_state(key, status="running", progress=0,
                   started_at=datetime.now().isoformat(),
                   message="전체 종목 스캔 시작...")

        steps = [
            (15, "조건검색식 로드 중..."),
            (30, "전체 종목 수집 중 (약 2,500종목)..."),
            (50, "거래대금/등락률 필터 적용 중..."),
            (65, "테마 분류 분석 중..."),
            (80, "FinalScore 계산 중..."),
            (92, "Top4 + 대안 선정 중..."),
        ]
        for progress, msg in steps:
            time.sleep(1.5)
            _set_state(key, progress=progress, message=msg)

        # ★ 실제 DB 저장
        _set_state(key, progress=96, message="추천 종목 DB 저장 중...")
        recs = _mock_recommendations(10)
        saved = _save_recommendations(recs)

        _set_state(key, status="done", progress=100,
                   finished_at=datetime.now().isoformat(),
                   message=f"전체 스캔 완료. 추천 종목 {saved}개 갱신됨.",
                   result_count=saved)

    except Exception as e:
        _set_state(key, status="error",
                   finished_at=datetime.now().isoformat(),
                   message=f"오류: {str(e)}")


# ── 200종목 재분석 ────────────────────────────────────────────────
def _run_top200_scan():
    key = "top200_scan"
    try:
        _set_state(key, status="running", progress=0,
                   started_at=datetime.now().isoformat(),
                   message="200종목 재분석 시작...")

        steps = [
            (20, "추천 풀 종목 TR 조회 중..."),
            (45, "PreOpen 점수 갱신 중..."),
            (70, "GO/WATCH/REJECT 재판정 중..."),
            (90, "Top4 순위 재정렬 중..."),
        ]
        for progress, msg in steps:
            time.sleep(1.0)
            _set_state(key, progress=progress, message=msg)

        # ★ 기존 Recommendation 점수/판정만 업데이트
        _set_state(key, progress=95, message="판정 결과 DB 반영 중...")
        from app.db.database import engine
        from app.models.entities import Recommendation
        from sqlmodel import Session, select
        import random

        with Session(engine) as session:
            recs = session.exec(select(Recommendation)).all()
            for rec in recs:
                # 점수 소폭 갱신 + 판정 재계산 (실제는 키움 실시간 TR)
                variance = random.randint(-2, 2)
                rec.final_score = max(60, min(100, rec.final_score + variance))
                rec.preopen_score = max(0, min(10, rec.preopen_score + random.randint(-1, 1)))
                # 판정 재계산
                if rec.final_score >= 80 and not rec.is_alternative:
                    rec.preopen_status = "GO"
                elif rec.final_score >= 70:
                    rec.preopen_status = random.choice(["GO", "WATCH"])
                else:
                    rec.preopen_status = "WATCH"
            session.commit()
            count = len(recs)

        _set_state(key, status="done", progress=100,
                   finished_at=datetime.now().isoformat(),
                   message=f"재분석 완료. {count}개 종목 판정 갱신됨.",
                   result_count=count)

    except Exception as e:
        _set_state(key, status="error",
                   finished_at=datetime.now().isoformat(),
                   message=f"오류: {str(e)}")


# ── 엔드포인트 ────────────────────────────────────────────────────
@router.get("/status")
def get_analysis_status():
    with _lock:
        return dict(_analysis_state)


@router.post("/full-scan")
def trigger_full_scan():
    with _lock:
        if _analysis_state["full_scan"]["status"] == "running":
            raise HTTPException(400, "전체 스캔이 이미 진행 중입니다.")
    threading.Thread(target=_run_full_scan, daemon=True).start()
    return {"ok": True, "message": "전체 종목 스캔 시작. 약 15~20초 소요됩니다."}


@router.post("/top200-scan")
def trigger_top200_scan():
    with _lock:
        if _analysis_state["top200_scan"]["status"] == "running":
            raise HTTPException(400, "200종목 재분석이 이미 진행 중입니다.")
    threading.Thread(target=_run_top200_scan, daemon=True).start()
    return {"ok": True, "message": "200종목 재분석 시작. 약 5~8초 소요됩니다."}


@router.post("/reset/{scan_type}")
def reset_scan(scan_type: str):
    if scan_type not in ("full_scan", "top200_scan", "all"):
        raise HTTPException(400, "잘못된 스캔 유형입니다.")
    keys = ["full_scan", "top200_scan"] if scan_type == "all" else [scan_type]
    for k in keys:
        _set_state(k, status="idle", progress=0, message="",
                   started_at=None, finished_at=None, result_count=0)
    return {"ok": True}
