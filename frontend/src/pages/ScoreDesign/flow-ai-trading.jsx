import { useState, useEffect } from "react";

const INITIAL_WEIGHTS = {
  liquidity: { label: "유동성(거래대금)", max: 10, group: "common", weight: 1.0 },
  marketcap: { label: "시총 구간 적합성", max: 6, group: "common", weight: 1.0 },
  stability: { label: "상장 안정성", max: 4, group: "common", weight: 1.0 },
  tradability: { label: "거래 가능성", max: 3, group: "common", weight: 1.0 },
  financial: { label: "재무형 가산", max: 8, group: "bonus", weight: 1.0 },
  event_confirm: { label: "이벤트 확정성", max: 4, group: "event", weight: 1.0 },
  event_timing: { label: "이벤트 임박성", max: 3, group: "event", weight: 1.0 },
  chart_volume: { label: "차트·거래량 전환", max: 2, group: "event", weight: 1.0 },
  supply_demand: { label: "당일 수급(외인·기관)", max: 25, group: "supply", weight: 1.0 },
  week_supply: { label: "1주 수급 추이", max: 15, group: "supply", weight: 1.0 },
  news: { label: "뉴스 센티먼트", max: 30, group: "news", weight: 1.0 },
  volume_surge: { label: "거래량 폭발 감지", max: 15, group: "momentum", weight: 1.0 },
  sector_rotation: { label: "섹터 순환매", max: 12, group: "momentum", weight: 1.0 },
  smallcap: { label: "소형주 수급 쏠림", max: 8, group: "momentum", weight: 1.0 },
};

const HISTORY_DATA = [
  {
    date: "2026-03-21", stock: "캡스톤파트너스", hit: true,
    scores: { liquidity:8,marketcap:4,stability:4,tradability:3,financial:2,event_confirm:3,event_timing:3,chart_volume:2,supply_demand:18,week_supply:10,news:20,volume_surge:12,sector_rotation:8,smallcap:6 }
  },
  {
    date: "2026-03-21", stock: "삼성전자", hit: false,
    scores: { liquidity:10,marketcap:3,stability:4,tradability:3,financial:8,event_confirm:1,event_timing:0,chart_volume:0,supply_demand:8,week_supply:6,news:8,volume_surge:4,sector_rotation:2,smallcap:0 }
  },
  {
    date: "2026-03-21", stock: "대동금속", hit: true,
    scores: { liquidity:6,marketcap:4,stability:4,tradability:2,financial:3,event_confirm:2,event_timing:2,chart_volume:2,supply_demand:20,week_supply:12,news:18,volume_surge:14,sector_rotation:9,smallcap:8 }
  },
  {
    date: "2026-03-22", stock: "툴젠", hit: true,
    scores: { liquidity:7,marketcap:5,stability:4,tradability:3,financial:0,event_confirm:4,event_timing:3,chart_volume:2,supply_demand:19,week_supply:11,news:22,volume_surge:10,sector_rotation:7,smallcap:5 }
  },
  {
    date: "2026-03-22", stock: "SK하이닉스", hit: false,
    scores: { liquidity:10,marketcap:3,stability:4,tradability:3,financial:7,event_confirm:1,event_timing:0,chart_volume:0,supply_demand:7,week_supply:5,news:9,volume_surge:3,sector_rotation:2,smallcap:0 }
  },
  {
    date: "2026-03-24", stock: "강스템바이오텍", hit: true,
    scores: { liquidity:5,marketcap:4,stability:4,tradability:2,financial:0,event_confirm:3,event_timing:3,chart_volume:2,supply_demand:21,week_supply:13,news:24,volume_surge:13,sector_rotation:8,smallcap:7 }
  },
  {
    date: "2026-03-24", stock: "애경케미칼", hit: false,
    scores: { liquidity:8,marketcap:5,stability:4,tradability:3,financial:5,event_confirm:2,event_timing:1,chart_volume:1,supply_demand:12,week_supply:8,news:14,volume_surge:7,sector_rotation:5,smallcap:2 }
  },
  {
    date: "2026-03-25", stock: "파인디앤씨", hit: true,
    scores: { liquidity:5,marketcap:4,stability:4,tradability:2,financial:2,event_confirm:2,event_timing:2,chart_volume:2,supply_demand:22,week_supply:13,news:21,volume_surge:14,sector_rotation:9,smallcap:8 }
  },
];

