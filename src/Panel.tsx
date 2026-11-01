import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppState, Filter, ImageAsset } from './types'
import { ItemCard } from './ItemCard'
import PreviewOverlay from './PreviewOverlay'
import Settings from './Settings'
import { CloseIcon, CopyIcon, ImageIcon, LayersIcon, PauseIcon, SearchIcon, SettingsIcon, StackIcon, TextIcon, FileIcon, TrashIcon, CheckIcon } from './icons'
import { matchesQuery } from './utils'

const FILTERS: { key: Filter; label: string; icon?: React.ReactNode }[] = [
  { key: 'all', label: '全部' },
  { key: 'text', label: '文本', icon: <TextIcon size={12} /> },
  { key: 'image', label: '图片', icon: <ImageIcon size={12} /> },
  { key: 'files', label: '文件', icon: <FileIcon size={12} /> },
  { key: 'starred', label: '收藏' }
]

export default function Panel({ state }: { state: AppState }) {
  const { items, settings } = state
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [active, setActive] = useState(0)
  const [screen, setScreen] = useState<'list' | 'settings'>('list')
  const [toast, setToast] = useState('')
  const [images, setImages] = useState<Record<string, ImageAsset>>({})
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const list = items.filter((it) => {
      const picture = it.type === 'image' || it.isImage
      if (filter === 'starred' && !it.starred) return false
      if (filter === 'image' && !picture) return false
      if (filter === 'files' && (it.type !== 'files' || it.isImage)) return false
      if (filter === 'text' && it.type !== 'text') return false
      return matchesQuery(it, query)
    })
    return list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.createdAt - a.createdAt
    })
  }, [items, filter, query])

  useEffect(() => {
    setActive(0)
  }, [filter, query])

  useEffect(() => {
    if (screen === 'list') searchRef.current?.focus()
  }, [screen])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const need = filtered
      .filter((it) => (it.type === 'image' || it.isImage) && !images[it.id])
      .slice(0, 30)
      .map((it) => it.id)
    if (!need.length) return
    let alive = true
    window.clipnest.getImages(need).then((res) => {
      if (alive) setImages((prev) => ({ ...prev, ...res }))
    })
    return () => {
      alive = false
    }
  }, [filtered, images])

  // Escape belongs to the renderer while a preview or a multi-select is open,
  // otherwise the main process would collapse the whole panel.
  useEffect(() => {
    window.clipnest.setModal(Boolean(previewId) || selectMode)
  }, [previewId, selectMode])

  const orderedSelection = useMemo(
    () => filtered.filter((it) => selected.includes(it.id)).map((it) => it.id),
    [filtered, selected]
  )

  const toggleSelect = useCallback((id: string) => {
    setSelectMode(true)
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const exitSelect = useCallback(() => {
    setSelectMode(false)
    setSelected([])
  }, [])

  const toggleSelectMode = useCallback(() => {
    setSelectMode((on) => {
      if (on) setSelected([])
      return !on
    })
  }, [])

  const runCopy = useCallback(async (mode: 'merged' | 'sequential', explicitIds?: string[]) => {
    const ids = explicitIds?.length
      ? explicitIds
      : orderedSelection.length
        ? orderedSelection
        : filtered[active]
          ? [filtered[active].id]
          : []
    if (!ids.length) return
    const res = await window.clipnest.copy(ids, mode)
    if (!res.ok) setToast(res.message)
    setSelected([])
    setSelectMode(false)
  }, [orderedSelection, filtered, active])

  // Clearing used to be "click twice within three seconds", which silently
  // expired: a slower second click just re-armed the button and nothing
  // happened. The confirm now stays on screen until you pick one of the two
  // buttons, so the state can never vanish between clicks.
  const clearable = items.filter((it) => !it.pinned && !it.starred).length
  const marked = items.filter((it) => it.pinned || it.starred).length

  const askClear = useCallback(() => {
    if (!clearable) {
      setToast('没有可清理的记录')
      return
    }
    setSelectMode(false)
    setSelected([])
    setConfirmClear(true)
  }, [clearable])

  const runClear = useCallback(async () => {
    setConfirmClear(false)
    const res = await window.clipnest.clear(true)
    setSelected([])
    setSelectMode(false)
    setToast(res.cleared ? `已清空 ${res.cleared} 条${marked ? `，${marked} 条收藏/置顶已保留` : ''}` : '没有可清理的记录')
  }, [marked])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen !== 'list' || previewId) return
      const el = e.target as HTMLElement
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => Math.min(filtered.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        if (typing && !orderedSelection.length) {
          e.preventDefault()
          runCopy('merged')
        } else if (!typing) {
          e.preventDefault()
          runCopy('merged')
        }
      } else if (e.key === ' ' && !typing) {
        e.preventDefault()
        const it = filtered[active]
        if (it) toggleSelect(it.id)
      } else if (e.key === 'Delete' && !typing) {
        const it = filtered[active]
        if (it) window.clipnest.remove(it.id)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !typing) {
        e.preventDefault()
        setSelectMode(true)
        setSelected(filtered.map((it) => it.id))
      } else if (e.key === 'Escape' && confirmClear) {
        e.preventDefault()
        setConfirmClear(false)
      } else if (e.key === 'Escape' && selectMode) {
        e.preventDefault()
        exitSelect()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtered, active, orderedSelection.length, runCopy, toggleSelect, screen, previewId, selectMode, exitSelect, confirmClear])

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const update = useCallback(async (patch: Record<string, unknown>) => {
    const res = await window.clipnest.updateSettings(patch)
    if (patch.shortcut && !res.hotkeyOk) setToast('这个组合键已被占用，换一个吧')
  }, [])

  const counts = useMemo(
    () => ({
      all: items.length,
      starred: items.filter((i) => i.starred).length
    }),
    [items]
  )

  const previewItem = previewId ? items.find((i) => i.id === previewId) || null : null

  const allSelected = filtered.length > 0 && filtered.every((it) => selected.includes(it.id))

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? [] : filtered.map((it) => it.id))
  }, [allSelected, filtered])

  return (
    <div className="panel">
      <header className="head" onMouseDown={(e) => e.stopPropagation()}>
        <div className="brand">
          <span className="brand-mark">
            <StackIcon size={14} />
          </span>
          <span className="brand-name">ClipNest</span>
          {settings.paused && (
            <span className="paused-pill">
              <PauseIcon size={10} /> 已暂停
            </span>
          )}
        </div>
        <div className="head-actions">
          {items.length > 0 && (
            <button
              className={`icon-btn${confirmClear ? ' armed' : ''}`}
              title="清理历史（收藏会保留）"
              aria-label="清理历史"
              onClick={askClear}
            >
              <TrashIcon size={15} />
            </button>
          )}
          <button
            className="icon-btn"
            title="设置"
            aria-label="设置"
            onClick={() => {
              setConfirmClear(false)
              setScreen(screen === 'settings' ? 'list' : 'settings')
            }}
          >
            <SettingsIcon size={15} />
          </button>
          <button className="icon-btn" title="收起 (Esc)" aria-label="收起" onClick={() => window.clipnest.dismiss()}>
            <CloseIcon size={15} />
          </button>
        </div>
      </header>

      {screen === 'settings' ? (
        <Settings
          settings={settings}
          hotkeyOk={state.hotkeyOk}
          encrypted={state.encrypted}
          version={state.version}
          dataDir={state.dataDir}
          onUpdate={update}
          onClear={(keep) => {
            window.clipnest.clear(keep)
            setSelected([])
          }}
          onBack={() => setScreen('list')}
        />
      ) : (
        <>
          <div className="search">
            <SearchIcon size={15} />
            <input
              ref={searchRef}
              value={query}
              placeholder="搜索历史内容…"
              spellCheck={false}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.stopPropagation()
                  setQuery('')
                }
              }}
            />
            {query && (
              <button className="clear-search" onClick={() => setQuery('')} aria-label="清空搜索">
                <CloseIcon size={12} />
              </button>
            )}
          </div>

          <div className="filters">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`filter${filter === f.key ? ' on' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.icon}
                {f.label}
                {f.key === 'all' && counts.all > 0 && <i>{counts.all}</i>}
                {f.key === 'starred' && counts.starred > 0 && <i>{counts.starred}</i>}
              </button>
            ))}
            <span className="filters-spacer" />
            <button
              className={`filter multi${selectMode ? ' on' : ''}`}
              title="多选：勾几条一次粘出去"
              onClick={toggleSelectMode}
            >
              <CheckIcon size={12} />
              多选
            </button>
          </div>

          <div className={`list${selectMode ? ' is-selecting' : ''}`} ref={listRef}>
            {filtered.length === 0 && (
              <div className="empty">
                <StackIcon size={26} />
                <p>{query ? '没有匹配的内容' : filter === 'starred' ? '还没有收藏任何记录' : '还什么都没复制过'}</p>
                <span>{query ? '换个关键词试试' : '复制任意文字、图片或文件，这里就会出现'}</span>
              </div>
            )}

            {filtered.map((item, idx) => (
              <div key={item.id} data-idx={idx}>
                <ItemCard
                  item={item}
                  active={idx === active}
                  selected={selected.includes(item.id)}
                  selectMode={selectMode}
                  asset={images[item.id]}
                  onActivate={() => {
                    setActive(idx)
                    runCopy('merged', [item.id])
                  }}
                  onPreview={() => {
                    setActive(idx)
                    setPreviewId(item.id)
                  }}
                  onToggleSelect={() => toggleSelect(item.id)}
                  onPin={() => window.clipnest.pin(item.id, !item.pinned)}
                  onStar={() => window.clipnest.star(item.id, !item.starred)}
                  onRemove={() => window.clipnest.remove(item.id)}
                />
              </div>
            ))}
          </div>

          {toast && <div className="toast">{toast}</div>}

          {confirmClear ? (
            <div className="selbar confirm">
              <div className="selbar-count">
                <TrashIcon size={14} />
                清空 <strong>{clearable}</strong> 条记录
                <span className="confirm-note">收藏和置顶会保留</span>
              </div>
              <div className="selbar-actions">
                <button className="ghost-btn" onClick={() => setConfirmClear(false)}>
                  取消
                </button>
                <button className="danger-btn" onClick={runClear}>
                  确认清空
                </button>
              </div>
            </div>
          ) : selectMode ? (
            <div className="selbar">
              <div className="selbar-count">
                <LayersIcon size={14} />
                {orderedSelection.length ? (
                  <>
                    已选 <strong>{orderedSelection.length}</strong> 项
                  </>
                ) : (
                  '点条目开始勾选'
                )}
              </div>
              <div className="selbar-actions">
                <button className="ghost-btn" onClick={toggleAll}>
                  {allSelected ? '取消全选' : '全选'}
                </button>
                <button
                  className="ghost-btn"
                  title="逐条自动 Ctrl+V（部分程序可能拦截）"
                  disabled={!orderedSelection.length}
                  onClick={() => runCopy('sequential')}
                >
                  依次粘贴
                </button>
                <button className="primary-btn" disabled={!orderedSelection.length} onClick={() => runCopy('merged')}>
                  <CopyIcon size={13} /> 合并复制
                </button>
              </div>
            </div>
          ) : (
            <footer className="foot">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> 选择
              </span>
              <span>
                <kbd>空格</kbd> 多选
              </span>
              <span>
                <kbd>Enter</kbd> 复制
              </span>
              <span className="foot-spacer" />
              <span className="foot-count">{filtered.length} / {items.length}</span>
            </footer>
          )}
        </>
      )}

      {previewItem && (
        <PreviewOverlay
          item={previewItem}
          asset={images[previewItem.id]}
          onClose={() => setPreviewId(null)}
          onCopy={() => {
            setPreviewId(null)
            runCopy('merged', [previewItem.id])
          }}
          onOpen={() => window.clipnest.openImage(previewItem.id)}
        />
      )}
    </div>
  )
}
