import { memo } from 'react'
import type { ClipItem, ImageAsset } from './types'
import { CopyIcon, FileIcon, ImageIcon, LockIcon, PinIcon, StarIcon, TextIcon, TrashIcon } from './icons'
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
  onStar: () => void
  onSeal: () => void
  onRemove: () => void
  onPreview: () => void
  onDrag: () => void
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
  onStar,
  onSeal,
  onRemove,
  onPreview,
  onDrag
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
        {item.type === 'text' && !item.sensitive && <p className="card-text">{item.preview}</p>}

        {item.sensitive && (
          <div className="card-secret">
            <LockIcon size={13} />
            <span>{item.sensitiveLabel || '敏感内容'}</span>
            <em>{item.chars} 字符</em>
          </div>
        )}

        {picture && (
          <div
            className={`card-image${selectMode ? ' no-zoom' : ''}`}
            title={selectMode ? undefined : '点击查看大图 · 按住可拖到聊天窗口或文件夹'}
            draggable={!selectMode}
            onDragStart={(e) => {
              if (selectMode) return
              // Hand the drag to the main process: it has the real file path and
              // can start a proper OS drag with a file drop.
              e.preventDefault()
              onDrag()
            }}
            onMouseDown={(e) => {
              if (!selectMode) e.stopPropagation()
            }}
            onClick={() => {
              if (!selectMode) onPreview()
            }}
          >
            {asset?.thumb ? <img src={asset.thumb} alt="" /> : <div className="img-skeleton" />}
            <span className="img-dims">
              {item.width}×{item.height}
            </span>
          </div>
        )}

        {item.type === 'files' && !item.isImage && (
          <ul
            className="card-files"
            title="按住可拖到聊天窗口或文件夹"
            draggable={!selectMode}
            onDragStart={(e) => {
              if (selectMode) return
              e.preventDefault()
              onDrag()
            }}
            onMouseDown={(e) => {
              // Copy on click, but let a drag start instead of copying on press.
              if (!selectMode) e.stopPropagation()
            }}
            onClick={() => {
              if (!selectMode) onActivate()
            }}
          >
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
          <span className={`badge${item.sensitive ? ' secret' : ''}`}>
            {item.sensitive ? <LockIcon size={13} /> : icon}
            {item.sensitive ? '已加密' : picture ? '图片' : typeLabel(item.type)}
          </span>
          <span className="dot" />
          <span>{itemSizeLabel(item)}</span>
          <span className="dot" />
          <span>{relativeTime(item.createdAt)}</span>
          {item.pinned && <span className="flag flag-pin">已置顶</span>}
          {item.starred && <span className="flag flag-star">已收藏</span>}
        </div>
      </div>

      <div className="card-actions">
        {item.type === 'text' && (
          <button
            className={`seal-btn${item.sealed ? ' on' : ''}`}
            title={item.sealed ? '取消加密（内容会变回明文）' : '加密这一条（列表打码，复制时自动解密）'}
            onClick={onSeal}
          >
            <LockIcon size={14} />
          </button>
        )}
        <button
          className={`star-btn${item.starred ? ' on' : ''}`}
          title={item.starred ? '取消收藏' : '收藏（清空时保留）'}
          onClick={onStar}
        >
          <StarIcon size={14} />
        </button>
        <button
          className={`pin-btn${item.pinned ? ' on' : ''}`}
          title={item.pinned ? '取消置顶' : '置顶（排在列表最前）'}
          onClick={onPin}
        >
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
