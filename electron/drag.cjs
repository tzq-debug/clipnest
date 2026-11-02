'use strict'

/**
 * Works out which file on disk represents an entry, so the main process can
 * hand it to `webContents.startDrag`. Electron can only drag real files, and a
 * vault-encrypted picture is unreadable to other programs, so stored pictures
 * are decrypted into a temp copy first.
 */

const fs = require('node:fs')
const path = require('node:path')

function isFile(p) {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

/**
 * @param item       history entry
 * @param tempDir    where decrypted copies go
 * @param readImage  (storedName) => Buffer | null
 * @returns absolute file path, or null when there is nothing draggable
 */
function resolveDragFile(item, { tempDir, readImage }) {
  if (!item) return null

  // A file the user copied from Explorer is already on disk, and dragging the
  // original keeps its name and contents intact.
  const external = (item.files || []).find(isFile)
  if (external) return external

  const name = item.image || item.big || item.thumb
  if (!name) return null

  const buffer = readImage(name)
  if (!buffer || !buffer.length) return null

  fs.mkdirSync(tempDir, { recursive: true })
  const file = path.join(tempDir, `${item.id}.png`)
  fs.writeFileSync(file, buffer)
  return file
}

module.exports = { resolveDragFile }
