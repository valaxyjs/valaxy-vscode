const assert = require('node:assert/strict')
const { Buffer } = require('node:buffer')
const { readFile } = require('node:fs/promises')
const path = require('node:path')
const process = require('node:process')
const vscode = require('vscode')

const capabilities = process.env.VALAXY_TEST_CAPABILITIES === '1'

async function waitForCount(expected) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const count = await vscode.commands.executeCommand('valaxy.refreshPosts')
    if (count === expected)
      return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.fail(`Expected ${expected} posts after refresh`)
}
exports.run = async function () {
  const extension = vscode.extensions.getExtension('YunYouJun.valaxy')
  assert.ok(extension, 'extension is installed in the development host')
  await extension.activate()
  assert.ok(extension.isActive)
  assert.equal(vscode.workspace.workspaceFolders.length, 3)
  await waitForCount(2)
  const file = vscode.Uri.file(path.join(__dirname, 'fixtures/blog/pages/posts/nested/hello.md'))
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(file))
  await vscode.commands.executeCommand('valaxy-preview.focus')
  const url = await vscode.commands.executeCommand('valaxy.preview-refresh')
  assert.equal(url, `http://localhost:4867/blog/${capabilities ? 'stories/hello' : 'posts/nested/hello'}`)
  assert.equal((await fetch(url)).status, 200)
  const dotted = vscode.Uri.file(path.join(__dirname, 'fixtures/blog/pages/posts/hello.world.md'))
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(dotted))
  assert.equal(await vscode.commands.executeCommand('valaxy.preview-refresh'), 'http://localhost:4867/blog/posts/hello/world')
  if (capabilities) {
    const originalPick = vscode.window.showQuickPick
    const originalMessage = vscode.window.showInformationMessage
    const originalOpen = vscode.env.openExternal
    try {
      const privateFile = vscode.Uri.file(path.join(__dirname, 'fixtures/blog/content/author note.md'))
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(privateFile))
      assert.equal(await vscode.commands.executeCommand('valaxy.preview-refresh'), 'http://localhost:4867/blog/author/author%20note')
      let opened
      vscode.env.openExternal = async (uri) => {
        opened = uri.toString()
        return true
      }
      await vscode.commands.executeCommand('valaxy.openBrowser')
      assert.equal(opened, (await vscode.env.asExternalUri(vscode.Uri.parse('http://localhost:4867/blog/author/author%20note'))).toString())
      const multiple = vscode.Uri.file(path.join(__dirname, 'fixtures/blog/content/multiple.md'))
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(multiple))
      vscode.window.showQuickPick = async items => items.find(item => typeof item === 'string' && item.endsWith('/alternate'))
      assert.equal(await vscode.commands.executeCommand('valaxy.preview-refresh'), 'http://localhost:4867/blog/alternate')
      const dynamic = vscode.Uri.file(path.join(__dirname, 'fixtures/blog/pages/[slug].md'))
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(dynamic))
      assert.equal(await vscode.commands.executeCommand('valaxy.preview-refresh'), undefined)
      let message
      vscode.window.showInformationMessage = async (value) => {
        message = value
      }
      await vscode.commands.executeCommand('valaxy.openDevtools')
      assert.match(message, /DevTools is disabled/)
    }
    finally {
      vscode.window.showQuickPick = originalPick
      vscode.window.showInformationMessage = originalMessage
      vscode.env.openExternal = originalOpen
    }
  }
  const created = vscode.Uri.file(path.join(__dirname, 'fixtures/empty/pages/posts/deep/new.md'))
  const originalQuickPick = vscode.window.showQuickPick
  const originalInputBox = vscode.window.showInputBox
  try {
    // Keep the command, filesystem, editor and refresh real; supply prompt answers.
    vscode.window.showQuickPick = async items => items.find(item => item.project?.root === path.join(__dirname, 'fixtures/empty'))
    vscode.window.showInputBox = async () => 'deep/new'
    const newFile = await vscode.commands.executeCommand('valaxy.addPost')
    assert.equal(newFile, created.fsPath)
    assert.equal(vscode.window.activeTextEditor.document.uri.fsPath, created.fsPath)
    assert.match(await readFile(created.fsPath, 'utf8'), /title: "new"/)
    vscode.window.showQuickPick = originalQuickPick
    vscode.window.showInputBox = originalInputBox
    await waitForCount(3)
    await vscode.workspace.fs.writeFile(created, Buffer.from('---\ntitle: Updated after creation\n---\nHello'))
    await waitForCount(3)
    await vscode.workspace.fs.delete(created)
    await waitForCount(2)
    await vscode.commands.executeCommand('valaxy.openSettings')
  }
  finally {
    vscode.window.showQuickPick = originalQuickPick
    vscode.window.showInputBox = originalInputBox
    await vscode.workspace.fs.delete(vscode.Uri.file(path.join(__dirname, 'fixtures/empty/pages')), { recursive: true }).then(() => {}, () => {})
  }
  console.warn(`PASS: real Valaxy server (${capabilities ? 'public editor protocol' : 'legacy fallback'}), multi-root activation, native post creation, recursive posts, missing directory, preview and settings`)
}
