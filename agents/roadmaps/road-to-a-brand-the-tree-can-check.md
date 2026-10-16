---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-a-canvas-the-code-owns
    relation: extends
    note: "Active (ready). Owns the visual off-brand finding (8.2 Lock carrier, flags-not-blocks, brownfield baseline) and the DTCG import lane (0.4 alias control, 3.1 alias record and cycles). This roadmap owns the generator and validator in design-tokens/scripts/tokens.ts, which canvas does not touch; Phase 3 hands canvas 8.2 the palette reading it consumes and adds one object-valued alias row to canvas's 0.4 fixture only after canvas 3.1 lands. No visual gate is planned here."
  - slug: later/road-to-voice-negative-lexicon
    relation: supersedes
    note: "Parked 2026-08-05 on a capacity slot only (its own header). Its validator design is kept verbatim and generalised from one voice primitive to three plus a claim-phrase list (Phase 5). Its pre-registered spike still decides the user-schema half (5.5). Archived by step 5.7 once 5.1 ships."
  - slug: road-to-type-with-a-witness
    relation: disjoint
    note: "Active. Font construction and the font witness; nothing here touches type carriers or font licensing."
estate_offset_exempt: "Adds one active roadmap. Archiving, parking or merging each cost more: no active, later or stub roadmap owns brand-state reporting, an organisational voice primitive, a lexicon or claim check on drafted prose, the ghostwriter ignore path, or brand reads in producer skills (rg over agents/roadmaps for brand-voice, tokens.json, reference/ghostwriter, taboo, claim, 2025.10 at main@085ec41ff returns only archived files and the parked lexicon roadmap); canvas owns only the visual finding and the import lane. Step 5.7 archives later/road-to-voice-negative-lexicon when Phase 5 lands, so the later estate shrinks by one."
---
# Road to a brand the tree can check

> **Source:** `agents/tmp.old/inbox-2026-10-s/` — a maintainer transcript (two
> turns) asking for a deep analysis of what this package can learn from eight
> external brand-guideline and brand-content skill sources plus web research, a
> roadmap revised in three loops, then a second three-loop deep analysis down to
> a final roadmap. Delivered beside it: four supplied plans from two hosts (a
> first-host voice roadmap, a second-host brand-intelligence roadmap, a
> second-host deep-dive revision built on both, and a first-host master
> consolidation) plus two analysis notes. The master declared two parents and
> **omitted the deep-dive revision, which predates it**; its surviving items are
> folded in below and marked `folded-from-deep-dive`. Every claim was re-verified
> at `main@085ec41ff`; brand surfaces are byte-identical to the plans' pin except
> `src/skills/brand/SKILL.md` (+4 lines, unrelated trademark column). Steps tagged
> `corrected-from-reproduction` differ from the source because running the
> source's own step gave a different result.
>
> **The governing constraint is the plans' shared one, never contradicted by the
> transcript:** integrate and make true what exists — no second brand engine, no
> third store of brand truth, no new skill per medium. It is AC-1, AC-7 and a
> non-goal, not a phase step.

## Goal

1. One resolver answers "what brand does this project have" — tokens, voice,
   design system — with a state, content hashes and the reason, and never calls
   a broken or shadowed file a brand.
2. Every surface that names the token file or the voice profile names the file
   the code reads and the same shape.
3. Real-person ghostwriter profiles are ignored and linted at the path every
   command writes them to.
4. The token toolchain reads stable DTCG 2025.10 and never emits a value it
   could not serialise; `validate` checks the span, not the line.
5. The brand voice is one schema-checked context-spine slot that the copy skills
   declare and the producer skills consult.
6. "Never say X" and "this claim needs a proof" are checked **on the draft**,
   deterministically, for the brand, the user and the ghostwriter profile.
7. Whether the slot needs a runtime carrier is measured before one is built, and
   a non-brand task still costs zero brand bytes.
8. Nothing in the tree calls itself a gate unless something runs.

## Context — reproduced at `main@085ec41ff`

Reproduction probes ran offline under `agents/runtime/tmp/`; nothing tracked was
written.

**D1 — The token file has two names.** The code reads `tokens.json`
(`scaffold.ts:56`, `uiRenderAssetTypes.ts:63`, `cmd_brand_status.ts:52`).
Authored surfaces tell the reader to write `.tokens.json`: 49 lines today
(reproduced with the 1.2 verify below), across `brand-to-tokens` (incl. its deck
templates), `brand-asset-generation` (so asset generation loads a file the
resolver never reads), `brand-identity`, `design-system-capture` and two
references, `design-intelligence` references, `/brand`, `/brand:tokens`,
`/brand:review`, the brand domain README, `brand-token-consumption.md`,
`command-clusters.md`; outside the gate scope `command-flows.md`, ADR-061 and two
generated catalogues. `brand-to-tokens/SKILL.md:32-51` records the split as
"Recorded, not resolved" and calls the name "a consumer-visible decision …
deliberately not changed here" (2026-09-09) — a deferral with no owner, no
blocker and no revisit condition. Likely origin: DTCG recommends `.tokens.json`
as an *extension* (`brand.tokens.json`); read as a filename it became a dotfile.
Recurrence: the dotted name was carried by three earlier inbox rounds and by the
archived design-system onramp; `brand:status` was built to flag it rather than
fix it.

**D2 — Stable DTCG breaks the generator silently.** DTCG 2025.10 makes a colour
`$value` an object (`colorSpace`, `components`, optional `alpha`, optional
`hex`) and a dimension `{value, unit}`. Reproduced: `tokens.mjs generate -c` on
an object colour and an object dimension prints
`--primitive-color-brand: [object Object];` and
`--primitive-space-md: [object Object];`, exit 0 (`tokens.ts:186-207` resolves,
`tokens.ts:620` stringifies). `colorSpace` occurs in no `src/` file; the starter
template ships string hex. Recurrence: DTCG 2025.10 was named "stable enough to
commit to" in the archived image-brand-typography roadmap (2026-06) and proposed
again in three later inbox rounds; it never became a step.

