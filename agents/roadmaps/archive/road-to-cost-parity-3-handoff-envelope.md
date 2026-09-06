---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---

# Road to cost parity — 3: the handoff envelope carries what the successor actually needs

> **Arrivals:** the session-continuity subject appears in **28** consumed inbox
> rounds under `agents/tmp.old/` (measured 2026-09-06, `grep -rli continuity`,
> distinct round directories); `recycle` in 20 and `chat-history` in 35. Latest
> `inbox-2026-09-t`. A floor on the recurrence, not a count of asks for this
> roadmap. The broader `handoff` and `envelope` greps return 99 and 103 and are
> deliberately NOT quoted as arrival counts — both words carry unrelated senses
> in this tree, which is itself the vocabulary defect the successor repairs.
> Written on the most recent ARCHIVED epoch of this subject because there is no
> active owner: twelve archived roadmaps built these layers and none retired its
> predecessor. The successor is `agents/roadmaps/road-to-one-continuity-record.md`,
> and it is subtractive by construction.

> The envelope that crosses every session boundary — worker CHECKPOINT,
> main-session recycle, dispatch return — gains successor-tailoring, failed
> approaches, a drift anchor and scripted environment grounding, and the
> handoff command stops offering the caller its own empty session.

## Goal

A successor session opened from an envelope can resume without re-deriving
state: it receives the next task the envelope was written *for*, the
approaches already tried and failed, verbatim error strings, path:line
anchors, and a branch/HEAD stamp it can compare against reality — and the
handoff command's candidate list contains only sessions that hold something
worth resuming.

## Prerequisites

