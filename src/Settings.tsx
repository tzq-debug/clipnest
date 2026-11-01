import { useEffect, useState } from 'react'
import type { MergeSeparator, Settings as SettingsType } from './types'
import { ArrowLeftIcon, FolderIcon, LockIcon, PauseIcon, TrashIcon } from './icons'
import { acceleratorLabel } from './utils'

interface Props {
  settings: SettingsType
  hotkeyOk: boolean
  encrypted: boolean
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
  encrypted,
  version,
  dataDir,
  onUpdate,
  onClear,
  onBack
}: Props) {
  const [capturing, setCapturing] = useState(false)
  const [keywords, setKeywords] = useState(settings.ignoreKeywords.join('\n'))
  const [confirmClear, setConfirmClear] = useState(false)
  const [encMode, setEncMode] = useState<'idle' | 'enable' | 'disable'>('idle')
  const [pass1, setPass1] = useState('')
  const [pass2, setPass2] = useState('')
  const [encMsg, setEncMsg] = useState('')
  const [encBusy, setEncBusy] = useState(false)

  const resetEncForm = () => {
    setEncMode('idle')
    setPass1('')
    setPass2('')
    setEncMsg('')
  }

  const doEnable = async () => {
    if (pass1.length < 4) return setEncMsg('密码至少 4 位')
    if (pass1 !== pass2) return setEncMsg('两次输入不一致')
    setEncBusy(true)
    const res = await window.clipnest.enableEncryption(pass1)
    setEncBusy(false)
    if (!res.ok) return setEncMsg(res.message || '开启失败')
    resetEncForm()
  }

  const doDisable = async () => {
    if (!pass1) return setEncMsg('请输入当前密码')
    setEncBusy(true)
    const res = await window.clipnest.disableEncryption(pass1)
    setEncBusy(false)
    if (!res.ok) return setEncMsg(res.message || '关闭失败')
    resetEncForm()
  }

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
          <Row title="识别敏感内容" hint="API 密钥、私钥、JWT、身份证、银行卡、账号口令">
            <Switch
              label="识别敏感内容"
              checked={settings.sensitiveEnabled}
              onChange={(v) => onUpdate({ sensitiveEnabled: v })}
            />
          </Row>

          {settings.sensitiveEnabled && (
            <Row title="处理方式" hint="「加密」用系统密钥单独加密，列表里打码，不需要设置口令">
              <select
                className="select"
                value={settings.sensitivePolicy}
                onChange={(e) => onUpdate({ sensitivePolicy: e.target.value as SettingsType['sensitivePolicy'] })}
              >
                <option value="seal">加密保存并打码</option>
                <option value="skip">直接不记录</option>
              </select>
            </Row>
          )}

          <Row title="加密历史" hint="开启后启动要输密码解锁，文字和图片一起加密">
            <Switch
              label="加密历史"
              checked={encrypted}
              onChange={(v) => {
                setEncMsg('')
                setPass1('')
                setPass2('')
                setEncMode(v ? 'enable' : 'disable')
              }}
            />
          </Row>

          {encMode === 'enable' && (
            <div className="enc-box">
              <p className="enc-warn">
                密码只存在你脑子里。忘掉就解不开，里面的历史会永久丢失，没有找回渠道。
              </p>
              <input
                className="enc-input"
                type="password"
                placeholder="设置密码（至少 4 位）"
                value={pass1}
                autoFocus
                onChange={(e) => {
                  setPass1(e.target.value)
                  setEncMsg('')
                }}
              />
              <input
                className="enc-input"
                type="password"
                placeholder="再输一次"
                value={pass2}
                onChange={(e) => {
                  setPass2(e.target.value)
                  setEncMsg('')
                }}
              />
              {encMsg && <p className="enc-err">{encMsg}</p>}
              <div className="enc-actions">
                <button className="ghost-btn" onClick={resetEncForm}>
                  取消
                </button>
                <button className="primary-btn" disabled={encBusy} onClick={doEnable}>
                  <LockIcon size={12} /> {encBusy ? '加密中…' : '开启加密'}
                </button>
              </div>
            </div>
          )}

          {encMode === 'disable' && (
            <div className="enc-box">
              <p className="enc-warn">关闭后历史会恢复成明文保存在本机，任何人打开文件夹都能看到。</p>
              <input
                className="enc-input"
                type="password"
                placeholder="当前密码"
                value={pass1}
                autoFocus
                onChange={(e) => {
                  setPass1(e.target.value)
                  setEncMsg('')
                }}
              />
              {encMsg && <p className="enc-err">{encMsg}</p>}
              <div className="enc-actions">
                <button className="ghost-btn" onClick={resetEncForm}>
                  取消
                </button>
                <button className="primary-btn" disabled={encBusy} onClick={doDisable}>
                  {encBusy ? '解密中…' : '关闭并解密'}
                </button>
              </div>
            </div>
          )}

          {encrypted && encMode === 'idle' && (
            <Row title="立即锁定" hint="清空内存里的历史，重新输密码才能查看">
              <button className="chip-btn" onClick={() => window.clipnest.lockVault()}>
                <LockIcon size={13} /> 锁定
              </button>
            </Row>
          )}

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
          <Row title="清空历史" hint="收藏和置顶的记录会被保留">
            {confirmClear ? (
              <div className="row-actions">
                <button className="chip-btn" onClick={() => setConfirmClear(false)}>
                  取消
                </button>
                <button
                  className="chip-btn danger confirm"
                  onClick={() => {
                    setConfirmClear(false)
                    onClear(true)
                  }}
                >
                  <TrashIcon size={13} /> 确认清空
                </button>
              </div>
            ) : (
              <button className="chip-btn danger" onClick={() => setConfirmClear(true)}>
                <TrashIcon size={13} /> 清空
              </button>
            )}
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
