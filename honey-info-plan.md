# honey-info 자동화 파이프라인 전체 계획

> 공공 포털의 지원금 공문서를 자동 수집 → 꿀정보 키워드 추출 → 영상 스크립트 생성 → 영상 제작 → 자동 업로드

---

## 전체 흐름

```
[공공포털 크롤링] → [꿀정보 판별] → [스크립트 생성] → [영상 제작] → [업로드]
   crawler.py       keyword_extractor.py   script_writer.py   video_assembler.py   uploader.py
```

---

## 폴더 구조

```
honey-info/
├── .env                      ← API 키, 설정값
├── output/                   ← 실행 결과 저장
│
├── scripts/
│   ├── crawler.py            ← 1단계: 공공포털 수집
│   ├── keyword_extractor.py  ← 2단계: 꿀정보 판별
│   ├── script_writer.py      ← 3단계: 영상 스크립트 생성
│   ├── video_assembler.py    ← 4단계: 영상 제작
│   ├── uploader.py           ← 5단계: 유튜브 업로드
│   └── scheduler.py          ← 전체 자동 반복 실행
│
└── references/
    ├── target-urls.md        ← 수집 대상 URL 목록
    └── filter-rules.md       ← 꿀정보 판별 기준
```

---

## .env 파일 (처음에 한 번만 설정)

```
ANTHROPIC_API_KEY=sk-ant-여기에입력
ELEVENLABS_API_KEY=여기에입력
YOUTUBE_CLIENT_ID=여기에입력
YOUTUBE_CLIENT_SECRET=여기에입력

DOMAIN=subsidy
SAVE_DIR=./output
CRAWL_INTERVAL_HOURS=24
```

---

## 단계별 상세 계획

### STEP 1 — 공공포털 크롤링 (`crawler.py`)

**역할:** open.go.kr(Playwright), 서울 정보소통광장(POST)에서 지원금 관련 공문서 목록 수집

**INPUT:** 도메인 키워드, 페이지 수

**OUTPUT:** `output/raw_documents_날짜.json`
```json
{
  "id": "opengov-12345678",
  "title": "2026년 청년 월세 지원 운영계획",
  "source": "open.go.kr",
  "agency": "국토교통부",
  "date": "2026-03-15",
  "url": "https://...",
  "snippet": "",
  "domain_tags": ["청년 월세"],
  "crawled_at": "2026-03-23T06:00:00"
}
```

**수집 대상 키워드 (`DOMAIN_KEYWORDS`):**
```python
DOMAIN_KEYWORDS = {
    "subsidy": [
        "청년 지원금", "청년수당", "생활비 지원", "주거 지원금", "청년 월세",
        "소상공인 지원", "자영업자 지원금", "긴급복지", "에너지바우처",
        "출산 지원금", "육아수당", "다자녀 혜택"
    ],
    "all": [
        "청년 지원금", "소상공인 지원", "긴급복지", "출산 지원금", "에너지바우처"
    ],
}
```

**실행:**
```bash
python scripts/crawler.py --domain subsidy --pages 5
```

---

### STEP 2 — 꿀정보 판별 & 키워드 추출 (`keyword_extractor.py`)

**역할:** 수집된 문서를 Claude API로 판별 → "일반인이 놓치기 쉬운 지원금 정보"만 선별

**INPUT:** `output/raw_documents_날짜.json`

**OUTPUT:** `output/keywords_날짜.json`
```json
{
  "keyword": "2026년 청년 월세 지원 신청 기준 및 지급 계획",
  "action_value": "high",
  "reason": "신청 자격·금액·기간이 공문서에 먼저 기록됨",
  "source_url": "https://...",
  "agency": "국토교통부",
  "date": "2026-03-15"
}
```

**꿀정보 판별 기준:**
- 일반 포털 검색으로는 찾기 어렵지만 공문서에는 기록된 지원금·혜택 정보
- 신청 기간, 지급 금액, 자격 조건이 포함되어 있거나 유추 가능한 정보
- 타이밍 차익이 있는 정보 (공문서 작성 → 공식 발표 사이, 신청 마감 임박 등)

**실행:**
```bash
python scripts/keyword_extractor.py --input output/raw_documents_날짜.json
```

**dry-run (API 비용 없이 테스트):**
```bash
python scripts/keyword_extractor.py --input output/raw_documents_날짜.json --dry-run
```

---

### STEP 3 — 영상 스크립트 생성 (`script_writer.py`)

**역할:** 키워드별로 후킹 문장 → 본문 → CTA 구조의 스크립트 자동 생성. 쇼츠(30초)·유튜브(3분) 두 버전

