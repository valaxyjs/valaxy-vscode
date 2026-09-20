import type { Context } from '../src/ctx'
import type { Project } from '../src/project'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const ui = vi.hoisted(() => ({
  showQuickPick: vi.fn(),
  showInputBox: vi.fn(),
  showInformationMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showTextDocument: vi.fn(),
  openTextDocument: vi.fn(async uri => uri),
  trusted: true,
}))
vi.mock('vscode', () => ({
  window: ui,
  workspace: { get isTrusted() { return ui.trusted }, openTextDocument: ui.openTextDocument },
  Uri: { file: (fsPath: string) => ({ fsPath }) },
}))
const { addPost } = await import('../src/createPost')
let root: string
let projects: Project[]
let ctx: Context
beforeEach(async () => {
  vi.clearAllMocks()
  ui.showQuickPick.mockReset()
  ui.showInputBox.mockReset()
  ui.trusted = true
  root = await mkdtemp(path.join(os.tmpdir(), 'valaxy-create-command-'))
  projects = ['first', 'second'].map(name => ({ root: path.join(root, name), name, postsRoot: path.join(root, name, 'pages/posts'), serverUrl: 'http://localhost:4859/', confirmDelete: true }))
  for (const project of projects)
    await mkdir(project.root)
  ctx = { projects, refresh: vi.fn() } as unknown as Context
})
afterEach(() => rm(root, { recursive: true, force: true }))

it('creates and opens the post in the explicitly selected workspace', async () => {
  ui.showQuickPick.mockImplementationOnce(items => items[1])
  ui.showInputBox.mockResolvedValueOnce('nested/new-post')
  const created = await addPost(ctx)
  expect(created).toBe(path.join(projects[1].postsRoot, 'nested/new-post.md'))
  expect(ui.openTextDocument).toHaveBeenCalledWith({ fsPath: created })
  expect(ui.showTextDocument).toHaveBeenCalledOnce()
  expect(ctx.refresh).toHaveBeenCalledOnce()
  expect(ui.showErrorMessage).not.toHaveBeenCalled()
})

it('uses only the chosen workspace scaffold', async () => {
  await mkdir(path.join(projects[1].root, 'scaffolds'))
  await writeFile(path.join(projects[1].root, 'scaffolds/post.md'), '# <%= title %> in the second workspace')
  ui.showQuickPick.mockImplementationOnce(items => items[1]).mockImplementationOnce(items => items[1])
  ui.showInputBox.mockResolvedValueOnce('new-post')
  const created = await addPost(ctx)
  expect(await readFile(created!, 'utf8')).toBe('# new-post in the second workspace')
})

it('cancels without writing at workspace, filename and template selection', async () => {
  ui.showQuickPick.mockResolvedValueOnce(undefined)
  expect(await addPost(ctx)).toBeUndefined()
  expect(ui.showInputBox).not.toHaveBeenCalled()
  ctx.projects = [projects[0]]
  ui.showInputBox.mockResolvedValueOnce(undefined)
  expect(await addPost(ctx)).toBeUndefined()
  await mkdir(path.join(projects[0].root, 'scaffolds'))
  await writeFile(path.join(projects[0].root, 'scaffolds/post.md'), '# Post')
  ui.showInputBox.mockResolvedValueOnce('cancelled')
  ui.showQuickPick.mockResolvedValueOnce(undefined)
  expect(await addPost(ctx)).toBeUndefined()
  expect(ctx.refresh).not.toHaveBeenCalled()
  expect(ui.openTextDocument).not.toHaveBeenCalled()
  await expect(readFile(path.join(projects[0].postsRoot, 'cancelled.md'))).rejects.toThrow()
})

it('reports collisions and does not open or overwrite the existing file', async () => {
  ctx.projects = [projects[0]]
  await mkdir(projects[0].postsRoot, { recursive: true })
  const existing = path.join(projects[0].postsRoot, 'existing.md')
  await writeFile(existing, '# Keep')
  ui.showInputBox.mockResolvedValueOnce('existing')
  expect(await addPost(ctx)).toBeUndefined()
  expect(ui.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('already exists'))
  expect(await readFile(existing, 'utf8')).toBe('# Keep')
  expect(ui.openTextDocument).not.toHaveBeenCalled()
})

it('does not prompt or write in untrusted or unrelated workspaces', async () => {
  ui.trusted = false
  await addPost(ctx)
  ui.trusted = true
  ctx.projects = []
  await addPost(ctx)
  expect(ui.showInputBox).not.toHaveBeenCalled()
  expect(ui.showQuickPick).not.toHaveBeenCalled()
  expect(ui.showInformationMessage).toHaveBeenCalledTimes(2)
})
