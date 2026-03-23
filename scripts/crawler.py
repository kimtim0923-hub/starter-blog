#!/usr/bin/env python3
"""STEP 1: 공공포털 크롤링
수집 소스:
  1. open.go.kr (정보공개포털) — Playwright 검색
  2. gov.kr RSS (정부24 서비스 목록) — 키 불필요
  3. bizinfo.go.kr (기업마당) — 웹 스크래핑
  4. bokjiro.go.kr (복지로) — Playwright SPA
"""

import argparse
import json
import os
import re
import hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

KST = timezone(timedelta(hours=9))
SAVE_DIR = os.getenv("SAVE_DIR", "./output")

DOMAIN_KEYWORDS = {
    "subsidy": [
        "청년 지원금", "청년수당", "주거 지원금", "청년 월세",
        "소상공인 지원", "긴급복지", "에너지바우처",
        "출산 지원금", "육아수당", "다자녀 혜택",
    ],
}

# 정부24 RSS — 지원금 관련 카테고리
GOV24_RSS_CATEGORIES = {
    "010000": "고용·취업",
    "020000": "창업·사업",
    "040000": "생활·안전",
    "060000": "결혼·육아·교육",
    "090000": "주택·부동산",
}

# 꿀정보 필터 키워드 (제목에 1개 이상 포함 시 수집)
HONEY_FILTER = [
    "지원금", "수당", "바우처", "보조금", "감면", "지급", "혜택",
    "대출", "융자", "신청", "지원사업", "무료", "할인", "장려금",
    "월세", "전세", "출산", "육아", "청년", "소상공인", "자영업",
]


def now_kst():
    return datetime.now(KST).isoformat()


def make_id(source: str, title: str) -> str:
    return f"{source}-{hashlib.md5(title.encode()).hexdigest()[:8]}"


def passes_filter(title: str) -> bool:
    return any(kw in title for kw in HONEY_FILTER)


# ═══════════════════════════════════════════════════════════════
#  1) 정부24 RSS (가장 안정적)
# ═══════════════════════════════════════════════════════════════
def crawl_gov24_rss() -> list[dict]:
    """정부24 RSS 피드에서 지원금 관련 서비스 수집"""
    results = []
    for cat_code, cat_name in GOV24_RSS_CATEGORIES.items():
        try:
            url = f"https://www.gov.kr/portal/rss/{cat_code}"
            resp = requests.get(url, timeout=15)
            if resp.status_code != 200:
                print(f"  [정부24 RSS] {cat_name} — HTTP {resp.status_code}")
                continue

            soup = BeautifulSoup(resp.text, "lxml-xml")
            items = soup.find_all("item")

            count = 0
            for item in items:
                title = item.find("title").text.strip() if item.find("title") else ""
                link = item.find("link").text.strip() if item.find("link") else ""
                desc = item.find("description").text.strip() if item.find("description") else ""

                if not passes_filter(title + desc):
                    continue

                if not link.startswith("http"):
                    link = f"https://www.gov.kr{link}"

                results.append({
                    "id": make_id("gov24", title),
                    "title": title,
                    "source": "gov.kr",
                    "agency": cat_name,
                    "date": "",
                    "url": link,
                    "snippet": desc[:200],
                    "domain_tags": [cat_name],
                    "crawled_at": now_kst(),
                })
                count += 1

            print(f"  [정부24 RSS] {cat_name} — {count}건 (전체 {len(items)}건 중)")
        except Exception as e:
            print(f"  [정부24 RSS] {cat_name} 오류: {e}")
    return results


