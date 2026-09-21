import type { Project } from './project'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { isInside, previewUrl } from './project'

interface Capabilities {
  protocolVersion: 1
  projectId: string
  base: string
  valaxyVersion: string
  capabilities: {
    routes?: { version: number, resolve: string }
    devtools?: { status: 'available' | 'disabled' | 'unavailable', path?: string, authentication?: string }
  }
}

type Discovery = { status: 'available', info: Capabilities }
  | { status: 'unsupported' | 'offline' | 'error', message: string }

export interface PreviewResult { urls: string[], message?: string }

/** Node HTTP works in the VS Code 1.85 remote extension host too. Never follow redirects. */
async function requestJson(url: URL, data?: unknown): Promise<{ status: number, value?: any }> {
  return new Promise((resolve, reject) => {
    const body = data === undefined ? undefined : JSON.stringify(data)
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'X-Valaxy-Client': '1', ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }) },
    }, (response) => {
      const chunks: Buffer[] = []
      let size = 0
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > 65536)
          request.destroy(new Error('The server response is too large.'))
        else chunks.push(chunk)
      })
      response.on('error', reject)
      response.on('end', () => {
        let value: unknown
        try {
          value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        }
        catch {}
        resolve({ status: response.statusCode || 0, value })
      })
    })
    const timer = setTimeout(() => request.destroy(new Error('The Valaxy server did not respond.')), 2000)
    request.on('close', () => clearTimeout(timer))
    request.on('error', reject)
    request.end(body)
  })
}

/** Advertised paths are origin-relative; never accept credentials, fragments or another server. */
export function capabilityUrl(serverUrl: string, value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')
    || /[\\?#\s]/.test(value) || [...value].some(char => char.charCodeAt(0) < 32)) {
    throw new Error('The Valaxy server advertised an invalid path.')
  }
  const url = new URL(value, serverUrl)
  if (url.origin !== new URL(serverUrl).origin)
    throw new Error('The Valaxy server advertised another origin.')
  return url
}

export async function discover(project: Project): Promise<Discovery> {
  let response: Awaited<ReturnType<typeof requestJson>>
  try {
    response = await requestJson(new URL('__valaxy__/capabilities', project.serverUrl))
  }
  catch {
    return { status: 'offline', message: 'Start this project’s Valaxy server, then try again. Check its URL in Valaxy settings.' }
  }
  const info = response.value
  if (response.status === 404 || (response.status === 200 && info?.protocolVersion === undefined))
    return { status: 'unsupported', message: 'This Valaxy server does not advertise editor capabilities. Upgrade Valaxy to use this feature.' }
  if (response.status !== 200)
    return { status: 'error', message: `The editor capability request was rejected (HTTP ${response.status}). Use the workspace host’s localhost URL in Valaxy settings.` }
  if (info?.protocolVersion !== 1)
    return { status: 'error', message: 'This Valaxy editor protocol is incompatible. Update the extension and Valaxy.' }
  try {
    if (typeof info.valaxyVersion !== 'string' || !info.capabilities || typeof info.capabilities !== 'object')
      throw new Error('The Valaxy server returned invalid capabilities.')
    const root = (await realpath(project.root)).replaceAll('\\', '/')
    if (info.projectId !== createHash('sha256').update(root).digest('hex'))
      throw new Error('This server belongs to another workspace. Correct this folder’s Valaxy server URL or port.')
    if (capabilityUrl(project.serverUrl, info.base).pathname !== new URL(project.serverUrl).pathname)
      throw new Error('The server base path differs from this folder’s Valaxy server URL. Correct it in Valaxy settings.')
    return { status: 'available', info }
  }
  catch (error) {
    return { status: 'error', message: (error as Error).message }
  }
}

export async function devtoolsUrl(project: Project) {
  const result = await discover(project)
  if (result.status !== 'available')
    throw new Error(result.message)
  const tools = result.info.capabilities.devtools
  if (tools?.status === 'disabled')
    throw new Error('DevTools is disabled in this project. Enable devtools in valaxy.config.ts and restart the server.')
  if (tools?.status !== 'available')
    throw new Error('DevTools is unavailable. Check this project’s development server and its DevTools installation.')
  if (tools.authentication !== 'browser')
    throw new Error('This DevTools authentication flow is unsupported. Update the extension and Valaxy.')
  return capabilityUrl(project.serverUrl, tools.path).href
}

export async function resolvePreview(project: Project, file?: string): Promise<PreviewResult> {
  const result = await discover(project)
  if (result.status === 'unsupported' || result.status === 'offline')
    return { urls: [previewUrl(project, file)] }
  if (result.status !== 'available')
    return { urls: [], message: result.message }
  if (!file || !file.endsWith('.md') || !isInside(project.root, file))
    return { urls: [project.serverUrl] }
  const capability = result.info.capabilities.routes
  if (!capability)
    return { urls: [previewUrl(project, file)] }
  if (capability.version !== 1)
    return { urls: [], message: 'This route capability is incompatible. Update the extension and Valaxy.' }
  try {
    const url = capabilityUrl(project.serverUrl, capability.resolve)
    const request = { projectId: result.info.projectId, file: path.relative(project.root, file).split(path.sep).join('/') }
    let response = await requestJson(url, request)
    for (const delay of [100, 250, 500, 1000]) {
      if (response.status !== 503 || response.value?.status !== 'pending')
        break
      await new Promise(resolve => setTimeout(resolve, delay))
      response = await requestJson(url, request)
    }
    if (response.status === 503 && response.value?.status === 'pending')
      return { urls: [], message: 'Valaxy is still resolving routes. Refresh the preview shortly.' }
    if (response.status !== 200 || !['resolved', 'not-found'].includes(response.value?.status) || !Array.isArray(response.value.routes))
      throw new Error('Valaxy could not resolve this article. Check the server and refresh the preview.')
    if (response.value.status === 'not-found')
      return { urls: [], message: 'This file has no route in the running site. Use Open Browser Preview to navigate manually.' }
    const urls: string[] = []
    for (const route of response.value.routes) {
      if (typeof route.path !== 'string' || !route.path.startsWith('/') || route.path.startsWith('//') || typeof route.dynamic !== 'boolean')
        throw new Error('Valaxy returned an invalid article route.')
      if (route.dynamic)
        continue
      // File-router paths already encode filenames. Preserve those escapes;
      // custom hooks may still supply Unicode or literal URL delimiters.
      const relative = route.path.slice(1).replaceAll('#', '%23').replaceAll('?', '%3F').replace(/%(?![\dA-F]{2})/gi, '%25')
      const url = new URL(relative, project.serverUrl)
      if (url.origin !== new URL(project.serverUrl).origin || !url.pathname.startsWith(new URL(project.serverUrl).pathname))
        throw new Error('Valaxy returned an article route outside this site.')
      if (!urls.includes(url.href))
        urls.push(url.href)
    }
    return { urls, message: urls.length ? undefined : 'This article requires dynamic route parameters. Use Open Browser Preview to navigate manually.' }
  }
  catch (error) {
    return { urls: [], message: (error as Error).message }
  }
}
