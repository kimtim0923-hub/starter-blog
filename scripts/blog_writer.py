#!/usr/bin/env python3
"""총정리형 블로그 초안 5개 생성 — output/keywords_20260323.json 근거"""

import json
import os
from pathlib import Path

import anthropic
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

KEYWORDS_PATH = Path(__file__).resolve().parent.parent / "output" / "keywords_20260323.json"
SAVE_DIR = Path(__file__).resolve().parent.parent / "output" / "blog_draft"

TOPICS = [
    {
        "file": "draft_1.md",
        "title": "2026년 소상공인·자영업자 정부지원금 총정리 (놓치면 진짜 손해)",
        "focus": ["소상공인", "자영업", "사업자", "재창업", "경영환경", "LED간판", "온라인쇼핑몰", "가업승계"],
    },
    {
        "file": "draft_2.md",
        "title": "편의점·카페·음식점 사장님이 꼭 받아야 할 지원금 5가지",
        "focus": ["소상공인", "임대료", "LED간판", "경영환경개선", "직업전환", "자녀돌봄", "카페", "음식점"],
    },
    {
        "file": "draft_3.md",
        "title": "2026년 청년이라면 무조건 신청해야 할 지원금 완벽 가이드",
        "focus": ["청년", "월세", "전월세", "면접수당", "인턴십", "중개수수료", "문화복지", "학자금"],
    },
    {
        "file": "draft_4.md",
        "title": "긴급복지·에너지바우처·월세지원 — 지금 당장 신청 가능한 것들",
        "focus": ["긴급복지", "에너지바우처", "월세", "의료급여", "보철구", "출산비", "전세자금"],
    },
    {
        "file": "draft_5.md",
        "title": "많은 사람들이 모르는 숨겨진 정부지원금 총정리",
        "focus": ["우체국", "엄마보험", "SRT", "임산부", "공동육아", "가업승계", "시제품", "미환급금", "다자녀", "다태아"],
    },
]

SYSTEM_PROMPT = """당신은 정부지원금 전문 블로그 작가입니다.
키워드 데이터를 근거로, 주어진 주제에 맞는 총정리형 블로그 초안을 작성하세요.

## 규칙
- 이 글은 "초안"입니다. 필자의 목소리는 다음 단계에서 합칩니다.
- 구조와 정보 중심으로 작성
- 소제목(##), 숫자, 금액, 신청방법을 반드시 포함
- 2000자 내외
- 마크다운 형식
- 글 구조: 제목(H1) → 한줄요약 → 본문(소제목별 지원금 정리) → 신청 팁 → 마무리
- 각 지원금마다: 지원금명, 대상, 금액, 신청방법을 표나 리스트로 정리
- 출처 URL이 있으면 포함
- 글 상단에 `> [초안] 이 글은 초안입니다. 필자의 감상과 합쳐 최종본이 됩니다.` 표시"""


def load_keywords() -> list[dict]:
    with open(KEYWORDS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def filter_keywords(keywords: list[dict], focus: list[str]) -> list[dict]:
    relevant = [kw for kw in keywords if any(t in kw.get("keyword", "") for t in focus)]
    if len(relevant) < 3:
        return keywords
    return relevant


def generate_draft(client: anthropic.Anthropic, topic: dict, keywords: list[dict]) -> str:
    relevant = filter_keywords(keywords, topic["focus"])
    kw_text = json.dumps(relevant, ensure_ascii=False, indent=2)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": (
                f"주제: {topic['title']}\n\n"
                f"근거 데이터 ({len(relevant)}건):\n{kw_text}\n\n"
                f"위 데이터를 근거로 총정리형 블로그 초안을 마크다운으로 작성해주세요."
            ),
        }],
    )
    return message.content[0].text


def main():
    SAVE_DIR.mkdir(parents=True, exist_ok=True)
    client = anthropic.Anthropic()
    keywords = load_keywords()

    print(f"[블로그 초안 생성] 키워드 {len(keywords)}건 로드 완료\n")

    for i, topic in enumerate(TOPICS, 1):
        print(f"▶ [{i}/5] {topic['title']}")
        draft = generate_draft(client, topic, keywords)

        out_path = SAVE_DIR / topic["file"]
        out_path.write_text(draft, encoding="utf-8")
        print(f"  → {out_path} 저장 완료 ({len(draft)}자)\n")

    print("=" * 50)
    print("[완료] 초안 5개 생성 → output/blog_draft/")
    print("다음 단계: python scripts/blog_merger.py")


if __name__ == "__main__":
    main()
