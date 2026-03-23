'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface PostMeta {
  slug: string
  filename: string
  title: string
  mtime: number
}

export default function Viewer({ posts }: { posts: PostMeta[] }) {
  const [selected, setSelected] = useState<string | null>(posts[0]?.slug ?? null)
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    fetch(`/posts/${selected}.md`)
      .then(r => r.text())
      .then(text => {
        setContent(text)
        setLoading(false)
      })
      .catch(() => {
        setContent('파일을 불러올 수 없습니다.')
        setLoading(false)
      })
  }, [selected])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSelect = (slug: string) => {
    setSelected(slug)
    setSidebarOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-80 bg-white border-r border-gray-200 flex flex-col
          transform transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-4 border-b border-gray-200 bg-amber-50">
          <h1 className="text-lg font-bold text-amber-800">
            꿀정보 뷰어
          </h1>
          <p className="text-xs text-amber-600 mt-1">{posts.length}개 포스트</p>
        </div>
        <nav className="flex-1 overflow-y-auto">
          {posts.map((post, i) => (
            <button
              key={post.slug}
              onClick={() => handleSelect(post.slug)}
              className={`
                w-full text-left px-4 py-3 border-b border-gray-100
                hover:bg-amber-50 transition-colors text-sm
                ${selected === post.slug ? 'bg-amber-100 border-l-4 border-l-amber-500' : ''}
              `}
            >
              <span className="text-gray-400 text-xs mr-2">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-gray-800 leading-snug">{post.title}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 상단 바 */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <h2 className="text-sm font-medium text-gray-600 truncate flex-1 mx-3">
            {posts.find(p => p.slug === selected)?.title ?? '포스트를 선택하세요'}
          </h2>

          <button
            onClick={handleCopy}
            disabled={!content}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0
              ${copied
                ? 'bg-green-500 text-white'
                : 'bg-amber-500 text-white hover:bg-amber-600'
              }
              disabled:opacity-50
            `}
          >
            {copied ? '복사 완료!' : '전체 복사'}
          </button>
        </header>

        {/* 마크다운 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              불러오는 중...
            </div>
          ) : content ? (
            <article className="prose max-w-3xl mx-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </article>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              왼쪽에서 포스트를 선택하세요
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
