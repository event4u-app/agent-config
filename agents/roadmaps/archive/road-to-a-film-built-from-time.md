---
complexity: structural
status: ready
tree_pin: 03581ff791
execution:
  mode: phase-checkpoints
review_by: 2026-12-15
estate_growth_exempt: "2026-11-02 change: one skill (`code-film`). No existing skill can carry it: `motion-choreographer` writes prompts for paid providers and never renders, and `fe-design` § Motion holds UI values that are wrong for film, so the film procedure, its corpus and its witness need their own trigger (admission row in agents/decisions/skill-admissions.jsonl). The description cost is paid by shortening `motion-choreographer`, so description tokens hold at 11,487."
estate_offset_exempt: "Created and executed in one change on the owner's instruction of 2026-11-02 (\"danach arbeite die roadmaps ab mit /roadmap:process-full\"); it archives in the same PR, so the active estate does not grow. Owner search at 03581ff791 (grep -rIl -i for 'motion film', 'seek contract', 'code-rendered', 'film profile', 'code-film', 'loudnorm' over agents/roadmaps/*.md, later, stubs) returned nothing."
relates:
  - slug: later/road-to-svg-witness-provenance
    relation: disjoint
    note: "Same witness vocabulary (verified | static-only | unassessed, digest equality as the only road to verified). The film profile is a new module beside the asset profile; no step there changes."
  - slug: later/road-to-breadth-with-depth
    relation: disjoint
    note: "Owns the video domain (5.3). Loudness measurement lands here first (4.1); 5.3 consumes it. The follow-on (gates, grounding, sound layer, benchmark) is carried there as 5.3a."
---
# Road to a film built from time

> **Source:** `agents/tmp.old/inbox-2026-11-e/` (topics t1, t2, t3 — three supplied plans v3 plus their transcripts).
> **Arrivals:** 1 — `inbox-2026-11-e` (2026-11-02).

## Goal

Code-rendered motion film. A user who asks the agent for a short motion film — launch clip, kinetic type,
animated chart, explainer — gets one built **from time, not played in real
time**: every frame is a pure function of `t`, the film is captured headless and
encoded, and every claim about it comes from a check that ran on its frames:
deterministic (rendered twice in different orders, equal digests), on its
declared format, below the photosensitivity floor, and — when it has sound —
measured for loudness. A check that could not run says `unassessed`, never
`passed`. The craft knowledge is first-party and MIT.

Not promised: that the film is *good*. No deterministic witness exists for that.

## Context at the pin (`03581ff791`)

| ID | Defect | Witness |
|---|---|---|
| D1 | No code-rendered film class. 0 files in `src/` name a seek-from-time page contract, a frame-sequence renderer, or a photosensitivity floor. | `grep -rIil -e hyperframes -e remotion -e __seek -e photosensitiv src` → 0 |
| D2 | The asset witness cannot see a scripted page: JS is off for the whole context, so a page-defined `window.__seek` never exists. Extending `seekInPage` alone (t1 2.2) is unexecutable as written. | `uiRenderAsset.ts:502` (`javaScriptEnabled: false`), `:1049` |
| D3 | Frames are taken at three instants; no per-frame digest, no determinism proof. | `uiRenderAsset.ts:587-598` |
| D4 | The only motion authority is UI-scoped and the sole carrier; a film inherits "above 500 ms almost never" and the bounce ban. | `fe-design/references/design-patterns.md` § Motion |
| D5 | No loudness or true-peak measurement anywhere in `src/`. | `grep -rE 'loudnorm|ebur128|LUFS' src` → 0 |
| D6 | Two dead sibling links in the audio contract. | `ai-video/lib/audio-adapter-contract.md:5,204` |
| D7 | "Make a motion video" has one lexical candidate, the generative-provider skill. | `motion-choreographer/SKILL.md:4` |

## Phase 1 — A film-motion authority beside the UI one

- [x] **1.1** One scope sentence in `design-patterns.md` § Motion: it governs interactive UI; time-based film goes to the film carrier. No UI value changes. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/lint_motion_authority_drift.ts -->
  verify: `lint_motion_authority_drift` green and unchanged in verdict.
