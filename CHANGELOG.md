# Changelog

## Unreleased

- Discover public Valaxy editor capabilities and add workspace-aware **Open DevTools**, with authentication owned by the browser.
- Resolve custom article previews from the running framework, including author drafts, hidden articles and custom content folders. Select among multiple routes and explain unresolved dynamic parameters.
- Preserve offline/legacy preview and reject workspace, base-path and protocol mismatches.
- Coalesce overlapping article refreshes and publish the final state to every waiting caller.
- Validate real Remote SSH and Dev Containers workspaces, forwarded ports and folder-specific base paths; document measured performance and proxy limitations.

## 0.2.0 (2026-09-21)

- Complete the native **Add a Post** contribution by @Rotten-LKZ (PR #2), adapted to the Valaxy 1.x workspace model.
- Select the destination blog in multi-root workspaces, create nested directories, and open the new post immediately.
- Choose a built-in template or project EJS scaffolds with Valaxy-compatible title, layout and date variables.
- Protect existing files with exclusive creation, reject invalid paths and symlink destinations, and handle prompt cancellation and template errors.
- Add filesystem, command and extension-host regression coverage for post creation.
- Verify Marketplace credentials before publishing and allow successful retries when the version already exists.

## 0.1.0 (2026-09-21)

- Support multiple Valaxy workspace folders with per-folder settings.
- Recursively discover Markdown posts and recover from missing directories and malformed frontmatter.
- Rescan files on create, update, delete, project and settings changes.
- Preview conventional nested routes and site base paths without the legacy Valaxy message bridge.
- Add browser preview and extension-settings commands.
- Confirm deletion by default and move files to trash.
- Add Valaxy 1.0.0-rc.12 compatibility fixtures, extension-host tests, cross-platform CI and VSIX release artifacts.
- Require VS Code 1.85 or later; remove the bundled Valaxy 0.14/Vite 4 development stack.

## 0.0.8

Previous release. See [GitHub releases](https://github.com/valaxyjs/valaxy-vscode/releases/tag/v0.0.8).
