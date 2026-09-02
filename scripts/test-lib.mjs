import * as R from '../src/lib/registry.js'
import * as A from '../src/lib/audio.js'

let pass = 0, fail = 0
const t = (name, fn) => { try { fn(); pass++ } catch (e) { fail++; console.log('  FAIL ' + name + ' — ' + e.message) } }
const eq = (a, b, m = '') => { const A_ = JSON.stringify(a), B_ = JSON.stringify(b); if (A_ !== B_) throw new Error(`${m} expected ${B_}, got ${A_}`) }
const ok = (c, m) => { if (!c) throw new Error(m || 'expected truthy') }
const throws = (fn, name) => { try { fn() } catch (e) { if (e.name === name) return; throw new Error(`expected ${name}, got ${e.name}`) } throw new Error(`expected ${name}, nothing thrown`) }

/* ---- P1-E1-S1 load a group by ID ---- */
t('loadGroup returns the group', () => eq(R.loadGroup('G1').entryCount, 28))
t('unknown group throws a named error, never empty', () => throws(() => R.loadGroup('G9'), 'UnknownGroupError'))
t('unknown entry throws a named error', () => throws(() => R.entry('U2-ZZ'), 'UnknownEntryError'))
t('group is cached — same object twice', () => ok(R.loadGroup('G1') === R.loadGroup('G1')))

/* ---- P1-E1-S2 query by letter / part / shape / set ---- */
t('28 entries in G1', () => eq(R.entries().length, 28))
t("byLetter('C') is a filter, not a stored list", () => eq(R.query('G1', R.byLetter('C')).length, 8))
t('letters partition the group', () => eq('ABCD'.split('').map(l => R.query('G1', R.byLetter(l)).length), [6, 7, 8, 7]))
t('byPart(1) = the four letter names', () => eq(R.query('G1', R.byPart(1)).map(e => e.id), ['LTR-A-NAME','LTR-B-NAME','LTR-C-NAME','LTR-D-NAME']))
t('filters compose', () => eq(R.query('G1', R.byLetter('B'), R.byShape('combination')).length, 5))
t('every entry is currently set P — F-43', () => eq(R.query('G1', R.bySet('T')).length, 0))
t('taught pool is empty and that is a known defect', () => ok(R.query('G1', R.bySet('P')).length === 28))

/* ---- P1-E1-S3 media paths ---- */
t('imageFor returns a URL', () => eq(R.imageFor(R.entry('U2-BA'), 'word1'), '/img/group1/bat.jpg'))
t('imageFor returns null for a role the entry lacks', () => eq(R.imageFor(R.entry('LTR-A-NAME'), 'word1'), null))
t('imageId is lowercase — dance, not Dance (F-44)', () => eq(R.imageFor(R.entry('U2-DA'), 'word2'), '/img/group1/dance.png'))
t('tile aliasing map is honoured', () => eq(R.tileFor({ letter: 'PH' }), 'F'))
t('videoFor is null until F-03 supplies an ID', () => eq(R.videoFor(), null))

/* ---- P1-E1-S4 gating ---- */
t('current group comes from gating', () => eq(R.gating().currentGroup, 'G1'))
t('future groups are not offered', () => eq(R.availableGroups(), ['G1']))

/* ---- P1-E2-S1 one file per clip ---- */
t('clip returns a path', () => eq(A.clip('U2-BA', 'sound'), '/audio/group1/U2-BA_sound.mp3'))
t('clip path is derived from the ID, no mapping table', () => ok(A.clip('U2-DU', 'word2').endsWith('U2-DU_word2.mp3')))
t('no offsets anywhere — clip returns a string, not a window', () => eq(typeof A.clip('U2-BA', 'sound'), 'string'))

/* ---- P1-E2-S7 / F-24 variable shapes ---- */
t('a name entry has ONE clip', () => eq(A.rolesFor('LTR-A-NAME'), ['sound']))
t('a name entry returns null for word1 — not zero, not empty string', () => eq(A.clip('LTR-A-NAME', 'word1'), null))
t('U3 word entries are one clip too', () => eq(A.rolesFor('U3-AT'), ['sound']))
t('a sound entry has three clips', () => eq(A.rolesFor('LTR-A-S1'), ['sound','word1','word2']))
t('a combination entry has three clips', () => eq(A.rolesFor('U2-CE'), ['sound','word1','word2']))
t('exactly 7 one-clip entries in G1', () => eq(R.entries().filter(e => e.clipCount === 1).length, 7))
t('an unknown role returns null', () => eq(A.clip('U2-BA', 'anchor'), null))

/* ---- P1-E2-S5 suppression ---- */
t('a suppressed entry cannot be played from any surface', () => {
  const e = R.entry('U2-BO'); const was = e.playable; e.playable = false
  const got = A.clip('U2-BO', 'sound'); e.playable = was
  eq(got, null)
})

/* ---- cross-check against the committed clip index ---- */
t('every entry role resolves to a real clip path', () => {
  for (const e of R.entries()) for (const r of A.rolesFor(e.id)) ok(A.clip(e.id, r), `${e.id}/${r}`)
})
t('70 clips total', () => eq(R.entries().reduce((n, e) => n + e.clipCount, 0), 70))

console.log(`\n  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
