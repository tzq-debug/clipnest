'use strict'

const { clipboard, nativeImage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const { Store } = require('./store.cjs')

/**
 * Poll-based clipboard watcher.
 *
 * Electron exposes no clipboard "changed" event, so we diff against the last
 * captured payload on a fixed interval. The same code path works on every
 * platform because Electron normalises the OS clipboard into MIME types.
 */

const KNOWN_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/bmp', 'image/tiff', 'image/webp']
const IMAGE_FILE_RE = /\.(png|jpe?g|gif|webp|bmp|tiff?|avif)$/i

function parseUriList(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      if (!line.startsWith('file://')) return null
      try {
        let p = decodeURIComponent(new URL(line).pathname)
        if (/^\/[a-zA-Z]:\//.test(p)) p = p.slice(1)
        return path.normalize(p)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function createWatcher({ store, onChange, interval = 420 }) {
  let baseline = ''
  let lastImageSize = -1
  let busy = false
  let timer = null
  let lastError = null

  function ignored(text) {
    const keywords = store.settings.ignoreKeywords || []
    const lower = text.toLowerCase()
    return keywords.some((k) => k && lower.includes(k.toLowerCase()))
  }

  async function readTextType(item, mime) {
    try {
      if (!item.types.includes(mime)) return ''
      const blob = await item.getType(mime)
      return await blob.text()
    } catch {
      return ''
    }
  }

  async function capture() {
    const settings = store.settings
    const items = await clipboard.read()
    const item = items && items[0]
    if (!item || !item.types) return null
    const types = item.types

    // 1. Files copied from Explorer / Finder
    if (settings.captureFiles && types.includes('text/uri-list')) {
      const raw = await readTextType(item, 'text/uri-list')
      const files = parseUriList(raw)
      if (files.length) {
        const hash = Store.hashOf('f:', files.join('\n'))
        if (hash === baseline) return null
        baseline = hash
        let bytes = 0
        for (const f of files) {
          try {
            bytes += fs.statSync(f).size
          } catch {
            /* the file may already be gone */
          }
        }

        // Screenshot tools often put a .png *file* on the clipboard instead of raw
        // image data, so image files get a thumbnail and are grouped with pictures.
        let extra = {}
        const imageFiles = files.filter((f) => IMAGE_FILE_RE.test(f))
        if (settings.captureImages && imageFiles.length) {
          const asset = store.saveThumbFromFile(imageFiles[0])
          if (asset) {
            extra = {
              isImage: imageFiles.length === files.length,
              thumb: asset.thumb,
              big: asset.big,
              width: asset.width,
              height: asset.height
            }
          }
        }

        return {
          id: Store.newId(),
          type: 'files',
          files,
          bytes,
          hash,
          createdAt: Date.now(),
          pinned: false,
          ...extra
        }
      }
    }

    // 2. Text, with rich variants when the source app provides them.
    //    An empty text/plain must not swallow an image sitting on the same clipboard.
    if (types.includes('text/plain')) {
      const text = await readTextType(item, 'text/plain')
      if (text && text.trim().length) {
        const hash = Store.hashOf('t:', text)
        if (text.length > settings.maxTextLength || ignored(text)) {
          baseline = hash
          return null
        }
        if (hash === baseline) return null
        baseline = hash

        const html = types.includes('text/html') ? await readTextType(item, 'text/html') : ''
        const rtf = types.includes('text/rtf') ? await readTextType(item, 'text/rtf') : ''

        return {
          id: Store.newId(),
          type: 'text',
          text,
          html: html && html.length < 200000 ? html : null,
          rtf: rtf && rtf.length < 200000 ? rtf : null,
          chars: text.length,
          hash,
          createdAt: Date.now(),
          pinned: false
        }
      }
    }

    // 3. Images
    if (settings.captureImages) {
      const mime = KNOWN_IMAGE_TYPES.find((m) => types.includes(m))
      if (!mime) return null
      const blob = await item.getType(mime)

      // Fast path: the same blob is still sitting on the clipboard, don't
      // decode several megabytes every tick just to hash them again.
      if (blob.size === lastImageSize) return null

      const buf = Buffer.from(await blob.arrayBuffer())
      const probe = nativeImage.createFromBuffer(buf)
      if (probe.isEmpty()) return null
      const size = probe.getSize()
      if (size.width < 2 || size.height < 2) return null

      const hash = Store.hashOf('i:', buf)
      lastImageSize = blob.size
      if (hash === baseline) return null
      baseline = hash

      const asset = store.saveImageBuffer(buf)
      return {
        id: asset.id,
        type: 'image',
        image: asset.image,
        thumb: asset.thumb,
        width: asset.width,
        height: asset.height,
        bytes: asset.bytes,
        hash,
        createdAt: Date.now(),
        pinned: false
      }
    }

    return null
  }

  async function tick() {
    if (busy || store.settings.paused) return
    busy = true
    try {
      const item = await capture()
      if (item) {
        const { item: saved } = store.add(item)
        onChange(saved)
      }
      lastError = null
    } catch (err) {
      const msg = String((err && err.message) || err)
      if (msg !== lastError) {
        lastError = msg
        console.error('[clipnest] clipboard read failed:', msg)
      }
    } finally {
      busy = false
    }
  }

  return {
    start() {
      if (timer) return
      timer = setInterval(tick, interval)
      tick()
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
    /** Forget what is on the clipboard now, so our own writes are not re-captured. */
    async resync() {
      lastImageSize = -1
      try {
        const items = await clipboard.read()
        const item = items && items[0]
        if (!item || !item.types) return
        if (item.types.includes('text/uri-list')) {
          const files = parseUriList(await readTextType(item, 'text/uri-list'))
          if (files.length) {
            baseline = Store.hashOf('f:', files.join('\n'))
            return
          }
        }
        if (item.types.includes('text/plain')) {
          const text = await readTextType(item, 'text/plain')
          if (text.trim().length) {
            baseline = Store.hashOf('t:', text)
            return
          }
        }
        const mime = KNOWN_IMAGE_TYPES.find((m) => item.types.includes(m))
        if (mime) {
          const blob = await item.getType(mime)
          const buf = Buffer.from(await blob.arrayBuffer())
          lastImageSize = blob.size
          baseline = Store.hashOf('i:', buf)
        }
      } catch {
        /* ignore */
      }
    }
  }
}

module.exports = { createWatcher }
