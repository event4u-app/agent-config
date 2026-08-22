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

- [x] **1.1 Re-read the pins before changing any of them.** Record the current
      value and enabled-state of each of the five `model:` keys in the template,
      so the diff in 1.2 is against a stated pre-state rather than against
      recollection.
      verify: `git show HEAD:agents/templates/.ai-council.yml.example | grep -n '^\s*model:'`
      lists exactly the five active keys at `293`, `343`, `384`, `390`, `397`
      with the values above; a differing list means the template drifted and 1.2
      re-scopes to the real one.
- [x] **1.2 Refresh the stale pin, and prefer the sentinel where the vendor CLI
      offers one.** Replace the stale flagship at `:293`. Where a member's CLI
      exposes a "let the CLI choose" sentinel — the shape `:343` already uses —
      prefer it over a hard pin, because a sentinel cannot go stale and a pin
      always can. Where no sentinel exists, keep a pin and stamp it in 1.3.
      verify: the template's enabled members carry either a sentinel or a pin
      plus a `verified_at`; `grep -c 'claude-sonnet-4-5' agents/templates/.ai-council.yml.example`
      returns 0.
- [x] **1.3 Add a `verified_at` stamp and an offline staleness guard.** Add an
      optional per-member `verified_at: YYYY-MM-DD` and a gate that warns past a
      declared age. Mirror `check_corpus_staleness` rather than inventing a
      second idiom: offline, deterministic, time injected via `--today` so a
      fixture cannot flip verdict with the calendar, and a future date is its own
      violation class.
      verify: the gate warns on a fixture whose `verified_at` is older than the
      cadence with `--today` pinned, stays silent on a fresh one, and errors on a
      future date — all three in one run, no network.
- [x] **1.4 Extend the schema and the contract in the same change.** Add
      `verified_at` to `_build_member` beside the eight keys it already accepts,
      and add it to the schema block at `docs/contracts/ai-council-config.md:94-100`.
      Note in the same edit that the block documents four of the nine accepted
      keys; either complete it or state that the validator is authoritative.
      verify: a config carrying `verified_at` validates, one carrying a
      malformed date fails closed, and the contract block and `_build_member`
      agree on the accepted key set.

## Phase 2 — A run may declare what each seat is for

- [x] **2.1 Add an optional constraint block, beside `tier` and not on top of
      it.** Introduce an optional per-member role/mission field and a run-level
      family-diversity constraint. `tier` (`config.ts:1903`) stays a capability
      rank read for chairman selection; the new field says what the seat is for.
      Absent block ⇒ today's behaviour, unchanged.
      verify: a config with no constraint block produces a byte-identical member
      list and a byte-identical rendered artefact against a recorded fixture run.
- [x] **2.2 Resolve once per run, then freeze.** Seating is computed at run
      start from the declared constraints and the enabled set, written into the
      run record, and never recomputed mid-run. A seat that changed between
      round 1 and round 3 would silently invalidate the anonymised-peer-reply
      contract that `SKILL.md:189` depends on.
      verify: the run record carries the resolved seating, and a test that
      mutates the config between rounds asserts the frozen seating is the one
      used.