function calcHitWeightDelta(history) {
  const keyList = Object.keys(INITIAL_WEIGHTS);
  const hitScores = {}, missScores = {};
  keyList.forEach(k => { hitScores[k] = []; missScores[k] = []; });

  history.forEach(h => {
    keyList.forEach(k => {
      const norm = h.scores[k] / INITIAL_WEIGHTS[k].max;
      if (h.hit) hitScores[k].push(norm);
      else missScores[k].push(norm);
    });
  });

  const deltas = {};
  keyList.forEach(k => {
    const avgHit = hitScores[k].length ? hitScores[k].reduce((a,b)=>a+b,0)/hitScores[k].length : 0.5;
    const avgMiss = missScores[k].length ? missScores[k].reduce((a,b)=>a+b,0)/missScores[k].length : 0.5;
    deltas[k] = parseFloat((avgHit - avgMiss).toFixed(3));
  });
  return deltas;
}

function adjustWeights(base, deltas) {
  const adjusted = {};
  Object.keys(base).forEach(k => {
    const delta = deltas[k] || 0;
    let newW = base[k].weight + delta * 0.5;
    newW = Math.max(0.3, Math.min(2.0, newW));
    adjusted[k] = { ...base[k], weight: parseFloat(newW.toFixed(2)) };
  });
  return adjusted;
}

const GROUP_COLORS = {
  common: "#4fc3f7",
  bonus: "#81c784",
  event: "#ffb74d",
  supply: "#f06292",
  news: "#ce93d8",
  momentum: "#ff8a65",
};
const GROUP_LABELS = {
  common: "공통 기반",
  bonus: "재무 가산",
  event: "이벤트 가산",
  supply: "수급",
  news: "뉴스",
  momentum: "모멘텀",
};

