'use strict'

const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  screen,
  nativeImage,
  shell,
  dialog
} = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const { Store } = require('./store.cjs')
const { createWatcher } = require('./watcher.cjs')
const { writeOne, writeMerged, pasteKeystroke, sleep } = require('./paste.cjs')
const { suggestedName, writeExport } = require('./export.cjs')
const { resolveDragFile } = require('./drag.cjs')

const IS_DEV = Boolean(process.env.VITE_DEV_SERVER_URL)

const DOCK = { width: 26, height: 152 }
const PANEL = { width: 428, height: 640 }
const PALETTE = { width: 520, height: 648 }

let win = null
let tray = null
let store = null
let watcher = null
let view = 'collapsed'
let locked = false
let quitting = false
let hotkeyOk = true
let animTimer = null
let pendingTimer = null
let collapseTimer = null
let pushTimer = null
let modalOpen = false
let nativeDialog = false
/** True from the moment a drag starts until the drop has settled. */
let dragging = false
let vaultLocked = false

if (process.platform === 'win32') app.setAppUserModelId('com.clipnest.app')

// A tiny always-on-top overlay gains nothing from GPU compositing, and software
// rendering avoids the whole class of driver/VM crashes that hit transparent windows.
if (!process.argv.includes('--enable-gpu')) app.disableHardwareAcceleration()

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) showPalette()
  })
}

/* ------------------------------------------------------------------ assets */

function readAsset(name) {
  try {
    return fs.readFileSync(path.join(__dirname, '..', 'assets', name))
  } catch {
    return null
  }
}

function assetImage(name) {
  const buf = readAsset(name)
  return buf ? nativeImage.createFromBuffer(buf) : nativeImage.createEmpty()
}

/* ------------------------------------------------------------------ geometry */

function boundsFor(target) {
  const primary = screen.getPrimaryDisplay().workArea

  if (target === 'collapsed') {
    return {
      width: DOCK.width,
      height: DOCK.height,
      x: primary.x + primary.width - DOCK.width,
      y: primary.y + Math.round(primary.height / 2 - DOCK.height / 2)
    }
  }

  if (target === 'expanded') {
    const h = Math.min(PANEL.height, primary.height - 32)
    return {
      width: PANEL.width,
      height: h,
      x: primary.x + primary.width - PANEL.width - 6,
      y: primary.y + Math.round((primary.height - h) / 2)
    }
  }

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const wa = display.workArea
  const w = Math.min(PALETTE.width, wa.width - 48)
  const h = Math.min(PALETTE.height, wa.height - 96)
  return {
    width: w,
    height: h,
    x: wa.x + Math.round((wa.width - w) / 2),
    y: wa.y + Math.round(Math.max(48, (wa.height - h) / 2 - 40))
  }
}

function animateTo(target, done) {
  if (!win || win.isDestroyed()) return
  if (animTimer) {
    clearInterval(animTimer)
    animTimer = null
  }
  const start = win.getBounds()
  const steps = 11
  let i = 0
  const ease = (t) => 1 - Math.pow(1 - t, 3)

  animTimer = setInterval(() => {
    if (!win || win.isDestroyed()) {
      clearInterval(animTimer)
      animTimer = null
      return
    }
    i += 1
    const k = ease(i / steps)
    win.setBounds({
      x: Math.round(start.x + (target.x - start.x) * k),
      y: Math.round(start.y + (target.y - start.y) * k),
      width: Math.round(start.width + (target.width - start.width) * k),
      height: Math.round(start.height + (target.height - start.height) * k)
    })
    if (i >= steps) {
      clearInterval(animTimer)
      animTimer = null
      win.setBounds(target)
      if (done) done()
    }
  }, 14)
}

/* ------------------------------------------------------------------ state */

function publicItem(item) {
  return {
    id: item.id,
    type: item.type,
    isImage: Boolean(item.isImage),
    preview: item.type === 'text' && !item.sealed ? item.text.slice(0, 2400) : '',
    sensitive: item.sensitive || null,
    sensitiveLabel: item.sensitiveLabel || null,
    sealed: Boolean(item.sealed),
    chars: item.chars || 0,
    files: item.files || null,
    image: item.image || null,
    thumb: item.thumb || null,
    big: item.big || null,
    width: item.width || 0,
    height: item.height || 0,
    bytes: item.bytes || 0,
    createdAt: item.createdAt,
    pinned: Boolean(item.pinned),
    starred: Boolean(item.starred)
  }
}

