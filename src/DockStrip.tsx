import { useEffect, useState } from 'react'
import { StackIcon } from './icons'

export default function DockStrip({ count, paused }: { count: number; paused: boolean }) {
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (!count) return
    setPulse(true)
    const t = setTimeout(() => setPulse(false), 420)
    return () => clearTimeout(t)
  }, [count])

  return (
    <div
      className="dock"
      onMouseEnter={() => window.clipnest.hover(true)}
      onClick={() => window.clipnest.setView('expanded')}
    >
      <div className={`dock-pill${pulse ? ' pulse' : ''}${paused ? ' paused' : ''}`} title="ClipNest · 点击展开">
        <span className="dock-icon">
          <StackIcon size={12} />
        </span>
        <span className="dock-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="dock-count">{count > 99 ? '99+' : count}</span>
      </div>
    </div>
  )
}
