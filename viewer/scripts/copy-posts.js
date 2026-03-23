/**
 * 빌드/dev 시 output/keywords_20260323.json → public/data/keywords.json 복사
 */
const fs = require('fs')
const path = require('path')

const OUTPUT = path.resolve(__dirname, '../../output')
const DATA_DEST = path.resolve(__dirname, '../public/data')

fs.mkdirSync(DATA_DEST, { recursive: true })

// keywords.json 복사
const kwSrc = path.join(OUTPUT, 'keywords_20260323.json')
const kwDest = path.join(DATA_DEST, 'keywords.json')

if (fs.existsSync(kwSrc)) {
  fs.copyFileSync(kwSrc, kwDest)
  const data = JSON.parse(fs.readFileSync(kwSrc, 'utf-8'))
  console.log(`[copy-data] keywords.json 복사 완료 (${data.length}건)`)
} else {
  // 빌드 환경에 원본이 없으면 기존 파일 유지
  if (fs.existsSync(kwDest)) {
    console.log('[copy-data] 기존 keywords.json 유지')
  } else {
    fs.writeFileSync(kwDest, '[]')
    console.log('[copy-data] 빈 keywords.json 생성')
  }
}
