import Link from 'next/link'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[#191c1f]">
      <nav className="h-16 flex items-center border-b border-[#e2e2e7] px-6">
        <div className="max-w-[720px] mx-auto w-full">
          <Link href="/" className="font-semibold" style={{ color: '#494fdf' }}>ATTESTA</Link>
        </div>
      </nav>
      <main className="max-w-[720px] mx-auto px-6 py-16">{children}</main>
    </div>
  )
}
