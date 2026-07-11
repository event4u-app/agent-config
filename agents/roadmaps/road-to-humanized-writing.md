---
complexity: lightweight
status: ready
execution:
  mode: autonomous
---

# Road to humanized writing — pattern-audited drafts across the write engine

> Adopt the transferable mechanisms of an external MIT-licensed humanizer
> reference skill (Source A, derived from Wikipedia's public "Signs of AI
> writing" guide) as (a) a lean two-phase `humanizer` skill, (b) a
> deterministic AI-tell detector script, and (c) a draft→audit→final pass
> inside the write-engine contract — scoped to **deliverable text only**,
> never chat replies, never repo docs.

## Goal

When the agent acts as a ghostwriter (`/ghostwriter:write`, `/post-as:me`,
`/post-as:ghostwriter`) or runs an explicit humanize pass on user-facing
prose, the output passes a measurable AI-tell audit before delivery: hard
pattern hits and the weighted cluster score on the final draft stay at or
below configured thresholds, verified on a fixture corpus before any surface
adopts the pass.

## Council notes (2026-07-11, debate, 2 rounds)

Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-11) converged;
verdicts encoded below — don't relitigate without new evidence:

- **Q1 shape:** standalone skill **plus** an opt-out write-engine hook
  (option d). A guideline alone is not executable; the write-engine's
  missing post-draft pass is a structural gap inside its beta window.
