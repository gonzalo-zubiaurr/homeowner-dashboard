import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Belong · Homeowner Payouts',
  description: 'Payment Readiness Tracker — Internal Use Only',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
