import type { ExtensionContext, TextDocument } from 'vscode'
import type { Post } from 'valaxy/types'
import { EventEmitter } from 'vscode'

// frontmatter
export type ValaxyMdData = Post | undefined

export class Context {
  private _onDataUpdate = new EventEmitter<ValaxyMdData>()
  private _data: ValaxyMdData

  onDataUpdate = this._onDataUpdate.event

  ext: ExtensionContext = undefined!
  doc: TextDocument | undefined

  get data() {
    return this._data
  }

  set data(data: ValaxyMdData) {
    this._data = data
    this._onDataUpdate.fire(data)
  }

  get subscriptions() {
    return this.ext.subscriptions
  }
}

export const ctx = new Context()
