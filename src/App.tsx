import { Analytics } from '@vercel/analytics/react'
import { Scene } from './scene/Scene'
import { HUD } from './ui/HUD'
import { Controls } from './ui/Controls'
import { Panel } from './ui/Panel'
import { useRef } from 'react'
import { useIsPhone } from './hooks/useIsPhone'
import { useReportInset } from './hooks/useViewInsets'

export default function App() {
  const dock = useRef<HTMLDivElement>(null)
  useReportInset(dock, 'bottom', useIsPhone())

  return (
    <div className="app">
      <Scene />
      <HUD />
      {/* Desktop: no box (display: contents). Phone: bottom dock — steering + menu row over the trim grid. */}
      <div className="dock" ref={dock}>
        <Controls />
        <Panel />
      </div>
      <Analytics />
    </div>
  )
}