**INPUT:** `output/keywords_날짜.json`

**OUTPUT:** `output/scripts_날짜.json`
```json
{
  "keyword": "2026년 청년 월세 지원 신청 기준",
  "shorts_script": "이거 모르면 손해! 2026년 청년 월세 지원금...",
  "youtube_script": "안녕하세요. 오늘은 많은 분들이 놓치고 있는...",
  "thumbnail_copy": ["월세 20만원 돌려받는 법", "청년이라면 꼭 확인", "공문서에서 찾았습니다"],
  "hashtags": ["#청년지원금", "#월세지원", "#2026정부지원"]
}
```

**스크립트 구조:**
```
[쇼츠 30초]
- 00~03초: 후킹 ("이거 모르면 손해!")
- 03~20초: 핵심 정보 (지원금액, 대상, 신청방법)
- 20~30초: CTA ("댓글에 '신청' 남기면 링크 드려요")

[유튜브 3분]
- 00~20초: 후킹 + 오늘 다룰 내용 예고
- 20초~2분30초: 상세 설명 (자격조건, 신청절차, 주의사항)
- 2분30초~3분: 요약 + CTA + 구독 유도
```

**실행:**
```bash
python scripts/script_writer.py --input output/keywords_날짜.json
```

---

### STEP 4 — 영상 자동 제작 (`video_assembler.py`)

**역할:** TTS 나레이션 + 자막 슬라이드 + FFmpeg 영상 조립. 쇼츠(9:16)·유튜브(16:9) 출력

**필요 라이브러리:**
```bash
pip install pillow requests python-dotenv
# FFmpeg는 별도 설치 필요: https://ffmpeg.org/download.html
```

**INPUT:** `output/scripts_날짜.json`

**OUTPUT:**
- `output/video_shorts_날짜.mp4` (1080×1920, 30초)
- `output/video_youtube_날짜.mp4` (1920×1080, 3분)

**제작 순서:**
1. ElevenLabs API → 나레이션 MP3 생성
2. Pillow → 자막 슬라이드 이미지 생성
3. FFmpeg → 이미지 + 음성 합쳐서 MP4 출력

**실행:**
```bash
python scripts/video_assembler.py --input output/scripts_날짜.json --format shorts
python scripts/video_assembler.py --input output/scripts_날짜.json --format youtube
```

---

### STEP 5 — 유튜브 자동 업로드 (`uploader.py`)

**역할:** YouTube Data API v3로 제목·설명·태그·썸네일 포함해서 자동 업로드

**필요 라이브러리:**
```bash
pip install google-api-python-client google-auth-oauthlib
```

**INPUT:** `output/video_*.mp4` + `output/scripts_날짜.json`

**OUTPUT:** 유튜브 업로드 완료 + `output/upload_log.json`

**업로드 최적 시간:** 한국 기준 화·목 오후 7~9시

**실행:**
```bash
python scripts/uploader.py --video output/video_shorts_날짜.mp4 --meta output/scripts_날짜.json
```

---

### STEP 6 — 전체 자동화 스케줄러 (`scheduler.py`)

**역할:** 1~5단계를 매일 정해진 시간에 자동 순서 실행. 실패 단계만 재시도

**실행 주기:**
- 매일 오전 6시: 크롤링 + 키워드 추출 + 스크립트 생성
- 매일 오후 7시: 영상 제작 + 업로드

**실행:**
```bash
python scripts/scheduler.py            # 스케줄 모드
python scripts/scheduler.py --run-now  # 즉시 1회 전체 실행
```

---

## 권장 진행 순서

텍스트 결과물이 제대로 나오는지 먼저 검증한 뒤 영상 제작으로 넘어가세요.

```
1단계 완료 → 2단계 완료 → 3단계 완료  →  결과 확인 후  →  4단계 → 5단계 → 6단계
(크롤링)     (판별)        (스크립트)      (텍스트 검증)      (영상)   (업로드)  (자동화)
```

---

## 설치 명령어 전체 모음

```bash
# 기본 라이브러리
pip install requests beautifulsoup4 lxml python-dotenv

# Playwright (open.go.kr JS 렌더링용)
pip install playwright
python -m playwright install chromium

# 영상 제작
pip install pillow

# 유튜브 업로드
pip install google-api-python-client google-auth-oauthlib

# FFmpeg (별도 설치)
# Windows: https://ffmpeg.org/download.html
# Mac: brew install ffmpeg
# Ubuntu: sudo apt install ffmpeg
```
