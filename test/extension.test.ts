import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ folders: [] as any[], configs: {} as Record<string, any>, forward: undefined as undefined | ((url: string) => string) }))
vi.mock('vscode', () => ({
  workspace: {
    get workspaceFolders() { return state.folders },
    getConfiguration: (_: string, uri: { fsPath: string }) => ({ get: (key: string, fallback: unknown) => state.configs[uri.fsPath]?.[key] ?? fallback }),
  },
  EventEmitter: class {
    event = vi.fn()
    fire = vi.fn()
    dispose = vi.fn()
  },
  TreeItem: class { constructor(public label: string) {} },
  TreeItemCollapsibleState: { Expanded: 2 },
  ThemeIcon: class {},
  Uri: { file: (fsPath: string) => ({ fsPath }), parse: (url: string) => ({ toString: () => url }) },
  env: { asExternalUri: async (uri: { toString: () => string }) => state.forward ? { toString: () => state.forward!(uri.toString()) } : uri },
}))

const { Context } = await import('../src/ctx')
const { PostsProvider } = await import('../src/view/ValaxyProvider')
const { PreviewProvider, previewHtml } = await import('../src/view/PreviewProvider')
const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  state.folders = []
  state.configs = {}
  state.forward = undefined
})
async function folder(name: string, valaxy = true) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'valaxy-workspace-'))
  roots.push(root)
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: valaxy ? { valaxy: '^1.0.0' } : {} }))
  state.folders.push({ name, uri: { scheme: 'file', fsPath: root } })
  return root
}

it('discovers every workspace, scopes configuration and refreshes its tree from disk', async () => {
  await folder('unrelated', false)
  const a = await folder('A')
  const b = await folder('B')
  state.configs[b] = { postsFolder: 'content', port: 5001 }
  await mkdir(path.join(b, 'content'), { recursive: true })
  await writeFile(path.join(b, 'content/post.md'), '---\ntitle: B post\n---')
  const ctx = new Context(() => {})
  await ctx.refresh()
  expect(ctx.projects.map(project => project.name)).toEqual(['A', 'B'])
  expect(ctx.projects[1].serverUrl).toBe('http://localhost:5001/')
  expect(ctx.posts).toHaveLength(1)
  expect(ctx.projectFor(path.join(b, 'content/post.md'))?.name).toBe('B')
  expect(ctx.projectFor()).toBeUndefined()
  const provider = new PostsProvider(ctx)
  expect(provider.getChildren()).toHaveLength(2)
  expect(provider.getChildren(provider.getChildren()[1])[0].label).toBe('B post')
  await mkdir(path.join(a, 'pages/posts/nested'), { recursive: true })
  await writeFile(path.join(a, 'pages/posts/nested/post.md'), '# New')
  await ctx.refresh()
  expect(ctx.posts).toHaveLength(2)
  state.folders = state.folders.filter(folder => folder.name !== 'B')
  await ctx.refresh()
  expect(ctx.posts).toHaveLength(1)
  expect(provider.getChildren()[0].label).toBe('post')
  ctx.dispose()
})

it('keeps the existing preview for ambiguous or dynamic routes and chooses only on request', async () => {
  const root = await folder('blog')
  const ctx = new Context(() => {})
  await ctx.refresh()
  const project = ctx.projects[0]
  const resolve = vi.fn().mockResolvedValue({ urls: ['http://localhost:4859/start'] })
  const choose = vi.fn(async (urls: string[]) => urls[1])
  const provider = new PreviewProvider(resolve, choose)
  const view = { webview: { html: '', options: {}, postMessage: vi.fn() }, onDidDispose: vi.fn() }
  await provider.resolveWebviewView(view as any)
  await provider.show(project, path.join(root, 'pages/start.md'))
  const original = view.webview.html
  resolve.mockResolvedValue({ urls: ['http://localhost:4859/first', 'http://localhost:4859/second'] })
  await provider.show(project, path.join(root, 'pages/multiple.md'))
  expect(choose).not.toHaveBeenCalled()
  expect(view.webview.html).toBe(original)
  expect(view.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('multiple routes') }))
  await provider.show(project, path.join(root, 'pages/multiple.md'), true)
  expect(view.webview.html).toContain('/second')
  resolve.mockResolvedValue({ urls: [], message: 'Dynamic parameters required' })
  const previous = view.webview.html
  await provider.show(project, path.join(root, 'pages/[slug].md'))
  expect(view.webview.html).toBe(previous)
  expect(view.webview.postMessage).toHaveBeenLastCalledWith({ type: 'valaxy:preview-status', message: 'Dynamic parameters required' })
  await provider.show({ ...project, root: `${root}-other` })
  resolve.mockResolvedValue({ urls: [], message: 'No route in original project' })
  await provider.show(project)
  expect(view.webview.html).toContain('No route in original project')
  const onDispose = view.onDidDispose.mock.calls[0][0]
  onDispose()
  const reopened = { webview: { html: '', options: {} }, onDidDispose: vi.fn() }
  await provider.resolveWebviewView(reopened as any)
  expect(reopened.webview.html).toContain('No route in original project')
  ctx.dispose()
})

