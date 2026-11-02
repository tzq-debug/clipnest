'use strict'

/**
 * Which files does a drag carry? Plain node, no Electron:
 *
 *   node scripts/probe-drag.cjs
 */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { resolveDragFiles } = require('../electron/drag.cjs')

let failures = 0
const ok = (label, cond, extra) => {
  if (!cond) failures += 1
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond || !extra ? '' : `  → ${extra}`}`)
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clipnest-drag-'))
const dragDir = path.join(tmp, 'drag')
const pdf = path.join(tmp, '报告.pdf')
const xlsx = path.join(tmp, '预算.xlsx')
fs.writeFileSync(pdf, 'pdf')
fs.writeFileSync(xlsx, 'xlsx')

const buffers = {
  'a.png': Buffer.from('pixels-a'),
  'b.big.png': Buffer.from('pixels-b')
}
const readImage = (name) => buffers[name] || null

const one = resolveDragFiles({ id: 'f1', type: 'files', files: [pdf] }, { tempDir: dragDir, readImage })
ok('a real file on disk is dragged as-is', one.length === 1 && one[0] === pdf, JSON.stringify(one))

const many = resolveDragFiles({ id: 'f2', type: 'files', files: [pdf, xlsx] }, { tempDir: dragDir, readImage })
ok('an entry with several paths drags them all', many.length === 2 && many.includes(xlsx), JSON.stringify(many))

const partly = resolveDragFiles(
  { id: 'f3', type: 'files', files: [path.join(tmp, 'missing.pdf'), pdf] },
  { tempDir: dragDir, readImage }
)
ok('paths that no longer exist are dropped', partly.length === 1 && partly[0] === pdf, JSON.stringify(partly))

const gone = resolveDragFiles(
  { id: 'f4', type: 'files', files: [path.join(tmp, 'missing.pdf')], thumb: 'b.big.png' },
  { tempDir: dragDir, readImage }
)
ok('a vanished file falls back to the stored picture', gone.length === 1 && gone[0] === path.join(dragDir, 'f4.png'), JSON.stringify(gone))

const picture = resolveDragFiles({ id: 'i1', type: 'image', image: 'a.png' }, { tempDir: dragDir, readImage })
ok('an image entry gets a temp copy', picture.length === 1 && picture[0] === path.join(dragDir, 'i1.png'), JSON.stringify(picture))
ok('the copy holds the decrypted bytes', fs.readFileSync(picture[0], 'utf8') === 'pixels-a')
ok('the temp folder is created on demand', fs.existsSync(dragDir))

const screenshot = resolveDragFiles(
  { id: 'i2', type: 'files', isImage: true, files: [path.join(tmp, 'nope.png')], big: 'b.big.png' },
  { tempDir: dragDir, readImage }
)
ok(
  'screenshot entries use their big copy',
  screenshot.length === 1 && screenshot[0] === path.join(dragDir, 'i2.png') && fs.readFileSync(screenshot[0], 'utf8') === 'pixels-b'
)

ok(
  'an unreadable picture yields nothing',
  resolveDragFiles({ id: 'i3', type: 'image', image: 'gone.png' }, { tempDir: dragDir, readImage }).length === 0
)
ok('text entries are not draggable', resolveDragFiles({ id: 't1', type: 'text', text: 'hello' }, { tempDir: dragDir, readImage }).length === 0)
ok('a missing entry yields nothing', resolveDragFiles(null, { tempDir: dragDir, readImage }).length === 0)

const again = resolveDragFiles({ id: 'i1', type: 'image', image: 'a.png' }, { tempDir: dragDir, readImage })
ok('dragging the same entry twice reuses the copy', again[0] === picture[0] && fs.existsSync(again[0]))

fs.rmSync(tmp, { recursive: true, force: true })

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)
