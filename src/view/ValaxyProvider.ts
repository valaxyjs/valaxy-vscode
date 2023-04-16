import { Buffer } from 'node:buffer'
import type { ProviderResult, TreeDataProvider } from 'vscode'
import { EventEmitter, Uri, window, workspace } from 'vscode'
import { ctx } from '../ctx'
import { newPostTemplate } from '../../res/md/template'
import { PostItem } from './PostItem'

export class PostsProvider implements TreeDataProvider<PostItem> {
  private _onDidChangeTreeData = new EventEmitter<PostItem | undefined>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  async add(): Promise<void> {
    const EXIST_NOTICE_MSG = 'A post with the same name already exists'

    const input1 = await window.showInputBox({
      placeHolder: 'Type the filename/scaffold\'s name of the new post',
    })

    if (input1) {
      const uri = workspace.workspaceFolders?.[0].uri
      if (!uri)
        return

      try {
        await workspace.fs.stat(Uri.joinPath(uri, '/scaffolds', `${input1}.md`))
        const input2 = await window.showInputBox({
          placeHolder: 'Type the filename of the new post',
        })
        if (input2) {
          if (ctx.findPost(Uri.joinPath(uri, '/pages/posts', `${input2}.md`))) {
            window.showErrorMessage(EXIST_NOTICE_MSG)
            return
          }

          await workspace.fs.copy(Uri.joinPath(uri, '/scaffolds', `${input1}.md`), Uri.joinPath(uri, '/pages/posts', `${input2}.md`))
        }
      }
      catch {
        if (ctx.findPost(Uri.joinPath(uri, '/pages/posts', `${input1}.md`))) {
          window.showErrorMessage(EXIST_NOTICE_MSG)
          return
        }

        const filePath = Uri.joinPath(uri, '/pages/posts', `${input1}.md`)
        await workspace.fs.writeFile(filePath, Buffer.from(newPostTemplate()))
      }
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