- [x] **1.2** `src/skills/code-film/references/film-motion.md`: shot-length bands, closed-form spring with overshoot **≤ 5 %**, hold rule (reading time at a stated words-per-second), transitions as continuity of a persisting element, one held accent colour, the flash floor, and the seek contract (§ Build). <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/lint_motion_authority_drift.ts -->
  verify: the file states the overshoot bound as a number the 1.3 lint parses.
- [x] **1.3** `lint_motion_authority_drift` gains a film pair: the overshoot bound is parsed from `film-motion.md`, and every `recipes.csv` row is checked — no elastic/bounce token, stated overshoot within the bound. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/lint_motion_authority_drift.ts -->
  verify: a planted elastic recipe fails; a bounded spring passes; UI checks unchanged.

## Phase 2 — The film witness (`ui:render --profile film`)

- [x] **2.1** New module `uiRenderFilm.ts`, reached as `--profile film` on the existing verb (ADR-041). Scripts **on**, network **off**: offline context, every non-`file:` request aborted, file reads confined to the project roots. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/commands/uiRender.ts -->
  verify: a fixture that tries `fetch`, `WebSocket`, a remote `<img>` and a `file:` read outside the root captures normally and records every blocked attempt.
  reach exempt: the five flagged names (CAPTURED_PROPERTIES, VIEWPORTS, collectPalette, collectTypeFamilies, slugify) are pre-existing page-profile exports of uiRender.ts read only by its own test; this step's code is reached from src/cli/main.ts through runUiRender → runFilmProfile → runFilmRender.
- [x] **2.2** Seek by form, never by name: `window.__seek(t)` (sync or promise), else `window.render(t)`, else WAAPI/SMIL; no recognised form → `unassessed` with reason. Duration/fps from `window.__videoMeta` or `--duration`/`--fps`. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/commands/uiRender.ts -->
  verify: `__seek`, `render(t)` and WAAPI fixtures yield distinct frames at 0 and mid; a form-less page yields `unassessed`, never empty frames.
  reach exempt: the five flagged names (CAPTURED_PROPERTIES, VIEWPORTS, collectPalette, collectTypeFamilies, slugify) are pre-existing page-profile exports of uiRender.ts read only by its own test; this step's code is reached from src/cli/main.ts through runUiRender → runFilmProfile → runFilmRender.
- [x] **2.3** Per-frame manifest (`t`, SHA-256), `distinct_frames`, and a dead-time sweep (identical consecutive frames longer than the declared hold). <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/commands/uiRender.ts -->
  verify: a fixture with a 2 s still in the middle yields exactly one dead-time finding with its window.
  reach exempt: the five flagged names (CAPTURED_PROPERTIES, VIEWPORTS, collectPalette, collectTypeFamilies, slugify) are pre-existing page-profile exports of uiRender.ts read only by its own test; this step's code is reached from src/cli/main.ts through runUiRender → runFilmProfile → runFilmRender.
- [x] **2.4** Determinism proof: a second pass in reverse order; any digest mismatch names the first frame and exits non-zero. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/commands/uiRender.ts -->
  verify: unseeded `Math.random` fixture → `deterministic: false (frame N)`, exit ≠ 0; seeded → `true`.
  reach exempt: the five flagged names (CAPTURED_PROPERTIES, VIEWPORTS, collectPalette, collectTypeFamilies, slugify) are pre-existing page-profile exports of uiRender.ts read only by its own test; this step's code is reached from src/cli/main.ts through runUiRender → runFilmProfile → runFilmRender.
- [x] **2.5** Renderer absent (no Playwright) → exit non-zero, `unassessed`, the missing capability named. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/commands/uiRender.ts -->
  verify: unit test on the absence path.
  reach exempt: the five flagged names (CAPTURED_PROPERTIES, VIEWPORTS, collectPalette, collectTypeFamilies, slugify) are pre-existing page-profile exports of uiRender.ts read only by its own test; this step's code is reached from src/cli/main.ts through runUiRender → runFilmProfile → runFilmRender.

## Phase 3 — Encode and the delivery floor

