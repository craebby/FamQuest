/** sleepy: heute nichts zu tun; hungry: noch nichts gefressen, aber Aufgaben offen. */
export type Mood = 'sleepy' | 'hungry' | 'happy' | 'party'

export function moodFor(food: number, open: boolean, allDone: boolean): Mood {
  if (allDone) return 'party'
  if (food > 0) return 'happy'
  return open ? 'hungry' : 'sleepy'
}
