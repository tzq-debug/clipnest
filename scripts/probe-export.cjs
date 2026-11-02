'use strict'

/**
 * Assertions for the export formatting. Pure functions, so plain node runs this
 * without Electron:
 *
 *   node scripts/probe-export.cjs
 */

const {
  stamp,
  dayStamp,
  planImages,
  buildMarkdown,
  buildJson,
  suggestedName,
  imagesFolderName,
  writeExport
} = require('../electron/export.cjs')

let failures = 0
const ok = (label, cond, extra) => {
  if (!cond) failures += 1
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond || !extra ? '' : `  → ${extra}`}`)
}

const path = require('node:path')

const at = new Date(2026, 10, 2, 15, 20).getTime()
ok('stamp is zero padded', stamp(at) === '2026-11-02 15:20', stamp(at))
ok('dayStamp matches the file name convention', dayStamp(at) === '20261102', dayStamp(at))

const text = {
  id: 'a1',
  type: 'text',
  text: 'hello **world**',
  chars: 15,
  createdAt: at,
  pinned: true,
  starred: true
}

const withFence = {
  id: 'a2',
  type: 'text',
  text: 'look:\n```js\nconst x = 1\n```',
  chars: 28,
  createdAt: at
}

const sealed = {
  id: 'a3',
  type: 'text',
  text: '',
  chars: 55,
  sealed: 'BASE64CIPHER',
  sensitive: 'manual',
  sensitiveLabel: '手动加密',
  createdAt: at
}

const image = {
  id: 'a4',
  type: 'image',
  image: 'pic.png',
  thumb: 'pic.thumb.png',
  width: 1920,
  height: 1080,
  createdAt: at
}

const shot = {
  id: 'a5',
  type: 'files',
  isImage: true,
  files: ['C:\\Users\\me\\Desktop\\屏幕截图 2026-09-08 213205.png'],
  big: 'shot.big.png',
  width: 2559,
  height: 1450,
  createdAt: at
}

const doc = {
  id: 'a6',
  type: 'files',
  files: ['C:\\tmp\\a.pdf', 'C:\\tmp\\b.pdf'],
  bytes: 2048,
  createdAt: at
}

const items = [text, withFence, sealed, image, shot, doc]

const buffers = {
  'pic.png': Buffer.from('img-a'),
  'shot.big.png': Buffer.from('img-b'),
  'pic.thumb.png': Buffer.from('img-thumb')
}
const planned = planImages(items, (name) => buffers[name] || null)

ok('one picture file per picture entry', planned.files.length === 2, String(planned.files.length))
ok('pictures are numbered in list order', planned.files.map((f) => f.file).join(',') === '01.png,02.png', planned.files.map((f) => f.file).join(','))
ok('full image is preferred over the thumbnail', planned.ref.get('a4') === '01.png' && planned.files[0].buffer.toString() === 'img-a')
ok('screenshot file entries export their big copy', planned.ref.get('a5') === '02.png' && planned.files[1].buffer.toString() === 'img-b')
ok('text entries never claim a picture', !planned.ref.has('a1'))

const md = buildMarkdown(items, { exportedAt: at, imageDir: 'ClipNest-export-20261102_images', ref: planned.ref })

ok('markdown names the export', md.startsWith('# ClipNest 导出'))
ok('markdown reports the count and the starred total', md.includes('条目数：6（收藏 1）（置顶 1）'), md.split('\n').find((l) => l.includes('条目数')))
ok('every entry gets a heading', (md.match(/^## \d+\./gm) || []).length === 6)
ok('headings carry the flags', md.includes('文本 · 2026-11-02 15:20 · 收藏 · 置顶'), md.split('\n').find((l) => l.includes('## 1.')))
ok('plain text is fenced', md.includes('```\nhello **world**\n```'))
ok('text containing a fence uses four backticks', md.includes('````\nlook:'))
ok('sealed entries never leak their content', !md.includes('BASE64CIPHER') && md.includes('[已加密内容] 手动加密 · 55 字符'))
ok('pictures are referenced relatively', md.includes('![图片 4](ClipNest-export-20261102_images/01.png)（1920×1080）'), md.split('\n').find((l) => l.startsWith('![')))
ok('screenshot originals are still listed', md.includes('`C:\\Users\\me\\Desktop\\屏幕截图 2026-09-08 213205.png`'))
ok('file entries list every path', md.includes('- `C:\\tmp\\a.pdf`') && md.includes('- `C:\\tmp\\b.pdf`'))

const json = JSON.parse(buildJson(items, { exportedAt: at, version: '0.8.0', imageDir: 'imgs', ref: planned.ref }))
ok('json records the app version', json.version === '0.8.0')
ok('json counts the entries', json.count === 6 && json.items.length === 6)
ok('json keeps the flags', json.items[0].pinned === true && json.items[0].starred === true)
ok('json hides sealed text but says so', json.items[2].text === null && json.items[2].sealed === true && json.items[2].sealedLabel === '手动加密')
ok('json points at the copied picture', json.items[3].image === '01.png')
ok('json uses ISO timestamps', json.items[0].createdAt === new Date(at).toISOString())

ok('suggested name uses the date', suggestedName('md') === 'ClipNest-export-20261102.md', suggestedName('md'))

const folder = imagesFolderName('D:\\out\\ClipNest-export-20261102.md')
ok('image folder sits next to the file', folder.dir === 'D:\\out' && folder.name === 'ClipNest-export-20261102_images', JSON.stringify(folder))

/* ---- what actually lands on disk ---------------------------------------- */

const os = require('node:os')
const fsn = require('node:fs')

const tmp = fsn.mkdtempSync(path.join(os.tmpdir(), 'clipnest-export-'))
const target = path.join(tmp, 'ClipNest-export-20261102.md')

const written = writeExport({
  items,
  file: target,
  format: 'md',
  version: '0.8.0',
  readImage: (name) => buffers[name] || null,
  exportedAt: at
})

ok('writeExport reports the count', written.count === 6 && written.images === 2)
ok('the document exists', fsn.existsSync(target))
ok('a sibling image folder was created', fsn.existsSync(path.join(tmp, 'ClipNest-export-20261102_images')))
ok(
  'pictures were written in order',
  fsn.readFileSync(path.join(tmp, 'ClipNest-export-20261102_images', '01.png'), 'utf8') === 'img-a' &&
    fsn.readFileSync(path.join(tmp, 'ClipNest-export-20261102_images', '02.png'), 'utf8') === 'img-b'
)
ok('the document links to the folder by name', fsn.readFileSync(target, 'utf8').includes('ClipNest-export-20261102_images/01.png'))

const jsonTarget = path.join(tmp, 'backup.json')
const jsonWritten = writeExport({
  items: [text, sealed],
  file: jsonTarget,
  format: 'json',
  version: '0.8.0',
  readImage: () => null,
  exportedAt: at
})
ok('json export writes a file', jsonWritten.count === 2 && fsn.existsSync(jsonTarget))
const parsed = JSON.parse(fsn.readFileSync(jsonTarget, 'utf8'))
ok('json export keeps the flags', parsed.items[0].pinned === true && parsed.items[0].starred === true)
ok('json export never carries sealed plaintext', parsed.items[1].text === null)

// an entry whose picture can no longer be read must not break the export
const broken = writeExport({
  items: [{ id: 'z1', type: 'image', image: 'gone.png', createdAt: at }],
  file: path.join(tmp, 'broken.md'),
  format: 'md',
  version: '0.8.0',
  readImage: () => null,
  exportedAt: at
})
ok('a missing picture is skipped, not fatal', broken.images === 0 && fsn.existsSync(path.join(tmp, 'broken.md')))

fsn.rmSync(tmp, { recursive: true, force: true })

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)