# ═══════════════════════════════════════════════════════════════
#  2) open.go.kr (Playwright)
# ═══════════════════════════════════════════════════════════════
def crawl_opengov(keywords: list[str], pages: int) -> list[dict]:
    """open.go.kr 통합검색 결과 수집"""
    results = []
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  [open.go.kr] playwright 미설치 — 건너뜀")
        return results

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        for kw in keywords:
            for pg in range(1, pages + 1):
                try:
                    url = (
                        f"https://www.open.go.kr/com/search/uniSrhList.do"
                        f"?kwd={requests.utils.quote(kw)}&searchMainYn=Y"
                        f"&pageIndex={pg}"
                    )
                    page.goto(url, timeout=30000)
                    page.wait_for_timeout(2500)
                    html = page.content()
                    soup = BeautifulSoup(html, "lxml")

                    count = 0
                    # goDetail('문서ID', '날짜', '코드') 패턴 추출
                    for a_tag in soup.find_all("a", href=True):
                        href = a_tag["href"]
                        match = re.search(
                            r"goDetail[4]?\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)",
                            href,
                        )
                        if not match:
                            continue

                        doc_id, doc_date, doc_code = match.groups()
                        title_text = a_tag.get_text(strip=True)
                        if not title_text or len(title_text) < 5:
                            continue

                        # 상세 URL 구성
                        detail_url = (
                            f"https://www.open.go.kr/othicInfo/infoList/infoListDetl.do"
                            f"?prdnNstRgstNo={doc_id}&prdnDt={doc_date}&nstSeCd={doc_code}"
                        )

                        # 기관 정보 (인접 요소에서 추출 시도)
                        parent = a_tag.find_parent(["li", "tr", "div"])
                        agency = ""
                        if parent:
                            agency_el = parent.select_one(".organ, .agency, .dept")
                            if agency_el:
                                agency = agency_el.get_text(strip=True)

                        results.append({
                            "id": make_id("opengov", title_text),
                            "title": title_text,
                            "source": "open.go.kr",
                            "agency": agency,
                            "date": doc_date[:8] if len(doc_date) >= 8 else doc_date,
                            "url": detail_url,
                            "snippet": "",
                            "domain_tags": [kw],
                            "crawled_at": now_kst(),
                        })
                        count += 1

                    print(f"  [open.go.kr] '{kw}' p{pg} → {count}건")
                except Exception as e:
                    print(f"  [open.go.kr] '{kw}' p{pg} 오류: {e}")

        browser.close()
    return results


# ═══════════════════════════════════════════════════════════════
#  3) bizinfo.go.kr (기업마당)
# ═══════════════════════════════════════════════════════════════
def crawl_bizinfo(keywords: list[str], pages: int) -> list[dict]:
    """기업마당 지원사업 목록 웹 스크래핑"""
    results = []
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    })

    for kw in keywords:
        for pg in range(1, pages + 1):
            try:
                url = (
                    f"https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do"
                    f"?rows=10&cpage={pg}&skey=1&sval={requests.utils.quote(kw)}"
                )
                resp = session.get(url, timeout=15)
                if resp.status_code != 200:
                    continue

                soup = BeautifulSoup(resp.text, "lxml")
                rows = soup.select("table tbody tr, .tbl_list tbody tr, .board-list tbody tr")

                count = 0
                for row in rows:
                    a_tag = row.select_one("a[href]")
                    if not a_tag:
                        continue
                    title_text = a_tag.get_text(strip=True)
                    if not title_text or len(title_text) < 5:
                        continue

                    href = a_tag.get("href", "")
                    if not href.startswith("http"):
                        href = f"https://www.bizinfo.go.kr{href}"

                    tds = row.select("td")
                    agency = tds[1].get_text(strip=True) if len(tds) > 1 else ""
                    date_text = tds[-1].get_text(strip=True) if tds else ""

                    results.append({
                        "id": make_id("bizinfo", title_text),
                        "title": title_text,
                        "source": "bizinfo.go.kr",
                        "agency": agency,
                        "date": date_text,
                        "url": href,
                        "snippet": "",
                        "domain_tags": [kw],
                        "crawled_at": now_kst(),
                    })
                    count += 1

                print(f"  [기업마당] '{kw}' p{pg} → {count}건")
            except Exception as e:
                print(f"  [기업마당] '{kw}' p{pg} 오류: {e}")
    return results


