import type { ProviderResult, TreeDataProvider } from 'vscode'
import { EventEmitter } from 'vscode'
import { ctx } from '../ctx'
import { PostItem } from './PostItem'

export class PostsProvider implements TreeDataProvider<PostItem> {
  private _onDidChangeTreeData = new EventEmitter<PostItem | undefined>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

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
