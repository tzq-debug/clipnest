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

  if (scenario === 'click') {
    await win.webContents.executeJavaScript(`
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
