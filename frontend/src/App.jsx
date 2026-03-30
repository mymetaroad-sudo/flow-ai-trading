import React, { useEffect, useState, useCallback, useRef } from 'react'
import SettingsModal from './components/SettingsModal'
import FlowAITrading from './pages/ScoreDesign/flow-ai-trading'

const API = 'http://127.0.0.1:8000/api'

async function api(path, options = {}) {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || res.statusText)
    }
    return await res.json()
  } catch (e) {
    console.error('[API error]', path, e.message)
    return null
  }
}

function Card({ title, children, extra }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{title}</div>
        {extra}
      </div>
      {children}
    </div>
  )
}

function BrokerBadge({ connected, mode }) {
  return (
    <span className={`badge ${connected ? 'go' : 'reject'}`}>
      {mode?.toUpperCase()} · {connected ? 'CONNECTED' : 'DISCONNECTED'}
    </span>
  )
}

function RiskBanner({ risk }) {
  if (!risk || (!risk.buy_blocked && !risk.emergency_triggered)) return null
  return (
    <div style={{
      background: '#7f1d1d', border: '1px solid #dc2626',
      borderRadius: 10, padding: '10px 16px', marginBottom: 16,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 18 }}>🚨</span>
      <div>
        <strong style={{ color: '#fca5a5' }}>매수 차단 중</strong>
        <span style={{ color: '#fca5a5', marginLeft: 10, fontSize: 13 }}>
          {risk.block_reason || '비상 탈출 실행 또는 일일 손실 한도 초과'}
        </span>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('main')
  const [summary, setSummary] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [positions, setPositions] = useState([])
  const [queue, setQueue] = useState([])
  const [adjustments, setAdjustments] = useState([])
  const [broker, setBroker] = useState({ mode: 'mock', connected: false })
  const [accounts, setAccounts] = useState([])
  const [conditions, setConditions] = useState([])
  const [risk, setRisk] = useState(null)
  const [decisionLogs, setDecisionLogs] = useState([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsData, setSettingsData] = useState(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState(null)
  const [connLogs, setConnLogs] = useState([])
  const [toasts, setToasts] = useState([])
  const [selectedRec, setSelectedRec] = useState(null)
  const [tradeLogs, setTradeLogs] = useState([])
  const [assetSummary, setAssetSummary] = useState(null)
  const [weightLogs, setWeightLogs] = useState([])

  const loadAll = useCallback(async () => {
    const j = (url) => fetch(url)
      .then(x => { if (!x.ok) throw new Error(x.status); return x.json(); })
      .catch(() => null)
    const [s, r, p, q, a, b, acc, cond, rk, dl, sv] = await Promise.all([
      j(`${API}/dashboard/summary`),
      j(`${API}/recommendations`),
      j(`${API}/positions`),
      j(`${API}/order-queue`),
      j(`${API}/adjustments`),
      j(`${API}/broker/status`),
      j(`${API}/broker/accounts`),
      j(`${API}/broker/conditions`),
      j(`${API}/risk-state`),
      j(`${API}/decision-logs`),
      j(`${API}/settings`),
    ])
    if (s) setSummary(s)
    if (r) setRecommendations(r)
    if (p) setPositions(p)
    if (q) setQueue(q)
    if (a) setAdjustments(a)
    if (b) setBroker(b)
    if (acc) setAccounts(acc.accounts || [])
    if (cond) setConditions(cond || [])
    if (rk) setRisk(rk)
    if (dl) setDecisionLogs(dl.slice(0, 20))
    if (sv) setSettingsData(sv)
    const as = await j(`${API}/analysis/status`)
    if (as) setAnalysisStatus(as)
    const cl = await j(`${API}/connection-log`)
    if (cl) setConnLogs(cl)
    const tl = await j(`${API}/trade-logs`)
    if (tl) setTradeLogs(tl.slice(0, 30))
    const ast = await j(`${API}/asset-summary`)
    if (ast) setAssetSummary(ast)
  }, [])

  function addToast(msg, type = 'info') {
    const id = Date.now()
    setToasts(prev => [{ id, msg, type }, ...prev].slice(0, 5))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  const analysisPollerRef = useRef(null)

  function startAnalysisPoller() {
    if (analysisPollerRef.current) return
    analysisPollerRef.current = setInterval(async () => {
      const j = (url) => fetch(url).then(x => x.json()).catch(() => null)
      const as = await j(`${API}/analysis/status`)
      if (!as) return
      setAnalysisStatus(as)
      const allDone = Object.values(as).every(s => s.status !== 'running')
      if (allDone) {
        clearInterval(analysisPollerRef.current)
        analysisPollerRef.current = null
        const r = await j(`${API}/recommendations`)
        if (r) setRecommendations(r)
        addToast('분석 완료! 추천 종목이 업데이트됐습니다.', 'ok')
      }
    }, 1000)
  }

  async function triggerFullScan() {
    const r = await api('/analysis/full-scan', { method: 'POST' })
    if (r?.ok) { addToast(r.message, 'info'); startAnalysisPoller() }
    else addToast(r?.message || '스캔 시작 실패', 'error')
  }

  async function triggerTop200Scan() {
    const r = await api('/analysis/top200-scan', { method: 'POST' })
    if (r?.ok) { addToast(r.message, 'info'); startAnalysisPoller() }
    else addToast(r?.message || '스캔 시작 실패', 'error')
  }

  useEffect(() => {
    loadAll()
    const timer = setInterval(loadAll, 5000)
    if (window.roadflowAPI) {
      window.roadflowAPI.onBackendCrash((data) => {
        alert('백엔드 서버가 종료됐습니다. 앱을 다시 시작해주세요.\n코드: ' + data.code)
      })
    }
    return () => clearInterval(timer)
  }, [loadAll])

  const isBuyWindowOpen = () => {
    const now = new Date()
    const h = now.getHours(), m = now.getMinutes()
    return (h === 9 && m >= 1 && m <= 5) || (h < 9)
  }
  const buyWindowOpen = isBuyWindowOpen()

  async function manualBuy(code, preopen_status) {
    if (preopen_status !== 'GO') return
    if (!buyWindowOpen && import.meta.env.PROD) return
    const res = await api('/orders/buy', { method: 'POST', body: JSON.stringify({ code, qty: 1 }) })
    if (!res) alert('매수 요청 실패. 백엔드 상태를 확인하세요.')
    loadAll()
  }

  async function emergencyExit() {
    const step1 = window.confirm('🚨 비상 탈출\n\n현재 보유한 모든 종목이 즉시 매도됩니다.\n당일 추가 매수가 전부 차단됩니다.\n\n정말 실행하시겠습니까?')
    if (!step1) return
    const acct = accounts[0] || ''
    const input = prompt(`확인을 위해 계좌번호 뒤 4자리를 입력하세요 (계좌: ...${acct.slice(-4)}):`)
    if (input !== acct.slice(-4)) { alert('계좌번호가 일치하지 않습니다. 취소됐습니다.'); return }
    await fetch(`${API}/orders/emergency-exit`, { method: 'POST' }).catch(() => {})
    loadAll()
  }

  async function processNextOrder() {
    const result = await api('/order-queue/process-next', { method: 'POST' })
    if (result) {
      if (result.processed) addToast(`주문 처리: ${result.result?.code || ''} ${result.queue_status}`, 'ok')
      else addToast(result.message || '처리할 주문 없음', 'info')
    } else addToast('주문 처리 실패. 백엔드 상태를 확인하세요.', 'error')
    await loadAll()
  }

  async function connectBroker() {
    const result = await api('/broker/connect', { method: 'POST' })
    if (result) setBroker(result)
    await loadAll()
  }

  async function disconnectBroker() {
    const result = await api('/broker/disconnect', { method: 'POST' })
    if (result) setBroker(result)
    await loadAll()
  }

  async function saveSettings(form) {
    setSettingsSaving(true)
    const result = await api('/settings', { method: 'POST', body: JSON.stringify(form) })
    setSettingsSaving(false)
    if (result?.ok) {
      alert(result.message)
      if (result.restart_required) alert('브로커 모드가 변경됐습니다. 앱을 다시 시작해야 적용됩니다.')
      await loadAll()
      setSettingsOpen(false)
    } else alert('저장 실패: ' + (result?.detail || '알 수 없는 오류'))
  }

  async function decide(id, decision) {
    await api(`/adjustments/${id}/${decision}`, { method: 'POST' })
    await loadAll()
  }

  const pnlColor = (pct) => pct > 0 ? '#4ade80' : pct < 0 ? '#f87171' : '#94a3b8'

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Flow AI Trading</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>PC 전용 · 매수 수동 / 매도 자동</p>
        </div>
        <div className="header-buttons">
          <button
            onClick={() => setActiveTab('main')}
            style={{ background: activeTab === 'main' ? '#1e40af' : '#374151' }}>
            🏠 메인
          </button>
          <button
            onClick={() => setActiveTab('flow')}
            style={{ background: activeTab === 'flow' ? '#0e7490' : '#374151' }}>
            🌊 Flow AI
          </button>
          <button onClick={async () => {
            const sv = await api('/settings')
            if (sv) { setSettingsData(sv); setSettingsOpen(true) }
            else alert('설정을 불러오지 못했습니다.')
          }} style={{ background: '#374151' }}>⚙️ 설정</button>
          <button onClick={triggerFullScan} style={{ background: '#1e40af' }}>🔍 전체 재분석</button>
          <button onClick={triggerTop200Scan} style={{ background: '#1e3a5f' }}>📊 200종목 재분석</button>
          <button onClick={processNextOrder} style={{
            background: queue.filter(q => q.status === 'QUEUED').length > 0 ? '#1d4ed8' : '#374151',
          }}>
            ▶ 큐 1건 실행 {queue.filter(q => q.status === 'QUEUED').length > 0 && `(${queue.filter(q => q.status === 'QUEUED').length}건 대기)`}
          </button>
          <button className="danger" onClick={emergencyExit}>⚡ 비상탈출</button>
        </div>
      </header>

      {/* Flow AI 탭 */}
      {activeTab === 'flow' && (
        <div style={{ padding: '0 0 40px 0' }}>
          <FlowAITrading onWeightAdjusted={(log) => {
            setWeightLogs(prev => [{
              time: new Date().toLocaleString('ko-KR'),
              accuracy: log.accuracy,
              summary: log.summary,
              changes: log.changes,
            }, ...prev].slice(0, 20))
          }} />
        </div>
      )}

      {/* 메인 탭 */}
      {activeTab === 'main' && (
        <>
          <RiskBanner risk={risk} />

          {/* ── 상단 요약 ── */}
          <section className="grid summary-grid">
            <Card title="브로커 연결 상태" extra={<BrokerBadge connected={broker.connected} mode={broker.mode} />}>
              <div className="stats">
                <div><span>메시지</span><strong style={{ fontSize: 12, color: broker.connected ? '#4ade80' : '#94a3b8' }}>{broker.message || '-'}</strong></div>
                <div><span>마지막 이벤트</span><strong style={{ fontSize: 11 }}>{broker.last_event_at ? new Date(broker.last_event_at + 'Z').toLocaleTimeString('ko-KR', { hour12: false }) : '-'}</strong></div>
                <div><span>계좌번호</span><strong style={{ color: '#60a5fa' }}>{accounts[0] || '(연결 후 표시)'}</strong></div>
                <div className="button-box">
                  <button onClick={connectBroker} style={{ background: broker.connected ? '#374151' : '#2563eb' }}>{broker.connected ? '재연결' : '연결'}</button>
                  <button onClick={disconnectBroker}>해제</button>
                </div>
              </div>
              {broker.connected && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: '#052e16', border: '1px solid #166534', borderRadius: 6, fontSize: 12, color: '#4ade80' }}>
                  ✅ 실시간 체결 활성 → 이제 조건 검색식 종목 확인하세요.
                </div>
              )}
            </Card>

            <Card title="시장 요약">
              {summary && (
                <div className="stats">
                  <div><span>MarketScore</span><strong style={{ color: summary.marketScore >= 65 ? '#4ade80' : summary.marketScore >= 50 ? '#facc15' : '#f87171' }}>{summary.marketScore}</strong></div>
                  <div><span>현금 비중</span><strong>{summary.cashRatio}%</strong></div>
                  <div><span>리스크 모드</span><strong style={{ color: summary.riskMode === 'RISK_ON' ? '#4ade80' : summary.riskMode === 'RISK_OFF' ? '#f87171' : '#facc15' }}>{summary.riskMode}</strong></div>
                  <div><span>스캔 완료</span><strong>{summary.scanCompletedAt}</strong></div>
                </div>
              )}
            </Card>
          </section>

          {/* ── 자산 현황 대시보드 ── */}
          <section style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">💰 자산 현황 (실시간)</div>
                <span style={{ fontSize: 11, color: '#64748b' }}>5초 자동갱신</span>
              </div>

              {/* 자산 요약 5개 카드 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: '총 평가금액', value: assetSummary?.total_value?.toLocaleString() + '원', color: '#e2e8f0' },
                  { label: '남은 현금', value: assetSummary?.cash?.toLocaleString() + '원', color: '#60a5fa' },
                  { label: '주식 평가금액', value: assetSummary?.stock_value?.toLocaleString() + '원', color: '#a78bfa' },
                  { label: '당일 실현손익', value: (assetSummary?.realized_pnl >= 0 ? '+' : '') + assetSummary?.realized_pnl?.toLocaleString() + '원', color: assetSummary?.realized_pnl >= 0 ? '#4ade80' : '#f87171' },
                  { label: '평가손익', value: (assetSummary?.unrealized_pnl >= 0 ? '+' : '') + assetSummary?.unrealized_pnl?.toLocaleString() + '원', color: assetSummary?.unrealized_pnl >= 0 ? '#4ade80' : '#f87171' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#0f1825', border: '1px solid #1e3a5f', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: item.color }}>{assetSummary ? item.value : '-'}</div>
                  </div>
                ))}
              </div>

              {/* 포지션 비중 바 */}
              {positions.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>보유 종목별 비중</div>
                  {positions.map(pos => {
                    const val = pos.current_price * pos.quantity || 0
                    const pct = assetSummary?.total_value > 0 ? (val / assetSummary.total_value * 100).toFixed(1) : 0
                    return (
                      <div key={pos.id} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{pos.name}</span>
                          <span style={{ color: pos.pnl_percent >= 0 ? '#4ade80' : '#f87171' }}>
                            {val.toLocaleString()}원 ({pct}%) · {pos.pnl_percent >= 0 ? '+' : ''}{pos.pnl_percent?.toFixed(2)}%
                          </span>
                        </div>
                        <div style={{ background: '#1e293b', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: pct + '%', height: '100%', borderRadius: 3, background: pos.pnl_percent >= 0 ? '#4ade80' : '#f87171', transition: 'width 0.5s' }} />
                        </div>
                      </div>
                    )
                  })}
                  {assetSummary && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: assetSummary.cash / assetSummary.total_value, background: '#1e3a5f', height: 6, borderRadius: 3 }} />
                      <span style={{ fontSize: 11, color: '#60a5fa' }}>현금 {(assetSummary.cash / assetSummary.total_value * 100).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              )}

              {/* 매수/매도 거래 이력 */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>📋 매수/매도 실현 이력 (최근 30건)</div>
                {tradeLogs.length === 0 ? (
                  <div style={{ color: '#475569', fontSize: 12, padding: '8px 0' }}>거래 이력 없음</div>
                ) : (
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr><th>시각</th><th>종목</th><th>유형</th><th>수량</th><th>체결가</th><th>실현손익</th><th>수익률</th></tr>
                      </thead>
                      <tbody>
                        {tradeLogs.map((log, i) => (
                          <tr key={i}>
                            <td style={{ fontSize: 11 }}>{log.time}</td>
                            <td style={{ fontWeight: 600 }}>{log.name || log.code}</td>
                            <td>
                              <span style={{ fontSize: 11, color: log.type?.includes('매도') || log.type?.includes('SELL') ? '#f87171' : '#4ade80', fontWeight: 700 }}>
                                {log.type}
                              </span>
                            </td>
                            <td>{log.qty}주</td>
                            <td style={{ fontWeight: 600 }}>{log.price?.toLocaleString()}원</td>
                            <td style={{ color: (log.pnl || 0) >= 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                              {log.pnl != null ? ((log.pnl >= 0 ? '+' : '') + log.pnl.toLocaleString() + '원') : '-'}
                            </td>
                            <td style={{ color: (log.pnl_pct || 0) >= 0 ? '#4ade80' : '#f87171' }}>
                              {log.pnl_pct != null ? ((log.pnl_pct >= 0 ? '+' : '') + log.pnl_pct.toFixed(2) + '%') : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── 메인 그리드 ── */}
          <section className="grid main-grid">
            {/* 왼쪽: 추천 종목 */}
            <Card title="추천 종목 / 장초반 판정">
              {!buyWindowOpen && (
                <div style={{ background: '#1e1b4b', border: '1px solid #4338ca', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#a5b4fc' }}>
                  ⏰ 09:01~09:04 매수 가능 시간 외 (개발 환경에서는 항시 활성)
                </div>
              )}
              <table>
                <thead>
                  <tr><th>순위</th><th>종목</th><th>테마</th><th>점수</th><th>판정</th><th>매수</th></tr>
                </thead>
                <tbody>
                  {recommendations.map((item) => (
                    <tr key={item.id}
                      onClick={() => setSelectedRec(selectedRec?.id === item.id ? null : item)}
                      style={{ opacity: item.is_alternative ? 0.65 : 1, cursor: 'pointer', background: selectedRec?.id === item.id ? 'rgba(59,130,246,0.1)' : 'transparent' }}>
                      <td><span style={{ fontSize: 11, color: item.is_alternative ? '#64748b' : '#e2e8f0' }}>{item.is_alternative ? '대안' : item.rank}</span></td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{item.code}</div>
                      </td>
                      <td><span style={{ fontSize: 11, background: '#1e293b', borderRadius: 4, padding: '2px 6px' }}>{item.theme}</span></td>
                      <td>
                        <div style={{ fontWeight: 700, color: item.final_score >= 80 ? '#4ade80' : item.final_score >= 70 ? '#facc15' : '#94a3b8' }}>{item.final_score}</div>
                        <div style={{ fontSize: 10, color: '#475569' }}>B:{item.base_score} T:{item.theme_score} L:{item.leader_score}</div>
                      </td>
                      <td><span className={`badge ${item.preopen_status?.toLowerCase()}`}>{item.preopen_status}</span></td>
                      <td>
                        <button disabled={item.preopen_status !== 'GO' || risk?.buy_blocked} onClick={() => manualBuy(item.code, item.preopen_status)}>매수</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedRec && (
                <div style={{ marginTop: 12, padding: 14, background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>{selectedRec.name}</span>
                      <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>{selectedRec.code}</span>
                      <span style={{ marginLeft: 8, fontSize: 11, background: '#1e293b', padding: '2px 6px', borderRadius: 4, color: '#94a3b8' }}>{selectedRec.theme}</span>
                    </div>
                    <button onClick={() => setSelectedRec(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 16, cursor: 'pointer' }}>✕</button>
                  </div>
                  <div style={{ marginBottom: 6, fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                    FinalScore 구성 분석: <span style={{ color: selectedRec.final_score >= 80 ? '#4ade80' : selectedRec.final_score >= 70 ? '#facc15' : '#f87171', fontSize: 15 }}>{selectedRec.final_score}점</span>
                  </div>
                  {[
                    { label: '기본점수 (BaseScore)', val: selectedRec.base_score, max: 45, color: '#3b82f6', desc: '거래대금, 등락률, 체결강도, 이격도, 거래량' },
                    { label: '테마점수 (ThemeScore)', val: selectedRec.theme_score, max: 20, color: '#8b5cf6', desc: '테마 강도, 주도주 여부, 뉴스 품질' },
                    { label: '리더점수 (LeaderScore)', val: selectedRec.leader_score, max: 15, color: '#06b6d4', desc: '기관/외인 수급, 전일 상한가 여부' },
                    { label: '확장점수 (ExpScore)', val: selectedRec.expansion_score, max: 10, color: '#10b981', desc: '동반 상승 종목 수, 후발주 움직임' },
                    { label: '장전점수 (PreOpen)', val: selectedRec.preopen_score, max: 10, color: '#f59e0b', desc: '나스닥 선물, 갭 방향, 호가창 강도' },
                    { label: '리스크 차감', val: selectedRec.risk_penalty, max: 0, color: '#ef4444', desc: 'VI 발동 이력, 급락 이력' },
                  ].map(({ label, val, max, color, desc }) => (
                    <div key={label} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                        <span style={{ color: '#94a3b8' }}>{label}</span>
                        <span style={{ color, fontWeight: 700 }}>{val > 0 ? '+' : ''}{val} / {max}점</span>
                      </div>
                      <div style={{ background: '#1e293b', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: max > 0 ? `${Math.max(0, (val / max) * 100)}%` : `${Math.abs(val) * 10}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.4s' }} />
                      </div>
                      <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{desc}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 오른쪽 컬럼 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* 실시간 포지션 */}
              <Card title="실시간 포지션">
                <div className="positions">
                  {positions.map((pos) => (
                    <div className="position-card" key={pos.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <h3 style={{ margin: 0 }}>{pos.name}</h3>
                        <span style={{ fontSize: 16, fontWeight: 700, color: pnlColor(pos.pnl_percent) }}>{pos.pnl_percent > 0 ? '+' : ''}{pos.pnl_percent?.toFixed(2)}%</span>
                      </div>
                      <div style={{ fontSize: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        <div>현재가 <strong>{pos.current_price?.toLocaleString()}</strong></div>
                        <div>평균가 <strong>{pos.avg_price?.toLocaleString()}</strong></div>
                        <div style={{ color: '#f87171' }}>손절 <strong>{pos.stop_loss_price?.toLocaleString()}</strong></div>
                        <div style={{ color: '#4ade80' }}>보호선 <strong>{pos.trailing_guard_price?.toLocaleString() || '-'}</strong></div>
                        <div>수량 <strong>{pos.quantity}주</strong></div>
                        <div>분할단계 <strong>{pos.split_stage}</strong></div>
                      </div>
                    </div>
                  ))}
                  {positions.length === 0 && <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: 20 }}>보유 종목 없음</div>}
                </div>
              </Card>

              {/* 주문 큐 */}
              <Card title="주문 큐" extra={
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {queue.filter(q => q.status === 'QUEUED').length > 0
                    ? <span style={{ color: '#facc15' }}>대기 {queue.filter(q => q.status === 'QUEUED').length}건</span>
                    : <span style={{ color: '#475569' }}>대기 없음</span>}
                </span>
              }>
                {queue.length === 0 ? (
                  <div style={{ color: '#475569', fontSize: 12, padding: '12px 0', textAlign: 'center' }}>
                    주문 큐가 비어있습니다.<br/>
                    <span style={{ fontSize: 11, color: '#334155' }}>추천 종목에서 매수 버튼을 누르면 여기에 쌓입니다.</span>
                  </div>
                ) : (
                  <table>
                    <thead><tr><th>순서</th><th>유형</th><th>종목</th><th>수량</th><th>상태</th></tr></thead>
                    <tbody>
                      {queue.map((item) => {
                        const isNext = item.status === 'QUEUED' && !queue.slice(0, queue.indexOf(item)).some(q => q.status === 'QUEUED')
                        return (
                          <tr key={item.id} style={{ background: isNext ? 'rgba(59,130,246,0.08)' : 'transparent' }}>
                            <td>
                              {item.priority}
                              {isNext && <span style={{ marginLeft: 4, fontSize: 10, color: '#60a5fa', fontWeight: 700 }}>▶ 다음</span>}
                            </td>
                            <td><span style={{ fontSize: 11, color: item.order_kind.includes('SELL') ? '#f87171' : '#4ade80' }}>{item.order_kind}</span></td>
                            <td>
                              <div>{recommendations.find(r => r.code === item.code)?.name || item.code}</div>
                              <div style={{ fontSize: 10, color: '#475569' }}>{item.code}</div>
                            </td>
                            <td>{item.qty}주</td>
                            <td><span style={{ fontSize: 11, color: item.status === 'SENT' ? '#94a3b8' : item.status === 'FAILED' ? '#f87171' : '#60a5fa' }}>{item.status}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </Card>

              {/* 조건검색식 / 점수 보정 제안 */}
              <Card title="조건검색식 / 점수 보정 제안">
                <div className="condition-list">
                  <h4 style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>조건검색식</h4>
                  {conditions.length === 0
                    ? <p style={{ color: '#475569', fontSize: 12 }}>조건검색식 없음 (브로커 연결 후 로드)</p>
                    : <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {conditions.map(c => <li key={c.index} style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{c.index}. {c.name}</li>)}
                      </ul>
                  }
                </div>
                <div className="adjustment-list" style={{ marginTop: 16 }}>
                  <h4 style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>점수 보정 제안</h4>
                  {adjustments.filter(a => a.decision === 'PENDING').length === 0
                    ? <p style={{ color: '#475569', fontSize: 12 }}>대기 중인 보정 제안 없음</p>
                    : adjustments.filter(a => a.decision === 'PENDING').map((item) => (
                      <div key={item.id} style={{ background: '#0f1825', border: '1px solid #1e3a5f', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                        <div style={{ marginBottom: 8 }}>
                          <strong style={{ color: '#e2e8f0', fontSize: 13 }}>{item.field_name}</strong>
                          <div style={{ fontSize: 13, marginTop: 4 }}>
                            <span style={{ color: '#f87171' }}>{item.current_value}</span>
                            <span style={{ color: '#64748b', margin: '0 6px' }}>→</span>
                            <span style={{ color: '#4ade80', fontWeight: 700 }}>{item.proposed_value}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{item.reason}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => decide(item.id, 'OK')} style={{ background: '#052e16', border: '1px solid #166534', color: '#4ade80', fontSize: 11, padding: '3px 10px', borderRadius: 4 }}>✅ OK</button>
                          <button onClick={() => decide(item.id, 'REJECT')} style={{ background: '#450a0a', border: '1px solid #7f1d1d', color: '#f87171', fontSize: 11, padding: '3px 10px', borderRadius: 4 }}>❌ 거부</button>
                          <button onClick={() => decide(item.id, 'HOLD')} style={{ background: '#1c1917', border: '1px solid #44403c', color: '#a8a29e', fontSize: 11, padding: '3px 10px', borderRadius: 4 }}>⏸ 보류</button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </Card>

            </div>
          </section>

          {/* ── 하단 2컬럼: 로그인/로그아웃 로그 + 가중치 조정 게시판 ── */}
          <section className="grid lower-grid" style={{ marginBottom: 16 }}>

            {/* 로그인/로그아웃 이벤트 로그 */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">🔗 로그인 / 로그아웃 이벤트 로그</div>
                <button onClick={() => api('/connection-log', { method: 'DELETE' }).then(loadAll)}
                  style={{ background: 'transparent', border: '1px solid #334155', color: '#64748b', fontSize: 11, padding: '3px 8px' }}>초기화</button>
              </div>
              {connLogs.length === 0 ? (
                <div style={{ color: '#475569', fontSize: 12, padding: '10px 0' }}>
                  로그인 이벤트 없음. 브로커 연결/해제 시 여기에 기록됩니다.
                </div>
              ) : (
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {connLogs.map((log, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: i < connLogs.length - 1 ? '1px solid #1e293b' : 'none', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: '#475569', flexShrink: 0, width: 65 }}>{log.time}</span>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                        background: log.connected ? '#052e16' : '#450a0a',
                        color: log.connected ? '#4ade80' : '#f87171',
                        border: '1px solid ' + (log.connected ? '#166534' : '#7f1d1d'),
                        fontWeight: 700,
                      }}>{log.connected ? '🟢 로그인' : '🔴 로그아웃'}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 가중치 자동조정 게시판 */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">⚖️ 가중치 자동조정 사유 게시판</div>
                <button onClick={() => setWeightLogs([])}
                  style={{ background: 'transparent', border: '1px solid #334155', color: '#64748b', fontSize: 11, padding: '3px 8px' }}>초기화</button>
              </div>
              {weightLogs.length === 0 ? (
                <div style={{ color: '#475569', fontSize: 12, padding: '10px 0' }}>
                  아직 가중치 자동조정이 실행되지 않았습니다.<br/>
                  <span style={{ fontSize: 11, color: '#334155' }}>Flow AI 탭에서 가중치 자동조정 실행 시 여기에 기록됩니다.</span>
                </div>
              ) : (
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {weightLogs.map((log, i) => (
                    <div key={i} style={{ padding: '8px 10px', marginBottom: 6, background: '#0f1825', border: '1px solid #1e3a5f', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>{log.time}</span>
                        <span style={{ fontSize: 11, color: '#facc15', fontWeight: 700 }}>적중률 {log.accuracy}%</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 4 }}>{log.summary}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {log.changes?.map((c, j) => (
                          <span key={j} style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 4,
                            background: c.delta > 0 ? '#052e16' : '#450a0a',
                            color: c.delta > 0 ? '#4ade80' : '#f87171',
                            border: '1px solid ' + (c.delta > 0 ? '#166534' : '#7f1d1d'),
                          }}>
                            {c.label} {c.delta > 0 ? '↑' : '↓'} ×{c.newWeight}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── 판정 로그 ── */}
          <section>
            <Card title="판정 로그 (최근 20건)">
              <table>
                <thead><tr><th>시각</th><th>종목</th><th>이벤트</th><th>점수</th><th>판정</th><th>사유</th></tr></thead>
                <tbody>
                  {decisionLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: 11 }}>{log.event_time?.slice(11, 19)}</td>
                      <td>{log.stock_code}</td>
                      <td><span style={{ fontSize: 11, color: log.event_type?.includes('SELL') ? '#f87171' : '#4ade80' }}>{log.event_type}</span></td>
                      <td style={{ fontWeight: 700 }}>{log.final_score}</td>
                      <td><span className={`badge ${log.go_watch_reject?.toLowerCase()}`}>{log.go_watch_reject}</span></td>
                      <td style={{ fontSize: 11, color: '#64748b' }}>{log.gwr_reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>

        </>
      )}

      {/* 토스트 */}
      <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9998 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: t.type === 'ok' ? '#052e16' : t.type === 'error' ? '#450a0a' : '#1e293b',
            border: `1px solid ${t.type === 'ok' ? '#166534' : t.type === 'error' ? '#7f1d1d' : '#334155'}`,
            color: t.type === 'ok' ? '#4ade80' : t.type === 'error' ? '#f87171' : '#94a3b8',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}>
            {t.type === 'ok' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'} {t.msg}
          </div>
        ))}
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(40px); opacity:0 } to { transform: translateX(0); opacity:1 } }`}</style>

      {settingsOpen && settingsData && (
        <SettingsModal data={settingsData} onSave={saveSettings} onClose={() => setSettingsOpen(false)} saving={settingsSaving} />
      )}
    </div>
  )
}
