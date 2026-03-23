/**
 * 빌드/dev 시 output 하위 md 파일 → public/posts/ 자동 복사
 * 우선순위: blog_final > blog_draft > blog
 */
const fs = require('fs')
const path = require('path')

const OUTPUT = path.resolve(__dirname, '../../output')
const DEST = path.resolve(__dirname, '../public/posts')

// 복사 대상 폴더 (우선순위 순)
const SRC_DIRS = [
  path.join(OUTPUT, 'blog_final'),
  path.join(OUTPUT, 'blog_draft'),
  path.join(OUTPUT, 'blog'),
]

fs.mkdirSync(DEST, { recursive: true })

// 기존 파일 정리
for (const f of fs.readdirSync(DEST)) {
  if (f.endsWith('.md')) fs.unlinkSync(path.join(DEST, f))
}

// 존재하는 모든 소스에서 복사
let total = 0
for (const src of SRC_DIRS) {
  if (!fs.existsSync(src)) continue
  const files = fs.readdirSync(src).filter(f => f.endsWith('.md'))
  for (const f of files) {
    const destFile = path.join(DEST, f)
    // 같은 이름이 이미 있으면 건너뜀 (우선순위 높은 폴더가 먼저)
    if (!fs.existsSync(destFile)) {
      fs.copyFileSync(path.join(src, f), destFile)
      total++
    }
  }
  if (files.length > 0) {
    console.log(`[copy-posts] ${src.split('/').pop()}/: ${files.length}개 발견`)
  }
}

console.log(`[copy-posts] 총 ${total}개 md 파일 복사 완료 → public/posts/`)
