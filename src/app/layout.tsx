import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from './components/Toast'

export const metadata: Metadata = {
  title: 'helpdesk — HR for small businesses',
  description: 'Simple AI-powered HR for small businesses',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
