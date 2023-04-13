import { promises as fs } from 'node:fs'
import type { ExtensionContext, TextDocument, Uri } from 'vscode'
import { EventEmitter } from 'vscode'
import matter from 'gray-matter'
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
  }

  get subscriptions() {
    return this.ext.subscriptions
  }

  async updatePosts(uri: Uri) {
    if (this.posts.length === 0)
      return

    const existPost = this.posts.find(p => p.uri.fsPath === this.doc?.uri.fsPath)
    if (existPost) {
      const { frontmatter } = await this.readPost(uri)
      existPost.frontmatter = frontmatter

      // trigger refresh
      this.data = frontmatter
    }
    else { this.addPost(uri) }
  }

  async readPost(uri: Uri): Promise<PostInfo> {
    const text = await fs.readFile(uri.fsPath, 'utf-8')
    const { data } = matter(text)
    return {
      frontmatter: data,
      uri,
    }
  }

  async addPost(uri: Uri) {
    this.posts.push(await this.readPost(uri))
    this.sortPosts()
  }

  deletePost(path: string) {
    const index = this.posts.findIndex(p => p.uri.fsPath === path)
    if (index > -1)
      this.posts.splice(index, 1)
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
