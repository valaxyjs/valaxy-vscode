# Roadmap and DevTools boundary

Tracking issue: [#1](https://github.com/valaxyjs/valaxy-vscode/issues/1).

## 0.1.0 compatibility release

Released on GitHub and Visual Studio Marketplace after PR #3 was squash-merged:

- Detect Valaxy dependencies in every workspace folder and apply folder-scoped settings.
- Recursively load posts, tolerate absent directories and invalid frontmatter, and rescan after changes.
- Navigate conventional nested article routes and configurable base URLs without a legacy client message bridge.
- Provide extension-settings and browser-preview commands.
- Confirm deletion by default and use trash.
- Add unit tests, real Valaxy 1.0 RC + VS Code host smoke tests, cross-platform CI, VSIX artifacts and a gated Marketplace release workflow.

Release gates:

- [x] Merge compatibility PR after CI passes.
- [x] Validate the release VSIX in a real VS Code extension host against Valaxy 1.0.0-rc.12.
- [x] Create the 0.1.0 tag and publish the GitHub release.
- [x] Configure Marketplace credentials and publish 0.1.0.

## 0.2.0 native post creation

[PR #2](https://github.com/valaxyjs/valaxy-vscode/pull/2), originally contributed by @Rotten-LKZ, is adapted to the current workspace model with destination selection, nested files, project EJS scaffolds, exclusive creation and cancellation/error handling. Unit and extension-host tests cover the new behavior.

The release workflow verifies the publisher PAT before publishing and safely skips already-published versions on retries.

## Follow-up work

The initial maintenance milestone is tracked in #1. Longer-term work is tracked separately:

- [#4 — Remote SSH/Containers forwarding and large-workspace performance](https://github.com/valaxyjs/valaxy-vscode/issues/4).
- [#5 — Public DevTools discovery/open-link contract and optional Open DevTools command](https://github.com/valaxyjs/valaxy-vscode/issues/5), including version/capability advertisement and authentication ownership. Preserve offline operation and support `devtools: false`.
- [#6 — Public read-only file-to-route lookup for custom router configurations](https://github.com/valaxyjs/valaxy-vscode/issues/6).

## Original issue items

| Original request | Direction |
| --- | --- |
| Toggle preview when switching posts | Included for conventional routes in the compatibility PR. |
| Open VS Code settings | Included in the compatibility PR. |
| Create new post | Included in 0.2.0 through the adapted PR #2. |
| Edit albums | Keep visual collection/album management in DevTools. |
| Open browser preview | Included in the compatibility PR. |
| Open config panel | Use DevTools for visual site/theme settings; VS Code extension settings are already a native command. |

## Repository decision

Keep `valaxyjs/valaxy-vscode` independent: the editor host, VSIX packaging and Marketplace release lifecycle are separate from the framework. Test against an explicit Valaxy version rather than bundling its internals. Reconsider a monorepo move only if a shared public package repeatedly requires atomic changes across both projects.

The present DevTools implementation has authenticated Devframe/Vite-hosted RPC and frame navigation. These are not assumed to be a stable VS Code integration API. An editor entry point can eventually open a supported DevTools URL; bidirectional RPC is unnecessary for the current feature set.
