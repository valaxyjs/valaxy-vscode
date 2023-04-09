import type { ExtensionContext, TextDocument } from 'vscode'
import { EventEmitter } from 'vscode'
import type { PostInfo } from './types'

export class Context {
  private _onDataUpdate = new EventEmitter<PostInfo['frontmatter']>()
  private _data: PostInfo['frontmatter'] = {}

  onDataUpdate = this._onDataUpdate.event

  ext: ExtensionContext = undefined!
  doc: TextDocument | undefined

  userRoot?: string
  postsRoot?: string

  /**
   * All posts in the workspace
   */
  posts: PostInfo[] = []

  get data() {
    return this._data
  }

  set data(data: PostInfo['frontmatter']) {
    this._data = data
    this._onDataUpdate.fire(data)

    this.updatePosts(data)
  }

  get subscriptions() {
    return this.ext.subscriptions
  }

  updatePosts(data: PostInfo['frontmatter']) {
    if (this.posts.length === 0)
      return
    const existPost = this.posts.find(p => p.path === this.doc?.uri.fsPath)
    if (existPost) {
      existPost.frontmatter = data
    }
    else {
      this.posts.push({
        frontmatter: data,
        path: this.doc?.uri.fsPath || '',
      })
      this.sortPosts()
    }
  }

  sortPosts() {
    this.posts.sort((a, b) => {
      const aDate = new Date(a.frontmatter.updated || a.frontmatter.date || Date.now())
      const bDate = new Date(b.frontmatter.updated || b.frontmatter.date || Date.now())
      return bDate.getTime() - aDate.getTime()
    })
  }
}

export const ctx = new Context()