function statePayload() {
  return {
    view,
    locked: vaultLocked,
    items: vaultLocked ? [] : store.all().filter((it) => it.type !== 'image' || it.image).map(publicItem),
    settings: store.settings,
    encrypted: store.vault.enabled,
    hotkeyOk,
    version: app.getVersion(),
    platform: process.platform,
    dataDir: app.getPath('userData')
  }
}

function pushState(nextView) {
  if (!win || win.isDestroyed()) return
  if (nextView) view = nextView
  if (pushTimer) return
  pushTimer = setTimeout(() => {
    pushTimer = null
    if (!win || win.isDestroyed()) return
    win.webContents.send('state', statePayload())
  }, 40)
}

/* ------------------------------------------------------------------ views */

function clearTimers() {
  if (collapseTimer) clearTimeout(collapseTimer)
  if (pendingTimer) clearTimeout(pendingTimer)
  collapseTimer = null
  pendingTimer = null
}

function expandPanel({ focus = true } = {}) {
  if (!win) return
  clearTimers()
  view = 'expanded'
  locked = false
  pushState()
  win.show()
  if (focus) win.focus()
  animateTo(boundsFor('expanded'))
}

function showPalette() {
  if (!win) return
  clearTimers()
  view = 'palette'
  locked = true
  pushState()
  win.setBounds(boundsFor('palette'))
  win.show()
  win.focus()
}

function collapsePanel({ dismiss = false } = {}) {
  if (!win) return
  clearTimers()
  view = 'collapsed'
  locked = false
  win.webContents.send('view:closing')

  pendingTimer = setTimeout(() => {
    if (!win || win.isDestroyed()) return
    if (view !== 'collapsed') return
    win.setBounds(boundsFor('collapsed'))
    if (dismiss || !store.settings.showDock) {
      win.hide()
    } else {
      win.showInactive()
    }
    pushState()
  }, 130)
}

function scheduleCollapse() {  if (view !== 'expanded' || locked) return
  if (collapseTimer) clearTimeout(collapseTimer)
  collapseTimer = setTimeout(() => {
    collapseTimer = null
    if (view === 'expanded' && !locked) collapsePanel()
  }, 320)
}

/** Drop the key, stop recording, and put the lock screen in front. */
function lockVault() {
  if (!store.vault.enabled) return
  if (watcher) watcher.stop()
  store.lock()
  vaultLocked = true
  if (view === 'collapsed') showPalette()
  pushState()
  if (tray) tray.setContextMenu(buildTrayMenu())
}

/* ------------------------------------------------------------------ window */

/** Stored pictures come back as data URLs; export and drag both need raw bytes. */
function readImageBuffer(name) {
  const dataUrl = store.readImageAsset(name)
  return dataUrl ? Buffer.from(dataUrl.split(',')[1], 'base64') : null
}

/** Where decrypted copies wait for a drag to pick them up. */
function dragTempDir() {
  return path.join(app.getPath('temp'), 'clipnest-drag')
}

/** Drag-and-drop needs a real file on disk; these copies are throwaway. */
function cleanDragTemp() {
  try {
    fs.rmSync(dragTempDir(), { recursive: true, force: true })
  } catch {
    /* nothing to clean */
  }
}

function createWindow() {
  const initial = boundsFor('collapsed')
  win = new BrowserWindow({
    ...initial,
    minWidth: DOCK.width,
    minHeight: DOCK.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    acceptFirstMouse: true,
    title: 'ClipNest',
    icon: assetImage('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (IS_DEV) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  win.once('ready-to-show', () => {
    if (vaultLocked) {
      showPalette()
      return
    }
    if (!store.settings.showDock) return
    win.showInactive()
  })

  win.on('blur', () => {
    // A native save dialog takes focus from us; collapsing here would hide the
    // panel (and dismiss the dialog in palette mode) mid-export.
    if (nativeDialog) return
    // Dragging towards another window is not the user leaving us.
    if (dragging) return
    if (view === 'expanded' || view === 'palette') collapsePanel({ dismiss: view === 'palette' })
  })

  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      win.hide()
    }
  })

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      if (modalOpen) return // the renderer owns Escape while a preview is open
      event.preventDefault()
      collapsePanel({ dismiss: view === 'palette' })
    }
  })
}

/* ------------------------------------------------------------------ tray */

