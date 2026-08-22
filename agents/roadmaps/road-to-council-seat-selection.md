---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---

# Road to council seat selection — refresh the pins, then let a run declare who is seated

> **Source:** `agents/tmp.old/roadmap-refactor.txt` — a cross-model planning
> transcript, drained 2026-08-22. Every `file:line` below was re-verified against
> the worktree on the drain date; one claim from the transcript drifted and is
> written at its current location, and one turned out never to have existed at
> all (see § Dropped).

## Goal

When this is finished, the starter council config no longer ships a
several-generation-old flagship as its default reviewer and cannot go stale
unnoticed; a run may declare what each seat is *for* and require the seats to
span more than one model family; a declared seat that cannot be filled degrades
loudly on one line instead of silently; and the roadmap-flavoured council
invocation is a flag on the council sub rather than a second command with its
own drift surface.

## Context

**Selection today is config-static ask-all.** `council_cli.ts:2252` builds the
member set as `[...cfg.members.entries()].filter(([, m]) => m.enabled)` — every
enabled member, every question, no per-question seating. The contract's
`## Top-level schema` block (`docs/contracts/ai-council-config.md:71`) documents
the per-provider shape at `:94-100`: `enabled`, `model`, `api_key_ref`, `binary`.
The validator `_build_member` in `src/scripts/ai_council/config.ts` accepts five
more — `mode` (read then ignored, `:1811`), `model_ladder` (`:1855`),
`participate_low_impact` (`:1896`), `tier` (`:1903`) and `prompt_cache`
(`:1919`). A repo-wide grep of the contract for `role` / `mission` / `diversity`
returns exactly one hit, `:1158`, a markdown table header. So the schema carries
no notion of what a seat is *for*.

