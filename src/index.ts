import type { ExtensionContext } from 'vscode'
import { window } from 'vscode'
import { Context } from './ctx'
import { configureEditor } from './editor'

export async function activate(ext: ExtensionContext) {
  const output = window.createOutputChannel('Valaxy')
  const ctx = new Context(message => output.appendLine(message))
  ext.subscriptions.push(output, ctx)
  await configureEditor(ext, ctx, output)
}
