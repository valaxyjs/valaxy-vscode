import fs from 'node:fs/promises'
import { commands, window, workspace } from 'vscode'
import Markdown from 'markdown-it'
import matter from 'gray-matter'
import { ctx } from './ctx'
import { PreviewProvider } from './view/PreviewProvider'

export function configEditor() {
  const previewProvider = new PreviewProvider()

  async function update() {
    const editor = window.activeTextEditor
    const doc = editor?.document
    if (!editor || !doc || doc.languageId !== 'markdown')
      return
    const path = doc.uri.fsPath

    // ignore for sub entries
    if (ctx.data?.entries?.includes(path) && ctx.data.filepath !== path)
      return

    ctx.doc = doc
    const { data } = matter(doc.getText())
    ctx.data = data
  }

  workspace.createFileSystemWatcher('**/*.md', true, false)
    .onDidChange(async (uri) => {
      if (uri.fsPath === ctx.doc?.uri.fsPath) {
        const text = await fs.readFile(uri.fsPath, 'utf-8')
        const { data } = matter(text)
        ctx.data = data
      }
    })

  ctx.subscriptions.push(
    workspace.onDidSaveTextDocument(update),
    window.onDidChangeActiveTextEditor(update),
    window.registerWebviewViewProvider(
      PreviewProvider.viewId,
      previewProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  )

  // const provider = new ValaxyProvider()

  // window.createTreeView('valaxy-post', {
  //   treeDataProvider: provider,
  //   showCollapseAll: true,
  // })

  commands.registerCommand('valaxy.preview-refresh', previewProvider.refresh.bind(previewProvider))

  commands.registerCommand('valaxy.markdown-to-html', async () => {
    const editor = window.activeTextEditor
    const doc = editor?.document
    if (!editor || !doc)
      return

    const range = editor.selection
    const md = doc.getText(range)
    const html = new Markdown({
      html: true,
      linkify: true,
      xhtmlOut: true,
    }).render(md)

    editor.edit((edit) => {
      edit.replace(range, html)
    })
  })

  // languages.registerFoldingRangeProvider({ language: 'markdown' }, new FoldingProvider())

  // ctx.onDataUpdate(() => provider.refresh())

  update()
}
