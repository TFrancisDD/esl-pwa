// P1-E1 — Unit Loader and Content API.
// Every surface gets content through this module. No surface parses the
// registry, builds a file path, or branches on group number.
import data from '../data/group1_entries.json'

export class UnknownGroupError extends Error {
  constructor(id) { super(`Unknown group "${id}"`); this.name = 'UnknownGroupError' }
}
export class UnknownEntryError extends Error {
  constructor(id) { super(`Unknown entry "${id}"`); this.name = 'UnknownEntryError' }
}

// Tile aliasing: some letters display another letter's tile.
const TILE_ALIAS = { PH: 'F', NG: 'N', WH: 'W' }

const cache = new Map()

/** Load a group by ID. Throws on unknown — never returns an empty group. */
export function loadGroup(id) {
  if (cache.has(id)) return cache.get(id)
  const g = data.groups[id]
  if (!g) throw new UnknownGroupError(id)
  cache.set(id, g)
  return g
}

export function entry(entryId, groupId = gating().currentGroup) {
  const e = loadGroup(groupId).entries.find(x => x.id === entryId)
  if (!e) throw new UnknownEntryError(entryId)
  return e
}

export function entries(groupId = gating().currentGroup) {
  return loadGroup(groupId).entries
}

/* ---------- composable filters ----------
   Each returns a predicate. Compose with query().                        */
export const byLetter = letter => e => e.letter === letter
export const byPart   = part   => e => e.part === part
export const byShape  = shape  => e => e.shape === shape
export const bySet    = set    => e => e.set === set
export const playable = ()     => e => e.playable === true
export const hasImage = ()     => e => e.words.some(w => w.imageFile)

/** query(groupId, ...predicates) — all must pass. */
export function query(groupId, ...preds) {
  return entries(groupId).filter(e => preds.every(p => p(e)))
}

/* ---------- media ----------
   Callers never build a path. null is a normal answer.                   */
export function imageFor(e, role = 'word1') {
  const w = e.words.find(x => x.role === role)
  if (!w || !w.imageFile) return null
  return loadGroup(e.group).media.imageBase + w.imageId + fileExt(w.imageFile)
}
const fileExt = f => f.slice(f.lastIndexOf('.'))

export function tileFor(e) {
  const l = (e.letter || '').toUpperCase()
  return TILE_ALIAS[l] || l
}

export function videoFor(groupId = gating().currentGroup) {
  const v = loadGroup(groupId).media.video
  return v && v.id ? v : null          // null until F-03 supplies an ID
}

/* ---------- gating ---------- */
export function gating() { return data.gating }

export function availableGroups() {
  const all = Object.keys(data.groups)
  const cur = data.gating.currentGroup
  const upto = all.indexOf(cur)
  return data.gating.allowPriorGroups ? all.slice(0, upto + 1) : [cur]
}

export const schemaVersion = data.schemaVersion
