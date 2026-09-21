import type { Post, Project } from './project'
import { EventEmitter, workspace } from 'vscode'
import { resolveProject } from './config'
import { isInside, scanPosts } from './project'

export class Context {
  private changed = new EventEmitter<void>()
  readonly onDidChange = this.changed.event
  projects: Project[] = []
  posts: Post[] = []
  private refreshing?: Promise<number>
  private refreshRequested = false
  private disposed = false

  constructor(private report: (message: string) => void) {}

  refresh(): Promise<number> {
    if (this.disposed)
      return Promise.resolve(this.posts.length)
    this.refreshRequested = true
    this.refreshing ||= this.drainRefreshes().finally(() => {
      this.refreshing = undefined
    })
    return this.refreshing
  }

  private async drainRefreshes() {
    do {
      this.refreshRequested = false
      await this.scan()
    } while (this.refreshRequested && !this.disposed)
    return this.posts.length
  }

  private async scan() {
    const projects: Project[] = []
    for (const folder of workspace.workspaceFolders ?? []) {
      try {
        const project = await resolveProject(folder)
        if (project)
          projects.push(project)
      }
      catch (error) {
        this.report(`${folder.name}: ${String(error)}`)
      }
    }
    const posts = (await Promise.all(projects.map(project => scanPosts(project, this.report)))).flat()
    if (!this.disposed && !this.refreshRequested) {
      this.projects = projects
      this.posts = posts
      this.changed.fire()
    }
  }

  projectFor(filePath?: string) {
    if (filePath) {
      return this.projects.filter(project => isInside(project.root, filePath))
        .sort((a, b) => b.root.length - a.root.length)[0]
    }
    return this.projects.length === 1 ? this.projects[0] : undefined
  }

  dispose() {
    this.disposed = true
    this.changed.dispose()
  }
}
