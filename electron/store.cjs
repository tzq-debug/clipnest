'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const { Vault, encrypt, decrypt, isEncrypted } = require('./vault.cjs')

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
  sensitiveEnabled: true,
  sensitivePolicy: 'seal',
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
    this.encryptedFile = path.join(dir, 'history.enc')
    this.settingsFile = path.join(dir, 'settings.json')
    fs.mkdirSync(this.imagesDir, { recursive: true })

    this.vault = new Vault(dir)
    this.key = null
    this.items = []
    this.settings = { ...DEFAULT_SETTINGS, ...safeRead(this.settingsFile, {}) }
    this.saveTimer = null
    this.dirty = false

    if (!this.vault.enabled) this.loadPlaintext()
  }

  /* ---------- vault ---------- */

  get locked() {
    return this.vault.enabled && !this.key
  }

  loadPlaintext() {
    const saved = safeRead(this.historyFile, { items: [] })
    this.items = Array.isArray(saved.items) ? saved.items : []
  }

  /** Open the vault with an already verified key and load the history. */
  unlock(key) {
    this.key = key
    if (fs.existsSync(this.encryptedFile)) {
      const data = JSON.parse(decrypt(key, fs.readFileSync(this.encryptedFile)).toString('utf8'))
      this.items = Array.isArray(data.items) ? data.items : []
    } else {
      this.items = []
    }
    this.dirty = false
    return this.items.length
  }

  lock() {
    this.flush()
    this.key = null
    this.items = []
    this.dirty = false
  }

  /** Encrypt everything that is currently on disk, then switch the vault on. */
  enableEncryption(password) {
    if (this.vault.enabled) return { ok: false, message: '加密已经开启' }
    const key = this.vault.create(password)
    this.key = key
    this.encryptExistingImages(key)
    this.dirty = true
    this.flush()
    try {
      fs.unlinkSync(this.historyFile)
    } catch {
      /* already gone */
    }
    return { ok: true }
  }

  /** Decrypt everything back to plain files and switch the vault off. */
  disableEncryption(password) {
    if (!this.vault.enabled) return { ok: false, message: '加密没有开启' }
    const key = this.vault.unlock(password)
    if (!key) return { ok: false, message: '密码不对' }
    this.key = key
    for (const name of this.imageFiles()) {
      const file = path.join(this.imagesDir, name)
      const raw = fs.readFileSync(file)
      if (isEncrypted(raw)) fs.writeFileSync(file, decrypt(key, raw))
    }
    this.vault.disable()
    this.dirty = true
    this.flush()
    try {
      fs.unlinkSync(this.encryptedFile)
    } catch {
      /* already gone */
    }
    this.key = null
    return { ok: true }
  }

  imageFiles() {
    try {
      return fs.readdirSync(this.imagesDir).filter((n) => !n.endsWith('.tmp'))
    } catch {
      return []
    }
  }

  encryptExistingImages(key) {
    for (const name of this.imageFiles()) {
      const file = path.join(this.imagesDir, name)
      try {
        const raw = fs.readFileSync(file)
        if (!isEncrypted(raw)) fs.writeFileSync(file, encrypt(key, raw))
      } catch {
        /* skip unreadable files */
      }
    }
  }

  writeImageFile(name, buffer) {
    const data = this.vault.enabled && this.key ? encrypt(this.key, buffer) : buffer
    fs.writeFileSync(path.join(this.imagesDir, name), data)
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
    if (item.big) files.push(path.join(this.imagesDir, item.big))
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
    if (this.locked) return // never overwrite the vault with an empty list
    this.dirty = false
    const json = JSON.stringify({ version: 1, items: this.items })
    try {
      if (this.vault.enabled) {
        if (!this.key) return
        atomicWrite(this.encryptedFile, encrypt(this.key, Buffer.from(json)))
      } else {
        atomicWrite(this.historyFile, json)
      }
    } catch (err) {
      this.dirty = true
      console.error('[clipnest] failed to persist history', err)
    }
  }

  /* ---------- sensitive content ---------- */

  /** True when the OS can protect a small blob for this user (DPAPI / Keychain). */
  canSeal() {
    try {
      return require('electron').safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  /** Encrypt one item's text with the OS key, without asking for a password. */
  seal(plain) {
    if (!this.canSeal()) return null
    try {
      return require('electron').safeStorage.encryptString(plain).toString('base64')
    } catch {
      return null
    }
  }

  /** Plain text of an item, decrypting it when it was sealed. */
  revealText(item) {
    if (!item) return ''
    if (!item.sealed) return item.text || ''
    try {
      return require('electron').safeStorage.decryptString(Buffer.from(item.sealed, 'base64'))
    } catch {
      return ''
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
    this.writeImageFile(file, buffer)

    let thumb = null
    try {
      const tw = Math.min(360, size.width)
      const resized = tw < size.width ? image.resize({ width: tw, quality: 'good' }) : image
      thumb = `${id}.thumb.png`
      this.writeImageFile(thumb, resized.toPNG())
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

  /** Build a thumbnail + a larger preview for an image file that lives outside our
   *  own storage (e.g. a screenshot copied from Explorer as a file drop). */
  saveThumbFromFile(filePath) {
    const { nativeImage } = require('electron')
    try {
      const buf = fs.readFileSync(filePath)
      const image = nativeImage.createFromBuffer(buf)
      if (image.isEmpty()) return null
      const size = image.getSize()
      if (size.width < 2 || size.height < 2) return null

      const id = Store.newId()
      const thumb = `${id}.thumb.png`
      const big = `${id}.big.png`
      const fit = (max) => (size.width > max ? image.resize({ width: max, quality: 'good' }) : image)

      this.writeImageFile(thumb, fit(360).toPNG())
      this.writeImageFile(big, fit(1400).toPNG())

      return { thumb, big, width: size.width, height: size.height }
    } catch {
      return null
    }
  }

  readImageAsset(fileName) {
    if (!fileName) return null
    try {
      const raw = fs.readFileSync(path.join(this.imagesDir, fileName))
      let buf = raw
      if (isEncrypted(raw)) {
        if (!this.key) return null
        buf = decrypt(this.key, raw)
      }
      return `data:image/png;base64,${buf.toString('base64')}`
    } catch {
      return null
    }
  }
}

module.exports = { Store, DEFAULT_SETTINGS }
