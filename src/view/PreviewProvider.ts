import type { IncomingMessage } from 'node:http'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import type { WebviewView, WebviewViewProvider } from 'vscode'
import { window } from 'vscode'
import consola from 'consola'
import { ctx } from '../ctx'
import { config, setConfig } from '../config'
import { isDarkTheme } from '../utils'

export class PreviewProvider implements WebviewViewProvider {
  public static readonly viewId = 'valaxy-preview'
  public view: WebviewView | undefined

  public updateColor() {
    if (!this.view)
      return

    this.view.webview.postMessage({
      target: 'valaxy',
      type: 'css-vars',
      vars: {
        '--valaxy-container-background': 'transparent',
      },
    })
    this.view.webview.postMessage({
      target: 'valaxy',
      type: 'color-schema',
      color: isDarkTheme() ? 'dark' : 'light',
    })
  }

  goToPath(path: string) {
    if (!this.view)
      return

    this.view.webview.postMessage({
      target: 'valaxy-preview',
      type: 'go-to-path',
      path,
    })
  }

  public async refresh() {
    const editor = window.activeTextEditor
    if (!editor || editor.document !== ctx.doc)
      return

    if (!this.view)
      return

    this.view.webview.options = {
      enableScripts: true,
      localResourceRoots: [ctx.ext.extensionUri],
    }

    this.view.webview.onDidReceiveMessage(async ({ command }) => {
      if (command === 'config-port') {
        const port = await window.showInputBox({
          placeHolder: 'Server port',
        })
        if (port && !isNaN(+port)) {
          await setConfig('port', +port || 4859)
          this.refresh()
        }
      }
    })

    const serverAddr = `http://localhost:${config.port}/`
    const url = `${serverAddr}`

    const injectedConfig = [
      '<script>',
      `window.CONFIG = { serverAddr: '${serverAddr}', url: '${url}' }`,
      '</script>',
    ].join('\n')

    const previewErrorHtml = await readFile(ctx.ext.asAbsolutePath('./res/html/preview-error.html'), 'utf-8')
    this.view.webview.html = previewErrorHtml.replace('<!-- inject global var -->', injectedConfig)

    try {
      const res = await new Promise<IncomingMessage>((resolve, reject) => {
        const req = http.request(`${serverAddr}index.html`)

        req.on('response', (res) => {
          resolve(res)
        })

        req.on('error', (err) => {
          reject(err)
        })

        req.end()
      })

      if (res.statusCode !== 200)
        throw new Error('Server not found')
      else
        consola.success('Server found')
    }
    catch (e) {
      console.error(e)
      return
    }

    const previewHtml = await readFile(ctx.ext.asAbsolutePath('./res/html/preview.html'), 'utf-8')
    const previewTargetHtml = previewHtml.replace('<!-- inject global var -->', injectedConfig)
    this.view.webview.html = previewTargetHtml

    setTimeout(() => this.updateColor(), 10)
    setTimeout(() => this.updateColor(), 300)
    setTimeout(() => this.updateColor(), 1000)
  }

  public async resolveWebviewView(webviewView: WebviewView) {
    this.view = webviewView
    this.refresh()
  }
}
