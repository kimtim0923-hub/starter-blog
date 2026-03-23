'use client'

import { useState, useEffect } from 'react'
import KeywordPanel from '@/components/KeywordPanel'
import WriterPanel from '@/components/WriterPanel'

export interface Keyword {
  keyword: string
  action_value: string
  reason: string
  source_url: string
  agency: string
  date: string
}

export default function Home() {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    fetch('/data/keywords.json')
      .then(r => r.json())
      .then(setKeywords)
      .catch(() => setKeywords([]))
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 왼쪽 패널 — 키워드 리스트 */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-80 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <KeywordPanel keywords={keywords} />
      </aside>

      {/* 오른쪽 패널 — 글 생성기 */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center px-4 py-3 border-b border-gray-200 bg-white shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg mr-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-800">꿀정보 블로그 생성기</h1>
        </header>
        <WriterPanel keywords={keywords} />
      </main>
    </div>
  )
}