- **Q2 surfaces:** default-on **inside the write engine** (step 4b) with a
  per-run opt-out. For `/post-as:me` the pass is the contract itself —
  "post AS me" means AI tells are replication defects, not preferences
  (sonnet round-2 rebuttal). `/ghostwriter:write` keeps the opt-out for
  legitimate neutral-register use. Technical/reference output is **hard
  excluded** — neutral, plain prose IS the correct human voice there (the
  source's own warning). Chat replies stay with `direct-answers` /
  `telegraph-speak`; content skills get cross-links, not a mandatory pass.
- **Q3 em-dash:** the source's zero-dash hard rule is **rejected** —
  architecturally inconsistent with house style and CP1 precedent. Adopt a
  density cap (CP1 parity: flag > 2 per 500 words), fingerprint-precedence
  (a captured voice that legitimately uses em dashes wins), and a per-run
  strictness knob. Never applied to repo-doc authoring.
- **Q4 detector:** deterministic detector ships **first (Phase 0)** as the
  measurement substrate — pattern-hit counts make every later exit gate
  falsifiable (design-antislop precedent: zero-token deterministic
  detector). The council's scope-creep objection (gpt-4o round 2) targeted
  a CI-linter *product*; resolved by re-scoping: fixture-gated script used
  at generation time and in evals, **never** a CI gate over repo docs.
- **Q5 ethics:** the ghostwriter disclosure footer is **inviolable** — the
  humanizer must never strip or reword it (it is structurally a
  "communication artifact" tell the pattern list would otherwise flag).
  Hard stop for academic/legal contexts where AI-authorship disclosure is
  required.
- **Q6 PERSONALITY/SOUL:** **cut from v1.** Voice injection conflicts with
  two existing voice sources; precedence order is fixed as: profile
  fingerprint > registered brand voice > humanizer defaults. Revisit-if:
  repeated user demand for opinionated voice injection.

## Provenance

- Source A — an external MIT-licensed humanizer reference skill (single
  SKILL.md, v2.8.2, ~620 lines), analyzed at source level 2026-07-11.
  Link: `ENC1:eusu+epjVfc67+wDEU1F0EZe+evfgagYG3tlazHfWS37cc6RSEfX2izKEIwyxKW9LEwOaN1IksZ/HLaxR/QQd/nVWJYnBOGRlS2imakLM393YNB1WxZh0EiK3D0NNcqALihg`
- Root pattern source (public, citable in artifacts): Wikipedia,
  "Signs of AI writing", maintained by WikiProject AI Cleanup (CC BY-SA).
- License hygiene: all catalog wording, before/after pairs, and fixtures are
  authored fresh in our own words — no verbatim copying from Source A, so no
  MIT attribution obligation attaches; the skill's Reference section cites
  the Wikipedia guide only.

## Context — gap-table (KEEP / FOLD / CUT)

Source A catalogs 33 AI-writing patterns in five groups (content,
language/grammar, style, communication, filler/hedging) plus three
mechanisms that carry the actual value: the draft→audit→final loop ("what
makes this obviously AI generated?"), false-positive guards (count
clusters, never isolated hits; never rewrite quotes/titles/proper names;
preserve human-writing signals), and voice calibration against a writing
sample.

Overlap audit against this repo (verified at source level 2026-07-11):

| Source A item | Existing asset | Verdict |
|---|---|---|
| §20 collaborative artifacts, §22 sycophancy, §28 signposting | `src/rules/direct-answers.md` Iron Laws 1+3 (chat replies) | **FOLD** — covered for replies; the skill states the deliverable-only boundary instead of adding a second sycophancy rule |
| Voice calibration from a sample | `docs/contracts/write-engine.md` §4 fingerprint (sentence_length_avg ±25%, opener/closer, cadence, emoji rules) | **CUT** — ours is stronger and structured; reuse the fingerprint, no second voice mechanism |
| Ghostwriting use case | `/ghostwriter:*` + `/post-as:*` cluster, ghostwriter-schema, taboos, mandatory disclosure footer | **FOLD** — integration point (engine step 4b), not a parallel path |
| "Never rewrite quoted text" guard | `src/rules/content-quoting-floor.md` | **FOLD** — the skill cites the rule |
| Brand voice | `src/skills/voice-and-tone-design` (GTM strategy level) | **CUT** — different layer; skill's Do-NOT routes there |
| Emoji/boldface discipline | `direct-answers` (chat), `docs/guidelines/design-antipatterns.md` CP1–CP5 (UI copy), `output-discipline` (code) | **FOLD** — deliverable-prose variants live in the detector; CP1's em-dash cap is adopted as the prose default |
| PERSONALITY AND SOUL voice injection | fingerprint + brand voice already own voice | **CUT** (council Q6) |
| Pattern catalog §1–33 + audit loop + false-positive guards | **nothing** — no skill, rule, or script covers AI-tell removal in prose deliverables | **KEEP** — the gap this roadmap closes |

House constraints shaping the design:

- **Token economy:** Source A is a 33 KB eager-loaded file. We split:
  lean `SKILL.md` (~80 lines, procedure + router) + full catalog in
  `data/patterns.md` loaded only during an active pass (index/detail
  economy already used elsewhere in the suite).
- **Falsifiability:** the mechanically detectable subset (em/en-dash
  density, ` -- ` pairs, AI-vocabulary list, bold-header vertical lists,
  emoji headings, title-case headings, filler phrases, negative-parallelism
  stems, "from X to Y" density, curly quotes) becomes a deterministic
  script with a fixture suite — measurement before feature.
- **Own-docs exemption is non-negotiable:** this repo's docs and roadmaps
  use em dashes deliberately. The detector never runs as a CI gate over
  `docs/`, `agents/`, or `src/**/*.md`. Scope = generated deliverable text
  at generation time + the explicit on-demand command.

## Prerequisites

- [ ] Confirm `docs/contracts/write-engine.md` still carries
      `stability: beta` / `keep-beta-until: 2026-08-13` (verified
      2026-07-11) — a step addition inside the beta window is a minor
      contract edit; if the window lapsed before Phase 2 starts, re-scope
      Phase 2 as a versioned contract change first.
- [ ] Confirm `gtm-marketing` pack (`src/domains/gtm-marketing/pack.yaml`)
      is the distribution surface and its `size_class` budget has headroom
      for one skill + one command.
- [x] Decision D1 — humanize pass default-on inside the write engine,
      per-run opt-out (`--raw`); off everywhere else; no global rule.
      <!-- resolved by council 2026-07-11, Q2 verdict above -->

## Phase 0 — Detector + fixture corpus (measurement substrate first)

Build `src/scripts/detect_ai_tells.ts`, mirroring the
`design_slop_rules.ts` / `lint_design_slop.ts` split:

- [x] Pattern registry as a data module (`src/scripts/ai_tells_rules.ts`):
      id, group, regex or token list, weight, `language: en` (`de`
      reserved), `severity: hard | cluster`. Hard = single hit counts
      (emoji heading, ` -- ` pair, knowledge-cutoff disclaimer stems).
      Cluster = weighted score only (AI-vocabulary words, filler phrases,
      rule-of-three, negative parallelism, curly quotes) — encodes the
      source's own false-positive guidance ("clusters, not isolated hits").
      Em/en dashes are a **density rule** (flag > 2 per 500 words, CP1
      parity), not hard-zero (council Q3).
- [x] Exemption handling: fenced code blocks, inline code, blockquotes,
      URLs, frontmatter, and quoted spans are never scanned (the
      "secondhand text" guard; cites `content-quoting-floor`).
- [x] Output: JSON `{hard_hits, dash_density, cluster_score, per_pattern}`
      plus a human summary; exit 0/1 against `--max-hard` /
      `--max-score` / `--max-dash-density` thresholds.
- [x] Fixture corpus `tests/fixtures/ai-tells/`: ≥ 10 before/after pairs,
      authored fresh in our own domains (GTM post, README section,
      LinkedIn draft, blog paragraph, release note). Every "before" scores
      above threshold, every "after" below. Vitest suite pins this.
- [x] Run the new suite once locally to verify the gate
      (`npx vitest run tests/<new-suite-path>`)
      <!-- carve-out: new-gate-verification -->

**Exit criteria:** detector catches 100% of hard tells in fixtures with 0
false positives on the "after" set; suite green in the targeted run.
**Rollback:** delete script + fixtures; nothing else references them yet.

## Phase 1 — `humanizer` skill (two-phase, deliverable-scoped)

- [ ] `src/skills/humanizer/SKILL.md` (~80 lines): frontmatter per the
      `voice-and-tone-design` shape (`domain: product`, `tier: senior`,
      `workspaces: [gtm]`, `packs: [gtm-marketing]`,
      `recommended_for_user_types: [creator, consultant, gtm]`,
      `trust.level: professional`, `cloud_safe: degrade`). Body: When-to-use
      / Do-NOT-use (routes chat-reply tone → `direct-answers`, brand voice →
      `voice-and-tone-design`, voice capture → `/ghostwriter:fetch`), the
      draft→audit→final procedure, the false-positive/cluster discipline,
      the inviolable-footer + academic/legal hard-stop guards (council Q5),
      and a pointer to run `detect_ai_tells.ts` on the final draft when a
      runtime is available (prose-only fallback otherwise). Include
      `## Gotcha` and ≥ 2 Output requirements (skill-linter floor).
- [ ] `src/skills/humanizer/data/patterns.md`: the full catalog in our own
      wording — five groups with before/after pairs, what-NOT-to-flag,
      human-signals-to-preserve. Loaded only during an active pass;
      untouched by the condenser.
- [ ] `evals/triggers.json`: 5 should-trigger ("make this sound less like
      AI", "this post reads like ChatGPT wrote it", "humanize this draft",
      "remove the AI-isms from my article", "rewrite so it doesn't sound
      generated") + 5 near-miss non-triggers ("define our brand voice",
      "stop opening replies with praise", "write a post as <figure>",
      "translate this to German", "shorten this paragraph").
- [ ] Reference section cites the Wikipedia "Signs of AI writing" guide
      (public); no external-repo naming (source-confidentiality).
- [ ] Downstream surface for a new plain skill: register in
      `.claude-plugin/marketplace.json` `skills[]` (hand-maintained) and
      re-run discovery/regeneration so pack/tier tables stay in sync.
- [ ] Verify: `./scripts-run src/scripts/skill_linter` targeted at the new
      skill + trigger evals pass.

**Exit criteria:** skill-linter green for the new skill; trigger evals
pass; condensed SKILL.md within the pack's size budget with `data/`
untouched.
**Rollback:** remove the skill directory + marketplace entry; Phase 0
artifacts stand alone.

## Phase 2 — Write-engine v1.1: audit pass as engine step

Amend `docs/contracts/write-engine.md` inside the beta window:

- [ ] New **step 4b — humanize audit** between Draft (4) and Footer (5):
      run the audit question ("what makes this draft read AI-generated?")
      against the draft, revise, and where a runtime exists verify the
      final draft with `detect_ai_tells.ts` under engine thresholds.
      Default-on for all engine consumers; per-run opt-out `--raw`
      (D1). **Fingerprint precedence written into the contract:** when the
      profile's captured voice legitimately uses a watched pattern (em
      dashes, `emoji_rules: allowed`), the fingerprint wins and that
      pattern is suppressed for the run — never left to judgment.
