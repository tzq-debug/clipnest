# ClipNest

**A clipboard manager that lives on the edge of your screen — and lets you paste several things at once.**

[English](README.md) · [简体中文](README.zh-CN.md)

![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![license](https://img.shields.io/badge/license-MIT-blue)
![release](https://img.shields.io/github/v/release/tzq-debug/clipnest?color=4c42a8)
![stars](https://img.shields.io/github/stars/tzq-debug/clipnest?style=social)

![ClipNest panel](docs/screenshot.png)

---

## Why

Most clipboard managers stop at "get it back". ClipNest goes one step further: **gather several entries and paste them together.**

> Typical clipboard manager: find entry → copy → paste → back to the tool → find the next one → copy → paste.
>
> ClipNest: tick three entries → **Merge copy** → back in your app, press `Ctrl+V` once.

The merged text is joined in the order you see on screen, with a separator you choose.

<details>
<summary>What multi-select looks like</summary>

![multi-select](docs/screenshot-select.png)

</details>

## Features

- **Edge dock** — a slim strip on the right edge of the screen. Click it to open the panel; nothing opens just because the pointer brushed past. No taskbar button.
- **Stays where you put it** — unless you collapse it with `-` or hide it with `×`, the panel keeps sitting there. Drag its header to move it; the position is remembered.
- **Global hotkey** — `Ctrl+Shift+V` by default, rebindable.
- **Batch paste** — tick any number of entries, then merge them into one clipboard payload or replay them one by one.
- **Everything you copy** — plain text, HTML rich text, images, and files from your file manager.
- **Screenshots become pictures** — screenshot tools usually put a `.png` *file* on the clipboard; ClipNest recognises it, generates a thumbnail and files it under images.
- **Click to enlarge** — thumbnails open a preview; copy from there or hand it to your system image viewer.
- **Drag a screenshot into a chat** — grab a thumbnail and drop it on WeChat, Slack or a folder; the receiving app gets a real file, not a clipboard blob.
- **Drop files in** — drag files from Explorer onto the panel and they join the history, thumbnails and all. No need to copy them first.
- **Export** — one button writes the history to Markdown (for sending to someone) or JSON (a full backup, flags included); pictures land in a folder next to the file.
- **Search and filters** — live search, filter by text / image / file / starred.
- **Star and pin are separate** — 收藏 (star) keeps an entry in the 收藏 filter and survives cleanup; 置顶 (pin) only floats it to the top of the list.
- **One-click clean** — the trash button asks for confirmation in a bar at the bottom, then clears everything except starred entries. Pinned entries go too: pinning is only about order.
- **Optional encryption** — a password encrypts the history and every stored image with AES-256-GCM; the app asks for it on each start.
- **Secrets are treated differently** — API keys, private keys, JWTs, ID and card numbers are recognised as you copy them, sealed with the OS key and masked in the list. No master password needed.
- **Lock any entry yourself** — the padlock on a text card seals just that item, whether or not it looks like a credential.
- **Private by design** — no account, no network, no telemetry.

## Install

| Platform | Download |
| --- | --- |
| Windows | [installer `ClipNest-x.y.z-x64.exe`](https://github.com/tzq-debug/clipnest/releases/latest) · [portable `ClipNest-x.y.z-x64.zip`](https://github.com/tzq-debug/clipnest/releases/latest) |
| macOS | build from source (no `.dmg` yet) |
| Linux | build from source (no `.AppImage` yet) |

The Windows build is not code-signed, so SmartScreen will warn you: **More info → Run anyway**.

The `.zip` needs no installation: unzip it anywhere and run `ClipNest.exe`. History still lives in `%APPDATA%\ClipNest`, shared with the installer build, so you can switch between the two.

### From source

Requires Node.js 20+.

```bash
git clone https://github.com/tzq-debug/clipnest.git
cd clipnest
npm install
npm run dev
```

Package an installer for your platform:

```bash
npm run dist
```

## Usage

1. Launch it. A thin purple strip appears in the middle of the right screen edge.
2. Copy things as usual — they are recorded automatically.
3. Hover the strip to expand, or press `Ctrl+Shift+V` from anywhere.
4. Click an entry to copy it; click the circle on the left to tick it.
5. Tick several, then **Merge copy** — or **Replay one by one** — in the bottom bar.

### Keyboard

| Key | Action |
| --- | --- |
| `Ctrl+Shift+V` | Open / close the panel (rebindable) |
| `Up` `Down` | Move the cursor |
| `Space` | Tick / untick the current entry |
| `Enter` | Copy the current entry (or all ticked ones) |
| `Ctrl+A` | Select everything in the current filter |
| `Delete` | Delete the current entry |
| `Esc` | Leave multi-select, close the preview, collapse the panel |

### Two ways to paste in bulk

| | Merge copy | Replay one by one |
| --- | --- | --- |
| How | Joins the selection into one payload | Writes each entry, then simulates `Ctrl+V` |
| You then | Press `Ctrl+V` once | Nothing — put the caret in the target field first |
| Good for | Several paragraphs heading to one place | Filling a form, one field at a time |
| Limits | Images cannot be merged (the OS clipboard holds one image) | Some apps block synthetic keystrokes |

Replay relies on OS-level key simulation: PowerShell `SendKeys` on Windows, `osascript` on macOS, `xdotool` on Linux. It is experimental — try it in Notepad first.

## Privacy

Everything is stored locally as plain JSON plus image files. There is no network code in this project at all.

| Platform | Path |
| --- | --- |
| Windows | `%APPDATA%\ClipNest` |
| macOS | `~/Library/Application Support/ClipNest` |
| Linux | `~/.config/ClipNest` |

```
history.json     history, human-readable
settings.json    settings
images/          images and thumbnails
```

Delete that folder to wipe everything; Settings has a button that opens it for you.

### Encryption

History is plain JSON by default. If you would rather not keep it readable on disk, turn on
**Settings → Privacy → Encrypt history** and choose a password:

- Text, file paths and every stored image are encrypted with AES-256-GCM
- The key is derived with scrypt from your password; only a random salt and a small canary value live in `security.json`
- On start the panel asks for the password before anything is loaded, and the clipboard watcher does not run until you unlock
- **There is no recovery.** Forgetting the password means the history is gone; that is what encryption costs
- Turn it off again (with the password) and everything is decrypted back to plain files

You do not need encryption to be safe day to day: **Ignore keywords** and **Pause recording** already keep secrets out of the history in the first place. Encryption protects the case where someone else gets hold of the files.

### Sensitive entries

Independently of the vault, ClipNest watches for things that look like credentials and treats them differently:

| Recognised | Example |
| --- | --- |
| API keys | `sk-…`, `ghp_…`, `AKIA…`, `xoxb-…`, `sk_live_…` |
| Private keys | anything between `-----BEGIN … PRIVATE KEY-----` |
| JWT | three dot-separated base64url segments |
| ID / bank cards | 18-digit Chinese ID numbers, card numbers that pass the Luhn check |
| Credentials | `password: …`, `API_KEY=…`, `secret=…` |

By default they are **sealed and masked**: the text is encrypted with the OS key (DPAPI on Windows, Keychain on macOS, libsecret on Linux) — only your user account can decrypt it — and the list shows just the kind and the length. Copying works as usual; decryption happens on the way out. Nothing readable reaches the disk, and you are not asked for a password.

If you would rather not keep them at all, set **Settings → Privacy → Handling** to `skip`.

The detection is pattern-based, not a guarantee. A key pasted inside a long paragraph of prose may slip through; the vault and the ignore list are the belts to this pair of braces.

### Locking a single entry yourself

Detection only catches what looks like a credential. Anything else you want kept out of plain sight — a note, an address, a customer number — can be locked by hand: hover a text card and click the padlock.

That entry is sealed with the same OS key, the card shows `手动加密 · 123 字符` instead of the text, and copying still returns the full content. Click the padlock again to turn it back into plain text. Images and file entries are not lockable this way — turn on the vault for those.

### Exporting

The download button in the header writes the history somewhere you choose:

- **Markdown** — one section per entry with its time, flags and content. Pictures are referenced from a sibling `…_images/` folder instead of being inlined, so the file stays small and still renders when you send the folder along.
- **JSON** (Settings → 导出备份) — every field including 收藏 and 置顶, for archiving or moving to another machine.

Sealed entries become `[已加密内容]` with their length; their plaintext never leaves the app. A picture that can no longer be read is skipped rather than failing the whole export.

If anything is selected, the button exports only the selection.

## Known limitations

- The clipboard is polled every 420 ms; two extremely fast copies in a row can miss one
- Copying files back relies on PowerShell `Set-Clipboard` on Windows; other platforms fall back to plain path text
- Replay mode needs `xdotool` on Linux
- The source application of a copy is not detected yet, so "never record anything from my password manager" rules are not possible
- Dragging carries pictures only. Plain text has no file to hand to another program — copy and paste is the way there

## FAQ

**I clicked an entry but pasted the previous content.**
Make sure you are on 0.2.0 or later — 0.1.0 had a bug where any click copied the top entry instead of the one you clicked.

**An image copy pastes nothing into my chat app.**
Image copies carry both a bitmap and a file, so both kinds of target work. If a specific app still ignores it, please open an issue with the app name.

**The strip does not appear after launch.**
Usually a second instance is already running — only one can. In restricted environments (some VMs, remote desktops, sandboxed terminals) Chromium's GPU process can fail; start with `ClipNest.exe --no-sandbox`.

**`Ctrl+Shift+V` conflicts with paste-as-plain-text in my browser or editor.**
That is exactly why the shortcut is rebindable: Settings → Shortcut → press your combination.

**Does it phone home?**
No. No analytics, no update check, no account.

## Development

```
electron/          main process, plain CommonJS (no build step)
  main.cjs           windows, tray, global shortcut, IPC
  watcher.cjs        clipboard polling and content detection
  store.cjs          history and settings persistence
  vault.cjs          optional AES-256-GCM encryption
  sensitive.cjs      credential detection rules
  export.cjs         Markdown / JSON export, pure functions
  drag.cjs           which file a drag should carry
  paste.cjs          clipboard writes and keystroke simulation
  preload.cjs        the API exposed to the renderer
src/               renderer, React + TypeScript
scripts/           dev-only tooling, not shipped
assets/            runtime icons
build/             packaging icons
docs/              documentation screenshots
```

Electron + React + TypeScript + Vite, with no native modules — `npm install` and you are running.

```bash
npm run dev        # hot reload for the renderer
npm run typecheck  # tsc --noEmit
npm run preview    # render the UI with mock data and screenshot it
npm run dist       # build an installer
```

Windows users can also double-click `dev.bat` at the project root.

There is no test framework, but most behaviour is pinned down by assertion scripts:

```bash
npm test        # typecheck + every probe below
npm run test:app  # just the ones that need a real Electron runtime
```

Each probe prints `PASS` / `FAIL` per assertion and exits non-zero on failure. `probe-export` and `probe-drag` are plain node (the modules they cover avoid Electron on purpose); `probe-vault`, `probe-sensitive` and `probe-seal` boot Electron because they touch `safeStorage`. `npm run preview` renders the UI against mock data without touching the clipboard.

A few things worth knowing before touching the code:

- Since Electron 45, `clipboard` is the async W3C-style API (`read()` / `write(ClipboardItem[])`); the old `availableFormats` / `readBuffer` are gone
- There is no clipboard change event, so the watcher polls every 420 ms
- A `transparent: true` window may need `--disable-gpu` in some VMs and remote desktops
- Replay mode needs `xdotool` on Linux

See [CONTRIBUTING.md](CONTRIBUTING.md) before sending a patch.

## Roadmap

- [x] Encrypted storage (optional password)
- [x] Sensitive-content detection with per-item sealing
- [x] Export to Markdown / JSON, and dragging pictures out
- [ ] OCR for screenshots, so pictures become searchable
- [ ] Source-app detection and per-app ignore rules
- [ ] Tags and groups
- [ ] Self-hosted sync between devices
- [ ] macOS and Linux release builds

## Contributing

Issues and pull requests are welcome. Bug reports are easiest to act on when they include your OS, the ClipNest version, and what you expected to happen. See [CONTRIBUTING.md](CONTRIBUTING.md) for the details.

If ClipNest saves you a few clicks a day, a star helps other people find it.

## License

[MIT](LICENSE) · [Changelog](CHANGELOG.md) · [Security policy](SECURITY.md) · [Code of conduct](CODE_OF_CONDUCT.md)
