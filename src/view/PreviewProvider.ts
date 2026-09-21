import type { WebviewView, WebviewViewProvider } from 'vscode'
import type { PreviewResult } from '../capabilities'
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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${origin}; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">body{padding:0;margin:0}iframe{border:0;width:100%;height:calc(100vh - 48px)}p{padding:0 12px;font:12px sans-serif}</style>
</head><body><p id="status">Run pnpm dev in this project. If preview is unavailable, check the server URL in Valaxy settings or use Open Browser Preview.</p>
<iframe title="Valaxy site preview" src="${escapeHtml(url)}"></iframe>
<script nonce="${nonce}">window.addEventListener('message', (event) => { if (event.data?.type === 'valaxy:preview-status') document.getElementById('status').textContent = event.data.message; });</script>
</body></html>`
}

export class PreviewProvider implements WebviewViewProvider {
  static readonly viewId = 'valaxy-preview'
  view?: WebviewView
  private target?: { project: Project, filePath?: string }
  private generation = 0
  private displayedProject?: string

  constructor(
    private resolve: (project: Project, file?: string) => Promise<PreviewResult> = async (project, file) => ({ urls: [previewUrl(project, file)] }),
    private choose: (urls: string[]) => Promise<string | undefined> = async () => undefined,
    private report: (message: string) => void = () => {},
  ) {}

  async show(project: Project, filePath?: string, interactive = false) {
    this.target = { project, filePath }
    return this.refresh(interactive)
  }

  async refresh(interactive = false) {
    const generation = ++this.generation
    const target = this.target
    if (!target)
      return
    const result = await this.resolve(target.project, target.filePath)
    if (generation !== this.generation)
      return result.urls.length === 1 ? result.urls[0] : undefined
    const url = result.urls.length === 1 ? result.urls[0] : interactive && result.urls.length > 1 ? await this.choose(result.urls) : undefined
    if (generation !== this.generation)
      return url
    if (!url) {
      const message = result.message || 'This article has multiple routes. Use Preview Refresh or Open Browser Preview to choose one.'
      this.report(message)
      if (this.view) {
        if (this.displayedProject === target.project.root) {
          await this.view.webview.postMessage({ type: 'valaxy:preview-status', message })
        }
        else {
          this.displayedProject = undefined
          this.view.webview.html = `<p>${escapeHtml(message)}</p>`
        }
      }
      return
    }
    const local = Uri.parse(url)
    const external = await env.asExternalUri(local)
    if (generation !== this.generation)
      return local.toString()
    if (this.view) {
      this.view.webview.options = { enableScripts: true, localResourceRoots: [] }
      this.view.webview.html = previewHtml(external.toString(), randomBytes(16).toString('hex'))
      this.displayedProject = target.project.root
    }
    return local.toString()
  }

  clear() {
    this.generation++
    this.target = undefined
    this.displayedProject = undefined
    if (this.view)
      this.view.webview.html = '<p>Open a Markdown post in a Valaxy workspace to preview it.</p>'
  }

  async resolveWebviewView(view: WebviewView) {
    this.view = view
    view.onDidDispose(() => {
      if (this.view === view) {
        this.view = undefined
        this.displayedProject = undefined
      }
    })
    if (this.target)
      await this.refresh()
    else
      this.clear()
  }
}
