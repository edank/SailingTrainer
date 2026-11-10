import type { ControlInfo } from './types'

export const CONTROLS: ControlInfo[] = [
  {
    id: 'tiller',
    name: 'Tiller',
    whatItDoes:
      'The tiller is the handle attached to the rudder, and moving it steers the boat. Pushing it away from you turns the bow toward you, and pulling it toward you turns the bow away.',
    whenToUse:
      'Use small, smooth movements to steer, because big movements act like a brake. Use the tiller extension to steer while you hike out.',
  },
  {
    id: 'mainsheet',
    name: 'Mainsheet',
    whatItDoes:
      'The mainsheet runs through a system of blocks from the boom to the cockpit floor and sets the angle of the boom, and so how far the sail is let out.',
    whenToUse:
      'Pull it in to sail upwind and ease it out as you bear away, always easing until the front of the sail just starts to luff and then trimming back in. Let it go in a gust or when the boat heels too far.',
  },
  {
    id: 'vang',
    name: 'Vang',
    aka: ['kicker', 'boom vang'],
    whatItDoes:
      'The vang pulls the boom down toward the base of the mast, which controls how much the sail twists and bends the mast. It also stops the boom from lifting when the mainsheet is eased.',
    whenToUse:
      'Pull it on hard upwind in a breeze to flatten the sail and downwind to keep the boom from skying. Ease it in light air upwind so the sail can twist open, and let it off completely when you are launching, landing or stopped.',
  },
  {
    id: 'cunningham',
    name: 'Cunningham',
    aka: ['downhaul', 'cunno'],
    whatItDoes:
      'The cunningham pulls the sail down at the bottom of the luff, which tightens the front edge of the sail and moves the deepest part of the sail forward.',
    whenToUse:
      'Pull it on as the wind builds to flatten the sail and take out wrinkles running from the luff. Ease it in light air for a fuller, more powerful sail.',
  },
  {
    id: 'outhaul',
    name: 'Outhaul',
    whatItDoes:
      'The outhaul pulls the back corner of the sail (the clew) along the boom, which flattens or deepens the lower part of the sail.',
    whenToUse:
      'Pull it on tight in a strong breeze or upwind to flatten the sail and reduce power. Ease it in light air or downwind for a fuller sail, but not so far that the sail looks baggy and floppy.',
  },
]