**D3 — `validate` is brand-blind and skips whole lines.** It takes only `--dir`
and never reads the registered tokens; any line containing `var(--` is skipped
(`tokens.ts:432`). Reproduced: `.a { color: #ff0000; background: var(--x); }`
passes while the next line's `#00ff00` is reported.

**D4 — No organisational voice primitive; incompatible shape claims.** People
have three schema-checked voice primitives (personas, `.agent-user.md` via
`src/shared/userMd/schema.ts`, ghostwriter profiles with fingerprint, ≤3 samples,
`taboos`, verification, 90-day staleness, lint). The brand has none.
`brand-strategy/SKILL.md:52,65` says 3-5 traits with do/don't;
`voice-and-tone-design/SKILL.md:71,149,161` says exactly three "X, not Y";
`/brand:voice` (`brand/voice/command.md:9,23`) promises a "do/don't lexicon" the
bound skill never produces. No path is named; every brand skill declares
`write: []`. Readers point at the missing artefact:
`brand-source-of-truth.md:31,37`, `/brand:review`, and `humanizer`'s fixed
precedence "profile fingerprint > registered brand voice > humanizer defaults"
(`humanizer/SKILL.md:61`). Context-spine slots carry no schema: the lint checks
skill frontmatter only (`context-spine.md:9`); 46 skills declare
`context_spine:`, and `release-comms` has no voice reference at all.

**D5 — Negative lists are declared and never checked.** `ghostwriter-schema.md:113`
says `taboos` feed a negative-constraint pass; the pass is a pre-draft prompt
line (`ghostwriter/write/command.md:95-97`) and no `.ts` file reads `taboos`.
The user schema has no negative list. The tell detector's `exclude` set
(`detect_ai_tells.ts:324,351`) is passed only by the humanizer bench.

**D6 — Claims are proofed at strategy level only.** `messaging-architecture`
requires three defensible proofs per message (`SKILL.md:71-73`); nothing reads a
drafted line for claim shapes; the tell registry has no superlative entry. The
source measured single words on this tree's non-marketing prose (bare `only`
≈33 per 10k words, `best` ≈2) — **not reproduced**: the 319-file corpus is not
enumerated in the source, so the step is `unexecutable` as written; 5.3 is
corrected to pre-register the file list first.

**D7 — Gate citations point at a stub.** `brand-consistency` is `type: manual`
with no router emission, yet is cited as a gate at `brand-to-tokens/SKILL.md:107,127`,
`brand-token-consumption.md:46,72`, `/brand` (`command.md:53`), `/brand:voice`
(`voice/command.md:9,24`), `/brand:review` (`review/command.md:25`), the brand
domain README, `brand/SKILL.md:72,101`, `accessibility-auditor/SKILL.md:180`,
`design-tokens/SKILL.md:175` and `brand-strategy/SKILL.md:77` — eleven
authored sites against the source's five (`corrected-from-reproduction`).
`brand-source-of-truth` calls its half "a concrete Validation gate" (`:36`),
carries no `enforced_by` (42 rules do), and `docs/CLAIMS.md` has no brand or
voice claim.

**D8 — The brand state is contract-only, and `brand:status` overstates it.**
`greenfield | mixed | branded` (`brand-token-consumption.md:39-48`) has no
reader; `findBrandTokens` tests `isFile()` only (`cmd_brand_status.ts:51-60`).
Reproduced: `tokens.json` holding `not json {` beside a valid
`assets/tokens.json` returns `tokens.json` as the brand and never mentions the
second file. The scaffold then instructs "seed from the project's brand/design
tokens" (`scaffold.ts:436-442`).

**D9 — Ghostwriter profiles are not ignored where every command writes them.**
Schema, cluster, `fetch`, `list` and `delete` commands (17 files) store
real-person profiles at `agents/reference/ghostwriter/` and promise "gitignored
by default" (`ghostwriter-schema.md:24,328`). The ignore block covers
`/agents/ghostwriter/*.md` (`gitignore-block.txt:102-104`); the lint scans
`agents/ghostwriter` (`lint_ghostwriter_source.ts:313`). Reproduced:
`git check-ignore agents/reference/ghostwriter/x.md` exits 1. Two findings the <!-- ref-ignore -->
source did not have (`corrected-from-reproduction`): `agents-layout.md:90`
classifies `reference/` — `ghostwriter/` named — as **tracked-durable**, so the
layout contract contradicts the schema's promise; and the archived
`step-4-ghostwriter` roadmap marks "add `agents/reference/ghostwriter/*.md` to
the ignore block" `[x]` while the shipped block (2026-05-18) used the other path
— never true at ship. Privacy defect; Phase 1 leads with it.

**D10 — Producers do not read the brand.** `canvas-design`, `logo-generation`
and `fe-design` carry no token, rule or `brand:status` reference; `html-deck`
cites the rule but no resolver; `brand-asset-generation` reads the dotfile name
(D1). The asset witness already checks marks at 16/32 px and a 3:1 contrast
floor (`uiRenderAssetTypes.ts:82,298`).

**D11 — Two resolver constants.** `BRAND_TOKEN_PATHS` is declared twice
(`scaffold.ts:56`, `uiRenderAssetTypes.ts:63`); `cmd_brand_status` imports the
first, `uiRenderAsset.ts:55` the second.

**D12 — No voice intake, no voice staleness.** Visual intake exists
(`/design-system:import`). Nothing builds a voice from material or marks it
stale. `brand-audit/SKILL.md:39-55` excludes profile surfaces until a
field-level privacy floor exists; still absent.

