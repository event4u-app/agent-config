---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-a-canvas-the-code-owns
    relation: extends
    note: "Active (ready). Owns the visual off-brand finding (8.2 Lock carrier, flags-not-blocks, brownfield baseline) and the DTCG import lane (0.4 alias control, 3.1 alias record and cycles). This roadmap owns the generator and validator in design-tokens/scripts/tokens.ts, which canvas does not touch; Phase 3 hands canvas 8.2 the palette reading it consumes and adds one object-valued alias row to canvas's 0.4 fixture only after canvas 3.1 lands. No visual gate is planned here."
  - slug: archive/road-to-voice-negative-lexicon
    relation: supersedes
    note: "Parked 2026-08-05 on a capacity slot only (its own header). Its validator design is kept verbatim and generalised from one voice primitive to three plus a claim-phrase list (Phase 5). Its pre-registered spike decided the user-schema half (5.0: schema field only). Archived by step 5.7 with 5.1."
  - slug: road-to-type-with-a-witness
    relation: disjoint
    note: "Active. Font construction and the font witness; nothing here touches type carriers or font licensing."
estate_growth_exempt: "Raises open_blockers by 2, and both are a correction rather than growth: steps 5.5 and 6.3 were already blocked on an owner decision and carried that as prose `Open` notes no gate, dashboard or `open_blockers` reading could see. Recording them changes nothing about what is open — it makes the two already-open items countable, which is what this ratchet measures. The same change closes 5.6, so the roadmap's own open count falls from 6 to 5."
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
      Done 2026-10-16: `token-name-parity` in `brand_status.test.ts` walks `src/skills`, `src/domains` and `docs/contracts` (evals and generated READMEs excluded); red against the 49 dotted lines at the base, green after 1.2's authored half.
- [x] **0.2 Status honesty, red.** Fixtures: malformed file, two files with
      different content, two files with identical content, tokens without voice,
      voice without tokens, nothing. Today the first two read "present".
      verify: `npx vitest run tests/scripts/brand_status.test.ts -t state-fixtures --reporter=verbose` -> /✓.*state-fixtures/
      Done 2026-10-16: eight `state-fixtures` cases, seven red at the base (no `state`, `sources` or validity there); the two voice fixtures assert the voice side reads as absent, as 2.3 allows until 4.5.
- [x] **0.3 Object values and same-line skip, red.** 2025.10 colour, dimension
      and alias; `#ff0000` beside `var(--x)`.
      verify: `npx vitest run tests/scripts/skills_design_tokens_tokens.test.ts -t "dtcg-2025|same-line" --reporter=verbose` -> /✓.*dtcg-2025[\s\S]*✓.*same-line/
      Done 2026-10-16: `dtcg-2025` and `same-line` cases in `skills_design_tokens_tokens.test.ts`, seen red against the base `tokens.ts` before 3.1 and 3.2 landed.
- [x] **0.4 Taboo and claim never checked, red.** A ghostwriter draft containing
      its own taboo and a brand draft containing "the number one platform"
      produce no finding from any tool. (new test file)
      verify: `npx vitest run tests/scripts/check_voice_lexicon.test.ts -t control --reporter=verbose` -> /✓.*control/
      Done 2026-10-17: the `control` case in `tests/scripts/check_voice_lexicon.test.ts` ran red (no checker existed) and is green since 5.1/5.3: the ghostwriter draft's own taboo is an `error` finding (exit 1), the brand draft's "number one platform" an `unbacked-claim`.
- [x] **0.5 Ghostwriter path, red.** The ignore block and the lint roots both
      cover the documented path; fails today.
      verify: `npx vitest run tests/scripts/lint_ghostwriter_source.test.ts -t documented-path --reporter=verbose` -> /✓.*documented-path/
      Done 2026-10-16: `documented-path` checks the managed block with `check-ignore --no-index` in a scratch repository and the lint roots; six of ten cases red at the base.
- [x] **0.6 Zero brand bytes off-brand, guard.** A backend prompt in a project
      with a full brand produces no brand emission; green today, kept as the
      floor every later phase must hold.
      verify: `npx vitest run tests/scripts/hooks -t no-brand-bytes --reporter=verbose` -> /✓.*no-brand-bytes/
      Done 2026-10-17: `tests/scripts/hooks/no_brand_bytes.test.ts` runs every concern bound to the `claude` `session_start` and `user_prompt_submit` slots in-process against a backend prompt in a fixture project carrying `tokens.json`, `DESIGN.md` and a `brand-voice` slot, and finds none of the brand-only markers in any output. A non-vacuity case proves the capture sees emitted text; a sabotage probe (a marker every run emits) turned both slot cases red.
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
      Open 2026-10-16: the authored half landed — 14 files say `tokens.json`, the "Recorded, not resolved" section is gone, catalogues regenerated, ADR-061 untouched, the verify passes and 0.1 is green. The eval half did not: adding the plain utterance to the `brand-to-tokens` and `brand-asset-generation` trigger evals changes the pinned trigger-corpus holdout (`trigger_corpus_holdout_pin`), whose published SET-SHA256 and the measurements built on it would need re-pinning; that is left for a change that owns the corpus.
      Done 2026-10-17: this change owns the corpus — 6.1 forced five new corpora
      and a re-pin, so the deferred half lands beside it rather than waiting for
      a third change to repeat the same work. Both evals **keep** the dotted
      utterance and **gain** the plain one: the resolver reads `tokens.json`,
      and a consumer who followed this package's own earlier wording types the
      dotted name, so routing must answer both — removing it would delete the
      near-miss the defect actually produces. The holdout artefact carries the
      re-pin section, both rows are train-side, the sealed set does not move,
      and both train-side measurements were re-taken (neither verdict changes
      in kind). `rg` over the authored surfaces still returns nothing and
      `token-name-parity` is green.
