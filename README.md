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

The command palette offers **Valaxy: Refresh Posts**, **Preview Refresh**, **Open Browser Preview**, and **Open Extension Settings**. Delete actions move posts to the trash and ask for confirmation by default.

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

Preview maps conventional `pages/**/*.md` routes, including nested paths, `index.md` and encoded filenames. Custom router hooks, dynamic routes, and posts outside `pages` cannot be inferred reliably: navigate in the preview/browser for those cases. Preview uses a regular iframe, without depending on a Valaxy-specific `postMessage` bridge. If the server is stopped, start it and refresh the view; use the browser command when iframe embedding is unavailable.

## Relationship to DevTools

Both tools can list posts and help with editing, but serve different entry points:

| VS Code extension | Valaxy DevTools |
| --- | --- |
| Native workspace discovery, file navigation and trash operations | Site-aware content and runtime inspection |
| Lightweight offline post list | Frontmatter, configuration, collections and addon panels |
| Preview and browser/settings shortcuts | Visual editing powered by the running development server |

Keep visual configuration and album/collection editors in DevTools. A future optional **Open DevTools** command should use an advertised public URL and its supported authentication flow. This extension does not call internal RPC methods, copy authentication tokens, or embed a second configuration editor. See [the roadmap](docs/roadmap.md) for the integration boundary and existing new-post contribution.

## Development and verification

Use Node.js 22.12 or later and the pinned pnpm version:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test:integration
```

`pnpm check` runs lint, type checking, unit tests and VSIX packaging. `pnpm test:integration` starts the pinned **Valaxy 1.0.0-rc.12** fixture and launches a real VS Code Extension Development Host. On Linux use `xvfb-run -a pnpm test:integration`. `VSCODE_VERSION` selects a host version (CI checks 1.85.0 and stable); `VSCODE_EXECUTABLE_PATH` can select an existing executable. The test server uses port 4867, which must be free.

The Valaxy fixture is a development-only workspace dependency. It is excluded from the extension bundle and VSIX. Tests cover multi-root activation, recursive discovery, missing folders, malformed frontmatter, scoped settings, preview URL generation, and the real development server. Custom router behavior and Remote SSH/Containers remain manual validation items.

## Release

1. Update `package.json` and `CHANGELOG.md`, open a PR, and require all CI checks to pass.
2. After merge, tag that commit as `v<package version>`. The release workflow repeats checks and the extension-host smoke test, uploads the VSIX, and creates a **draft** GitHub release with the artifact.
3. Review the draft and install the VSIX for a smoke test before publishing the GitHub release.
4. Configure `VSCE_PAT` for publisher **YunYouJun** in the `marketplace` GitHub environment. Dispatch **Release** on the version tag with `publish=true` to publish the validated VSIX to Visual Studio Marketplace. Configure environment reviewers if required by the maintainer team.

Tagging alone does not publish to Marketplace. No publisher credential is needed to build, test, or download CI artifacts.

## License

[MIT](LICENSE) © YunYouJun
