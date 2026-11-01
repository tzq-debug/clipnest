'use strict'

/**
 * Manual per-item sealing: a text entry the user explicitly locks should be
 * unreadable on disk and masked in the list, yet still copy as plain text.
 *
 *   env -u ELECTRON_RUN_AS_NODE electron.exe scripts/probe-seal.cjs
 */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { app } = require('electron')

const { Store } = require(path.join(__dirname, '..', 'electron', 'store.cjs'))

app.disableHardwareAcceleration()

let failures = 0
const ok = (label, cond) => {
  if (!cond) failures += 1
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`)
}

const SECRET = 'mysql://root:hunter2@10.0.0.5:3306/prod'

app.whenReady().then(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipnest-seal-'))
  const historyFile = path.join(dir, 'history.json')
  const s = new Store(dir)

  s.add({
    id: 't1',
    type: 'text',
    text: SECRET,
    chars: SECRET.length,
    hash: 'h1',
    createdAt: Date.now(),
    pinned: false
  })
  s.add({
    id: 'f1',
    type: 'files',
    files: ['C:\\tmp\\a.png'],
    bytes: 10,
    hash: 'h2',
    createdAt: Date.now(),
    pinned: false
  })

  ok('canSeal reports the OS can protect a blob', s.canSeal())

  const on = s.toggleSeal('t1', true)
  const item = s.get('t1')
  ok('seal returns ok', on.ok && on.sealed === true)
  ok('plaintext is gone from memory', item.text === '')
  ok('ciphertext is stored', typeof item.sealed === 'string' && item.sealed.length > 20)
  ok('marked as sensitive so the card masks itself', item.sensitive === 'manual')
  ok('keeps the label for the card', item.sensitiveLabel === '手动加密')
  ok('character count survives for display', item.chars === SECRET.length)
  ok('copy path still yields the original text', s.revealText(item) === SECRET)

  const again = s.toggleSeal('t1', true)
  ok('sealing twice is a no-op', again.ok && s.revealText(s.get('t1')) === SECRET)

  const refused = s.toggleSeal('f1', true)
  ok('file entries are refused', refused.ok === false)

  const missing = s.toggleSeal('nope', true)
  ok('unknown id is refused', missing.ok === false)

  s.dirty = true
  s.flush()
  const onDisk = fs.readFileSync(historyFile, 'utf8')
  ok('disk holds no plaintext', !onDisk.includes('hunter2'))
  ok('disk holds the ciphertext', onDisk.includes('"sealed"'))

  const reopened = new Store(dir)
  ok('ciphertext survives a reload', reopened.revealText(reopened.get('t1')) === SECRET)

  const off = reopened.toggleSeal('t1', false)
  const back = reopened.get('t1')
  ok('unseal returns ok', off.ok && off.sealed === false)
  ok('text comes back', back.text === SECRET)
  ok('sealed flag cleared', back.sealed === null)
  ok('mask removed', back.sensitive === null && back.sensitiveLabel === null)

  fs.rmSync(dir, { recursive: true, force: true })
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
  app.exit(failures ? 1 : 0)
})
