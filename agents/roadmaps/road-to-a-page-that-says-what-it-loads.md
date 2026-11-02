---
complexity: lightweight
status: ready
tree_pin: af5ab4dc22
execution:
  mode: phase-checkpoints
review_by: 2026-12-31
estate_growth_exempt: "+1 active_roadmaps, owner-directed in the invocation of round inbox-2026-11-g (2026-11-02: \"danach arbeite die roadmaps ab mit /roadmap:process-full\"): the operator asked for this roadmap to be executed in the same run, which is the stated exception to the WIP cap of 5 for an inbox round."
estate_offset_exempt: "Added, not woken. Owner search at af5ab4dc22 (grep -rlF for third-party-load, superseded-statute, third-party-origins, fonts.googleapis, Impressum over agents/roadmaps/*.md, later, stubs) returned nothing; the nearest neighbour later/road-to-web-launch-readiness-benchmark owns the LLM-arm benchmark, not these rows, and receives only the pre-freeze amendment of 0.1."
relates:
  - slug: road-to-web-launch-readiness-benchmark
    relation: amends-before-freeze
    note: "0.1 changes one fixture input of a protocol that is NOT frozen; its trigger 3 fires and is honoured by an amendment line."
  - slug: road-to-a-site-the-owner-can-sign
    relation: sibling
    note: "Same round, topic T2: the ordered website mission. Its third-party witness slice is folded in HERE (P3, 4.3); the rest is parked in later/."
---
# Road to a page that says what it loads

