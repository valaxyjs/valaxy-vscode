const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { readFile } = require('node:fs/promises')
const path = require('node:path')
const process = require('node:process')
const { runTests } = require('@vscode/test-electron')

const root = path.resolve(__dirname, '../..')
const fixture = path.join(__dirname, 'fixtures/blog')
const cli = path.join(fixture, 'node_modules/valaxy/bin/valaxy.mjs')
const server = spawn(process.execPath, [cli, '--port', '4867'], {
  cwd: fixture,
  env: { ...process.env, NO_COLOR: '1', BROWSER: 'none' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let log = ''
server.stdout.on('data', (chunk) => {
  log += chunk
})
server.stderr.on('data', (chunk) => {
  log += chunk
})
async function ready() {
  const deadline = Date.now() + 120000
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error(`Valaxy exited: ${log}`)
    try {
      const response = await fetch('http://localhost:4867/blog/posts/nested/hello')
      if (response.ok) {
        assert.match(await response.text(), /@vite\/client/)
        // Request the actual Markdown module, not just Vite's HTML fallback.
        const markdown = await fetch(`http://localhost:4867/blog/@fs/${path.join(fixture, 'pages/posts/nested/hello.md').replaceAll('\\', '/')}?import`)
        assert.equal(markdown.status, 200)
        assert.match(await markdown.text(), /Nested compatibility post/)
        const routes = await readFile(path.join(fixture, '.valaxy/route-map.d.ts'), 'utf8')
        assert.match(routes, /posts\/hello\/world/)
        assert.match(routes, /posts\/nested\/hello/)
        return
      }
    }
    catch {}
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`Valaxy did not become ready: ${log}`)
}
async function main() {
  try {
    await ready()
    await runTests({
      version: process.env.VSCODE_VERSION || 'stable',
      vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH,
      extensionDevelopmentPath: root,
      extensionTestsPath: path.join(__dirname, 'suite.cjs'),
      launchArgs: [path.join(__dirname, 'fixtures/workspace.code-workspace'), '--disable-extensions', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', '--no-sandbox'],
    })
  }
  finally {
    server.kill('SIGTERM')
    const killTimer = setTimeout(() => server.kill('SIGKILL'), 5000)
    killTimer.unref()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
