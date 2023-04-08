import type { WebviewView, WebviewViewProvider } from 'vscode'
import { window } from 'vscode'
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

    this.view.webview.html = `
<head>
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';"
  />
<head>
<script>
  const vscode = acquireVsCodeApi()
  window.configPort = () => {
    vscode.postMessage({
      command: 'config-port'
    })
  }
</script>
<style>
button {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: none;
  padding: 8px 12px;
}
button:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}
code {
  font-size: 0.9em;
  font-family: var(--vscode-editor-font-family);
  background: var(--vscode-textBlockQuote-border);
  border-radius: 4px;
  padding: 3px 5px;
}
</style>
<body>
  <div style="text-align: center"><p>Valaxy server is not found on <code>${serverAddr}</code></p><p>please run <code style="color: #679bbb">$ valaxy</code> first</p><br><button onclick="configPort()">Config Server Port</button></div>
</body>
`

    this.view.webview.html = `
<head>
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';"
  />
  <style>
  body {
    padding: 0;
    width: 100vw;
    height: 100vh;
  }
  iframe {
    border: none;
    width: 100%;
    height: 100%;
  }
  </style>
<head>
<body>
  <iframe id="iframe" src="${url}"></iframe>
  <script>
    var iframe = document.getElementById('iframe')
    window.addEventListener('message', ({ data }) => {
      if (data && data.target === 'valaxy') {
        iframe.contentWindow.postMessage(data, '${serverAddr}')
      }
    })
  </script>
</body>
`

    setTimeout(() => this.updateColor(), 10)
    setTimeout(() => this.updateColor(), 300)
    setTimeout(() => this.updateColor(), 1000)
  }

  public async resolveWebviewView(webviewView: WebviewView) {
    this.view = webviewView
    this.refresh()
  }
}
