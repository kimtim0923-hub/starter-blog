#!/usr/bin/env python3
"""STEP 2: 꿀정보 판별 & 키워드 추출 - Claude API로 공문서 중 '일반인이 놓치기 쉬운 지원금 정보' 선별"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

KST = timezone(timedelta(hours=9))
SAVE_DIR = os.getenv("SAVE_DIR", "./output")

SYSTEM_PROMPT = """당신은 공공 지원금 정보 분석 전문가입니다.
사용자가 공공포털에서 수집한 문서 목록을 제공하면, 각 문서를 분석하여 "일반인이 놓치기 쉬운 꿀정보"만 선별해주세요.

## 꿀정보 판별 기준
1. 일반 포털 검색으로는 찾기 어렵지만 공문서에는 기록된 지원금·혜택 정보
2. 신청 기간, 지급 금액, 자격 조건이 포함되어 있거나 유추 가능한 정보
3. 타이밍 차익이 있는 정보 (공문서 작성 → 공식 발표 사이, 신청 마감 임박 등)

## 제외 기준
- 이미 뉴스에 많이 보도된 일반적인 정보
- 공무원 내부 행정 절차에 해당하는 정보
- 제목만으로 내용을 알 수 없는 모호한 문서

## 출력 형식
반드시 JSON 배열로만 응답하세요. 다른 텍스트를 포함하지 마세요.
선별된 각 문서에 대해:
```json
[
  {
    "keyword": "핵심 정보를 요약한 한 줄 제목 (영상 제목으로 사용 가능하게)",
    "action_value": "high 또는 medium",
    "reason": "왜 꿀정보인지 한 줄 설명",
    "source_url": "원본 URL",
    "agency": "발행 기관",
    "date": "문서 날짜"
  }
]
```
꿀정보가 하나도 없으면 빈 배열 `[]`을 반환하세요."""


def extract_with_claude(documents: list[dict]) -> list[dict]:
    """Claude API로 꿀정보 판별"""
    import anthropic

    client = anthropic.Anthropic()

    # 문서를 10개씩 배치 처리
    batch_size = 10
    all_keywords = []

    for i in range(0, len(documents), batch_size):
        batch = documents[i:i + batch_size]
        docs_text = json.dumps(batch, ensure_ascii=False, indent=2)

        print(f"  [Claude API] 배치 {i // batch_size + 1} ({len(batch)}건 분석 중)...")

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"다음 공공포털 수집 문서를 분석하여 꿀정보만 선별해주세요:\n\n{docs_text}",
                }
            ],
        )

        response_text = message.content[0].text.strip()

        # JSON 파싱 (코드블록 제거)
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])

        try:
            keywords = json.loads(response_text)
            if isinstance(keywords, list):
                all_keywords.extend(keywords)
                print(f"    → {len(keywords)}건 꿀정보 발견")
            else:
                print(f"    → 예상치 못한 응답 형식")
        except json.JSONDecodeError:
            print(f"    → JSON 파싱 실패, 응답: {response_text[:200]}")

    return all_keywords


def extract_dry_run(documents: list[dict]) -> list[dict]:
    """API 없이 규칙 기반으로 꿀정보 후보 선별 (테스트용)"""
    honey_keywords = ["지원금", "수당", "바우처", "지급", "신청", "혜택", "보조금", "감면", "월세", "전세"]
    exclude_keywords = ["내부", "회의", "결재", "인사", "감사"]

    results = []
    for doc in documents:
        title = doc.get("title", "")

        # 제외 조건
        if any(ex in title for ex in exclude_keywords):
            continue

        # 포함 조건: 2개 이상의 꿀정보 키워드 매치
        matches = [kw for kw in honey_keywords if kw in title]
        if len(matches) >= 1:
            results.append({
                "keyword": title,
                "action_value": "high" if len(matches) >= 2 else "medium",
                "reason": f"키워드 매치: {', '.join(matches)}",
                "source_url": doc.get("url", ""),
                "agency": doc.get("agency", ""),
                "date": doc.get("date", ""),
            })

    return results


def main():
    parser = argparse.ArgumentParser(description="꿀정보 판별 & 키워드 추출")
    parser.add_argument("--input", required=True, help="raw_documents JSON 경로")
    parser.add_argument("--dry-run", action="store_true", help="API 호출 없이 규칙 기반 테스트")
    args = parser.parse_args()

    # 입력 파일 로드
    with open(args.input, "r", encoding="utf-8") as f:
        documents = json.load(f)

    print(f"[키워드 추출 시작] 입력 문서: {len(documents)}건, dry-run={args.dry_run}")

    if args.dry_run:
        keywords = extract_dry_run(documents)
    else:
        if not os.getenv("ANTHROPIC_API_KEY"):
            print("[ERROR] ANTHROPIC_API_KEY가 .env에 설정되지 않았습니다.")
            sys.exit(1)
        keywords = extract_with_claude(documents)

    # 저장
    os.makedirs(SAVE_DIR, exist_ok=True)
    today = datetime.now(KST).strftime("%Y%m%d")
    out_path = os.path.join(SAVE_DIR, f"keywords_{today}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(keywords, f, ensure_ascii=False, indent=2)

    print(f"\n[완료] {len(keywords)}건 꿀정보 추출 → {out_path}")
    return out_path


if __name__ == "__main__":
    main()
