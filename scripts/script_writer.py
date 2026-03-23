#!/usr/bin/env python3
"""STEP 3: 영상 스크립트 생성 - 키워드별로 쇼츠/유튜브 스크립트 자동 생성"""

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

SYSTEM_PROMPT = """당신은 유튜브 쇼츠와 유튜브 영상 스크립트 전문 작가입니다.
정부 지원금 관련 "꿀정보"를 일반 시청자가 쉽게 이해할 수 있는 영상 스크립트로 변환합니다.

## 스크립트 스타일
- 말투: 친근하지만 신뢰감 있는 톤 ("~입니다", "~하세요")
- 숫자, 금액, 날짜는 반드시 포함
- 어려운 행정 용어는 쉬운 말로 풀어서 설명

## 쇼츠 스크립트 (30초)
구조:
- 00~03초: 후킹 ("이거 모르면 손해!", "아직도 이거 안 받으셨어요?")
- 03~20초: 핵심 정보 (지원금액, 대상, 신청방법)
- 20~30초: CTA ("댓글에 '신청' 남기면 링크 드려요", "자세한 건 영상 설명란 확인!")

## 유튜브 스크립트 (3분)
구조:
- 00~20초: 후킹 + 오늘 다룰 내용 예고
- 20초~2분30초: 상세 설명 (자격조건, 신청절차, 주의사항, 실제 혜택 금액)
- 2분30초~3분: 요약 + CTA + 구독 유도

## 출력 형식
반드시 JSON 배열로만 응답하세요. 각 키워드에 대해:
```json
[
  {
    "keyword": "원본 키워드",
    "shorts_script": "쇼츠 30초 스크립트 전문",
    "youtube_script": "유튜브 3분 스크립트 전문",
    "thumbnail_copy": ["썸네일 문구1", "썸네일 문구2", "썸네일 문구3"],
    "hashtags": ["#해시태그1", "#해시태그2", "#해시태그3", "#해시태그4", "#해시태그5"]
  }
]
```"""


def generate_with_claude(keywords: list[dict]) -> list[dict]:
    """Claude API로 스크립트 생성"""
    import anthropic

    client = anthropic.Anthropic()
    all_scripts = []

    # 키워드를 3개씩 배치 처리 (스크립트는 길어서 작은 배치)
    batch_size = 3
    for i in range(0, len(keywords), batch_size):
        batch = keywords[i:i + batch_size]
        kw_text = json.dumps(batch, ensure_ascii=False, indent=2)

        print(f"  [Claude API] 배치 {i // batch_size + 1} ({len(batch)}건 스크립트 생성 중)...")

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8192,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"다음 꿀정보 키워드에 대해 쇼츠/유튜브 스크립트를 생성해주세요:\n\n{kw_text}",
                }
            ],
        )

        response_text = message.content[0].text.strip()

        # JSON 파싱
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])

        try:
            scripts = json.loads(response_text)
            if isinstance(scripts, list):
                all_scripts.extend(scripts)
                print(f"    → {len(scripts)}건 스크립트 생성 완료")
            else:
                print(f"    → 예상치 못한 응답 형식")
        except json.JSONDecodeError:
            print(f"    → JSON 파싱 실패, 응답: {response_text[:200]}")

    return all_scripts


def generate_dry_run(keywords: list[dict]) -> list[dict]:
    """API 없이 템플릿 기반 스크립트 생성 (테스트용)"""
    scripts = []
    for kw in keywords:
        title = kw.get("keyword", "지원금 정보")
        agency = kw.get("agency", "정부")

        shorts = (
            f"이거 모르면 손해입니다! "
            f"{title}에 대해 알려드릴게요. "
            f"{agency}에서 발표한 이 정보, 대부분의 분들이 모르고 계세요. "
            f"지금 바로 신청하실 수 있습니다. "
            f"자세한 신청 방법은 댓글에 '신청'이라고 남겨주시면 링크 보내드릴게요!"
        )

        youtube = (
            f"안녕하세요. 오늘은 많은 분들이 놓치고 있는 꿀정보를 가져왔습니다.\n\n"
            f"바로 {title}인데요.\n"
            f"{agency}에서 공식 문서로 발표한 내용입니다.\n\n"
            f"이 지원금의 핵심을 정리해드리겠습니다.\n"
            f"첫째, 신청 대상은 관련 조건을 충족하는 분들입니다.\n"
            f"둘째, 신청 방법은 온라인 또는 주민센터 방문입니다.\n"
            f"셋째, 신청 기간을 꼭 확인하셔야 합니다.\n\n"
            f"놓치면 안 되는 핵심 포인트를 다시 정리하면,\n"
            f"이 정보는 아직 일반에 많이 알려지지 않았습니다.\n"
            f"지금 바로 확인하시고 혜택 받으세요.\n\n"
            f"도움이 되셨다면 좋아요와 구독 부탁드립니다. "
            f"댓글에 궁금한 지원금 정보 남겨주시면 다음 영상에서 다룰게요!"
        )

        scripts.append({
            "keyword": title,
            "shorts_script": shorts,
            "youtube_script": youtube,
            "thumbnail_copy": [
                f"{title[:15]}... 놓치면 손해!",
                f"{agency} 공식 발표",
                "공문서에서 찾았습니다",
            ],
            "hashtags": ["#정부지원금", "#꿀정보", "#지원금신청", f"#{agency.replace(' ', '')}", "#2026지원금"],
        })

    return scripts


def main():
    parser = argparse.ArgumentParser(description="영상 스크립트 생성")
    parser.add_argument("--input", required=True, help="keywords JSON 경로")
    parser.add_argument("--dry-run", action="store_true", help="API 호출 없이 템플릿 테스트")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        keywords = json.load(f)

    print(f"[스크립트 생성 시작] 입력 키워드: {len(keywords)}건, dry-run={args.dry_run}")

    if not keywords:
        print("[SKIP] 키워드가 0건이므로 스크립트 생성을 건너뜁니다.")
        return

    if args.dry_run:
        scripts = generate_dry_run(keywords)
    else:
        if not os.getenv("ANTHROPIC_API_KEY"):
            print("[ERROR] ANTHROPIC_API_KEY가 .env에 설정되지 않았습니다.")
            sys.exit(1)
        scripts = generate_with_claude(keywords)

    # 저장
    os.makedirs(SAVE_DIR, exist_ok=True)
    today = datetime.now(KST).strftime("%Y%m%d")
    out_path = os.path.join(SAVE_DIR, f"scripts_{today}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(scripts, f, ensure_ascii=False, indent=2)

    print(f"\n[완료] {len(scripts)}건 스크립트 생성 → {out_path}")

    # 미리보기 출력
    if scripts:
        print("\n" + "=" * 60)
        print("📋 첫 번째 스크립트 미리보기:")
        print("=" * 60)
        s = scripts[0]
        print(f"\n키워드: {s['keyword']}")
        print(f"\n[쇼츠 스크립트]\n{s['shorts_script']}")
        print(f"\n[썸네일 문구] {s['thumbnail_copy']}")
        print(f"[해시태그] {' '.join(s['hashtags'])}")

    return out_path


if __name__ == "__main__":
    main()
