import { getPostList } from '@/lib/posts'
import Viewer from '@/components/Viewer'

export default function Home() {
  const posts = getPostList()
  return <Viewer posts={posts} />
}
