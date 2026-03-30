import { useState } from 'react'

export default function SettingsModal({ data, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    broker_mode:              data.broker_mode || 'mock',
    kiwoom_account_no:        data.kiwoom_account_no || '',
    kiwoom_user_id:           data.kiwoom_user_id || '',
    kiwoom_account_password:  '',   // 항상 빈칸으로 시작 (보안)
    total_capital:            data.total_capital || 300000000,
    daily_loss_limit_pct:     data.daily_loss_limit_pct || 2.0,
    consecutive_stop_limit:   data.consecutive_stop_limit || 2,
  })
  const [showPw, setShowPw] = useState(false)

  function set(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function handleSave() {
    // 빈 비밀번호는 전송 안 함 (기존 유지)
    const payload = { ...form }
    if (!payload.kiwoom_account_password) {
      delete payload.kiwoom_account_password
    }
    onSave(payload)
  }

  const labelStyle = {
    fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block'
  }
  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 6,
    background: '#1e293b', border: '1px solid #334155',
    color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box',
  }
  const sectionTitle = {
    fontSize: 13, fontWeight: 700, color: '#60a5fa',
    marginBottom: 12, paddingBottom: 6,
    borderBottom: '1px solid #1e293b',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#0f1722', border: '1px solid #243244',
        borderRadius: 14, padding: 28, width: 480, maxHeight: '85vh',
        overflowY: 'auto',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>⚙ 설정</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>변경 후 저장 버튼을 누르세요</div>
          </div>
          <button onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* 브로커 모드 */}
        <div style={{ marginBottom: 24 }}>
          <div style={sectionTitle}>브로커 모드</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {['mock', 'kiwoom'].map(mode => (
              <button key={mode} onClick={() => set('broker_mode', mode)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                  border: form.broker_mode === mode ? '2px solid #3b82f6' : '2px solid #334155',
                  background: form.broker_mode === mode ? '#1e3a5f' : '#1e293b',
                  color: form.broker_mode === mode ? '#60a5fa' : '#94a3b8',
                  fontWeight: form.broker_mode === mode ? 700 : 400,
                  fontSize: 14,
                }}>
                {mode === 'mock' ? '🔵 Mock (테스트)' : '🔴 Kiwoom (실거래)'}
              </button>
            ))}
          </div>
          {form.broker_mode === 'kiwoom' && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#1a1a2e', borderRadius: 6,
              fontSize: 12, color: '#f59e0b' }}>
              ⚠ Kiwoom 모드는 Windows + 키움 HTS 설치 + OpenAPI+ 신청 후 사용 가능합니다.
              모드 변경 후 앱을 재시작하세요.
            </div>
          )}
        </div>

        {/* 키움 계좌 정보 */}
        <div style={{ marginBottom: 24 }}>
          <div style={sectionTitle}>키움 계좌 정보</div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>계좌번호 (숫자만, 하이픈 없이)</label>
            <input
              style={inputStyle}
              placeholder="예: 1234567890"
              value={form.kiwoom_account_no}
              onChange={e => set('kiwoom_account_no', e.target.value.replace(/\D/g, ''))}
              maxLength={12}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>키움 아이디</label>
            <input
              style={inputStyle}
              placeholder="키움증권 로그인 아이디"
              value={form.kiwoom_user_id}
              onChange={e => set('kiwoom_user_id', e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              계좌 비밀번호
              <span style={{ color: '#22c55e', marginLeft: 6, fontSize: 11 }}>
                {data.has_password ? '✓ 저장됨 (앱 실행 중만 유지)' : '미입력'}
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                style={{ ...inputStyle, paddingRight: 44 }}
                placeholder={data.has_password ? '변경 시에만 입력' : '계좌 비밀번호 4자리'}
                value={form.kiwoom_account_password}
                onChange={e => set('kiwoom_account_password', e.target.value)}
                maxLength={8}
              />
              <button onClick={() => setShowPw(!showPw)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#64748b', fontSize: 14,
                }}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
              🔒 비밀번호는 파일에 저장되지 않습니다. 앱을 재시작하면 다시 입력해야 합니다.
            </div>
          </div>
        </div>

        {/* 운용 설정 */}
        <div style={{ marginBottom: 24 }}>
          <div style={sectionTitle}>운용 설정</div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>총 운용자금 (원)</label>
            <input
              type="number"
              style={inputStyle}
              value={form.total_capital}
              onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) set('total_capital', v) }}
              step={10000000}
              min={1000000}
            />
            <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
              현재: {Number(form.total_capital).toLocaleString()}원
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>일일 최대 손실 한도 (%)</label>
            <input
              type="number"
              style={inputStyle}
              value={form.daily_loss_limit_pct}
              onChange={e => set('daily_loss_limit_pct', parseFloat(e.target.value) || 2.0)}
              step={0.5} min={0.5} max={10}
            />
            <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
              {Number(form.total_capital).toLocaleString()}원 기준 → 한도: {
                Math.round(form.total_capital * form.daily_loss_limit_pct / 100).toLocaleString()
              }원
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>연속 손절 차단 횟수</label>
            <input
              type="number"
              style={inputStyle}
              value={form.consecutive_stop_limit}
              onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) set('consecutive_stop_limit', v) }}
              step={1} min={1} max={10}
            />
            <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
              연속 {form.consecutive_stop_limit}회 손절 시 30분간 신규 매수 차단
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '11px', borderRadius: 8, cursor: 'pointer',
              background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontSize: 14 }}>
            취소
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: '11px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
              background: saving ? '#374151' : '#2563eb', border: 'none',
              color: 'white', fontSize: 14, fontWeight: 700 }}>
            {saving ? '저장 중...' : '💾 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
