import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ folders: [] as any[], configs: {} as Record<string, any> }))
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
  env: { asExternalUri: async (uri: unknown) => uri },
}))

const { Context } = await import('../src/ctx')
const { PostsProvider } = await import('../src/view/ValaxyProvider')
const { PreviewProvider, previewHtml } = await import('../src/view/PreviewProvider')
const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  state.folders = []
  state.configs = {}
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
