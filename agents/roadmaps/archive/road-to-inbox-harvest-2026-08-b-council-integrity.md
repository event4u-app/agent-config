---
complexity: lightweight
parent_roadmap: road-to-inbox-harvest-2026-08-b.md
---

# Road to council-pass integrity

> Make a solo-concluded council pass distinguishable from a full-attendance one
> in the machine-readable event log, and make a synthesis verdict checkable
> against its own stance tally — so an attendance claim and a verdict claim both
> have a downstream signal behind them.

> Source (consumed inbox): `agents/tmp.old/subagents-optimization-2.txt` and
> `agents/tmp.old/ac-council-hardening` — part of the 2026-08-10 batch triaged by
> [`road-to-inbox-harvest-2026-08-b.md`](road-to-inbox-harvest-2026-08-b.md).

## Context / What is verified

One inbox file out of twenty-two survived verification intact — eleven of eleven
checkable repo claims held, one exact to the line number. This roadmap is that
file, expanded, plus the one surviving sub-mechanism from the council-hardening
bundle.

**The defect.** `agents/roadmaps/road-to-always-on-orchestration.md:395` (Risk 6)
claimed as its mitigation that *"attendance telemetry makes absent members
visible rather than silent"*, while `src/scripts/ai_council/events_log.ts:30`
carries `EventAction = 'proceed' | 'skip_necessity' | 'block_quota'` and the file
contains **zero** occurrences of `quorum`. That roadmap is `status: ready`
(active), so an active risk register asserted a mitigation the code did not
deliver. A solo-concluded pass is downstream-identical to a full-attendance one.

**What visibility actually exists, and where it stops.** Artifact and manifest
visibility are real: `ai_council/orchestrator.ts:1973,1977` push
`_render_quorum_line` / `_render_absent_members` (defined `:1983`, `:1992`), and
`ai_council/session.ts:109` holds `quorum: QuorumResult | null`, serialised at
`:550`. Nothing reaches the event log. So the honest description of the shipped
state is **artifact-visible only** — which is what the Risk-6 row now says.

**What is already registered, and what is not.**
`road-to-always-on-orchestration.md:273` marks 6.1 `[x]`; its registered list
(dispatch rate per delegable verdict, ladder precision, council fire rate +
unactioned-verdict rate, per-session quota burn, metered-fallback spend) omits
attendance rate, solo-conclusion rate, and absent-reason distribution.

**The insertion point is validated, not free-form.** `appendEvent`
(`events_log.ts:153`) throws when `action` is not in `_VALID_ACTIONS`
(`:32-36`, `:162-166`) — a literal set parallel to the `EventAction` type, so a
new action must land in both. Non-reserved diagnostic fields already pass
through (`:196-200`), so the payload does not need a reserved-field change; the
action does. Byte-parity with the retired port is a stated invariant of the
module (`:18-21`), which is where the `SCHEMA_VERSION` (`:28`) discipline comes
from.

## Phase 1 — Attendance becomes machine-readable

- [x] **1.1 Add a `quorum_result` event.** Extend `EventAction`
      (`ai_council/events_log.ts:30`) **and** `_VALID_ACTIONS` (`:32-36`) — both,
      or `appendEvent` throws at `:162`. Payload: `status`, `threshold`, `total`,
      `present`, `absent[{member, reason}]`; these ride the non-reserved
      pass-through at `:196-200`. Emit at both `evaluateQuorum` call sites —
      `src/scripts/council_cli.ts:668` and `:937` (verified: exactly two; note
      the caller is `src/scripts/council_cli.ts`, **not** a file under
      `ai_council/`). Follow the two shipped `appendEvent` emitters
      (`council_cli.ts:1940`, `ai_council/clients.ts:1274`) — both wrap the call
      in a `try`, which is the fail-open shape. Bump `SCHEMA_VERSION` (`:28`) per
      the module's own byte-parity convention (`:18-21`).
      <!-- verify: task test -- --filter=events_log -->
