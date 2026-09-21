import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const capabilities = process.env.VALAXY_TEST_CAPABILITIES === '1'

export default {
  theme: 'yun',
  devtools: false,
  vite: { base: '/blog/', server: { strictPort: true } },
  ...(capabilities ? {
    router: {
      routesFolder: [path.join(root, 'pages'), { src: path.join(root, 'content'), path: '/author/' }],
      extendRoute(route: any) {
        if (route.fullPath === '/posts/nested/hello')
          route.path = '/stories/hello'
      },
      beforeWriteFiles(tree: any) {
        tree.insert('/alternate', path.join(root, 'content/multiple.md'))
      },
    },
  } : {}),
}
