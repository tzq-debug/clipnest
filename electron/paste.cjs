'use strict'

const { clipboard, ClipboardItem, nativeImage } = require('electron')
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const SEPARATORS = {
  newline: '\n',
  blank: '\n\n',
  space: ' ',
  none: ''
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function existingFiles(paths) {
  return paths.filter((p) => {
    try {
      return fs.statSync(p).isFile()
    } catch {
      return false
    }
  })
}

function toFileUri(p) {
  const unix = p.replace(/\\/g, '/')
  return `file:///${encodeURI(unix).replace(/^file:\/\/\//, '')}`
}

/**
 * Put a real file drop list on the clipboard.
 *
 * Explorer only pastes files when CF_HDROP is present, and Electron's clipboard
 * API cannot produce that format, so on Windows we delegate to PowerShell's
 * Set-Clipboard -Path. Elsewhere we fall back to text/uri-list, which Finder and
 * most Linux file managers understand.
 */
async function writeFileList(paths) {
  const usable = existingFiles(paths)
  if (!usable.length) return false

  if (process.platform === 'win32') {
    const quoted = usable.map((p) => `'${p.replace(/'/g, "''")}'`).join(',')
    const script = `Set-Clipboard -LiteralPath @(${quoted}) -ErrorAction Stop`
    const res = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Sta', '-Command', script], {
      windowsHide: true,
      timeout: 8000
    })
    if (res.status === 0) {
      try {
        const items = await clipboard.read()
        if (items[0] && items[0].types.includes('text/uri-list')) return true
      } catch {
        /* fall through */
      }
    }
  }

  try {
    await clipboard.write([new ClipboardItem({ 'text/uri-list': usable.map(toFileUri).join('\r\n') })])
    return true
  } catch {
    return false
  }
}

/** Copy an image as *both* a bitmap and a file drop.
 *
 *  Image data alone is not enough on Windows: apps that accept a dropped file
 *  (chat windows, Explorer, mail clients) may show nothing for a bare bitmap,
 *  while Paint/Word want the bitmap and ignore the file. Putting both formats on
 *  one clipboard entry means either paste target sees something it understands. */
async function writeImageBoth(filePath, pngBuffer) {
  const payload = { 'image/png': new Blob([pngBuffer], { type: 'image/png' }) }
  if (filePath && fs.existsSync(filePath)) payload['text/uri-list'] = toFileUri(filePath)
  try {
    await clipboard.write([new ClipboardItem(payload)])
    return true
  } catch {
    return false
  }
}

function toPng(filePath) {
  const buf = fs.readFileSync(filePath)
  if (/\.png$/i.test(filePath)) return buf
  const img = nativeImage.createFromBuffer(buf)
  return img.isEmpty() ? buf : img.toPNG()
}

/** A stored image (we keep every captured picture as a .png in userData). */
async function writeImageFile(item, imagesDir) {
  try {
    const filePath = path.join(imagesDir, item.image)
    return await writeImageBoth(filePath, toPng(filePath))
  } catch {
    return false
  }
}

/** An image that is still sitting in its original location on disk. */
async function writeImagePath(filePath) {
  try {
    return await writeImageBoth(filePath, toPng(filePath))
  } catch {
    return false
  }
}

async function writeOne(item, imagesDir) {
  if (item.type === 'text') {
    const payload = { 'text/plain': item.text }
    if (item.html) payload['text/html'] = item.html
    if (item.rtf) payload['text/rtf'] = item.rtf
    try {
      await clipboard.write([new ClipboardItem(payload)])
      return true
    } catch {
      await clipboard.writeText(item.text)
      return true
    }
  }
  if (item.type === 'image') return writeImageFile(item, imagesDir)
  if (item.type === 'files') {
    // A single picture file goes out as bitmap + file, so it pastes anywhere.
    if (item.isImage && item.files.length === 1 && (await writeImagePath(item.files[0]))) return true
    if (await writeFileList(item.files)) return true
    await clipboard.writeText(item.files.join('\n'))
    return true
  }
  return false
}

async function writeText(text, html) {
  const payload = { 'text/plain': text }
  if (html) payload['text/html'] = html
  try {
    await clipboard.write([new ClipboardItem(payload)])
  } catch {
    await clipboard.writeText(text)
  }
}

async function writeMerged(items, imagesDir, separatorSetting) {
  const sep = SEPARATORS[separatorSetting] ?? '\n'
  const texts = items.filter((it) => it.type === 'text')
  const fileItems = items.filter((it) => it.type === 'files')
  const images = items.filter((it) => it.type === 'image')

  // A single image is the only case where the merged clipboard can hold a picture.
  if (!texts.length && !fileItems.length && images.length === 1) {
    const ok = await writeImageFile(images[0], imagesDir)
    return { ok, pasted: 1, skipped: 0, asFiles: false }
  }

  // Pure file selection -> real drop list so it can be pasted into a folder
  if (!texts.length && images.length === 0 && fileItems.length) {
    const all = fileItems.flatMap((it) => it.files)
    if (all.length === 1 && fileItems[0].isImage && (await writeImagePath(all[0]))) {
      return { ok: true, pasted: 1, skipped: 0, asFiles: true }
    }
    if (await writeFileList(all)) return { ok: true, pasted: all.length, skipped: 0, asFiles: true }
    await clipboard.writeText(all.join('\n'))
    return { ok: true, pasted: all.length, skipped: 0, asFiles: false }
  }

  const parts = []
  for (const it of items) {
    if (it.type === 'text') parts.push(it.text.replace(/\s+$/, ''))
    else if (it.type === 'files') parts.push(it.files.join('\n'))
  }
  const merged = parts.join(sep)
  if (!merged) return { ok: false, pasted: 0, skipped: images.length, asFiles: false }

  await writeText(merged)
  return { ok: true, pasted: parts.length, skipped: images.length, asFiles: false }
}

/** Synthesize a Ctrl+V / Cmd+V into whatever window currently has focus. */
function pasteKeystroke() {
  const { platform } = process
  try {
    if (platform === 'win32') {
      const script = "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"
      spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Sta', '-WindowStyle', 'Hidden', '-Command', script], {
        windowsHide: true,
        stdio: 'ignore'
      })
    } else if (platform === 'darwin') {
      spawn('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down'], {
        stdio: 'ignore'
      })
    } else {
      spawn('xdotool', ['key', '--clearmodifiers', 'ctrl+v'], { stdio: 'ignore' })
    }
    return true
  } catch {
    return false
  }
}

module.exports = { writeOne, writeMerged, writeFileList, writeText, pasteKeystroke, sleep, SEPARATORS }
