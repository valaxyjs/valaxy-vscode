# Remote workspaces and performance

Validation date: 2026-09-21. The extension runs as a **workspace extension**, beside the remote filesystem and development server. Keep `valaxy.serverUrl` as that host's loopback URL, including its base; do not enter the locally forwarded address. VS Code maps the browser/webview URL with `asExternalUri`.

## Tested environments

| Component | Version/environment |
| --- | --- |
| Client | VS Code 1.138.0, macOS arm64 / Apple M1 Pro |
| Remote SSH | 0.128.0; Ubuntu 24.04.4 arm64, disposable 2-vCPU/4-GiB VM |
| Dev Containers | 0.469.0 / CLI 0.89.0; Debian 12 arm64, `node:22-bookworm-slim` |
| Remote extension host | Node 24.18.1 |
| Valaxy server | 1.0.0-rc.12, testing the existing conventional-preview fallback |

Both real Remote Extension Development Hosts passed multi-root activation, recursive discovery, native post creation in the selected remote folder, opening the new editor, refresh/deletion, nested and dotted previews, and the browser command's actual forwarded URL. Prompt responses and browser launch were intercepted; filesystem operations, extension commands, servers and port forwarding were real.

The main server used `4867 /blog/`; a second folder used `4869 /second/`. SSH and Container runs preserved each folder's base and route. Port collisions in the container run remapped the first server to local port 4868 and the second to a dynamically chosen local port. All four host-side HTTP probes returned 200 and the expected content.

These checks prove remote command/file behavior and HTTP forwarding. They do not establish WebSocket HMR, visual iframe rendering, browser Codespaces or enterprise proxy compatibility. A proxy can block embedding with `X-Frame-Options` or CSP `frame-ancestors`, or require its own browser authentication. Use **Open Browser Preview** in those cases; the extension does not bypass proxy restrictions.

## Reproduce remote checks

1. Install the extension's dependencies with pnpm, build it, and install fixture dependencies **on the remote host**. Build a VSIX with `pnpm run pack` if installing manually.
2. Open the fixtures' multi-root workspace through Remote SSH or Dev Containers. Confirm **Developer: Show Running Extensions** lists Valaxy in the remote workspace host.
3. Start the blog fixture's Valaxy server on port 4867, with `/blog/` base. Launch an Extension Development Host using the repository's `test/integration/suite.cjs` as its extension test entry. For Remote SSH, extension and test launch paths must use `vscode-remote://<authority>/...` URIs.
4. Verify article discovery/creation, open a nested article, run **Preview Refresh** and **Open Browser Preview**, and inspect the Ports view. Check the complete forwarded URL from the local host, including its base and article path.
5. Set a different port and base in another folder's settings and repeat. Occupy the preferred local port to exercise automatic remapping.
6. Stop only the disposable test servers/containers and remove temporary fixture posts/settings after testing.

The normal CI extension-host suite is local, not a substitute for these remote checks. Repeat the remote matrix when changing extension placement, filesystem operations or forwarding.

## Measurements and refresh fix

Run `node scripts/benchmark.mjs` after `pnpm install` to generate an isolated 1k/10k-post fixture, bundle the current scanner, measure six scans, print JSON results, and clean up. Run it inside the remote host to measure its filesystem. Payload sizes are printed so results can be compared fairly.

The baseline scanner read 1,000 and 10,000 approximately 2.28-KB Markdown articles across 100 directories. Files were freshly generated, so all numbers reflect **warm filesystem caches**, not cold-disk guarantees. Scans parse metadata and sort posts; these measurements exclude VS Code tree rendering and network transfer.

| Environment | 1k posts, median repeated scan | 10k posts, median repeated scan |
| --- | ---: | ---: |
| macOS M1 Pro / Node 24.18.0 | 108 ms | 1,122 ms |
| Ubuntu VM native filesystem / Node 24.18.1 | 318 ms | 3,175 ms |

Five saves 200 ms apart, under the existing 100-ms debounce, were then measured against the **actual `Context.refresh` and scanner**, with only VS Code configuration/events stubbed:

| Measure | Before | After coalescing |
| --- | ---: | ---: |
| Complete scans | 5 | 2 |
| Maximum concurrent scans | 5 | 1 |
| Time until all callers completed | 3,447 ms | 2,201 ms |
| Callers receiving final count | 1 of 5 | 5 of 5 |

The last save added a post and changed a title. The final result contained both changes and was published once. An in-progress scan now collects further refresh requests and performs one follow-up scan, instead of starting concurrent full scans. No content cache or per-file parsing shortcut was introduced. Machine load affects timings; scan count, concurrency and final-state correctness are the regression guarantees.
