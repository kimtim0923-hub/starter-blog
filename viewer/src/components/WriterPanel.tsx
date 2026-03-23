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

const PASTE_SYSTEM = `당신은 한국 구글 애드센스 블로그 컨설턴트입니다. 블로그 글 본문을 직접 받아 분석합니다. 반드시 JSON만 반환하세요. 마크다운 코드블록 없이 순수 JSON만 출력하세요. 분석 기준: 글자수 2500자 미만 문제, AI 냄새(습니다체 과다/개인경험 없음), 소제목 범용성, 복사 의심. JSON: {"title":"글 제목","charCount":0,"aiSmellScore":0,"personalExpScore":0,"overallRisk":"high|mid|low","comment":"강사 총평","issues":[{"severity":"high|mid|low","title":"이슈 제목","description":"설명"}],"actionItems":["개선 항목 1","개선 항목 2"]}`

const REWRITE_SYSTEM = `당신은 한국 블로그 글 작성 전문가입니다. 애드센스 승인을 위해 글을 개선합니다. 규칙: AI 냄새 완전히 제거(습니다체 남발 금지, 자연스러운 구어체 혼합), 개인 경험처럼 느껴지는 문장 자연스럽게 삽입, 소제목은 독창적인 것으로, 2500자 이상, 수정 이유나 설명 없이 바로 글만 출력.`

type Step = 'topic' | 'drafting' | 'feedback' | 'merging' | 'done' | 'analyzing' | 'analyzed' | 'rewriting' | 'rewritten'

interface AnalysisResult {
  title: string
  charCount: number
  aiSmellScore: number
  personalExpScore: number
  overallRisk: 'high' | 'mid' | 'low'
  comment: string
  issues: { severity: string; title: string; description: string }[]
  actionItems: string[]
}

// ── API helpers ──

function getApiKey(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('anthropic_api_key')
}

function setApiKey(key: string) {
  localStorage.setItem('anthropic_api_key', key)
}

async function streamClaude(
  system: string,
  userMessage: string,
  onChunk: (text: string) => void,
  onDone: () => void,
) {
  const apiKey = getApiKey()
  if (!apiKey) {
    onChunk('[ERROR] API 키가 설정되지 않았습니다. 상단에서 Anthropic API 키를 입력해주세요.')
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

async function callClaude(system: string, userMessage: string): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) return '{"error":"API 키가 설정되지 않았습니다."}'

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
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  const data = await res.json()
  return data.content?.[0]?.text || ''
}

// ── Risk badge helper ──