- [x] **1.3 One constant.** `uiRenderAssetTypes.ts` re-exports the resolver list
      instead of declaring its own.
      verify: `rg -c 'export const BRAND_TOKEN_PATHS' src` -> 1 file
      Open 2026-10-16: a re-export is the edit `uiAudit.ts:35` records as tried and reverted — `dist/cli` is compiled by tsc and the work-engine template tree is not, so a runtime import from the CLI into the template fails to resolve in the published package, and the template stays self-contained the other way. Needs a home both trees may import at runtime.
      Done 2026-10-17: that home is `src/shared/brandTokenPaths.ts`, and it works
      because the SAME relative specifier resolves in both projections — the
      CLI compiles under `rootDir: src` so `../../shared/…` lands on
      `dist/shared/`, and the work-engine tree is projected byte-identically, so
      `../../../../../../shared/…` is `src/shared/*.ts` under tsx and
      `dist/shared/*.js` in the copy. All three were exercised rather than
      argued: `dist/cli/commands/uiRenderAssetTypes.js`,
      `dist/agent-src/templates/.../scaffold.js` and
      `src/agent-src/templates/.../scaffold.ts` each imported and printed the
      list, `dist/cli-delegate/cmd_brand_status.js` imports clean, and
      `agent-config roadmap:progress` — the command whose ERR_MODULE_NOT_FOUND
      caught the reverted attempt — runs. The copies had already diverged: the
      renderer built its last entry with `path.join`, so on Windows it searched
      a path the scaffold never wrote. `one-resolver-list` in
      `brand_status.test.ts` asserts array IDENTITY, not deep equality (equal
      contents today is exactly the state that drifted) and that no entry
      carries a platform separator; restoring the renderer's own copy turns it
      red.
- [x] **1.4 Citations to the body.** The D7 sites cite `brand-source-of-truth`
      § Iron Law 2; the rule gains `enforced_by: instruction-only`, and
      "Validation gate" reads "checklist" until Phase 5 names its checker.
      verify: `rg -n 'brand-consistency' src/skills src/domains docs/contracts/brand-token-consumption.md --glob '!**/evals/**' --glob '!**/README.md'` -> 1 (no match)
      Done 2026-10-16: the eleven sites cite `brand-source-of-truth` § Iron Law 2; the rule carries `enforced_by: instruction-only: …` and says "checklist".
- [x] **1.5 `/brand:voice` says what it makes today.** "Three attributes, tone
      matrix, consistency review"; the lexicon line returns with 4.3.
      verify: `rg -n 'do/don.t lexicon' src/domains/brand` -> 1 (no match)
      Done 2026-10-16: `/brand:voice` now says three attributes, a tone matrix by context, and a consistency review. Superseded 2026-10-17 by 4.3 as this step provides for: the lexicon line is back, now naming the slot's `avoid[]` as what produces it, so the verify above no longer holds and 4.3's does instead.

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
- [x] **2.4 Readers ask the resolver.** The scaffold seed line and the asset
      renderer use the 2.1 validity, not file existence.
      verify: `npx vitest run tests/scripts -t token-seed-invalid --reporter=verbose` -> /✓.*token-seed-invalid/
      Open 2026-10-16: same constraint as 1.3 — the 2.1 validity lives in `src/scripts/_cli/cmd_brand_status.ts`, which neither the template-side scaffold nor the compiled asset renderer can import at runtime.
      Done 2026-10-17 by the 1.3 route: `tokenDocumentError` moved to
      `src/shared/brandTokenDocument.ts` and `cmd_brand_status` re-exports it,
      so its public surface is unchanged and there is still one predicate. It
      takes TEXT, not a path, so each reader keeps its own read and its own
      notion of a root. `_brand_token_source` now parses before seeding, and
      the renderer's background read asks the same question instead of "did
      `JSON.parse` throw". `brand_readers_validity.test.ts` pairs a broken file
      at the FIRST canonical path with a valid one further down, which is the
      only ordering that makes the two predicates disagree. The renderer's own
      discriminating case is a file with a bare `value` key and no `$value`
      anywhere: `findToken` accepts it, so it used to be reported as `tokens`
      while `brand:status` called it invalid. Removing either guard turns the
      matching cases red.

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
- [x] **3.3 The reading canvas 8.2 consumes.** With a valid registered file,
      `validate --json` tags each literal `on-palette (<token>)` or
      `off-palette (nearest <token>, ΔE2000)`, each with a stable finding id
      canvas 8.2 can deduplicate on (`folded-from-deep-dive`). Blocks nothing; the finding and
      its baseline stay canvas 8.2's. Tokens are never combined by value.
      verify: `npx vitest run tests/scripts/skills_design_tokens_tokens.test.ts -t palette-tag --reporter=verbose` -> /✓.*palette-tag/
      Done 2026-10-17: `validate --json --tokens <file>` tags each hex/rgb literal `on-palette (<token>)` (ΔE2000 0) or `off-palette (nearest <token>, ΔE2000 n.nn)` and gives every finding a 16-hex `id` from file, kind, literal and the line's own text, so a line shift keeps it. The registered file is passed explicitly: the skill script is stdlib-only and cannot import the resolver list (same constraint as 1.3). Comparable colours are hex, integer `rgb()` and 2025.10 objects with `hex` or `srgb` components; other spaces are not compared. Exit code and the no-`--tokens` output are unchanged.
- [x] **3.4 The starter speaks the format it claims** (E3). It emits 2025.10
      objects and drops its `$schema` key, whose value sits on a different host
      from the specification's own site and which nothing in `tokens.ts` reads
      (E12).
      verify: `npx vitest run tests/scripts/skills_design_tokens_tokens.test.ts -t starter-shape --reporter=verbose` -> /✓.*starter-shape/
      Done 2026-10-16: the starter carries colour, dimension and duration objects and no `$schema`; shadows stay strings (no composite-shadow serialiser here) and `0` became `0px`.