**Not defects (checked and dropped):** pack reach — `rule_workspaces` ships
`engineering` and `gtm` together (`agent-settings.template.yml:80`),
`rule_packs` is empty (`:105`) and ADR-267 decision 5 binds a completeness
invariant; logo small-size and contrast checks (D10); `brand:status --json`
(exists, `cmd_brand_status.ts:88`); audit classes `on-brand | drift | undefined`
(`brand-audit/SKILL.md:57`); publication of brand content (already behind the
irreversible-external-action row of `non-destructive-by-default`).

## Phase 0 — Control readings (red first)

- [x] **0.1 Name parity, red.** Every authored surface naming the token file
      names a path in the resolver; fails on the D1 list. Generated catalogues
      and ADRs are excluded from the assertion and regenerate or stay historical.
      verify: `npx vitest run tests/scripts/brand_status.test.ts -t token-name-parity --reporter=verbose` -> /✓.*token-name-parity/
      Done 2026-10-16: `token-name-parity` in `brand_status.test.ts` walks `src/skills`, `src/domains` and `docs/contracts` (evals and generated READMEs excluded); red against the 49 dotted lines at the base, green after 1.2.
- [x] **0.2 Status honesty, red.** Fixtures: malformed file, two files with
      different content, two files with identical content, tokens without voice,
      voice without tokens, nothing. Today the first two read "present".
      verify: `npx vitest run tests/scripts/brand_status.test.ts -t state-fixtures --reporter=verbose` -> /✓.*state-fixtures/
      Done 2026-10-16: eight `state-fixtures` cases, seven red at the base (no `state`, `sources` or validity there); the two voice fixtures assert the voice side reads as absent, as 2.3 allows until 4.5.
- [x] **0.3 Object values and same-line skip, red.** 2025.10 colour, dimension
      and alias; `#ff0000` beside `var(--x)`.
      verify: `npx vitest run tests/scripts/skills_design_tokens_tokens.test.ts -t "dtcg-2025|same-line" --reporter=verbose` -> /✓.*dtcg-2025[\s\S]*✓.*same-line/
      Done 2026-10-16: `dtcg-2025` and `same-line` cases in `skills_design_tokens_tokens.test.ts`, seen red against the base `tokens.ts` before 3.1 and 3.2 landed.
- [ ] **0.4 Taboo and claim never checked, red.** A ghostwriter draft containing
      its own taboo and a brand draft containing "the number one platform"
      produce no finding from any tool. (new test file)
      verify: `npx vitest run tests/scripts/check_voice_lexicon.test.ts -t control --reporter=verbose` -> /✓.*control/
- [x] **0.5 Ghostwriter path, red.** The ignore block and the lint roots both
      cover the documented path; fails today.
      verify: `npx vitest run tests/scripts/lint_ghostwriter_source.test.ts -t documented-path --reporter=verbose` -> /✓.*documented-path/
      Done 2026-10-16: `documented-path` checks the managed block with `check-ignore --no-index` in a scratch repository and the lint roots; six of ten cases red at the base.
- [ ] **0.6 Zero brand bytes off-brand, guard.** A backend prompt in a project
      with a full brand produces no brand emission; green today, kept as the
      floor every later phase must hold.
      verify: `npx vitest run tests/scripts/hooks -t no-brand-bytes --reporter=verbose` -> /✓.*no-brand-bytes/
- [x] **0.7 Profile exposure check** (`folded-from-deep-dive`). Before 1.1 lands,
      report how many files under either ghostwriter path are tracked in this
      repository and in its test fixtures — counts only, never names or content.
      A non-zero count outside `README.md` and `fictional: true` fixtures stops
      Phase 1 and goes to the owner as a data-exposure finding.
      verify: `git ls-files agents/reference/ghostwriter agents/ghostwriter | rg -v 'README\.md$' | wc -l` -> /^\s*0$/
      Done 2026-10-16: the count is 0 — only `agents/reference/ghostwriter/README.md` is tracked; Phase 1 proceeds.

## Phase 1 — Small truths (one immediate PR)

- [x] **1.1 Profiles ignored where they live** (E2, first). The ignore block and
      the lint roots cover `agents/reference/ghostwriter/` (canonical) and keep
      `agents/ghostwriter/` (legacy), including `*.md.bak` copies and nested
      files (`folded-from-deep-dive`); `README.md` stays tracked;
      `agents-layout.md:90` names `reference/ghostwriter/` as local-only beside
      the tracked rest of `reference/`. 0.5 goes green. No history rewrite, ever.
      verify: `rg -n 'agents/reference/ghostwriter' src/config/gitignore-block.txt src/scripts/lint_ghostwriter_source.ts docs/contracts/agents-layout.md` -> /reference\/ghostwriter/
      Done 2026-10-16: the block (and `agents-paths.yml`) ignores `agents/reference/ghostwriter/**` and `agents/ghostwriter/**` with `README.md` carved out; the lint scans both roots recursively, canonical first; `agents-layout.md` marks `reference/ghostwriter/` local-only. 0.5 green.
- [x] **1.2 One token name** (E10). The D1 authored surfaces say `tokens.json`;
      routing evals keep the dotted phrasing as a user utterance and gain the
      plain one; generated catalogues regenerate; ADR-061 gets no edit. The
      "Recorded, not resolved" section is deleted. 0.1 goes green.
      verify: `rg -n '\.tokens\.json' src/skills src/domains docs/contracts --glob '!**/evals/**' | rg -v 'NEVER|nothing reads|near-miss'` -> 1 (no output)
      Done 2026-10-16: 14 authored files say `tokens.json`; the "Recorded, not resolved" section is gone; the two trigger evals keep the dotted utterance and gain the plain one; catalogues regenerated; ADR-061 untouched. 0.1 green.
