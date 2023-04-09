import { ConfigurationTarget, workspace } from 'vscode'

export function getConfig<T>(key: string, v?: T) {
  return workspace.getConfiguration('valaxy').get(key, v)
}

export function setConfig<T>(key: string, v?: T) {
  return workspace.getConfiguration('valaxy').set(key, v, ConfigurationTarget.Workspace)
}

export interface Config {
  root: string
  port: number
  /**
   * The folder name of the posts (relative to the workspace root)
   * @default 'pages/posts'
   */
  postsFolder: string
  /**
   * confirm when deleting a post
   * @default false
   */
  confirmDelete: boolean
  enabled: boolean
}

export const config = new Proxy(
  {
    get root() {
      return workspace.workspaceFolders?.[0]?.uri?.fsPath || ''
    },
  },
  {
    get(target, p, r) {
      if (p in target || !(typeof p === 'string'))
        return Reflect.get(target, p, r)
      return getConfig(p)
    },
    set(target, p, v) {
      setConfig(p as string, v)
      return true
    },
  },
) as Readonly<Config>
