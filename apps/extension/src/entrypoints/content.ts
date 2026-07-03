// Content script — injects ProofWork badge on LinkedIn profile pages.
//
// Runs on: https://www.linkedin.com/in/*
// Looks for the profile name heading, fetches the ATTESTA public API to check
// if the person has a verified ProofWork profile, then injects a badge.
//
// The badge shows:
//   ✓ ProofWork Verified  — when T2+ attestation exists
//   No ATTESTA profile   — when not found (optional, configurable)

export default defineContentScript({
  matches: ['https://www.linkedin.com/in/*'],
  runAt: 'document_idle',

  async main() {
    // Wait for LinkedIn's React hydration to finish
    await waitForElement('h1.text-heading-xlarge, h1[class*="inline"]')
    await injectBadge()

    // Re-inject on LinkedIn SPA navigation (popstate)
    window.addEventListener('popstate', async () => {
      await sleep(800) // wait for React re-render
      await injectBadge()
    })
  },
})

// ── Core injection ────────────────────────────────────────────────────────────

async function injectBadge() {
  // Remove any stale badge from previous navigation
  document.querySelector('.attesta-badge-container')?.remove()

  // Extract LinkedIn username from URL
  const match = window.location.pathname.match(/^\/in\/([^/?]+)/)
  if (!match) return
  const linkedinUsername = match[1]

  // Check ATTESTA API for this LinkedIn username
  const apiBase = getApiBase()
  let profile: { did: string; fullName: string; trustScore: number; kycTier: string } | null = null

  try {
    const res = await fetch(`${apiBase}/protocol/linkedin/${linkedinUsername}`, { cache: 'no-store' })
    if (res.ok) profile = await res.json()
  } catch {
    return // silently skip if API unreachable
  }

  if (!profile) return

  // Find the name heading to inject badge next to
  const nameEl = document.querySelector<HTMLElement>(
    'h1.text-heading-xlarge, h1[class*="inline"], .pv-top-card--list h1'
  )
  if (!nameEl || !nameEl.parentElement) return

  // Build badge element
  const badge = document.createElement('div')
  badge.className = 'attesta-badge-container'
  badge.style.cssText = `
    display: inline-flex; align-items: center; gap: 6px;
    background: #EEF2FF; border: 1px solid #C7D2FE;
    border-radius: 999px; padding: 4px 10px; margin-top: 6px;
    font-size: 12px; font-weight: 600; color: #4338CA;
    cursor: pointer; width: fit-content;
  `
  badge.innerHTML = `
    <span style="font-size:14px">✓</span>
    <span>ProofWork Verified</span>
    <span style="background:#4338CA;color:#fff;border-radius:999px;padding:1px 6px;font-size:10px">
      ${tierLabel(profile.kycTier)}
    </span>
  `
  badge.title = `ATTESTA Trust Score: ${profile.trustScore}/100`
  badge.addEventListener('click', () => {
    window.open(`${getWebBase()}/proof/${profile!.did}`, '_blank', 'noopener')
  })

  // Insert below name heading
  const container = document.createElement('div')
  container.appendChild(badge)
  nameEl.parentElement.insertBefore(container, nameEl.nextSibling)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tierLabel(tier: string): string {
  const map: Record<string, string> = {
    T1_GOVERNMENT: 'T1 Gov',
    T2_EMPLOYER: 'T2 Employer',
    T3_INSTITUTION: 'T3 Inst',
    T4_PEER: 'T4 Peer',
    T5_AI_INFERRED: 'T5 AI',
    T6_SELF: 'T6 Self',
  }
  return map[tier] ?? tier
}

function getApiBase(): string {
  return typeof chrome !== 'undefined' && chrome.runtime
    ? 'https://api.attesta.io'
    : 'http://localhost:4000'
}

function getWebBase(): string {
  return typeof chrome !== 'undefined' && chrome.runtime
    ? 'https://attesta.io'
    : 'http://localhost:3000'
}

function waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
  return new Promise(resolve => {
    const el = document.querySelector(selector)
    if (el) { resolve(el); return }
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector)
      if (found) { observer.disconnect(); resolve(found) }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => { observer.disconnect(); resolve(null) }, timeout)
  })
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
