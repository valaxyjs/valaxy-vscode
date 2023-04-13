import type { Post } from 'valaxy/types/posts'
import type { Uri } from 'vscode'

export interface PostInfo {
  frontmatter: Post
  /**
   * file path
   */
  uri: Uri
}
