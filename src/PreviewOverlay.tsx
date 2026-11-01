import { useEffect } from 'react'
import type { ClipItem, ImageAsset } from './types'
import { CloseIcon, CopyIcon, FolderIcon } from './icons'
import { fileName, humanBytes } from './utils'

interface Props {
  item: ClipItem
  asset?: ImageAsset
  onClose: () => void
  onCopy: () => void
  onOpen: () => void
}

export default function PreviewOverlay({ item, asset, onClose, onCopy, onOpen }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const title =
    item.type === 'files' && item.files?.length ? fileName(item.files[0]) : `图片 ${item.width}×${item.height}`

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="preview" onMouseDown={(e) => e.stopPropagation()}>
        <div className="preview-head">
          <span className="preview-title" title={title}>
            {title}
          </span>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            <CloseIcon size={15} />
          </button>
        </div>

        <div className="preview-stage">
          {asset?.full ? (
            <img src={asset.full} alt={title} draggable={false} />
          ) : (
            <div className="preview-loading">图片加载中…</div>
          )}
        </div>

        <div className="preview-foot">
          <span className="preview-meta">
            {item.width}×{item.height}
            {item.bytes ? ` · ${humanBytes(item.bytes)}` : ''}
            {item.type === 'files' ? ' · 文件' : ''}
          </span>
          <div className="preview-actions">
            <button className="ghost-btn" onClick={onOpen}>
              <FolderIcon size={13} /> 用系统程序打开
            </button>
            <button className="primary-btn" onClick={onCopy}>
              <CopyIcon size={13} /> 复制图片
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