- [ ] Disclosure footer (§5) explicitly exempt from the audit: a literal
      template string the humanizer must never touch (council Q5).
- [ ] Technical/reference output exclusion: when the requested artifact is
      reference/technical documentation, step 4b is skipped and says so
      (neutral register is correct there).
- [ ] Config: `humanizer:` block in
      `src/config/agent-settings.template.yml` — `write_engine: on`,
      `max_cluster_score`, `max_dash_density`, `language: auto`.
- [ ] Extend ghostwriter cluster tests: the fictional fixture profile
      draft passes the detector; a deliberately AI-ism-seeded draft fails
      step 4b. Run the extended tests targeted
      (`npx vitest run <cluster-test-path>`).

**Exit criteria:** contract updated and lint-clean; extended cluster tests
green in the targeted run; one recorded before/after run on the fictional
fixture showing draft-vs-final hard-hit + cluster-score reduction.
**Rollback:** revert the contract edit + template block; skill remains
usable on demand without the engine hook.

## Phase 3 — On-demand surface: `/humanize` command + cross-links

- [ ] New command `src/domains/gtm-marketing/humanize/command.md`
      (suggestion-eligible, `skills: [humanizer]`): takes pasted text or a
      file path, runs the full loop, prints audit notes + final rewrite +
      detector summary. Optional `--voice=<ghostwriter-slug|me>` reuses the
      write-engine style-source resolution — no new voice mechanism. No
      file writes (engine rule).
