import type { WebviewView, WebviewViewProvider } from 'vscode'
import type { Project } from '../project'
import { randomBytes } from 'node:crypto'
import { env, Uri } from 'vscode'
import { previewUrl } from '../project'

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char]!)
}

export function previewHtml(url: string, nonce: string) {
  const origin = escapeHtml(new URL(url).origin)
  return `<!doctype html><html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${origin}; style-src 'nonce-${nonce}';">
<style nonce="${nonce}">body{padding:0;margin:0}iframe{border:0;width:100%;height:calc(100vh - 48px)}p{padding:0 12px;font:12px sans-serif}</style>
</head><body><p>Run pnpm dev in this project. If preview is unavailable, check the server URL in Valaxy settings or use Open Browser Preview.</p>
<iframe title="Valaxy site preview" src="${escapeHtml(url)}"></iframe></body></html>`
}

export class PreviewProvider implements WebviewViewProvider {
  static readonly viewId = 'valaxy-preview'
  view?: WebviewView
  private target?: { project: Project, filePath?: string }
  private generation = 0

  async show(project: Project, filePath?: string) {
    this.target = { project, filePath }
    return this.refresh()
  }

  async refresh() {
    const generation = ++this.generation
    const target = this.target
    if (!target)
      return
    const local = Uri.parse(previewUrl(target.project, target.filePath))
    const external = await env.asExternalUri(local)
    if (generation !== this.generation)
      return local.toString()
    if (this.view) {
      this.view.webview.options = { enableScripts: true, localResourceRoots: [] }
      this.view.webview.html = previewHtml(external.toString(), randomBytes(16).toString('hex'))
    }
    return local.toString()
  }

  clear() {
    this.generation++
    this.target = undefined
    if (this.view)
      this.view.webview.html = '<p>Open a Markdown post in a Valaxy workspace to preview it.</p>'
  }

  async resolveWebviewView(view: WebviewView) {
    this.view = view
    view.onDidDispose(() => {
      if (this.view === view)
        this.view = undefined
    })
    if (this.target)
      await this.refresh()
    else
      this.clear()
  }
}
