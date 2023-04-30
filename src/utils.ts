import { workspace } from 'vscode'

export function isDarkTheme() {
  const theme = workspace.getConfiguration()
    .get('workbench.colorTheme', '')

  // must be dark
  if (theme.match(/dark|black/i) != null)
    return true

  // must be light
  if (theme.match(/light/i) != null)
    return false

  // IDK, maybe dark
  return true
}

export function formatTime(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`
}
