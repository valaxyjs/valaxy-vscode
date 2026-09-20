import type { Dirent } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'

export interface Project {
  root: string
  name: string
  postsRoot: string
  serverUrl: string
  confirmDelete: boolean
}

export interface Post {
  project: Project
  filePath: string
  frontmatter: Record<string, unknown>
}

export function isInside(root: string, file: string) {
  const relative = path.relative(root, file)
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

export function resolvePostsRoot(root: string, folder: string) {
  const resolved = path.resolve(root, folder)
  if (!isInside(root, resolved) || resolved === root)
    throw new Error('valaxy.postsFolder must be a directory inside the project.')
  return resolved
}

export async function isValaxyProject(root: string, enabled = false) {
  if (enabled)
    return true
  try {
    const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
    return Boolean(pkg.dependencies?.valaxy || pkg.devDependencies?.valaxy)
  }
  catch {
    return false
  }
}

export function resolveServerUrl(value: string, port: number) {
  const url = new URL(value || `http://localhost:${port}/`)
  if (!['http:', 'https:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.search || url.hash) {
    throw new Error('Use a local HTTP(S) server URL without credentials, query or fragment.')
  }
  if (!url.pathname.endsWith('/'))
    url.pathname += '/'
  return url.href
}

export async function scanPosts(project: Project, report: (message: string) => void = () => {}) {
  const posts: Post[] = []
  async function visit(directory: string) {
    let entries: Dirent[]
    try {
      entries = await readdir(directory, { withFileTypes: true })
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        report(`${directory}: ${String(error)}`)
      return
    }
    for (const entry of entries) {
      // Do not follow symlinks outside the project or into a directory cycle.
      if (entry.isSymbolicLink() || entry.name.startsWith('.'))
        continue
      const filePath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(filePath)
      }
      else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const { data } = matter(await readFile(filePath, 'utf8'), {
            // Reading article metadata must never execute JavaScript frontmatter.
            engines: { javascript: () => { throw new Error('JavaScript frontmatter is not supported.') } },
          })
          posts.push({ project, filePath, frontmatter: data })
        }
        catch (error) {
          report(`${filePath}: ${String(error)}`)
        }
      }
    }
  }
  // Resolve the configured root too, so a symlinked posts folder is not scanned.
  const { lstat } = await import('node:fs/promises')
  try {
    let directory = project.postsRoot
    while (directory !== project.root) {
      if ((await lstat(directory)).isSymbolicLink())
        return posts
      directory = path.dirname(directory)
    }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      report(`${project.postsRoot}: ${String(error)}`)
    return posts
  }
  await visit(project.postsRoot)
  const timestamp = (post: Post) => {
    const value = post.frontmatter.updated ?? post.frontmatter.date
    const date = value instanceof Date ? value.getTime() : Date.parse(String(value ?? ''))
    return Number.isFinite(date) ? date : 0
  }
  return posts.sort((a, b) => timestamp(b) - timestamp(a) || a.filePath.localeCompare(b.filePath))
}

/** Conventional pages routes; custom router hooks require browser navigation. */
export function previewUrl(project: Project, filePath?: string) {
  const pagesRoot = path.join(project.root, 'pages')
  if (!filePath || !isInside(pagesRoot, filePath) || !filePath.endsWith('.md'))
    return project.serverUrl
  const segments = path.relative(pagesRoot, filePath).split(path.sep)
  segments[segments.length - 1] = segments[segments.length - 1].slice(0, -3)
  if (segments.at(-1) === 'index')
    segments.pop()
  // Dynamic routes and router overrides cannot be inferred from a filename.
  if (segments.some(segment => /[[\]]/.test(segment)))
    return project.serverUrl
  return new URL(segments.flatMap(segment => segment.split('.')).map(encodeURIComponent).join('/'), project.serverUrl).href
}