- [x] **3.5 One row for canvas 0.4** (after canvas 3.1). The object-valued alias
      target joins the canvas alias fixture, so a missing token and an existing
      but unmappable one stay distinct; no new import test.
      verify: `npx vitest run tests/scripts/design_system_import.test.ts -t alias-object-value --reporter=verbose` -> /✓.*alias-object-value/
      Done 2026-10-17, canvas 3.1 being `[x]`. One case in the existing
      `DTCG alias chains are kept, cycles are named` describe; no new test file
      and no new fixture file, as the step bounds it. **The two were not
      distinct and the row could not merely guard them:** an alias onto a
      2025.10 object colour came back verbatim from both `resolveAlias` and
      `reachesCycle`, so it was counted as a dangling reference and reported
      with "point at a token this file does not define" — false, the file
      defines it. `aliasTargetDefined` now separates the third case and a
      second note names it; the dangling note and its count are byte-identical
      for a genuinely missing target, so canvas's own
      `alias-record: a dangling reference is still undefined` stays green (54
      cases pass). A sabotage probe collapsing the two counters back into one
      turned the case red.

## Phase 4 — One voice slot, one shape

- [x] **4.1 ADR** (E6). `docs/contracts/adr-gtm-context-spine-brand-voice.md`
      adds wing-scoped slot `brand-voice` (`agents/context-spine/brand-voice.md`) <!-- ref-ignore -->
      under § 5 and records that it is the first slot whose frontmatter is
      machine-read, limited to the fields Phase 5 consumes; the body stays prose
      under § 4.
      verify: `rg -n 'brand-voice' docs/contracts/context-spine.md` -> /brand-voice/
      Done 2026-10-17: `adr-gtm-context-spine-brand-voice.md` adds the Wing-3 slot, records the § 4 machine-read exception and the E6 fallback; `context-spine.md` lists the slot, and the `skill.schema.json` enum plus the lint vocabulary carry it. Citations are prospective (4.3, 6.1), as § 5 allows for roadmap items in the same iteration. Not added to `skill_linter`'s Wing-3 vendor-check set: that set polices GTM tactics, which the copy readers declaring this slot are not.
- [x] **4.2 Schema** (E4, E5, E7). `attributes` (three `{is, is_not, proof}`),
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
      Done 2026-10-17: `src/scripts/_lib/brand_voice_slot.ts` validates the closed field set (an unknown field such as a colour is an issue, so the slot cannot become a token store), exactly three attributes, `tone_by_context` naming an attribute, `avoid` ≤32 literal terms, `claims` with a day-valued `expires`, ≤3 samples of ≤200 words, the four source tiers and the confidence/date provenance. `lint_context_spine_usage` validates `agents/context-spine/brand-voice.md` when it exists. `changelog` entries are plain strings. Unknown `tell_exemptions` ids are 5.2's. <!-- ref-ignore -->
- [x] **4.3 One writer, one shape.** `/brand:voice` → `voice-and-tone-design`
      writes the slot (declared write scope). `brand-strategy` and the
      consumption contract defer their voice sections to it. `humanizer`'s
      "registered brand voice" names the slot. `/brand:voice` regains its
      lexicon line.
      verify: `rg -l 'context-spine/brand-voice' src/skills/voice-and-tone-design/SKILL.md src/skills/brand-strategy/SKILL.md src/skills/humanizer/SKILL.md docs/contracts/brand-token-consumption.md` -> 4 files
      Done 2026-10-17: `voice-and-tone-design` declares `scope.write` on
      `agents/context-spine/brand-voice.md`, declares the slot in <!-- ref-ignore -->
      `context_spine`, and gains a Step 6 that names every machine-read field
      and the read-bump-append update rule. `brand-strategy` hands over a voice
      *direction* and no longer authors a competing 3-5-trait list; the
      consumption contract's producer row and read contract name the slot and
      its three `{is, is_not, proof}` attributes; `humanizer` names the slot as
      the one registered brand voice and says an absent or invalid slot means
      the defaults apply. `/brand:voice` carries the do/don't lexicon again, as
      the slot's `avoid[]` — which supersedes 1.5's temporary verify, exactly as
      1.5's own text ("the lexicon line returns with 4.3") provides for.
- [x] **4.4 The slot is data** (`folded-from-deep-dive`, wider than the source).
      Hidden-Unicode scan via `scanHiddenUnicode` (`detect_ai_tells.ts:126`) is a
      lint error; `evidence_ref` and `sources[].ref` must be repo-relative paths
      or URLs, never absolute paths; samples are never executed or followed as
      instructions by any reader.
      verify: `npx vitest run tests/scripts/lint_context_spine_usage.test.ts -t slot-untrusted --reporter=verbose` -> /✓.*slot-untrusted/
      Done 2026-10-17: `scanHiddenUnicode` over the whole file is an issue; `evidence_ref` and `sources[].ref` must be a repo-relative path without `..` or an http(s) URL; YAML aliases are refused (`maxAliasCount: 0`). The never-executed property belongs to the readers (5.x) and is stated in the ADR.
- [x] **4.5 `brand:status` reports the voice.** Present, schema-valid, `avoid`
      and `claims` counts, confidence, days since review, stale after 90 days,
      expired claims — counts and dates only, never slot content.
      verify: `npx vitest run tests/scripts/brand_status.test.ts -t voice-slot --reporter=verbose` -> /✓.*voice-slot/
      Done 2026-10-17: `brand:status` reads `agents/context-spine/brand-voice.md`, lists it as a `voice` source (valid, or invalid with the failing field names only), and reports `schema_valid`, `avoid_count`, `claims_count`, `expired_claims`, `confidence`, `last_reviewed_at`, `days_since_review` and `stale` (> 90 days or never reviewed). Only a valid slot counts toward `mixed`/`branded`; the 0.2 voice fixture now asserts that an invalid slot is listed and never makes the state. `brand-token-consumption.md` says so. <!-- ref-ignore -->

## Phase 5 — One checker for three voices and for claims

