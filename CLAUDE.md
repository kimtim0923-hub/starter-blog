# honey-info: 공공 지원금 꿀정보 자동화 파이프라인

> 공공 포털의 지원금 공문서를 자동 수집 → 꿀정보 판별 → 블로그 글 생성 → 티스토리 자동 포스팅

## 서비스 개요

일반인이 놓치기 쉬운 정부 지원금 정보를 공공포털에서 자동 수집하고, AI로 블로그 글을 생성하여 티스토리에 게시하는 자동화 파이프라인.

**타겟 독자:** 청년, 소상공인, 자영업자, 육아·출산 가정 등 지원금 대상자
**수익 모델:** 티스토리 애드센스

## 전체 흐름

```
[공공포털 크롤링] → [꿀정보 판별] → [블로그 글 생성] → [티스토리 포스팅]
  crawler.py      keyword_extractor.py   viewer (Next.js)    selenium (예정)
```

## 현재 완성된 것

### 1. 데이터 파이프라인 (Python scripts/)
- **crawler.py** — open.go.kr + gov.kr RSS + bizinfo.go.kr + bokjiro.go.kr에서 지원금 데이터 수집
- **keyword_extractor.py** — Claude API로 61건 꿀정보 선별 (high/medium 등급)
- **script_writer.py** — 쇼츠/유튜브 영상 스크립트 생성
- **blog_writer.py** — 주제별 총정리 블로그 초안 5개 생성
- **blog_merger.py** — 초안 + 필자 감상 합쳐서 최종글 생성 (CLI)

### 2. 블로그 생성기 (viewer/ Next.js, Vercel 배포)
- **URL:** https://starter-blog-wgxu.vercel.app
- **GitHub:** https://github.com/kimtim0923-hub/starter-blog
- 4단계 플로우:
  1. 주제 선택 (5개 카테고리, 제목 제안 포함)
  2. SEO 초안 생성 (키워드 선택 → Claude 스트리밍, 출처 URL 인라인 표기)
  3. 감상/비평 입력 → "내 목소리로 합치기" (중간~후반에 필자 목소리 배치)
  4. 애드센스 코치 다듬기 → 최종글 복사 (마크다운 제거된 플레인텍스트)
- 부가 기능: 스타일 프리셋 저장 (톤/인트로/클로징, localStorage), 날짜 자동 삽입

### 3. 수집 데이터 (output/)
- raw_documents_20260323.json — 211건 원본
- keywords_20260323.json — 61건 꿀정보
- scripts_20260323.json — 61건 영상 스크립트

## 다음 단계 (미구현)

- **Selenium 티스토리 자동 포스팅** — viewer에서 생성한 글을 티스토리에 자동 게시
- 영상 제작 (video_assembler.py) — TTS + 자막 + FFmpeg
- 유튜브 업로드 (uploader.py)
- 전체 스케줄러 (scheduler.py)

## 폴더 구조

```
honeyinfo/
├── .env                          ← API 키 (git 제외)
├── CLAUDE.md                     ← 이 파일
├── scripts/
│   ├── crawler.py                ← 공공포털 크롤링
│   ├── keyword_extractor.py      ← Claude API 꿀정보 판별
│   ├── script_writer.py          ← 영상 스크립트 생성
│   ├── blog_writer.py            ← 총정리 블로그 초안 생성
│   └── blog_merger.py            ← 초안 + 감상 합치기 (CLI)
├── viewer/                       ← Next.js 블로그 생성기 (Vercel)
│   ├── src/app/                  ← App Router
│   ├── src/components/
│   │   ├── WriterPanel.tsx       ← 4단계 글 생성 플로우 (핵심)
│   │   └── KeywordPanel.tsx      ← 왼쪽 키워드 리스트
│   ├── src/app/api/chat/route.ts ← Claude API 프록시
│   ├── public/data/keywords.json ← 수집 키워드 데이터
│   └── scripts/copy-posts.js     ← 빌드 시 데이터 복사
└── output/                       ← 실행 결과 (git 제외)
```

## 기술 스택

- **Python 3.11** — 크롤링, 데이터 처리
- **Playwright** — JS 렌더링 필요한 사이트 크롤링
- **Anthropic Claude API** (claude-sonnet-4-20250514) — 꿀정보 판별, 글 생성
- **Next.js 14 + Tailwind** — 블로그 생성기 UI
- **Vercel** — viewer 배포
- **Vercel 환경변수:** ANTHROPIC_API_KEY (서버사이드 프록시)

## 개발 규칙

- 테스트, 빌드, 샘플 파일 생성은 하지 마라
- 코드만 만들고 실행은 내가 직접 한다
- TypeScript 빌드 에러 체크는 `cd viewer && npx tsc --noEmit`
- git push하면 Vercel 자동 배포됨

## 크롤링 스케줄 주기

- **매일 오전 6시:** 크롤링 → 꿀정보 판별 → 키워드 추출
- **매일 오후 7시:** 영상 제작 → 업로드 (미구현)
- 크롤링 간격: 24시간 (.env CRAWL_INTERVAL_HOURS=24)
- 수집 소스별 갱신 빈도:
  - gov.kr RSS: 실시간 (100건/카테고리)
  - open.go.kr: 매일 공문서 업데이트
  - bizinfo.go.kr: 수시 공고 등록
  - bokjiro.go.kr: SPA, 크롤링 제한적

## 실행 명령어

```bash
# 1. 크롤링
python3 scripts/crawler.py --domain subsidy --pages 3

# 2. 꿀정보 판별
python3 scripts/keyword_extractor.py --input output/raw_documents_날짜.json

# 3. 블로그 초안 생성
python3 scripts/blog_writer.py

# 4. 초안 + 감상 합치기
python3 scripts/blog_merger.py

# viewer 로컬 실행
cd viewer && npm install && npm run dev
```
