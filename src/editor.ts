import type { Uri } from 'vscode'
import { commands, window, workspace } from 'vscode'
import Markdown from 'markdown-it'
import matter from 'gray-matter'
import { ctx } from './ctx'
import { PreviewProvider } from './view/PreviewProvider'
import { PostsProvider } from './view/ValaxyProvider'
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

  const postsProvider = new PostsProvider()

  const mdWatcher = workspace.createFileSystemWatcher('**/*.md')
  mdWatcher.onDidCreate(async (uri) => {
    await ctx.addPost(uri)
    postsProvider.refresh()
  })
  mdWatcher
    .onDidChange(async (uri) => {
      if (uri.fsPath === ctx.doc?.uri.fsPath)
        ctx.updatePosts(uri)
    })
  mdWatcher.onDidDelete(async (uri) => {
    ctx.deletePost(uri.fsPath)
    postsProvider.refresh()
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

  window.createTreeView('valaxy-posts', {
    treeDataProvider: postsProvider,
    showCollapseAll: true,
  })

  commands.registerCommand('valaxy.preview-refresh', () => {
    previewProvider.refresh()
  })

  commands.registerCommand('valaxy.open-file', async (uri: Uri) => {
    workspace.openTextDocument(uri.fsPath).then((doc) => {
      window.showTextDocument(doc)
    })
    previewProvider.goToPath(uri.path)
  })

  registerCommands()

  // languages.registerFoldingRangeProvider({ language: 'markdown' }, new FoldingProvider())

  ctx.onDataUpdate(() => postsProvider.refresh())

  commands.registerCommand('valaxy.refreshPosts', async () => {
    postsProvider.refresh()
  })

  update()
}

function registerCommands() {
  commands.registerCommand('valaxy.delete-post', async (item: PostItem) => {
    let canDelete = true
    if (config.confirmDelete) {
      const answer = await window.showWarningMessage(`Delete 「${item.label}」?`, 'Yes', 'No')
      if (answer !== 'Yes')
        canDelete = false
    }
    if (canDelete)
      workspace.fs.delete(item.info.uri)
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
