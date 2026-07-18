'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useInView, AnimatePresence } from 'framer-motion'

// Revolut-derived design tokens (DESIGN.md) — true black/white band system, no gradients, no shadows.
const dot = 'w-1.5 h-1.5 rounded-full shrink-0'

// ─── Animated counter ──────────────────────────────────────────────────────────
function Counter({ end, suffix = '', prefix = '' }: { end: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  useEffect(() => {
    if (!inView) return
    let start = 0
    const duration = 1400
    const step = end / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= end) { setCount(end); clearInterval(timer) }
      else setCount(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [inView, end])

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>
}

// ─── FAQ accordion ─────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'How is ATTESTA different from LinkedIn?',
    a: 'LinkedIn is self-reported — anyone can claim anything. ATTESTA requires every credential to be cryptographically co-signed by the issuing party (employer, university, AI evaluator) and anchored on Polygon blockchain. No co-sign, no credential.',
  },
  {
    q: 'What is a ZK disclosure?',
    a: 'Zero-knowledge proofs let you prove facts without revealing the underlying data. Example: prove your salary exceeds $150K without ever sharing the exact number. The proof is generated in your browser — our servers never see the raw data.',
  },
  {
    q: 'Is my personal data stored on the blockchain?',
    a: 'Never. Only cryptographic hashes go on-chain. All PII stays encrypted with AES-256. You have full GDPR Article 17 right to erasure — the immutable hash on-chain contains zero personal information.',
  },
  {
    q: 'What is OpenRep?',
    a: 'OpenRep is the MIT-licensed protocol layer underneath ATTESTA — like HTTP for professional trust. Universities, governments, and any platform will be able to issue verifiable credentials on the same W3C DID + VC standard.',
  },
]

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06 }}
      className="border-b border-[#e2e2e7] last:border-b-0"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-6 text-left"
      >
        <span className="text-[#191c1f] font-medium text-base">{q}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[#191c1f] text-2xl font-light ml-4 shrink-0"
        >
          +
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-[#505a63] text-[15px] leading-relaxed max-w-2xl">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const MODULES = [
    {
      num: '01',
      name: 'ProofWork',
      tagline: 'Replace the resume',
      desc: 'Government ID verified via ZK proofs. Employer co-signed work history anchored on Polygon. AI-scored skills with artifact evidence.',
      features: ['W3C DID on Polygon PoS', 'Govt ID via ZK proof', 'Employer co-sign flow', 'ZK salary disclosures'],
      status: 'Live',
      dotColor: '#494fdf',
    },
    {
      num: '02',
      name: 'WorkProof Live',
      tagline: 'Replace the interview',
      desc: '2–8 hour paid trials in browser-sandboxed environments. Real work, not trick questions. AI evaluates every submission.',
      features: ['VS Code in browser', 'Figma sandbox (design)', 'WebRTC anti-cheat', 'Permanent score artifact'],
      status: 'In development',
      dotColor: '#00a87e',
    },
    {
      num: '03',
      name: 'TrustChain',
      tagline: 'Replace the network gap',
      desc: 'AI-built trust graph from verified work histories. Smart-contract bounties auto-release at hire, 90-day, and 180-day milestones.',
      features: ['Trust-graph path discovery', 'Smart contract escrow', 'Anti-collusion detection', 'Talent Scout program'],
      status: 'In development',
      dotColor: '#e61e49',
    },
    {
      num: '04',
      name: 'RoleFit AI',
      tagline: 'Replace the ATS',
      desc: 'Extracts real requirements from GitHub repos and Figma, not job-description keywords. Blind matching until mutual interest.',
      features: ['5-dimension scoring', 'Blind matching mode', 'SHAP explainability', 'EEOC-compliant audit log'],
      status: 'In development',
      dotColor: '#007bc2',
    },
    {
      num: '05',
      name: 'OpenRep',
      tagline: 'The protocol layer',
      desc: 'MIT-licensed W3C DID + VC protocol. Like HTTP for professional trust. Any platform will be able to issue verifiable credentials.',
      features: ['W3C DID Core', 'VC Data Model 1.1', 'ZK Disclosure Protocol', 'Community-governed DAO'],
      status: 'Planned',
      dotColor: '#428619',
    },
  ]

  const PERSONAS = [
    {
      name: 'Priya',
      role: 'Senior software engineer, 4 yrs exp',
      problem: 'Sends 60+ applications, gets 2 interviews. ATS keyword-matching filters her out despite having the actual skills for the role.',
      fix: 'AI-scored skill artifacts replace keyword matching — employers see what she can build, not how well her resume parses.',
    },
    {
      name: 'Marcus',
      role: 'Product director, currently employed',
      problem: 'Needs a confidential search. Can\'t touch LinkedIn without his employer noticing, and can\'t prove his comp band without revealing the exact number.',
      fix: 'Private-mode profile plus ZK salary disclosures — proves "comp > $X" to a recruiter without exposing the figure.',
    },
    {
      name: 'Anika',
      role: 'Senior technical recruiter',
      problem: 'Reviews 300+ resumes per role and still can\'t tell who has real skills before the interview. 30% of hires leave within 6 months.',
      fix: 'Co-signed employment history and evaluated work artifacts arrive pre-verified, so screening starts from signal, not guesswork.',
    },
  ]

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden font-sans">

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 h-16 flex items-center transition-colors duration-300 ${
          scrolled ? 'bg-black border-b border-white/[0.12]' : 'bg-transparent'
        }`}
      >
        <div className="max-w-[1200px] mx-auto px-6 w-full flex items-center justify-between">
          <div className="flex items-center gap-10">
            <span className="font-semibold text-lg tracking-[-0.02em]" style={{ color: '#494fdf' }}>
              ATTESTA
            </span>
            <div className="hidden md:flex items-center gap-7">
              {['Product', 'Pricing', 'Protocol'].map(item => (
                <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-white/72 hover:text-white transition-colors">
                  {item}
                </a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/72 hover:text-white transition-colors px-2">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="bg-white text-black text-sm font-semibold rounded-full px-6 h-11 flex items-center transition-opacity hover:opacity-90"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO — hero-band-dark ───────────────────────────────────────────── */}
      <section className="bg-black pt-40 pb-24 px-6">
        <div className="max-w-[1200px] mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-white/72 mb-10"
            style={{ backgroundColor: '#16181a' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#494fdf' }} />
            The resume is 70 years old. It shows.
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-[clamp(2.75rem,7.2vw,7.5rem)] leading-[0.98] tracking-[-0.03em] font-semibold mb-8"
          >
            Resumes are fiction.
            <br />
            <span style={{ color: '#494fdf' }}>This is nonfiction.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-white/72 max-w-xl mx-auto leading-relaxed mb-10"
          >
            Anyone can write a resume. Only ATTESTA turns your work into
            co-signed, on-chain proof — verified in seconds, impossible to fake.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14"
          >
            <Link
              href="/signup"
              className="bg-white text-black font-semibold rounded-full px-7 h-12 flex items-center text-[15px] transition-opacity hover:opacity-90"
            >
              Build your ProofWork profile
            </Link>
            <Link
              href="/employer/register"
              className="border border-white/[0.28] text-white font-semibold rounded-full px-7 h-12 flex items-center text-[15px] hover:bg-white/[0.06] transition-colors"
            >
              Hire with ATTESTA
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2"
          >
            {['W3C DID Core', 'Polygon PoS anchored', 'Zero-knowledge disclosures', 'GDPR-ready'].map(label => (
              <div key={label} className="flex items-center gap-2 text-sm text-white/72">
                <span className={dot} style={{ backgroundColor: '#00a87e' }} />
                {label}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── PROBLEM STATS — light catalogue band ────────────────────────────── */}
      <section className="bg-white py-[88px] px-6">
        <div className="max-w-[1200px] mx-auto">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] mb-14" style={{ color: '#8d969e' }}>
            The hiring system is broken
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              { stat: 600, prefix: '$', suffix: 'B', label: 'Annual resume fraud cost', color: '#e23b4a' },
              { stat: 68, suffix: ' days', label: 'Average time to hire', color: '#e23b4a' },
              { stat: 88, suffix: '%', label: 'Qualified candidates ATS-rejected', color: '#e23b4a' },
              { stat: 27, suffix: '%', label: 'Job listings are ghost jobs', color: '#ec7e00' },
              { stat: 50, suffix: '%', label: 'Companies hit by interview deepfakes', color: '#ec7e00' },
              { stat: 7, suffix: '%', label: 'Applicants with referral advantage', color: '#b09000' },
            ].map(({ stat, prefix, suffix, label, color }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="text-center p-6 rounded-[20px] border border-[#e2e2e7]"
              >
                <p className="text-4xl sm:text-5xl font-semibold tracking-[-0.02em] mb-2" style={{ color }}>
                  <Counter end={stat} prefix={prefix ?? ''} suffix={suffix} />
                </p>
                <p className="text-sm leading-snug" style={{ color: '#505a63' }}>{label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5-MODULE PRODUCT — dark storytelling band ───────────────────────── */}
      <section id="product" className="bg-black py-[88px] px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/72 mb-5">Five layers of verifiable trust</p>
            <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-semibold tracking-[-0.02em] mb-5">
              Everything hiring needs, built on proof.
            </h2>
            <p className="text-white/72 text-lg max-w-xl mx-auto">
              Each layer replaces a broken piece of hiring. ProofWork is live today; the rest of the stack ships next.
            </p>
          </div>

          <div className="space-y-4">
            {MODULES.map((mod, i) => (
              <motion.div
                key={mod.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-[20px] p-8"
                style={{ backgroundColor: '#16181a' }}
              >
                <div className="flex flex-col lg:flex-row gap-8">
                  <div className="flex-1">
                    <div className="flex items-start gap-4 mb-3">
                      <span className="text-4xl font-semibold text-white/[0.18] leading-none">{mod.num}</span>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-xl font-semibold">{mod.name}</h3>
                          <span
                            className="text-xs font-medium px-2.5 py-1 rounded-full"
                            style={
                              mod.status === 'Live'
                                ? { backgroundColor: '#494fdf', color: '#ffffff' }
                                : { backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }
                            }
                          >
                            {mod.status}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-white/72">{mod.tagline}</p>
                      </div>
                    </div>
                    <p className="text-white/72 leading-relaxed text-[15px] max-w-lg">{mod.desc}</p>
                  </div>
                  <div className="lg:w-64 shrink-0">
                    <div className="grid grid-cols-1 gap-2">
                      {mod.features.map(f => (
                        <div key={f} className="flex items-center gap-2 text-sm text-white/72">
                          <span className={dot} style={{ backgroundColor: mod.dotColor }} />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS — light catalogue band ─────────────────────────────── */}
      <section className="bg-white py-[88px] px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-semibold tracking-[-0.02em] mb-4" style={{ color: '#191c1f' }}>
              How it works
            </h2>
            <p className="text-lg" style={{ color: '#505a63' }}>From signup to verified hire in days, not months.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-8" style={{ color: '#494fdf' }}>For candidates</h3>
              <div className="space-y-6">
                {[
                  { step: '1', title: 'Verify your identity', desc: 'Government ID + liveness check. Takes 3 minutes. No PII stored — ZK proofs only.' },
                  { step: '2', title: 'Add verified work history', desc: 'Request employer co-sign. They countersign digitally. Both signatures anchor on Polygon.' },
                  { step: '3', title: 'Score your skills', desc: 'Submit code, design, or writing artifacts. AI evaluates and issues a scored credential.' },
                  { step: '4', title: 'Control your disclosures', desc: 'Choose what\'s public, what requires ZK proof, what stays private.' },
                ].map(({ step, title, desc }, i) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex gap-4"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5"
                      style={{ backgroundColor: '#f4f4f4', color: '#191c1f' }}
                    >
                      {step}
                    </div>
                    <div>
                      <p className="font-semibold mb-1" style={{ color: '#191c1f' }}>{title}</p>
                      <p className="text-sm leading-relaxed" style={{ color: '#505a63' }}>{desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-8" style={{ color: '#494fdf' }}>For employers</h3>
              <div className="space-y-6">
                {[
                  { step: '1', title: 'Define the role', desc: 'Post a role and optionally share your GitHub/Figma. RoleFit AI extracts real requirements — not keywords.' },
                  { step: '2', title: 'Get matched candidates', desc: 'Ranked by FitScore. Fully anonymous — no names, no photos, no university until you decide.' },
                  { step: '3', title: 'Run a WorkProof trial', desc: 'Book a paid trial. Candidate completes real work. AI returns scored results.' },
                  { step: '4', title: 'Hire with confidence', desc: 'Every credential cryptographically verified. Full audit trail.' },
                ].map(({ step, title, desc }, i) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex gap-4"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5"
                      style={{ backgroundColor: '#f4f4f4', color: '#191c1f' }}
                    >
                      {step}
                    </div>
                    <div>
                      <p className="font-semibold mb-1" style={{ color: '#191c1f' }}>{title}</p>
                      <p className="text-sm leading-relaxed" style={{ color: '#505a63' }}>{desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHO IT'S FOR — dark storytelling band ───────────────────────────── */}
      <section className="bg-black py-[88px] px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-semibold tracking-[-0.02em] mb-4">
              Built for people stuck in the same broken system
            </h2>
            <p className="text-white/72 text-lg">Three sides of hiring, one shared problem: no way to verify what&apos;s true.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {PERSONAS.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-[20px] p-8"
                style={{ backgroundColor: '#16181a' }}
              >
                <p className="font-semibold text-base">{p.name}</p>
                <p className="text-sm text-white/72 mt-0.5 mb-6">{p.role}</p>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#e61e49' }}>The problem</p>
                <p className="text-white/72 text-sm leading-relaxed mb-6">{p.problem}</p>
                <div className="pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#00a87e' }}>With ATTESTA</p>
                  <p className="text-white/72 text-sm leading-relaxed">{p.fix}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING — dark storytelling band, plan cards ────────────────────── */}
      <section id="pricing" className="bg-black py-[88px] px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-semibold tracking-[-0.02em] mb-4">
              Start free. Scale as you hire.
            </h2>
            <p className="text-white/72 text-lg">Candidates always free. Employers pay per hire or subscribe.</p>
          </div>

          <div className="mb-16">
            <h3 className="text-sm font-semibold uppercase tracking-widest mb-6 text-center text-white/72">For candidates</h3>
            <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {[
                {
                  name: 'Free Forever', price: '$0', period: '',
                  features: ['ProofWork public profile', 'Government ID verification', 'Up to 3 employer co-signs', 'Basic ZK disclosures'],
                  cta: 'Get started free', href: '/signup', highlight: false,
                },
                {
                  name: 'Candidate Pro', price: '$15', period: '/month',
                  features: ['Everything in Free', 'Unlimited co-signs', 'Advanced ZK disclosures', 'Priority AI skill evaluation'],
                  cta: 'Start 14-day trial', href: '/signup?plan=pro', highlight: true,
                },
              ].map(plan => (
                <div
                  key={plan.name}
                  className="rounded-[20px] p-8"
                  style={plan.highlight ? { backgroundColor: '#494fdf' } : { backgroundColor: '#16181a' }}
                >
                  <h4 className="font-semibold mb-1">{plan.name}</h4>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-semibold tracking-[-0.02em]">{plan.price}</span>
                    <span className={plan.highlight ? 'text-white/80 text-sm' : 'text-white/72 text-sm'}>{plan.period}</span>
                  </div>
                  <ul className="space-y-2.5 mb-8">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <span className="mt-0.5 shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    className={`block text-center py-3 rounded-full font-semibold text-sm transition-opacity hover:opacity-90 ${
                      plan.highlight ? 'bg-white text-black' : 'bg-white text-black'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest mb-6 text-center text-white/72">For employers</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  name: 'Pay per hire', price: '$99', period: '/verified hire',
                  features: ['Full candidate profile access', 'AI FitScore matching', 'Blind matching mode'],
                  cta: 'Start hiring', href: '/employer/register', highlight: false,
                },
                {
                  name: 'Growth', price: '$2,000', period: '/month',
                  features: ['Everything in Pay per hire', 'Unlimited profile views', 'Up to 20 active roles'],
                  cta: 'Start free trial', href: '/employer/register?plan=growth', highlight: true,
                },
                {
                  name: 'Enterprise', price: 'Custom', period: '',
                  features: ['Everything in Growth', 'ATS integrations', 'Dedicated compliance officer'],
                  cta: 'Contact sales', href: '/contact', highlight: false,
                },
              ].map(plan => (
                <div
                  key={plan.name}
                  className="rounded-[20px] p-8"
                  style={plan.highlight ? { backgroundColor: '#494fdf' } : { backgroundColor: '#16181a' }}
                >
                  <h4 className="font-semibold mb-1">{plan.name}</h4>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-2xl font-semibold tracking-[-0.02em]">{plan.price}</span>
                    <span className="text-xs opacity-72">{plan.period}</span>
                  </div>
                  <ul className="space-y-2 mb-8">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    className="block text-center py-3 rounded-full font-semibold text-sm bg-white text-black transition-opacity hover:opacity-90"
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PROTOCOL — light catalogue band ──────────────────────────────────── */}
      <section id="protocol" className="bg-white py-[88px] px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-6"
            style={{ backgroundColor: '#f4f4f4', color: '#191c1f' }}
          >
            Open source · MIT licensed
          </div>
          <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-semibold tracking-[-0.02em] mb-5" style={{ color: '#191c1f' }}>
            Built on open standards.
          </h2>
          <p className="text-lg leading-relaxed mb-10 max-w-xl mx-auto" style={{ color: '#505a63' }}>
            ATTESTA implements the OpenRep protocol — the open standard for professional trust,
            built on W3C DID Core and VC Data Model 1.1. Community-governed via DAO.
          </p>
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-10">
            {['W3C DID Core', 'VC Data Model 1.1', 'ZK Disclosure'].map(label => (
              <div key={label} className="p-4 rounded-[12px] border border-[#e2e2e7] text-center">
                <p className="text-xs font-medium" style={{ color: '#505a63' }}>{label}</p>
              </div>
            ))}
          </div>
          <a
            href="https://github.com/attesta-io/openrep"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm bg-black text-white hover:opacity-90 transition-opacity"
          >
            View OpenRep on GitHub
          </a>
        </div>
      </section>

      {/* ── FAQ — light catalogue band ───────────────────────────────────────── */}
      <section className="bg-white py-[88px] px-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-10">
            <h2 className="text-3xl font-semibold tracking-[-0.02em] mb-3" style={{ color: '#191c1f' }}>Common questions</h2>
            <p style={{ color: '#505a63' }}>Everything you need to know about how ATTESTA works.</p>
          </div>
          <div>
            {FAQS.map((faq, i) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA — hero-band-dark ───────────────────────────────────────── */}
      <section className="bg-black py-[120px] px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-[clamp(2.25rem,5.5vw,4.5rem)] font-semibold tracking-[-0.02em] leading-[1.05] mb-6">
            Your reputation shouldn&apos;t <span style={{ color: '#494fdf' }}>live in a PDF.</span>
          </h2>
          <p className="text-white/72 text-lg mb-10">
            Build a cryptographically verified professional identity that follows you everywhere and can never be faked.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Link
              href="/signup"
              className="bg-white text-black font-semibold rounded-full px-8 h-12 flex items-center justify-center text-[15px] hover:opacity-90 transition-opacity"
            >
              Create free profile
            </Link>
            <Link
              href="/employer/register"
              className="border border-white/[0.28] text-white font-semibold rounded-full px-8 h-12 flex items-center justify-center text-[15px] hover:bg-white/[0.06] transition-colors"
            >
              Hire smarter
            </Link>
          </div>
          <p className="text-xs text-white/50">Free forever for candidates · No credit card required</p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="bg-black py-20 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 sm:col-span-1">
              <span className="font-semibold text-lg block mb-3" style={{ color: '#494fdf' }}>ATTESTA</span>
              <p className="text-xs text-white/50 leading-relaxed">
                Trust infrastructure for professional work. Replacing resumes, ATS, and interviews with cryptographic proof.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-4 text-white/72">Product</h4>
              <ul className="space-y-2.5">
                {['ProofWork', 'WorkProof Live', 'TrustChain', 'RoleFit AI', 'OpenRep Protocol'].map(item => (
                  <li key={item}><a href="#product" className="text-xs text-white/50 hover:text-white/80 transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-4 text-white/72">Company</h4>
              <ul className="space-y-2.5">
                {['About', 'Blog', 'Careers', 'Contact'].map(item => (
                  <li key={item}><a href="#" className="text-xs text-white/50 hover:text-white/80 transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-4 text-white/72">Legal</h4>
              <ul className="space-y-2.5">
                {[['Privacy', '/privacy'], ['Terms', '/terms'], ['GDPR', '/gdpr'], ['Security', '/security']].map(([label, href]) => (
                  <li key={label}><Link href={href ?? '#'} className="text-xs text-white/50 hover:text-white/80 transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs text-white/50">© 2026 ATTESTA Inc. All rights reserved.</p>
            <span className="text-xs text-white/50">Polygon PoS · W3C DID · GDPR</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
