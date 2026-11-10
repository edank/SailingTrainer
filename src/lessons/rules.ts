import type { BasicRule } from './types'

export const BASIC_RULES: BasicRule[] = [
  {
    rrs: 10,
    title: 'On Opposite Tacks',
    plain:
      'When two boats are on opposite tacks, the boat on port tack must keep clear of the boat on starboard tack. A boat is on port tack when the wind comes over its port (left) side, so the boom is on the starboard side.',
    example:
      'You are sailing upwind with the boom on your left and another boat is coming toward you with the boom on its right. You are on port tack, so you must tack away or bear away behind it.',
  },
  {
    rrs: 11,
    title: 'On the Same Tack, Overlapped',
    plain:
      'When two boats are on the same tack and overlapped, the windward boat (the one closer to the wind) must keep clear of the leeward boat. Boats are overlapped when neither is clearly ahead of the other, so one is alongside the other.',
    example:
      'You are sailing a beam reach beside another boat and you are on the side the wind is coming from. You are the windward boat, so you must stay clear and not sail into or squeeze the other boat.',
  },
  {
    rrs: 12,
    title: 'On the Same Tack, Not Overlapped',
    plain:
      'When two boats are on the same tack and not overlapped, the boat that is clear astern (behind) must keep clear of the boat that is clear ahead.',
    example:
      'You are sailing a few boat lengths behind another dinghy on the same tack. You must stay out of its way and steer around it, rather than expecting it to move for you.',
  },
  {
    rrs: 13,
    title: 'While Tacking',
    plain:
      'After a boat passes head to wind, it must keep clear of other boats until it is on a close-hauled course. This applies from the moment it passes head to wind until it is settled on its new tack.',
    example:
      'You tack across the path of a boat that was sailing on starboard tack. While you are turning through the wind, you must keep clear of that boat until you are close-hauled again.',
  },
  {
    rrs: 14,
    title: 'Avoiding Contact',
    plain:
      'A boat must avoid contact with another boat if it is reasonably possible. Even a boat with right of way must act to avoid a collision once it is clear the other boat is not keeping clear.',
    example:
      'You are on starboard tack and see a port-tack boat that is not changing course. You must still turn or slow down enough to avoid hitting it, even though it should have kept clear.',
  },
]
