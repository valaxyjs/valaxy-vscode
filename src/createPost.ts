import type { Context } from './ctx'
import { Uri, window, workspace } from 'vscode'
import { createPost, listScaffolds, postFilePath } from './post'

export async function addPost(ctx: Context) {
  if (!workspace.isTrusted) {
    await window.showInformationMessage('Trust this workspace before creating a post.')
    return
  }
  try {
    if (!ctx.projects.length) {
      await window.showInformationMessage('Open a Valaxy project folder first.')
      return
    }
    const project = ctx.projects.length === 1
      ? ctx.projects[0]
      : (await window.showQuickPick(ctx.projects.map(project => ({ label: project.name, description: project.root, project })), { placeHolder: 'Create a post in which Valaxy project?' }))?.project
    if (!project)
      return
    const name = await window.showInputBox({
      title: `New post in ${project.name}`,
      prompt: 'Filename relative to your posts folder (.md is added automatically)',
      placeHolder: 'hello-world or travel/hello-world',
      validateInput(value) {
        try {
          postFilePath(project, value)
        }
        catch (error) {
          return String(error)
        }
      },
    })
    if (name === undefined)
      return
    const scaffolds = await listScaffolds(project)
    let scaffold: string | undefined
    if (scaffolds.length) {
      const selected = await window.showQuickPick([
        { label: 'Default post', description: 'Built-in frontmatter', scaffold: undefined },
        ...scaffolds.map(scaffold => ({ label: scaffold, description: `scaffolds/${scaffold} (EJS)`, scaffold })),
      ], { placeHolder: 'Select a post template' })
      if (!selected)
        return
      scaffold = selected.scaffold
    }
    const filePath = await createPost(project, name, scaffold)
    await ctx.refresh()
    await window.showTextDocument(await workspace.openTextDocument(Uri.file(filePath)))
    return filePath
  }
  catch (error) {
    await window.showErrorMessage(`Unable to create post: ${String(error)}`)
  }
}
