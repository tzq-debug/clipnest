'use strict'

/**
 * Works out which files on disk represent an entry, so the main process can
 * hand them to `webContents.startDrag`. Electron can only drag real files, and
 * a vault-encrypted picture is unreadable to other programs, so stored pictures
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
 * @returns absolute file paths; empty when there is nothing draggable
 */
function resolveDragFiles(item, { tempDir, readImage }) {
  if (!item) return []

  // Files the user copied from Explorer are already on disk; dragging the
  // originals keeps their names intact, and an entry can hold several of them.
  const external = (item.files || []).filter(isFile)
  if (external.length) return external

  const name = item.image || item.big || item.thumb
  if (!name) return []

  const buffer = readImage(name)
  if (!buffer || !buffer.length) return []

  fs.mkdirSync(tempDir, { recursive: true })
  const file = path.join(tempDir, `${item.id}.png`)
  fs.writeFileSync(file, buffer)
  return [file]
}

module.exports = { resolveDragFiles }
