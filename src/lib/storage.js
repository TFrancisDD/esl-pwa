// P1-E3 — Local State and Storage.
// Every write to device storage goes through this module. No surface calls
// localStorage directly, and no surface invents a key.
import { availableGroups, gating } from './registry.js'

/* ---------- keys ----------
   Versioned. A schema change bumps the suffix and the old key is simply
   never read again — there is no migration to get wrong.                 */
export const KEYS = {
  progress: 'esl_progress_v1',
  teacher:  'esl_teacher_v1',
  prefs:    'esl_prefs_v1'
}
const KEY_LIST = Object.values(KEYS)

/* ---------- bounds ----------
   Storage is shared and low-end devices are small. Both records are
   pruned on write so neither grows without limit.                        */
const MAX_GROUPS = 4      // progress: keep this many groups, newest kept
const MAX_DAYS   = 30     // teacher: keep this many days of ratings

/* ---------- backend ----------
   localStorage where it works, memory where it does not. Safari in private
   mode throws on write, and a page can be opened with storage disabled —
   neither may take the app down.                                         */
const memory = new Map()
const memoryBackend = {
  getItem: k => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)) },
  removeItem: k => { memory.delete(k) }
}

let backend = null
function store() {
  if (backend) return backend
  try {
    const ls = globalThis.localStorage
    const probe = '__esl_probe__'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    backend = ls
  } catch {
    backend = memoryBackend
  }
  return backend
}

/** Test seam. Pass a Storage-shaped object, or nothing to reset to memory. */
export function useBackend(b) {
  backend = b || { ...memoryBackend }
  if (!b) memory.clear()
  return backend
}

/* ---------- raw read / write ----------
   A missing key and a corrupt key are the same answer: the default.      */
export function read(key, fallback) {
  if (!KEY_LIST.includes(key)) throw new UnknownKeyError(key)
  let raw
  try { raw = store().getItem(key) } catch { return fallback }
  if (raw == null) return fallback
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' ? v : fallback
  } catch {
    return fallback                  // corrupt JSON is not an error condition
  }
}

export function write(key, value) {
  if (!KEY_LIST.includes(key)) throw new UnknownKeyError(key)
  try { store().setItem(key, JSON.stringify(value)); return true }
  catch { return false }             // a full or disabled store must not throw
}

export class UnknownKeyError extends Error {
  constructor(k) { super(`Refusing to write unversioned key "${k}"`); this.name = 'UnknownKeyError' }
}

/* ---------- progress ----------
   Counts per entry, per group. No name, no id, no identity of any kind —
   one device serves many children and none of them owns this record.     */
const emptyProgress = () => ({ v: 1, groups: {} })

export function progress() { return read(KEYS.progress, emptyProgress()) }

/** Record one answer against an entry. */
export function recordAnswer(entryId, correct, groupId = gating().currentGroup) {
  const p = progress()
  const g = (p.groups[groupId] ||= {})
  const e = (g[entryId] ||= { right: 0, wrong: 0 })
  if (correct) e.right++; else e.wrong++
  write(KEYS.progress, prune(p))
  return e
}

export function answersFor(entryId, groupId = gating().currentGroup) {
  return progress().groups[groupId]?.[entryId] || { right: 0, wrong: 0 }
}

/** Drop groups the curriculum no longer offers, then cap what is left. */
function prune(p) {
  const allowed = new Set(availableGroups())
  for (const id of Object.keys(p.groups)) if (!allowed.has(id)) delete p.groups[id]
  const ids = Object.keys(p.groups)
  if (ids.length > MAX_GROUPS) {
    for (const id of ids.slice(0, ids.length - MAX_GROUPS)) delete p.groups[id]
  }
  return p
}

/* ---------- teacher ratings ----------
   Written the moment the teacher taps. A reload mid-class loses nothing
   because nothing is held in memory waiting to be flushed.               */
const emptyTeacher = () => ({ v: 1, days: {} })
export const RATINGS = ['got_it', 'struggled']

export function teacher() { return read(KEYS.teacher, emptyTeacher()) }

export function rate(entryId, rating, date = today()) {
  if (!RATINGS.includes(rating)) throw new UnknownRatingError(rating)
  const t = teacher()
  const day = (t.days[date] ||= {})
  ;(day[entryId] ||= []).push(rating)
  write(KEYS.teacher, trimDays(t))
  return day[entryId]
}

export function ratingsFor(entryId, date = today()) {
  return teacher().days[date]?.[entryId] || []
}

/** Ratings as plain text a teacher can read, paste or hand over. */
export function exportRatings() {
  const t = teacher()
  const days = Object.keys(t.days).sort()
  if (!days.length) return 'Sin valoraciones todavia.'
  const lines = []
  for (const d of days) {
    lines.push(d)
    for (const [id, list] of Object.entries(t.days[d]).sort()) {
      const got = list.filter(r => r === 'got_it').length
      const str = list.filter(r => r === 'struggled').length
      lines.push(`  ${id}  lo logro ${got}  le costo ${str}`)
    }
  }
  return lines.join('\n')
}

function trimDays(t) {
  const days = Object.keys(t.days).sort()
  for (const d of days.slice(0, Math.max(0, days.length - MAX_DAYS))) delete t.days[d]
  return t
}

const today = () => new Date().toISOString().slice(0, 10)

export class UnknownRatingError extends Error {
  constructor(r) { super(`Unknown rating "${r}"`); this.name = 'UnknownRatingError' }
}

/* ---------- prefs ---------- */
const emptyPrefs = () => ({ v: 1 })
export function prefs() { return read(KEYS.prefs, emptyPrefs()) }
export function setPref(name, value) {
  const p = prefs()
  p[name] = value
  write(KEYS.prefs, p)
  return p
}

/** Wipe every key this module owns. Nothing else is touched. */
export function clearAll() {
  for (const k of KEY_LIST) { try { store().removeItem(k) } catch {} }
}
