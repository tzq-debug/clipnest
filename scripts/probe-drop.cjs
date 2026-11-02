'use strict'

/**
 * Dropping files onto the panel: they become one history entry, images get a
 * thumbnail so they land under 图片.
 *
 *   env -u ELECTRON_RUN_AS_NODE electron.exe scripts/probe-drop.cjs
 */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const zlib = require('node:zlib')
const { app } = require('electron')

process.on('uncaughtException', (e) => {
  console.error('THROW', e && e.stack)
  app.exit(2)
})

const { Store } = require(path.join(__dirname, '..', 'electron', 'store.cjs'))

app.disableHardwareAcceleration()

let failures = 0
const ok = (label, cond, extra) => {
  if (!cond) failures += 1
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond || !extra ? '' : `  → ${extra}`}`)
}

/* A real PNG, because saveThumbFromFile rejects anything under 2px. */
function makePng(size) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc32 = (buf) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolour RGB
  const raw = Buffer.alloc(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3)
    raw[row] = 0
    for (let x = 0; x < size; x++) {
      raw[row + 1 + x * 3] = 200
      raw[row + 2 + x * 3] = 80
      raw[row + 3 + x * 3] = 40
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const PNG = makePng(8)

app.whenReady().then(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipnest-drop-'))
  const src = path.join(dir, 'drop-src')
  fs.mkdirSync(src)
  const txt = path.join(src, '说明.txt')
  const png = path.join(src, '截图.png')
  fs.writeFileSync(txt, 'hello')
  fs.writeFileSync(png, PNG)

  const store = new Store(path.join(dir, 'data'))

  const one = store.importPaths([txt])
  ok('a dropped file becomes an entry', one && one.isNew === true)
  ok('the entry points at the original path', store.all()[0].files[0] === txt)
  ok('it is not treated as a picture', !store.all()[0].isImage)
  ok('its size is recorded', store.all()[0].bytes === 5, String(store.all()[0].bytes))

  const many = store.importPaths([txt, png])
  ok('several dropped files land in one entry', many && store.all()[0].files.length === 2)
  ok('a mixed drop is not all pictures', store.all()[0].isImage === false)

  const pic = store.importPaths([png])
  const entry = store.all()[0]
  ok('an image drop is flagged as a picture', pic && entry.isImage === true)
  ok('it gets a thumbnail on disk', Boolean(entry.thumb) && fs.existsSync(path.join(store.imagesDir, entry.thumb)))
  ok('it records the pixel size', entry.width === 8 && entry.height === 8, `${entry.width}x${entry.height}`)

  const again = store.importPaths([png])
  ok('dropping the same file again is a no-op', again && again.isNew === false)
  ok('and does not duplicate the entry', store.all().filter((i) => (i.files || [])[0] === png).length === 1)

  ok('an empty drop is ignored', store.importPaths([]) === null)
  ok('junk entries are filtered out', store.importPaths(['', '   ', null]) === null)

  fs.rmSync(dir, { recursive: true, force: true })
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
  app.exit(failures ? 1 : 0)
})
