export const metadata = { title: 'Security' }

export default function SecurityPage() {
  return (
    <article>
      <h1 className="text-3xl font-semibold tracking-[-0.02em] mb-4">Security</h1>
      <p className="text-sm text-[#8d969e] mb-8">Draft — not yet reviewed by counsel. Do not rely on this page as binding.</p>
      <p className="text-[#505a63] leading-relaxed">
        Personal data is encrypted at rest (AES-256) and in transit (TLS 1.3). On-chain records
        contain only cryptographic hashes, never raw personal information. A full security
        disclosure and responsible-disclosure policy will be published here before public launch.
        To report a vulnerability today, email security@attesta.io.
      </p>
    </article>
  )
}
