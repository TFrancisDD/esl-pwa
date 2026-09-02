import * as R from '../src/lib/registry.js'
import * as A from '../src/lib/audio.js'
import * as S from '../src/lib/storage.js'

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


/* ================= P1-E3 Local State and Storage ================= */

/* a Storage-shaped double we can make fail on demand */
const fakeStore = (opts = {}) => {
  const m = new Map()
  return {
    getItem: k => (opts.corrupt && m.has(k) ? '{not json' : (m.has(k) ? m.get(k) : null)),
    setItem: (k, v) => { if (opts.full) throw new Error('QuotaExceededError'); m.set(k, String(v)) },
    removeItem: k => { m.delete(k) },
    keys: () => [...m.keys()]
  }
}

/* ---- P1-E3-S1 versioned storage keys ---- */
t('only three versioned keys exist', () =>
  eq(Object.values(S.KEYS).sort(), ['esl_progress_v1', 'esl_prefs_v1', 'esl_teacher_v1'].sort()))
t('every key carries a version suffix', () =>
  ok(Object.values(S.KEYS).every(k => /_v\d+$/.test(k))))
t('no key is written outside this module — an unversioned key is refused', () => {
  S.useBackend(fakeStore())
  throws(() => S.write('esl_progress', {}), 'UnknownKeyError')
})
t('a real session writes nothing but the three keys', () => {
  const b = fakeStore(); S.useBackend(b)
  S.recordAnswer('U2-BA', true); S.rate('U2-BA', 'got_it', '2026-09-01'); S.setPref('lang', 'es')
  ok(b.keys().every(k => Object.values(S.KEYS).includes(k)), 'stray key: ' + b.keys())
})
t('a missing key reads as the default, not undefined', () => {
  S.useBackend(fakeStore())
  eq(S.progress(), { v: 1, groups: {} })
})
t('a corrupt key reads as the default and does not throw', () => {
  const b = fakeStore({ corrupt: true }); S.useBackend(b)
  b.setItem(S.KEYS.progress, 'whatever')
  eq(S.progress(), { v: 1, groups: {} })
})
t('a full or disabled store returns false rather than throwing', () => {
  S.useBackend(fakeStore({ full: true }))
  eq(S.write(S.KEYS.prefs, { v: 1 }), false)
})

/* ---- P1-E3-S2 progress recording ---- */
t('correct and incorrect are recorded per entry ID', () => {
  S.useBackend(fakeStore())
  S.recordAnswer('U2-BA', true); S.recordAnswer('U2-BA', true); S.recordAnswer('U2-BA', false)
  eq(S.answersFor('U2-BA'), { right: 2, wrong: 1 })
})
t('entries do not bleed into each other', () => {
  S.useBackend(fakeStore())
  S.recordAnswer('U2-BA', true); S.recordAnswer('U2-BE', false)
  eq([S.answersFor('U2-BA'), S.answersFor('U2-BE')], [{ right: 1, wrong: 0 }, { right: 0, wrong: 1 }])
})
t('progress survives a reload — same backend, fresh read', () => {
  const b = fakeStore(); S.useBackend(b)
  S.recordAnswer('U2-CI', true)
  S.useBackend(b)                                  // simulates the page coming back
  eq(S.answersFor('U2-CI'), { right: 1, wrong: 0 })
})
t('an unknown entry reads as zero, never undefined', () => {
  S.useBackend(fakeStore())
  eq(S.answersFor('U2-ZZ'), { right: 0, wrong: 0 })
})
t('a group the curriculum no longer offers is pruned — storage stays bounded', () => {
  const b = fakeStore(); S.useBackend(b)
  b.setItem(S.KEYS.progress, JSON.stringify({ v: 1, groups: { G9: { 'OLD-1': { right: 9, wrong: 9 } } } }))
  S.recordAnswer('U2-BA', true)
  eq(Object.keys(S.progress().groups), ['G1'])
})

/* ---- P1-E3-S3 teacher ratings ---- */
t('a rating is written immediately, keyed by entry ID and date', () => {
  S.useBackend(fakeStore())
  S.rate('U2-BA', 'got_it', '2026-09-01')
  eq(S.teacher().days['2026-09-01']['U2-BA'], ['got_it'])
})
t('a reload mid-session loses nothing', () => {
  const b = fakeStore(); S.useBackend(b)
  S.rate('U2-BA', 'got_it', '2026-09-01'); S.rate('U2-BA', 'struggled', '2026-09-01')
  S.useBackend(b)
  eq(S.ratingsFor('U2-BA', '2026-09-01'), ['got_it', 'struggled'])
})
t('the same entry on two days stays two records', () => {
  S.useBackend(fakeStore())
  S.rate('U2-BA', 'got_it', '2026-09-01'); S.rate('U2-BA', 'struggled', '2026-09-02')
  eq([S.ratingsFor('U2-BA', '2026-09-01'), S.ratingsFor('U2-BA', '2026-09-02')], [['got_it'], ['struggled']])
})
t('an unknown rating throws a named error', () => {
  S.useBackend(fakeStore())
  throws(() => S.rate('U2-BA', 'maybe'), 'UnknownRatingError')
})
t('ratings export as readable text, in Spanish, with no IPA', () => {
  S.useBackend(fakeStore())
  S.rate('U2-BA', 'got_it', '2026-09-01'); S.rate('U2-BA', 'struggled', '2026-09-01')
  const out = S.exportRatings()
  ok(out.includes('2026-09-01'), 'has the date')
  ok(out.includes('U2-BA'), 'has the entry ID')
  ok(out.includes('lo logro 1') && out.includes('le costo 1'), 'has readable counts: ' + out)
})
t('an empty export is a sentence, not an empty string', () => {
  S.useBackend(fakeStore())
  ok(S.exportRatings().length > 0)
})
t('ratings are bounded — old days fall off', () => {
  const b = fakeStore(); S.useBackend(b)
  for (let i = 1; i <= 40; i++) S.rate('U2-BA', 'got_it', `2026-01-${String(i).padStart(2, '0')}`)
  ok(Object.keys(S.teacher().days).length <= 30, 'kept ' + Object.keys(S.teacher().days).length)
})

/* ---- P1-E3-S4 shared-device safety (storage half only) ---- */
t('nothing stored names, numbers or identifies a child', () => {
  const b = fakeStore(); S.useBackend(b)
  S.recordAnswer('U2-BA', true); S.rate('U2-BA', 'got_it', '2026-09-01'); S.setPref('lang', 'es')
  const blob = b.keys().map(k => b.getItem(k)).join(' ').toLowerCase()
  for (const w of ['user', 'name', 'child', 'student', 'profile', 'id"', 'streak'])
    ok(!blob.includes(w), `stored payload mentions "${w}": ` + blob)
})

S.useBackend()   // leave the module on a clean in-memory store


console.log(`\n  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
