import { existsSync, promises as fs } from 'node:fs'
import { join } from 'node:path'
import { commands, window, workspace } from 'vscode'
import type { ExtensionContext } from 'vscode'
import { config } from './config'
import { ctx } from './ctx'
import { configEditor } from './editor'

/**
 * only enable when there is a package.json with valaxy
 * @param ext
 * @returns
 */
export async function activate(ext: ExtensionContext) {
  ctx.ext = ext

  const userRoot = workspace.workspaceFolders?.[0].uri.fsPath

  if (!userRoot || !existsSync(join(userRoot, 'package.json')))
    return

  let enabled = config.enabled

  if (!enabled) {
    const json = JSON.parse(await fs.readFile(join(userRoot, 'package.json'), 'utf-8'))
    enabled = json?.dependencies?.valaxy || json?.devDependencies?.valaxy
  }

  if (enabled) {
    commands.executeCommand('setContext', 'valaxy-enabled', true)
    configEditor()

    window.showInformationMessage('Welcome to Valaxy!')
  }
}

export function deactivate() {

}
