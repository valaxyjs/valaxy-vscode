import fs from 'node:fs/promises'
import { join } from 'node:path'
import { Uri, commands, window, workspace } from 'vscode'
import Markdown from 'markdown-it'
import matter from 'gray-matter'
import { ctx } from './ctx'
import { PreviewProvider } from './view/PreviewProvider'
import { ValaxyProvider } from './view/ValaxyProvider'
import { config } from './config'
import type { PostItem } from './view/PostItem'

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

  const mdWatcher = workspace.createFileSystemWatcher(join(config.postsFolder, '**/*.md'), true, false)
  mdWatcher.onDidCreate(async (uri) => {
    const text = await fs.readFile(uri.fsPath, 'utf-8')
    const { data } = matter(text)
    ctx.addPost({
      frontmatter: data,
      path: uri.fsPath,
    })
  })
  mdWatcher
    .onDidChange(async (uri) => {
      if (uri.fsPath === ctx.doc?.uri.fsPath) {
        const text = await fs.readFile(uri.fsPath, 'utf-8')
        const { data } = matter(text)
        ctx.data = data
      }
    })
  mdWatcher.onDidDelete(async (uri) => {
    console.log('ondelete', uri.fsPath)
    ctx.deletePost(uri.fsPath)
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

  const provider = new ValaxyProvider()

  window.createTreeView('valaxy-posts', {
    treeDataProvider: provider,
    showCollapseAll: true,
  })

  commands.registerCommand('valaxy.preview-refresh', previewProvider.refresh.bind(previewProvider))

  registerCommands()

  // languages.registerFoldingRangeProvider({ language: 'markdown' }, new FoldingProvider())

  ctx.onDataUpdate(() => provider.refresh())

  update()
}

function registerCommands() {
  commands.registerCommand('valaxy.open-file', async (path: string) => {
    workspace.openTextDocument(path).then((doc) => {
      window.showTextDocument(doc)
    })
  })

  commands.registerCommand('valaxy.delete-post', async (item: PostItem) => {
    let canDelete = true
    if (config.confirmDelete) {
      const answer = await window.showWarningMessage(`Delete 「${item.label}」?`, 'Yes', 'No')
      if (answer !== 'Yes')
        canDelete = false
    }
    if (canDelete)
      workspace.fs.delete(Uri.file(item.info.path))
  })

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
}
