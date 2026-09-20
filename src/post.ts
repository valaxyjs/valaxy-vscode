import type { Project } from './project'
import { lstat, mkdir, open, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import ejs from 'ejs'
import { isInside } from './project'

export function postFilePath(project: Project, name: string) {
  const parts = name.trim().split('/')
  if (parts.some(part => !part || part.startsWith('.') || /[<>:"\\|?*]/.test(part) || [...part].some(char => char.charCodeAt(0) < 32)
    || /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    throw new Error('Use a relative filename such as hello-world or travel/hello-world; hidden paths and reserved characters are not supported.')
  }
  const filename = parts.pop()!
  parts.push(filename.endsWith('.md') ? filename : `${filename}.md`)
  const target = path.join(project.postsRoot, ...parts)
  if (!isInside(project.root, project.postsRoot) || project.postsRoot === project.root || !isInside(project.postsRoot, target))
    throw new Error('The post must be inside the configured posts folder.')
  return target
}

export async function listScaffolds(project: Project) {
  const directory = path.join(project.root, 'scaffolds')
  try {
    const stat = await lstat(directory)
    if (!stat.isDirectory() || stat.isSymbolicLink())
      return []
    return (await readdir(directory, { withFileTypes: true }))
      .filter(entry => entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.'))
      .map(entry => entry.name)
      .sort()
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return []
    throw error
  }
}

function formatDate(now: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

export async function createPost(project: Project, name: string, scaffold?: string, now = new Date()) {
  const target = postFilePath(project, name)
  const title = path.basename(target, '.md')
  const date = formatDate(now)
  let content = `---\ntitle: ${JSON.stringify(title)}\ndate: ${date}\nupdated: ${date}\ntags: []\ncategories: []\n---\n\n`
  if (scaffold) {
    if (!(await listScaffolds(project)).includes(scaffold))
      throw new Error('The selected scaffold no longer exists or is not a regular Markdown file.')
    const filename = path.join(project.root, 'scaffolds', scaffold)
    content = ejs.render(await readFile(filename, 'utf8'), { title, layout: path.basename(scaffold, '.md'), date }, { filename })
  }

  // Create one directory at a time so neither a configured folder nor a nested
  // destination can redirect writes through a symlink outside the workspace.
  let directory = project.root
  for (const part of path.relative(project.root, path.dirname(target)).split(path.sep)) {
    directory = path.join(directory, part)
    try {
      await mkdir(directory)
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
        throw error
    }
    const stat = await lstat(directory)
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new Error('Post directories must be real directories, not symbolic links.')
  }

  // Exclusive creation protects existing posts even if they are malformed or
  // have not been discovered by the sidebar, and when two commands race.
  let file
  try {
    file = await open(target, 'wx')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new Error('A file with this name already exists. Choose another filename.')
    throw error
  }
  try {
    await file.writeFile(content, 'utf8')
  }
  finally {
    await file.close()
  }
  return target
}
