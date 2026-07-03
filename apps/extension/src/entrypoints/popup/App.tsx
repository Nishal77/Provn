import { useState, useEffect } from 'react'

const WEB_BASE = 'https://attesta.io'

export function App() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_AUTH_TOKEN' }, res => {
      setToken(res?.token ?? null)
      setLoading(false)
    })
  }, [])

  function openDashboard() {
    chrome.tabs.create({ url: `${WEB_BASE}/dashboard` })
  }

  function openConnect() {
    chrome.tabs.create({ url: `${WEB_BASE}/connect-extension` })
  }

  function disconnect() {
    chrome.runtime.sendMessage({ type: 'CLEAR_AUTH_TOKEN' }, () => setToken(null))
  }

  if (loading) {
    return (
      <div style={styles.shell}>
        <p style={{ color: '#9CA3AF', fontSize: 13 }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={styles.shell}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.logo}>ATTESTA</span>
        <span style={styles.tag}>ProofWork</span>
      </div>

      {token ? (
        <>
          <div style={styles.status}>
            <span style={styles.dot} />
            <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 600 }}>Connected</span>
          </div>
          <p style={styles.hint}>
            ProofWork badges will appear on LinkedIn profiles with verified credentials.
          </p>
          <button style={styles.primaryBtn} onClick={openDashboard}>Open Dashboard</button>
          <button style={styles.ghostBtn} onClick={disconnect}>Disconnect</button>
        </>
      ) : (
        <>
          <p style={styles.hint}>
            Connect your ATTESTA account to see ProofWork verified badges on LinkedIn.
          </p>
          <button style={styles.primaryBtn} onClick={openConnect}>Connect Account</button>
        </>
      )}

      <p style={styles.footer}>
        <a href={`${WEB_BASE}/proof`} target="_blank" rel="noopener" style={styles.link}>
          attesta.io
        </a>
      </p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    width: 280, padding: '20px 18px', fontFamily: 'system-ui, sans-serif',
    background: '#fff', display: 'flex', flexDirection: 'column', gap: 10,
  },
  header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  logo: { fontWeight: 800, fontSize: 15, color: '#1E1B4B', letterSpacing: '-0.02em' },
  tag: {
    fontSize: 10, fontWeight: 700, background: '#EEF2FF', color: '#4338CA',
    padding: '2px 7px', borderRadius: 999, letterSpacing: '0.05em',
  },
  status: { display: 'flex', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: '50%', background: '#16A34A' },
  hint: { fontSize: 12, color: '#6B7280', lineHeight: 1.5, margin: 0 },
  primaryBtn: {
    padding: '9px 14px', background: '#4F46E5', color: '#fff', border: 'none',
    borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%',
  },
  ghostBtn: {
    padding: '8px 14px', background: 'transparent', color: '#6B7280',
    border: '1px solid #E5E7EB', borderRadius: 8, fontWeight: 500,
    fontSize: 12, cursor: 'pointer', width: '100%',
  },
  footer: { textAlign: 'center', marginTop: 4 },
  link: { fontSize: 11, color: '#9CA3AF', textDecoration: 'none' },
}