- [x] **5.0 The parked spike, as written.** Its pre-registered Phase 0 decides
      only the user-schema half (5.5); the brand and ghostwriter halves stand on
      D5 (a declared check with no runner).
      verify: `test -f agents/evidence/analysis/voice-lexicon-spike.md` -> 0
      Done 2026-10-17: seed lexicon committed first (`tests/fixtures/voice-lexicon/spike-seed-lexicon.json`, 21 entries), then the scan over the last 30 merged PR descriptions and 100 commits at `origin/main` 835660b0d: 42 hits in 22 items from 2 entries (`actually` 38, `simply` 4). Verdict by the spike's own gate: schema field only, not build — so 5.5 ("only if 5.0 says build") does not proceed on this reading.
- [x] **5.1 `check_voice_lexicon.ts`.** Escaped literal matcher (word or
      substring, case-insensitive) on the detector's exemption and location core
      (`stripExempt`, `scanHiddenUnicode`, line/column, `MAX_SCAN_CHARS`).
      Sources: slot `avoid`, ghostwriter `taboos`, user `style.avoid` after 5.5.
      Empty lexicon → `SKIPPED` with reason via `assertScanned`
      (`scan_scope.ts:80`). Quoted, cited and code-fenced text exempt.
      verify: `npx vitest run tests/scripts/check_voice_lexicon.test.ts -t lexicon --reporter=verbose` -> /✓.*lexicon/
      Done 2026-10-17: `src/scripts/check_voice_lexicon.ts` — escaped literal matcher (Unicode word boundaries or substring, case-insensitive), slot `avoid` at `warning`, ghostwriter `taboos` at `error`, hidden-Unicode findings, `MAX_SCAN_CHARS` truncation, and an empty lexicon reported `skipped` with the `assertScanned` reason. Exemptions follow `stripExempt`'s classes but are blanked in place (a new position-preserving pass), because `stripExempt` deletes spans and would shift every line and column. User `style.avoid` is not wired; it waits on 5.5.
- [x] **5.2 `tell_exemptions` reach the detector.** The slot's ids are passed as
      `exclude` to `analyzeText`; an unknown id is a lint error.
      verify: `npx vitest run tests/scripts/check_voice_lexicon.test.ts -t tell-exemptions --reporter=verbose` -> /✓.*tell-exemptions/
      Done 2026-10-17: the slot's ids go to `analyzeText` as `exclude`; an id outside `ALL_TELL_RULES` is a `brand_voice_slot` issue (`tell_exemptions[i]`), and the CLI refuses an invalid slot with exit 2. Tells are reported beside the findings and never change the exit code.
- [x] **5.3 Claim phrases, advisory** (`corrected-from-reproduction`). A static
      registry of English and German claim *phrases* (superlative, comparative,
      absolute, certification, guarantee forms — never bare words). A hit not
      covered by a slot `claims[]` entry, or covered by an expired one, is an
      `unbacked-claim` finding with location. The negative corpus is pre-registered
      as a committed file list before the first measurement (the source's corpus
      was not enumerated); bar: ≤ 0.1 hits per 10k words (E8). German phrases run
      at hint severity until a German negative corpus is registered.
      verify: `npx vitest run tests/scripts/check_voice_lexicon.test.ts -t "claim-shapes|negative-corpus" --reporter=verbose` -> /✓.*claim-shapes[\s\S]*✓.*negative-corpus/
      Open 2026-10-17: the registry (`src/scripts/_lib/claim_phrases.ts`) and the corpus list (`tests/fixtures/voice-lexicon/negative-corpus.txt`, 183 contract docs) were committed before the first run; the `claim-shapes` cases pass and the scan is live at `warning`/`hint`. The first measurement missed the bar — 8 hits over 283,204 words, 0.28 per 10k against 0.1, all false positives from three phrases (`unmatched`, `beats every`, `never fails`) — recorded in `agents/evidence/analysis/voice-lexicon-claim-corpus-2026-10-17.md`. E8 forbids tuning after the first run, so no registry edit and no bar test landed; closing needs a fresh pre-registration against a corpus the revision was not chosen on.
      Done 2026-10-19: the fresh pre-registration landed in its own commit before any scan — registry v2 drops the four English single-word entries NG-10 already excludes (`unmatched`, `unrivaled`, `unrivalled`, `unhackable`; a `claim-shapes` case pins it, seen red), keeps `beats every` and `never fails`, and corpus v2 is 111 `docs/guidelines` files never scanned before. Reading: 0 hits in 97,835 words, bar met; `negative-corpus` asserts it and turned red under a planted noisy phrase. Recorded in `agents/evidence/analysis/voice-lexicon-claim-corpus-2026-10-19.md`, including the v1-corpus figure under v2 (0.105) labelled as not evidence.
- [x] **5.4 On the draft, not before it.** `/ghostwriter:write`, `/post-as:*`,
      `humanizer` and `/brand:review` run 5.1-5.3 on the finished draft. A
      ghostwriter taboo hit aborts as documented; brand findings are located,
      carry the replacement note or the missing proof, and flag without
      blocking. `/brand:review` runs these and `validate` (3.3) before any model
      judgement. The rule names the checker; `enforced_by` changes accordingly.
      verify: `rg -l 'check_voice_lexicon' src/domains/gtm-marketing/ghostwriter/write/command.md src/skills/humanizer/SKILL.md src/domains/brand/brand/review/command.md` -> 3 files
      Open 2026-10-17: the checker exists (5.1); wiring it into `/ghostwriter:write`, `/post-as:*`, `humanizer` and `/brand:review` changes what those consumer-facing commands do on every draft, which this drain lane treats as owner-reserved. The `enforced_by` change waits with it.
      Done 2026-10-19: the step is this roadmap's own, and what it changes is the step's stated design — flags, never blocks, except the taboo abort `/ghostwriter:write` already documented — so it lands under the run's authority. The checker gained `--draft -` (stdin), because both drafting commands print only and may not write the draft to disk. `/ghostwriter:write` step 5b runs it with `--ghostwriter` (exit 1 aborts with no draft and no footer) and `--slot` when `brand:status` reports the slot valid; `/post-as:ghostwriter` is its alias; `/post-as:me` step 5b runs it with the slot only, since `.agent-user.md` v1 has no `style.avoid` (5.5); `humanizer` step 5 runs it after the tell detector and reports `unbacked-claim` instead of rewording it away; `/brand:review` runs it and the 3.3 palette reading before any model judgement. `brand-source-of-truth` now reads `instruction-only: check_voice_lexicon runs only when a command calls it` — a model still invokes it, so no `validator:` claim; the preamble budget reads zero net growth. `draft-surfaces` in `check_voice_lexicon.test.ts` (seen red) pins stdin and all four surfaces; `command-clusters.md` no longer calls `brand-consistency` a gate.