- [x] **1.2 Use the tree's real absent-reason vocabulary.** The source file drafted
      `(binary_missing, quota, timeout, error)`; three of four tokens are wrong.
      The real set is `AbsentReason = 'no_binary' | 'no_auth' | 'timeout' |
      'quota'` (`ai_council/transport_resolver.ts:65`), plus the runtime fallback
      `'unavailable'` (`council_cli.ts:664`, `:834`) and the literal
      `'binary_missing'` at `council_cli.ts:910`. The event records what the
      caller already computed; it introduces no sixth token.
      <!-- verify: task test -- --filter=transport_resolver -->
- [x] **1.3 Add `isSoloConcluded(q)` as a derived predicate** in
      `ai_council/quorum.ts`, beside `evaluateQuorum` (`:75`). Deliberately **not**
      a third `QuorumStatus`: the two-state enum (`:29`) and `ceil(n/2)` (`:63`)
      stay untouched, because the ceil-vs-floor divergence is a recorded decision
      in that module's own docstring (`:13-19`) — 1-of-2 is called "the deliberate
      choice, not an off-by-one". Advisory derivation only; no gate behaviour
      changes. <!-- verify: task test -- --filter=quorum -->
- [x] **1.4 Render a solo marker** in `ai_council/orchestrator.ts:1983`
      `_render_quorum_line`, consuming 1.3. `:1992 _render_absent_members` and
      `session.ts:109`/`:550` already carry the artifact and manifest halves, so
      this is one line in an existing renderer, not a new surface.
      <!-- verify: task test -- --filter=orchestrator -->
- [x] **1.5 Register the three omitted metrics in a budget JSON, not roadmap
      prose** — attendance rate, solo-conclusion rate, absent-reason
      distribution. The schema and the honest-gap convention both already exist:
      `src/config/hook-token-budget.json` carries
      `definition` / `instrument` / `threshold` plus declared `HONEST GAP` text
      (`:44`, `:53-62`), and `src/config/recycle-threshold-budget.json` carries
      `registered_at` / `owner` / `review_by` / `honest_null_consequence`
      (`:4-6`, `:11`). Registration precedes data; no threshold is committed here.
      Landed as `src/config/quorum-attendance-budget.json`, with a fourth row
      (`roster_shortfall_rate`) two review rounds forced: attendance alone could
      not see a council degraded before the pass, and one ratio over config
      entries vs clients was unbounded under `--siblings`.
- [~] **1.6 Solo-attendance floor.** Deferred behind `blocker: quorum-solo-floor`
      below — the rate cannot be read before 1.1 accumulates it. 1.1–1.5 ship and
      are useful without it.

**Exit conditions — both required.**

1. A solo-concluded pass is distinguishable from a full-attendance one by reading
   `agents/runtime/council/events.log` alone.
2. **No `member_slot` vocabulary is introduced — this constrains 1.1, it does not
   block it.** 1.1 writes **plain member ids**, which is the convention the tree
   already uses: `AbsentMemberRecord.member` is a bare `string` documented as
   "Provider name (or `provider/model` — whatever the caller's roster used)"
   (`ai_council/session.ts:59-66`), carried on `absent_members` at `:103`. What is
   banned is **slot indirection**, not identification. `grep -rn
   'member_slot\|memberSlot\|slot_index' src/scripts/ai_council/` returns **zero**
   today, and `agents/roadmaps/archive/road-to-council-blind-review.md` is `status: ready`
   with open work in Phase 2 (`:145`) and Phase 3 (`:179`); its anonymisation seam
   is `ai_council/orchestrator.ts:1430-1433` and `:1589` (`Response-A` labels for
   the peer-review pass). So 1.1 records `member` as the already-public name the
   absent-list at `council_cli.ts:662-666` already carries, and only a
   slot-numbering scheme waits for that roadmap's seam. A parallel anonymisation
   vocabulary is drift this repo has paid
   for before.

## Phase 2 — A verdict that disagrees with its own tally

