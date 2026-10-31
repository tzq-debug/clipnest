import { useEffect, useState } from 'react'
import type { MergeSeparator, Settings as SettingsType } from './types'
import { ArrowLeftIcon, FolderIcon, PauseIcon, TrashIcon } from './icons'
import { acceleratorLabel } from './utils'

interface Props {
  settings: SettingsType
  hotkeyOk: boolean
  version: string
  dataDir: string
  onUpdate: (patch: Partial<SettingsType>) => void
  onClear: (keepPinned: boolean) => void
  onBack: () => void
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      className={`switch${checked ? ' on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span className="knob" />
    </button>
  )
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="row">
      <div className="row-label">
        <span>{title}</span>
        {hint && <em>{hint}</em>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="group">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export default function Settings({
  settings,
  hotkeyOk,
  version,
  dataDir,
  onUpdate,
  onClear,
  onBack
}: Props) {
  const [capturing, setCapturing] = useState(false)
  const [keywords, setKeywords] = useState(settings.ignoreKeywords.join('\n'))
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    setKeywords(settings.ignoreKeywords.join('\n'))
  }, [settings.ignoreKeywords])

  useEffect(() => {
    if (!capturing) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setCapturing(false)
        return
      }
      const mods: string[] = []
      if (e.ctrlKey) mods.push('Control')
      if (e.altKey) mods.push('Alt')
      if (e.shiftKey) mods.push('Shift')
      if (e.metaKey) mods.push('Super')
      if (['Control', 'Alt', 'Shift', 'Meta', 'CapsLock'].includes(e.key)) return
      if (!mods.length) return
      let key = e.key.length === 1 ? e.key.toUpperCase() : e.key
      if (key === ' ') key = 'Space'
      onUpdate({ shortcut: [...mods, key].join('+') })
      setCapturing(false)
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [capturing, onUpdate])

  return (
    <div className="settings">
      <header className="settings-head">
        <button className="icon-btn" onClick={onBack} title="返回列表" aria-label="返回">
          <ArrowLeftIcon size={16} />
        </button>
        <h2>设置</h2>
      </header>

      <div className="settings-body">
        <Group title="记录">
          <Row title="暂停记录" hint="临时不要把新内容记进历史">
            <Switch label="暂停记录" checked={settings.paused} onChange={(v) => onUpdate({ paused: v })} />
          </Row>
          <Row title="最多保留" hint="超出后自动删除最旧的未固定记录">
            <div className="stepper">
              <input
                type="number"
                min={20}
                max={5000}
                step={50}
                value={settings.maxItems}
                onChange={(e) => onUpdate({ maxItems: Math.max(20, Number(e.target.value) || 500) })}
              />
              <span>条</span>
            </div>
          </Row>
          <Row title="记录图片" hint="截图、复制的图片会保存缩略图">
            <Switch label="记录图片" checked={settings.captureImages} onChange={(v) => onUpdate({ captureImages: v })} />
          </Row>
          <Row title="记录文件" hint="从资源管理器复制的文件路径">
            <Switch label="记录文件" checked={settings.captureFiles} onChange={(v) => onUpdate({ captureFiles: v })} />
          </Row>
          <Row title="单条文本上限" hint="超过这个字数的内容不记录">
            <div className="stepper">
              <input
                type="number"
                min={1000}
                max={200000}
                step={1000}
                value={settings.maxTextLength}
                onChange={(e) => onUpdate({ maxTextLength: Math.max(1000, Number(e.target.value) || 20000) })}
              />
              <span>字</span>
            </div>
          </Row>
        </Group>

        <Group title="粘贴">
          <Row title="快捷键" hint={hotkeyOk ? '随时唤起面板' : '已被其他程序占用，换一个组合'}>
            <button className={`chip-btn${capturing ? ' active' : ''}${hotkeyOk ? '' : ' error'}`} onClick={() => setCapturing((v) => !v)}>
              {capturing ? '按下组合键…' : acceleratorLabel(settings.shortcut)}
            </button>
          </Row>
          <Row title="合并分隔符" hint="多条文本拼在一起时用什么隔开">
            <select
              className="select"
              value={settings.mergeSeparator}
              onChange={(e) => onUpdate({ mergeSeparator: e.target.value as MergeSeparator })}
            >
              <option value="newline">换行</option>
              <option value="blank">空行</option>
              <option value="space">空格</option>
              <option value="none">直接相连</option>
            </select>
          </Row>
          <Row title="复制后收起面板" hint="方便直接按 Ctrl+V 粘到目标窗口">
            <Switch label="复制后收起" checked={settings.collapseOnCopy} onChange={(v) => onUpdate({ collapseOnCopy: v })} />
          </Row>
          <Row title="依次粘贴间隔" hint="每条之间的等待毫秒数，太短会漏字">
            <div className="stepper">
              <input
                type="number"
                min={150}
                max={2000}
                step={50}
                value={settings.sequentialDelay}
                onChange={(e) => onUpdate({ sequentialDelay: Math.max(150, Number(e.target.value) || 380) })}
              />
              <span>ms</span>
            </div>
          </Row>
        </Group>

        <Group title="界面">
          <Row title="贴边小条" hint="显示屏幕右边缘的常驻小框">
            <Switch label="贴边小条" checked={settings.showDock} onChange={(v) => onUpdate({ showDock: v })} />
          </Row>
          <Row title="开机自动启动">
            <Switch label="开机自动启动" checked={settings.launchAtLogin} onChange={(v) => onUpdate({ launchAtLogin: v })} />
          </Row>
          <Row title="主题">
            <select
              className="select"
              value={settings.theme}
              onChange={(e) => onUpdate({ theme: e.target.value as SettingsType['theme'] })}
            >
              <option value="system">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </Row>
        </Group>

        <Group title="隐私">
          <div className="row row-block">
            <div className="row-label">
              <span>忽略关键词</span>
              <em>只要内容包含其中任意一行，就不记录（适合填 password、验证码、公司名等）</em>
            </div>
            <textarea
              className="textarea"
              rows={3}
              placeholder={'每行一个关键词\n例如：password'}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              onBlur={() =>
                onUpdate({
                  ignoreKeywords: keywords
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean)
                })
              }
            />
          </div>
          <Row title="历史数据只存在本机" hint="不联网、不上传，随时可以删">
            <button className="chip-btn" onClick={() => window.clipnest.openDataDir()}>
              <FolderIcon size={13} /> 打开目录
            </button>
          </Row>
          <Row title="清空历史" hint="收藏的记录会被保留">
            <button
              className={`chip-btn danger${confirmClear ? ' confirm' : ''}`}
              onClick={() => {
                if (!confirmClear) {
                  setConfirmClear(true)
                  setTimeout(() => setConfirmClear(false), 3000)
                  return
                }
                setConfirmClear(false)
                onClear(true)
              }}
            >
              <TrashIcon size={13} /> {confirmClear ? '确认清空？' : '清空'}
            </button>
          </Row>
        </Group>

        <Group title="关于">
          <Row title="ClipNest" hint={`v${version} · MIT 开源`}>
            <span className="mono">{dataDir}</span>
          </Row>
          <Row title="退出 ClipNest" hint="退出后不再记录剪贴板">
            <button className="chip-btn" onClick={() => window.clipnest.quit()}>
              退出
            </button>
          </Row>
        </Group>

        <p className="settings-foot">
          {settings.paused ? (
            <span className="paused-hint">
              <PauseIcon size={12} /> 记录已暂停
            </span>
          ) : (
            '贴边小条：鼠标移上去展开，移开自动收起'
          )}
        </p>
      </div>
    </div>
  )
}
