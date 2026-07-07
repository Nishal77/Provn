'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion'

// ─── Animated counter ──────────────────────────────────────────────────────────
function Counter({ end, suffix = '', prefix = '' }: { end: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  useEffect(() => {
    if (!inView) return
    let start = 0
    const duration = 1800
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
    a: 'LinkedIn is self-reported — anyone can claim anything. ATTESTA requires every credential to be cryptographically co-signed by the issuing party (employer, university, AI evaluator) and anchored on Polygon blockchain. No co-sign = no credential. Fraud is mathematically impossible.',
  },
  {
    q: 'What is a ZK disclosure?',
    a: 'Zero-Knowledge proofs let you prove facts without revealing the underlying data. Example: prove your salary exceeds $150K to an employer without ever sharing the exact number. The proof is generated in your browser — our servers never see your raw data.',
  },
  {
    q: 'Is my personal data stored on the blockchain?',
    a: 'Never. Only cryptographic hashes (fingerprints) go on-chain. All PII stays encrypted in our database with AES-256. You have full GDPR Article 17 right to erasure — we can scrub your data from our systems; the immutable hash on-chain contains zero personal information.',
  },
  {
    q: 'How do WorkProof Live trials work?',
    a: 'Employers post 2-8 hour paid work trials ($150-$500). You complete real tasks in a browser-sandboxed VS Code or Figma environment. AI evaluates your output — code via AST analysis, design via CLIP vision model, writing via Llama 3.1. You get paid $50-$200 within 48 hours regardless of outcome. Your score becomes a permanent artifact in your profile.',
  },
  {
    q: 'How does TrustChain referral work?',
    a: 'ATTESTA builds a trust graph from verified work histories. If you know someone who knows someone at your target company, we surface that path. Smart contracts hold bounty escrow ($1K-$15K) and release automatically in tranches: 33% at hire, 33% at 90 days, 33% at 180 days. No middlemen, no manual payouts.',
  },
  {
    q: 'What is OpenRep?',
    a: 'OpenRep is the MIT-licensed protocol layer underneath ATTESTA — like HTTP for professional trust. Universities, governments, and any platform can issue verifiable credentials using the W3C DID + VC standard. ATTESTA Inc is the reference implementation; anyone can build on the protocol.',
  },
]

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07 }}
      className="border border-slate-800 rounded-2xl overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-slate-800/50 transition-colors"
      >
        <span className="text-white font-semibold text-sm sm:text-base">{q}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-indigo-400 text-xl font-light ml-4 shrink-0"
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
            <p className="px-6 pb-5 text-slate-400 text-sm leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])
  const heroY = useTransform(scrollY, [0, 400], [0, -80])

  useEffect(() => {
    const unsub = scrollY.on('change', v => setScrolled(v > 20))
    return unsub
  }, [scrollY])

  const MODULES = [
    {
      num: '01',
      name: 'ProofWork',
      tagline: 'Replace the resume',
      desc: 'Government ID verified via ZK proofs. Employer co-signed work history anchored on Polygon. AI-scored skills with artifact evidence. A living credential that grows with your career.',
      features: ['W3C DID on Polygon PoS', 'Govt ID via Onfido ZK', 'FaceTec 3D liveness', 'Employer co-sign flow', 'ZK salary disclosures', 'Chrome extension overlay'],
      color: 'from-indigo-500/20 to-blue-500/10',
      accent: 'text-indigo-400',
      border: 'border-indigo-500/30',
      status: 'Live',
    },
    {
      num: '02',
      name: 'WorkProof Live',
      tagline: 'Replace the interview',
      desc: '2-8 hour paid trials in browser-sandboxed environments. Real work, not trick questions. AI evaluates every submission. Candidates get paid regardless of outcome.',
      features: ['VS Code in browser', 'Figma sandbox (design)', 'Jupyter (data science)', 'WebRTC anti-cheat', '$50-$200 candidate payout', 'Permanent score artifact'],
      color: 'from-violet-500/20 to-purple-500/10',
      accent: 'text-violet-400',
      border: 'border-violet-500/30',
      status: 'Live',
    },
    {
      num: '03',
      name: 'TrustChain',
      tagline: 'Replace the network gap',
      desc: 'AI-built trust graph from verified work histories. Discover who you know who knows who. Smart contract bounties auto-release at hire, 90-day, 180-day milestones.',
      features: ['Neo4j trust graph', 'Path discovery (3 hops)', '$1K-$15K bounties', 'Smart contract escrow', 'Anti-collusion AI', 'Talent Scout program'],
      color: 'from-purple-500/20 to-pink-500/10',
      accent: 'text-purple-400',
      border: 'border-purple-500/30',
      status: 'Live',
    },
    {
      num: '04',
      name: 'RoleFit AI',
      tagline: 'Replace the ATS',
      desc: 'Extracts REAL requirements from GitHub repos and Figma, not job description keywords. Blind matching until mutual interest. FitScore 0-100 with full SHAP explainability.',
      features: ['5-dimension scoring', 'Blind matching mode', 'EEOC-compliant audit log', 'ATS integrations', 'SHAP explainability', 'RL outcome feedback'],
      color: 'from-blue-500/20 to-cyan-500/10',
      accent: 'text-blue-400',
      border: 'border-blue-500/30',
      status: 'Live',
    },
    {
      num: '05',
      name: 'OpenRep',
      tagline: 'The protocol layer',
      desc: 'MIT-licensed W3C DID + VC protocol. Like HTTP for professional trust. Universities, governments, any platform can issue verifiable credentials. Community-governed DAO.',
      features: ['W3C DID Core', 'VC Data Model 1.1', 'ZK Disclosure Protocol', 'Community DAO', 'University issuers', 'Government integrations'],
      color: 'from-emerald-500/20 to-teal-500/10',
      accent: 'text-emerald-400',
      border: 'border-emerald-500/30',
      status: 'Live',
    },
  ]

  const TESTIMONIALS = [
    {
      name: 'Priya S.',
      role: 'Senior Software Engineer, 4 yrs exp',
      quote: 'I was sending 60+ applications and getting 2 interviews. ATS systems kept killing my resume despite real skills. ATTESTA\'s AI skill eval showed what I could actually do. Three offers in three weeks.',
      score: '94 FitScore',
      tier: 'T2 Employer Verified',
    },
    {
      name: 'Marcus T.',
      role: 'Product Director, confidential search',
      quote: 'Couldn\'t use LinkedIn — my employer would see. ATTESTA let me run a fully private job search. ZK disclosures so employers could verify my comp range without me revealing the exact number. Exactly what I needed.',
      score: '91 FitScore',
      tier: 'T1 Govt Verified',
    },
    {
      name: 'Anika R.',
      role: 'VP People, Series C company',
      quote: 'We were reviewing 300+ resumes per role. 30% of hires left in 6 months. WorkProof Live trials changed everything — candidates do real work, we see real signal. Time-to-hire dropped from 68 days to 11.',
      score: '−82% time to hire',
      tier: 'Enterprise Customer',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/60 shadow-xl shadow-slate-950/50' : ''
        }`}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="font-black text-xl tracking-tight bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              ATTESTA
            </span>
            <div className="hidden md:flex items-center gap-6">
              {['Product', 'Pricing', 'Protocol', 'Docs'].map(item => (
                <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-slate-400 hover:text-white transition-colors font-medium">
                  {item}
                </a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-400 hover:text-white font-medium transition-colors px-3 py-2">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-indigo-900/50 hover:shadow-indigo-800/50"
            >
              Get started free
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-950 pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-violet-600/8 rounded-full blur-[100px] pointer-events-none" />

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.04)_1px,transparent_1px)] bg-[size:72px_72px] pointer-events-none" />

        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="relative z-10 max-w-5xl mx-auto px-6 text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-5 py-2 text-sm font-semibold text-indigo-300 mb-8"
          >
            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
            Trust infrastructure for the future of work
            <span className="text-indigo-500">→</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] mb-8"
          >
            <span className="text-white">Proof,</span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              not promises.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="text-xl sm:text-2xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-12"
          >
            Resumes lie. Interviews mislead. ATTESTA replaces them with
            cryptographic attestations anchored on blockchain — verifiable by anyone,
            forgeable by no one.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Link
              href="/signup"
              className="group px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all duration-200 text-lg shadow-2xl shadow-indigo-900/60 hover:shadow-indigo-800/60 hover:-translate-y-0.5"
            >
              Build your ProofWork profile
              <span className="ml-2 group-hover:translate-x-1 inline-block transition-transform">→</span>
            </Link>
            <Link
              href="/employer/register"
              className="px-8 py-4 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-bold rounded-xl transition-all duration-200 text-lg hover:bg-slate-800/50"
            >
              Hire with ATTESTA
            </Link>
          </motion.div>

          {/* Live stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="grid grid-cols-3 gap-8 max-w-lg mx-auto"
          >
            {[
              { n: 100000, suf: '+', label: 'Profiles' },
              { n: 500, suf: '+', label: 'Employers' },
              { n: 99, suf: '.9%', label: 'Uptime' },
            ].map(({ n, suf, label }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-black text-white">
                  <Counter end={n} suffix={suf} />
                </p>
                <p className="text-xs text-slate-500 mt-1 font-medium">{label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-xs text-slate-600 font-medium tracking-widest uppercase">Scroll</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-px h-8 bg-gradient-to-b from-slate-600 to-transparent"
          />
        </motion.div>
      </section>

      {/* ── PROBLEM STATS ────────────────────────────────────────────────────── */}
      <section className="py-24 border-y border-slate-800/50 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="max-w-6xl mx-auto px-6">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-xs font-bold text-slate-600 uppercase tracking-[0.3em] mb-16"
          >
            The hiring system is broken — and everyone is paying for it
          </motion.p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-10">
            {[
              { stat: 600, prefix: '$', suffix: 'B', label: 'Annual resume fraud cost', severity: 'high' },
              { stat: 68, suffix: ' days', label: 'Average time to hire', severity: 'high' },
              { stat: 88, suffix: '%', label: 'Qualified candidates ATS-rejected', severity: 'high' },
              { stat: 27, suffix: '%', label: 'Job listings are ghost jobs', severity: 'medium' },
              { stat: 50, suffix: '%', label: 'Companies hit by interview deepfakes', severity: 'medium' },
              { stat: 7, suffix: '%', label: 'Applicants with referral advantage', severity: 'low' },
            ].map(({ stat, prefix, suffix, label, severity }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="text-center p-6 rounded-2xl bg-slate-800/30 border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <p className={`text-4xl sm:text-5xl font-black mb-2 ${
                  severity === 'high' ? 'text-red-400' : severity === 'medium' ? 'text-orange-400' : 'text-yellow-400'
                }`}>
                  <Counter end={stat} prefix={prefix ?? ''} suffix={suffix} />
                </p>
                <p className="text-sm text-slate-400 leading-snug">{label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5-MODULE PRODUCT ─────────────────────────────────────────────────── */}
      <section id="product" className="py-28 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs font-semibold text-violet-400 mb-6"
            >
              Five layers of verifiable trust
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl font-black text-white mb-6"
            >
              Everything hiring needs,<br />
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                built on proof not trust.
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-slate-400 text-lg max-w-2xl mx-auto"
            >
              Each layer replaces a broken piece of hiring. Together they form a complete trust stack
              that makes fraud impossible and great hires inevitable.
            </motion.p>
          </div>

          <div className="space-y-6">
            {MODULES.map((mod, i) => (
              <motion.div
                key={mod.name}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`group relative p-8 rounded-3xl border ${mod.border} bg-gradient-to-br ${mod.color} hover:bg-slate-800/40 transition-all duration-300`}
              >
                <div className="flex flex-col lg:flex-row gap-8">
                  <div className="flex-1">
                    <div className="flex items-start gap-4 mb-4">
                      <span className="text-5xl font-black text-slate-700 leading-none">{mod.num}</span>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-2xl font-black text-white">{mod.name}</h3>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20`}>
                            ✓ {mod.status}
                          </span>
                        </div>
                        <p className={`text-sm font-semibold ${mod.accent} uppercase tracking-wider`}>{mod.tagline}</p>
                      </div>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-base max-w-lg">{mod.desc}</p>
                  </div>
                  <div className="lg:w-72 shrink-0">
                    <div className="grid grid-cols-2 gap-2">
                      {mod.features.map(f => (
                        <div key={f} className="flex items-center gap-2 text-xs text-slate-400">
                          <span className={`w-1.5 h-1.5 rounded-full ${mod.accent.replace('text-', 'bg-')} shrink-0`} />
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

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
      <section className="py-28 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl sm:text-5xl font-black text-white mb-4"
            >
              How it works
            </motion.h2>
            <p className="text-slate-400 text-lg">From signup to verified hire in days, not months.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Candidate flow */}
            <div>
              <h3 className="text-lg font-bold text-indigo-400 uppercase tracking-wider mb-8">For Candidates</h3>
              <div className="space-y-6">
                {[
                  { step: '1', title: 'Verify your identity', desc: 'Government ID + FaceTec 3D liveness. Takes 3 minutes. No PII stored — ZK proofs only.' },
                  { step: '2', title: 'Add verified work history', desc: 'Request employer co-sign. They countersign digitally. Both signatures anchor on Polygon.' },
                  { step: '3', title: 'Score your skills', desc: 'Submit code, design, or writing artifacts. AI evaluates in 30 minutes. Score becomes your credential.' },
                  { step: '4', title: 'Control your disclosures', desc: 'Choose what\'s public, what requires ZK proof, what stays private. You own your reputation.' },
                ].map(({ step, title, desc }, i) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xs font-black text-indigo-400 shrink-0 mt-0.5">
                      {step}
                    </div>
                    <div>
                      <p className="font-semibold text-white mb-1">{title}</p>
                      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Employer flow */}
            <div>
              <h3 className="text-lg font-bold text-violet-400 uppercase tracking-wider mb-8">For Employers</h3>
              <div className="space-y-6">
                {[
                  { step: '1', title: 'Define the role', desc: 'Post a role and optionally share your GitHub/Figma. RoleFit AI extracts real requirements — not keywords.' },
                  { step: '2', title: 'Get matched candidates', desc: 'Top-50 ranked by FitScore (0-100). Fully anonymous — no names, no photos, no university until you decide.' },
                  { step: '3', title: 'Run a WorkProof trial', desc: 'Book 2-8 hour paid trial. Candidate completes real work. AI returns scored results in 2 hours.' },
                  { step: '4', title: 'Hire with confidence', desc: 'Every credential cryptographically verified. Smart contracts auto-release referral bounties. Full audit trail.' },
                ].map(({ step, title, desc }, i) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-xs font-black text-violet-400 shrink-0 mt-0.5">
                      {step}
                    </div>
                    <div>
                      <p className="font-semibold text-white mb-1">{title}</p>
                      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────────── */}
      <section className="py-28 bg-slate-950">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl sm:text-5xl font-black text-white mb-4"
            >
              Real results
            </motion.h2>
            <p className="text-slate-400 text-lg">From people who stopped submitting resumes into the void.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="p-7 rounded-3xl bg-slate-800/40 border border-slate-700/60 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center gap-1 mb-5">
                  {[...Array(5)].map((_, j) => (
                    <span key={j} className="text-amber-400 text-sm">★</span>
                  ))}
                </div>
                <blockquote className="text-slate-300 text-sm leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="border-t border-slate-700 pt-5">
                  <p className="font-bold text-white text-sm">{t.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{t.role}</p>
                  <div className="flex gap-2 mt-3">
                    <span className="text-xs px-2.5 py-1 bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 rounded-full font-semibold">
                      {t.score}
                    </span>
                    <span className="text-xs px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-full font-semibold">
                      {t.tier}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-28 bg-slate-900/70 border-y border-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 text-xs font-semibold text-indigo-400 mb-6"
            >
              Simple, transparent pricing
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl sm:text-5xl font-black text-white mb-4"
            >
              Start free. Scale as you hire.
            </motion.h2>
            <p className="text-slate-400 text-lg">Candidates always free. Employers pay per hire or subscribe.</p>
          </div>

          {/* Candidate pricing */}
          <div className="mb-14">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6 text-center">For Candidates</h3>
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {[
                {
                  name: 'Free Forever',
                  price: '$0',
                  period: '',
                  features: ['ProofWork public profile', 'Government ID verification (T1)', 'Up to 3 employer co-signs', 'Up to 5 skill attestations', 'Basic ZK disclosures', 'Chrome extension badge', 'OpenRep protocol access'],
                  cta: 'Get started free',
                  href: '/signup',
                  highlight: false,
                },
                {
                  name: 'Candidate Pro',
                  price: '$15',
                  period: '/month',
                  features: ['Everything in Free', 'Unlimited employer co-signs', 'Unlimited skill attestations', 'Advanced ZK disclosures ($29-$199 value)', 'Priority AI skill evaluation', 'Compensation intelligence access', 'TrustChain referral notifications', 'Hire Guarantee Insurance eligibility'],
                  cta: 'Start 14-day trial',
                  href: '/signup?plan=pro',
                  highlight: true,
                },
              ].map(plan => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className={`p-7 rounded-3xl border relative ${
                    plan.highlight
                      ? 'bg-indigo-600/10 border-indigo-500/50 shadow-2xl shadow-indigo-900/30'
                      : 'bg-slate-800/40 border-slate-700'
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-indigo-600 rounded-full text-xs font-bold text-white">
                      Most popular
                    </div>
                  )}
                  <h4 className="font-bold text-white mb-1">{plan.name}</h4>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-black text-white">{plan.price}</span>
                    <span className="text-slate-400 text-sm">{plan.period}</span>
                  </div>
                  <ul className="space-y-2.5 mb-8">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                        <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
                      plan.highlight
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40'
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Employer pricing */}
          <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6 text-center">For Employers</h3>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  name: 'Pay per hire',
                  price: '$99',
                  period: '/verified hire',
                  features: ['Full candidate profile access', 'WorkProof trial booking', 'AI FitScore matching', 'Blind matching mode', 'EEOC audit logs', 'ZK disclosure verification'],
                  cta: 'Start hiring',
                  href: '/employer/register',
                  highlight: false,
                },
                {
                  name: 'Growth',
                  price: '$2,000',
                  period: '/month',
                  features: ['Everything in Pay per hire', 'Unlimited profile views', 'Up to 20 active roles', 'RoleFit AI requirement extraction', 'WorkProof trial discounts', 'TrustChain referral network', 'Priority support'],
                  cta: 'Start free trial',
                  href: '/employer/register?plan=growth',
                  highlight: true,
                },
                {
                  name: 'Enterprise',
                  price: 'Custom',
                  period: '',
                  features: ['Everything in Growth', 'ATS integration (Greenhouse/Lever/Ashby)', 'Custom AI model fine-tuning', 'Dedicated compliance officer', 'SOC 2 audit support', 'Multi-region data residency', 'SLA 99.99% uptime', 'Hire Guarantee Insurance'],
                  cta: 'Contact sales',
                  href: '/contact',
                  highlight: false,
                },
              ].map((plan, i) => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`p-7 rounded-3xl border relative ${
                    plan.highlight
                      ? 'bg-violet-600/10 border-violet-500/50 shadow-2xl shadow-violet-900/30'
                      : 'bg-slate-800/40 border-slate-700'
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-violet-600 rounded-full text-xs font-bold text-white">
                      Best value
                    </div>
                  )}
                  <h4 className="font-bold text-white mb-1">{plan.name}</h4>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-black text-white">{plan.price}</span>
                    <span className="text-slate-400 text-xs">{plan.period}</span>
                  </div>
                  <ul className="space-y-2 mb-8">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
                      plan.highlight
                        ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/40'
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </motion.div>
              ))}
            </div>
            <p className="text-center text-xs text-slate-600 mt-6">
              WorkProof Live trials: $150-$500/trial (employer pays). Candidates receive $50-$200 within 48hrs.
              ZK Disclosure Packages: $29-$199/package.
            </p>
          </div>
        </div>
      </section>

      {/* ── PROTOCOL ─────────────────────────────────────────────────────────── */}
      <section id="protocol" className="py-24 bg-slate-950">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-xs font-semibold text-emerald-400 mb-6">
              Open source · MIT licensed
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-6">
              Built on open standards.<br />
              <span className="text-emerald-400">OpenRep Protocol.</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
              ATTESTA implements the OpenRep protocol — the open standard for professional trust,
              built on W3C DID Core and VC Data Model 1.1. Universities, governments, and any platform
              can issue verifiable credentials. Community-governed via DAO.
            </p>
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-10">
              {[
                { label: 'W3C DID Core', icon: '⛓' },
                { label: 'VC Data Model 1.1', icon: '📋' },
                { label: 'ZK Disclosure Protocol', icon: '🔐' },
              ].map(item => (
                <div key={item.label} className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700 text-center">
                  <span className="text-2xl mb-2 block">{item.icon}</span>
                  <p className="text-xs text-slate-400 font-medium">{item.label}</p>
                </div>
              ))}
            </div>
            <a
              href="https://github.com/attesta-io/openrep"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 border border-slate-700 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-400 rounded-xl font-semibold text-sm transition-all"
            >
              View OpenRep on GitHub
              <span>→</span>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section className="py-24 bg-slate-900/40 border-t border-slate-800">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-black text-white mb-4">Common questions</h2>
            <p className="text-slate-400">Everything you need to know about how ATTESTA works.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────────── */}
      <section className="py-32 bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-slate-950 to-violet-900/20 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-5xl sm:text-6xl font-black text-white mb-6 leading-tight"
          >
            Your reputation<br />
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              shouldn&apos;t live in a PDF.
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-slate-400 text-xl mb-10"
          >
            Join ATTESTA. Build a cryptographically verified professional identity
            that follows you everywhere and can never be faked.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/signup"
              className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all text-lg shadow-2xl shadow-indigo-900/60 hover:-translate-y-0.5"
            >
              Create free profile →
            </Link>
            <Link
              href="/employer/register"
              className="px-10 py-4 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-bold rounded-xl transition-all text-lg"
            >
              Hire smarter
            </Link>
          </motion.div>
          <p className="mt-6 text-xs text-slate-600">Free forever for candidates · No credit card required</p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 sm:col-span-1">
              <span className="font-black text-xl bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent block mb-3">
                ATTESTA
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">
                Trust infrastructure for professional work. Replacing resumes, ATS, and interviews with cryptographic proof.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2.5">
                {['ProofWork', 'WorkProof Live', 'TrustChain', 'RoleFit AI', 'OpenRep Protocol'].map(item => (
                  <li key={item}><a href="#product" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Company</h4>
              <ul className="space-y-2.5">
                {['About', 'Blog', 'Careers', 'Press', 'Contact'].map(item => (
                  <li key={item}><a href="#" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Legal</h4>
              <ul className="space-y-2.5">
                {[['Privacy', '/privacy'], ['Terms', '/terms'], ['GDPR', '/gdpr'], ['Security', '/security']].map(([label, href]) => (
                  <li key={label}><Link href={href ?? '#'} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600">© 2026 ATTESTA Inc. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                All systems operational
              </span>
              <span className="text-xs text-slate-700">·</span>
              <span className="text-xs text-slate-600">Polygon PoS · W3C DID · GDPR</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