- [ ] **1.3 One constant.** `uiRenderAssetTypes.ts` re-exports the resolver list
      instead of declaring its own.
      verify: `rg -c 'export const BRAND_TOKEN_PATHS' src` -> 1 file
      Open 2026-10-16: a re-export is the edit `uiAudit.ts:35` records as tried and reverted — `dist/cli` is compiled by tsc and the work-engine template tree is not, so a runtime import from the CLI into the template fails to resolve in the published package, and the template stays self-contained the other way. Needs a home both trees may import at runtime.
- [x] **1.4 Citations to the body.** The D7 sites cite `brand-source-of-truth`
      § Iron Law 2; the rule gains `enforced_by: instruction-only`, and
      "Validation gate" reads "checklist" until Phase 5 names its checker.
      verify: `rg -n 'brand-consistency' src/skills src/domains docs/contracts/brand-token-consumption.md --glob '!**/evals/**' --glob '!**/README.md'` -> 1 (no match)
      Done 2026-10-16: the eleven sites cite `brand-source-of-truth` § Iron Law 2; the rule carries `enforced_by: instruction-only: …` and says "checklist".
- [x] **1.5 `/brand:voice` says what it makes today.** "Three attributes, tone
      matrix, consistency review"; the lexicon line returns with 4.3.
      verify: `rg -n 'do/don.t lexicon' src/domains/brand` -> 1 (no match)
      Done 2026-10-16: `/brand:voice` now says three attributes, a tone matrix by context, and a consistency review.

## Phase 2 — `brand:status` tells the state

- [x] **2.1 Parse before present.** Each found file is parsed; invalid JSON or a
      non-DTCG root is `invalid` with the parse error, never present. 0.2 (part)
      goes green.
      verify: `npx vitest run tests/scripts/brand_status.test.ts -t invalid --reporter=verbose` -> /✓.*invalid/
      Done 2026-10-16: `inspectBrand` parses each hit; not-JSON, a non-object root or no `$value` anywhere is `invalid` with the reason, and the brand is the first VALID file.
- [x] **2.2 Shadowed sources reported.** Every hit at the four paths is listed
      with its content hash; equal hashes are `duplicate`, unequal ones are
      `shadowed` with the winner named. Nothing is merged by value.
      verify: `npx vitest run tests/scripts/brand_status.test.ts -t shadowed --reporter=verbose` -> /✓.*shadowed/
      Done 2026-10-16: every hit carries its sha256; equal to the winner is `duplicate`, different is `shadowed` with `winner`; nothing merged by value.
- [x] **2.3 The contract's vocabulary, computed** (E9). `state` is
      `greenfield | mixed | branded` from tokens and the Phase 4 slot, with
      `invalid` and `shadowed` as qualifiers; `sources[]` carries path, sha256
      and kind (`tokens | voice | design-system | design-md`). Computed on every
      call, never persisted. Until 4.5 lands the voice side reads as absent; the
      step ships the tokens half first.
      verify: `npx vitest run tests/scripts/brand_status.test.ts -t state-fixtures --reporter=verbose` -> /✓.*state-fixtures/
      Done 2026-10-16: `brand:status --json` adds `state`, `qualifiers` and `sources[]` (path, sha256, kind, status), computed per call. The contract table's set names are `branded | bare | mixed` — `bare`, not `greenfield`, so `bare` is emitted (E9: one vocabulary). Voice reads as absent until 4.5; `DESIGN.md` is listed as `design-md`; `design-system.json` has no canonical path to search, so that kind is typed and not yet emitted.
- [ ] **2.4 Readers ask the resolver.** The scaffold seed line and the asset
      renderer use the 2.1 validity, not file existence.
      verify: `npx vitest run tests/scripts -t token-seed-invalid --reporter=verbose` -> /✓.*token-seed-invalid/
      Open 2026-10-16: same constraint as 1.3 — the 2.1 validity lives in `src/scripts/_cli/cmd_brand_status.ts`, which neither the template-side scaffold nor the compiled asset renderer can import at runtime.

## Phase 3 — The stable token format

- [x] **3.1 Read 2025.10.** Object colour → `hex` when present, else CSS Color 4
      for the named spaces, with `alpha`; dimension → `<value><unit>`; any other
      object, a non-finite component or an out-of-range value is a hard error
      naming the token path, non-zero exit (`folded-from-deep-dive`); string
      values stay accepted.
      verify: `npx vitest run tests/scripts/skills_design_tokens_tokens.test.ts -t dtcg-2025 --reporter=verbose` -> /✓.*dtcg-2025/
      Done 2026-10-16: `tokenValueToCss` — colour `hex` (8-digit with alpha) or a CSS Color 4 function for 14 named spaces, `{value, unit}` for px/rem/ms/s, every other object or an out-of-range/non-finite value exits 1 naming the token path.
- [x] **3.2 Skip the span, not the line.** `validate` removes `var(--…)` spans
      and still reports every other literal on the line.
      verify: `npx vitest run tests/scripts/skills_design_tokens_tokens.test.ts -t same-line --reporter=verbose` -> /✓.*same-line/
      Done 2026-10-16: `validate` blanks each `var(--…)` span (nested fallbacks included) and scans the rest of the line.
- [ ] **3.3 The reading canvas 8.2 consumes.** With a valid registered file,
      `validate --json` tags each literal `on-palette (<token>)` or
      `off-palette (nearest <token>, ΔE2000)`, each with a stable finding id
      canvas 8.2 can deduplicate on (`folded-from-deep-dive`). Blocks nothing; the finding and
      its baseline stay canvas 8.2's. Tokens are never combined by value.
      verify: `npx vitest run tests/scripts/skills_design_tokens_tokens.test.ts -t palette-tag --reporter=verbose` -> /✓.*palette-tag/
