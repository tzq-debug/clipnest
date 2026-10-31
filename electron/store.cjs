'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const DEFAULT_SETTINGS = {
  maxItems: 500,
  paused: false,
  captureImages: true,
  captureFiles: true,
  maxTextLength: 20000,
  ignoreKeywords: [],
  shortcut: 'Control+Shift+V',
  collapseOnCopy: true,
  sequentialDelay: 380,
  mergeSeparator: 'newline',
  showDock: true,
  launchAtLogin: false,
  theme: 'system',
  onboarded: false
}

function safeRead(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function atomicWrite(file, data) {
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, file)
}

class Store {
  constructor(dir) {
    this.dir = dir
    this.imagesDir = path.join(dir, 'images')
    this.historyFile = path.join(dir, 'history.json')
    this.settingsFile = path.join(dir, 'settings.json')
    fs.mkdirSync(this.imagesDir, { recursive: true })

    const saved = safeRead(this.historyFile, { items: [] })
    this.items = Array.isArray(saved.items) ? saved.items : []
    this.settings = { ...DEFAULT_SETTINGS, ...safeRead(this.settingsFile, {}) }
    this.saveTimer = null
    this.dirty = false
  }

  /* ---------- settings ---------- */

  updateSettings(patch) {
    this.settings = { ...this.settings, ...patch }
    atomicWrite(this.settingsFile, JSON.stringify(this.settings, null, 2))
    return this.settings
  }

  /* ---------- items ---------- */

  all() {
    return this.items
  }

  get(id) {
    return this.items.find((it) => it.id === id) || null
  }

  findByHash(hash) {
    return this.items.find((it) => it.hash === hash) || null
  }

  add(item) {
    const existing = this.findByHash(item.hash)
    if (existing) {
      existing.createdAt = Date.now()
      this.moveToFront(existing.id)
      this.scheduleSave()
      return { item: existing, isNew: false }
    }
    this.items.unshift(item)
    this.trim()
    this.scheduleSave()
    return { item, isNew: true }
  }

  moveToFront(id) {
    const i = this.items.findIndex((it) => it.id === id)
    if (i > 0) {
      const [it] = this.items.splice(i, 1)
      this.items.unshift(it)
    }
  }

  togglePin(id, value) {
    const it = this.get(id)
    if (!it) return null
    it.pinned = typeof value === 'boolean' ? value : !it.pinned
    this.scheduleSave()
    return it
  }

  remove(id) {
    const i = this.items.findIndex((it) => it.id === id)
    if (i === -1) return false
    const [it] = this.items.splice(i, 1)
    this.dropAssets(it)
    this.scheduleSave()
    return true
  }

  clear(keepPinned = true) {
    const keep = keepPinned ? this.items.filter((it) => it.pinned) : []
    const drop = keepPinned ? this.items.filter((it) => !it.pinned) : this.items
    drop.forEach((it) => this.dropAssets(it))
    this.items = keep
    this.scheduleSave()
  }

  trim() {
    const max = Math.max(20, this.settings.maxItems | 0)
    while (this.items.length > max) {
      let idx = -1
      for (let i = this.items.length - 1; i >= 0; i--) {
        if (!this.items[i].pinned) {
          idx = i
          break
        }
      }
      if (idx === -1) break
      const [it] = this.items.splice(idx, 1)
      this.dropAssets(it)
    }
  }

  dropAssets(item) {
    const files = []
    if (item.image) files.push(path.join(this.imagesDir, item.image))
    if (item.thumb) files.push(path.join(this.imagesDir, item.thumb))
    files.forEach((f) => {
      try {
        fs.unlinkSync(f)
      } catch {
        /* ignore */
      }
    })
  }

  scheduleSave() {
    this.dirty = true
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.flush()
    }, 400)
  }

  flush() {
    if (!this.dirty) return
    this.dirty = false
    try {
      atomicWrite(this.historyFile, JSON.stringify({ version: 1, items: this.items }))
    } catch (err) {
      console.error('[clipnest] failed to persist history', err)
    }
  }

  /* ---------- capture helpers ---------- */

  static newId() {
    return crypto.randomBytes(8).toString('hex')
  }

  static hashOf(prefix, payload) {
    const h = crypto.createHash('sha1').update(prefix)
    h.update(payload)
    return h.digest('hex')
  }

  saveImageBuffer(buffer) {
    const { nativeImage } = require('electron')
    const id = Store.newId()
    const image = nativeImage.createFromBuffer(buffer)
    const size = image.getSize()

    const file = `${id}.png`
    fs.writeFileSync(path.join(this.imagesDir, file), buffer)

    let thumb = null
    try {
      const tw = Math.min(360, size.width)
      const resized = tw < size.width ? image.resize({ width: tw, quality: 'good' }) : image
      thumb = `${id}.thumb.png`
      fs.writeFileSync(path.join(this.imagesDir, thumb), resized.toPNG())
    } catch {
      thumb = null
    }

    return {
      id,
      image: file,
      thumb,
      width: size.width,
      height: size.height,
      bytes: buffer.length
    }
  }

  readImageAsset(fileName) {
    if (!fileName) return null
    try {
      const buf = fs.readFileSync(path.join(this.imagesDir, fileName))
      return `data:image/png;base64,${buf.toString('base64')}`
    } catch {
      return null
    }
  }
}

module.exports = { Store, DEFAULT_SETTINGS }