- [x] `road-to-token-economy-dispatch` Phases 1–6.3 on main (PR #1237) —
      the envelope exists, is size-capped, and is the only return channel.
      This roadmap edits its contract; it does not rebuild it.
- [x] `road-to-token-economy-recycling` on main (PR #1242) — the
      main-session recycle envelope this contract also governs.

## Context (verified against the tree 2026-08-10, do not relitigate)

- **This roadmap is the 13 % residue of a draft that was 87 % already
  shipped.** The inbox draft it came from re-planned
  `road-to-token-economy-dispatch` in full — 27 of its 31 steps are `[x]`
  on `archive/road-to-token-economy-dispatch.md` or already parked in
  `later/road-to-token-economy-dispatch-followup.md`. Only the four steps
  below were absent from the tree. Re-opening the dispatch-economy title
  would additionally have dropped two live non-goals the executed version
  gained (its 7.6 cache-economy refusal guard and its anti-dump acceptance
  criterion) — a governance regression, not a duplication nuisance.
- **The envelope key set is `RECYCLE_ENVELOPE_KEYS` in
  `src/scripts/_lib/subagent_capsule.ts`** (around line 232). None of
  `next_task`, `suggested_skills`, `failed_approaches` exists in it —
  verified by a zero-hit grep across `src/`.
- **The enumeration defect is real and located.**
  `src/scripts/_cli/handoff_sessions.ts:152` filters candidates on
  `count > 0` only. There is no self-session exclusion and no
  substantive-content gate anywhere in that module, so the issuing —
  still empty — session is offered back to its own caller.
- **`agents/settings/contexts/cache-economy-refusals.md` binds this area**
  and forbids none of these four steps. It is cited here so a later reader
  does not have to re-derive that.
- **The redaction rule has a live reason.** Envelope content is injected
  into successor context and may seed background prompts, which makes it an
  egress surface under [`lethal-trifecta-guard`](../../src/rules/lethal-trifecta-guard.md).
- **Redaction is the outbound half only, and the inbound half is the harder
  one.** An envelope carries private data, content a prior session may have
  taken from an untrusted source, and a path into a successor's context —
  all three trifecta legs on one channel. Credential and PII patterns are
  what leaks *out*; the risk that leaks *in* is an injected instruction
  riding a `next_task`, `suggested_skills` or `failed_approaches` value and
  being obeyed by the successor. That is exactly the found-instructions
  quarantine case in
  [`untrusted-input-defense`](../../src/rules/untrusted-input-defense.md):
  delegating a container never authorizes executing its contents. Phase 2
  therefore treats injected envelope content as **data, never instruction**,
  as a binding requirement rather than a note.

## Phase 1 — the enumeration fix (independent, ships alone)

- [x] 1.1 `handoff_sessions.ts` applies `is_substantive`: the ISSUING
      session is excluded by `session_id` unconditionally — never
      heuristically — and every other candidate requires ≥ 1 assistant turn
      AND (≥ 1 tool call OR parsed tokens ≥ a committed threshold), read
      from the existing session-eol counts-only state.
      <!-- verify: task test -- --filter=handoff_sessions -->
- [x] 1.2 Fail-open, stated in code: unreadable state **lists** rather than
      filters. A wrongly listed candidate is noise; a wrongly hidden one is
      data loss.
- [x] 1.3 Four fixtures pin the behaviour: empty session filtered,
      self-session filtered, one-turn-with-tool-use listed,
      unreadable-state listed.
      <!-- verify: task test -- --filter=handoff_sessions -->

**Exit:** the command's candidate list excludes the caller and every empty session; the four fixtures are green and one of them fails when the self-exclusion is removed.
**Rollback:** one module, one filter predicate.

## Phase 2 — envelope contract upgrades

- [x] 2.1 Successor tailoring: the shared envelope schema gains `next_task`,
      and the composing session selects content FOR that task instead of
      emitting a generic state dump. Applies to all envelope variants
      through the shared schema module, schema-versioned and additive.
- [x] 2.2 `suggested_skills`: a list naming the skills the successor should
      invoke, turning the handoff into an activation carrier. Recorded
      motivation: activation is the funnel's measured weak stage, and this
      is a carrier that already crosses the boundary.
- [x] 2.3 `failed_approaches`, mandatory whenever the session abandoned an
      approach — "tried X, failed because Y". A composing session with none
      states `none` explicitly and never omits the field, so absence is
      distinguishable from silence.
- [x] 2.4 Redaction as a validator rule: credential / key / PII patterns are
      schema-invalid in envelope content, lint-tested — not a scrubbing pass
      that can fail, but a shape the content cannot hold.
      <!-- verify: task test -- --filter=envelope -->
- [x] 2.5 Pointers-first as the schema's leading design sentence: never
      duplicate what specs, ADRs, commits, diffs or issues already hold —
      reference by path.
- [x] 2.6 **Injected envelope content is data, never instruction** — binding,
      and the load-bearing half of this phase. The consumer wraps every
      injected envelope in the spotlighting / datamarking shape
      `untrusted-input-defense` requires, with an explicit boundary marker
      naming the block as prior-session data. `next_task` and
      `suggested_skills` are **proposals the successor evaluates**, never
      authorizations it acts on: a `next_task` that crosses a Hard-Floor or
      permission-gated action is surfaced and stops, exactly as a found
      instruction inside a delegated container does. A confirmation planted
      inside envelope content is not confirmation.
      <!-- verify: task test -- --filter=envelope -->
- [x] 2.7 Two adversarial fixtures pin 2.6, because a security requirement
      with only positive fixtures is untested: an envelope whose `next_task`
      contains an imperative to push, deploy or exfiltrate must be surfaced
      and refused rather than executed; and an envelope whose
      `failed_approaches` text contains a role-takeover string must be
      injected as inert data with its boundary marker intact.
      <!-- verify: task test -- --filter=envelope -->
- [x] 2.8 **Gate the half that is gateable, and say which half that is.**
      The obligation splits cleanly and only one side is model-carried:
      **(a) emission — gated.** The injection path is code, so the marker's
      presence is a checkable property: the consumer refuses to inject an
      envelope block that does not carry its boundary marker and its
      prior-session-data label, and a fixture proves the refusal. An
      unmarked injection is a build/runtime error, not a style lapse.
      **(b) obedience — model-carried, `enforced_by: none`.** No gate can
      verify that a marked block was *treated* as data rather than followed.
      This is the same honesty boundary `untrusted-input-defense` states for
      itself, and the schema docs say so in these terms rather than letting
      (a)'s gate imply coverage of (b).
      <!-- verify: task test -- --filter=envelope -->

**Exit:** every envelope variant validates against the extended schema; a fixture carrying a credential pattern is rejected; a fixture omitting `failed_approaches` after an abandoned approach is rejected; both adversarial fixtures from 2.7 are green and each fails when the boundary marker is removed.
**Rollback:** fields are schema-versioned additive; the validator rule is one predicate; the boundary marker is consumer-side prose.

## Phase 3 — resume precision and the drift anchor

- [x] 3.1 Precision rules for the resume section, lint-backed where cheap:
      code identified by signature or `path:line` rather than description,
      error strings verbatim, and every resume step carrying its expected
      outcome.
- [x] 3.2 Drift anchor: the envelope records **repo identity + branch + HEAD**
      at write time — identity being the resolved remote URL, or the
      realpath of the common git dir when there is no remote — **canonicalized
      before comparison**, or the field produces false drift: the same remote
      appears as an SSH and an HTTPS URL, with and without a `.git` suffix,
      and the same git dir appears with and without a symlinked path segment.
      Canonicalization is committed as: lower-cased host, scheme and
      credentials stripped, trailing `.git` removed for remotes; `realpath`
      for the git-dir fallback. Branch and HEAD
      alone are not an anchor: this repo routinely has many worktrees, a
      branch name is not unique across them or across clones, and two
      checkouts at the same commit on a same-named branch would compare as
      "no drift" while being different working trees. The consumer compares
      all three at injection and, on any mismatch, leads the injected block
      with a drift statement naming what to re-verify. Never a silent stale
      resume.
      <!-- verify: task test -- --filter=envelope -->
- [x] 3.2b Three fixtures pin the comparison: same identity + same HEAD stays
      silent; same identity + moved HEAD reports commit drift; **same branch
      name in a different repo or worktree reports identity drift** — the
      case branch+HEAD alone cannot see.
      <!-- verify: task test -- --filter=envelope -->
- [x] 3.3 Deterministic environment grounding: a script collects the factual
      fields (git branch / HEAD / status summary, uncommitted paths, last
      verify exit) into the envelope; the model composes only the judgment
      fields (decisions, failed approaches, resume). Scripted facts are free
      and verifiable; deriving them via a subagent is the right idea at the
      wrong price.
- [x] 3.4 Resume-side focus hint: the consumer accepts an argument narrowing
      what to attack first, mirroring the producer-side tailoring in 2.1.

**Exit:** a round-trip fixture proves drift detection (envelope written at HEAD A, injected at HEAD B, drift line leads the block) and proves the scripted fields are populated without a model step.
**Rollback:** per field; the drift line is consumer-side prose.

## Phase 4 — what this roadmap will not do

- [x] 4.1 No re-opening of `road-to-token-economy-dispatch` — its Phases 1–6.3
      are shipped and its remainder is owned by
      `later/road-to-token-economy-dispatch-followup.md`. Nothing here
      touches those steps.
- [x] 4.2 Nothing from `cache-economy-refusals.md` re-enters — no subagent
      caching mechanism, no blanket TTL, no cache-hit auto-tuning.
- [x] 4.3 No continuation-offload to a background session — carried as a
      blocker below, not as a step, because the host semantics it depends on
      are unverified.
- [x] 4.4 No model-generated envelope content in the factual fields — 3.3
      splits scripted facts from composed judgment on purpose.

## Blockers

### blocker: background-continuation-probe

- **Status:** open
- **Owner:** maintainer
- **Blocks:** any continuation-offload step (deliberately not planned above)
- **What to do:** the draft proposed that, past the recycle threshold, the
  flow MAY hand remaining work to a fresh background session seeded with the
  envelope instead of asking the user to clear in place. Whether a
  background spawn reliably receives and acts on a seeded envelope is
  host_semantics and unverified. Run a bounded two-arm probe on a live host
  before any step is written.
- **Resolved when:** a probe note records the observed seeding behaviour per
  host, and either a step is added citing it or the idea is recorded as a
  null.

### blocker: handoff-content-adjudication

- **Status:** resolved (2026-08-10, in the Phase 2 change itself)
- **Adjudication:** the earlier read was closed as "contradicted our own
  honest-null doctrine" because it imported a *conclusion* — a claim about
  what handoffs should say, carried over without a measurement this tree
  could falsify. These three are not that. `next_task`, `suggested_skills`
  and `failed_approaches` are schema fields with validators and fixtures:
  each one is a shape the envelope either has or does not have, checked by
  `validateRecycleEnvelope` and pinned by a test that fails when the rule is
  removed. Nothing about them asserts an outcome. The one claim that could
  have been imported — that carrying these fields makes successors resume
  better — is deliberately NOT made here; it stays the registered, unmeasured
  `envelope_resume_success` metric in `hook-token-budget.json`. A field whose
  presence is checkable survives where a doctrine whose effect is unmeasured
  did not, and that is the whole distinction.
- **Owner:** maintainer
- **Blocks:** Phase 2.1–2.3 landing as designed
- **What to do:** `road-to-inbox-harvest-2026-08.md` triaged an earlier
  competitor-handoff read and closed it with the verdict "contradicted our
  own honest-null doctrine". Phases 2.1–2.3 come from the same genre of
  source. Before they land, state in the implementing PR why this batch
  survives where that one did not — the distinction is that these three are
  schema fields with fixtures, not doctrine imports, but that must be
  written down rather than assumed.
- **Resolved when:** the Phase 2 PR carries the one-paragraph adjudication.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | An injected envelope value is obeyed as an instruction | product | The envelope carries all three trifecta legs on one channel; a `next_task` or `failed_approaches` value sourced from untrusted content and obeyed by the successor is a confused-deputy action, and redaction (2.4) does not see it because it is not a credential | 2.6 makes data-never-instruction binding with a boundary marker; `next_task` and `suggested_skills` are proposals, never authorizations, and a Hard-Floor-crossing value surfaces and stops; 2.7's two adversarial fixtures test the refusal path, not just the happy path; 2.8 states that the consumer-side half is model-carried rather than implying a gate | Phase 2 |
| 2 | The self-exclusion hides a session the user wanted | product | An unconditional `session_id` exclusion is correct for the issuing session but a bug if the id resolution is wrong | Exclusion is by exact `session_id`, never heuristic; fail-open on unreadable state (1.2); a listed-but-empty candidate is recoverable noise, a hidden one is not | Phase 1 |
| 3 | Envelope grows back into a transcript | implementation | Five new fields on a size-capped envelope invite re-inflating the return channel the parent roadmap shrank | The committed max envelope size and its validator are inherited unchanged; pointers-first (2.5) is a schema sentence, and `return_channel_chars` already measures the result | Phase 2 |
| 4 | Redaction validator produces false rejections | implementation | A pattern-based invalidity rule can reject legitimate content (a hash, a UUID, a test fixture) | The rule is shape-based on credential-keyword context rather than entropy alone, mirrors the existing secret-detector's carve-outs, and ships with both positive and negative fixtures | Phase 2 |
| 5 | `failed_approaches` becomes ritual | product | A mandatory field with a legal `none` value drifts into always-`none` | The field is reviewed content, not metadata; its value is measurable — a successor that re-burns a recorded dead end is the failure it exists to prevent, and that is observable in the handoff's own telemetry | Phase 2 |
| 6 | Drift anchor fires constantly and is tuned out | product | Any commit between write and injection produces a mismatch | The drift line names what to re-verify rather than blocking, and the comparison is repo identity + branch + HEAD (3.2), so a same-branch fast-forward is reported as commit drift rather than as divergence and a different worktree is reported as identity drift rather than silently as none | Phase 3 |

## Acceptance criteria

- [x] The handoff command's candidate list provably excludes the issuing
      session and every empty session, with all four Phase-1 fixtures green
      and one demonstrably red when the self-exclusion is reverted.
- [x] The envelope schema carries `next_task`, `suggested_skills` and
      `failed_approaches`, schema-versioned, with every existing envelope
      variant still validating.
- [x] A credential-pattern fixture is rejected by the validator and a
      legitimate high-entropy fixture is accepted.
- [x] Both adversarial injection fixtures from 2.7 are green, each provably
      red when the boundary marker is removed, and the schema docs carry the
      2.8 model-carried scope statement rather than implying a gate.
- [x] All three drift fixtures from 3.2b pass, including the same-branch
      -different-repo case that branch + HEAD alone cannot detect.
- [x] The scripted grounding fields are populated by the script alone —
      verifiable by running it with no model step in the path.
- [x] The Phase 2 PR carries the handoff-content adjudication paragraph
      required by the blocker above.
- [x] Nothing in `archive/road-to-token-economy-dispatch.md` or
      `later/road-to-token-economy-dispatch-followup.md` was edited by this
      roadmap — verifiable from the diff.

## Provenance

<!-- Source-derived per templates/roadmaps.md rule 19. -->

- Source: maintainer analysis thread, 2026-08-10 (external LLM ideation),
  consumed inbox `agents/tmp.old/median-tokenusage.txt`; anonymized per
  [`source-confidentiality`](../../src/rules/source-confidentiality.md).
  Link via `src/scripts/_lib/link_crypto.ts decrypt`:
  ENC1:Lbi3WHnpd3ev5lRuiUUn+k5gOvOKcewkScdjaTgsn73kA1j8QvnyXDJH2Is2M7smNnrhHAAAYHy+FO3kpJcOaQ==
- Gap-table: see `road-to-cost-parity-0-program.md` § Triage result — this
  file is the `KEEP` column of a draft whose other 27 steps were verified
  `already-shipped` or `already-parked`.