- [x] **2.1 Check synthesis prose against the stance tally.**
      `ai_council/prompts.ts:467 assert_synthesis_sections` validates that
      `### Kill criteria` and `### Concrete next step` are present and non-empty
      (`REQUIRED_SYNTHESIS_SECTIONS`, `:456`) — a *shape* check. It does not
      compare the recommendation prose to the counted stances, so a synthesis can
      report agreement over a tally that recorded dissent.
      `ai_council/stance_tally.ts` owns the controlled vocabulary
      (`ABSTAIN_LABEL` `:27`, `abstain_count` `:53`, `needs_repair` `:61`), and
      `tests/scripts/ai_council/synthesis_check.test.ts` is the existing seam —
      extend that function and that test, do not add a script. The analogous check
      already ships on the release surface as `check_finding_dispositions.ts` —
      built for the recorded 9.14.0 failure where the release head read "Security
      and correctness: none" over a critical finding (`:1-28`), i.e. exactly this
      defect class on a different artifact.
      <!-- verify: task test -- --filter=synthesis_check -->

**Exit, as amended by the R2 completion review** (findings 1 and 3,
`agents/evidence/reviews/council-integrity.findings.md`): a synthesis naming
agreement while the tally records dissent is **surfaced in the rendered pass**,
and throws for a caller that holds a finished synthesis and calls
`assert_synthesis_matches_tally` directly.

The original wording — "throws `SynthesisRenderError` on the emit path, the same
way a missing section does" — was wrong twice over, and both corrections are
recorded rather than quietly applied:

- **Throwing on the emit path is the wrong control.** `render()` builds its
  blocks in order, so a throw discards the entire artifact — every member
  response, the peer review, the quorum bookkeeping — *after* every provider
  call is already paid for. The module's own answer for an unverifiable claim
  is the `needs_repair` marker, not a discarded pass.
- **Coverage is narrower than "the emit path" suggests.** The check reads the
  body `render()` holds, which carries a real verdict only on the
  member-chairman path. On the templated default the host agent writes its
  synthesis *after* `render()` returns, where nothing sees it. Closing that
  needs a synthesis-record step, which this roadmap did not build.

**Two premise corrections, recorded because the step rested on both.**

1. **"the same way a missing section does" described nothing.**
   `assert_synthesis_sections` had **zero production call sites** — `grep`
   outside `tests/` returned nothing — while its own docstring claimed it was
   "called on the synthesis-emit path". Worse, it cannot simply be wired:
   with no chairman the rendered body is the literal
   `*to be summarised by the host agent*`, which carries neither section, so an
   unconditional call throws on every templated render (probed:
   `missing the required "### Kill criteria" section`). The docstring's false
   claim is corrected in place; the shape check stays caller-invoked.
