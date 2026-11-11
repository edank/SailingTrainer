import { useShallow } from 'zustand/react/shallow'
import { useSim } from '../store'
import type { Derived } from '../sim/types'

/** What to do next with the sail, as a coloured badge. Desktop: in the HUD. Phone: in the bottom dock. */
export function TrimAdvice() {
  // Compared by value, so the badge only re-renders when the advice changes, not every sim step.
  const { tone, text } = useSim(useShallow((s) => trimAdvice(s.derived)))
  return <div className={`trim-badge ${tone}`}>{text}</div>
}

/**
 * What to do next. The telltales say what's wrong; the mainsheet hint says whether the sheet can fix it.
 * Downwind with the sheet fully out the sail is stalled by design, so that alone is not a fault.
 */
function trimAdvice(d: Derived): { tone: 'good' | 'ok' | 'bad'; text: string } {
  if (d.inIrons) return { tone: 'bad', text: 'In irons — bear away' }
  // Outside the no-go zone a luffing sail always has room to sheet in.
  if (d.luffing) return { tone: 'bad', text: 'Luffing — sheet in' }
  const sheet = d.hints.mainsheet
  if (d.telltales.leeward === 'stalled' && sheet < 0) return { tone: 'ok', text: 'Stalled — ease the sheet' }
  if (d.telltales.windward === 'lifting' && sheet > 0) return { tone: 'ok', text: 'Sail too far out — sheet in' }
  const allGood = Object.values(d.hints).every((h) => h === 0)
  return { tone: allGood ? 'good' : 'ok', text: 'Trim OK' }
}
