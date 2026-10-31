import { useEffect, useState } from 'react'
import type { AppState } from './types'
import Panel from './Panel'
import DockStrip from './DockStrip'

export default function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    let alive = true
    window.clipnest.getState().then((s) => {
      if (alive) setState(s)
    })
    const offState = window.clipnest.onState((s) => {
      setState(s)
      setClosing(false)
    })
    const offClosing = window.clipnest.onClosing(() => setClosing(true))
    return () => {
      alive = false
      offState()
      offClosing()
    }
  }, [])

  const themeSetting = state?.settings.theme ?? 'system'

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = themeSetting === 'dark' || (themeSetting === 'system' && mq.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [themeSetting])

  if (!state) return <div className="boot" />

  const isDock = state.view === 'collapsed'

  return (
    <div className={`stage${isDock ? ' is-dock' : ''}${closing ? ' is-closing' : ''}`}>
      {isDock ? (
        <DockStrip count={state.items.length} paused={state.settings.paused} />
      ) : (
        <Panel state={state} />
      )}
    </div>
  )
}
