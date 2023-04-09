import type { Command, ThemeIcon, TreeItem } from 'vscode'
import { ctx } from '../ctx'

import type { PostInfo } from '../types'

export class PostItem implements TreeItem {
  label: string
  description?: string
  iconPath?: string | ThemeIcon
  command?: Command

  constructor(public readonly info: PostInfo) {
    // this.label = `${info.index + 1} - ${info.title || ''}`

    this.command = {
      command: 'valaxy.open-file',
      title: 'Open File',
      arguments: [info.path],
    }

    this.label = info.frontmatter.title || 'Untitled'

    switch (info.frontmatter.layout) {
      case undefined:
      case '':
      case 'post':
        this.iconPath = ctx.ext.asAbsolutePath('./res/icons/ri-file-text-line.svg')
        break
    }

    if (info.frontmatter.draft)
      this.iconPath = ctx.ext.asAbsolutePath('./res/icons/ri-draft-line.svg')

    if (info.frontmatter.hide) {
      this.iconPath = ctx.ext.asAbsolutePath('./res/icons/ri-eye-off-line.svg')
      this.description = info.frontmatter.description || info.frontmatter.excerpt
    }
  }
}
