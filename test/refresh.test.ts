import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ scan: vi.fn(), resolve: vi.fn(), fire: vi.fn() }))
vi.mock('vscode', () => ({
  workspace: { workspaceFolders: [{ name: 'Blog' }] },
  EventEmitter: class { event = vi.fn(); fire = state.fire; dispose = vi.fn() },
}))
vi.mock('../src/config', () => ({ resolveProject: state.resolve }))
vi.mock('../src/project', () => ({ scanPosts: state.scan, isInside: () => true }))
const { Context } = await import('../src/ctx')

beforeEach(() => {
  vi.clearAllMocks()
  state.resolve.mockResolvedValue({ root: '/blog', name: 'Blog' })
})

it('coalesces refreshes during a scan and publishes only the latest complete result', async () => {
  let finish!: (posts: unknown[]) => void
  state.scan.mockImplementationOnce(() => new Promise((resolve) => {
    finish = resolve
  }))
    .mockResolvedValueOnce([{ filePath: '/blog/latest.md' }])
  const context = new Context(() => {})
  const first = context.refresh()
  await vi.waitFor(() => expect(state.scan).toHaveBeenCalledOnce())
  const pending = Array.from({ length: 5 }, () => context.refresh())
  expect(state.scan).toHaveBeenCalledOnce()
  finish([{ filePath: '/blog/old.md' }])
  expect(await Promise.all([first, ...pending])).toEqual(Array.from({ length: 6 }, () => 1))
  expect(state.scan).toHaveBeenCalledTimes(2)
  expect(context.posts[0].filePath).toBe('/blog/latest.md')
  expect(state.fire).toHaveBeenCalledOnce()
  context.dispose()
})

it('does not publish or start another scan after disposal', async () => {
  let finish!: (posts: unknown[]) => void
  state.scan.mockImplementationOnce(() => new Promise((resolve) => {
    finish = resolve
  }))
  const context = new Context(() => {})
  const pending = context.refresh()
  await vi.waitFor(() => expect(state.scan).toHaveBeenCalledOnce())
  context.refresh()
  context.dispose()
  finish([])
  await pending
  expect(state.scan).toHaveBeenCalledOnce()
  expect(state.fire).not.toHaveBeenCalled()
})