- [x] **3.4 The starter speaks the format it claims** (E3). It emits 2025.10
      objects and drops its `$schema` key, whose value sits on a different host
      from the specification's own site and which nothing in `tokens.ts` reads
      (E12).
      verify: `npx vitest run tests/scripts/skills_design_tokens_tokens.test.ts -t starter-shape --reporter=verbose` -> /✓.*starter-shape/
      Done 2026-10-16: the starter carries colour, dimension and duration objects and no `$schema`; shadows stay strings (no composite-shadow serialiser here) and `0` became `0px`.
- [ ] **3.5 One row for canvas 0.4** (after canvas 3.1). The object-valued alias
      target joins the canvas alias fixture, so a missing token and an existing
      but unmappable one stay distinct; no new import test.
      verify: `npx vitest run tests/scripts/design_system_import.test.ts -t alias-object-value --reporter=verbose` -> /✓.*alias-object-value/

## Phase 4 — One voice slot, one shape

- [ ] **4.1 ADR** (E6). `docs/contracts/adr-gtm-context-spine-brand-voice.md`
      adds wing-scoped slot `brand-voice` (`agents/context-spine/brand-voice.md`)
      under § 5 and records that it is the first slot whose frontmatter is
      machine-read, limited to the fields Phase 5 consumes; the body stays prose
      under § 4.
      verify: `rg -n 'brand-voice' docs/contracts/context-spine.md` -> /brand-voice/
- [ ] **4.2 Schema** (E4, E5, E7). `attributes` (three `{is, is_not, proof}`),
      `tone_by_context` (context, audience state, lead attribute, amplify/mute),
      `avoid[]` (`{term 1-64 chars, match: word|substring, note?}`, max 32, no
      regex), `claims[]` (`{text, evidence_ref, expires?}`), `tell_exemptions[]`
      (tell ids from the detector registry), `samples[]` (≤3, ≤200 words),
      `customer_language[]` (verbatim, optional), `provenance`
      (`sources[] {ref, tier: authoritative|operational|conversational|external-untrusted}`
      — the fourth tier `folded-from-deep-dive`, never raising confidence,
      `confidence: low|med|high`, `last_reviewed_at`), `version`, `changelog[]`,
      `open_questions[]` (each with a recommendation).
      verify: `npx vitest run tests/scripts/lint_context_spine_usage.test.ts -t brand-voice-schema --reporter=verbose` -> /✓.*brand-voice-schema/
- [ ] **4.3 One writer, one shape.** `/brand:voice` → `voice-and-tone-design`
      writes the slot (declared write scope). `brand-strategy` and the
      consumption contract defer their voice sections to it. `humanizer`'s
      "registered brand voice" names the slot. `/brand:voice` regains its
      lexicon line.
      verify: `rg -l 'context-spine/brand-voice' src/skills/voice-and-tone-design/SKILL.md src/skills/brand-strategy/SKILL.md src/skills/humanizer/SKILL.md docs/contracts/brand-token-consumption.md` -> 4 files
- [ ] **4.4 The slot is data** (`folded-from-deep-dive`, wider than the source).
      Hidden-Unicode scan via `scanHiddenUnicode` (`detect_ai_tells.ts:126`) is a
      lint error; `evidence_ref` and `sources[].ref` must be repo-relative paths
      or URLs, never absolute paths; samples are never executed or followed as
      instructions by any reader.
      verify: `npx vitest run tests/scripts/lint_context_spine_usage.test.ts -t slot-untrusted --reporter=verbose` -> /✓.*slot-untrusted/
- [ ] **4.5 `brand:status` reports the voice.** Present, schema-valid, `avoid`
      and `claims` counts, confidence, days since review, stale after 90 days,
      expired claims — counts and dates only, never slot content.
      verify: `npx vitest run tests/scripts/brand_status.test.ts -t voice-slot --reporter=verbose` -> /✓.*voice-slot/

## Phase 5 — One checker for three voices and for claims

- [ ] **5.0 The parked spike, as written.** Its pre-registered Phase 0 decides
      only the user-schema half (5.5); the brand and ghostwriter halves stand on
      D5 (a declared check with no runner).
      verify: `test -f agents/evidence/analysis/voice-lexicon-spike.md` -> 0
- [ ] **5.1 `check_voice_lexicon.ts`.** Escaped literal matcher (word or
      substring, case-insensitive) on the detector's exemption and location core
      (`stripExempt`, `scanHiddenUnicode`, line/column, `MAX_SCAN_CHARS`).
      Sources: slot `avoid`, ghostwriter `taboos`, user `style.avoid` after 5.5.
      Empty lexicon → `SKIPPED` with reason via `assertScanned`
      (`scan_scope.ts:80`). Quoted, cited and code-fenced text exempt.
      verify: `npx vitest run tests/scripts/check_voice_lexicon.test.ts -t lexicon --reporter=verbose` -> /✓.*lexicon/
- [ ] **5.2 `tell_exemptions` reach the detector.** The slot's ids are passed as
      `exclude` to `analyzeText`; an unknown id is a lint error.
      verify: `npx vitest run tests/scripts/check_voice_lexicon.test.ts -t tell-exemptions --reporter=verbose` -> /✓.*tell-exemptions/
- [ ] **5.3 Claim phrases, advisory** (`corrected-from-reproduction`). A static
      registry of English and German claim *phrases* (superlative, comparative,
      absolute, certification, guarantee forms — never bare words). A hit not
      covered by a slot `claims[]` entry, or covered by an expired one, is an
      `unbacked-claim` finding with location. The negative corpus is pre-registered
      as a committed file list before the first measurement (the source's corpus
      was not enumerated); bar: ≤ 0.1 hits per 10k words (E8). German phrases run
      at hint severity until a German negative corpus is registered.
      verify: `npx vitest run tests/scripts/check_voice_lexicon.test.ts -t "claim-shapes|negative-corpus" --reporter=verbose` -> /✓.*claim-shapes[\s\S]*✓.*negative-corpus/
