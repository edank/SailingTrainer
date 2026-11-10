import { Scene } from './scene/Scene'
import { HUD } from './ui/HUD'
import { Controls } from './ui/Controls'
import { Panel } from './ui/Panel'

export default function App() {
  return (
    <div className="app">
      <Scene />
      <HUD />
      {/* Desktop: no box (display: contents). Phone: bottom dock — steering + menu row over the trim grid. */}
      <div className="dock">
        <Controls />
        <Panel />
      </div>
    </div>
  )
}