function RiskBadge({ level }: { level: string }) {
  const cls =
    level === 'high' ? 'bg-red-100 text-red-700' :
    level === 'mid' ? 'bg-yellow-100 text-yellow-700' :
    'bg-green-100 text-green-700'
  const label = level === 'high' ? '위험' : level === 'mid' ? '주의' : '양호'
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${cls}`}>{label}</span>
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-8 text-right">{score}</span>
    </div>
  )
}

// ── Component ──

export default function WriterPanel({ keywords }: { keywords: Keyword[] }) {
  const [step, setStep] = useState<Step>('topic')
  const [selectedTopic, setSelectedTopic] = useState<typeof TOPICS[0] | null>(null)
  const [draft, setDraft] = useState('')
  const [feedback, setFeedback] = useState('')
  const [finalText, setFinalText] = useState('')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [rewrittenText, setRewrittenText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedRewrite, setCopiedRewrite] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useState(() => {
    if (typeof window !== 'undefined' && getApiKey()) {
      setApiKeySaved(true)
    }
  })

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
    setAnalysis(null)
    setRewrittenText('')
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

    await streamClaude(DRAFT_SYSTEM, userMsg,
      (text) => { setDraft(prev => prev + text); setTimeout(scrollToBottom, 10) },
      () => { setStreaming(false); setStep('feedback') },
    )
  }

  const handleGenerateFinal = async () => {
    if (!draft || !feedback.trim()) return
    setStep('merging')
    setStreaming(true)
    setFinalText('')

    const userMsg = `## 초안\n\n${draft}\n\n---\n\n## 필자의 감상/비평\n\n${feedback}\n\n---\n\n위 초안과 필자의 감상을 융합하여 최종 블로그 글을 작성해줘.`

    await streamClaude(MERGE_SYSTEM, userMsg,
      (text) => { setFinalText(prev => prev + text); setTimeout(scrollToBottom, 10) },
      () => { setStreaming(false); setStep('done') },
    )
  }

  const handleAnalyze = async () => {
    setStep('analyzing')
    setStreaming(true)
    setAnalysis(null)

    try {
      const raw = await callClaude(PASTE_SYSTEM, finalText)
      // JSON 파싱 (코드블록 제거)
      let cleaned = raw.trim()
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }
      const parsed = JSON.parse(cleaned) as AnalysisResult
      setAnalysis(parsed)
      setStep('analyzed')
    } catch {
      setAnalysis({ title: '', charCount: 0, aiSmellScore: 0, personalExpScore: 0, overallRisk: 'high', comment: '분석 실패: JSON 파싱 오류', issues: [], actionItems: [] })
      setStep('analyzed')
    }
    setStreaming(false)
  }

  const handleRewrite = async () => {
    setStep('rewriting')
    setStreaming(true)
    setRewrittenText('')

    const userMsg = `다음 블로그 글을 애드센스 승인 기준에 맞게 개선해줘:\n\n${finalText}`

    await streamClaude(REWRITE_SYSTEM, userMsg,
      (text) => { setRewrittenText(prev => prev + text); setTimeout(scrollToBottom, 10) },
      () => { setStreaming(false); setStep('rewritten') },
    )
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(finalText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyRewrite = async () => {
    await navigator.clipboard.writeText(rewrittenText)
    setCopiedRewrite(true)
    setTimeout(() => setCopiedRewrite(false), 2000)
  }

  const handleReset = () => {
    setSelectedTopic(null)
    setDraft('')
    setFeedback('')
    setFinalText('')
    setAnalysis(null)
    setRewrittenText('')
    setStep('topic')
  }

  const isStep5 = step === 'analyzing' || step === 'analyzed' || step === 'rewriting' || step === 'rewritten'

  return (
    <div ref={contentRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">

        {/* ── API 키 설정 ── */}
        {!apiKeySaved && (
          <section className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h2 className="text-sm font-semibold text-red-700 mb-2">Anthropic API 키 필요</h2>
            <p className="text-xs text-red-600 mb-3">키는 브라우저 localStorage에만 저장되며 서버로 전송되지 않습니다.</p>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="flex-1 px-3 py-2 text-sm border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <button
                onClick={() => { if (apiKeyInput.startsWith('sk-ant-')) { setApiKey(apiKeyInput); setApiKeySaved(true); setApiKeyInput('') } }}
                disabled={!apiKeyInput.startsWith('sk-ant-')}
                className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </section>
        )}
        {apiKeySaved && (
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs text-green-600">API 키 설정됨</span>
            <button onClick={() => { localStorage.removeItem('anthropic_api_key'); setApiKeySaved(false) }} className="text-xs text-gray-400 hover:text-red-500">키 초기화</button>
          </div>
        )}

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
              <button onClick={handleGenerateDraft} className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">초안 보기</button>
            )}
            {(step !== 'topic' && draft) && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">초안</span>
                  {step === 'drafting' && streaming && <span className="text-xs text-amber-500 animate-pulse">생성 중...</span>}
                </div>
                <article className={`prose ${step === 'drafting' && streaming ? 'streaming-cursor' : ''}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown>
                </article>
              </div>
            )}
          </section>
        )}

        {/* ── 3단계: 감상 입력 ── */}
        {(step === 'feedback' || step === 'merging' || step === 'done' || isStep5) && (
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
              <button onClick={handleGenerateFinal} className="mt-3 px-6 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors">내 목소리로 최종글 쓰기</button>
            )}
          </section>
        )}

        {/* ── 4단계: 최종글 ── */}
        {(step === 'merging' || step === 'done' || isStep5) && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">4단계 — 최종글</h2>
            <div className="bg-white rounded-lg border-2 border-amber-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded">최종글</span>
                {step === 'merging' && streaming && <span className="text-xs text-amber-500 animate-pulse">생성 중...</span>}
                {(step === 'done' || isStep5) && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
                    >
                      {copied ? '복사 완료!' : '전체 복사'}
                    </button>
                    {step === 'done' && (
                      <button
                        onClick={handleAnalyze}
                        className="px-4 py-1.5 rounded-lg text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 transition-colors"
                      >
                        애드센스 코치에게 다듬기
                      </button>
                    )}
                  </div>
                )}
              </div>
              <article className={`prose ${step === 'merging' && streaming ? 'streaming-cursor' : ''}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{finalText}</ReactMarkdown>
              </article>
            </div>
          </section>
        )}

        {/* ── 5단계: 애드센스 코치 ── */}
        {step === 'analyzing' && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">5단계 — 애드센스 코치 분석</h2>
            <div className="flex items-center gap-3 p-6 bg-purple-50 rounded-lg border border-purple-200">
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-purple-700">글을 분석하고 있어요...</span>
            </div>
          </section>
        )}

        {(step === 'analyzed' || step === 'rewriting' || step === 'rewritten') && analysis && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">5단계 — 애드센스 코치 분석</h2>

            {/* 점수 카드 */}
            <div className="bg-white rounded-lg border border-purple-200 p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-gray-800">진단 결과</span>
                <RiskBadge level={analysis.overallRisk} />
              </div>
              <div className="space-y-3 mb-4">
                <ScoreBar label="AI 냄새" score={analysis.aiSmellScore} color={analysis.aiSmellScore > 60 ? 'bg-red-400' : analysis.aiSmellScore > 30 ? 'bg-yellow-400' : 'bg-green-400'} />
                <ScoreBar label="개인 경험" score={analysis.personalExpScore} color={analysis.personalExpScore > 60 ? 'bg-green-400' : analysis.personalExpScore > 30 ? 'bg-yellow-400' : 'bg-red-400'} />
              </div>
              <p className="text-xs text-gray-500">글자수: {analysis.charCount}자</p>
            </div>

            {/* 총평 말풍선 */}
            <div className="bg-purple-50 rounded-lg p-4 mb-4 border-l-4 border-purple-400">
              <p className="text-sm text-purple-800 italic">&ldquo;{analysis.comment}&rdquo;</p>
            </div>

            {/* 이슈 리스트 */}
            {analysis.issues.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">발견된 이슈</h3>
                <div className="space-y-2">
                  {analysis.issues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded bg-gray-50">
                      <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded ${
                        issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                        issue.severity === 'mid' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>{issue.severity.toUpperCase()}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{issue.title}</p>
                        <p className="text-xs text-gray-500">{issue.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 액션 아이템 체크리스트 */}
            {analysis.actionItems.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">개선 체크리스트</h3>
                <div className="space-y-2">
                  {analysis.actionItems.map((item, i) => (
                    <label key={i} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" className="mt-1 accent-purple-500" />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 개선하기 버튼 */}
            {step === 'analyzed' && (
              <button
                onClick={handleRewrite}
                className="px-6 py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors"
              >
                이 글 개선하기
              </button>
            )}
          </section>
        )}

        {/* ── 5단계 - 개선된 글 ── */}
        {(step === 'rewriting' || step === 'rewritten') && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">개선된 최종글</h2>
            <div className="bg-white rounded-lg border-2 border-purple-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded">애드센스 최적화</span>
                {step === 'rewriting' && streaming && <span className="text-xs text-purple-500 animate-pulse">개선 중...</span>}
                {step === 'rewritten' && (
                  <button
                    onClick={handleCopyRewrite}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${copiedRewrite ? 'bg-green-500 text-white' : 'bg-purple-500 text-white hover:bg-purple-600'}`}
                  >
                    {copiedRewrite ? '복사 완료!' : '전체 복사'}
                  </button>
                )}
              </div>
              <article className={`prose ${step === 'rewriting' && streaming ? 'streaming-cursor' : ''}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{rewrittenText}</ReactMarkdown>
              </article>
            </div>
          </section>
        )}

        {/* 다시 시작 */}
        {(step === 'done' || step === 'rewritten') && (
          <div className="text-center pb-8">
            <button onClick={handleReset} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 underline">다른 주제로 다시 시작</button>
          </div>
        )}
      </div>
    </div>
  )
}
