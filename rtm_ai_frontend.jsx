import { useState, useEffect, useRef } from "react";

const theme = {
  bg: "#0B0F1A",
  surface: "#111827",
  surfaceHover: "#1a2235",
  border: "#1e2d45",
  borderLight: "#243555",
  accent: "#3B82F6",
  accentGlow: "#3B82F620",
  accentHover: "#2563EB",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  dangerLight: "#EF444420",
  text: "#E2E8F0",
  textMuted: "#64748B",
  textDim: "#94A3B8",
  highlight: "#F8FAFC",
};

const navItems = [
  { id: "ask", icon: "💬", label: "AI 질의", badge: null },
  { id: "docs", icon: "📂", label: "문서 허브", badge: "3" },
  { id: "dashboard", icon: "📊", label: "운영 대시보드", badge: null },
  { id: "audit", icon: "🔍", label: "감사 로그", badge: "2" },
  { id: "policy", icon: "🛡️", label: "정책 관리", badge: null },
];

const mockDocs = [
  { id: "doc_2001", title: "2026 인사규정 개정안.hwp", dept: "인사팀", status: "indexed", security: 6, updated: "2026-03-27", size: "2.4MB", type: "HWP" },
  { id: "doc_2002", title: "1분기 재무보고서.xlsx", dept: "재무팀", status: "indexed", security: 8, updated: "2026-03-25", size: "5.1MB", type: "XLSX" },
  { id: "doc_2003", title: "IT보안정책_v3.pdf", dept: "IT팀", status: "indexed", security: 7, updated: "2026-03-20", size: "1.8MB", type: "PDF" },
  { id: "doc_2004", title: "영업전략보고서_Q1.docx", dept: "영업팀", status: "processing", security: 5, updated: "2026-03-27", size: "3.2MB", type: "DOCX" },
  { id: "doc_2005", title: "공장안전매뉴얼_2026.hwp", dept: "생산팀", status: "failed", security: 3, updated: "2026-03-26", size: "8.7MB", type: "HWP" },
  { id: "doc_2006", title: "계약서_협력사A_2026.pdf", dept: "법무팀", status: "indexed", security: 9, updated: "2026-03-22", size: "0.9MB", type: "PDF" },
];

const mockAudits = [
  { id: "aud_001", actor: "김관리자", event: "policy.publish", target: "정책 #pol_301", result: "success", time: "2026-03-27 14:32", risk: null },
  { id: "aud_002", actor: "이사용자", event: "query.blocked", target: "급여명세 조회 시도", result: "blocked", time: "2026-03-27 13:15", risk: "high" },
  { id: "aud_003", actor: "박팀장", event: "document.reindex", target: "인사규정 개정안.hwp", result: "success", time: "2026-03-27 12:00", risk: null },
  { id: "aud_004", actor: "최사원", event: "query.escalated", target: "임원 연봉 조회", result: "escalated", time: "2026-03-27 10:44", risk: "critical" },
  { id: "aud_005", actor: "정보안", event: "user.invite", target: "신입사원 3명", result: "success", time: "2026-03-27 09:20", risk: null },
];

const kpiData = {
  pipeline: { processed: 1820, successRate: 98.4, failed: 5, queued: 12 },
  query: { total: 2410, avgLatency: 1850, noEvidence: 3.8, blocked: 12 },
  risk: { blocked: 12, escalated: 4, warned: 38, critical: 1 },
};

const mockConversations = [
  { role: "user", text: "2026년 인사규정에서 연차 승인 권한은 누구에게 있나요?" },
  {
    role: "assistant",
    text: "연차 승인 권한은 부서장에게 있으며, 최종 예외 승인은 인사책임자가 담당합니다.",
    evidence: [{ doc: "인사규정 v3 §4.2", chunk: "부서장은 소속 직원의 연차를 7일 이내 승인 또는 반려해야 하며..." }],
    risk: { score: 12.5, action: "allow" },
  },
];

function Badge({ children, color = "blue", size = "sm" }) {
  const colors = {
    blue: { bg: "#1d3a6e", text: "#93C5FD" },
    green: { bg: "#064e3b", text: "#6EE7B7" },
    red: { bg: "#7f1d1d", text: "#FCA5A5" },
    yellow: { bg: "#78350f", text: "#FCD34D" },
    gray: { bg: "#1e293b", text: "#94A3B8" },
    purple: { bg: "#3b1f6e", text: "#C4B5FD" },
  };
  const c = colors[color] || colors.blue;
  return (
    <span style={{
      background: c.bg, color: c.text,
      padding: size === "sm" ? "2px 8px" : "4px 12px",
      borderRadius: 20, fontSize: size === "sm" ? 11 : 12,
      fontWeight: 600, letterSpacing: 0.3,
    }}>{children}</span>
  );
}

