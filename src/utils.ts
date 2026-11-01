import type { ClipItem } from './types'

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 45_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const today = new Date()
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  if (sameDay) return `今天 ${hh}:${mm}`
  const yesterday = new Date(today.getTime() - 86_400_000)
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  if (isYesterday) return `昨天 ${hh}:${mm}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`
}

export function humanBytes(n: number): string {
  if (!n) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function fileName(p: string): string {
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] || p
}

export function extOf(p: string): string {
  const name = fileName(p)
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function acceleratorLabel(accel: string): string {
  if (!accel) return '未设置'
  return accel
    .replace(/Control|CommandOrControl|CmdOrCtrl/g, 'Ctrl')
    .replace(/Super|Meta/g, 'Win')
    .split('+')
    .map((k) => (k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1)))
    .join(' + ')
}

export function itemTitle(item: ClipItem): string {
  if (item.type === 'text') return item.preview.replace(/\s+/g, ' ').trim().slice(0, 80)
  if (item.type === 'image') return `图片 ${item.width}×${item.height}`
  if (item.type === 'files') {
    const n = item.files?.length || 0
    return n === 1 ? fileName(item.files![0]) : `${n} 个文件`
  }
  return ''
}

export function typeLabel(type: ClipItem['type']): string {
  if (type === 'text') return '文本'
  if (type === 'image') return '图片'
  return '文件'
}

export function itemSizeLabel(item: ClipItem): string {
  if (item.type === 'text') return `${item.chars} 字`
  if (item.isImage || item.type === 'image') {
    return item.bytes ? humanBytes(item.bytes) : `${item.width}×${item.height}`
  }
  const n = item.files?.length || 0
  return n > 1 ? `${n} 个文件` : humanBytes(item.bytes)
}

/** Matches a card against the search query (text, file names, dimensions). */
export function matchesQuery(item: ClipItem, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  if (item.type === 'text') return item.preview.toLowerCase().includes(q)
  if (item.type === 'files') return (item.files || []).some((f) => f.toLowerCase().includes(q))
  return `${item.width}x${item.height}`.includes(q)
}
