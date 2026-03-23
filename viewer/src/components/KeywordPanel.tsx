'use client'

import { useState } from 'react'
import type { Keyword } from '@/app/page'

export default function KeywordPanel({ keywords }: { keywords: Keyword[] }) {
  const [filter, setFilter] = useState<'all' | 'high' | 'medium'>('all')

  const filtered = filter === 'all' ? keywords : keywords.filter(k => k.action_value === filter)

  return (
    <>
      <div className="p-4 border-b border-gray-200 bg-amber-50">
        <h2 className="text-lg font-bold text-amber-800">수집 키워드</h2>
        <p className="text-xs text-amber-600 mt-1">{keywords.length}개 꿀정보</p>
        <div className="flex gap-1 mt-2">
          {(['all', 'high', 'medium'] as const).map(v => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-2 py-1 text-xs rounded-full transition-colors ${
                filter === v
                  ? 'bg-amber-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-amber-100'
              }`}
            >
              {v === 'all' ? '전체' : v === 'high' ? 'HIGH' : 'MEDIUM'}
              {v !== 'all' && ` (${keywords.filter(k => k.action_value === v).length})`}
            </button>
          ))}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto">
        {filtered.map((kw, i) => (
          <div key={i} className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <div className="flex items-start gap-2">
              <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded ${
                kw.action_value === 'high'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {kw.action_value.toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-gray-800 leading-snug">{kw.keyword}</p>
                <p className="text-xs text-gray-400 mt-1">{kw.agency}</p>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">
            키워드가 없습니다
          </div>
        )}
      </nav>
    </>
  )
}