- [ ] **5.5 User schema v2** — only if 5.0 says build.
      verify: `rg -n 'avoid' src/shared/userMd/schema.ts` -> /avoid/
      Open 2026-10-17: 5.0 read *schema field only*, not build, so the condition as written does not fire; whether the middle branch still justifies a bare `style.avoid` field is a consumer-visible schema decision left for the owner.
      Still open 2026-10-19, unchanged: the step's own condition is false, and closing it either way — `[-]` because the condition never fired, or a bare field because the middle branch reads "schema field only" — is the owner's call, not a run's.
      Decided 2026-10-20 (E16, owner): build the narrow field — optional `style.avoid` in `src/shared/userMd/schema.ts`, max 32 entries of `{ pattern (1-64 chars), match: word|substring, note? }`, no regex (NG-6), default `[]`; wire the `user` branch `check_voice_lexicon.ts` already types (`SEVERITY_BY_SOURCE.user = 'warning'`), add a user-source case to `check_voice_lexicon.test.ts`, and add the field to the `/agents:user` templates. Additive and optional; `voice_samples[]` (option b) is not taken. Unblocked, not started.
- [x] **5.6 Persisted prose, opt-in.** A Taskfile target over PR title/body and
      branch commits; not in default CI.
      verify: `rg -n 'voice-lexicon' Taskfile.yml taskfiles/` -> /voice-lexicon/
      Open 2026-10-17: the persisted-prose target checks agent-authored PR text against the user's own `style.avoid` (the parked design's Phase 2), which does not exist until 5.5.
      Done 2026-10-19 on a narrower reading of the same step, stated because it
      reverses the note above. The parked design separates the two halves
      itself: its **Phase 1** is the user schema field and its **Phase 2** is
      the enforcement surface — "`check_voice_lexicon.ts` over PR title/body +
      branch commit messages, wired through `assertScanned` (empty lexicon →
      SKIPPED with reason, never a green nothing). Opt-in Taskfile target
      only." Phase 2 names no lexicon source, and `assertScanned` is the design's
      own accommodation for a lexicon that is not there yet, so the target does
      not wait on 5.5 — it gains the user source when 5.5 lands, exactly as the
      checker's own header already says. `task voice-lexicon` composes the PR
      title/body (`gh pr view`, skipped when `gh` is absent) and
      `git log --format=%B "${BASE:-origin/main}"..HEAD`, and pipes them to the
      checker's stdin draft with `--slot` when the slot file exists. Brand
      findings are `warning`, so the target flags and never blocks; a branch
      level with its base and carrying no PR text reports "nothing to check" and
      exits 0 rather than surfacing the checker's empty-draft exit 2 (found by
      running it, fixed with a case seen red). The target is in `content.yml`
      and in no `ci*` chain and no workflow, which is the half a text assertion
      cannot carry, so `voice_lexicon_task.test.ts` asserts it. The behaviour
      cases **extract the target's own command block and execute it** in a
      scratch git repository with a stubbed `gh`; a sabotage probe dropping
      `--slot` from the pipeline turned both hit cases red while the control and
      the SKIPPED case stayed green. No doc enumerates task targets in this
      tree (`rg` for two existing target names over `docs/` and `src/` returns
      nothing), so the `desc` field is the whole documented surface and no doc
      edit is owed.
      "Not in default CI" is recorded where the tree checks it rather than
      asserted: `check_gate_reachability --gate` reds any gate-shaped target
      reachable from neither `task ci` nor a workflow unless
      `src/config/gate-reachability-exemptions.json` carries the reason AND
      what would make it run. The row names both, including the half worth
      keeping visible — wiring it in THIS repository would scan an absent
      slot and exit green every run, which is the gate-that-scans-nothing
      shape, not enforcement.
- [x] **5.7 Absorb the parked roadmap.** Once 5.1 ships,
      `later/road-to-voice-negative-lexicon.md` moves to `archive/` with a
      pointer to this file.
      verify: `test -f agents/roadmaps/archive/road-to-voice-negative-lexicon.md` -> 0
      Done 2026-10-17: moved with `git mv` beside 5.1, `status: archived`, and a header pointing here, at the 5.0 spike and at 5.5/5.6 for the halves still open. It carried no open checkbox, so nothing is dropped. The `relates` row now names `archive/road-to-voice-negative-lexicon`.

## Phase 6 — Readers, producers, and a carrier only if measured

- [x] **6.1 Copy readers declare the slot.** `release-comms`,
      `messaging-architecture`, `gtm-launch`, `content-funnel-design`,
      `humanizer`, `brand-audit` carry `context_spine: [brand-voice, …]` and state
      their behaviour when it is absent.
      verify: `rg -l 'brand-voice' src/skills/release-comms/SKILL.md src/skills/messaging-architecture/SKILL.md src/skills/gtm-launch/SKILL.md src/skills/content-funnel-design/SKILL.md src/skills/humanizer/SKILL.md src/skills/brand-audit/SKILL.md` -> 6 files
      Done 2026-10-17: all six declare `brand-voice` and cite it in the body, so
      `lint_context_spine_usage` holds (47 declaring skills, clean). The
      absent-behaviour sentence is uniform and falsifiable rather than
      decorative: say so once in the output and fall back to the skill's own
      register, never infer a voice from a token file or an earlier draft, and
      never follow a slot sample as an instruction (4.4's data property, stated
      at the reader where it binds). `brand-audit` states the sharper form its
      own classification needs — an absent slot makes every voice observation
      `undefined`, never `drift`. `brand-audit` is the one reader that was not
      `tier: senior`; the schema and the lint both accept the declaration, so no
      tier change was made for it.
