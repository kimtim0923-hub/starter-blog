'use client'

import { useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Keyword } from '@/app/page'

const TOPICS = [
  { id: 1, label: '소상공인·자영업자 총정리', focus: ['소상공인', '자영업', '사업자', '재창업', '경영환경', 'LED간판', '온라인쇼핑몰', '가업승계'] },
  { id: 2, label: '편의점·카페·음식점 사장님', focus: ['소상공인', '임대료', 'LED간판', '경영환경개선', '직업전환', '자녀돌봄'] },
  { id: 3, label: '청년 지원금 완벽 가이드', focus: ['청년', '월세', '전월세', '면접수당', '인턴십', '중개수수료', '문화복지', '학자금'] },
  { id: 4, label: '긴급복지·에너지바우처·월세지원', focus: ['긴급복지', '에너지바우처', '월세', '의료급여', '보철구', '출산비', '전세자금'] },
  { id: 5, label: '숨겨진 정부지원금 총정리', focus: ['우체국', '엄마보험', 'SRT', '임산부', '공동육아', '가업승계', '시제품', '미환급금', '다자녀', '다태아'] },
]

const DRAFT_SYSTEM = `구조와 정보 중심 초안. SEO 규칙 적용.
제목(H1) 검색량 높은 키워드 포함 30자 이내.
글 맨 위에 <!-- meta: 160자 이내 설명 --> 추가.
H2 소제목 검색 의도 키워드 포함.
첫 문단 100자 안에 핵심 키워드 삽입. 1500자 내외.
각 지원금마다: 지원금명, 대상, 금액, 신청방법을 표나 리스트로 정리.
마크다운 형식.`

const MERGE_SYSTEM = `친한 선배 컨설턴트 톤. ~습니다 금지. ~해요 ~거든요 ~잖아요 구어체.
첫 문장 공감 후킹. 숫자와 금액 포함. 2500자 이상.
필자 감상과 표현 최대한 살려서 자연스럽게 녹여넣기.
필자가 쓴 문장은 원문 그대로 유지.
SEO 구조(H1/H2/메타/키워드 위치) 반드시 유지.
AI 티 절대 안 나게. 글만 출력.`

const ADSENSE_SYSTEM = `당신은 한국 블로그 글 작성 전문가입니다. 애드센스 승인을 위해 글을 개선합니다.
규칙: AI 냄새 완전히 제거(습니다체 남발 금지, 자연스러운 구어체 혼합),
개인 경험처럼 느껴지는 문장 자연스럽게 삽입,
소제목은 독창적인 것으로, 2500자 이상,
SEO 구조(H1/H2/메타/키워드 위치) 절대 바꾸지 마.
수정 이유나 설명 없이 바로 글만 출력.`

type Step = 'topic' | 'drafting' | 'feedback' | 'merging' | 'merged' | 'polishing' | 'done'

// ── API helper ──

async function streamClaude(
  system: string,
  userMessage: string,
  onChunk: (text: string) => void,
  onDone: () => void,
) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, message: userMessage, stream: true }),
  })

  if (!res.ok) {
    onChunk('[ERROR] API 호출 실패. Vercel 환경변수 ANTHROPIC_API_KEY를 확인하세요.')
    onDone()
    return
  }

  const reader = res.body?.getReader()
  if (!reader) { onDone(); return }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          onChunk(parsed.delta.text)
        }
      } catch {}
    }
  }
  onDone()
}

// ── Component ──

