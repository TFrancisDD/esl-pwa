// Generates src/data/group1_entries.json from the corpus CSV.
// The CSV is master. Never hand-edit the JSON.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const rows = fs.readFileSync(path.join(ROOT, 'data/Group1_Audio_Image_Corpus.csv'), 'utf8')
  .trim().split('\n').slice(1).map(l => {
    const [entry, shape, clip, says, audio, dur, image, bytes, status, casefix] = l.split(',')
    return { entry, shape, clip, says, audio, dur: +dur, image, status, casefix }
  })

const errors = []
const PART = { name: 1, sound: 2, combination: 3, word: 3 }
const PART_ES = { 1: 'El nombre', 2: 'El sonido', 3: 'Las sílabas y palabras' }

const letterOf = id => {
  const m = id.match(/^LTR-([A-Z])-/) || id.match(/^U[23]-([A-Z])/)
  if (!m) { errors.push(`cannot derive letter from ${id}`); return null }
  return m[1]
}

const byEntry = new Map()
for (const r of rows) {
  if (!byEntry.has(r.entry)) byEntry.set(r.entry, [])
  byEntry.get(r.entry).push(r)
}

const entries = [...byEntry.entries()].map(([id, clips]) => {
  const shape = clips[0].shape
  const sound = clips.find(c => c.clip === 'sound')
  const words = clips.filter(c => c.clip === 'word1' || c.clip === 'word2')
  if (!sound) errors.push(`${id}: no sound clip — every entry must have one`)
  const expected = shape === 'name' || shape === 'word' ? 1 : 3
  if (clips.length !== expected) errors.push(`${id}: shape "${shape}" expects ${expected} clips, found ${clips.length}`)
  return {
    id,
    group: 'G1',
    letter: letterOf(id),
    part: PART[shape],
    partNameEs: PART_ES[PART[shape]],
    shape,                       // alias of clipCount semantics: name/word = 1, sound/combination = 3
    clipCount: clips.length,
    label: sound ? sound.says : null,
    words: words.map(w => ({
      role: w.clip,
      en: w.says,
      es: null,                  // TODO wordEs — pending T
      imageId: w.says.toLowerCase(),
      imageFile: w.image || null
    })),
    anchorEs: null,              // TODO F-28 — per-entry anchor, pending content
    set: 'P',                    // F-43 — nothing marked taught yet
    playable: true
  }
})

// validators
const ids = new Set()
for (const e of entries) {
  if (ids.has(e.id)) errors.push(`duplicate id ${e.id}`)
  ids.add(e.id)
  if (!e.letter) errors.push(`${e.id}: no letter`)
  if (!e.label) errors.push(`${e.id}: no label`)
  for (const w of e.words) if (!w.imageFile) errors.push(`${e.id}/${w.role}: no image for "${w.en}"`)
}
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/group1_clips.json'), 'utf8'))
for (const e of entries) {
  const roles = idx[e.id]
  if (!roles) { errors.push(`${e.id}: absent from group1_clips.json`); continue }
  if (Object.keys(roles).length !== e.clipCount)
    errors.push(`${e.id}: clip index has ${Object.keys(roles).length} clips, entry declares ${e.clipCount}`)
}
for (const id of Object.keys(idx)) if (!ids.has(id)) errors.push(`clip index has ${id}, entry table does not`)

if (errors.length) { errors.forEach(e => console.log('  ERROR ' + e)); console.log(`FAILED — ${errors.length}`); process.exit(1) }

const out = {
  schemaVersion: 2,
  generatedFrom: 'data/Group1_Audio_Image_Corpus.csv',
  gating: { currentGroup: 'G1', allowPriorGroups: true },
  groups: {
    G1: {
      id: 'G1', number: 1, letters: ['A', 'B', 'C', 'D'],
      nameEs: 'Grupo 1 — A B C D',
      media: {
        audioBase: '/audio/group1/',
        imageBase: '/img/group1/',
        video: { provider: 'youtube', id: null, orientation: 'portrait' }
      },
      entryCount: entries.length,
      entries
    }
  }
}
fs.writeFileSync(path.join(ROOT, 'src/data/group1_entries.json'), JSON.stringify(out, null, 2))
const shapes = entries.reduce((a, e) => (a[e.shape] = (a[e.shape] || 0) + 1, a), {})
console.log(`  OK    ${entries.length} entries ·`, JSON.stringify(shapes),
            '· clips', entries.reduce((n, e) => n + e.clipCount, 0),
            '· letters', [...new Set(entries.map(e => e.letter))].join(''))
