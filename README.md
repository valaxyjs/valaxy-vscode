# Valaxy for VS Code

[Install from Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=yunyoujun.valaxy) · [Documentation](https://valaxy.site/ecosystem/vscode) · [Issues](https://github.com/valaxyjs/valaxy-vscode/issues) · [Roadmap](https://github.com/valaxyjs/valaxy-vscode/issues/1)

An optional editor companion for [Valaxy](https://valaxy.site): browse and open posts, preview a running site, and manage files from VS Code. The extension remains in this independent repository and does not bundle the Valaxy runtime or require DevTools.

## Getting started

1. Install **Valaxy** by **YunYouJun** (`yunyoujun.valaxy`). Requires VS Code 1.85 or later and a trusted local or remote filesystem workspace.
2. Open a blog folder with `valaxy` in `dependencies` or `devDependencies`. Multi-root workspaces detect each blog independently; unrelated folders are ignored.
3. Run your blog's `pnpm dev` command. The extension does not start processes or evaluate your project configuration.
4. Open **Valaxy Posts** in the activity bar, then select a post. The **Preview** view follows the active Markdown editor, including nested posts.

Post discovery works without a running server. It recursively scans Markdown files, refreshes after file changes, and tolerates missing directories and individual malformed frontmatter files. Diagnostics appear in the **Valaxy** output channel. Symlinked and hidden directories are not scanned.

## Commands and settings

The command palette offers **Valaxy: Add a Post**, **Refresh Posts**, **Preview Refresh**, **Open Browser Preview**, **Open DevTools**, and **Open Extension Settings**. Delete actions move posts to the trash and ask for confirmation by default.

Use **Add a Post** (or the **+** button in Valaxy Posts) to choose a blog in a multi-root workspace and enter a filename such as `hello-world` or `travel/hello-world`. The extension creates missing directories under that blog's `valaxy.postsFolder`, adds `.md` if needed, refreshes the list and opens the new file. Existing files are never overwritten; choose another name if one already exists.

When the selected blog has `scaffolds/*.md`, choose the built-in template or a project scaffold. Scaffolds use EJS, with `title` (the filename without `.md`), `layout` (the scaffold name without `.md`) and local `date` (`YYYY-MM-DD HH:mm:ss`) variables, matching Valaxy's template format. EJS runs only when you explicitly select a scaffold in a trusted workspace. Theme scaffolds and project configuration are not loaded. Cancelling any prompt creates no post.

Set these options in each blog folder's `.vscode/settings.json`:

| Setting | Default | Purpose |
| --- | --- | --- |
| `valaxy.enabled` | `false` | Force project detection, including projects without a package manifest. |
| `valaxy.postsFolder` | `"pages/posts"` | Directory inside the workspace to scan recursively. |
| `valaxy.port` | `4859` | Local development server port. |
| `valaxy.serverUrl` | `""` | Override the port with a local HTTP(S) URL including the site's base path. |
| `valaxy.confirmDelete` | `true` | Confirm before moving posts to trash. |

```json
{
  "valaxy.serverUrl": "http://localhost:4859/blog/",
  "valaxy.confirmDelete": true
}
```

Set the URL or port to the address printed by your development server. Remote forwarding uses VS Code's `asExternalUri`. Automatic port discovery is not implemented.

When the running Valaxy server advertises the public editor protocol, preview uses its actual resolved routes, including custom router hooks, draft/hidden articles, and configured content directories outside `pages`. Multiple static routes can be selected with **Preview Refresh** or **Open Browser Preview**. Dynamic parameters cannot be guessed: the existing preview stays visible with an explanation, and the browser command offers manual site navigation. Workspace identity and base paths are checked before using the server.

Older or unavailable servers retain conventional `pages/**/*.md` preview, including nested paths, dot nesting (`hello.world.md` → `hello/world`), `index.md` and encoded filenames. Preview uses a regular iframe without a Valaxy client message bridge. Start the server and refresh when unavailable; use the browser command when a proxy or page blocks embedding.

## Relationship to DevTools

Both tools can list posts and help with editing, but serve different entry points:

| VS Code extension | Valaxy DevTools |
| --- | --- |
| Native workspace discovery, file navigation and trash operations | Site-aware content and runtime inspection |
| Lightweight offline post list | Frontmatter, configuration, collections and addon panels |
| Preview and browser/settings shortcuts | Visual editing powered by the running development server |

Keep visual configuration and album/collection editors in DevTools. **Open DevTools** discovers the selected project's public URL and opens it in the external browser. On first connection, enter the one-time code shown in the development server's terminal. The browser owns authentication; the extension does not read codes/tokens or call private RPC. Disabled DevTools, older servers and unavailable servers produce an explanatory message. Native article navigation and creation still work offline and with `devtools: false`. See [the protocol](https://valaxy.site/dev/editor-integration) and [roadmap](docs/roadmap.md).

## Development and verification

Use Node.js 22.12 or later and the pinned pnpm version:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test:integration
```

`pnpm check` runs lint, type checking, unit tests and VSIX packaging. `pnpm test:integration` starts the pinned **Valaxy 1.0.0-rc.12** fixture and launches a real VS Code Extension Development Host. On Linux use `xvfb-run -a pnpm test:integration`. `VSCODE_VERSION` selects a host version (CI checks 1.85.0 and stable); `VSCODE_EXECUTABLE_PATH` can select an existing executable. The test server uses port 4867, which must be free.

The Valaxy fixture is a development-only workspace dependency, excluded from the extension bundle and VSIX. Tests cover multi-root activation, filesystem operations, capability validation, preview selection and encoding, forwarding, stale responses and refresh coalescing. [Remote SSH/Dev Containers validation and performance results](docs/remote-validation.md) record the tested environments and limits.

To run the same Extension Development Host suite against a local Valaxy build that implements the public protocol:

```bash
VALAXY_CLI_PATH=/absolute/path/to/valaxy/packages/valaxy/bin/valaxy.mjs \
VALAXY_TEST_CAPABILITIES=1 pnpm test:integration
```

This additionally checks a custom hook, an author-only article outside `pages`, multiple routes, dynamic-route handling and disabled DevTools. CI runs both host versions against an immutable commit from [the companion framework PR](https://github.com/YunYouJun/valaxy/pull/741). Without these variables, the pinned rc.12 fixture verifies legacy fallback. Switch the CI pin to a released framework version after that PR ships.

## Release

1. Update `package.json` and `CHANGELOG.md`, open a PR, and require all CI checks to pass.
2. After merge, tag that commit as `v<package version>`. The release workflow repeats checks and the extension-host smoke test, uploads the VSIX, and creates a **draft** GitHub release with the artifact.
3. Review the draft and install the VSIX for a smoke test before publishing the GitHub release.
4. Configure `VSCE_PAT` for publisher **YunYouJun** in the `marketplace` GitHub environment. Dispatch **Release** on the version tag with `publish=true` to publish the validated VSIX to Visual Studio Marketplace. Configure environment reviewers if required by the maintainer team.

Tagging alone does not publish to Marketplace. No publisher credential is needed to build, test, or download CI artifacts.

## License

[MIT](LICENSE) © YunYouJun
