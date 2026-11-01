# Security policy

## Supported versions

Only the latest release receives fixes. If you are on an older version, upgrade first.

## Reporting a vulnerability

Please do **not** open a public issue for a security problem. Use GitHub's private reporting instead:

**[Report a vulnerability](https://github.com/tzq-debug/clipnest/security/advisories/new)**

Include what you did, what happened, and what an attacker could gain. You will get an answer within a few days.

## What counts as a security issue here

ClipNest reads everything you copy, so the threat model is worth stating plainly:

- **History is stored unencrypted.** `history.json` and the images under it are plain files readable by your user account. Anyone who can read your profile can read your clipboard history. Encryption is on the roadmap; until then, use *Ignore keywords* or *Pause recording* around secrets.
- **Replay mode simulates keystrokes.** It calls PowerShell `SendKeys` on Windows, `osascript` on macOS and `xdotool` on Linux. Those are legitimate system tools, but a compromised `PATH` could hijack them.
- **The renderer is sandboxed.** `contextIsolation` is on, `nodeIntegration` is off, and the renderer only reaches the main process through the narrow API in `preload.cjs`. A way to break out of that boundary is a real vulnerability.
- **Nothing is downloaded at runtime.** The app makes no network requests, so remote code execution would have to come from the code itself.

Out of scope: an attacker who already has your user account, or who has modified the installed files.
