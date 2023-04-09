import type { Post } from 'valaxy/types/posts'

export interface PostInfo {
  frontmatter: Post
  /**
   * file path
   */
  path: string
}
