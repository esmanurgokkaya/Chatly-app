import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { SocketProvider } from '@/context/socket-context'
import './globals.css'

const geist = GeistSans

export const metadata: Metadata = {
  title: 'Chatly App',
  description: 'Real-time chat application',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geist.className} font-sans antialiased`}>
        <SocketProvider>
          {children}
        </SocketProvider>
      </body>
    </html>
  )
}
