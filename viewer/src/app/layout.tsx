import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '꿀정보 블로그 생성기',
  description: '공공 지원금 데이터 기반 블로그 자동 생성',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
