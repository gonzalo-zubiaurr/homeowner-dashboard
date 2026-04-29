import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Homeowner Onboarding Dashboard',
  description: 'Track homeowner payment readiness in real time',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