- [ ] **5.4 On the draft, not before it.** `/ghostwriter:write`, `/post-as:*`,
      `humanizer` and `/brand:review` run 5.1-5.3 on the finished draft. A
      ghostwriter taboo hit aborts as documented; brand findings are located,
      carry the replacement note or the missing proof, and flag without
      blocking. `/brand:review` runs these and `validate` (3.3) before any model
      judgement. The rule names the checker; `enforced_by` changes accordingly.
      verify: `rg -l 'check_voice_lexicon' src/domains/gtm-marketing/ghostwriter/write/command.md src/skills/humanizer/SKILL.md src/domains/brand/brand/review/command.md` -> 3 files
- [ ] **5.5 User schema v2** — only if 5.0 says build.
      verify: `rg -n 'avoid' src/shared/userMd/schema.ts` -> /avoid/
- [ ] **5.6 Persisted prose, opt-in.** A Taskfile target over PR title/body and
      branch commits; not in default CI.
      verify: `rg -n 'voice-lexicon' Taskfile.yml taskfiles/` -> /voice-lexicon/
- [ ] **5.7 Absorb the parked roadmap.** Once 5.1 ships,
      `later/road-to-voice-negative-lexicon.md` moves to `archive/` with a
      pointer to this file.
      verify: `test -f agents/roadmaps/archive/road-to-voice-negative-lexicon.md` -> 0

## Phase 6 — Readers, producers, and a carrier only if measured

- [ ] **6.1 Copy readers declare the slot.** `release-comms`,
      `messaging-architecture`, `gtm-launch`, `content-funnel-design`,
      `humanizer`, `brand-audit` carry `context_spine: [brand-voice, …]` and state
      their behaviour when it is absent.
      verify: `rg -l 'brand-voice' src/skills/release-comms/SKILL.md src/skills/messaging-architecture/SKILL.md src/skills/gtm-launch/SKILL.md src/skills/content-funnel-design/SKILL.md src/skills/humanizer/SKILL.md src/skills/brand-audit/SKILL.md` -> 6 files
- [ ] **6.2 Producers ask the resolver.** `canvas-design`, `html-deck`,
      `logo-generation` and `brand-asset-generation` run `brand:status --json`
      before choosing colour, type or voice, take values from the reported
      sources, and mark corpus fallback as corpus-sourced. No new adapter skill.
      verify: `npx vitest run tests/scripts -t producer-brand-read --reporter=verbose` -> /✓.*producer-brand-read/
- [ ] **6.3 Is a declared slot read?** Pre-registered N and bar (E8): fixture
      prompts routed to the 6.1 readers with the slot present; read rate from the
      audit log's Read events on the slot path. At or above the bar → no carrier,
      honest null recorded.
      verify: `test -f agents/evidence/analysis/spine-slot-read-rate.md` -> 0
- [ ] **6.4 Carrier, only if 6.3 fails.** Context-spine § 4 amended by ADR;
      concern `brand-voice-card` registered in `src/config/hook-token-budget.json`
      at the measured card size (three attributes, `avoid` terms, one sample);
      emitted only when a routed reader skill runs and the slot is valid; shaped
      by `injection_budget.ts`; Claude Code first. 0.6 stays green.
      verify: `npx vitest run tests/scripts/hooks -t "brand-voice-card|no-brand-bytes" --reporter=verbose` -> /✓.*brand-voice-card[\s\S]*✓.*no-brand-bytes/

## Phase 7 — Intake and proof

- [ ] **7.1 Voice intake from material the user hands over.** In
      `voice-and-tone-design`: pasted text and files only; each source tiered;
      every section drafted with confidence; assumptions marked; open questions
      with a recommendation; slot written with `version` +1 and a changelog line;
      generated findings never promoted to approved policy without the user.
      Profile surfaces stay excluded (NG-4).
      verify: `rg -n 'tier: (authoritative|operational|conversational)' src/skills/voice-and-tone-design/SKILL.md` -> /tier/
- [ ] **7.2 Scenario fixtures with deterministic legs.** Existing brand unchanged
      byte for byte; greenfield; dotted near-miss; shadowed and duplicate files;
      tokens without voice and voice without tokens; exploration without lock;
      similar screenshot colours never merged; unbacked superlative; expired
      claim; quoted banned term exempt; profile text excluded; a German inflected
      banned term, documented as missed by literal matching
      (`folded-from-deep-dive`); a project switch or stale slot leaking no voice
      from the previous project (`folded-from-deep-dive`); non-brand task at zero
      brand bytes. The "sounds like us" leg stays a labelled rubric. (new test
      file)
      verify: `npx vitest run tests/scripts/brand_scenarios.test.ts --reporter=verbose` -> /✓/
- [ ] **7.3 Claims the tree can back.** `brand-voice-lexicon-recall` (planted
      terms 100 %, quoted false positives 0) and `brand-status-state-truth`
      (every 0.2 fixture classified correctly), registered `unbacked`, then backed
      by 7.2.
      verify: `rg -n 'brand-voice-lexicon-recall|brand-status-state-truth' docs/CLAIMS.md` -> 2 matches

## Non-goals

Carried from the supplied plans' kill register; each was judged and not taken.

- **NG-1** No numeric brand-personality scores, no embedding drift against an
  exemplar centroid, no same-model QA agent or calibrated judge as a blocking
  gate — subjective, owner-gated, or self-graded; the rubric stays labelled (7.2).
- **NG-2** No `strictness` knob or `enforce|explore|migrate` mode axis —
  per-finding severity and flags-not-blocks; exploration is already a rule
  exemption; rebrand posture is canvas 5.1's.
