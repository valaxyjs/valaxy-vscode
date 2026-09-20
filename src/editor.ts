import type { ExtensionContext, OutputChannel } from 'vscode'
import type { Context } from './ctx'
import type { Project } from './project'
import { commands, env, RelativePattern, Uri, window, workspace } from 'vscode'
import { isInside, previewUrl } from './project'
import { PostItem } from './view/PostItem'
import { PreviewProvider } from './view/PreviewProvider'
import { PostsProvider } from './view/ValaxyProvider'

export function configureEditor(ext: ExtensionContext, ctx: Context, output: OutputChannel) {
  const preview = new PreviewProvider()
  const watchers: { dispose: () => void }[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const report = (error: unknown) => output.appendLine(String(error))
  const updatePreview = async () => {
    const doc = window.activeTextEditor?.document
    const project = ctx.projectFor(doc?.uri.fsPath)
    if (project)
      return preview.show(project, doc?.languageId === 'markdown' ? doc.uri.fsPath : undefined)
    preview.clear()
  }
  const refresh = async () => {
    const count = await ctx.refresh()
    await commands.executeCommand('setContext', 'valaxy-enabled', ctx.projects.length > 0)
    await updatePreview()
    return count
  }
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      void refresh().catch(report)
    }, 100)
  }
  const watch = () => {
    watchers.splice(0).forEach(watcher => watcher.dispose())
    for (const folder of workspace.workspaceFolders ?? []) {
      const watcher = workspace.createFileSystemWatcher(new RelativePattern(folder, '**/*'))
      const changed = (uri: Uri) => {
        if (uri.fsPath === Uri.joinPath(folder.uri, 'package.json').fsPath
          || ctx.projects.some(project => isInside(project.postsRoot, uri.fsPath) || isInside(uri.fsPath, project.postsRoot))) {
          schedule()
        }
      }
      watchers.push(watcher, watcher.onDidCreate(changed), watcher.onDidChange(changed), watcher.onDidDelete(changed))
    }
  }
  const selectProject = async (): Promise<Project | undefined> => {
    const active = ctx.projectFor(window.activeTextEditor?.document.uri.fsPath)
    if (active)
      return active
    if (!ctx.projects.length) {
      void window.showInformationMessage('Open a Valaxy project folder first. See the Valaxy output channel for configuration errors.')
      return
    }
    return (await window.showQuickPick(ctx.projects.map(project => ({ label: project.name, description: project.root, project })), { placeHolder: 'Select a Valaxy project' }))?.project
  }
  ext.subscriptions.push(
    window.createTreeView('valaxy-posts', { treeDataProvider: new PostsProvider(ctx), showCollapseAll: true }),
    window.registerWebviewViewProvider(PreviewProvider.viewId, preview),
    window.onDidChangeActiveTextEditor(() => {
      void updatePreview().catch(report)
    }),
    workspace.onDidChangeWorkspaceFolders(() => {
      watch()
      schedule()
    }),
    workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('valaxy'))
        schedule()
    }),
    commands.registerCommand('valaxy.refreshPosts', refresh),
    commands.registerCommand('valaxy.preview-refresh', async () => {
      const project = await selectProject()
      if (project)
        return preview.show(project, window.activeTextEditor?.document.uri.fsPath)
    }),
    commands.registerCommand('valaxy.open-file', async (item: PostItem) => {
      if (!(item instanceof PostItem))
        return
      await window.showTextDocument(await workspace.openTextDocument(Uri.file(item.post.filePath)))
      return preview.show(item.post.project, item.post.filePath)
    }),
    commands.registerCommand('valaxy.openSettings', () => commands.executeCommand('workbench.action.openSettings', '@ext:yunyoujun.valaxy')),
    commands.registerCommand('valaxy.openBrowser', async () => {
      const project = await selectProject()
      if (project)
        await env.openExternal(await env.asExternalUri(Uri.parse(previewUrl(project, window.activeTextEditor?.document.uri.fsPath))))
    }),
    commands.registerCommand('valaxy.delete-post', async (item: PostItem) => {
      if (!(item instanceof PostItem) || !ctx.posts.some(post => post.filePath === item.post.filePath))
        return
      if (item.post.project.confirmDelete) {
        const answer = await window.showWarningMessage(`Move “${item.label}” to trash?`, { modal: true }, 'Delete')
        if (answer !== 'Delete')
          return
      }
      await workspace.fs.delete(Uri.file(item.post.filePath), { useTrash: true })
      await refresh()
    }),
    { dispose() {
      clearTimeout(timer)
      watchers.splice(0).forEach(watcher => watcher.dispose())
      preview.clear()
    } },
  )
  watch()
  return refresh()
}