- [x] **3.1** `--out <file.mp4>`: frames piped to the system ffmpeg (H.264, yuv420p), optional `--audio` muxed; `verified` only when the manifest's file digest equals the file on disk. ffmpeg absent → `static-only`, named. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/commands/uiRender.ts -->
  verify: fixture film encodes; digest recorded equals `sha256sum` of the file.
  reach exempt: the five flagged names (CAPTURED_PROPERTIES, VIEWPORTS, collectPalette, collectTypeFamilies, slugify) are pre-existing page-profile exports of uiRender.ts read only by its own test; this step's code is reached from src/cli/main.ts through runUiRender → runFilmProfile → runFilmRender.
- [x] **3.2** W8 declared format: `ffprobe` width/height/fps/duration against the declared meta; a mismatch is a finding. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/commands/uiRender.ts -->
  verify: a fixture whose declared fps differs from the encoded fps exits non-zero naming `fps`.
  reach exempt: the five flagged names (CAPTURED_PROPERTIES, VIEWPORTS, collectPalette, collectTypeFamilies, slugify) are pre-existing page-profile exports of uiRender.ts read only by its own test; this step's code is reached from src/cli/main.ts through runUiRender → runFilmProfile → runFilmRender.
- [x] **3.3** W7 flash floor, fail-closed: per-frame mean relative luminance; a flash is a pair of opposing changes ≥ 10 % where the darker state < 0.8; more than three flashes in any one-second window fails. Saturated-red flashes counted separately. No flag lowers it. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/commands/uiRender.ts -->
  verify: a 6 Hz full-frame black/white fixture fails; a slow fade passes.
  reach exempt: the five flagged names (CAPTURED_PROPERTIES, VIEWPORTS, collectPalette, collectTypeFamilies, slugify) are pre-existing page-profile exports of uiRender.ts read only by its own test; this step's code is reached from src/cli/main.ts through runUiRender → runFilmProfile → runFilmRender.
- [x] **3.4** W3 contact sheet: one tile per sampled beat/shot (default 12) written as `contact.png` before the full encode. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/commands/uiRender.ts -->
  verify: `contact.png` exists with the declared tile count before `--out` is written.
  reach exempt: the five flagged names (CAPTURED_PROPERTIES, VIEWPORTS, collectPalette, collectTypeFamilies, slugify) are pre-existing page-profile exports of uiRender.ts read only by its own test; this step's code is reached from src/cli/main.ts through runUiRender → runFilmProfile → runFilmRender.

## Phase 4 — A measured audio floor (ffmpeg only)

- [x] **4.1** `src/scripts/media/lib/audio-qa.sh`: path → JSON `{integrated_lufs, true_peak_dbtp, lra, silence_spans[], mono_fold_loss_db, duration}`; report only, changes nothing. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/media/lib/audio-qa.sh -->
  verify: generated fixtures (quiet sine, near-full-scale sine, antiphase stereo, silence) each yield the expected field; a stubbed constant output fails the test.
- [x] **4.2** The film profile runs `audio-qa` on `--audio` and writes it into the manifest. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/commands/uiRender.ts -->
  verify: a film fixture with a generated sine track carries `audio_qa.integrated_lufs` in its manifest.
  reach exempt: the five flagged names (CAPTURED_PROPERTIES, VIEWPORTS, collectPalette, collectTypeFamilies, slugify) are pre-existing page-profile exports of uiRender.ts read only by its own test; this step's code is reached from src/cli/main.ts through runUiRender → runFilmProfile → runFilmRender.
- [x] **4.3** Fix D6's two dead links. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/media/lib/audio-qa.sh -->
  verify: both links resolve (`check_refs` clean on the file).

## Phase 5 — The skill and its first-party corpus

- [x] **5.1** Skill `code-film` (pack `ai-video`, experimental): procedure — inputs → one concept → bans with alternatives → grid (declared tempo, or `allin1.sh` beats when installed) → build on the seek contract → contact sheet (max three passes) → render through the film profile → report with every check `ran`/`skipped`. Explainers add a claims step: every on-screen figure, name and date has a source or is marked as the user's. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/lint_motion_authority_drift.ts -->
  verify: the skill passes `lint-skills`; the procedure names the film profile and the report vocabulary.
- [x] **5.2** Corpus on the existing engine: `code-film/data/manifest.json` + `recipes.csv` (13 rows), `tells.csv` (tell, why, ban, alternative, witness), `renderers.csv` (licence, setup, fit — detect-and-route only, nothing bundled). Written fresh; no source prompt text. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/lint_motion_authority_drift.ts -->
  verify: `ground.mjs validate` passes; drift lint green.