- **NG-3** No brand-context foundation skill, imported skill library, channel or
  marketing extension skills, task router, context compiler with cache, or media
  adapters — the slot is the foundation, routing exists, producers read the
  resolver (6.2). No three-artifact landing-page/deck/carousel proof, no
  exported companion skill, no rendered brand book (`folded-from-deep-dive`,
  declined: each is a capability with no tree defect behind it; an exported
  skill is a stale copy).
- **NG-4** No profile-surface intake until a field-level privacy floor exists.
- **NG-5** No persisted brand registry or manifest — a third truth beside tokens
  and `design-system.json`; 2.3 computes the same index on every call.
- **NG-6** No external prose-linter dependency and no regex in consumer
  lexicons — own literal checker; ReDoS and explainability.
- **NG-7** No separate visual off-brand gate (canvas 8.2 owns it); no contrast
  auto-fix to fixed colours (silent rewrite); no dark-mode contrast work here
  (asset witness and canvas own rendering checks).
- **NG-8** No load-time shell injection in skill bodies and no PreCompact
  re-pointer — 6.4 is the governed form; revisit the re-pointer only if 6.3
  shows loss after compaction.
- **NG-9** No pack edge between `brand` and `gtm-marketing` — the default
  workspaces already ship both.
- **NG-10** No single-word claim detection and no legal verdicts on claims —
  findings say "needs proof", never "unlawful".
- **NG-11** No outbound posting adapters, multi-brand or subbrand support,
  asset-licence classification beyond fonts, locale- or channel-scoped claims,
  or a cost/latency baseline across external repositories — outbound actions
  are execution-authority's; the rest needs a tree defect first.
- **NG-12** No new mandatory setup step and no new user-facing command per
  medium; an existing brand is discovered, never re-asked.

## Acceptance Criteria

- [ ] AC-1 — The tree holds exactly three brand sources — tokens,
      `design-system.json`/`DESIGN.md`, the `brand-voice` slot — and no persisted
      index or registry file beside them.
- [ ] AC-2 — No authored surface names `.tokens.json` as the file to write, and
      `BRAND_TOKEN_PATHS` is declared once.
- [ ] AC-3 — A ghostwriter profile at either documented path is ignored by git
      and scanned by the source lint, and no tracked file under either path is
      a real-person profile.
- [ ] AC-4 — `brand:status` never reports a malformed or shadowed file as the
      brand, and names every source with its hash.
- [ ] AC-5 — No stable DTCG 2025.10 value reaches CSS as `[object Object]`; an
      unrepresentable value fails with its token path and a non-zero exit.
- [ ] AC-6 — A planted banned term or unbacked claim in a finished draft from
      ghostwriter, post-as, humanizer or brand review produces a located finding;
      a quoted one does not.
- [ ] AC-7 — A non-brand task in a fully branded project carries zero brand
      bytes, before and after any carrier.
- [ ] AC-8 — `brand-source-of-truth` names its checker in `enforced_by`, or says
      `instruction-only`, and no file calls `brand-consistency` a gate.
- [ ] AC-9 — A runtime carrier exists only if the recorded read-rate
      measurement missed its pre-registered bar.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| E1 | reversible-technical | evidence | One stem in this file. The generator and validator steps (Phase 3) stay here because canvas does not touch `tokens.ts`; only the alias fixture row (3.5) lands in canvas's test, after canvas 3.1. The parked lexicon roadmap is absorbed (5.7). | canvas 0.4/3.1/8.2 cover import aliases, cycles and the visual finding, not generation (`road-to-a-canvas-the-code-owns.md:147,183,298`; no `2025.10` hit there) | canvas grows a generator step |
