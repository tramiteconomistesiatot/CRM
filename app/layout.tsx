import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { ToastProvider } from '@/components/ui/toast-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tràmit Economistes — Gestió Interna',
  description: 'Aplicació interna de gestió de vacances, absències, agenda i cites per a Tràmit Economistes.',
  robots: 'noindex, nofollow',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tràmit',
  },
}

export const viewport: Viewport = {
  themeColor: '#2272A3',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