**One near-miss worth stating rather than discovering later:** a `tier` key
already exists (`config.ts:1903`, documented at
`docs/contracts/ai-council-config.md:787` as "int ≥ 1, optional — capability rank
used only as the" chairman input). It is a *rank*, not a mission, and it is read
for one purpose. Phase 2 must extend beside it without redefining it.

**The confirmed defect, and the reason this roadmap leads with it.** The starter
config hard-pins a stale flagship on an enabled member:
`agents/templates/.ai-council.yml.example:293` reads `model: claude-sonnet-4-5`
inside `members.anthropic`. Three further pins sit on members shipped
`enabled: false` — `:384` `gemini-2.5-pro`, `:390` `grok-4`, `:397` `sonar-pro`
— so they cost nothing today and rot at the same rate. The contrast is the
useful part: the other enabled member, `:343`, reads `model: codex-default`, a
sentinel documented at `:367` as "let the CLI choose", and therefore cannot go
stale at all. One enabled seat delegates the model decision to the vendor CLI;
the other freezes it in a template nobody re-reads. A quality gate silently
running a several-generation-old model is the one confirmed defect here, and it
is the highest value for the lowest cost, so it goes first and spends nothing.

**Nothing in the file can notice.** `grep -n "verified_at\|stale"` over the
template returns two prose comments (`:65`, `:71`) and no key. The pins are
unversioned and unstamped.

**Reuse the tier vocabulary; do not build a second one.** Vendor-neutral
capability bands already ship: the rule at `src/rules/model-recommendation.md:22`
binds `model_tier`, and the enum `lite | medium | high | frontier | inherit` is
validated in three schemas — `src/scripts/schemas/skill.schema.json:165-174`,
`subagent.schema.json:37`, `command.schema.json:161` — with the tier→model map at
`src/scripts/_lib/model_tier.ts:36-41`. The doctrine is
`ADR-035-model-capability-tiers.md`, amended by `ADR-232-frontier-tier-reopened.md`.
A parallel registry of "good reviewer models" would be a second source of truth
for the same fact and is out of scope by construction.

## Dropped — three items from the source transcript, and why

The transcript proposed an "Evidence Packet" handed to each seat, a **blind
round 1**, and an **anonymous cross-examination round**. All three are dropped:
two already ship, and the third never existed.

- **Blind round 1 and anonymised later rounds already ship**, as an Iron Law:
  `src/skills/ai-council/SKILL.md:187-190` — the council never sees the host's
  analysis, "ROUND 1 SEES THE ARTEFACT + THE NEUTRAL SYSTEM PROMPT. NOTHING
  ELSE", round 2+ anonymised and never attributed, and the host is "THE
  CONVENER, NEVER A REVIEWER".
- **The anonymous cross-examination round already ships as an opt-in**:
  `src/skills/ai-council/references/advanced-modes.md:117`, activated by
  `--peer-review` or `peer_review.enabled` (`:136-138`), default `false`.
  Proposing it as new work would have rebuilt a shipped feature.
- **"Evidence Packet" is not a drift — it never existed.** A case-insensitive
  grep for `evidence packet` / `evidence_packet` / `EvidencePacket` across
  `src/`, `docs/` and `agents/` returns zero hits. The adjacent shipped
  vocabulary is the handoff envelope (`docs/contracts/ai-council-config.md:475`).
  Recorded here so a later reader does not go looking for a removed feature.

## Phase 1 — Refresh the pins, and make the file able to go stale out loud

Spends no vendor calls. Independent of Phases 2 and 3.

- [ ] **1.1 Re-read the pins before changing any of them.** Record the current
      value and enabled-state of each of the five `model:` keys in the template,
      so the diff in 1.2 is against a stated pre-state rather than against
      recollection.
      verify: `git show HEAD:agents/templates/.ai-council.yml.example | grep -n '^\s*model:'`
      lists exactly the five active keys at `293`, `343`, `384`, `390`, `397`
      with the values above; a differing list means the template drifted and 1.2
      re-scopes to the real one.
- [ ] **1.2 Refresh the stale pin, and prefer the sentinel where the vendor CLI
      offers one.** Replace the stale flagship at `:293`. Where a member's CLI
      exposes a "let the CLI choose" sentinel — the shape `:343` already uses —
      prefer it over a hard pin, because a sentinel cannot go stale and a pin
      always can. Where no sentinel exists, keep a pin and stamp it in 1.3.
      verify: the template's enabled members carry either a sentinel or a pin
      plus a `verified_at`; `grep -c 'claude-sonnet-4-5' agents/templates/.ai-council.yml.example`
      returns 0.
- [ ] **1.3 Add a `verified_at` stamp and an offline staleness guard.** Add an
      optional per-member `verified_at: YYYY-MM-DD` and a gate that warns past a
      declared age. Mirror `check_corpus_staleness` rather than inventing a
      second idiom: offline, deterministic, time injected via `--today` so a
      fixture cannot flip verdict with the calendar, and a future date is its own
      violation class.
      verify: the gate warns on a fixture whose `verified_at` is older than the
      cadence with `--today` pinned, stays silent on a fresh one, and errors on a
      future date — all three in one run, no network.
- [ ] **1.4 Extend the schema and the contract in the same change.** Add
      `verified_at` to `_build_member` beside the eight keys it already accepts,
      and add it to the schema block at `docs/contracts/ai-council-config.md:94-100`.
      Note in the same edit that the block documents four of the nine accepted
      keys; either complete it or state that the validator is authoritative.
      verify: a config carrying `verified_at` validates, one carrying a
      malformed date fails closed, and the contract block and `_build_member`
      agree on the accepted key set.

## Phase 2 — A run may declare what each seat is for

- [ ] **2.1 Add an optional constraint block, beside `tier` and not on top of
      it.** Introduce an optional per-member role/mission field and a run-level
      family-diversity constraint. `tier` (`config.ts:1903`) stays a capability
      rank read for chairman selection; the new field says what the seat is for.
      Absent block ⇒ today's behaviour, unchanged.
      verify: a config with no constraint block produces a byte-identical member
      list and a byte-identical rendered artefact against a recorded fixture run.
- [ ] **2.2 Resolve once per run, then freeze.** Seating is computed at run
      start from the declared constraints and the enabled set, written into the
      run record, and never recomputed mid-run. A seat that changed between
      round 1 and round 3 would silently invalidate the anonymised-peer-reply
      contract that `SKILL.md:189` depends on.
      verify: the run record carries the resolved seating, and a test that
      mutates the config between rounds asserts the frozen seating is the one
      used.
- [ ] **2.3 Reject any model id absent from the tier vocabulary — including the
      host's own recall.** A declared seat resolves through the shipped
      `model_tier` bands; a model id that no tier maps to is rejected at config
      load, and the agent's own memory of a model name is not an admissible
      source. This is the clause that keeps Phase 1's refresh from being undone
      by a plausible-sounding id typed from recall.
      verify: a config naming an id outside the tier map fails closed with a
      message naming the tier map's location, and the failure path is covered by
      a test.
- [ ] **2.4 Seat across families where possible, degrade on one line where
      not.** When the constraint asks for more than one model family and the
      enabled set cannot supply it, emit exactly ONE `tier-degraded` header line
      naming what was asked for and what was seated — never a silent fallback
      and never a wall of warnings.
      verify: a fixture with two families available seats two distinct families
      and emits no header; a fixture with one family available seats it and
      emits exactly one `tier-degraded` line, asserted by count.

## Phase 3 — Absorb the roadmap flavour into a flag

- [ ] **3.1 Build the parity table first.** `/roadmap:ai-council` exists at
      `src/domains/product-basic/roadmap/ai-council/command.md`, whose
      description (`:9`) and pinned-flag section (`:48-55`) state it wraps
      `/council default` with `--input-mode roadmap` and `--depth deep`, and
      whose frontmatter declares `council_depth: deep` at `:11`. Enumerate every
      behaviour it carries and classify each as `absorbed`, `harvested` or
      `sunset`. No row may read `unknown`.
      verify: the table lists one row per behaviour with a classification from
      that closed set, and `grep -c 'unknown' <table-path>` returns 0.
- [ ] **3.2 Add `--rewrite` to the council sub and route the flavour through
      it.** Cardinality is a flag, not a command — the same ruling
      `ADR-239-drain-command-surface-and-merge-authority.md:66-68` applied
      elsewhere ("The estate drain ships as `/roadmap:process-full --all`, not as
      a new `process-all` command"). Carry the roadmap flavour as a flag on the
      existing sub, preserving the pinned depth and input mode.
      verify: invoking the flag reproduces the wrapped invocation's flags
      exactly, asserted against the values read in 3.1.
- [ ] **3.3 Retire the wrapper only after the table is closed.** Remove the
      standalone command and update every inbound reference, gated on 3.1 having
      zero `unknown` rows. A `harvested` row must point at where its behaviour
      landed.
      verify: `./scripts-run src/scripts/check_references` is clean, every
      `harvested` row names a live path, and no `sunset` row names behaviour a
      caller still reaches.

## Blockers

### blocker: b-ladder-order-benchmark-spend

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 2 Step 2.1's ordering semantics and Step 2.4's notion of a
  "better" seat. It does NOT block Phase 1, which refreshes a demonstrably stale
  pin without claiming anything about reviewer quality, and it does not block
  Phase 3.
- **What to do:** pick exactly one —
  (a) re-run the archived adversarial-council benchmark substrate over the
  refreshed pins and record which band actually reviews better, reusing that
  harness rather than building a new one; or
  (b) declare the ordering unproven and constrain Phase 2 to *family diversity
  only*, dropping any claim that a higher band is a better reviewer — in which
  case `tier` keeps its single documented chairman-selection meaning and the new
  field carries mission, never rank.
- **Why it is not an agent step:** (a) spends real vendor calls across several
  members, and (b) narrows a claim this roadmap would otherwise make. Both are
  cost-and-claim decisions.
- **Note on the premise:** the transcript assumed a flagship is the best
  reviewer. Nothing in this tree establishes that. Phase 1 is deliberately built
  so it does not depend on the assumption — a several-generation-old pin is
  stale whether or not the newest band reviews better.
- **Recommendation:** (b). Family diversity is defensible from the tree today;
  a band ordering is not, and the archived substrate would have to be re-run
  before it could be. Taking (b) keeps Phase 2 buildable now and leaves (a)
  available later without having claimed anything in the meantime.
- **If you do nothing:** Phase 1 still lands — it is scoped to depend on no
  ordering claim — and Phase 2 stalls at Step 2.1, because the constraint
  block cannot be specified without knowing whether it ranks seats or only
  spreads them. The stale-pin defect is fixed; the seating work does not start.
- **Resolved when:** either a recorded benchmark result names the band ordering
  with the harness path and date, or Phase 2 carries a written line dropping the
  ordering claim and Step 2.4 is rephrased on family diversity alone.

### blocker: b-provider-model-listing

- **Status:** open
- **Owner:** maintainer, with an external dependency
- **Blocks:** Phase 1 Step 1.2's sentinel-or-pin choice for members whose CLI
  behaviour is unknown here, and Phase 2 Step 2.3's tier-map completeness for
  those providers.
- **What to do:** pick exactly one —
  (a) obtain each provider's current model listing from that provider's own
  surface — its CLI's `--help`/list subcommand or its published listing — and
  record, per provider, whether a "let the CLI choose" sentinel exists and what
  ids the tier map must cover; or
  (b) restrict Phases 1 and 2 to the members whose listings are already known,
  and record an explicit `not-listed: <provider>` line for each of the rest,
  leaving their pins stamped `verified_at` as-of the drain date with no refresh
  claimed.
  A provider whose listing could not be obtained is an honest null for that
  member, never a guess from recall — which is the same failure mode Step 2.3
  rejects at config load.
- **Why it is not an agent step:** model listings live outside this tree and
  change on the provider's schedule; reading them from memory is exactly the
  source Step 2.3 declares inadmissible.
- **Recommendation:** (a) for the two enabled members, (b) for the three that
  ship `enabled: false`. The disabled pins cost nothing today, and stamping
  them `not-listed` is honest and cheap; the enabled pins are the ones a run
  actually uses and are worth one listing lookup each.
- **If you do nothing:** Step 1.2 cannot choose sentinel-or-pin for any member
  whose CLI behaviour is unknown here, so the refresh stops at the one pin
  already proven stale, and Step 2.3's rejection at config load has an
  incomplete tier map — which fails closed on valid ids, the more annoying of
  the two failure directions.
- **Resolved when:** every provider in `members:` carries either a recorded
  listing source with a date, or a `not-listed:` line naming it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The refresh is undone by a model id typed from recall | implementation | A plausible-sounding model id invented rather than read is indistinguishable from a real one at review time, and would re-introduce the exact defect Phase 1 removes | Step 2.3 rejects at config load any id the shipped tier map does not cover, and `b-provider-model-listing` forces every provider to carry a recorded listing source or an explicit `not-listed:` line | Phase 2 — A run may declare what each seat is for |
| 2 | A second capability registry appears beside the tier vocabulary | implementation | Seat selection needs a notion of model capability, and the cheapest local move is a new list of "good reviewer models" — a second source of truth for a fact three shipped schemas already validate | Step 2.3 resolves through `model_tier` only; the Context section names the three schema locations and the tier→model map so a new registry cannot land as an oversight | Context |
| 3 | The diversity constraint silently seats one family | implementation | A constraint that cannot be satisfied is most easily handled by falling back, and a silent fallback makes a single-family run indistinguishable from a spanned one in the artefact | Step 2.4 requires exactly one `tier-degraded` header line, asserted by count in both directions — none when spanned, exactly one when not | Phase 2 — A run may declare what each seat is for |
| 4 | The wrapper is retired before its behaviour is accounted for | implementation | Absorbing a command into a flag loses whatever the wrapper did that the flag does not, and the loss is invisible once the file is gone | Step 3.3 is gated on Step 3.1's table having zero `unknown` rows, with every `harvested` row naming a live destination path | Phase 3 — Absorb the roadmap flavour into a flag |
| 5 | Phase 2 stalls on an unproven premise and Phase 1's value never lands | product | The transcript's ordering assumption is unproven and its benchmark is gated on spend; a roadmap that treats Phases 1-3 as one unit would hold a confirmed stale pin hostage to it | Phase 1 is scoped to spend nothing and to depend on no ordering claim; `b-ladder-order-benchmark-spend` states explicitly that it blocks neither Phase 1 nor Phase 3 | Phase 1 — Refresh the pins, and make the file able to go stale out loud |

## Acceptance Criteria

- [ ] AC-1 — No enabled member in `agents/templates/.ai-council.yml.example`
      carries a hard model pin without a `verified_at` stamp, and an offline
      gate flags a stamp older than its declared cadence with `--today` pinned.
- [ ] AC-2 — A config with no seat-constraint block produces a byte-identical
      member list and a byte-identical rendered artefact against a recorded
      fixture run, so the extension is provably inert when unused.
- [ ] AC-3 — A fixture run with two model families available seats two distinct
      families and emits no degradation header; a fixture with one family
      available emits exactly one `tier-degraded` line, asserted by count.
- [ ] AC-4 — Every model id a config may name resolves through the shipped
      `model_tier` bands, and a config naming an id outside that map fails
      closed with a message that names where the map lives.
- [ ] AC-5 — The `/roadmap:ai-council` parity table classifies every behaviour
      as `absorbed`, `harvested` or `sunset` with zero `unknown` rows, every
      `harvested` row names a live destination path, and the reference checker
      is clean after the wrapper is removed.
- [ ] AC-6 — `b-ladder-order-benchmark-spend` is closed in one of its two
      recorded directions, and no shipped text in this roadmap's output claims a
      capability band reviews better than another without citing the benchmark
      result and its date.
