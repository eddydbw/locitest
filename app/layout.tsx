import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Loci',
  description: 'Photo prompts for philosophical thinking',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
