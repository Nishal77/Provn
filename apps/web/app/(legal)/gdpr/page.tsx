export const metadata = { title: 'GDPR' }

export default function GdprPage() {
  return (
    <article>
      <h1 className="text-3xl font-semibold tracking-[-0.02em] mb-4">GDPR</h1>
      <p className="text-sm text-[#8d969e] mb-8">Draft — not yet reviewed by counsel. Do not rely on this page as binding.</p>
      <p className="text-[#505a63] leading-relaxed">
        ATTESTA anchors only cryptographic hashes on-chain — never personal data. All PII is
        encrypted at rest and can be erased on request under GDPR Article 17. Full data-processing
        documentation will be published here before public launch. To request erasure today, email
        privacy@attesta.io.
      </p>
    </article>
  )
}