> **Source:** `agents/tmp.old/inbox-2026-11-g/` (topic T1 — transcript + two supplied plans; topic T2's witness slice).
> **Arrivals:** 1 — `inbox-2026-11-g` (2026-11-02).

## Goal

A consumer site built with AC's help cannot ship three defects — a third-party
resource loaded on first paint, an imprint citing superseded law or carrying
template placeholders, a privacy page that does not name what actually loads —
**without the web-launch-readiness checker saying so in a `file:line` finding**,
and AC never says anything about it beyond technical fact. Every primitive
exists and points inward: a dated-authority contract (`check_web_launch_readiness.ts:170`),
a three-state checker, an offline request-recording browser
(`uiRenderAssetIsolation.ts` `confinePage`), a write-time UI hook. Turn them
outward, one named defect at a time.

## Verified at the pin (af5ab4dc22)

| # | Reading | Evidence |
|---|---|---|
| D1 | Third-party-load detection knows analytics origins only | `check_web_launch_readiness.ts:715` `ANALYTICS_RE`; `grep -rIl` over `src` for `youtube-nocookie\|maps.googleapis\|recaptcha` → 0 |
| D2 | `required-legal-pages` matches paths, never page text | `check_web_launch_readiness.ts:686-698` |
| D3 | The DE benchmark fixture cites `§ 5 TMG` and its ground truth treats the imprint as correct | `tests/fixtures/web-launch-benchmark/local-business/impressum.html:7`; `GROUND-TRUTH.md:41` |
| D6 | Config header says "Nothing reads this file yet" although the loader and `production-validator` read it | `src/config/web-launch-readiness.json:2` |
| D9 | `analyze:post` on-screen-text probe samples the bottom band only | `src/scripts/media_bundle.ts` (band probe) |

## Phase 0 — Truth repairs (no new behaviour)

- [x] **0.1 Remove the TMG trap from benchmark fixture v1** (D3). Replace the
      `§ 5 TMG` line in `local-business/impressum.html` with a neutral current
      line and record a pre-freeze amendment in
      `later/road-to-web-launch-readiness-benchmark.md` (trigger 3).
      verify: `grep -rn "TMG" tests/fixtures/web-launch-benchmark/` → 0;
      `npx vitest run tests/scripts/web_launch_benchmark_fixtures.test.ts` → 0.
- [x] **0.2 Fix the stale config header** (D6): name what reads the file today.
      verify: `npx vitest run tests/scripts/web_launch_readiness_config.test.ts` → 0,
      with a test that the header does not contain "Nothing reads".

## Phase 1 — Pre-register the claim, freeze the corpus (before detector code)

- [x] **1.1 Register `claim:third-party-load-finds-planted`** in `docs/CLAIMS.md`,
      shape of `account-surface-finds-planted`: deterministic, offline,
      read-only; finds every planted defect, flags no safe twin, no decoy.
      verify: entry exists with `status: unbacked`; the registering change holds
      the corpus and no detector.
- [x] **1.2 Freeze corpus `tests/fixtures/third-party-load/`** — one DE
      local-business build: planted (1) gfonts `<link stylesheet>`, (2) CSS
      `@import` of gfonts, (3) `preconnect` to `fonts.gstatic.com`, (4) Maps
      iframe, (5) `youtube-nocookie` iframe, (6) imprint citing `§ 5 TMG`,
      (7) imprint with `[Firmenname]`, (8) privacy page silent on Maps/YouTube;
      safe twins in a `safe/` build at the same paths (self-hosted font,
      click-to-load map with `data-src`, imprint citing `§ 5 DDG`, privacy page
      naming every provider); decoys (README naming `fonts.googleapis.com`,
      `<a href>` to maps, `dns-prefetch` → undecided, footnote `[1]`).
      verify: `ground-truth.json` lists 8 planted rows (9 entries), 6 twins, 5 decoys and
      `npx vitest run tests/scripts/third_party_load_fixtures.test.ts` → 0.

## Phase 2 — Static rows, each against its named defect

Three-state contract throughout: finding / undecided / passed.

- [x] **2.1 `third-party-load-in-markup`** (D1; planted 1–5). Origin extractor
      over loadable contexts only (`<link rel=stylesheet|preconnect|preload|modulepreload>`,
      `<script src>`, `<iframe src>`, media `src`, CSS `@import`, `url()` in
      `@font-face`); anchors, prose and comments excluded. Origins resolved
      against a dated register `src/config/third-party-origins.json`
      (`origin → provider → category → privacy_tokens → evidence → review_by`),
      seeded only with origins the source evidences plus today's analytics
      origins. Unknown origin and click-to-load wrapper → undecided.
      verify: planted 1–5 found with `file:line`; twins and decoys silent;
      `dns-prefetch` undecided — `npx vitest run tests/scripts/third_party_load.test.ts` → 0.
- [x] **2.2 `superseded-statute-in-legal-page`** (D2; planted 6). A dated
      supersession table in the config — one row: `TMG § 5 → DDG § 5,
      effective 2024-05-14`, with `authority` + `review_by` — applied to the
      located imprint. Output is a fact, never a verdict.
      verify: planted 6 found; DDG twin silent; a lapsed `review_by` fails the loader.
- [x] **2.3 `placeholder-in-legal-page`** (planted 7). Bracketed template
      tokens and `lorem ipsum` in a located legal page; `[1]` stays silent.
      verify: planted 7 found; decoy silent.
- [x] **2.4 `privacy-page-provider-coverage`** (planted 8). Each provider 2.1
      found loading must be named in the located privacy page by one of its
      `privacy_tokens`; no privacy text in the build → undecided.
      verify: planted 8 found; twin silent.
- [x] **2.5 Tiers.** All four rows `situational`; `de` escalation: 2.1/2.4 →
      high, 2.2/2.3 → critical, each with `authority` + `review_by`.
      verify: `npx vitest run tests/scripts/web_launch_readiness_config.test.ts` → 0.

## Phase 3 — Runtime witness without a socket

- [x] **3.1 `--render` arm** on `confinePage`: the build directory served
      through the `fulfil` hook under a synthetic origin, scripts on, no
      interaction, no consent click; every other request aborted and recorded.
      Decides 2.1's click-to-load undecided: a wrapper whose URL is never
      requested passes, one that requests anyway is a finding. Playwright
      absent → `unverified`, never a pass.
      verify: planted 1, 2, 4, 5 recorded; the twin's URL not; a test asserts
      zero requests continued to a non-synthetic origin.
- [x] **3.2 State boundary.** Writes nothing, keeps nothing between runs,
      closes the browser in `finally`.
      verify: test asserts the browser closes on a thrown navigation.

## Phase 4 — Reach at write time

- [x] **4.1 Extend the blindspots row** (`ai-code-blindspots/SKILL.md`) from
      font/icon/stylesheet to any third-party resource in shipped markup
      including iframes, plus one row: statute names on legal pages come from
      the dated authority, never from model memory.
      verify: `npx vitest run tests/scripts/ai_code_blindspots_rows.test.ts` → 0
      (no ADR-205 reach test exists in the tree; this one asserts both cells and
      that every checker row they name is configured).
- [x] **4.2 Wire 2.1 and 2.2 into `design_pass_hook`** for UI files —
      advisory, exit 0, register and supersession table as only inputs.
      verify: writing a page with planted 1 or 6 surfaces the finding in the
      hook context; the twin surfaces nothing.
- [x] **4.3 Corpus coherence** (T2 witness slice): the hotlink column in
      `design-intelligence/data/font-pairings-reference.csv` is marked opt-in so
      the corpus no longer contradicts the self-host default.
      verify: the skill text naming the column says opt-in.
      done: already satisfied at the pin — `src/skills/design-intelligence/SKILL.md:133`
      marks the `CSS Import` column **opt-in only** and names `Self-Hosted Route` the
      default; the source plan's claim predates that table. No edit.

## Phase 5 — Wording floor

- [x] **5.1 Closed output vocabulary** for the four rows: "loads", "requests",
      "cites", "superseded on", "does not name", "undecided"; forbidden
      "compliant", "DSGVO-konform", "rechtssicher", "abmahnsicher", "illegal",
      any damages figure. Enforced by a test over the message templates.
      verify: the test fails when a forbidden word is injected.

## Phase 6 — Side defect: on-screen text in `analyze:post`

- [x] **6.1 Probe top, middle and bottom bands**, report the max, keep the 0.06
      bar, name the rung "on-screen text".
      verify: a centre-text frame is flagged, a subtitle frame still is, a
      text-free frame is not — `npx vitest run tests/scripts/media_bundle.test.ts` → 0.

## Decisions

| # | Question | Resolution |
|---|---|---|
| E1 | New roadmap or fold into the benchmark file | New active roadmap — operator asked for execution in the invocation; 0.1 alone amends the benchmark file. |
| E2 | Neutralise the fixture TMG line or seed it as a GT row | Neutralise — removes a scored false positive; reversible; the stale-statute case lives in the new corpus as a planted defect. |
| E3 | Separate deterministic claim | Yes — different mechanism, accepted shape (`account-surface-finds-planted`). |
| E4 | `de` tiers | 2.1/2.4 high, 2.2/2.3 critical, mirroring `required-legal-pages@de`. |
| E5 | Default-on report-only for `de\|eu` and `/audit web` | Owner-reserved (consumer-facing default flip) — carried in `stubs/road-to-a-page-check-on-by-default`, trigger: the claim backs on a held-out corpus. |
| E6 | Render arm classification | Offline, per command, consumer's own build fulfilled from disk, zero egress test-enforced — the `ui:render` Class-A shape; no new class, no ADR amendment. |
| E7 | Further supersession rows (TTDSG→TDDDG) | Only with a named defect each. |

## Kill register

| # | Killed | Why |
|---|---|---|
| K1 | Re-proposing the 09/2026 web-assurance layer | Recorded decline; this is four rows and one arm. |
| K2 | Importing a tracker/filter list as the register | `no_import_decision`. |
| K3 | Probing a consumer's live site | Network path; the arm is offline by construction. |
| K4 | Any compliance verdict or damages figure | P5. |
| K5 | A legal corpus (DSGVO map, cookie matrix) | Outside its pack; one dated supersession row only. |
| K6 | Allow-listing `youtube-nocookie` | It still connects on load; planted 5 keeps it killed. |
| K7 | Consent state machine (accept/reject/revoke) | No named defect in the source; parked in T2's later roadmap. |

## Risk Register

| # | Risk | Mitigation |
|---|---|---|
| R1 | Detector overfit to a corpus its author read | Claim stays `unbacked` until a held-out corpus; stated in the claim. |
| R2 | Register rots like the TMG citation | Every register row carries `review_by`; lapsed date fails the loader. |
| R3 | Render arm leaks a request | Zero-egress assertion is a test, not a comment. |

## Acceptance Criteria

- [x] AC-1 Corpus and claim landed before any detector code.
- [x] AC-2 All 8 planted rows found with `file:line`; 0 twins and 0 decoys flagged.
- [x] AC-3 Render arm continues zero requests to non-synthetic origins.
- [x] AC-4 Fixture v1 carries no superseded statute; amendment recorded.
- [x] AC-5 No output string outside the P5 vocabulary.
- [x] AC-6 Centre-text frame flagged by the media probe.
