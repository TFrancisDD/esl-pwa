// P1-E2 — Audio Clip Engine.
// One file per clip. Play-this-file, never seek-into-this-file.
// No surface may know how a group's audio is packaged.
import index from '../data/group1_clips.json'
import { entry, loadGroup, gating } from './registry.js'

export const ROLES = ['sound', 'word1', 'word2']

let unlocked = false
let current = null              // the one HTMLAudioElement allowed to be playing
const preloaded = new Map()

/** Resolve a clip to a playable src, or null when the entry has no such role. */
export function clip(entryId, role, groupId = gating().currentGroup) {
  if (!ROLES.includes(role)) return null
  const e = entry(entryId, groupId)
  if (!e.playable) {
    console.warn(`[audio] ${entryId} is suppressed — refusing to play`, e.suppressedReason || '')
    return null
  }
  const file = index[entryId]?.[role]
  if (!file) return null                       // normal: a 1-clip entry has no word1
  return loadGroup(groupId).media.audioBase + file
}

/** Which roles this entry actually has. Never assume three. */
export function rolesFor(entryId, groupId = gating().currentGroup) {
  return ROLES.filter(r => index[entryId]?.[r])
}

/** iOS will not play audio until a user gesture unlocks it. Call from the first tap. */
export function unlock() {
  if (unlocked) return true
  try {
    const a = new Audio()
    a.muted = true
    const p = a.play()
    if (p && p.catch) p.catch(() => {})
    a.pause()
    unlocked = true
  } catch { /* stays locked; play() will retry */ }
  return unlocked
}

export function isUnlocked() { return unlocked }

/** Play one clip. Stops whatever was playing first — clips never stack. */
export async function play(entryId, role, groupId = gating().currentGroup) {
  const src = clip(entryId, role, groupId)
  if (!src) return false
  stop()
  const a = preloaded.get(src) || new Audio(src)
  a.currentTime = 0
  current = a
  try { await a.play(); return true }
  catch (err) { console.warn('[audio] play failed', src, err?.name); return false }
}

export function stop() {
  if (!current) return
  try { current.pause(); current.currentTime = 0 } catch {}
  current = null
}

/** Preload the current group so the first tap is not a download. */
export function preloadGroup(groupId = gating().currentGroup) {
  const base = loadGroup(groupId).media.audioBase
  let n = 0
  for (const roles of Object.values(index)) {
    for (const file of Object.values(roles)) {
      const src = base + file
      if (preloaded.has(src)) continue
      const a = new Audio()
      a.preload = 'auto'
      a.src = src
      preloaded.set(src, a)
      n++
    }
  }
  return n
}

export function cacheSize() { return preloaded.size }
