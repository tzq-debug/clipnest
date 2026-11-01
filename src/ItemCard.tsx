import { memo } from 'react'
import type { ClipItem, ImageAsset } from './types'
import { CopyIcon, FileIcon, ImageIcon, PinIcon, TextIcon, TrashIcon } from './icons'
import { fileName, itemSizeLabel, relativeTime, typeLabel } from './utils'

interface Props {
  item: ClipItem
  active: boolean
  selected: boolean
  selectMode: boolean
  asset?: ImageAsset
  onActivate: () => void
  onToggleSelect: () => void
  onPin: () => void
  onRemove: () => void
  onPreview: () => void
}

function ItemCardBase({
  item,
  active,
  selected,
  selectMode,
  asset,
  onActivate,
  onToggleSelect,
  onPin,
  onRemove,
  onPreview
}: Props) {
  const picture = item.type === 'image' || item.isImage
  const icon = picture ? <ImageIcon size={13} /> : item.type === 'files' ? <FileIcon size={13} /> : <TextIcon size={13} />

  return (
    <div
      className={`card${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}`}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        if (selectMode) {
          onToggleSelect()
          return
        }
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          onToggleSelect()
        } else {
          onActivate()
        }
      }}
    >
      <button
        className="check"
        title="选择（多选后一次粘贴）"
        aria-label="选择"
        aria-pressed={selected}
        onClick={onToggleSelect}
      >
        <span className="check-dot">{selected ? <CheckMark /> : null}</span>
      </button>

      <div className="card-body">
        {item.type === 'text' && <p className="card-text">{item.preview}</p>}

        {picture && (
          <div
            className={`card-image${selectMode ? ' no-zoom' : ''}`}
            title={selectMode ? undefined : '点击查看大图'}
            onMouseDown={(e) => {
              if (!selectMode) e.stopPropagation()
            }}
            onClick={() => {
              if (!selectMode) onPreview()
            }}
          >
            {asset?.thumb ? <img src={asset.thumb} alt="" draggable={false} /> : <div className="img-skeleton" />}
            <span className="img-dims">
              {item.width}×{item.height}
            </span>
          </div>
        )}

        {item.type === 'files' && !item.isImage && (
          <ul className="card-files">
            {(item.files || []).slice(0, 3).map((f) => (
              <li key={f}>
                <FileIcon size={12} />
                <span>{fileName(f)}</span>
              </li>
            ))}
            {(item.files || []).length > 3 && <li className="more">还有 {(item.files || []).length - 3} 个文件</li>}
          </ul>
        )}

        {item.type === 'files' && item.isImage && (
          <p className="card-filename">{fileName((item.files || [''])[0])}</p>
        )}

        <div className="card-meta">
          <span className="badge">
            {icon}
            {picture ? '图片' : typeLabel(item.type)}
          </span>
          <span className="dot" />
          <span>{itemSizeLabel(item)}</span>
          <span className="dot" />
          <span>{relativeTime(item.createdAt)}</span>
          {item.pinned && <span className="pin-flag">已固定</span>}
        </div>
      </div>

      <div className="card-actions">
        <button className={item.pinned ? 'on' : ''} title={item.pinned ? '取消固定' : '固定到顶部'} onClick={onPin}>
          <PinIcon size={14} />
        </button>
        <button title={picture ? '复制这张图' : '复制这一条'} onClick={onActivate}>
          <CopyIcon size={14} />
        </button>
        <button className="danger" title="删除" onClick={onRemove}>
          <TrashIcon size={14} />
        </button>
      </div>
    </div>
  )
}

function CheckMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  )
}

export const ItemCard = memo(ItemCardBase)
