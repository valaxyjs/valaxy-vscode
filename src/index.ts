import { existsSync, promises as fs } from 'node:fs'
import { join } from 'node:path'
import { commands, window, workspace } from 'vscode'
import type { ExtensionContext } from 'vscode'
import matter from 'gray-matter'
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

  ctx.userRoot = userRoot
  ctx.postsRoot = join(userRoot, 'pages/posts')

  let enabled = config.enabled

  if (!enabled) {
    const json = JSON.parse(await fs.readFile(join(userRoot, 'package.json'), 'utf-8'))
    enabled = json?.dependencies?.valaxy || json?.devDependencies?.valaxy
  }

  if (enabled) {
    window.showInformationMessage('Welcome to Valaxy!')
    commands.executeCommand('setContext', 'valaxy-enabled', true)
    configEditor()

    if (ctx.postsRoot) {
      const files = (await fs.readdir(ctx.postsRoot))
      const mdFiles = files.filter(f => f.endsWith('.md'))

      const mdPromiseTasks = mdFiles.map(async (f) => {
        const path = join(ctx.postsRoot!, f)
        const content = await fs.readFile(path)
        const { data } = matter(content)
        ctx.posts.push({
          frontmatter: data,
          path,
        })
      })
      await Promise.all(mdPromiseTasks)
      ctx.posts.sort((a, b) => {
        const aDate = new Date(a.frontmatter.updated || a.frontmatter.date)
        const bDate = new Date(b.frontmatter.updated || b.frontmatter.date)
        return bDate.getTime() - aDate.getTime()
      })
    }
  }
}

export function deactivate() {

}
