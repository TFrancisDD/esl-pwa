# English con Fútbol — ESL PWA

Phonics app for Spanish-speaking children aged 6–9 in Guatemala. Spanish UI, English target
words. **No server, no login, no auth** — a child reaches content in one tap.

Live: **https://esl-pwa.vercel.app**

---

## Stack

| | |
|---|---|
| Framework | React 18 |
| Build | Vite 5 |
| Styling | CSS Modules + CSS custom properties |
| PWA | `vite-plugin-pwa` (Workbox, `autoUpdate` service worker) |
| Host | Vercel, deployed from `main` on this repo |

No backend. No database. No API. Progress is device-local `localStorage`.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/
npm run preview    # serve dist/ locally
```

Node 18+ (developed on Node 22).

Regenerate the PWA icons (they are generated, not authored):

```bash
python3 tools/make-icons.py
```

## Where the contract lives

**The data contract is `claude/ESL_PWA_Data_Contract.md` in the `ESL Guatemala Lessons`
project knowledge — not in this repo.** It is the single interface between curriculum
content and app code. Every surface reads it and nothing else.

Three rules it imposes on anything built here:

- `ESL_Unit_Registry.md` is master; `esl_unit_registry.json` is generated and never hand-edited
- **IDs are permanent and never invented downstream.** No surface creates an ID, and no surface
  matches on a display label — legacy names resolve through a declared `legacyKeys` alias at
  build time, never by string matching at runtime
- **No IPA anywhere.** Spanish orthography only, in every field a child or teacher sees

The build backlog (`claude/ESL_PWA_Build_Backlog.md`) carries the acceptance criteria for
every story. Story IDs like `P0-E1-S1` are permanent and mean one thing forever.

The document and registry generators (`build-docs.mjs`, `build-tracker.mjs`,
`scripts-build-registry.mjs`) are **not** in this repo yet — they live in
`claude/ESL_PWA_Toolchain.md` and still carry absolute session paths. Moving them here and
normalising those paths belongs to `P0-E2`, which owns the generator. Flagged as `F-29`.

`tools/` currently holds only `make-icons.py`, which generates the app's own PWA icons.

---

## Branch model

- `main` is production. Every push to `main` deploys to production automatically.
- `main` is protected: no force-push, no deletion.
- Feature branches are named `phase/epic-slug` — e.g. `p1/audio-engine`, `p0/data-generator`.
- Every non-`main` branch gets its own Vercel preview URL. Previews are password-protected;
  production is not.
- Merge to `main` via pull request. Nothing else reaches production.

## Deploy

Push to `main`. That is the whole procedure.

```bash
git switch -c p1/audio-engine   # work on a branch
# ...commit...
git push -u origin p1/audio-engine   # -> preview URL, protected
# open a PR, merge to main          -> production deploy, public
```

The old path — building locally and uploading the `dist/` folder to Vercel by hand — **is
retired.** Do not use it. A direct upload creates a production deployment with no commit
behind it, which makes the next rollback ambiguous.

## Rollback

A bad deploy is reversed by promoting the last good one. It takes about a minute and needs
no rebuild.

1. Vercel dashboard → project `esl-pwa` → **Deployments**
2. Find the last deployment that was good. Every row shows its commit message and SHA.
3. **⋯ → Promote to Production** (Instant Rollback). Confirm.
4. Reload https://esl-pwa.vercel.app **in a private window** and confirm two things: the old
   build is serving, and there is no login screen.
5. Fix forward on a branch. Do not leave `main` pointing at a broken commit — the next push
   to `main` will redeploy it.

Who can run it: anyone with write access to the Vercel project. Today that is T.

If the service worker is serving a stale shell after a rollback, hard-reload once
(`Cmd/Ctrl+Shift+R`). The worker is `autoUpdate` and picks up the promoted build on the
next launch.

---

## ⚠️ Production must never sit behind a login

Vercel Authentication is **on by default for new projects** and can come back by accident —
a project re-link, a team setting, a fresh import all re-enable it.

**It must stay off for production.** The children this is built for are 6–9 years old on
shared, low-end devices, often with no reliable connection. There is no account system and
there never will be: a login screen does not slow them down, it stops them completely.
One tap to content is the rule the whole app is designed around.

**Preview deployments are the opposite — they stay protected**, so unfinished work is never
publicly reachable at a guessable URL.

Verify production **signed out, in a private window.** Checking from a logged-in browser
proves nothing: Vercel Authentication is invisible to the account that owns the project.

Tracked as `F-06` on story `P0-E1-S4`.
