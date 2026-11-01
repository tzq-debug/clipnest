'use strict'

/* Dev-only UI harness: opens the built renderer in a plain window with mock data
 * and writes screenshots to .preview-*.png. Usage:
 *   npx electron scripts/preview.cjs [scenario]
 * Scenarios: list (default), selected, settings, dock */

const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow } = require('electron')

app.disableHardwareAcceleration()

const ROOT = path.join(__dirname, '..')
const scenario = process.argv[2] || 'list'

if (scenario === 'lock') process.env.CLIPNEST_PREVIEW_LOCKED = '1'
if (scenario === 'encrypted') process.env.CLIPNEST_PREVIEW_ENCRYPTED = '1'

const SIZES = {
  dock: { width: 26, height: 152 },
  default: { width: 520, height: 648 }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  const size = SIZES[scenario] || SIZES.default
  const win = new BrowserWindow({
    width: size.width,
    height: size.height,
    show: true,
    frame: false,
    backgroundColor: scenario === 'dock' ? '#e8eef5' : '#eceef2',
    webPreferences: {
      preload: path.join(__dirname, 'preview-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  await win.loadFile(path.join(ROOT, 'dist', 'index.html'))
  await wait(700)

  win.webContents.on('console-message', (...args) => {
    const first = args[0]
    const msg = (first && first.message) || args[2]
    if (typeof msg === 'string' && msg.includes('[mock-copy]')) console.log('RENDERER>', msg)
  })

  if (scenario === 'lock') {
    await win.webContents.executeJavaScript(`document.querySelector('.lock-input')?.focus()`)
    await wait(500)
  }

  if (scenario === 'encrypted') {
    await win.webContents.executeJavaScript(`document.querySelector('[title="设置"]').click()`)
    await wait(300)
    await win.webContents.executeJavaScript(`
      const rows = document.querySelectorAll('.row')
      for (const r of rows) { if (r.textContent.includes('加密历史')) r.scrollIntoView({ block: 'center' }) }
      'scrolled'
    `)
    await wait(400)
  }

  if (scenario === 'clear') {
    await win.webContents.executeJavaScript(`document.querySelector('.icon-btn[aria-label="清理历史"]').click()`)
    await wait(250)
    const armed = await win.webContents.executeJavaScript(
      `document.querySelector('.icon-btn.armed') ? 'armed' : 'not armed'`
    )
    await win.webContents.executeJavaScript(`document.querySelector('.icon-btn[aria-label="清理历史"]').click()`)
    await wait(500)
    console.log('first click:', armed)
  }

  if (scenario === 'select') {
    await win.webContents.executeJavaScript(`
      document.querySelector('.filter.multi').click()
    `)
    await wait(250)
    await win.webContents.executeJavaScript(`
      ;[1, 3, 4].forEach((i) => {
        const c = document.querySelectorAll('.card')[i]
        c && c.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      })
      'selected'
    `)
    await wait(400)
  }

  if (scenario === 'button') {
    const res = await win.webContents.executeJavaScript(`
      const card = document.querySelectorAll('.card')[5]
      const btn = card.querySelectorAll('.card-actions button')[1]
      const rect = btn.getBoundingClientRect()
      const opts = { bubbles: true, clientX: rect.x + 2, clientY: rect.y + 2 }
      btn.dispatchEvent(new MouseEvent('mousedown', opts))
      btn.dispatchEvent(new MouseEvent('mouseup', opts))
      btn.click()
      card.querySelector('.card-text, .card-filename')?.textContent.slice(0, 30) || 'clicked'
    `)
    console.log('card says:', res)
    await wait(500)
  }

  if (scenario === 'preview') {
    await win.webContents.executeJavaScript(`
      const im = document.querySelectorAll('.card-image')[0]
      if (im) {
        im.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        im.click()
      }
      'opened preview'
    `)
    await wait(600)
  }

  if (scenario === 'click') {    await win.webContents.executeJavaScript(`
      const cards = document.querySelectorAll('.card')
      cards[4].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      'clicked card 4'
    `)
    await wait(500)
  }

  if (scenario === 'selected') {
    await win.webContents.executeJavaScript(
      `document.querySelectorAll('.check').forEach((b, i) => { if ([0, 4, 5].includes(i)) b.click() })`
    )
    await wait(300)
  }

  if (scenario === 'settings') {
    await win.webContents.executeJavaScript(`document.querySelector('[title="设置"]').click()`)
    await wait(300)
  }

  if (scenario === 'dock') {
    await win.webContents.executeJavaScript(`window.clipnest.setView('collapsed')`)
    await wait(500)
  }

  const img = await win.capturePage()
  const out = path.join(ROOT, `.preview-${scenario}.png`)
  fs.writeFileSync(out, img.toPNG())
  console.log('saved', out, img.getSize())
  app.quit()
})