- [ ] Walk the full standalone-command downstream surface (7 places:
      command file, cluster/pack registration, discovery regen, tiers +
      README tables, projections via the generation tasks) — run the
      generation tasks on a clean tree.
- [ ] Cross-link (one See-also line each, no content duplication):
      `readme-writing`, `readme-writing-package`, `doc-coauthoring`,
      `content-funnel-design`, `editorial-calendar`, `release-comms` →
      "final prose pass: `humanizer`".
- [ ] Verify: command lint + `/humanize` trigger evals pass; discovery
      check green (`./scripts-run` targeted invocations).

**Exit criteria:** command registered across the downstream surface;
trigger evals pass; cross-links resolve (reference checker green on the
touched files).
**Rollback:** remove command + cross-link lines; skill and engine hook
unaffected.

## Phase 4 — German pattern subset (language-aware, demand-gated)

Blocked — see `## Blockers` (`de-subset-demand`). Source A is
English-only; the primary user writes German content.

- [x] Add `language: de` entries to the pattern registry: filler ("es ist
      wichtig zu beachten", "im heutigen digitalen Zeitalter", "in der
      heutigen schnelllebigen Welt"), connector stacking ("zudem",
      "darüber hinaus", "des Weiteren"), significance inflation ("spielt
      eine entscheidende/zentrale Rolle", "markiert einen Wendepunkt",
      "unterstreicht die Bedeutung"), Gedankenstrich density.
