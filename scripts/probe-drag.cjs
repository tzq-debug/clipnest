'use strict'

/**
 * Which file does a drag carry? Plain node, no Electron:
 *
 *   node scripts/probe-drag.cjs
 */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { resolveDragFile } = require('../electron/drag.cjs')

let failures = 0
const ok = (label, cond, extra) => {
  if (!cond) failures += 1
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond || !extra ? '' : `  → ${extra}`}`)
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clipnest-drag-'))
const dragDir = path.join(tmp, 'drag')
const onDisk = path.join(tmp, '报告.pdf')
fs.writeFileSync(onDisk, 'pdf')

const buffers = {
  'a.png': Buffer.from('pixels-a'),
  'b.big.png': Buffer.from('pixels-b')
}
const readImage = (name) => buffers[name] || null

const fromExplorer = resolveDragFile({ id: 'f1', type: 'files', files: [onDisk] }, { tempDir: dragDir, readImage })
ok('a real file on disk is dragged as-is', fromExplorer === onDisk, fromExplorer)

const gone = resolveDragFile(
  { id: 'f2', type: 'files', files: [path.join(tmp, 'missing.pdf')], thumb: 'b.big.png' },
  { tempDir: dragDir, readImage }
)
ok('a vanished file falls back to the stored picture', gone === path.join(dragDir, 'f2.png'), gone)

const picture = resolveDragFile({ id: 'i1', type: 'image', image: 'a.png' }, { tempDir: dragDir, readImage })
ok('an image entry gets a temp copy', picture === path.join(dragDir, 'i1.png'), picture)
ok('the copy holds the decrypted bytes', fs.readFileSync(picture, 'utf8') === 'pixels-a')
ok('the temp folder is created on demand', fs.existsSync(dragDir))

const screenshot = resolveDragFile({ id: 'i2', type: 'files', isImage: true, files: [path.join(tmp, 'nope.png')], big: 'b.big.png' }, { tempDir: dragDir, readImage })
ok('screenshot entries use their big copy', screenshot === path.join(dragDir, 'i2.png') && fs.readFileSync(screenshot, 'utf8') === 'pixels-b')

const unreadable = resolveDragFile({ id: 'i3', type: 'image', image: 'gone.png' }, { tempDir: dragDir, readImage })
ok('an unreadable picture yields nothing', unreadable === null)

const textOnly = resolveDragFile({ id: 't1', type: 'text', text: 'hello' }, { tempDir: dragDir, readImage })
ok('text entries are not draggable', textOnly === null)

const nothing = resolveDragFile(null, { tempDir: dragDir, readImage })
ok('a missing entry yields nothing', nothing === null)

const second = resolveDragFile({ id: 'i1', type: 'image', image: 'a.png' }, { tempDir: dragDir, readImage })
ok('dragging the same entry twice reuses the copy', second === picture && fs.existsSync(second))

fs.rmSync(tmp, { recursive: true, force: true })

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)
