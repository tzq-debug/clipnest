import { useEffect, useRef, useState } from 'react'
import { LockIcon, StackIcon } from './icons'

export default function LockScreen() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = async () => {
    if (!password || busy) return
    setBusy(true)
    setError('')
    const res = await window.clipnest.unlockVault(password)
    setBusy(false)
    if (!res.ok) {
      setError(res.message || '解锁失败')
      setPassword('')
      inputRef.current?.focus()
    }
  }

  return (
    <div className="panel lock-panel">
      <div className="lock-body">
        <span className="lock-mark">
          <StackIcon size={20} />
        </span>
        <h1 className="lock-title">ClipNest 已锁定</h1>
        <p className="lock-sub">输入密码解锁历史记录</p>

        <form
          className="lock-form"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <input
            ref={inputRef}
            type="password"
            className="lock-input"
            placeholder="密码"
            value={password}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => {
              setPassword(e.target.value)
              setError('')
            }}
          />
          <button className="primary-btn lock-submit" type="submit" disabled={!password || busy}>
            {busy ? '解锁中…' : '解锁'}
          </button>
        </form>

        {error && <p className="lock-error">{error}</p>}

        <p className="lock-hint">
          <LockIcon size={11} /> 忘记密码后历史无法恢复，这是加密的代价
        </p>
      </div>
    </div>
  )
}
