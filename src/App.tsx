import { Scene } from './scene/Scene'
import { HUD } from './ui/HUD'
import { Controls } from './ui/Controls'
import { Panel } from './ui/Panel'

export default function App() {
  return (
    <div className="app">
      <Scene />
      <HUD />
      <Controls />
      <Panel />
    </div>
  )
}
