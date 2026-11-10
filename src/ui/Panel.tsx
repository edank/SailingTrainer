import { useEffect, useState } from 'react'
import { useSim, toDeg, type Panel as PanelId } from '../store'
import { POINTS_OF_SAIL } from '../lessons/pointsOfSail'
import { CONTROLS } from '../lessons/controls'
import { BASIC_RULES } from '../lessons/rules'
import { MS_TO_KNOTS } from '../sim/math'

const TABS: { id: Exclude<PanelId, null>; label: string }[] = [
  { id: 'lesson', label: 'Points of sail' },
  { id: 'controls', label: 'Controls' },
  { id: 'rules', label: 'Rules' },
]

export function Panel() {
  const panel = useSim((s) => s.panel)
  const setPanel = useSim((s) => s.setPanel)
  const open = panel !== null

  return (
    <aside className={`panel ${open ? 'open' : ''}`}>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={panel === t.id ? 'active' : ''} onClick={() => setPanel(t.id)}>
            {t.label}
          </button>
        ))}
        <button className="close" onClick={() => setPanel(open ? null : 'lesson')} aria-label={open ? 'Close' : 'Open'}>
          {open ? '✕' : '☰'}
        </button>
      </div>
      {open && (
        <div className="panel-body">
          {panel === 'lesson' && <PointsOfSailLesson />}
          {panel === 'controls' && <ControlsGlossary />}
          {panel === 'rules' && <RulesList />}
        </div>
      )}
    </aside>
  )
}

function PointsOfSailLesson() {
  const twaAbs = Math.abs(useSim((s) => toDeg(s.derived.twa)))
  return (
    <>
      <Goals />
      <p className="lede">
        Everything in sailing is relative to the wind. Steer with <kbd>←</kbd> <kbd>→</kbd> and watch which sector you're in on the rose.
      </p>
      {POINTS_OF_SAIL.map((p) => {
        const current = twaAbs >= p.twaRange[0] && twaAbs < p.twaRange[1]
        return (
          <details key={p.id} open={current} className={current ? 'current' : ''}>
            <summary>
              {p.name} <span className="muted">{p.twaRange[0]}–{p.twaRange[1]}°</span>
            </summary>
            <p>{p.summary}</p>
            <p><strong>Trim:</strong> {p.trimTips}</p>
            <p><strong>Watch out:</strong> {p.commonMistake}</p>
          </details>
        )
      })}
    </>
  )
}

/** Three small on-the-water tasks that tick off as the sailor does them. */
function Goals() {
  const [done, setDone] = useState({ upwind: false, fast: false, tack: false })
  useEffect(() => {
    let upwindGood = 0
    let lastTack = useSim.getState().derived.tack
    let tackFrom: 'port' | 'starboard' | null = null
    let lastT = performance.now()
    const unsub = useSim.subscribe((s) => {
      const now = performance.now()
      const dt = (now - lastT) / 1000
      lastT = now
      const twaAbs = Math.abs(toDeg(s.derived.twa))
      const flowing = s.derived.telltales.windward === 'flowing' && s.derived.telltales.leeward === 'flowing'
      upwindGood = twaAbs >= 35 && twaAbs <= 55 && flowing ? upwindGood + dt : 0
      const fast = s.boat.speed * MS_TO_KNOTS > 4.5
      // A tack = tack changed while the bow passed through the wind (|TWA| small).
      if (s.derived.tack !== lastTack) {
        if (twaAbs < 90) tackFrom = lastTack
        lastTack = s.derived.tack
      }
      const tacked = tackFrom !== null && twaAbs > 35
      setDone((d) => {
        const n = { upwind: d.upwind || upwindGood > 4, fast: d.fast || fast, tack: d.tack || tacked }
        return n.upwind === d.upwind && n.fast === d.fast && n.tack === d.tack ? d : n
      })
    })
    return unsub
  }, [])
  return (
    <ul className="goals">
      <li className={done.upwind ? 'done' : ''}>Hold close-hauled with both telltales flowing for 4 s</li>
      <li className={done.fast ? 'done' : ''}>Get the boat above 4.5 kn (try a reach)</li>
      <li className={done.tack ? 'done' : ''}>Tack through the wind onto the other side</li>
    </ul>
  )
}

function ControlsGlossary() {
  return (
    <>
      {CONTROLS.map((c) => (
        <details key={c.id} open>
          <summary>
            {c.name} {c.aka && <span className="muted">({c.aka.join(', ')})</span>}
          </summary>
          <p>{c.whatItDoes}</p>
          <p><strong>Use it:</strong> {c.whenToUse}</p>
        </details>
      ))}
    </>
  )
}

function RulesList() {
  return (
    <>
      <p className="lede">
        The five rules that cover almost every meeting between two boats. Interactive two-boat scenarios come next.
      </p>
      {BASIC_RULES.map((r) => (
        <details key={r.rrs}>
          <summary>
            <span className="muted">RRS {r.rrs}</span> {r.title}
          </summary>
          <p>{r.plain}</p>
          <p><strong>Example:</strong> {r.example}</p>
        </details>
      ))}
    </>
  )
}