# ═══════════════════════════════════════════════════════════════
#  4) bokjiro.go.kr (복지로) — Playwright SPA
# ═══════════════════════════════════════════════════════════════
def crawl_bokjiro(keywords: list[str]) -> list[dict]:
    """복지로 복지서비스 검색"""
    results = []
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  [복지로] playwright 미설치 — 건너뜀")
        return results

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        for kw in keywords:
            try:
                url = f"https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52005M.do"
                page.goto(url, timeout=30000)
                page.wait_for_timeout(3000)

                # 검색어 입력 시도
                search_input = page.query_selector("input[type='text'], input[name*='search'], input[placeholder*='검색']")
                if search_input:
                    search_input.fill(kw)
                    page.keyboard.press("Enter")
                    page.wait_for_timeout(3000)

                html = page.content()
                soup = BeautifulSoup(html, "lxml")

                count = 0
                for a_tag in soup.select("a[href]"):
                    title_text = a_tag.get_text(strip=True)
                    if len(title_text) > 10 and passes_filter(title_text):
                        href = a_tag.get("href", "")
                        if not href.startswith("http"):
                            href = f"https://www.bokjiro.go.kr{href}"

                        results.append({
                            "id": make_id("bokjiro", title_text),
                            "title": title_text,
                            "source": "bokjiro.go.kr",
                            "agency": "보건복지부",
                            "date": "",
                            "url": href,
                            "snippet": "",
                            "domain_tags": [kw],
                            "crawled_at": now_kst(),
                        })
                        count += 1

                print(f"  [복지로] '{kw}' → {count}건")
            except Exception as e:
                print(f"  [복지로] '{kw}' 오류: {e}")

        browser.close()
    return results


# ═══════════════════════════════════════════════════════════════
#  중복 제거 & 저장
# ═══════════════════════════════════════════════════════════════
def dedupe(docs: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for doc in docs:
        key = doc["title"].strip()
        if key not in seen:
            seen.add(key)
            unique.append(doc)
    return unique


def main():
    parser = argparse.ArgumentParser(description="공공포털 크롤러")
    parser.add_argument("--domain", default=os.getenv("DOMAIN", "subsidy"))
    parser.add_argument("--pages", type=int, default=2, help="페이지 수 (open.go.kr, 기업마당)")
    args = parser.parse_args()

    keywords = DOMAIN_KEYWORDS.get(args.domain, DOMAIN_KEYWORDS["subsidy"])
    print(f"[크롤링 시작] 도메인={args.domain}, 키워드={len(keywords)}개\n")

    all_docs = []

    # 1) 정부24 RSS (가장 안정적, 키 불필요)
    print("▶ 정부24 RSS 수집 중...")
    all_docs.extend(crawl_gov24_rss())

    # 2) open.go.kr
    print("\n▶ open.go.kr 수집 중...")
    all_docs.extend(crawl_opengov(keywords, args.pages))

    # 3) 기업마당
    print("\n▶ 기업마당 수집 중...")
    all_docs.extend(crawl_bizinfo(keywords, args.pages))

    # 4) 복지로
    print("\n▶ 복지로 수집 중...")
    all_docs.extend(crawl_bokjiro(keywords))

    # 중복 제거
    all_docs = dedupe(all_docs)

    # 저장
    os.makedirs(SAVE_DIR, exist_ok=True)
    today = datetime.now(KST).strftime("%Y%m%d")
    out_path = os.path.join(SAVE_DIR, f"raw_documents_{today}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_docs, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*50}")
    print(f"[완료] 총 {len(all_docs)}건 수집 → {out_path}")
    print(f"  - 정부24 RSS: 필터 통과 건")
    print(f"  - open.go.kr: 원문정보 검색 건")
    print(f"  - 기업마당: 지원사업 검색 건")
    print(f"  - 복지로: 복지서비스 검색 건")

    return out_path


if __name__ == "__main__":
    main()
