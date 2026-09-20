import type { Post } from '../project'
import path from 'node:path'
import { ThemeIcon, TreeItem, Uri } from 'vscode'

export class PostItem extends TreeItem {
  constructor(public readonly post: Post) {
    super(typeof post.frontmatter.title === 'string' ? post.frontmatter.title : path.basename(post.filePath, '.md'))
    this.id = `${post.project.root}:${post.filePath}`
    this.resourceUri = Uri.file(post.filePath)
    this.description = path.relative(post.project.postsRoot, post.filePath)
    this.tooltip = post.filePath
    this.contextValue = 'valaxy-post'
    this.iconPath = new ThemeIcon(post.frontmatter.draft ? 'edit' : 'markdown')
    this.command = { command: 'valaxy.open-file', title: 'Open Post', arguments: [this] }
  }
}
