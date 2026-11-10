import type { PointOfSailInfo } from './types'

export const POINTS_OF_SAIL: PointOfSailInfo[] = [
  {
    id: 'in-irons',
    name: 'In Irons (No-Go Zone)',
    twaRange: [0, 35],
    summary:
      'The bow is pointing straight into the wind, so the sail luffs flat and cannot generate power. The boat stops and then drifts backwards.',
    trimTips:
      'Nothing you trim will help here. Let the mainsheet out so the sail can flap freely, push the boom out to one side to back the sail, and push the tiller toward that same side to turn the bow away from the wind. As soon as the boat bears off and the sail fills, sheet in and steer to a close-hauled course.',
    commonMistake:
      'Pulling the mainsheet in harder while stuck head to wind. A tight sheet keeps the sail flat on the centreline and the boat stays stuck.',
  },
  {
    id: 'close-hauled',
    name: 'Close-Hauled',
    twaRange: [35, 55],
    summary:
      'The closest angle to the wind at which the sail still works, so the boat sails upwind. The sail is pulled in hard and the boat heels the most here.',
    trimTips:
      'Sheet in until the boom is roughly over the corner of the transom, with the mainsheet blocks touching (block-to-block) in medium air and a touch eased in very light air. In a breeze, pull on the vang to bend the mast and flatten the sail, and tighten the cunningham and outhaul to take out power. In light air, ease the outhaul and cunningham for a fuller, more powerful shape. Hike hard to keep the boat flat and steer by the telltales and the luff of the sail.',
    commonMistake:
      'Pinching, which means steering too close to the wind so the sail luffs and the boat slows down. Sailing slightly lower with the sail just full is faster.',
  },
  {
    id: 'close-reach',
    name: 'Close Reach',
    twaRange: [55, 80],
    summary:
      'Sailing with the wind forward of the beam, a bit lower than close-hauled. The boat is fast and powerful and still heels noticeably.',
    trimTips:
      'Ease the mainsheet out from close-hauled until the sail just stops luffing at the front edge. Keep the vang on enough that the leech stays controlled and the boom does not lift. In a breeze, keep the cunningham and outhaul fairly firm to depower the sail, and ease them in lighter air. Keep hiking to hold the boat flat, and adjust your weight as the gusts and lulls come through.',
    commonMistake:
      'Leaving the sail sheeted in as for close-hauled. An oversheeted sail stalls, which slows the boat and makes it heel and feel heavy on the helm.',
  },
  {
    id: 'beam-reach',
    name: 'Beam Reach',
    twaRange: [80, 110],
    summary:
      'The wind blows from directly across the side of the boat. This is usually the fastest and easiest point of sail, with steady power and a comfortable ride.',
    trimTips:
      'Let the mainsheet out until the boom is roughly 45° from the centreline: ease until the front of the sail just starts to luff, then sheet back in until it stops. Ease the vang a little so the leech opens, but keep enough on to hold the boom down. Ease the cunningham and outhaul in light air and keep them firmer in a breeze. Sit further out in strong wind to keep the boat flat, and move back slightly in waves to help the bow lift.',
    commonMistake:
      'Sailing with the sail too far in, which makes the boat heel and round up. Ease the sheet and let the sail work with a clean flow.',
  },
  {
    id: 'broad-reach',
    name: 'Broad Reach',
    twaRange: [110, 160],
    summary:
      'The wind comes from behind the beam, over the back corner of the boat. The sail is let well out and the boat can plane in a good breeze.',
    trimTips:
      'Ease the mainsheet well out so the boom is about 45 to 60 degrees from the centreline. Ease the vang and keep it firm enough that the boom does not sky (lift up) and the leech does not twist open, which spills power. Ease the outhaul and cunningham in light air for a fuller sail and tighten them in strong wind. Move your weight back to keep the bow from digging in and heel the boat slightly to windward to help steering and balance. Pump and surf waves when conditions allow.',
    commonMistake:
      'Letting the boom lift and twist because the vang is too loose, or sitting too far forward so the bow digs in and the boat becomes hard to steer.',
  },
  {
    id: 'run',
    name: 'Run (Downwind)',
    twaRange: [160, 180],
    summary:
      'Sailing with the wind directly behind the boat. It feels slow and calm because the apparent wind is weak, but a gybe is easy to do by accident.',
    trimTips:
      'Let the mainsheet right out so the sail is nearly square to the wind, with the boom about 90 degrees from the centreline. Ease the vang so the boom does not sky, and ease the cunningham and outhaul for a full, powerful shape (tighter only in very strong wind). Sit slightly to windward or heel the boat a little to windward so the helm stays balanced and the boat does not roll. Keep your weight further back in strong winds, and raise the daggerboard about a third to half way to reduce drag while keeping the boat stable.',
    commonMistake:
      'Sailing dead downwind, which risks an accidental gybe. Steer a few degrees off dead downwind and keep a close eye on the leech and the wind direction.',
  },
]