function buildTrayMenu() {
  const items = store.all()
  return Menu.buildFromTemplate([
    { label: `ClipNest ${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    { label: '打开面板', accelerator: 'Return', click: () => showPalette() },
    { label: `已记录 ${items.length} 条`, enabled: false },
    { type: 'separator' },
    {
      label: '暂停记录',
      type: 'checkbox',
      checked: store.settings.paused,
      click: (mi) => {
        store.updateSettings({ paused: mi.checked })
        pushState()
      }
    },
    {
      label: '开机自动启动',
      type: 'checkbox',
      checked: store.settings.launchAtLogin,
      click: (mi) => {
        store.updateSettings({ launchAtLogin: mi.checked })
        app.setLoginItemSettings({ openAtLogin: mi.checked, args: ['--hidden'] })
        pushState()
      }
    },
    { type: 'separator' },
    {
      label: '锁定',
      enabled: store.vault.enabled && !vaultLocked,
      click: () => lockVault()
    },
    {
      label: '清空历史（保留收藏）',
      click: () => {
        store.clear(true)
        pushState()
        if (tray) tray.setContextMenu(buildTrayMenu())
      }
    },
    { label: '打开数据目录', click: () => shell.openPath(app.getPath('userData')) },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit() } }
  ])
}

function createTray() {
  const icon = assetImage('tray.png')
  tray = new Tray(icon)
  tray.setToolTip('ClipNest · 剪贴板历史')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', () => showPalette())
}

/* ------------------------------------------------------------------ shortcuts */

function registerShortcut(accel) {
  globalShortcut.unregisterAll()
  if (!accel) return false
  try {
    hotkeyOk = globalShortcut.register(accel, () => {
      if (view === 'palette') collapsePanel({ dismiss: true })
      else showPalette()
    })
  } catch {
    hotkeyOk = false
  }
  pushState()
  return hotkeyOk
}

/* ------------------------------------------------------------------ ipc */

function registerIpc() {
  ipcMain.handle('state:get', () => statePayload())

  /* ---------- vault ---------- */

  ipcMain.handle('vault:unlock', (_e, password) => {
    const key = store.vault.unlock(String(password || ''))
    if (!key) return { ok: false, message: '密码不对' }
    try {
      const count = store.unlock(key)
      vaultLocked = false
      watcher.start()
      setTimeout(backfillImageFiles, 900)
      pushState()
      return { ok: true, count }
    } catch (err) {
      return { ok: false, message: `解密失败：${err.message}` }
    }
  })

  ipcMain.handle('vault:lock', () => {
    if (!store.vault.enabled) return { ok: false }
    lockVault()
    return { ok: true }
  })

  ipcMain.handle('vault:enable', (_e, password) => {
    if (vaultLocked) return { ok: false, message: '请先解锁' }
    const pass = String(password || '')
    if (pass.length < 4) return { ok: false, message: '密码至少 4 位' }
    const res = store.enableEncryption(pass)
    pushState()
    if (tray) tray.setContextMenu(buildTrayMenu())
    return res
  })

  ipcMain.handle('vault:disable', (_e, password) => {
    const res = store.disableEncryption(String(password || ''))
    if (res.ok) {
      vaultLocked = false
      watcher.start()
      pushState()
      if (tray) tray.setContextMenu(buildTrayMenu())
    }
    return res
  })

  ipcMain.handle('view:set', (_e, next) => {
    if (next === 'expanded') expandPanel()
    else if (next === 'palette') showPalette()
    else if (next === 'collapsed') collapsePanel()
    return view
  })

  ipcMain.handle('view:hover', (_e, inside) => {
    if (inside) {
      clearTimers()
      // Expanding because the pointer touched the dock strip must not steal focus
      // from whatever the user is typing into.
      if (view === 'collapsed') expandPanel({ focus: false })
    } else {
      if (!dragging) scheduleCollapse()
    }
    return true
  })

  ipcMain.handle('view:dismiss', () => {
    collapsePanel({ dismiss: true })
    return true
  })

  ipcMain.handle('ui:modal', (_e, open) => {
    modalOpen = Boolean(open)
    return true
  })

  ipcMain.handle('item:pin', (_e, id, value) => {
    if (vaultLocked) return false
    store.togglePin(id, value)
    pushState()
    if (tray) tray.setContextMenu(buildTrayMenu())
    return true
  })

  ipcMain.handle('item:star', (_e, id, value) => {    if (vaultLocked) return false
    store.toggleStar(id, value)
    pushState()
    return true
  })

  ipcMain.handle('item:seal', (_e, id, value) => {
    if (vaultLocked) return { ok: false, message: '请先解锁' }
    const res = store.toggleSeal(id, value)
    if (res.ok) pushState()
    return res
  })

  /**
   * Hand a picture to another program as a real file drop. Electron can only
   * drag files that exist on disk, and a vault-encrypted picture is unreadable
   * outside the app, so those get a decrypted copy in a temp folder first.
   */
  ipcMain.handle('item:drag', (_e, id) => {
    const item = store.get(id)
    if (!item) return false

    const file = resolveDragFile(item, { tempDir: dragTempDir(), readImage: readImageBuffer })
    if (!file) return false

    const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png'))
    dragging = true
    try {
      win.webContents.startDrag({ file, icon: icon.isEmpty() ? undefined : icon.resize({ width: 64, height: 64 }) })
    } finally {
      // The drop hands focus to the window under the cursor, which fires blur on
      // us. Wait for that blur to arrive and be ignored, then collapse only if
      // we really are in the background.
      setTimeout(() => {
        dragging = false
        if (!win || win.isDestroyed() || win.isFocused() || view === 'collapsed') return
        collapsePanel({ dismiss: view === 'palette' })
      }, 900)
    }
    return true
  })

  ipcMain.handle('item:remove', (_e, id) => {
    if (vaultLocked) return false
    store.remove(id)
    pushState()
    return true
  })

  ipcMain.handle('item:reveal', (_e, id) => {
    const it = store.get(id)
    if (it && it.type === 'files' && it.files && it.files.length) {
      shell.showItemInFolder(it.files[0])
    }
    return true
  })

  ipcMain.handle('items:clear', (_e, keepStarred) => {
    if (vaultLocked) return { cleared: 0 }
    const keep = keepStarred !== false
    const cleared = store.all().filter((it) => !keep || !it.starred).length
    store.clear(keep)
    pushState()
    if (tray) tray.setContextMenu(buildTrayMenu())
    return { cleared }
  })

  /**
   * Export history to a file next to the user's chosen location. Markdown is
   * for handing content to someone, JSON is a complete backup; pictures go into
   * a sibling folder instead of being inlined so the result stays readable and
   * the file size stays sane.
   */
  ipcMain.handle('items:export', async (_e, payload = {}) => {
    if (vaultLocked) return { ok: false, message: '请先解锁' }

    const format = payload.format === 'json' ? 'json' : 'md'
    const ids = Array.isArray(payload.ids) ? payload.ids : []
    const items = ids.length ? ids.map((id) => store.get(id)).filter(Boolean) : store.all().slice()
    if (!items.length) return { ok: false, message: '没有可导出的内容' }

    let picked = { canceled: true }
    nativeDialog = true
    try {
      picked = await dialog.showSaveDialog(win, {
        title: format === 'json' ? '导出为 JSON 备份' : '导出为 Markdown',
        defaultPath: path.join(app.getPath('documents'), suggestedName(format)),
        filters:
          format === 'json'
            ? [{ name: 'JSON 备份', extensions: ['json'] }]
            : [{ name: 'Markdown', extensions: ['md'] }]
      })
    } finally {
      nativeDialog = false
    }

    const { canceled, filePath } = picked
    if (canceled || !filePath) return { ok: false, canceled: true }

    let file = filePath
    if (path.extname(file).toLowerCase() !== `.${format}`) file += `.${format}`

    try {
      const res = writeExport({
        items,
        file,
        format,
        version: app.getVersion(),
        readImage: readImageBuffer
      })
      return { ok: true, path: res.path, count: res.count, images: res.images }
    } catch (err) {
      return { ok: false, message: `写入失败：${err.message}` }
    }
  })

  ipcMain.handle('images:get', (_e, ids) => {
    const out = {}
    for (const id of ids || []) {
      const it = store.get(id)
      if (!it) continue
      const fullFile = it.type === 'image' ? it.image : it.big
      if (!it.thumb && !fullFile) continue
      out[id] = {
        thumb: store.readImageAsset(it.thumb || it.image),
        full: store.readImageAsset(fullFile)
      }
    }
    return out
  })

  ipcMain.handle('image:open', async (_e, id) => {
    const it = store.get(id)
    if (!it) return false
    const target =
      it.type === 'files' && it.files && it.files.length
        ? it.files[0]
        : it.type === 'image' && it.image
          ? path.join(store.imagesDir, it.image)
          : null
    if (!target) return false
    try {
      const err = await shell.openPath(target)
      return !err
    } catch {
      return false
    }
  })

  ipcMain.handle('copy', async (_e, payload) => {
    if (vaultLocked) return { ok: false, message: '请先解锁' }
    const ids = (payload && payload.ids) || []
    const mode = (payload && payload.mode) || 'merged'
    const items = ids
      .map((id) => store.get(id))
      .filter(Boolean)
      // sealed entries only carry ciphertext; decrypt on the way out
      .map((it) => (it.sealed ? { ...it, text: store.revealText(it) } : it))
    if (!items.length) return { ok: false, message: '没有可复制的内容' }

    if (mode === 'sequential') {
      if (process.platform === 'linux') {
        return { ok: false, message: '依次粘贴在 Linux 上需要安装 xdotool' }
      }
      collapsePanel({ dismiss: true })
      await sleep(260)
      let done = 0
      for (const item of items) {
        await writeOne(item, store.imagesDir)
        await sleep(80)
        pasteKeystroke()
        done += 1
        await sleep(store.settings.sequentialDelay)
      }
      await watcher.resync()
      return { ok: true, message: `已依次粘贴 ${done} 项`, count: done }
    }

    const result = await writeMerged(items, store.imagesDir, store.settings.mergeSeparator)
    if (store.settings.collapseOnCopy) collapsePanel({ dismiss: true })
    await watcher.resync()

    if (!result.ok) return { ok: false, message: '这些内容无法合并复制' }
    let message
    if (result.asFiles) message = `已复制 ${result.pasted} 个文件`
    else if (items.length === 1) message = '已复制，按 Ctrl+V 粘贴'
    else message = `已合并 ${result.pasted} 项，按 Ctrl+V 粘贴`
    if (result.skipped) message += `（${result.skipped} 张图片已跳过）`
    return { ok: true, message, count: items.length }
  })

  ipcMain.handle('settings:update', (_e, patch) => {
    const next = store.updateSettings(patch || {})
    if (patch && typeof patch.shortcut === 'string') registerShortcut(next.shortcut)
    if (patch && typeof patch.showDock === 'boolean' && !patch.showDock && view === 'collapsed' && win) {
      win.hide()
    }
    pushState()
    if (tray) tray.setContextMenu(buildTrayMenu())
    return { settings: store.settings, hotkeyOk }
  })

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    dataDir: app.getPath('userData'),
    platform: process.platform,
    electron: process.versions.electron
  }))

  ipcMain.handle('app:openData', () => shell.openPath(app.getPath('userData')))

  ipcMain.handle('app:quit', () => {
    quitting = true
    app.quit()
  })
}

/* ------------------------------------------------------------------ boot */

/**
 * Records captured before image-file detection existed (or while "capture images"
 * was off) are still plain file items. Give them a thumbnail so screenshots taken
 * earlier show up under the picture filter too.
 */
function backfillImageFiles() {
  if (vaultLocked) return
  const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|tiff?|avif)$/i
  let changed = false
  for (const item of store.all()) {
    if (item.type !== 'files' || item.thumb || !item.files || !item.files.length) continue
    if (!item.files.every((f) => IMAGE_RE.test(f))) continue
    const asset = store.saveThumbFromFile(item.files[0])
    if (!asset) continue
    Object.assign(item, {
      isImage: true,
      thumb: asset.thumb,
      big: asset.big,
      width: asset.width,
      height: asset.height
    })
    changed = true
  }
  if (changed) {
    store.scheduleSave()
    pushState()
  }
}

app.whenReady().then(() => {
  cleanDragTemp()
  store = new Store(app.getPath('userData'))
  vaultLocked = store.vault.enabled

  if (process.argv.includes('--hidden') && !store.settings.showDock) {
    // started by the login item, stay quiet
  }

  createWindow()
  createTray()
  registerShortcut(store.settings.shortcut)
  registerIpc()

  watcher = createWatcher({
    store,
    onChange: (_item) => {
      pushState()
      if (tray) tray.setContextMenu(buildTrayMenu())
    }
  })

  if (!vaultLocked) {
    watcher.start()
    setTimeout(backfillImageFiles, 900)
  }

  screen.on('display-metrics-changed', () => {
    if (!win || win.isDestroyed()) return
    const target = view === 'collapsed' ? 'collapsed' : view === 'palette' ? 'palette' : 'expanded'
    win.setBounds(boundsFor(target))
  })

  app.on('activate', () => {
    if (!win || win.isDestroyed()) createWindow()
    else showPalette()
  })
})

app.on('window-all-closed', () => {
  // Keep running in the tray; the app only exits from the tray menu or Cmd+Q.
})

app.on('before-quit', () => {
  quitting = true
  if (watcher) watcher.stop()
  if (store) store.flush()
  globalShortcut.unregisterAll()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