it('uses the complete forwarded URL and discards stale route responses', async () => {
  const root = await folder('blog')
  const ctx = new Context(() => {})
  await ctx.refresh()
  state.forward = url => `${url.replace('http://localhost:4859/', 'https://forward.example/proxy/4859/')}?forwarded=1`
  let finish!: (result: { urls: string[] }) => void
  const resolve = vi.fn().mockImplementationOnce(() => new Promise((done) => {
    finish = done
  })).mockResolvedValueOnce({ urls: ['http://localhost:4859/blog/latest'] })
  const provider = new PreviewProvider(resolve)
  const view = { webview: { html: '', options: {} }, onDidDispose: vi.fn() }
  await provider.resolveWebviewView(view as any)
  const stale = provider.show(ctx.projects[0], path.join(root, 'pages/old.md'))
  await provider.show(ctx.projects[0], path.join(root, 'pages/latest.md'))
  finish({ urls: ['http://localhost:4859/blog/old'] })
  await stale
  expect(view.webview.html).toContain('https://forward.example/proxy/4859/blog/latest?forwarded=1')
  expect(view.webview.html).not.toContain('/old')
  ctx.dispose()
})

it('reports invalid folder configuration without disabling valid workspaces', async () => {
  const bad = await folder('bad')
  await folder('good')
  state.configs[bad] = { postsFolder: '../outside' }
  const report = vi.fn()
  const ctx = new Context(report)
  await ctx.refresh()
  expect(ctx.projects.map(project => project.name)).toEqual(['good'])
  expect(report).toHaveBeenCalledOnce()
  ctx.dispose()
})

it('renders before an editor opens and navigates without a legacy Valaxy message bridge', async () => {
  const root = await folder('blog')
  const ctx = new Context(() => {})
  await ctx.refresh()
  const provider = new PreviewProvider()
  const view = { webview: { html: '', options: {} }, onDidDispose: vi.fn() }
  await provider.resolveWebviewView(view as any)
  expect(view.webview.html).toContain('Open a Markdown post')
  await provider.show(ctx.projects[0], path.join(root, 'pages/posts/nested/post.md'))
  expect(view.webview.html).toContain('src="http://localhost:4859/posts/nested/post"')
  await provider.show(ctx.projects[0], path.join(root, 'pages/posts/next.md'))
  expect(view.webview.html).toContain('/posts/next')
  const urls = await Promise.all([
    provider.show(ctx.projects[0], path.join(root, 'pages/posts/first.md')),
    provider.show(ctx.projects[0], path.join(root, 'pages/posts/last.md')),
  ])
  expect(urls).toEqual(['http://localhost:4859/posts/first', 'http://localhost:4859/posts/last'])
  expect(view.webview.html).toContain('/posts/last')
  expect(view.webview.html).not.toContain('go-to-path')
  expect(previewHtml('http://localhost:4859/?x="<script>', 'nonce')).not.toContain('x="<script>')
  expect(view.webview.html).toContain('default-src \'none\'')
  provider.clear()
  expect(view.webview.html).not.toContain('<iframe')
  ctx.dispose()
})
