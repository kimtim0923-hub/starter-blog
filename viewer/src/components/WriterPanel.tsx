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

const DRAFT_SYSTEM = `당신은 정부지원금 전문 블로그 작가입니다.
주어진 주제와 근거 데이터로 총정리형 블로그 초안을 작성하세요.
규칙:
- 구조와 정보 중심으로 작성 (필자의 목소리는 다음 단계에서 합침)
- 소제목(##), 숫자, 금액, 신청방법을 반드시 포함
- 1500자 내외
- 마크다운 형식
- 글 구조: 제목(H1) → 한줄요약 → 본문(소제목별 지원금 정리) → 신청 팁 → 마무리
- 각 지원금마다: 지원금명, 대상, 금액, 신청방법을 표나 리스트로 정리`

const MERGE_SYSTEM = `친한 선배 컨설턴트 톤. ~습니다 금지. ~해요 ~거든요 ~잖아요 구어체. 첫 문장 공감 후킹. 숫자와 금액 포함. 2500자 이상. 필자의 감상과 표현을 최대한 살려서 글 전체에 자연스럽게 녹여넣어. 필자가 쓴 문장은 가능하면 원문 그대로 유지. AI 티 절대 안 나게. 마크다운 형식.`

type Step = 'topic' | 'drafting' | 'feedback' | 'merging' | 'done'

async function streamClaude(
  system: string,
  userMessage: string,
  onChunk: (text: string) => void,
  onDone: () => void,
) {
  const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY
  if (!apiKey) {
    onChunk('[ERROR] NEXT_PUBLIC_ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.')
    onDone()
    return
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      system,
      messages: [{ role: 'user', content: userMessage }],
      stream: true,
    }),
  })

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

export default function WriterPanel({ keywords }: { keywords: Keyword[] }) {
  const [step, setStep] = useState<Step>('topic')
  const [selectedTopic, setSelectedTopic] = useState<typeof TOPICS[0] | null>(null)
  const [draft, setDraft] = useState('')
  const [feedback, setFeedback] = useState('')
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
    setFinalText('')
    setStep('topic')
  }

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

    await streamClaude(
      DRAFT_SYSTEM,
      userMsg,
      (text) => {
        setDraft(prev => prev + text)
        setTimeout(scrollToBottom, 10)
      },
      () => {
        setStreaming(false)
        setStep('feedback')
      },
    )
  }

  const handleGenerateFinal = async () => {
    if (!draft || !feedback.trim()) return
    setStep('merging')
    setStreaming(true)
    setFinalText('')

    const userMsg = `## 초안\n\n${draft}\n\n---\n\n## 필자의 감상/비평\n\n${feedback}\n\n---\n\n위 초안과 필자의 감상을 융합하여 최종 블로그 글을 작성해줘.`

    await streamClaude(
      MERGE_SYSTEM,
      userMsg,
      (text) => {
        setFinalText(prev => prev + text)
        setTimeout(scrollToBottom, 10)
      },
      () => {
        setStreaming(false)
        setStep('done')
      },
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
    setFinalText('')
    setStep('topic')
  }

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

        {/* ── 2단계: 초안 생성 ── */}
        {selectedTopic && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">2단계 — 초안 생성</h2>

            {step === 'topic' && (
              <button
                onClick={handleGenerateDraft}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
              >
                초안 보기
              </button>
            )}

            {(step !== 'topic' && draft) && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">초안</span>
                  {step === 'drafting' && streaming && (
                    <span className="text-xs text-amber-500 animate-pulse">생성 중...</span>
                  )}
                </div>
                <article className={`prose ${step === 'drafting' && streaming ? 'streaming-cursor' : ''}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown>
                </article>
              </div>
            )}
          </section>
        )}

        {/* ── 3단계: 감상 입력 ── */}
        {(step === 'feedback' || step === 'merging' || step === 'done') && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">3단계 — 감상/비평 입력</h2>
            <p className="text-sm text-gray-500 mb-3">
              초안을 읽고 느낀 점, 본인 경험, 추가하고 싶은 내용을 자유롭게 써주세요. 많이 쓸수록 내 목소리가 더 잘 담겨요
            </p>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              disabled={step !== 'feedback'}
              placeholder="여기에 감상을 입력하세요..."
              className="w-full h-40 p-4 border border-gray-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            />
            {step === 'feedback' && feedback.trim().length > 0 && (
              <button
                onClick={handleGenerateFinal}
                className="mt-3 px-6 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
              >
                내 목소리로 최종글 쓰기
              </button>
            )}
          </section>
        )}

        {/* ── 4단계: 최종글 ── */}
        {(step === 'merging' || step === 'done') && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">4단계 — 최종글</h2>
            <div className="bg-white rounded-lg border-2 border-amber-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded">최종글</span>
                {step === 'merging' && streaming && (
                  <span className="text-xs text-amber-500 animate-pulse">생성 중...</span>
                )}
                {step === 'done' && (
                  <button
                    onClick={handleCopy}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      copied ? 'bg-green-500 text-white' : 'bg-amber-500 text-white hover:bg-amber-600'
                    }`}
                  >
                    {copied ? '복사 완료!' : '전체 복사'}
                  </button>
                )}
              </div>
              <article className={`prose ${step === 'merging' && streaming ? 'streaming-cursor' : ''}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{finalText}</ReactMarkdown>
              </article>
            </div>
          </section>
        )}

        {/* 다시 시작 */}
        {step === 'done' && (
          <div className="text-center pb-8">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 underline"
            >
              다른 주제로 다시 시작
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