- [x] DE fixture pairs in `tests/fixtures/ai-tells/`; audit questions stay
      language-mirroring per `language-and-tone`.
- [x] EN regression: Phase 0 suite unchanged and green (targeted run).

**Exit criteria:** DE fixtures pass; EN behavior unchanged.
**Rollback:** remove `language: de` entries + DE fixtures.

## Phase 5 — Measurement + claims (honest-null accepted)

- [ ] Paired eval on ≥ 20 drafts (10 EN ghostwriter, 10 content):
      objective pattern-hit reduction (detector) + blind preference
      judgment, **length-controlled** (the token program's verbosity-bias
      finding makes uncontrolled pairs unusable).
- [ ] Bind any public sentence about the feature to `docs/CLAIMS.md`
      (`<!-- claim:humanizer-tell-reduction -->`) with the eval as
      evidence. **Banned claim:** "undetectable by AI detectors" — we
      measure our own pattern counts, not third-party detector outcomes;
      that claim is unfalsifiable from our side.
- [ ] Null result (no blind preference lift) is publishable: keep the
      detector as a hygiene gate, soften skill copy to "pattern removal",
      record the honest null.

**Exit criteria:** eval recorded under the `docs/benchmarks` conventions;
claims-ledger entry `backed`, or feature copy carries no quantitative
claim.
**Rollback:** none needed — measurement phase; a null outcome updates copy,
not code.

## Blockers

### blocker: de-subset-demand

- **Status:** resolved <!-- maintainer green-light via full-roadmap execution order, 2026-07-11 -->
- **Owner:** maintainer
- **Blocks:** Phase 4
- **What to do:** collect usage signals for German humanization (a real
  user request for DE de-slopping, or a maintainer decision to pre-build
  for the primary user's German content).
- **Resolved when:** ≥ 1 recorded DE humanization request exists, or the
  maintainer green-lights Phase 4 explicitly.

## Non-goals

- Restyling **chat replies** — `direct-answers` + `telegraph-speak` own
  reply tone; a humanizer there creates dueling rules.
- CI enforcement over **repo docs** — house style (em dashes, bold inline
  headers) is intentional; the detector is a deliverable-time gate only.
- "Beat AI detectors" claims or adversarial-evasion framing — the goal is
  better writing; only measurable statements ship.
- A second voice-capture mechanism — fingerprints stay the single voice
  source (`ghostwriter-schema`, `agent-user-schema`).
- PERSONALITY-AND-SOUL voice injection (council Q6 cut; revisit-if
  repeated demand). Voice precedence stays: fingerprint > brand voice >
  humanizer defaults.
- Persona voices as style sources (already excluded by write-engine v1).

## Acceptance criteria

- [ ] Detector exists with a fixture suite: 100% hard-tell catch, 0 false
      positives on "after" fixtures (Phase 0 gate held at close).
- [ ] `humanizer` skill ships two-phase (lean SKILL.md + on-demand
      `data/patterns.md`), passes skill-linter + 5/5 + 5/5 trigger evals.
- [ ] Write-engine step 4b live with: default-on + `--raw` opt-out,
      fingerprint precedence, disclosure-footer exemption,
      technical-output exclusion — all four written into the contract.
- [ ] `/humanize` command registered across the full downstream surface;
      reuses ≥ 2 existing assets (humanizer skill + write-engine
      style-source resolution) — no new voice mechanism (anti-dump
      litmus).
- [ ] No new artifact duplicates an existing one: chat tone, brand voice,
      quoting, and code-placeholder lanes untouched (gap-table FOLD/CUT
      dispositions hold).
- [ ] Governance preflight: no new domain (within gtm-marketing —
  `domain-adoption-policy` does not fire), no new personas,
  framework-neutral (prose tooling, no stack mandates), skill within
  size budgets.
- [ ] Public copy about the feature is claims-ledger-bound or
      non-quantitative; the banned-claim line is respected.
