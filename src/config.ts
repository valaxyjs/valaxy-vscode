import type { WorkspaceFolder } from 'vscode'
import type { Project } from './project'
import { workspace } from 'vscode'
import { isValaxyProject, resolvePostsRoot, resolveServerUrl } from './project'

export async function resolveProject(folder: WorkspaceFolder): Promise<Project | undefined> {
  if (folder.uri.scheme !== 'file')
    return
  const config = workspace.getConfiguration('valaxy', folder.uri)
  const root = folder.uri.fsPath
  if (!await isValaxyProject(root, config.get('enabled', false)))
    return
  return {
    root,
    name: folder.name,
    postsRoot: resolvePostsRoot(root, config.get('postsFolder', 'pages/posts')),
    serverUrl: resolveServerUrl(config.get('serverUrl', ''), config.get('port', 4859)),
    confirmDelete: config.get('confirmDelete', true),
  }
}
