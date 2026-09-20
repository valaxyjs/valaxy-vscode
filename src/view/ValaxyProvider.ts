import type { TreeDataProvider } from 'vscode'
import type { Context } from '../ctx'
import type { Project } from '../project'
import { TreeItem, TreeItemCollapsibleState, Uri } from 'vscode'
import { PostItem } from './PostItem'

class ProjectItem extends TreeItem {
  constructor(readonly project: Project) {
    super(project.name, TreeItemCollapsibleState.Expanded)
    this.id = project.root
    this.resourceUri = Uri.file(project.root)
    this.contextValue = 'valaxy-project'
  }
}

type Item = PostItem | ProjectItem

export class PostsProvider implements TreeDataProvider<Item> {
  readonly onDidChangeTreeData
  constructor(private ctx: Context) {
    this.onDidChangeTreeData = ctx.onDidChange
  }

  getTreeItem(item: Item) {
    return item
  }

  getChildren(item?: Item): Item[] {
    if (item instanceof PostItem)
      return []
    if (!item && this.ctx.projects.length > 1)
      return this.ctx.projects.map(project => new ProjectItem(project))
    return this.ctx.posts.filter(post => !item || post.project.root === item.project.root).map(post => new PostItem(post))
  }
}
