import type { Project } from '../src/project'
import { createHash } from 'node:crypto'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { capabilityUrl, devtoolsUrl, discover, resolvePreview } from '../src/capabilities'

let project: Project
let info: any
let lookup: any
let status = 200
let requests: { url: string, body: any }[]
let server: ReturnType<typeof createServer>

beforeEach(async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'valaxy-capabilities-')))
  info = {
    protocolVersion: 1,
    projectId: createHash('sha256').update(root.replaceAll('\\', '/')).digest('hex'),
    valaxyVersion: '1.0.0',
    base: '/blog/',
    capabilities: { routes: { version: 1, resolve: '/blog/__valaxy__/routes' }, devtools: { status: 'available', path: '/blog/__valaxy_devtools__/', authentication: 'browser' } },
  }
  status = 200
  lookup = { status: 'resolved', routes: [{ path: '/custom/中文 #?%', dynamic: false }] }
  requests = []
  server = createServer(async (request, response) => {
    expect(request.headers['x-valaxy-client']).toBe('1')
    expect(request.headers.origin).toBeUndefined()
    let text = ''
    for await (const chunk of request)
      text += chunk
    requests.push({ url: request.url!, body: text ? JSON.parse(text) : undefined })
    response.writeHead(status, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(request.method === 'POST' ? lookup : info))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  project = { root, name: 'Blog', postsRoot: path.join(root, 'content'), serverUrl: `http://127.0.0.1:${(server.address() as any).port}/blog/`, confirmDelete: true }
})
afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
  await rm(project.root, { recursive: true, force: true })
})

it('resolves custom author routes outside pages, preserving base and literal encoding', async () => {
  const file = path.join(project.root, 'content/中文 #?%.md')
  expect(await resolvePreview(project, file)).toEqual({ urls: [new URL('custom/%E4%B8%AD%E6%96%87%20%23%3F%25', project.serverUrl).href] })
  expect(requests).toEqual([
    { url: '/blog/__valaxy__/capabilities', body: undefined },
    { url: '/blog/__valaxy__/routes', body: { projectId: info.projectId, file: 'content/中文 #?%.md' } },
  ])
  expect(await devtoolsUrl(project)).toBe(new URL('__valaxy_devtools__/', project.serverUrl).href)
  lookup.routes[0].path = '/custom/%E4%B8%AD%E6%96%87%20%23%3F%25'
  expect((await resolvePreview(project, file)).urls[0]).toBe(new URL('custom/%E4%B8%AD%E6%96%87%20%23%3F%25', project.serverUrl).href)
})

it('retains offline and legacy conventional preview without requiring DevTools', async () => {
  info = '<html>Old Vite fallback</html>'
  const file = path.join(project.root, 'pages/posts/nested/hello.md')
  expect(await resolvePreview(project, file)).toEqual({ urls: [new URL('posts/nested/hello', project.serverUrl).href] })
  await expect(devtoolsUrl(project)).rejects.toThrow('Upgrade')
  await new Promise<void>(resolve => server.close(() => resolve()))
  expect((await discover(project)).status).toBe('offline')
  expect((await resolvePreview(project, file)).urls).toHaveLength(1)
})

it('rejects wrong-workspace ports, mismatched bases and incompatible protocols', async () => {
  info.projectId = 'another-project'
  expect(await resolvePreview(project)).toMatchObject({ urls: [], message: expect.stringContaining('another workspace') })
  info.projectId = createHash('sha256').update(project.root.replaceAll('\\', '/')).digest('hex')
  info.base = '/other/'
  await expect(devtoolsUrl(project)).rejects.toThrow('base path')
  info.protocolVersion = 2
  expect(await discover(project)).toMatchObject({ status: 'error', message: expect.stringContaining('incompatible') })
})

it('distinguishes disabled DevTools and rejected authentication without opening a URL', async () => {
  info.capabilities.devtools.status = 'disabled'
  await expect(devtoolsUrl(project)).rejects.toThrow('disabled')
  info.capabilities.devtools.status = 'unavailable'
  await expect(devtoolsUrl(project)).rejects.toThrow('unavailable')
  info.capabilities.devtools.status = 'available'
  info.capabilities.devtools.authentication = 'private-token'
  await expect(devtoolsUrl(project)).rejects.toThrow('unsupported')
  status = 403
  expect(await discover(project)).toMatchObject({ status: 'error', message: expect.stringContaining('403') })
})

it('preserves distinct static candidates and never guesses missing or dynamic routes', async () => {
  const file = path.join(project.root, 'pages/posts/post.md')
  lookup = { status: 'resolved', routes: [{ path: '/first', dynamic: false }, { path: '/second', dynamic: false }, { path: '/:slug', dynamic: true }] }
  expect((await resolvePreview(project, file)).urls).toEqual(['first', 'second'].map(value => new URL(value, project.serverUrl).href))
  lookup.routes = [{ path: '/:slug', dynamic: true }]
  expect(await resolvePreview(project, file)).toMatchObject({ urls: [], message: expect.stringContaining('dynamic') })
  lookup = { status: 'not-found', routes: [] }
  expect(await resolvePreview(project, file)).toMatchObject({ urls: [], message: expect.stringContaining('no route') })
})

it('rejects unsafe advertised URLs and malformed route responses', async () => {
  for (const bad of ['https://evil.test/', '//evil.test/', '/\\evil.test/', '/safe#token', '/safe?token=x'])
    expect(() => capabilityUrl(project.serverUrl, bad)).toThrow()
  info.capabilities.devtools.path = '//evil.test/'
  await expect(devtoolsUrl(project)).rejects.toThrow()
  for (const route of [{ path: '//evil.test/', dynamic: false }, { path: '/../escape', dynamic: false }, { path: '/hello' }]) {
    lookup.routes = [route]
    expect((await resolvePreview(project, path.join(project.root, 'content/post.md'))).urls).toEqual([])
  }
})
