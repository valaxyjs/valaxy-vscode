import { Buffer } from 'node:buffer'
import type { ProviderResult, TreeDataProvider } from 'vscode'
import { EventEmitter, Uri, window, workspace } from 'vscode'
import { ctx } from '../ctx'
import { PostItem } from './PostItem'

export class PostsProvider implements TreeDataProvider<PostItem> {
  private _onDidChangeTreeData = new EventEmitter<PostItem | undefined>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  async add(): Promise<void> {
    const filename = await window.showInputBox({
      placeHolder: 'Type the filename of the new post',
    })

    if (filename) {
      const uri = workspace.workspaceFolders?.[0].uri
      if (!uri)
        return
      const filePath = Uri.joinPath(uri, '/posts', `${filename}.md`)
      const now = new Date().toISOString()
      await workspace.fs.writeFile(filePath, Buffer.from(`---
title: 
date: ${now}
updated: ${now}
tags:
  - 
categories: 
---\n`))
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined)
  }

  getTreeItem(element: PostItem): PostItem | Thenable<PostItem> {
    return element
  }

  getChildren(element?: PostItem): ProviderResult<PostItem[]> {
    if (!element)
      return ctx.posts.map(i => new PostItem(i))

    return []
  }
}