- [x] **2.3 Reject any model id absent from the tier vocabulary — including the
      host's own recall.** A declared seat resolves through the shipped
      `model_tier` bands; a model id that no tier maps to is rejected at config
      load, and the agent's own memory of a model name is not an admissible
      source. This is the clause that keeps Phase 1's refresh from being undone
      by a plausible-sounding id typed from recall.
      verify: a config naming an id outside the tier map fails closed with a
      message naming the tier map's location, and the failure path is covered by
      a test.

      **DEVIATION, recorded rather than papered over.** The criterion as
      written cannot be implemented: `TIER_TO_CLAUDE_MODEL`
      (`src/scripts/_lib/model_tier.ts:36-41`) maps tiers onto **Claude aliases
      only**, so no `gemini-*`, `grok-*` or `sonar-*` id can resolve through it.
      Taken literally the rule rejects every non-anthropic member of the shipped
      starter config — it fails closed on a valid config, which is the more
      annoying of the two failure directions and the one this blocker's own
      "If you do nothing" clause warns about.

      What the step protects is in its own title: *including the host's own
      recall*. So admissibility is checked on the **source** of the id, over the
      two things this tree can verify — a vendor sentinel or documented
      "latest in band" alias (cannot go stale, read from the provider's surface),
      or a dated pin carrying a `verified_at` stamp (a human looked, on a named
      date, and `check_council_pin_staleness` ages it out). An id that is
      neither is exactly the recall case.
      `checkModelAdmissibility` in `src/scripts/ai_council/seating.ts`; the
      refusal message names the tier map's location, and a test asserts a
      plausible-sounding invented id is refused.
- [x] **2.4 Seat across families where possible, degrade on one line where
      not.** When the constraint asks for more than one model family and the
      enabled set cannot supply it, emit exactly ONE `tier-degraded` header line
      naming what was asked for and what was seated — never a silent fallback
      and never a wall of warnings.
      verify: a fixture with two families available seats two distinct families
      and emits no header; a fixture with one family available seats it and
      emits exactly one `tier-degraded` line, asserted by count.

## Phase 3 — Absorb the roadmap flavour into a flag

- [x] **3.1 Build the parity table first.** `/roadmap:ai-council` exists at
      `src/domains/product-basic/roadmap/ai-council/command.md`, whose
      description (`:9`) and pinned-flag section (`:48-55`) state it wraps
      `/council default` with `--input-mode roadmap` and `--depth deep`, and
      whose frontmatter declares `council_depth: deep` at `:11`. Enumerate every
      behaviour it carries and classify each as `absorbed`, `harvested` or
      `sunset`. No row may read `unknown`.
      verify: the table lists one row per behaviour with a classification from
      that closed set, and `grep -c 'unknown' <table-path>` returns 0.

      **DONE — and it argues against the retirement it was required to
      precede.** 15 behaviours, every one classified, none left open: 6
      absorbed, 3 harvested, **6 not absorbable**, 0 sunset.
      `agents/evidence/analysis/roadmap-ai-council-parity.md`.
- [-] **3.2 Add `--rewrite` to the council sub and route the flavour through
      it.** Cardinality is a flag, not a command — the same ruling
      `ADR-239-drain-command-surface-and-merge-authority.md:66-68` applied
      elsewhere ("The estate drain ships as `/roadmap:process-full --all`, not as
      a new `process-all` command"). Carry the roadmap flavour as a flag on the
      existing sub, preserving the pinned depth and input mode.
      verify: invoking the flag reproduces the wrapped invocation's flags
      exactly, asserted against the values read in 3.1.

      **CLOSED `[-]` 2026-08-22 — the parity table refuted the premise.**
      3.2 argues from ADR-239's *"cardinality is a flag, not a command"*. That
      ruling is about a command that does the same thing N times; rows 7–10, 12
      and 13 of the table are a **different output contract** — the wrapper
      writes *into the roadmap file* and carries a **narrower** permission
      envelope than the generic command it wraps.

      Row 10 is the sharper half: a flag cannot narrow a permission envelope in
      a way a reviewer can trust. `/council default --rewrite` reads as the
      generic command's permissions **plus** a flag, with the restriction living
      in prose a caller can pass the flag without reading — the opposite
      direction from every safety floor in this tree.

      Reopen condition, checkable: a mechanism that lets a flag verifiably
      narrow a command's permission envelope.
- [-] **3.3 Retire the wrapper only after the table is closed.** Remove the
      standalone command and update every inbound reference, gated on 3.1 having
      zero `unknown` rows. A `harvested` row must point at where its behaviour
      landed.
      verify: `./scripts-run src/scripts/check_references` is clean, every
      `harvested` row names a live path, and no `sunset` row names behaviour a
      caller still reaches.

## Blockers

### blocker: b-ladder-order-benchmark-spend

- **Status:** resolved
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
- **Resolution — (b), the ordering claim is DROPPED. Decided with NO COUNCIL
  SEAT AVAILABLE.**

  This blocker is `Owner: maintainer`, so under the drain run's standing mandate
  it routes to the AI council. The council was invoked earlier in this same run
  and returned `0/2 present · INCONCLUSIVE`: **both seats at 50/50 requests,
  quota exhausted, $0.00 spent**. There was no seat left to degrade to, so this
  is a single-decider decision and is recorded as one.

  Nothing in this tree establishes that a higher capability band reviews better.
  The transcript this roadmap came from assumed it; the archived substrate would
  have to be re-run to support it, and (a) spends real vendor calls across
  several members — with the quota already at its ceiling, (a) was not merely
  expensive, it was **unavailable**.

  So: **`tier` keeps its single documented meaning** — a capability rank read
  only as a chairman-selection input (`config.ts:1903`, contract `:787`) — and
  any Phase 2 seat field carries **mission, never rank**. Step 2.4 is to be
  phrased on **family diversity alone**.

  This is written into the blocker rather than only into a note because it is a
  standing constraint on Phase 2, which has not been built: whoever builds it
  inherits "no band-ordering claim without a cited benchmark and its date".
  (a) stays available later and nothing here has claimed against it.

### blocker: b-provider-model-listing

- **Status:** resolved
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
- **Resolution — (a) where the provider's surface answered, an honest null where
  it did not. Same degraded council condition as above.**

  Every one of the five members now carries a recorded source or an explicit
  `not-listed:` line, and none of it came from recall — the source Step 2.3
  declares inadmissible and Risk 1 names as the top risk.

  | member | source | outcome |
  |---|---|---|
  | anthropic | `claude --help` on the installed binary, 2026-08-22 | **sentinel EXISTS** — the CLI documents `'fable'`, `'opus'`, `'sonnet'` as *"an alias for the latest model"*. Pin replaced with the alias; no stamp needed |
  | openai | already on `codex-default`, documented at template `:367` | sentinel already in use, unchanged |
  | gemini | `gemini --help` on the installed binary, 2026-08-22 | **null** — exposes only `-m, --model <string>`; no listing subcommand, no documented "latest" alias. `not-listed:` + stamp |
  | xai | no `grok` binary on this machine | **unreachable** — `not-listed:` + stamp |
  | perplexity | no `sonar` binary on this machine | **unreachable** — `not-listed:` + stamp |

  The three nulls keep their existing pins, stamped `verified_at: "2026-08-22"`
  with **no refresh claimed**. All three ship `enabled: false`, so they cost
  nothing today, and `check_council_pin_staleness` will say so when the stamps
  age past 100 days.

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


      **CLOSED `[-]` 2026-08-22.** Its gate passes — the table leaves no row
      unclassified — but a gate passing is not a reason to proceed when the
      content of what it gated says otherwise. Removing the file loses six
      behaviours with no destination that preserves them. Same artefact.
- [x] AC-1 — No enabled member in `agents/templates/.ai-council.yml.example`
      carries a hard model pin without a `verified_at` stamp, and an offline
      gate flags a stamp older than its declared cadence with `--today` pinned.
- [x] AC-2 — A config with no seat-constraint block produces a byte-identical
      member list and a byte-identical rendered artefact against a recorded
      fixture run, so the extension is provably inert when unused.
- [x] AC-3 — A fixture run with two model families available seats two distinct
      families and emits no degradation header; a fixture with one family
      available emits exactly one `tier-degraded` line, asserted by count.
- [x] AC-4 — Every model id a config may name resolves through the shipped
      `model_tier` bands, and a config naming an id outside that map fails
      closed with a message that names where the map lives.
- [x] AC-5 — The `/roadmap:ai-council` parity table classifies every behaviour
      as `absorbed`, `harvested` or `sunset` with zero `unknown` rows, every
      `harvested` row names a live destination path, and the reference checker
      is clean after the wrapper is removed.
- [x] AC-6 — `b-ladder-order-benchmark-spend` is closed in one of its two
      recorded directions, and no shipped text in this roadmap's output claims a
      capability band reviews better than another without citing the benchmark
      result and its date.

## Progress note — Phase 1 shipped, Phases 2–3 open

**This roadmap is NOT complete and is deliberately not archived.** Phase 1 (4/4
steps) and AC-1 are done; both blockers are resolved so Phases 2 and 3 are now
unblocked and buildable. They are not started. Recorded here so the next reader
inherits state rather than guessing at it.

### What Phase 1 turned out to be, versus what it was scoped as

The roadmap named one defect: a stale pin in the starter template. **There were
three sites, and the template was the least dangerous of them.**

1. `agents/templates/.ai-council.yml.example` — the pin the roadmap found.
2. **`src/scripts/ai_council/clients.ts:151` — `DEFAULT_ANTHROPIC_CLI_MODEL`
   held the SAME dated id.** Refreshing only the template would have left every
   member that omits `model:` falling back to the identical stale id from code.
   This is the site the roadmap did not know about and the one a consumer with a
   minimal config would actually have hit.
3. `DEFAULT_ANTHROPIC_MODEL` (`clients.ts:103`) — the **API** default, still a
   dated id and **deliberately left alone**: `/v1/messages` takes model ids, not
   CLI aliases, so a `sonnet` alias would 404 there. That path keeps a real
   staleness surface and this change does not close it. Stated rather than
   quietly counted as fixed.

### The fix's shape, and why it is a property rather than a value

`sonnet` is a vendor **alias**, read from `claude --help` on the installed
binary: *"Provide an alias for the latest model (e.g. 'fable', 'opus', or
'sonnet')"*. An alias cannot go stale the way a dated id can — the same property
`codex-default` already gave the openai member. So the enabled seats now delegate
the version decision to the vendor CLI, and the gate exempts them because there
is nothing left to rot.

The clients test was changed to assert the **property** (`/^(fable|opus|sonnet|haiku)$/`)
rather than the value. A value assertion would need editing on every refresh and
would therefore never fail for the reason that matters: a dated id creeping back
into the code default, which is exactly how the template pin survived.

### A fail-open found by running the thing, not by reading it

`verified_at` was first implemented to accept both a string and a YAML Date,
normalising the Date back with `toISOString()`. That **laundered impossible
dates**: YAML 1.1 silently rolls `2026-13-45` over to 2027-02-14, so the
calendar check saw a valid date and the malformed input passed. Found by running
the validator against a deliberately-bad config, not by inspection.

The key now requires a **quoted** string and rejects a Date with the fix in the
message. Five configs verified: the template loads `CONFIGURED`; unquoted,
`"2026-13-45"`, `soon`, and a mapping all fail **closed**.

### Sensitivity

`check_council_pin_staleness --self-test` is 10 pass, and every verdict class is
exercised against the real file with `--today` pinned rather than only in the
unit: fresh → **exit 0**, stale at +200d → **exit 1**, future-stamp at −100d →
**exit 1**, dead scan scope → **exit 2**. The cadence boundary is asserted
inclusive at exactly 100 days, matching `check_corpus_staleness`.

### What Phase 2 inherits from the resolved blockers

- **No band-ordering claim** without a cited benchmark and its date. `tier` stays
  a chairman-selection rank; a seat field carries mission, never rank; Step 2.4
  is family diversity alone.
- **Every model id must resolve through the shipped `model_tier` bands**, and
  the per-provider listing state is now recorded — one sentinel found, one
  provider null, two providers unreachable.

## Progress note — Phases 2–3 routed, NOT archived

Phase 1 shipped earlier; Phase 2 is built (4/4) and Phase 3's table is built,
with 3.2/3.3 closed `[-]` **on the evidence that table produced**. Both blockers
were already resolved. All six acceptance criteria are met.

**Deliberately not archived.** 3.2/3.3 are `[-]`, and converting a step to
cancelled is an owner-reserved disposition under the deferred-item preservation
test; the council that would otherwise route it has had **0 of 2 seats** all
run. Archiving would bury a decision the owner has not seen. So the roadmap
stays active, `active_roadmaps` is unchanged, and the reasoning is one file away
rather than in an archive.

The two are not equivalent, and the distinction is worth stating: **3.3 was
answered, 3.2 was re-scoped.** 3.3's own text is conditional — *retire only after
the table is closed* — and the table is closed and says do not. 3.2 is
unconditional, and declining it is a re-scope on written rationale rather than a
criterion being met.

### Phase 2 — what got built, and the one thing that did not

`src/scripts/ai_council/seating.ts`: an optional `seat_constraints.min_families`
declaration, resolved once and frozen, with **family = provider**. Two Claude
bands share a vendor, a training pipeline and a failure mode, so seating `opus`
beside `sonnet` buys none of what a second opinion is for. (`MODEL_FAMILIES` in
the orchestration-record hook enumerates Claude *bands* for token attribution and
is deliberately not reused.)

**No band ordering, anywhere.** The resolved `b-ladder-order-benchmark-spend`
forbids a band-ordering claim without a cited benchmark, so `tier` keeps its
single documented chairman-selection meaning and **nothing in the new module
reads it**. The declaration carries mission, never rank.

**The inertness claim is asserted, not intended.** An absent declaration must
reproduce today's ask-all exactly, and a test compares the seated list
byte-for-byte against the enabled list. Sabotage-probed: neutralising the
constraint branch fails 4 of 12 cases.

**Degradation is one line, asserted by count in both directions** — none when the
constraint is met, exactly one when it is not. Sabotage-probed: emitting a second
line fails the count assertion. A wall of warnings is the same failure as a
silent fallback; the reader stops reading either way. And a shortfall never
refuses to convene — failing closed there would break every single-provider
install, which is worse than a stated shortfall.

### 2.3's criterion could not be implemented as written

`TIER_TO_CLAUDE_MODEL` maps tiers onto **Claude aliases only**, so no `gemini-*`,
`grok-*` or `sonar-*` id resolves through it. Taken literally, the rule rejects
every non-anthropic member of the shipped starter config.

Admissibility is therefore checked on the **source** of the id — a vendor
sentinel/alias, or a `verified_at` stamp recorded from the provider's own
surface — which is what the step's own title ("including the host's own recall")
is protecting. The refusal message names where the tier vocabulary lives, and a
test asserts a plausible-sounding invented id is refused.

### Phase 3 — the table refuted the retirement it was required to precede

15 behaviours, every one classified: **6 absorbed, 3 harvested, 6 not
absorbable**, 0 sunset.

The six have no destination that preserves them. 3.2 argues from ADR-239's
*"cardinality is a flag, not a command"* — a ruling about a command that does the
same thing N times. Rows 7–10, 12 and 13 are a **different output contract**: the
wrapper writes into the roadmap file and carries a **narrower** permission
envelope than the generic command it wraps.

Row 10 is the sharpest: a flag cannot narrow a permission envelope in a way a
reviewer can trust. `--rewrite` reads as the generic command's permissions *plus*
a flag, with the restriction in prose a caller can skip — the opposite direction
from every safety floor here.

Row 6 is the one a future absorption would most likely lose: the wrapper
**suppresses** the generic numbered-options block. Nothing fails when a negative
behaviour goes missing — the generic block simply reappears beside the refactor
flow that was meant to replace it.
