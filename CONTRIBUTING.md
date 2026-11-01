# Contributing

Thanks for taking the time. This is a small project, so the process is short.

## Ways to help

- **Report a bug** — use the bug template and include your OS, the ClipNest version, and what you expected to happen
- **Suggest a feature** — describe the problem you are trying to solve, not just the button you want
- **Send a patch** — see below
- **Improve docs or translations** — the Chinese README and English README should stay in sync
- **Try it on another platform** — macOS and Linux are written but barely tested

## Development setup

Requires Node.js 20+.

```bash
git clone https://github.com/tzq-debug/clipnest.git
cd clipnest
npm install
npm run dev
```

`npm run dev` starts Vite and Electron together. Renderer changes hot-reload; changes under `electron/` need a restart.

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite + Electron with hot reload |
| `npm run typecheck` | `tsc --noEmit`, must pass before a PR |
| `npm run preview` | Render the UI against mock data and write a screenshot — no clipboard access |
| `npm run dist` | Build an installer for the current platform |

On Windows you can also double-click `dev.bat`.

## How the code is organised

- `electron/` — the main process, plain CommonJS, no build step. `main.cjs` owns windows, tray, shortcuts and IPC; `watcher.cjs` polls the clipboard; `store.cjs` persists; `paste.cjs` writes the clipboard and simulates keystrokes.
- `src/` — the renderer, React + TypeScript. `Panel.tsx` is the list, `ItemCard.tsx` a row, `PreviewOverlay.tsx` the image modal, `Settings.tsx` the settings screen.
- IPC lives in `preload.cjs` (the exposed API) and the `ipcMain.handle` block in `main.cjs`. If you add one, add both.

## House rules

- **No native modules.** The whole point is `npm install` and it runs. Anything needing `node-gyp` needs a very good reason first.
- **No network calls.** The app is local-only; that is a feature, not an accident.
- **No telemetry, no auto-update, no accounts.**
- Keep the main process free of UI logic and the renderer free of filesystem access — everything goes through IPC.
- Match the existing style: no semicolons, single quotes, 2-space indent, comment only where the code cannot explain itself.

## Commit messages

Conventional commits, one logical change per commit:

```
fix: clicking a card copied the top item instead of the clicked one
feat: treat screenshot files as pictures, add image preview
chore(dev): write dev.bat with CRLF line endings
```

Write the subject in the imperative mood and keep it under ~72 characters. Add a body explaining *why* when the change is not obvious.

## Pull requests

Before opening one:

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] You have tried the change by hand, and said so in the description
- [ ] User-facing strings are in both languages if you touched the UI

In the description, say what problem the change solves. Screenshots help a lot for anything visual.

## What probably will not be merged

- Cloud sync services that need an account (self-hosted sync is welcome)
- Bundled binary blobs of unknown origin
- Rewrites that drop the "no native modules" constraint

---

中文提交者直接用中文写 issue 或 PR 描述就行，不用翻译。
