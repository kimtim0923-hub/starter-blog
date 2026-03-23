#!/usr/bin/env python3
"""초안 + 본인 감상/비평 합쳐서 최종 블로그 글 생성"""

import json
import os
import sys
from pathlib import Path

import anthropic
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DRAFT_DIR = Path(__file__).resolve().parent.parent / "output" / "blog_draft"
FINAL_DIR = Path(__file__).resolve().parent.parent / "output" / "blog_final"

SYSTEM_PROMPT = """아래 초안과 필자의 실제 감상/비평을 자연스럽게 융합해서 최종 블로그 글을 써줘.
규칙:
- 필자의 감상과 표현을 최대한 살려서 글 전체에 자연스럽게 녹여넣어
- 필자가 쓴 문장은 가능하면 원문 그대로 유지
- ~습니다 금지, ~해요 ~거든요 ~잖아요 구어체
- AI가 쓴 티 절대 안 나게
- 2500자 이상
- 초안의 정보(숫자, 금액, 지원금명)는 반드시 유지
- 마크다운 형식 유지
- 글 상단의 [초안] 표시는 제거"""


def get_drafts() -> list[tuple[str, Path]]:
    """초안 파일 목록 반환 (제목, 경로)"""
    if not DRAFT_DIR.exists():
        print("[ERROR] output/blog_draft/ 폴더가 없습니다.")
        print("먼저 python scripts/blog_writer.py 를 실행하세요.")
        sys.exit(1)

    files = sorted(DRAFT_DIR.glob("draft_*.md"))
    if not files:
        print("[ERROR] 초안 파일이 없습니다.")
        sys.exit(1)

    drafts = []
    for f in files:
        content = f.read_text(encoding="utf-8")
        # 첫 H1에서 제목 추출
        for line in content.split("\n"):
            if line.startswith("# "):
                drafts.append((line[2:].strip(), f))
                break
        else:
            drafts.append((f.stem, f))

    return drafts


def merge_with_claude(client: anthropic.Anthropic, draft: str, feedback: str) -> str:
    """Claude API로 초안 + 감상 합치기"""
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=6000,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": (
                f"## 초안\n\n{draft}\n\n"
                f"---\n\n"
                f"## 필자의 감상/비평\n\n{feedback}\n\n"
                f"---\n\n"
                f"위 초안과 필자의 감상을 융합하여 최종 블로그 글을 작성해줘."
            ),
        }],
    )
    return message.content[0].text


def main():
    FINAL_DIR.mkdir(parents=True, exist_ok=True)
    client = anthropic.Anthropic()
    drafts = get_drafts()

    print("=" * 60)
    print("  블로그 최종글 생성기 (초안 + 감상 합치기)")
    print("=" * 60)

    # 이미 완료된 파일 확인
    done = set()
    for f in FINAL_DIR.glob("final_*.md"):
        num = f.stem.split("_")[1]
        done.add(num)

    for idx, (title, path) in enumerate(drafts, 1):
        num = str(idx)
        if num in done:
            print(f"\n[{idx}] {title}")
            print(f"  → final_{idx}.md 이미 존재. 건너뛰려면 Enter, 다시 하려면 'y' 입력: ", end="")
            choice = input().strip()
            if choice.lower() != "y":
                print("  → 건너뜀")
                continue

        draft_content = path.read_text(encoding="utf-8")

        print(f"\n{'='*60}")
        print(f"  [{idx}/5] {title}")
        print(f"{'='*60}\n")

        # 초안 출력
        print(draft_content)
        print(f"\n{'─'*60}")
        print(f"위 초안에 대한 감상이나 비평을 입력하세요 (1000자 내외)")
        print(f"입력 완료 후 빈 줄에서 Ctrl+D (Mac) 또는 Ctrl+Z (Windows)를 누르세요.")
        print(f"{'─'*60}\n")

        # 여러 줄 입력 받기
        lines = []
        try:
            while True:
                line = input()
                lines.append(line)
        except EOFError:
            pass

        feedback = "\n".join(lines)

        if len(feedback.strip()) < 10:
            print("\n[SKIP] 감상이 너무 짧습니다. 이 글은 건너뜁니다.")
            continue

        print(f"\n[처리 중] Claude API로 최종글 생성 중...")
        final = merge_with_claude(client, draft_content, feedback)

        out_path = FINAL_DIR / f"final_{idx}.md"
        out_path.write_text(final, encoding="utf-8")
        print(f"[저장 완료] {out_path} ({len(final)}자)")

    # 결과 요약
    finals = list(FINAL_DIR.glob("final_*.md"))
    print(f"\n{'='*60}")
    print(f"[완료] 최종글 {len(finals)}개 → output/blog_final/")
    for f in sorted(finals):
        print(f"  - {f.name}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
