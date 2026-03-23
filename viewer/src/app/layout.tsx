import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '꿀정보 뷰어',
  description: '공공 지원금 꿀정보 블로그 뷰어',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