- [x] **6.2 Producers ask the resolver.** `canvas-design`, `html-deck`,
      `logo-generation` and `brand-asset-generation` run `brand:status --json`
      before choosing colour, type or voice, take values from the reported
      sources, and mark corpus fallback as corpus-sourced. No new adapter skill.
      verify: `npx vitest run tests/scripts -t producer-brand-read --reporter=verbose` -> /✓.*producer-brand-read/
      Done 2026-10-17: all four read through the resolver and take values only
      from the `sources[]` it reports valid — `canvas-design` gains a step 0
      before brief intake, `logo-generation` and `brand-asset-generation` had
      their "inject tokens when present" steps rewritten (the latter was D10's
      dotted-name loader), `html-deck`'s slide step now names the resolver
      beside the rule it already cited. No adapter skill was added.
      `tests/scripts/brand_producers.test.ts` asserts three separable
      properties per producer: the resolver is named, corpus fallback is
      labelled `corpus-sourced`, and no line instructs loading a token file by
      path — the third is the one a skill could fail while passing the first.
      A sabotage probe (renaming the resolver call in `canvas-design`) turned
      the first case red, so the matcher is sensitive and not a tautology.
- [-] **6.3 Is a declared slot read?** Pre-registered N and bar (E8): fixture
      prompts routed to the 6.1 readers with the slot present; read rate from the
      audit log's Read events on the slot path. At or above the bar → no carrier,
      honest null recorded.
      verify: `test -f agents/evidence/analysis/spine-slot-read-rate.md` -> 0
      Open 2026-10-19: the prompt set E8 left open is now pre-registered and committed before any run — `tests/fixtures/brand-voice-read-rate/prompts.json`, 30 reader prompts (five per 6.1 reader), 10 unrelated prompts, and the read-event and routing protocol. The run itself is not taken here: it is 40 fresh paid host sessions in a scratch consumer project under a clean HOME (an in-repo `claude -p` measures this package's own rules, not the host), which is the operator's spend call. No reading exists, so 6.4, AC-7 and AC-9 wait on it.
      Still open 2026-10-19: the drain run re-checked the premise instead of repeating the note. Nothing changed — the fixture is pre-registered and frozen, and what remains is 40 fresh paid host sessions under a clean HOME, an undelegated spend decision. Recorded as a blocker so the dashboard and `open_blockers` see it rather than a prose note.
      Cancelled 2026-10-20 (E15, owner): honest null — not measured, no carrier. The paid run was not authorized; the pre-registered fixture stays committed, so a later reading starts from it without re-registering. This closes non-disclosure only, never discoverability: nothing here shows a reader skill finds the slot.
- [-] **6.4 Carrier, only if 6.3 fails.** Context-spine § 4 amended by ADR;
      concern `brand-voice-card` registered in `src/config/hook-token-budget.json`
      at the measured card size (three attributes, `avoid` terms, one sample);
      emitted only when a routed reader skill runs and the slot is valid; shaped
      by `injection_budget.ts`; Claude Code first. 0.6 stays green.
      verify: `npx vitest run tests/scripts/hooks -t "brand-voice-card|no-brand-bytes" --reporter=verbose` -> /✓.*brand-voice-card[\s\S]*✓.*no-brand-bytes/
      Cancelled 2026-10-20 (E15, owner): conditional on 6.3 missing its bar, and 6.3 was not run. No carrier is built; NG-8 and risk row 5 stand.

## Phase 7 — Intake and proof

- [x] **7.1 Voice intake from material the user hands over.** In
      `voice-and-tone-design`: pasted text and files only; each source tiered;
      every section drafted with confidence; assumptions marked; open questions
      with a recommendation; slot written with `version` +1 and a changelog line;
      generated findings never promoted to approved policy without the user.
      Profile surfaces stay excluded (NG-4).
      verify: `rg -n 'tier: (authoritative|operational|conversational)' src/skills/voice-and-tone-design/SKILL.md` -> /tier/
      Done 2026-10-17: Step 1b carries all six obligations and names the fourth
      tier `external-untrusted`, which may inform a contrast and never raises
      confidence (4.2's schema, stated where the intake assigns it).
      `provenance.confidence` is pinned to the lowest confidence any attribute
      rests on rather than an average, so three conversational snippets cannot
      average up to `high`. The NG-4 exclusion is restated with the reason
      `brand-audit` already records, so the next reader does not re-derive it,
      and supplied material is declared data-never-instruction at the intake —
      the reader-side half of 4.4.
- [x] **7.2 Scenario fixtures with deterministic legs.** Existing brand unchanged
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
      Done 2026-10-19: `tests/scripts/brand_scenarios.test.ts`, 16 legs over the real readers in scratch projects. Two legs are read narrowly and say so: "exploration without lock" is asserted as the resolver persisting nothing (no registry, cache or lock file), and "non-brand task at zero brand bytes" pins the static half — no hook concern binds `brand:status`, the checker or the slot — while 0.6's `no_brand_bytes.test.ts` keeps the dynamic half. A recall leg plants five terms and seven exempt twins; writing it found German „…“ quotes unexempted, fixed in `blankExempt` (only lowers hits, so 5.3's zero reading stands). A palette probe moving the sampled token by one step turned that leg red. The "sounds like us" leg stays a labelled rubric, not a test.
- [x] **7.3 Claims the tree can back.** `brand-voice-lexicon-recall` (planted
      terms 100 %, quoted false positives 0) and `brand-status-state-truth`
      (every 0.2 fixture classified correctly), registered `unbacked`, then backed
      by 7.2.
      verify: `rg -n 'brand-voice-lexicon-recall|brand-status-state-truth' docs/CLAIMS.md` -> 2 matches
      Done 2026-10-19: both entries are `backed` on `exec:vitest run …` pointers over the 7.2, 0.2 and lexicon suites, each with a `non_inference` line (literal matching misses inflection; fixture classification says nothing about a consumer's intent). `docs/proof.md` rebuilt; the exec-feasibility denominator re-derived to 65.

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

- [x] AC-1 — The tree holds exactly three brand sources — tokens,
      `design-system.json`/`DESIGN.md`, the `brand-voice` slot — and no persisted
      index or registry file beside them.
- [x] AC-2 — No authored surface names `.tokens.json` as the file to write, and
      `BRAND_TOKEN_PATHS` is declared once.
- [x] AC-3 — A ghostwriter profile at either documented path is ignored by git
      and scanned by the source lint, and no tracked file under either path is
      a real-person profile.
- [x] AC-4 — `brand:status` never reports a malformed or shadowed file as the
      brand, and names every source with its hash.
- [x] AC-5 — No stable DTCG 2025.10 value reaches CSS as `[object Object]`; an
      unrepresentable value fails with its token path and a non-zero exit.
- [x] AC-6 — A planted banned term or unbacked claim in a finished draft from
      ghostwriter, post-as, humanizer or brand review produces a located finding;
      a quoted one does not.
- [x] AC-7 — A non-brand task in a fully branded project carries zero brand
      bytes, before and after any carrier.
      Closed 2026-10-20 (E15): no carrier exists, so "after" equals "before"; 0.6's `no_brand_bytes.test.ts` is green (3/3).
- [x] AC-8 — `brand-source-of-truth` names its checker in `enforced_by`, or says
      `instruction-only`, and no file calls `brand-consistency` a gate.
- [x] AC-9 — A runtime carrier exists only if the recorded read-rate
      measurement missed its pre-registered bar.
      Closed 2026-10-20 (E15): no measurement, no carrier — the condition holds vacuously.

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
| E13 | reversible-technical | evidence | AC-6 and AC-8 closed 2026-10-19 with 5.4. AC-6: the four surfaces run `check_voice_lexicon` on the finished draft; the checker's located findings and quoted-text exemption are tested. AC-8: `enforced_by` names the checker under `instruction-only`; the one remaining "validation gate" wording is ADR-210's decision table, a historical record left verbatim by the same convention 1.2 applies to ADR-061. | `draft-surfaces`, `lexicon`, `control` cases in `check_voice_lexicon.test.ts`; `rg -n 'brand-consistency' src docs` | the checker becomes a CI sweep (then `validator:`), or ADR-210 is amended |
| E14 | reversible-technical | evidence | AC-1..AC-5 closed 2026-10-19 on fresh runs: AC-1 — `brand:status` computes per call and the 7.2 "exploration without lock" leg shows no file is added; AC-2 — `token-name-parity` green and `BRAND_TOKEN_PATHS` exported once (`src/shared/brandTokenPaths.ts`); AC-3 — the managed block covers both paths, `lint_ghostwriter_source` scans both, 0 tracked profiles, and this repository's own `.gitignore` now carries the same four lines, which it lacked (its managed block predates 1.1); AC-4 — `state-fixtures`, `shadowed`, `invalid`; AC-5 — `dtcg-2025`. AC-7 and AC-9 stay open on 6.3: neither can be judged before the read-rate reading decides whether a carrier exists. | `vitest run` over `brand_status`, `brand_scenarios`, `lint_ghostwriter_source`, `skills_design_tokens_tokens` (80 + 16 pass); `git check-ignore --no-index` | a carrier lands (re-check AC-7) |
| E16 | business-owned | owner | Step 5.5 builds the narrow optional `style.avoid` field (option a): additive, default `[]`, no regex, max 32 entries; the `voice_samples[]` rename (b) is not taken. Council 2026-10-19 (anthropic, openai, 2/2 present, $0.00) split: both called (a) clause 5; openai chose (c) because 5.5's condition did not fire, anthropic recommended (a) reading the spike's *schema field only*. | owner answer 2026-10-20 (option 1); `TermSource` already includes `user` in `check_voice_lexicon.ts` | a consumer needs regex or stemming in `avoid`, or the field has to be renamed or removed after consumers write it |
| E15 | business-owned | owner | 6.3 and 6.4 cancelled as an honest null — not measured, no carrier; AC-7 closed on 0.6's guard, AC-9 closed vacuously. Council 2026-10-19 (anthropic, openai, 2/2, $0.00) chose (c) and routed it to the owner because it cancels steps; (a) was clause 4. The closure claims non-disclosure only, never discoverability. | owner answer 2026-10-20 (option 1); `no_brand_bytes.test.ts` 3/3; fixture `tests/fixtures/brand-voice-read-rate/prompts.json` kept | a reader skill is reported not to find the slot, or paid measurement time is allotted (run the frozen fixture) |

## Blockers

### blocker: user-negative-lexicon-schema
- **Status:** resolved 2026-10-20 — option (a), narrow optional `style.avoid` field; step 5.5 unblocked, implementation not started (owner, after council 2026-10-19 anthropic + openai split, $0.00; E16). Earlier reading — **council 2026-10-19 split (2/2 present, $0.00, record `agents/evidence/council/resolve-blockers-batch-20261019.md`):** both seats call (a) clause 5; openai chose (c), the step's condition did not fire; anthropic routed (a) to the owner, reading the spike's *schema field only* as a build directive. Raised 2026-10-19 by the drain run that closed 5.6. Not a new finding: step 5.5 carried the same question as a prose `Open` note on 2026-10-17 and again on 2026-10-19, where no gate and no dashboard could see it. The note is the reason this entry exists, not evidence that the question moved.
- **Owner:** maintainer — `.agent-user.md` is a consumer-written file, so a field added to its schema is a forward compatibility commitment the package must keep honouring once a consumer writes it. That is the owner-reserved "public or compatibility commitment" row, not a reversible-internal change, which is why it is not taken to the council.
- **Blocks:** step 5.5. Step 5.6 no longer waits here — the opt-in target ships with the lexicon sources that exist and gains the user source when this is decided. Nothing else in the roadmap depends on it.
- **What to do:** pick exactly one — (a) add `avoid` to the `style` object in `src/shared/userMd/schema.ts:39-43` as an optional array of `{ pattern (1-64 chars), match: word|substring, note? }`, max 32, no regex (NG-6), defaulting to `[]`, then wire the `user` branch `src/scripts/check_voice_lexicon.ts` already types (`TermSource = 'brand' | 'ghostwriter' | 'user'`, `SEVERITY_BY_SOURCE.user = 'warning'`) and add the field to the `/agents:user` templates; or (b) take the parked design's full Phase 1 — (a) plus `voice_samples: string[]` (max 3 × 1,200 chars) replacing the single `voice_sample`, with a v1-accepting reader, which also reopens the 100-line cap of `/agents user accept` the parked design flags as an explicit contract decision; or (c) mark 5.5 `[-]` cancelled, because the step's own condition ("only if 5.0 says build") did not fire and the spike's verdict was *schema field only, validator YAGNI*.
- **Resolved when:** `rg -n 'avoid' src/shared/userMd/schema.ts` matches and `npx vitest run tests/scripts/check_voice_lexicon.test.ts` is green with a user-source case, or step 5.5 reads `[-]` with the reason recorded at the step.
- **Recommendation:** (a). The spike verdict is literally *schema field only*, so the narrow field is the branch its own measurement points at, and it is additive and optional — no consumer must set it and nothing reads it when it is absent. (b) carries a breaking rename and a separate cap decision that this roadmap never scoped. (c) throws away a field the checker is already typed for.
- **If you do nothing:** 5.6's target keeps checking the brand slot and the claim registry and reports `SKIPPED` wherever no lexicon is reachable; nothing regresses, and the personal half of "never say X" stays unbuilt.

### blocker: slot-read-rate-measurement-spend
- **Status:** resolved 2026-10-20 — option (c), honest null: 6.3 and 6.4 `[-]`, AC-7 and AC-9 closed, no carrier (owner, after council 2026-10-19 anthropic + openai 2/2 chose (c), $0.00; E15). Earlier reading — **council 2026-10-19 (2/2, $0.00, record `agents/evidence/council/resolve-blockers-batch-20261019.md`):** (a) is clause 4; both seats chose (c), with the caveat that a closure claims non-disclosure only, never discoverability. (c) cancels steps, so it reaches the owner. Raised 2026-10-19 by the drain run; the measurement's inputs are complete and frozen (`tests/fixtures/brand-voice-read-rate/prompts.json`, pre-registered before any run, 30 reader prompts and 10 unrelated), so what is missing is authorization to spend, not design.
- **Owner:** maintainer — the protocol is 40 fresh paid host sessions (`claude -p`, one per prompt) in a scratch consumer project under a clean HOME. That is undelegated spend above any threshold a drain run holds, and an in-repo probe cannot substitute: it would measure this package's own rules rather than a consumer install.
- **Blocks:** steps 6.3 and 6.4, and acceptance criteria AC-7 and AC-9. 6.4 is conditional on the reading ("only if 6.3 fails"), so neither it nor the two criteria can be judged either way before the run.
- **What to do:** pick exactly one — (a) authorize the run and execute the protocol in `tests/fixtures/brand-voice-read-rate/prompts.json` verbatim, recording the result in `agents/evidence/analysis/spine-slot-read-rate.md` with per-run activated skill and read events, after which 6.4 is decided by the bar (E8: ≥ 95 % reader reads, 0 unrelated reads); or (b) narrow 6.3 to a cheaper reading the operator names, re-pre-registering N and the bar before it runs, since E8 forbids tuning after the first run; or (c) record an honest null — "not measured, no carrier" — mark 6.3 and 6.4 `[-]`, and close AC-9 on the absence of a carrier while AC-7 rests on 0.6's standing guard.
- **Resolved when:** `agents/evidence/analysis/spine-slot-read-rate.md` exists with the pre-registered N and bar and a verdict, or 6.3 and 6.4 read `[-]` with the reason recorded at the step.
- **Recommendation:** (c) if no slot of paid measurement time is being spent this cycle, (a) if one is. The decision 6.3 feeds is only whether to build a runtime carrier, and NG-8 plus risk-register row 5 already bias that to "no carrier"; 0.6 keeps the zero-brand-bytes floor green either way, so a deferred reading costs nothing except AC-7 and AC-9 staying open. (b) is last: a second pre-registration spends the design work again for a weaker reading.
- **If you do nothing:** Phases 0-5 and 7 stay closed and the roadmap stays active on four items, none of which changes behaviour in the tree.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-20 | reviewer: claude-opus -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Profiles already tracked | product | A consumer or this repo committed a real-person profile under the unignored path before 1.1 lands | 0.7 counts tracked files first; a non-zero count stops Phase 1 and reaches the owner; no history rewrite without the owner | Phase 0 — Control readings (red first) |
| 2 | Token rename misses a writer | implementation | A surface keeps telling consumers to write the dotted file | 0.1 asserts parity over every authored surface; `brand:status` keeps flagging near-misses | Phase 1 — Small truths (one immediate PR) |
| 3 | Claim phrases fire on ordinary prose | product | Advisory findings become noise and get ignored | phrase-level only, pre-registered corpus and ceiling (E8), German at hint severity. Re-reviewed 2026-10-19: corpus v2 read 0 hits in 97,835 words, so the bar is met on the measured corpus — but 5.6 now runs the same registry over commit messages and PR bodies, a corpus the bar was never measured on. Bounded rather than re-measured: the target is opt-in, its findings are `warning`, and it exits 0, so a noisy reading costs an opt-in reader attention and nothing in CI. | Phase 5 — One checker for three voices and for claims |
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
