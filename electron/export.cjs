'use strict'

/**
 * Turns history entries into files the user can send to someone else.
 *
 * Kept free of Electron and of the store: everything here is a pure function so
 * scripts/probe-export.cjs can assert the exact output without booting a window.
 */

const path = require('node:path')
const fs = require('node:fs')

const pad = (n) => String(n).padStart(2, '0')

function stamp(ts) {
  const d = new Date(ts || Date.now())
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function dayStamp(ts) {
  const d = new Date(ts || Date.now())
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

function isPicture(item) {
  return item.type === 'image' || Boolean(item.isImage)
}

function typeLabel(item) {
  if (item.type === 'image') return '图片'
  if (item.isImage) return '图片文件'
  if (item.type === 'files') return '文件'
  return '文本'
}

/** The stored file that holds this entry's picture, if any. */
function imageSource(item) {
  if (!isPicture(item)) return null
  return item.image || item.big || item.thumb || null
}

function flags(item) {
  const out = []
  if (item.starred) out.push('收藏')
  if (item.pinned) out.push('置顶')
  return out
}

/**
 * Decides which entries get a picture file and what to call it. Names are
 * numbered rather than derived from ids so the folder reads in list order.
 */
function planImages(items, readImage) {
  const files = []
  const ref = new Map()
  let n = 0
  for (const item of items) {
    const name = imageSource(item)
    if (!name) continue
    const buffer = readImage(name)
    if (!buffer) continue
    n += 1
    const file = `${pad(n)}.png`
    files.push({ file, buffer })
    ref.set(item.id, file)
  }
  return { files, ref }
}

function fence(text) {
  return text.includes('```') ? '````' : '```'
}

function bodyOf(item) {
  if (item.sealed) {
    const label = item.sensitiveLabel || '已加密'
    return `> [已加密内容] ${label} · ${item.chars || 0} 字符\n> 这条没有导出明文，需要时在 ClipNest 里复制。`
  }
  const text = item.text || ''
  if (!text.trim()) return '> （空内容）'
  const mark = fence(text)
  return `${mark}\n${text}\n${mark}`
}

function fileList(item) {
  const files = item.files || []
  if (!files.length) return '> （没有路径）'
  return files.map((f) => `- \`${f}\``).join('\n')
}

function buildMarkdown(items, { exportedAt, imageDir, ref }) {
  const when = stamp(exportedAt)
  const starred = items.filter((i) => i.starred).length
  const pinned = items.filter((i) => i.pinned).length
  const lines = [
    '# ClipNest 导出',
    '',
    `- 导出时间：${when}`,
    `- 条目数：${items.length}${starred ? `（收藏 ${starred}）` : ''}${pinned ? `（置顶 ${pinned}）` : ''}`,
    imageDir ? `- 图片目录：\`${imageDir}/\`` : null,
    '',
    '---',
    ''
  ].filter((l) => l !== null)

  items.forEach((item, idx) => {
    const badges = flags(item)
    lines.push(`## ${idx + 1}. ${typeLabel(item)} · ${stamp(item.createdAt)}${badges.length ? ` · ${badges.join(' · ')}` : ''}`)

    if (item.sealed) {
      lines.push('')
      lines.push(bodyOf(item))
      lines.push('')
      return
    }

    if (item.type === 'text') {
      lines.push('')
      lines.push(bodyOf(item))
      lines.push('')
      return
    }

    const file = ref.get(item.id)
    if (file) {
      const size = item.width && item.height ? `（${item.width}×${item.height}）` : ''
      lines.push('')
      lines.push(`![${typeLabel(item)} ${idx + 1}](${imageDir}/${file})${size}`)
      if (item.type === 'files') {
        lines.push('')
        lines.push('原件：')
        lines.push(fileList(item))
      }
      lines.push('')
      return
    }

    lines.push('')
    lines.push(fileList(item))
    lines.push('')
  })

  return `${lines.join('\n').trimEnd()}\n`
}

function buildJson(items, { exportedAt, version, imageDir, ref }) {
  const payload = {
    app: 'ClipNest',
    version: version || null,
    exportedAt: new Date(exportedAt || Date.now()).toISOString(),
    imageDir: imageDir || null,
    count: items.length,
    items: items.map((item, idx) => {
      const file = ref.get(item.id) || null
      return {
        n: idx + 1,
        id: item.id,
        type: item.type,
        isImage: Boolean(item.isImage),
        createdAt: new Date(item.createdAt).toISOString(),
        pinned: Boolean(item.pinned),
        starred: Boolean(item.starred),
        chars: item.chars || 0,
        text: item.sealed ? null : item.text || '',
        sealed: Boolean(item.sealed),
        sealedLabel: item.sealed ? item.sensitiveLabel || '已加密' : null,
        files: item.files || null,
        image: file,
        width: item.width || 0,
        height: item.height || 0,
        bytes: item.bytes || 0
      }
    })
  }
  return `${JSON.stringify(payload, null, 2)}\n`
}

/** Default file name offered in the save dialog. */
function suggestedName(format) {
  return `ClipNest-export-${dayStamp()}.${format}`
}

function imagesFolderName(baseFile) {
  const dir = path.dirname(baseFile)
  const name = path.basename(baseFile, path.extname(baseFile))
  return { dir, name: `${name}_images` }
}

/**
 * Writes the document and its pictures next to `file`. Returns what landed on
 * disk so the caller can tell the user how much was exported.
 */
function writeExport({ items, file, format, version, readImage, exportedAt = Date.now() }) {
  const planned = planImages(items, readImage)

  let imageDir = null
  if (planned.files.length) {
    const folder = imagesFolderName(file)
    const target = path.join(folder.dir, folder.name)
    fs.mkdirSync(target, { recursive: true })
    for (const f of planned.files) fs.writeFileSync(path.join(target, f.file), f.buffer)
    imageDir = folder.name
  }

  const doc =
    format === 'json'
      ? buildJson(items, { exportedAt, version, imageDir, ref: planned.ref })
      : buildMarkdown(items, { exportedAt, imageDir, ref: planned.ref })

  fs.writeFileSync(file, doc)
  return { path: file, count: items.length, images: planned.files.length, imageDir }
}

module.exports = {
  stamp,
  dayStamp,
  isPicture,
  imageSource,
  planImages,
  buildMarkdown,
  buildJson,
  suggestedName,
  imagesFolderName,
  writeExport
}
