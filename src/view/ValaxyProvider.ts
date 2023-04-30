import { Buffer } from 'node:buffer'
import type { ProviderResult, TreeDataProvider } from 'vscode'
import { EventEmitter, Uri, window, workspace } from 'vscode'
import { render } from 'ejs'
import { ctx } from '../ctx'
import { newPostTemplate } from '../../res/md/template'
import { formatTime } from '../utils'
import { PostItem } from './PostItem'

export class PostsProvider implements TreeDataProvider<PostItem> {
  private _onDidChangeTreeData = new EventEmitter<PostItem | undefined>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  async add(): Promise<void> {
    const EXIST_NOTICE_MSG = 'A post with the same name already exists'

    const postName = (await window.showInputBox({
      placeHolder: 'Type a filename or use a scaffold for the new post',
    }))?.trim()

    if (postName) {
      const uri = workspace.workspaceFolders?.[0].uri
      if (!uri)
        return

      try {
        const template = (await workspace.fs.readFile(Uri.joinPath(uri, '/scaffolds', `${postName}.md`))).toString()
        createPost(uri, 'post', render(template, { title: '', layout: 'post', date: formatTime(new Date()) }), true)
      }
      catch {
        createPost(uri, postName, newPostTemplate())
      }
    }

    async function createPost(uri: Uri, filename: string, content: string, autoSuffix = false, suffixNum = 0) {
      const sufFilename = `${filename}${suffixNum > 0 ? suffixNum : ''}.md`
      if (ctx.findPost(Uri.joinPath(uri, '/pages/posts', sufFilename))) {
        if (autoSuffix)
          createPost(uri, filename, content, true, suffixNum + 1)
        else
          window.showErrorMessage(EXIST_NOTICE_MSG)
        return
      }

      const filePath = Uri.joinPath(uri, '/pages/posts', sufFilename)
      await workspace.fs.writeFile(filePath, Buffer.from(content))
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
