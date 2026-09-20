import antfu from '@antfu/eslint-config'

export default antfu({ ignores: ['.vscode-test/**', 'test/integration/fixtures/**', 'res/html/**'] })