function StatusDot({ status }) {
  const map = { indexed: "#10B981", processing: "#F59E0B", failed: "#EF4444", active: "#10B981", error: "#EF4444", queued: "#6366F1" };
  return <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: map[status] || "#64748B", marginRight: 6, boxShadow: `0 0 6px ${map[status] || "#64748B"}` }} />;
}

function SecurityBadge({ level }) {
  const getColor = (l) => l >= 8 ? "red" : l >= 6 ? "yellow" : l >= 4 ? "blue" : "gray";
  const getLabel = (l) => l >= 9 ? "기밀" : l >= 7 ? "대외비" : l >= 5 ? "내부용" : "일반";
  return <Badge color={getColor(level)} size="sm">Lv.{level} {getLabel(level)}</Badge>;
}

function Metric({ label, value, sub, color = theme.accent, trend }) {
  return (
    <div style={{ padding: "20px 24px", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, flex: 1 }}>
      <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: theme.textDim, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function AskPage() {
  const [messages, setMessages] = useState(mockConversations);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEvidence, setShowEvidence] = useState({});
  const bottomRef = useRef(null);

  const send = () => {
    if (!input.trim() || loading) return;
    const q = input;
    setInput("");
    setMessages(m => [...m, { role: "user", text: q }]);
    setLoading(true);
    setTimeout(() => {
      setMessages(m => [...m, {
        role: "assistant",
        text: "해당 문서에서 관련 내용을 찾았습니다. 현재 사용자 권한(Lv.6 내부용) 기준으로 접근 가능한 문서를 기반으로 답변합니다.",
        evidence: [{ doc: "관련 내부문서 v1 §2.1", chunk: "관련 조항이 여기에 표시됩니다. 실제 문서 내용이 청크 단위로 검색되어 근거로 제시됩니다." }],
        risk: { score: 8.2, action: "allow" },
      }]);
      setLoading(false);
    }, 1400);
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      {/* 상단 컨텍스트 바 */}
      <div style={{ display: "flex", gap: 12, padding: "16px 0 12px", borderBottom: `1px solid ${theme.border}`, marginBottom: 16, flexWrap: "wrap" }}>
        {[["👤 김팀장", "gray"], ["🏢 경영지원팀", "gray"], ["🔒 Lv.6 내부용", "blue"], ["✅ 권한 정상", "green"]].map(([t, c]) => (
          <Badge key={t} color={c}>{t}</Badge>
        ))}
        <div style={{ marginLeft: "auto", fontSize: 12, color: theme.textMuted }}>세션 ID: sess_2026032701</div>
      </div>

      {/* 메시지 영역 */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${theme.accent}, #8B5CF6)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 10, flexShrink: 0, marginTop: 2 }}>🤖</div>
            )}
            <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", gap: 8, alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                padding: "12px 16px", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background: m.role === "user" ? theme.accent : theme.surface,
                border: m.role === "assistant" ? `1px solid ${theme.border}` : "none",
                color: theme.text, fontSize: 14, lineHeight: 1.6,
              }}>{m.text}</div>

              {m.evidence && (
                <div>
                  <button onClick={() => setShowEvidence(s => ({ ...s, [i]: !s[i] }))}
                    style={{ background: "none", border: `1px solid ${theme.borderLight}`, color: theme.accent, padding: "4px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                    📎 근거 {m.evidence.length}건 {showEvidence[i] ? "▲" : "▼"}
                  </button>
                  {showEvidence[i] && m.evidence.map((e, j) => (
                    <div key={j} style={{ marginTop: 8, padding: "10px 14px", background: "#0d1f38", border: `1px solid ${theme.accent}40`, borderRadius: 10, borderLeft: `3px solid ${theme.accent}` }}>
                      <div style={{ fontSize: 11, color: theme.accent, fontWeight: 700, marginBottom: 4 }}>{e.doc}</div>
                      <div style={{ fontSize: 12, color: theme.textDim, lineHeight: 1.5 }}>{e.chunk}</div>
                    </div>
                  ))}
                </div>
              )}

              {m.risk && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>위험도 {m.risk.score}</div>
                  <Badge color="green" size="sm">✓ 허용</Badge>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${theme.accent}, #8B5CF6)`, display: "flex", alignItems: "center", justifyContent: "center" }}>🤖</div>
            <div style={{ padding: "12px 16px", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: "18px 18px 18px 4px" }}>
              <div style={{ display: "flex", gap: 5 }}>
                {[0, 0.15, 0.3].map((d, i) => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: theme.accent, animation: "bounce 0.8s infinite", animationDelay: `${d}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div style={{ paddingTop: 12, borderTop: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="권한 범위 내 문서를 기반으로 질문하세요..."
              style={{
                width: "100%", padding: "14px 16px", background: theme.surface,
                border: `1px solid ${theme.borderLight}`, borderRadius: 12,
                color: theme.text, fontSize: 14, outline: "none", boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={e => e.target.style.borderColor = theme.accent}
              onBlur={e => e.target.style.borderColor = theme.borderLight}
            />
          </div>
          <button onClick={send} style={{
            padding: "14px 22px", background: theme.accent, border: "none", borderRadius: 12,
            color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer",
            transition: "background 0.2s", flexShrink: 0,
          }}
            onMouseOver={e => e.target.style.background = theme.accentHover}
            onMouseOut={e => e.target.style.background = theme.accent}>
            전송 ↑
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {["연차 승인 권한", "보안정책 최신 버전", "1분기 재무 요약"].map(q => (
            <button key={q} onClick={() => setInput(q)} style={{
              background: "none", border: `1px solid ${theme.border}`, color: theme.textDim,
              padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
            }}>{q}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocsPage() {
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = mockDocs.filter(d =>
    (filterStatus === "all" || d.status === filterStatus) &&
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  const statusLabel = { indexed: "색인완료", processing: "처리중", failed: "실패" };
  const statusColor = { indexed: "green", processing: "yellow", failed: "red" };
  const typeColors = { HWP: "purple", PDF: "red", XLSX: "green", DOCX: "blue" };

  return (
    <div style={{ display: "flex", gap: 16, height: "100%" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* 필터 바 */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="문서 검색..."
            style={{ flex: 1, minWidth: 180, padding: "9px 14px", background: theme.surface, border: `1px solid ${theme.borderLight}`, borderRadius: 8, color: theme.text, fontSize: 13, outline: "none" }} />
          {["all", "indexed", "processing", "failed"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: filterStatus === s ? theme.accent : theme.surface,
              color: filterStatus === s ? "white" : theme.textMuted,
            }}>{{ all: "전체", indexed: "완료", processing: "처리중", failed: "실패" }[s]}</button>
          ))}
          <button style={{ padding: "8px 16px", background: theme.success, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", marginLeft: "auto" }}>+ 문서 업로드</button>
        </div>

        {/* 문서 목록 */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(doc => (
            <div key={doc.id} onClick={() => setSelected(doc)} style={{
              padding: "14px 16px", background: selected?.id === doc.id ? theme.surfaceHover : theme.surface,
              border: `1px solid ${selected?.id === doc.id ? theme.accent : theme.border}`,
              borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 12,
            }}
              onMouseOver={e => { if (selected?.id !== doc.id) e.currentTarget.style.background = theme.surfaceHover; }}
              onMouseOut={e => { if (selected?.id !== doc.id) e.currentTarget.style.background = theme.surface; }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: `${theme.accent}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                {{ HWP: "📄", PDF: "📕", XLSX: "📗", DOCX: "📘" }[doc.type]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: theme.text, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.title}</span>
                  <Badge color={typeColors[doc.type]} size="sm">{doc.type}</Badge>
                </div>
                <div style={{ display: "flex", gap: 10, fontSize: 12, color: theme.textMuted, alignItems: "center", flexWrap: "wrap" }}>
                  <span>{doc.dept}</span><span>·</span>
                  <span>{doc.size}</span><span>·</span>
                  <span>{doc.updated}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                <Badge color={statusColor[doc.status]} size="sm"><StatusDot status={doc.status} />{statusLabel[doc.status]}</Badge>
                <SecurityBadge level={doc.security} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 상세 패널 */}
      {selected && (
        <div style={{ width: 280, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, lineHeight: 1.4, flex: 1 }}>{selected.title}</div>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
          {[
            ["문서 ID", selected.id],
            ["부서", selected.dept],
            ["파일 형식", selected.type],
            ["파일 크기", selected.size],
            ["최종 수정", selected.updated],
            ["보안등급", `Lv.${selected.security}`],
            ["처리 상태", statusLabel[selected.status]],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingBottom: 10, borderBottom: `1px solid ${theme.border}` }}>
              <span style={{ color: theme.textMuted }}>{k}</span>
              <span style={{ color: theme.textDim, fontWeight: 500 }}>{v}</span>
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {selected.status === "failed" && (
              <button style={{ padding: "10px", background: theme.danger, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🔄 재처리 요청</button>
            )}
            <button style={{ padding: "10px", background: theme.surface, border: `1px solid ${theme.borderLight}`, borderRadius: 8, color: theme.textDim, fontSize: 12, cursor: "pointer" }}>📋 버전 이력</button>
            <button style={{ padding: "10px", background: theme.surface, border: `1px solid ${theme.borderLight}`, borderRadius: 8, color: theme.textDim, fontSize: 12, cursor: "pointer" }}>🔗 청크 미리보기</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardPage() {
  const [range, setRange] = useState("7d");

  const barData = [
    { label: "월", val: 280 }, { label: "화", val: 390 }, { label: "수", val: 340 },
    { label: "목", val: 420 }, { label: "금", val: 510 }, { label: "토", val: 180 }, { label: "일", val: 120 },
  ];
  const maxVal = Math.max(...barData.map(d => d.val));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", height: "100%" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: theme.textMuted, fontSize: 13 }}>실시간 운영 현황 · 마지막 갱신 14:32</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["7d", "30d", "90d"].map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: range === r ? theme.accent : theme.surface, color: range === r ? "white" : theme.textMuted,
            }}>{r}</button>
          ))}
        </div>
      </div>

      {/* KPI 메트릭 */}
      <div style={{ display: "flex", gap: 12 }}>
        <Metric label="처리 문서" value="1,820" sub="파싱 성공률 98.4%" color={theme.success} />
        <Metric label="총 질의" value="2,410" sub="평균 응답 1.85초" color={theme.accent} />
        <Metric label="차단 이벤트" value="12" sub="에스컬레이션 4건" color={theme.danger} />
        <Metric label="활성 사용자" value="147" sub="전주 대비 +23%" color="#8B5CF6" />
      </div>

      {/* 차트 + 리스크 */}
      <div style={{ display: "flex", gap: 16 }}>
        {/* 질의량 바 차트 */}
        <div style={{ flex: 2, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.textDim, marginBottom: 16 }}>일별 질의 현황</div>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 120 }}>
            {barData.map(d => (
              <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 10, color: theme.textMuted }}>{d.val}</div>
                <div style={{ width: "100%", background: `${theme.accent}30`, borderRadius: "4px 4px 0 0", position: "relative", height: `${(d.val / maxVal) * 90}px` }}>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: theme.accent, borderRadius: "4px 4px 0 0", height: `${(d.val / maxVal) * 90}px`, opacity: 0.85 }} />
                </div>
                <div style={{ fontSize: 10, color: theme.textMuted }}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 리스크 현황 */}
        <div style={{ flex: 1, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.textDim }}>리스크 현황</div>
          {[
            { label: "경고", val: kpiData.risk.warned, color: theme.warning, pct: 75 },
            { label: "차단", val: kpiData.risk.blocked, color: theme.danger, pct: 30 },
            { label: "에스컬레이션", val: kpiData.risk.escalated, color: "#8B5CF6", pct: 10 },
            { label: "긴급", val: kpiData.risk.critical, color: "#FF0040", pct: 2 },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: theme.textDim }}>{r.label}</span>
                <span style={{ color: r.color, fontWeight: 700 }}>{r.val}건</span>
              </div>
              <div style={{ height: 4, background: theme.border, borderRadius: 4 }}>
                <div style={{ height: "100%", width: `${r.pct}%`, background: r.color, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 파이프라인 상태 + 커넥터 */}
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.textDim, marginBottom: 14 }}>파이프라인 상태</div>
          {[
            { label: "색인 완료", val: 1820, color: theme.success },
            { label: "처리 중", val: 12, color: theme.warning },
            { label: "실패", val: 5, color: theme.danger },
          ].map(p => (
            <div key={p.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 13 }}>
              <span style={{ color: theme.textMuted }}>{p.label}</span>
              <span style={{ color: p.color, fontWeight: 700 }}>{p.val.toLocaleString()}</span>
            </div>
          ))}
          <button style={{ marginTop: 14, width: "100%", padding: "9px", background: theme.danger + "20", border: `1px solid ${theme.danger}40`, borderRadius: 8, color: theme.danger, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            🔄 실패 5건 일괄 재처리
          </button>
        </div>

        <div style={{ flex: 1, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.textDim, marginBottom: 14 }}>커넥터 상태</div>
          {[
            { name: "Drive A (인사팀)", status: "active" },
            { name: "SharePoint (재무팀)", status: "active" },
            { name: "SFTP (생산팀)", status: "error" },
          ].map(c => (
            <div key={c.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${theme.border}` }}>
              <span style={{ fontSize: 13, color: theme.textDim }}>{c.name}</span>
              <Badge color={c.status === "active" ? "green" : "red"} size="sm">
                <StatusDot status={c.status} />{c.status === "active" ? "정상" : "오류"}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditPage() {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? mockAudits : mockAudits.filter(a => a.risk === filter || a.result === filter);
  const resultColor = { success: "green", blocked: "red", escalated: "purple" };
  const riskColor = { high: "yellow", critical: "red" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[["all", "전체"], ["blocked", "차단"], ["escalated", "에스컬레이션"], ["critical", "긴급"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: filter === v ? theme.accent : theme.surface, color: filter === v ? "white" : theme.textMuted,
          }}>{l}</button>
        ))}
        <button style={{ marginLeft: "auto", padding: "7px 14px", background: theme.surface, border: `1px solid ${theme.borderLight}`, borderRadius: 8, color: theme.textDim, fontSize: 12, cursor: "pointer" }}>📥 내보내기</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map(a => (
          <div key={a.id} style={{
            padding: "14px 16px", background: theme.surface,
            border: `1px solid ${a.risk === "critical" ? theme.danger + "60" : a.risk === "high" ? theme.warning + "40" : theme.border}`,
            borderRadius: 10, display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: a.risk === "critical" ? theme.dangerLight : theme.accentGlow, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
              {{ success: "✅", blocked: "🚫", escalated: "⚠️" }[a.result] || "📋"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, color: theme.text, fontSize: 13 }}>{a.actor}</span>
                <span style={{ fontSize: 12, color: theme.textMuted }}>{a.event}</span>
                {a.risk && <Badge color={riskColor[a.risk] || "gray"} size="sm">⚠ {a.risk.toUpperCase()}</Badge>}
              </div>
              <div style={{ fontSize: 12, color: theme.textDim }}>{a.target}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
              <Badge color={resultColor[a.result] || "gray"} size="sm">
                {{ success: "성공", blocked: "차단", escalated: "에스컬레이션" }[a.result]}
              </Badge>
              <span style={{ fontSize: 11, color: theme.textMuted }}>{a.time}</span>
            </div>
            {a.result === "escalated" && (
              <button style={{ padding: "7px 12px", background: "none", border: `1px solid ${theme.warning}`, borderRadius: 8, color: theme.warning, fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>검토</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PolicyPage() {
  const policies = [
    { id: "pol_301", name: "임원급 급여 조회 차단", type: "deny", scope: "security_level", status: "published", version: 2 },
    { id: "pol_302", name: "인사 문서 부서 외 열람 제한", type: "deny", scope: "department", status: "review", version: 1 },
    { id: "pol_303", name: "재무 키워드 마스킹", type: "mask", scope: "role", status: "draft", version: 1 },
  ];
  const typeColor = { deny: "red", allow: "green", mask: "yellow", rerank: "blue" };
  const statusColor = { published: "green", review: "yellow", draft: "gray" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, color: theme.textMuted }}>Draft → Review → Published 흐름으로 관리됩니다</div>
        <button style={{ padding: "8px 16px", background: theme.accent, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ 정책 초안 생성</button>
      </div>

      {policies.map(p => (
        <div key={p.id} style={{ padding: "16px 18px", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, color: theme.text, fontSize: 14 }}>{p.name}</span>
            <Badge color={typeColor[p.type]} size="sm">{p.type.toUpperCase()}</Badge>
            <Badge color="gray" size="sm">범위: {p.scope}</Badge>
            <Badge color={statusColor[p.status]} size="sm">{p.status}</Badge>
            <span style={{ fontSize: 12, color: theme.textMuted, marginLeft: "auto" }}>v{p.version}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {p.status === "draft" && <button style={{ padding: "7px 14px", background: "none", border: `1px solid ${theme.warning}`, borderRadius: 8, color: theme.warning, fontSize: 12, cursor: "pointer" }}>검토 요청</button>}
            {p.status === "review" && <button style={{ padding: "7px 14px", background: theme.success, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>게시 승인</button>}
            <button style={{ padding: "7px 14px", background: "none", border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.textDim, fontSize: 12, cursor: "pointer" }}>편집</button>
            <button style={{ padding: "7px 14px", background: "none", border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.textDim, fontSize: 12, cursor: "pointer" }}>영향 시뮬레이션</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("ask");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const pages = { ask: AskPage, docs: DocsPage, dashboard: DashboardPage, audit: AuditPage, policy: PolicyPage };
  const PageComponent = pages[activePage];

  const pageTitles = {
    ask: "AI 질의응답",
    docs: "문서 허브",
    dashboard: "운영 대시보드",
    audit: "감사 로그",
    policy: "정책 관리",
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: theme.bg, color: theme.text, fontFamily: "'Pretendard', 'Noto Sans KR', -apple-system, sans-serif", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e2d45; border-radius: 4px; }
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        input::placeholder { color: #475569; }
      `}</style>

      {/* 사이드바 */}
      <div style={{
        width: sidebarOpen ? 220 : 60, flexShrink: 0,
        background: theme.surface, borderRight: `1px solid ${theme.border}`,
        display: "flex", flexDirection: "column",
        transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)", overflow: "hidden",
      }}>
        {/* 로고 */}
        <div style={{ padding: "20px 16px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setSidebarOpen(v => !v)}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${theme.accent}, #8B5CF6)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🧠</div>
          {sidebarOpen && (
            <div style={{ whiteSpace: "nowrap", overflow: "hidden" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: theme.highlight, letterSpacing: -0.3 }}>RTM AI</div>
              <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 1 }}>업무비서 v1.2</div>
            </div>
          )}
        </div>

        {/* 네비 */}
        <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActivePage(item.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 10px",
              borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left",
              background: activePage === item.id ? theme.accentGlow : "none",
              borderLeft: activePage === item.id ? `2px solid ${theme.accent}` : "2px solid transparent",
              transition: "all 0.15s", position: "relative",
            }}
              onMouseOver={e => { if (activePage !== item.id) e.currentTarget.style.background = theme.surfaceHover; }}
              onMouseOut={e => { if (activePage !== item.id) e.currentTarget.style.background = "none"; }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && (
                <>
                  <span style={{ fontSize: 13, fontWeight: activePage === item.id ? 700 : 500, color: activePage === item.id ? theme.accent : theme.textDim, whiteSpace: "nowrap" }}>{item.label}</span>
                  {item.badge && (
                    <span style={{ marginLeft: "auto", background: theme.accent, color: "white", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{item.badge}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* 사용자 정보 */}
        <div style={{ padding: "14px 12px", borderTop: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg, #3B82F6, #8B5CF6)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>김</div>
          {sidebarOpen && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.textDim }}>김팀장</div>
              <div style={{ fontSize: 10, color: theme.textMuted }}>Lv.6 · 경영지원팀</div>
            </div>
          )}
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* 헤더 */}
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: theme.surface, flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: theme.highlight, margin: 0, letterSpacing: -0.3 }}>{pageTitles[activePage]}</h1>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>RTM 기업 데이터 통합·보안 기반 AI 업무비서</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: theme.success, boxShadow: `0 0 8px ${theme.success}` }} />
            <span style={{ fontSize: 11, color: theme.textMuted }}>시스템 정상</span>
            <div style={{ width: 1, height: 20, background: theme.border }} />
            <button style={{ background: "none", border: "none", color: theme.textMuted, fontSize: 18, cursor: "pointer" }}>🔔</button>
          </div>
        </div>

        {/* 페이지 컨텐츠 */}
        <div style={{ flex: 1, padding: "20px 24px", overflow: "hidden", display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }}>
          <PageComponent key={activePage} />
        </div>
      </div>
    </div>
  );
}
