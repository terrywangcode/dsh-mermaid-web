# Contributing

Issues and pull requests are welcome. Please keep changes focused on the DeepSeek Harness Mermaid rendering surface and preserve the plugin's reversible lifecycle behavior.

## Development

Use Node.js 22.19 or newer and Corepack-enabled pnpm.

```sh
pnpm install
pnpm run typecheck
pnpm run build
```

The built `lib/client.js` and source map are committed because DeepSeek Harness consumes the browser export directly when installing the plugin from GitHub. Include regenerated artifacts with source changes.

## Live verification

Start a DeepSeek Harness Web UI on `http://127.0.0.1:3080` with this plugin installed, then run:

```sh
pnpm run verify:live
```

The Playwright check covers successful and failed Mermaid rendering, streaming settlement, inline zoom, fullscreen fit and zoom, pointer-centered wheel zoom, drag panning, keyboard shortcuts, SVG restoration, and a large-diagram workspace.

## Pull requests

- Explain the user-visible behavior being changed.
- Add or update verification for behavior changes.
- Run `pnpm run typecheck`, `pnpm run build`, and the live verification when the Web UI interaction changes.
- Keep Harness core changes out of this repository.