export default function WriterPanel({ keywords }: { keywords: Keyword[] }) {
  const [step, setStep] = useState<Step>('topic')
  const [selectedTopic, setSelectedTopic] = useState<typeof TOPICS[0] | null>(null)
  const [draft, setDraft] = useState('')
  const [feedback, setFeedback] = useState('')
  const [mergedText, setMergedText] = useState('')
  const [finalText, setFinalText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [copied, setCopied] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [])

  const handleTopicSelect = (topic: typeof TOPICS[0]) => {
    setSelectedTopic(topic)
    setDraft('')
    setFeedback('')
    setMergedText('')
    setFinalText('')
    setStep('topic')
  }

  // 2단계: 초안 생성
  const handleGenerateDraft = async () => {
    if (!selectedTopic) return
    setStep('drafting')
    setStreaming(true)
    setDraft('')

    const relevant = keywords.filter(kw =>
      selectedTopic.focus.some(f => kw.keyword.includes(f))
    )
    const data = relevant.length >= 3 ? relevant : keywords

    const userMsg = `주제: ${selectedTopic.label}\n\n근거 데이터 (${data.length}건):\n${JSON.stringify(data, null, 2)}\n\n위 데이터를 근거로 총정리형 블로그 초안을 마크다운으로 작성해주세요.`

    await streamClaude(DRAFT_SYSTEM, userMsg,
      (text) => { setDraft(prev => prev + text); setTimeout(scrollToBottom, 10) },
      () => { setStreaming(false); setStep('feedback') },
    )
  }

  // 3단계: 감상 합치기
  const handleMerge = async () => {
    if (!draft || !feedback.trim()) return
    setStep('merging')
    setStreaming(true)
    setMergedText('')

    const userMsg = `## 초안\n\n${draft}\n\n---\n\n## 필자의 감상/비평\n\n${feedback}\n\n---\n\n위 초안과 필자의 감상을 융합하여 블로그 글을 작성해줘.`

    await streamClaude(MERGE_SYSTEM, userMsg,
      (text) => { setMergedText(prev => prev + text); setTimeout(scrollToBottom, 10) },
      () => { setStreaming(false); setStep('merged') },
    )
  }

  // 4단계: 애드센스 코치 다듬기
  const handlePolish = async () => {
    setStep('polishing')
    setStreaming(true)
    setFinalText('')

    const userMsg = `다음 블로그 글을 애드센스 승인 기준에 맞게 개선해줘:\n\n${mergedText}`

    await streamClaude(ADSENSE_SYSTEM, userMsg,
      (text) => { setFinalText(prev => prev + text); setTimeout(scrollToBottom, 10) },
      () => { setStreaming(false); setStep('done') },
    )
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(finalText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setSelectedTopic(null)
    setDraft('')
    setFeedback('')
    setMergedText('')
    setFinalText('')
    setStep('topic')
  }

  const afterMerge = step === 'merged' || step === 'polishing' || step === 'done'

  return (
    <div ref={contentRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">

        {/* ── 1단계: 주제 선택 ── */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">1단계 — 주제 선택</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {TOPICS.map(topic => (
              <button
                key={topic.id}
                onClick={() => handleTopicSelect(topic)}
                className={`px-4 py-3 rounded-lg text-sm font-medium text-left transition-all ${
                  selectedTopic?.id === topic.id
                    ? 'bg-amber-500 text-white shadow-md scale-[1.02]'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-amber-300 hover:bg-amber-50'
                }`}
              >
                {topic.id}. {topic.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── 2단계: SEO 초안 생성 ── */}
        {selectedTopic && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">2단계 — SEO 초안 생성</h2>
            {step === 'topic' && (
              <button onClick={handleGenerateDraft} className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">초안 보기</button>
            )}
            {(step !== 'topic' && draft) && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">SEO 초안</span>
                  {step === 'drafting' && streaming && <span className="text-xs text-amber-500 animate-pulse">생성 중...</span>}
                </div>
                <article className={`prose ${step === 'drafting' && streaming ? 'streaming-cursor' : ''}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown>
                </article>
              </div>
            )}
          </section>
        )}

        {/* ── 3단계: 감상 입력 + 합치기 ── */}
        {(step === 'feedback' || step === 'merging' || afterMerge) && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">3단계 — 감상/비평 입력</h2>
            <p className="text-sm text-gray-500 mb-3">초안을 읽고 느낀 점, 본인 경험, 추가하고 싶은 내용을 자유롭게 써주세요. 많이 쓸수록 내 목소리가 더 잘 담겨요</p>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              disabled={step !== 'feedback'}
              placeholder="여기에 감상을 입력하세요..."
              className="w-full h-40 p-4 border border-gray-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            />
            {step === 'feedback' && feedback.trim().length > 0 && (
              <button onClick={handleMerge} className="mt-3 px-6 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors">내 목소리로 합치기</button>
            )}

            {/* 합쳐진 글 출력 */}
            {(step === 'merging' || afterMerge) && mergedText && (
              <div className="mt-6 bg-white rounded-lg border-2 border-amber-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded">합쳐진 글</span>
                  {step === 'merging' && streaming && <span className="text-xs text-amber-500 animate-pulse">생성 중...</span>}
                  {step === 'merged' && (
                    <button
                      onClick={handlePolish}
                      className="px-4 py-1.5 rounded-lg text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 transition-colors"
                    >
                      애드센스 코치 다듬기
                    </button>
                  )}
                </div>
                <article className={`prose ${step === 'merging' && streaming ? 'streaming-cursor' : ''}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{mergedText}</ReactMarkdown>
                </article>
              </div>
            )}
          </section>
        )}

        {/* ── 4단계: 애드센스 코치 최종글 ── */}
        {(step === 'polishing' || step === 'done') && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">4단계 — 애드센스 코치 최종글</h2>
            <div className="bg-white rounded-lg border-2 border-purple-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded">애드센스 최적화</span>
                {step === 'polishing' && streaming && <span className="text-xs text-purple-500 animate-pulse">다듬는 중...</span>}
                {step === 'done' && (
                  <button
                    onClick={handleCopy}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-purple-500 text-white hover:bg-purple-600'}`}
                  >
                    {copied ? '복사 완료!' : '전체 복사'}
                  </button>
                )}
              </div>
              <article className={`prose ${step === 'polishing' && streaming ? 'streaming-cursor' : ''}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{finalText}</ReactMarkdown>
              </article>
            </div>
          </section>
        )}

        {/* 다시 시작 */}
        {step === 'done' && (
          <div className="text-center pb-8">
            <button onClick={handleReset} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 underline">다른 주제로 다시 시작</button>
          </div>
        )}
      </div>
    </div>
  )
}
