import fs from 'fs'
import path from 'path'

const POSTS_DIR = path.join(process.cwd(), 'public', 'posts')

export interface PostMeta {
  slug: string
  filename: string
  title: string
  mtime: number
}

export function getPostList(): PostMeta[] {
  if (!fs.existsSync(POSTS_DIR)) return []

  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'))

  const posts: PostMeta[] = files.map(filename => {
    const filePath = path.join(POSTS_DIR, filename)
    const stat = fs.statSync(filePath)
    const content = fs.readFileSync(filePath, 'utf-8')

    // 첫 번째 H1에서 제목 추출
    const titleMatch = content.match(/^#\s+(.+)$/m)
    const title = titleMatch
      ? titleMatch[1]
      : filename.replace(/^\d+_/, '').replace(/\.md$/, '').replace(/-/g, ' ')

    return {
      slug: filename.replace(/\.md$/, ''),
      filename,
      title,
      mtime: stat.mtimeMs,
    }
  })

  // 최신순 정렬
  return posts.sort((a, b) => b.mtime - a.mtime)
}

export function getPostContent(slug: string): string | null {
  const filePath = path.join(POSTS_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null
  return fs.readFileSync(filePath, 'utf-8')
}