2. **The step's own wording contradicted the module it extends.** "compare the
   recommendation **prose** to the counted stances" is the prose inference
   `stance_tally.ts` forbids twice in its own doctrine ("the tally never infers
   a stance from the surrounding prose") and that the named precedent
   `check_finding_dispositions.ts` forbids again ("a comment is mutable and
   unaudited; it is transport, not a record"). Council 2026-08-11, 2/2 on the
   structured reading — the *position* is checked, not the prose.

**What shipped instead.** `VERDICT_LINE_CONTRACT` gives the synthesis the same
machine-readable closing-line duty members already owe via
`STANCE_LINE_CONTRACT`; `parse_verdict_line` reads only that line and returns
`null` — a repair marker, never a guess — when it is absent;
`describe_verdict_mismatch` returns the contradiction as a string and
`assert_synthesis_matches_tally` throws it, when the stated verdict names a
winner the tally did not clear, claims a split it did clear, or names a
different option. The render path uses the returning shape and appends the
mismatch **after** the Vote Tally block, so the artifact survives. Conditional
by construction: an absent verdict line yields null, so the templated default
body and every synthesis written before the contract stay green. The contract's
own `VERDICT: <option-label>` placeholder parses as absent — without that guard
the template path, whose body IS the contract text, would flag every
un-summarised render.

The regex is **case-sensitive**, also per the review (finding 2): it shipped
with `/i` and is line-anchored, so `Verdict: option A is the stronger choice` —
ordinary chairman prose — parsed as a verdict carrying the whole sentence as its
label. That is the prose inference this design exists to avoid, arriving through
the regex rather than through a fallback, and the test written for that case had
used prose with no line-initial marker, testing around the failure instead of at
it.

## Phase 3 — One duplicated defence, honestly scoped

- [x] **3.1 Consolidate the two byte-identical truthy-string guards.** The
      `'false'`-is-a-truthy-string defence is written out twice, byte-for-byte:
      `ai_council/events_log.ts:141-144` and `ai_team/review_gate.ts:172-175` —
      (the first citation read `:129-133`, which is UTF-8 encoding code; the
      guard sits twelve lines further down, and the two blocks share the env
      var `AGENT_CONFIG_NO_EVENTS_LOG` as well as the body) —
      `diff` over the two blocks is empty, and no shared helper exists
      (`ls src/scripts/_lib/ | grep -i 'coerce\|bool'` → nothing). Extract one
      `src/scripts/_lib/` helper and migrate exactly those two call sites. This is
      a **refactor**, not a new capability: no behaviour changes, and the win is
      that the next env kill-switch has somewhere to come from.
      <!-- verify: task test -- --filter=events_log -->

**Scope correction, recorded because the source over-claimed it.** The inbox item
asserted "≥5 sites" of the same defence. Measured: `grep -rn "=== 'false'"
src/scripts/` returns **10** hits, but only the two above share one predicate.
`orchestration_record.ts:91` is a CLI-flag coercion whose invalid-string
fall-through is deliberate and documented (`:85-86`);
`turn_end_gate_hook.ts:562-564` accepts `yes`/`on`;
`validate_frontmatter.ts:236` is a YAML scalar parser. Folding those into one
helper would change three behaviours to remove three lines. They stay.

## Already landed on this branch

- [x] **Risk-6 row corrected** — `road-to-always-on-orchestration.md:395` now
      states absent members are **artifact-visible only**, names
      `_render_quorum_line` / `_render_absent_members` and the `session.ts`
      serialisation, records that `events_log.ts` carries no quorum event, and
      says the row "claims no telemetry mitigation" until Phase 1 lands
      (`e1f271e6b`). Correct either way: if Phase 1 is rejected, the row still
      must not assert a mechanism that does not exist.

## Cancelled against evidence

- [-] **A citation gate against a per-dispatch "shown set", and an isolation
      smoke test.** There is nothing to gate against.
      `ai_council/project_context.ts:1-23` gives members only manifest fields and
      README prose under a stated "Iron law of neutrality", capped at
      `REPO_PURPOSE_MAX_CHARS = 400` (`:23`); no dossier layer and no projection
      manifest exists. Members are separate providers in separate calls, so
      divergence is structural rather than something a test establishes.
- [-] **An `unsourced` verdict flag.** Already shipped under two names:
      `stance_tally.needs_repair` (`:61`, populated `:150-154`, counted in the
      denominator `:176`) and `ABSTAIN_LABEL` (`:27`, special-cased `:182`,
      counted `:212-213`) — and the abstain path is documented as one that
      "raises the bar" (`:231`), not one that penalises.
- [-] **Voice dedupe across chairman candidates.** `ai_council/chairman.ts:51`
      already builds `new Set(candidates.map((c) => c.name))` and rejects a
      chairman not in it.
- [-] **A budget check before the call.** `ai_council/orchestrator.ts:719`
      already calls the imported `would_exceed` (`:27`) against
      `budget.daily_limit_usd` before dispatching.
- [-] **Tolerant quorum / a non-downgradable inconclusive.** Both are the shipped
      decision: `ai_council/quorum.ts:7-8` records that an inconclusive pass
      "HOLDS the gate for a human — it is NEVER silently downgraded to advisory
      (council-verified, 2026-08-09)".
- [-] **Recalibrating the decline criteria.** `ai_council/necessity.ts:9-14`
      already states the calibration doctrine in the intended direction ("False
      positives are preferable to false negatives on the `necessary` side"), and
      `check_detector_corpus.ts:1-24` already gates every detector on all three
      fixture classes including `must-not-fire`.
- [-] **Unicode normalisation before id matching.** No observed failure. A
      mechanism must match an observed failure mode; this one matches a
      hypothetical.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 1 invents a second anonymisation vocabulary | implementation | The obvious implementation adds a `member_slot` field to `events_log.ts`, while `road-to-council-blind-review` still has open work in Phases 2 and 3 and owns the anonymisation seam — producing two vocabularies for one property, in a module whose byte-parity invariant makes a later rename expensive | Stated as exit condition 2 of Phase 1, not a footnote: the seam is named (`orchestrator.ts:1430-1433`, `:1589`), and 1.1 records the already-public member name the absent-list carries or waits for that roadmap | Phase 1 — Attendance becomes machine-readable |
| 2 | Adding an action breaks the events log for existing callers | implementation | `appendEvent` validates `action` against a literal set parallel to the type, and the module holds a byte-parity invariant with a retired port, so a half-edit throws at runtime rather than at compile time | 1.1 names both edit sites (`:30` and `:32-36`) and the throw site (`:162`); the payload rides the documented non-reserved pass-through so no reserved-field change is needed; the verify command is the module's own test file | Phase 1 — Attendance becomes machine-readable |
| 3 | 2.1 turns a taste judgement into a build failure | product | "The prose disagrees with the tally" is a semantic claim, and a check that guesses wrong reds a legitimate synthesis | The comparison is bounded to `stance_tally`'s controlled label vocabulary (`ABSTAIN_LABEL`, `needs_repair`, counted stances) — never free-text sentiment — so the compared values are generator-produced; it extends an existing shape check on an existing test seam rather than adding a scanner | Phase 2 — A verdict that disagrees with its own tally |
| 4 | 1.5 registers metrics that are never read | product | Three registered metrics with no threshold can sit in a budget file indefinitely and become decoration | The two precedent budget files both carry `review_by` and an `honest_null_consequence` clause; 1.5 inherits both, so a metric that produces nothing publishes a null at its review date instead of expiring quietly | Phase 1 — Attendance becomes machine-readable |
| 5 | A cancelled item is re-adopted from the source file | product | Seven items are cancelled because the mechanism already ships, and the source files argue for them persuasively and outlive this roadmap in `tmp.old/` | Every cancellation carries the shipped mechanism's `file:line` inline, so a re-reader meets the code before the argument | Cancelled against evidence |

## Blockers

### blocker: quorum-solo-floor
- **Status:** open
- **Owner:** maintainer
- **Blocks:** 1.6 only. Phases 1.1–1.5, 2 and 3 ship and are useful without it.
- **What to do:** the solo-conclusion rate is a rate over real passes, and no
  event exists yet to accumulate it — which is why this is a blocker and not a
  step. After 1.1 lands, pick between three pre-registered outcomes: (a) add a
  third CLI member — `gemini` is already in `ai_council/cli_hints.ts:40-43` and
  `ai_council/config.ts:78`, and `_lib/environment_detector.ts:138` records it as
  `['gemini', false]` where the boolean is the community-wrapper flag documented
  at `:127-133` (`false` = vendor-official CLI running under the user's own
  subscription), so this option is spend-free on a host that has the binary;
  (b) scope a `min_present: 2` floor to gate-class passes only; or (c) publish a
  null if the rate is under 5 %. Tightening `ceil(n/2)` itself is out of scope —
  `quorum.ts:13-19` records that divergence as a decision.
- **Resolved when:** one of the three outcomes is chosen against real attendance
  data, or 1.6 is cancelled against the published null.

**This ask is its third occurrence.** It was already deferred once as
`blocker: b-quorum-n2` in `agents/roadmaps/archive/road-to-feedback-9-29.md:365-373`,
whose "Resolved when: attendance data exists" is the same unpaid precondition,
and whose "watch council attendance telemetry" presumed the telemetry Phase 1
builds. It is not a new idea; it is an unpaid one — which is the argument for
1.1 rather than for another deferral.

<!-- Deferred items migrated to agents/roadmaps/archive/road-to-inbox-harvest-2026-08-b-council-integrity-followup.md on 2026-08-11 -->
