import type { Project } from '../src/project'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isValaxyProject, previewUrl, resolvePostsRoot, resolveServerUrl, scanPosts } from '../src/project'

let root: string
let project: Project
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'valaxy-extension-'))
  project = { root, name: 'blog', postsRoot: path.join(root, 'pages/posts'), serverUrl: 'http://localhost:4859/blog/', confirmDelete: true }
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})
async function write(file: string, content: string) {
  const target = path.join(root, file)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content)
}

describe('project discovery', () => {
  it('detects Valaxy 1.x dependencies and devDependencies without loading config', async () => {
    expect(await isValaxyProject(root)).toBe(false)
    for (const field of ['dependencies', 'devDependencies']) {
      await write('package.json', JSON.stringify({ [field]: { valaxy: '1.0.0-rc.12' } }))
      expect(await isValaxyProject(root)).toBe(true)
    }
    await write('package.json', 'invalid')
    expect(await isValaxyProject(root)).toBe(false)
    expect(await isValaxyProject(root, true)).toBe(true)
  })
  it('rejects posts folders outside the workspace', () => {
    expect(() => resolvePostsRoot(root, '../outside')).toThrow()
    expect(() => resolvePostsRoot(root, '.')).toThrow()
    expect(resolvePostsRoot(root, 'content/posts')).toBe(path.join(root, 'content/posts'))
  })
})

describe('post discovery', () => {
  it('handles a missing directory and rescans files created later', async () => {
    expect(await scanPosts(project)).toEqual([])
    await write('pages/posts/nested/hello.md', '---\ntitle: Hello\n---\nBody')
    expect((await scanPosts(project))[0].frontmatter.title).toBe('Hello')
  })
  it('recursively scans, isolates invalid YAML and excludes unrelated files and symlinks', async () => {
    await write('pages/posts/a.md', '---\ntitle: A\ndate: 2024-01-01\n---')
    await write('pages/posts/nested/b.md', '---\ntitle: B\nupdated: 2025-01-01\n---')
    await write('pages/posts/broken.md', '---\ntitle: [\n---')
    await write('pages/posts/image.png', 'not markdown')
    await write('pages/about.md', '---\ntitle: About\n---')
    await symlink(root, path.join(project.postsRoot, 'loop'), 'junction')
    const errors: string[] = []
    const posts = await scanPosts(project, error => errors.push(error))
    expect(posts.map(post => post.frontmatter.title)).toEqual(['B', 'A'])
    expect(errors).toHaveLength(1)
    await rm(path.join(project.postsRoot, 'a.md'))
    expect(await scanPosts(project)).toHaveLength(1)
  })
  it('rejects executable frontmatter on every scan', async () => {
    await write('pages/posts/script.md', '---js\n({ title: \"must not execute\" })\n---')
    const report = vi.fn()
    expect(await scanPosts(project, report)).toEqual([])
    expect(await scanPosts(project, report)).toEqual([])
    expect(report).toHaveBeenCalledTimes(2)
  })
  it('does not follow a configured symlink folder', async () => {
    await write('elsewhere/test.md', '# Test')
    await mkdir(path.dirname(project.postsRoot), { recursive: true })
    await symlink(path.join(root, 'elsewhere'), project.postsRoot, 'junction')
    expect(await scanPosts(project)).toEqual([])
  })
})

describe('preview routing', () => {
  it.each([
    ['pages/posts/nested/hello.md', 'posts/nested/hello'],
    ['pages/posts/index.md', 'posts'],
    ['pages/index.md', ''],
    ['pages/posts/你好 #?.md', 'posts/%E4%BD%A0%E5%A5%BD%20%23%3F'],
    ['pages/posts/hello.world.md', 'posts/hello.world'],
    ['pages/posts/[id].md', ''],
    ['README.md', ''],
    ['pages-elsewhere/post.md', ''],
  ])('maps %s relative to the configured base', (file, route) => {
    expect(previewUrl(project, path.join(root, file))).toBe(project.serverUrl + route)
  })
  it('validates local preview endpoints', () => {
    expect(resolveServerUrl('', 5000)).toBe('http://localhost:5000/')
    expect(resolveServerUrl('http://127.0.0.1:4859/blog', 5000)).toBe('http://127.0.0.1:4859/blog/')
    for (const url of ['javascript:alert(1)', 'https://example.com', 'http://user:pass@localhost', 'http://localhost/?x=1'])
      expect(() => resolveServerUrl(url, 4859)).toThrow()
  })
})
