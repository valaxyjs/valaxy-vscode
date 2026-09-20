import type { Project } from '../src/project'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import matter from 'gray-matter'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { createPost, listScaffolds, postFilePath } from '../src/post'

let root: string
let project: Project
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'valaxy-new-post-'))
  project = { root, name: 'blog', postsRoot: path.join(root, 'content/articles'), serverUrl: 'http://localhost:4859/', confirmDelete: true }
})
afterEach(() => rm(root, { recursive: true, force: true }))

it('creates missing nested folders with YAML-safe frontmatter and a single Markdown extension', async () => {
  const file = await createPost(project, ' travel/你好 & hello.md ', undefined, new Date(2026, 8, 21, 8, 9, 10))
  expect(file).toBe(path.join(project.postsRoot, 'travel/你好 & hello.md'))
  const { data } = matter(await readFile(file, 'utf8'))
  expect(data.title).toBe('你好 & hello')
  expect(data.tags).toEqual([])
  expect(await readFile(file, 'utf8')).toContain('date: 2026-09-21 08:09:10')
  expect(postFilePath(project, 'hello')).toBe(path.join(project.postsRoot, 'hello.md'))
})

it.each(['', ' ', '/tmp/post', '../outside', 'nested/../../outside', 'a//b', '.hidden', 'a/.hidden/post', 'a\\b', 'C:/post', 'a?', 'post.', 'post /name', 'NUL', 'con.md', 'aux.txt', 'a\nname'])('rejects invalid filename %j before creating directories', async (name) => {
  await expect(createPost(project, name)).rejects.toThrow()
  await expect(readFile(project.postsRoot)).rejects.toThrow()
})

it('does not overwrite undiscovered files or simultaneous creations', async () => {
  await mkdir(project.postsRoot, { recursive: true })
  const existing = path.join(project.postsRoot, 'broken.md')
  await writeFile(existing, '---\ntitle: [\n---')
  await expect(createPost(project, 'broken')).rejects.toThrow('already exists')
  expect(await readFile(existing, 'utf8')).toBe('---\ntitle: [\n---')
  const results = await Promise.allSettled([createPost(project, 'racing'), createPost(project, 'racing')])
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
})

it('lists and renders only the selected project scaffold with Valaxy EJS variables', async () => {
  expect(await listScaffolds(project)).toEqual([])
  await mkdir(path.join(root, 'scaffolds'))
  await writeFile(path.join(root, 'scaffolds/note.md'), '---\ntitle: <%- JSON.stringify(title) %>\nlayout: <%= layout %>\ndate: <%= date %>\n---\n<% if (title) { %># <%= title %><% } %>')
  await writeFile(path.join(root, 'scaffolds/.hidden.md'), 'hidden')
  await writeFile(path.join(root, 'scaffolds/ignored.txt'), 'ignore')
  expect(await listScaffolds(project)).toEqual(['note.md'])
  const file = await createPost(project, 'my-note', 'note.md', new Date(2026, 8, 21, 8, 9, 10))
  const text = await readFile(file, 'utf8')
  expect(matter(text).data).toMatchObject({ title: 'my-note', layout: 'note' })
  expect(text).toContain('# my-note')
  expect(text).toContain('date: 2026-09-21 08:09:10')
  await expect(createPost(project, 'invalid', '../note.md')).rejects.toThrow('scaffold')
})

it('reports a broken template without creating a post', async () => {
  await mkdir(path.join(root, 'scaffolds'))
  await writeFile(path.join(root, 'scaffolds/broken.md'), '<%= missingVariable %>')
  await expect(createPost(project, 'broken', 'broken.md')).rejects.toThrow()
  await expect(readFile(path.join(project.postsRoot, 'broken.md'))).rejects.toThrow()
})

it('rejects symlink directories and scaffold folders', async () => {
  const elsewhere = path.join(root, 'elsewhere')
  await mkdir(elsewhere)
  await mkdir(path.dirname(project.postsRoot))
  await symlink(elsewhere, project.postsRoot, 'junction')
  await expect(createPost(project, 'redirected')).rejects.toThrow('symbolic links')
  await expect(readFile(path.join(elsewhere, 'redirected.md'))).rejects.toThrow()
  await symlink(elsewhere, path.join(root, 'scaffolds'), 'junction')
  expect(await listScaffolds(project)).toEqual([])
})
