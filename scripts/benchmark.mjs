import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'tsup'

const repository = fileURLToPath(new URL('..', import.meta.url))
const temporary = await mkdtemp(path.join(os.tmpdir(), 'valaxy-scan-benchmark-'))
try {
  await build({ entry: { scanner: path.join(repository, 'src/project.ts') }, outDir: path.join(temporary, 'bundle'), format: ['cjs'], bundle: true, silent: true, config: false })
  const { scanPosts } = await import(pathToFileURL(path.join(temporary, 'bundle/scanner.js')).href)
  const results = { platform: process.platform, arch: process.arch, node: process.version, cpu: os.cpus()[0].model, cache: 'warm (generated files)', cases: [] }
  const body = `# Realistic blog article\n\n${'Valaxy powers this static blog. This paragraph includes **Markdown**, an [example link](https://example.org), and multilingual text 中文内容.\n\n'.repeat(14)}`
  for (const count of [1000, 10000]) {
    const root = path.join(temporary, String(count))
    const postsRoot = path.join(root, 'pages/posts')
    const project = { root, postsRoot, name: 'Benchmark', serverUrl: 'http://localhost:4859/', confirmDelete: true }
    for (let directory = 0; directory < 100; directory++)
      await mkdir(path.join(postsRoot, `category-${directory}`), { recursive: true })
    let bytes = 0
    for (let index = 0; index < count; index++) {
      const article = `---\ntitle: "Example post ${index}"\ndate: 2026-09-21 12:00:00\nupdated: 2026-09-${String(1 + index % 21).padStart(2, '0')} 12:00:00\ntags: [Vue, Valaxy]\ncategories: [Engineering]\ndescription: "Representative Markdown post with metadata"\n---\n\n${body}`
      bytes += Buffer.byteLength(article)
      await writeFile(path.join(postsRoot, `category-${index % 100}`, `post-${index}.md`), article)
    }
    const scanMs = []
    for (let run = 0; run < 6; run++) {
      const start = performance.now()
      const posts = await scanPosts(project, (message) => {
        throw new Error(message)
      })
      if (posts.length !== count)
        throw new Error(`Expected ${count} articles; found ${posts.length}`)
      if (posts.some(post => !post.frontmatter.title?.startsWith('Example post ') || !post.frontmatter.updated))
        throw new Error('The generated article metadata was not parsed.')
      scanMs.push(Number((performance.now() - start).toFixed(2)))
    }
    results.cases.push({ count, bytes, scanMs, repeatMedianMs: [...scanMs.slice(1)].sort((a, b) => a - b)[2] })
  }
  console.log(JSON.stringify(results, null, 2))
}
finally {
  await rm(temporary, { recursive: true, force: true })
}
