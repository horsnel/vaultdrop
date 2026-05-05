import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'VaultDrop — First-Mover Gaming Intelligence',
  description: 'Real-time gaming leaks, APK alerts, advance server tracking, and more for CODM, PUBGM, Free Fire, and Blood Strike.',
  keywords: ['gaming', 'leaks', 'CODM', 'PUBGM', 'Free Fire', 'Blood Strike', 'APK alerts', 'advance server'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-vault-bg text-slate-200 min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
        <footer className="border-t border-vault-border bg-vault-card/50 mt-auto">
          <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} VaultDrop — First-Mover Gaming Intelligence
            </p>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <a href="https://vaultdrop-14u.pages.dev/" target="_blank" rel="noopener noreferrer" className="hover:text-neon-purple transition-colors">
                Cloudflare Pages
              </a>
              <span>•</span>
              <span>Powered by VaultDrop API</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