| E2 | reversible-technical | evidence | `agents/reference/ghostwriter/` is canonical; both paths are ignored and linted; `agents-layout.md` marks the folder local-only. Strengthens a privacy floor, so no owner gate. | 17 files and the archived `step-4-ghostwriter` design name the reference path; only the block and the lint use the legacy one | a consumer reports profiles under the legacy path only |
| E3 | reversible-technical | evidence | The starter emits 2025.10 objects; the reader keeps accepting strings. | 2025.10 is the first stable format; string values are legacy-valid | the specification drops string compatibility |
| E4 | reversible-technical | evidence | Three "X, not Y" attributes; `brand-strategy`'s 3-5 traits defer to the slot. | `voice-and-tone-design/SKILL.md:161` already forbids a fourth; both plans recommend three | a consumer brand needs a fourth attribute and the tone matrix cannot carry it |
| E5 | reversible-technical | evidence | Match modes `word|substring`, no stemming; German inflection documented as a known miss (7.2). | the parked design rejects regex for explainability; no German corpus exists yet | a German negative corpus shows substring misses above the 5.3 bar |
| E6 | reversible-technical | evidence | The slot is the first machine-read spine slot, limited to the Phase 5 fields, through the 4.1 ADR. Fallback if the ADR is declined: the same frontmatter at `agents/settings/brand/voice.md`, cited by the slot. | spine is the established "read once, cite the slot" mechanism (46 skills); slots have no schema today (`context-spine.md:9`) | the ADR review rejects a machine-read slot | <!-- ref-ignore -->
| E7 | reversible-technical | evidence | Claims live in the slot as `claims[]` with per-entry `expires` — reference records, not a ledger service. Satisfies the deep-dive's "only after two consumers" condition: 5.4 has four. | 5.4 readers; NG-5 forbids a third store | a claim needs locale or channel scope |
| E8 | reversible-technical | evidence | Pre-registered before measuring: 6.3 runs 30 brand-copy fixture prompts across the six 6.1 readers, bar ≥ 95 % slot reads, 0 slot reads on unrelated prompts; 5.3 ceiling ≤ 0.1 hits per 10k words on the committed corpus list. Tuned only before the first run. | numbers from the deep-dive revision; the master left them open | the first run shows the fixtures do not route to the readers |
| E9 | reversible-technical | evidence | State vocabulary is the contract's `greenfield | mixed | branded`, with `invalid` and `shadowed` as qualifiers, not new states. | `brand-token-consumption.md:39-48`; one vocabulary, no second | a fixture needs a state the qualifiers cannot express |
| E10 | reversible-technical | evidence | Docs align to the resolver (`tokens.json`); the resolver keeps flagging dotted near-misses. Reopens the 2026-09-09 deferral: it named no owner, no blocker and no revisit condition, while `brand-asset-generation` itself loads the dotted name. No runtime behaviour changes. | `brand-to-tokens/SKILL.md:32-51`; `cmd_brand_status.ts:62-80` | a consumer reports a tool that writes the dotted name |
| E11 | deterministic | agent | Closure pass 2026-10-15: the `-t` titles and `rg` targets in 0.1-0.6, 2.x, 3.x, 4.x, 5.x, 6.x and 7.x name tests or text that do not exist yet, so each verify fails until its step lands; 0.7 is green today and stays the floor. The contradiction listed in D9 is the finding itself, settled by E2. Zero owner questions. | `closure_scan` on this file | a step lands without its title or sentence |
| E12 | reversible-technical | evidence | The starter drops `$schema` rather than guessing a replacement URL: no offline check can confirm a published schema location, and no reader consumes the key. | `design-tokens-starter.json:2`; no `$schema` read in `tokens.ts` | the specification publishes a schema URL a validator here would read |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-15 | reviewer: claude-opus -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Profiles already tracked | product | A consumer or this repo committed a real-person profile under the unignored path before 1.1 lands | 0.7 counts tracked files first; a non-zero count stops Phase 1 and reaches the owner; no history rewrite without the owner | Phase 0 — Control readings (red first) |
| 2 | Token rename misses a writer | implementation | A surface keeps telling consumers to write the dotted file | 0.1 asserts parity over every authored surface; `brand:status` keeps flagging near-misses | Phase 1 — Small truths (one immediate PR) |
| 3 | Claim phrases fire on ordinary prose | product | Advisory findings become noise and get ignored | phrase-level only, pre-registered corpus and ceiling (E8), German at hint severity | Phase 5 — One checker for three voices and for claims |
| 4 | Slot becomes a second token store | implementation | Colours or type values drift into the voice slot | 4.2 schema has no visual fields; AC-1; NG-5 | Phase 4 — One voice slot, one shape |
| 5 | Carrier built without need | implementation | A hook adds bytes to every turn | 6.4 runs only if 6.3 misses its pre-registered bar; 0.6 and AC-7 guard zero bytes off-brand | Phase 6 — Readers, producers, and a carrier only if measured |
| 6 | Canvas and this file edit one test | implementation | Both touch `design_system_import.test.ts` | 3.5 waits for canvas 3.1 and adds one row only | Phase 3 — The stable token format |
| 7 | Slot content steers an agent | implementation | Samples or references in the slot carry instructions | 4.4 treats the slot as data: Unicode scan, path rules, never executed | Phase 4 — One voice slot, one shape |

## Inbox discharge

Point ids are `S01-<bucket><n>`: C claim, I instruction, D demand. Every point
the source set raised is carried by a step, a decision, a non-goal, or one line
here.

| Points | Discharge |
|---|---|
| S01-I01..I02 (analyse eight sources and the web in depth) | declined here: network reads are outside this run's bound; the supplied plans already did it, and their lesson — adopt forms, not features — is Goal 5-6 and NG-3 |
| S01-I03, I06, D01, D05 (plan, deepen, final roadmap) | adopted: this file |
| S01-I04, D03 (three loops, challenge decisions) | adopted: three extraction passes plus the carried kill register (Non-goals) |
| S01-I05, D04 (roadmap as a download) | declined: the repo's output is this tracked file; the chat download was the source's own surface |
| S01-D02 (learn, use, adapt) | adopted: source tiers, calibration samples, version and changelog, open questions with a recommendation (4.2, 7.1) |
| S01-D06..D09 (no second engine; no re-asking; zero brand bytes; no gate that does not run) | adopted: AC-1, NG-12, AC-7, AC-8 |
| S01-D10 (were profiles committed) | adopted: 0.7 |
| S01-D11 (multi-host projection and clean-install smoke) | declined: the byte-exact projection check and `task generate-tools` already gate every `src/` edit |
| S01-D12..D14, D21, D22 (gamut errors, untrusted slot, leak on switch, German fixtures, read-rate numbers) | adopted: 3.1, 4.4, 7.2, 7.2, E8 |
| S01-D15, D45 (token telemetry on six task families; a per-workspace projection size matrix) | declined beyond 0.6 and 6.3: no consumer surface exists to sample, and projection size is already budgeted per concern |
| S01-D46..D48 (nested and backup profile files; an untrusted source tier; stable finding ids for canvas) | adopted: 1.1, 4.2, 3.3 |
| S01-D16..D18, D20, D26..D31, D33, D34, D36..D41, D44 | declined: NG-1..NG-11 |
| S01-D19, D32 (claim register conditions) | adopted reduced: E7 |
| S01-D23, D24 (publication gates; independent review) | already-satisfied: `non-destructive-by-default` irreversible-external-action row; `evaluator-independence` |
| S01-D25 (pack-reach bridge) | declined: not a defect (Context § Not defects) |
| S01-D35 (eval harness) | adopted: 7.2, 7.3 |
| S01-D42, D43 (starter schema URL; absorb parked lexicon) | adopted: 3.4, 5.7 |
| S01-C01..C33 | Context D1-D12 and § Not defects, each with its verification |
