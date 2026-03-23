# 꿀정보 뷰어

> 공공 지원금 꿀정보 블로그 뷰어입니다.

## 사용 방법

| 단계 | 명령어 | 결과 |
|------|--------|------|
| 1 | `python scripts/blog_writer.py` | 초안 5개 생성 |
| 2 | `python scripts/blog_merger.py` | 감상 입력 → 최종글 |
| 3 | `git push` | Vercel 자동 배포 |

## 다음 단계

- 초안을 생성하고 감상을 작성하면 이 뷰어에 글이 표시됩니다.
- `output/blog_final/` 의 md 파일을 `viewer/public/posts/`에 복사 후 push하세요.