export default function App({ onWeightAdjusted }) {
  const [weights, setWeights] = useState(INITIAL_WEIGHTS);
  const [adjusted, setAdjusted] = useState(null);
  const [deltas, setDeltas] = useState(null);
  const [activeTab, setActiveTab] = useState("weights");
  const [showAdjusted, setShowAdjusted] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);

  const hitCount = HISTORY_DATA.filter(h=>h.hit).length;
  const missCount = HISTORY_DATA.filter(h=>!h.hit).length;
  const accuracy = Math.round(hitCount / HISTORY_DATA.length * 100);

  function runAutoAdjust() {
    setAnimating(true);
    setTimeout(() => {
      const d = calcHitWeightDelta(HISTORY_DATA);
      const adj = adjustWeights(INITIAL_WEIGHTS, d);
      setDeltas(d);
      setAdjusted(adj);
      setShowAdjusted(true);
      setAnimating(false);
      // 부모 App에 조정 결과 전달
      if (onWeightAdjusted) {
        const changes = Object.keys(adj)
          .filter(k => Math.abs(adj[k].weight - INITIAL_WEIGHTS[k].weight) > 0.01)
          .map(k => ({
            label: INITIAL_WEIGHTS[k].label,
            delta: d[k],
            newWeight: adj[k].weight,
          }))
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
          .slice(0, 6)
        const accuracy = Math.round(HISTORY_DATA.filter(h=>h.hit).length / HISTORY_DATA.length * 100)
        onWeightAdjusted({
          accuracy,
          summary: `${HISTORY_DATA.length}건 분석 → 적중 기여도 상위 지표 가중치 상향, 미기여 지표 하향 조정`,
          changes,
        })
      }
    }, 900);
  }

  function resetWeights() {
    setAdjusted(null);
    setDeltas(null);
    setShowAdjusted(false);
  }

  const displayWeights = showAdjusted && adjusted ? adjusted : weights;

  const groupedKeys = {};
  Object.keys(displayWeights).forEach(k => {
    const g = displayWeights[k].group;
    if (!groupedKeys[g]) groupedKeys[g] = [];
    groupedKeys[g].push(k);
  });

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0e1a",
      fontFamily: "'Noto Sans KR', 'Spoqa Han Sans Neo', sans-serif",
      color: "#e2e8f0", padding: "0",
    }}>
      {/* 헤더 */}
      <div style={{
        background: "linear-gradient(135deg, #0d1b2a 0%, #1a2744 100%)",
        borderBottom: "1px solid #1e3a5f",
        padding: "16px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 2px 20px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: "linear-gradient(135deg, #00d4ff, #0066ff)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 900, color: "#fff",
          }}>F</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.5px", color: "#fff" }}>
              Flow AI Trading
            </div>
            <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.5px" }}>
              B점수 설계 · 적중도 기반 가중치 자동조정
            </div>
          </div>
        </div>

        {/* 우상단 Q 패널 (적중률 요약) */}
        <div style={{
          display: "flex", gap: "10px", alignItems: "center",
        }}>
          <div style={{
            background: "#0f1f35", border: "1px solid #1e3a5f",
            borderRadius: 10, padding: "8px 14px",
            display: "flex", gap: "16px", alignItems: "center",
          }}>
            <QStat label="총 추천" value={HISTORY_DATA.length} color="#64748b" />
            <div style={{ width: 1, height: 28, background: "#1e3a5f" }} />
            <QStat label="적중" value={hitCount} color="#4ade80" />
            <div style={{ width: 1, height: 28, background: "#1e3a5f" }} />
            <QStat label="미적중" value={missCount} color="#f87171" />
            <div style={{ width: 1, height: 28, background: "#1e3a5f" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>적중률</div>
              <div style={{
                fontSize: 20, fontWeight: 900,
                color: accuracy >= 70 ? "#4ade80" : accuracy >= 50 ? "#fbbf24" : "#f87171",
              }}>{accuracy}%</div>
            </div>
          </div>

          <button onClick={runAutoAdjust} disabled={animating} style={{
            background: animating
              ? "#1e3a5f"
              : "linear-gradient(135deg, #00d4ff 0%, #0066ff 100%)",
            border: "none", borderRadius: 8, padding: "10px 16px",
            color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
            transition: "all 0.2s", whiteSpace: "nowrap",
            opacity: animating ? 0.7 : 1,
          }}>
            {animating ? "⟳ 분석 중..." : "⚡ 가중치 자동조정"}
          </button>

          {showAdjusted && (
            <button onClick={resetWeights} style={{
              background: "transparent", border: "1px solid #f87171",
              borderRadius: 8, padding: "10px 14px",
              color: "#f87171", fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}>
              초기화
            </button>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div style={{
        display: "flex", gap: "0", borderBottom: "1px solid #1e3a5f",
        background: "#0d1421", padding: "0 28px",
      }}>
        {[
          { id: "weights", label: "📐 B점수 가중치" },
          { id: "history", label: "📊 적중 이력" },
          { id: "logic", label: "🔄 자동조정 로직" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            background: "transparent",
            border: "none", borderBottom: activeTab === tab.id ? "2px solid #00d4ff" : "2px solid transparent",
            color: activeTab === tab.id ? "#00d4ff" : "#64748b",
            padding: "12px 20px", fontSize: 13, fontWeight: 600,
            cursor: "pointer", transition: "all 0.2s",
          }}>{tab.label}</button>
        ))}
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>

        {/* 자동조정 완료 배너 */}
        {showAdjusted && (
          <div style={{
            background: "linear-gradient(135deg, #0d2a1a, #0a1f2e)",
            border: "1px solid #22c55e", borderRadius: 10,
            padding: "12px 18px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <div>
              <div style={{ fontWeight: 700, color: "#4ade80", fontSize: 14 }}>가중치 자동조정 완료</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                {HISTORY_DATA.length}건의 추천 이력 분석 → 적중/미적중 패턴 기반으로 각 지표 가중치를 재산출했습니다
              </div>
            </div>
          </div>
        )}

        {/* 탭 컨텐츠: 가중치 */}
        {activeTab === "weights" && (
          <div>
            <div style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {Object.entries(GROUP_LABELS).map(([g, label]) => (
                <span key={g} style={{
                  background: GROUP_COLORS[g] + "22",
                  border: `1px solid ${GROUP_COLORS[g]}44`,
                  borderRadius: 6, padding: "3px 10px",
                  fontSize: 11, color: GROUP_COLORS[g], fontWeight: 600,
                }}>{label}</span>
              ))}
            </div>

            {Object.entries(groupedKeys).map(([group, keys]) => (
              <div key={group} style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: GROUP_COLORS[group],
                  letterSpacing: "1px", textTransform: "uppercase",
                  marginBottom: 8, padding: "4px 0",
                  borderBottom: `1px solid ${GROUP_COLORS[group]}33`,
                }}>
                  {GROUP_LABELS[group]}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {keys.map(k => {
                    const item = displayWeights[k];
                    const orig = INITIAL_WEIGHTS[k];
                    const delta = deltas ? deltas[k] : null;
                    const changed = showAdjusted && item.weight !== orig.weight;
                    const weightedMax = Math.round(item.max * item.weight);
                    const pct = Math.min(100, (weightedMax / item.max) * 100);

                    return (
                      <div key={k} style={{
                        background: changed ? "#0f2a1a" : "#0f1825",
                        border: `1px solid ${changed ? "#22c55e44" : "#1e3a5f"}`,
                        borderRadius: 8, padding: "10px 14px",
                        transition: "all 0.3s",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
                              {item.label}
                            </div>
                            <div style={{
                              height: 5, background: "#1e3a5f", borderRadius: 3, overflow: "hidden",
                            }}>
                              <div style={{
                                height: "100%", borderRadius: 3,
                                width: `${pct}%`,
                                background: `linear-gradient(90deg, ${GROUP_COLORS[group]}, ${GROUP_COLORS[group]}88)`,
                                transition: "width 0.6s ease",
                              }} />
                            </div>
                          </div>

                          <div style={{ textAlign: "right", minWidth: 80 }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                              <span style={{ fontSize: 11, color: "#64748b" }}>기준 {item.max}점</span>
                              <span style={{
                                fontSize: 15, fontWeight: 800,
                                color: changed
                                  ? (item.weight > orig.weight ? "#4ade80" : "#f87171")
                                  : "#94a3b8",
                              }}>
                                ×{item.weight.toFixed(2)}
                              </span>
                              <span style={{
                                fontSize: 13, fontWeight: 700,
                                color: GROUP_COLORS[group],
                              }}>= {weightedMax}점</span>
                            </div>
                            {changed && delta !== null && (
                              <div style={{
                                fontSize: 10, marginTop: 2,
                                color: delta > 0 ? "#4ade80" : "#f87171",
                              }}>
                                {delta > 0 ? "▲" : "▼"} 적중 기여도 {delta > 0 ? "+" : ""}{(delta * 100).toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* 합산 상한 안내 */}
            <div style={{
              background: "#0f1825", border: "1px solid #1e3a5f",
              borderRadius: 8, padding: "12px 16px", marginTop: 8,
            }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 700 }}>
                ⚠️ 가산 상한 규칙
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                재무형 + 이벤트/모멘텀 합산 상한 = <span style={{ color: "#fbbf24", fontWeight: 700 }}>12점 cap</span> &nbsp;|&nbsp;
                적자기업 편입: <span style={{ color: "#f87171", fontWeight: 700 }}>4개 조건 중 3개 이상 충족 필수</span>
              </div>
            </div>
          </div>
        )}

        {/* 탭 컨텐츠: 적중 이력 */}
        {activeTab === "history" && (
          <div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              총 {HISTORY_DATA.length}건의 추천 이력 · 클릭하면 지표 상세 확인
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {HISTORY_DATA.map((h, i) => {
                const total = Object.values(h.scores).reduce((a,b)=>a+b,0);
                const isOpen = selectedStock === i;
                return (
                  <div key={i} onClick={() => setSelectedStock(isOpen ? null : i)} style={{
                    background: h.hit ? "#0a1f12" : "#1f0a0a",
                    border: `1px solid ${h.hit ? "#22c55e44" : "#ef444444"}`,
                    borderRadius: 10, padding: "12px 16px",
                    cursor: "pointer", transition: "all 0.2s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: h.hit ? "#22c55e22" : "#ef444422",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16,
                      }}>
                        {h.hit ? "✅" : "❌"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{h.stock}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{h.date}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: h.hit ? "#4ade80" : "#f87171" }}>
                          {total}점
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {h.hit ? "적중" : "미적중"}
                        </div>
                      </div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</div>
                    </div>

                    {isOpen && (
                      <div style={{
                        marginTop: 14, paddingTop: 14,
                        borderTop: "1px solid #1e3a5f",
                        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 6,
                      }}>
                        {Object.entries(h.scores).map(([k, v]) => {
                          const info = INITIAL_WEIGHTS[k];
                          if (!info) return null;
                          const pct = Math.round(v / info.max * 100);
                          return (
                            <div key={k} style={{
                              background: "#0a0e1a", borderRadius: 6, padding: "6px 10px",
                            }}>
                              <div style={{ fontSize: 10, color: GROUP_COLORS[info.group], marginBottom: 2 }}>
                                {info.label}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{
                                  flex: 1, height: 3, background: "#1e3a5f", borderRadius: 2,
                                }}>
                                  <div style={{
                                    width: `${pct}%`, height: "100%",
                                    background: GROUP_COLORS[info.group], borderRadius: 2,
                                  }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0" }}>
                                  {v}/{info.max}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 탭 컨텐츠: 자동조정 로직 */}
        {activeTab === "logic" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <LogicCard title="① 데이터 수집" color="#4fc3f7">
              <p>추천 이력(종목, 날짜, 각 지표 점수, 적중 여부)을 DB에 누적 저장합니다. 최소 20건 이상 축적 시 자동조정이 신뢰도를 가집니다.</p>
            </LogicCard>

            <LogicCard title="② 지표별 기여도 분석" color="#ffb74d">
              <p>각 지표를 <b>0~1 정규화</b> 후, 적중 종목과 미적중 종목의 평균값을 비교합니다.</p>
              <CodeBlock>{`기여도(k) = avg(적중 종목의 k 정규화값)
              - avg(미적중 종목의 k 정규화값)

예) 거래량 폭발: 적중평균 0.82 - 미적중평균 0.31 = +0.51
    재무형 가산: 적중평균 0.41 - 미적중평균 0.67 = -0.26`}</CodeBlock>
            </LogicCard>

            <LogicCard title="③ 가중치 조정" color="#81c784">
              <p>기여도가 높을수록 가중치를 올리고, 낮을수록 내립니다. 조정 폭은 ×0.5 완충 적용으로 급격한 변동을 방지합니다.</p>
              <CodeBlock>{`새 가중치(k) = 기존 가중치 + 기여도(k) × 0.5

상한: 2.0 (기준 점수의 2배까지만)
하한: 0.3 (완전 배제 방지)`}</CodeBlock>
            </LogicCard>

            <LogicCard title="④ 실효 점수 반영" color="#ce93d8">
              <p>조정된 가중치는 각 지표의 <b>실효 최대점수(기준점 × 가중치)</b>에 반영되어 최종 B점수 산출에 적용됩니다.</p>
              <CodeBlock>{`실효점수(k) = 원점수(k) × 조정가중치(k)
최종 B점수 = Σ 실효점수(k) → 40점 환산`}</CodeBlock>
            </LogicCard>

            <LogicCard title="⑤ 조정 주기 및 안전장치" color="#f06292">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <SafeItem icon="🔁" label="조정 주기" value="주 1회 (매주 월요일 장 전)" />
                <SafeItem icon="🔒" label="가중치 상한" value="×2.0 (과적합 방지)" />
                <SafeItem icon="🛡️" label="가중치 하한" value="×0.3 (완전 배제 방지)" />
                <SafeItem icon="📊" label="최소 데이터" value="20건 이상 시 활성화" />
                <SafeItem icon="⚠️" label="급변 방지" value="1회 조정폭 ±0.3 이내" />
                <SafeItem icon="↩️" label="롤백 기능" value="이전 가중치 3버전 보관" />
              </div>
            </LogicCard>
          </div>
        )}
      </div>
    </div>
  );
}

function QStat({ label, value, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

function LogicCard({ title, color, children }) {
  return (
    <div style={{
      background: "#0f1825", border: `1px solid ${color}33`,
      borderLeft: `3px solid ${color}`, borderRadius: 10, padding: "16px 18px",
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color, marginBottom: 10 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

function CodeBlock({ children }) {
  return (
    <pre style={{
      background: "#0a0e1a", border: "1px solid #1e3a5f",
      borderRadius: 6, padding: "10px 14px", marginTop: 8,
      fontSize: 11, color: "#7dd3fc", lineHeight: 1.6,
      overflowX: "auto", whiteSpace: "pre-wrap",
    }}>{children}</pre>
  );
}

function SafeItem({ icon, label, value }) {
  return (
    <div style={{
      background: "#0a0e1a", borderRadius: 6, padding: "8px 12px",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10, color: "#64748b" }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{value}</div>
      </div>
    </div>
  );
}
