export const metadata = { title: 'Contact' }

export default function ContactPage() {
  return (
    <article>
      <h1 className="text-3xl font-semibold tracking-[-0.02em] mb-4">Contact</h1>
      <p className="text-[#505a63] leading-relaxed">
        General inquiries: hello@attesta.io<br />
        Enterprise sales: sales@attesta.io<br />
        Security reports: security@attesta.io
      </p>
    </article>
  )
}