- [x] **5.3** Routing: `motion-choreographer` description names `code-film` as the code-rendered sibling; `code-film/evals/triggers.json` with positives and negatives routing to `motion-choreographer` and `fe-design`. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/lint_motion_authority_drift.ts -->
  verify: `triggers.json` parses; positives and negatives present for both siblings.
- [x] **5.4** Maintainer reference lane: one `skills-provenance.yml` entry, `kind: inspired_by`, licence MIT, source fields ENC1. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/lint_motion_authority_drift.ts -->
  verify: no plaintext source in the entry; `check_no_external_sources` holds its baseline.
- [x] **5.5** Counts, cross-references and projections regenerated (`task sync`, `task generate-tools`). <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/lint_motion_authority_drift.ts -->
  verify: `task sync` leaves no diff on a second run; the count gates are green.

## Phase 6 — Contract and verification

- [x] **6.1** `docs/contracts/film-page.md`: the seek contract (`__seek`, `__videoMeta`, `render(t)`, no wall clock, seeded randomness, no live CSS animation in render mode) and the film manifest fields. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/commands/uiRender.ts -->
  verify: the doc names every manifest field the film profile writes.
  reach exempt: the five flagged names (CAPTURED_PROPERTIES, VIEWPORTS, collectPalette, collectTypeFamilies, slugify) are pre-existing page-profile exports of uiRender.ts read only by its own test; this step's code is reached from src/cli/main.ts through runUiRender → runFilmProfile → runFilmRender.
- [x] **6.2** Changed-files type-check and lint; the touched test files green; the repository's link and count gates green. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/commands/uiRender.ts -->
  verify: the command output is quoted in the PR body.
  reach exempt: the five flagged names (CAPTURED_PROPERTIES, VIEWPORTS, collectPalette, collectTypeFamilies, slugify) are pre-existing page-profile exports of uiRender.ts read only by its own test; this step's code is reached from src/cli/main.ts through runUiRender → runFilmProfile → runFilmRender.

## Decisions

| ID | Decision | Route | Record |
|---|---|---|---|
| E1 | Own roadmap, not folded into `breadth-with-depth` (parked, owns editing) | run | no owner found (frontmatter search) |
| E2 | No source prompt text in the tree; corpus is first-party | run — the conservative side of three floors | `source-confidentiality`, `content-quoting-floor`, `lint_provenance` |
| E3 | New skill `code-film`, not a reference under `fe-design` | run | different artifact class with its own witness |
| E4 | Pack `ai-video` | run | audio adapters and media lib live there |
| E5 | Default renderer: plain HTML + seek contract; no renderer bundled | run | licence thresholds on one React renderer (company licence above three employees) |
| E6 | Film profile runs page scripts, offline and root-confined; asset profile stays JS-free | run | risk register row 1 |
| E7 | Flash floor fail-closed, not overridable | run | safety floor |
| E8 | The archived kill on a creative-production vertical is lifted for this scope | owner | owner turn 2026-11-02: "danach arbeite die roadmaps ab mit /roadmap:process-full" over this scope |

## Risk register

| Risk | Mitigation |
|---|---|
| Page scripts exfiltrate through channels `page.route` misses (WebSocket, WebRTC) | Offline context plus route abort plus a blocking probe fixture (2.1); WebRTC is named as residual |
| Determinism differs across machines (fonts, GPU) | The proof is per machine, stated in the manifest |
| Playwright is a devDependency, absent for most consumers | 2.5: a named `unassessed`, never a silent pass |
| Flash heuristic under- or over-fires | Fixture pair in 3.3; thresholds stated once in `film-motion.md` |

## Acceptance criteria

- [x] AC-1 A canvas film is seen by the witness and its network attempts fail visibly. verify: the matching phase fixture.
- [x] AC-2 Determinism is proven or the first diverging frame is named. verify: the matching phase fixture.
- [x] AC-3 A strobing fixture fails the flash floor; no option lowers it. verify: the matching phase fixture.
- [x] AC-4 `audio-qa` reports LUFS and true peak with ffmpeg only. verify: the matching phase fixture.
- [x] AC-5 `code-film` validates, routes, and its corpus passes `ground.mjs validate`. verify: the matching phase fixture.
