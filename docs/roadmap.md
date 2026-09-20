# Roadmap and DevTools boundary

Tracking issue: [#1](https://github.com/valaxyjs/valaxy-vscode/issues/1).

## 0.1.0 compatibility PR

Implemented in this branch; release completion depends on review, CI and publishing:

- Detect Valaxy dependencies in every workspace folder and apply folder-scoped settings.
- Recursively load posts, tolerate absent directories and invalid frontmatter, and rescan after changes.
- Navigate conventional nested article routes and configurable base URLs without a legacy client message bridge.
- Provide extension-settings and browser-preview commands.
- Confirm deletion by default and use trash.
- Add unit tests, real Valaxy 1.0 RC + VS Code host smoke tests, cross-platform CI, VSIX artifacts and a gated Marketplace release workflow.

Release gates:

- [ ] Merge compatibility PR after CI passes.
- [ ] Install its VSIX and complete a manual preview smoke test.
- [ ] Create the 0.1.0 tag and publish the draft GitHub release.
- [ ] Configure Marketplace credentials and publish 0.1.0.

## Follow-up work

- [ ] Review and rebase [PR #2](https://github.com/valaxyjs/valaxy-vscode/pull/2) for native post creation, including templates, multi-root destination selection and collision handling. Preserve the contributor's work and attribution.
- [ ] Validate Remote SSH/Containers forwarding and large-workspace performance.
- [ ] Define a public optional DevTools discovery/open-link contract, including base URL, capability/version advertisement and authentication ownership.
- [ ] Add Open DevTools only after that contract is available. Preserve offline post navigation and support `devtools: false`.
- [ ] Consider canonical file-to-route lookup for custom router configurations through a public read-only Valaxy capability.

## Original issue items

| Original request | Direction |
| --- | --- |
| Toggle preview when switching posts | Included for conventional routes in the compatibility PR. |
| Open VS Code settings | Included in the compatibility PR. |
| Create new post | Follow up on existing PR #2. |
| Edit albums | Keep visual collection/album management in DevTools. |
| Open browser preview | Included in the compatibility PR. |
| Open config panel | Use DevTools for visual site/theme settings; VS Code extension settings are already a native command. |

## Repository decision

Keep `valaxyjs/valaxy-vscode` independent: the editor host, VSIX packaging and Marketplace release lifecycle are separate from the framework. Test against an explicit Valaxy version rather than bundling its internals. Reconsider a monorepo move only if a shared public package repeatedly requires atomic changes across both projects.

The present DevTools implementation has authenticated Devframe/Vite-hosted RPC and frame navigation. These are not assumed to be a stable VS Code integration API. An editor entry point can eventually open a supported DevTools URL; bidirectional RPC is unnecessary for the current feature set.
