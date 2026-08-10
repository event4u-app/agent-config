---
complexity: lightweight
---

# Road to inbox harvest 2026-08-b

> Twenty-two inbox artifacts triaged against the tree at `c073d5732` (v9.32.0):
> six chat/review transcripts and a sixteen-bundle harvest set dropped
> 2026-08-10. **One file survived verification intact. The set did not.** The
> sixteen bundles share one byte-identical context dossier whose "current
> programme" section is wrong in every load-bearing line, and the item-ID
> namespace they cross-reference exists nowhere in this repo. Net: one small
> roadmap phase, two corrections landed here, eight single-artefact extensions,
> and eleven items cancelled against a named lock.

> Source (consumed inbox): the 2026-08-10 batch under
> [`agents/tmp.old/`](../tmp.old/) — six `*.txt` transcripts plus sixteen
> harvest bundles. Two bundles are external-source parents, referenced below as
> **Source A** and **Source B** per [`source-confidentiality`](../../src/rules/source-confidentiality.md);
> the other fourteen are named by subject.
> Produced by [`/analyze:inbox`](../../src/domains/analysis-workbench/analyze/inbox/command.md).

## Iron Law of this harvest

```
AN INBOX FILE IS A CLAIM, NOT A FACT.
A CITED ARTEFACT THAT DOES NOT EXIST IS NOT A GAP — IT IS A BROKEN PREMISE.
VERIFY THE ROOT BEFORE THE LEAF. NEVER PLAN WORK OFF AN UNADOPTED SIBLING.
```

## What the batch was

| Class | Count | Shape |
|---|---|---|
| Harvest bundles | 16 | `00-source-analysis` + shared dossier + a drafted `20-road-to-*` + a frozen `30-benchmark-preregistration` |
| Release review | 1 | five independent reviews + one scorecard of v9.30.0, ~400 assertions |
| Feature specs | 2 | CI/test economy; an org-level plugin/pack system |
| Prompts / installs | 2 | a third-party handoff prompt; a third-party skill install |
| Verified transcript | 1 | a self-checked quorum-telemetry plan |

The sixteen bundles pre-register **38 benchmarks** (`B-01`…`B-93`). Eight require
live spend; one (`B-131`) proposes disabling a live enforcement gate as a control.
None is authorised here.

## The four findings that prevent the most work

**1. The item-ID namespace is fictional.** Every `RC-*`, `H-AC-*`, `H-HM-*`,
`FM-*`, `TI-*`, `CN-*`, `FS-*`, `ST-*`, `DB-*`, `SK-*`, `PD-*`, `CB-*`, `CL-*`,
`OD-*`, `HC-*` and `B-nn` id resolves to **zero** files outside `agents/tmp/`.
The bundles cite each other: leaves extend roots, and no root was ever adopted.
Every "composes with X" is a claim about a sibling proposal.

**2. The shared dossier is the dominant defect source.** It is byte-identical
across all sixteen bundles (`md5` of `10-project-context.md`: one hash), so each
error propagates sixteen times:

| Dossier claim | Reality |
|---|---|
| Six *active* roadmaps named | **5 of 6 exist nowhere** — and four were themselves inbox drafts triaged 2026-08-10, recorded at `road-to-cost-parity-0-program.md:36-42` as "87 % already shipped", "premise refuted", "central premise false". Cited in 15–17 bundle files each. |
| `ADR-054` = honest-null discipline | `status: **rejected**`; subject is decay-triggered rule re-statement — the applicant the doctrine killed. Both `30-*` pre-registrations register "per ADR-054 discipline" against it. |
| ≤50 rules / ~130 skills | **116 rules / 289 skills**; neither figure appears anywhere in tracked prose. |
| arXiv **2607.21656** | Phantom. Real citation: **arXiv:2404.13076** (`road-to-council-blind-review.md:72`). |
| 12-dimension release matrix as `B-01`'s corpus | "could not be located anywhere" (`archive/road-to-judgment-and-forensic-evidence.md:59`), re-confirmed dropped. |
| ADR-124 code graph "can power reference resolution" | ADR-124:210-225 is a **published null** — recall 0.365 vs grep 0.797, Δ −43.2 pp; `code_graph.enabled: false` permanently. |
| 34.8 % scoped-rule saving | Self-refuted in-tree **the same day**: the figure conflated frontmatter deletion (−81,016 B) with scoping (−64,841 B). Real: **19.2 %** (`agents/evidence/analysis/scoped-rule-absence-preregistration.md:15-30`). |
| ~163k always-loaded | **29,466 / 49,000 chars across 9 rules (60.1 %)** per `check_always_budget` — off by ~10×. |

**3. The batch is additive, and additive is the shape the harvest gate refuses.**
[`ADR-211`](../../docs/decisions/ADR-211-harvest-freeze-resume-conditions.md)
Amendments C and D admit a borrow only when it closes a failure finding that
**pre-dates** the proposal with commit/timestamp provenance, or lands a red test
committed before the borrow. Every bundle item is shaped "the source has X, we
lack X". The 2026-08-03 precedent found **zero** candidates under that bar.

**4. Six hours.** Source A's designated do-first item was the handoff picker
offering the caller its own empty session. It was fixed at **2026-08-10 20:34**
(`b72f772a0`, six fixtures, threshold derived over 217 sessions). The bundle was
prepared at **14:51**.

## Triage result

| Source | Genre | Disposition | Surviving |
|---|---|---|---|
| `subagents-optimization-2.txt` | verified transcript | **roadmap — Phase 1** | 11 of 11 claims held, one exact to the line |
| `feedback-9.30.0-1.txt` | 5 reviews + scorecard | **Phase 2 + folded** | 27 of 44 claims still-true; 2 of 3 consensus P0s were false-premise or already shipped |
| `test-economy.txt` | CI economy spec | **fold — extend, not create** | every figure re-derived accurate; the artefact it proposes already exists, stale |
| `plugin-system.txt` | pack-system spec | **parked behind ADR-011** | 4 real deltas of ~20 proposals |
| `better-handoff.txt` | third-party prompt | **fold (3 fields)** | 13 of 21 repo claims already-fixed or never-true |
| `chief-of-staff.txt` | third-party install | **refused + 2 checkboxes** | install declined; 7 of 11 adopts unfalsifiable by the author's own admission |
| Source A, Source B (parents) | harvest bundles | **fold (4 residues)** | ~2 of 8 and ~1/3 of items, no flagship |
| 14 `ac-*` subject bundles | harvest bundles | **fold or cancel** | ~10–30 % each; six map onto the two parents at finer grain |

## Phase 1 — The quorum-attendance defect

The one file that survived verification intact names a real, self-documenting
defect: an **active** roadmap's risk register asserts a mitigation the code does
not deliver.

`road-to-always-on-orchestration.md:395`, Risk 6, mitigation text: *"…attendance
telemetry makes absent members visible rather than silent"*. Verified against the
tree: `src/scripts/ai_council/events_log.ts:30` carries
`EventAction = 'proceed' | 'skip_necessity' | 'block_quota'` and **zero**
occurrences of `quorum`. A solo-concluded pass is downstream-identical to a
full-attendance one.

- [ ] **1.1 `quorum_result` event.** Extend `events_log.ts` with `status`,
      `threshold`, `total`, `present`, `absent[]`. Emit at both `evaluateQuorum`
      call sites — `src/scripts/council_cli.ts:668` and `:937` (verified: exactly
      two, no third). Follow the two existing `appendEvent` emitters; bump
      `SCHEMA_VERSION` per that module's port-parity convention; fail-open.
      <!-- verify: task test -- --filter=events_log -->
- [ ] **1.2 Use the real absent-reason vocabulary.** The draft writes
      `(binary_missing, quota, timeout, error)`; the tree has
      `AbsentReason = 'no_binary' | 'no_auth' | 'timeout' | 'quota'`
      (`transport_resolver.ts:65`) plus the runtime fallbacks `'unavailable'` and
      the literal `'binary_missing'`. Three of four drafted tokens are wrong.
      <!-- verify: task test -- --filter=transport_resolver -->
- [ ] **1.3 `isSoloConcluded` as a derived predicate** in `quorum.ts` beside
      `evaluateQuorum` — deliberately **not** a third `QuorumStatus`; the two-state
      enum and `ceil(n/2)` stay untouched (the ceil-vs-floor divergence is a
      recorded decision at `quorum.ts:13-15`). Advisory render only; no gate
      behaviour change. <!-- verify: task test -- --filter=quorum -->
- [ ] **1.4 Register the three omitted metrics** — attendance rate,
      solo-conclusion rate, absent-reason distribution — in a **budget JSON**, not
      roadmap prose. `hook-token-budget.json` (definition / instrument / threshold
      / declared honest gap) and `recycle-threshold-budget.json` (`owner`,
      `registered_at`, `review_by`, `honest_null_consequence`) already carry the
      schema and the honest-gap convention.
- [~] **1.5 Solo-attendance floor.** Deferred to the blocker below: the three
      candidate outcomes (a third CLI member · gate-scoped `min_present: 2` · a
      null under 5 %) cannot be chosen before the 1.1 telemetry accumulates.

**Exit:** a solo-concluded council pass is distinguishable from a
full-attendance one in the event log, and the Risk-6 row describes what the code
actually does.

**Sequencing constraint.** 1.1 must **not** invent a `member_slot` vocabulary.
`grep member_slot|memberSlot|slot_index` over `src/scripts/ai_council/` returns
zero, and `road-to-council-blind-review.md` is `status: ready` with Phase 2.145
and all of Phase 3 open — its de-anonymisation seam sits at
`orchestrator.ts:1431,:1591`. Share that seam or sequence after it; a parallel
anonymisation vocabulary is the drift this repo has paid for before.

## Phase 2 — Landed in this PR

- [x] **2.1 Risk-6 row corrected** to what the code delivers —
      *artifact-visible only* (`orchestrator.ts:1983,:1992` do render
      `_render_quorum_line` / `_render_absent_members`, and `session.ts:109`
      serialises the quorum) — with the telemetry claim removed until 1.1 lands.
      Correct either way: if Phase 1 is rejected, the row still must not assert a
      mechanism that does not exist.
- [x] **2.2 Stale harvest-slot line corrected** in
      `road-to-inbox-harvest-2026-08.md:42`. It reads "Both harvest slots
      occupied"; `lint_roadmap_family_cap.ts:41-42` scopes the cap to
      `FAMILY_PREFIX = 'road-to-skill-ecosystem-'` with `CAP = 2`, and the live
      reading is **1 of 2**. Nothing mechanically blocked this batch — and
      nothing mechanically counted it either.

## Phase 3 — Single-artefact extensions

Each item extends one existing file. None warrants a roadmap; none is a new rule
or skill (the estate is at 116 / 289).

- [ ] **3.1 `model_served` vs `model_requested`.** `grep` → **0 hits** tree-wide.
      `ai_council/clients.ts` records the *requested* model at ~10 construction
      sites; the API response's own `model` field is read nowhere. ADR-035 tier
      attribution and `orchestration_record.ts:48-71`'s downshift cost-% both read
      the requested tier, so an alias or provider substitution corrupts both
      silently. Additive schema extension; ADR-035 is not changed, it is made
      honest. <!-- verify: task test -- --filter=clients -->
- [ ] **3.2 Cache-rate table parity gate.** Two independent, un-cross-checked
      tables — `ai_council/pricing.ts:111-119` (multipliers) and
      `cost/track.mjs:42-46` (absolute per-tier USD) — with **different**
      model-matching strategies: exact-key vs substring. Neither package found
      this. A deterministic parity check; note `pricing.ts:113-116` byte-freezes
      the prices row format, so constants are the sanctioned extension point.
      <!-- verify: task test -- --filter=pricing -->
- [ ] **3.3 Release-head placeholder becomes blocking.** `CHANGELOG.md:329`
      (v9.32.0) still carries `_auto-derived, rewrite before merge:_`; v9.31.0's
      head is clean. `check_release_highlights.ts:205` prints it "advisory, not
      blocking". This is legitimately gateable despite *a measurement is not a
      gate*: the placeholder string is emitted by our own generator, so the
      false-positive class is empty. The alternative — rewriting the head comment
      to document retro-curation as the real cadence — is exclusive with this and
      is a maintainer call. <!-- verify: ./scripts-run src/scripts/check_release_highlights -->
- [ ] **3.4 Bind the external research citations.** **20** distinct arXiv ids
      across **47** lines in **32** tracked files; **0** bound to
      `docs/CLAIMS.md`, which carries **0** `https` evidence pointers of any kind.
      The ledger mechanism already exists with four pointer grammars; the gap is
      usage, not format. Ledger entries flow into `docs/proof.md` automatically.
      <!-- verify: ./scripts-run src/scripts/check_claims -->
- [ ] **3.5 Scoped-Bash expressibility.** `subagent.schema.json:46-53` admits only
      the bare token `Bash`, so `Bash(npm run:*)` is inexpressible and the one
      shipped subagent holds a full shell — while `tool-safety` prescribes
      "prefer scoped-grant syntax over bare tool names" and
      `skill.schema.json:218` already carries `disallowed_tools`. A live
      schema-vs-rule contradiction. Enforcement home:
      `lint_skill_frontmatter_safety.ts`; the rule needs no edit.
      <!-- verify: ./scripts-run src/scripts/validate_frontmatter -->
- [ ] **3.6 Enforce the three already-required conditional sections.**
      `skill-writing/SKILL.md:533,556,619` label `Rationalizations-to-reject`,
      `Non-negotiable-deliverable` and `Security-constraints` **required** —
      and `grep` over `src/scripts/*.ts` finds **no enforcement of any of the
      three**. A documented obligation with zero backing, which outranks adding
      checks for sections nothing declares yet. `skill_linter.ts --all` runs in
      0.70 s over 437 artefacts, so the budget is there.
      <!-- verify: ./scripts-run src/scripts/skill_linter --all -->
- [ ] **3.7 Per-skill usage timestamps + archive-not-delete.** No `last_used`
      field exists anywhere. `janitor.ts:1-14` is the never-delete precedent
      (including its "NEVER auto-sweeps `agents/tmp/`" invariant), and
      `profile-staleness` / `wrapper-freshness` are the advisory-hook shape.
      Metadata goes in a **sidecar**, not frontmatter: frontmatter across 405
      artefacts is the diff noise the payload-diet roadmap already contends with,
      and the budget-file precedent is sidecar-shaped.
- [ ] **3.8 Dead CI path filters.** Live `paths:` entries that match nothing:
      `.agent-src.uncondensed/**` (tree removed) in `tests.yml:20-21`,
      `consistency.yml`, `skill-lint.yml:7`, `smoke.yml:17,19`; plus
      `router.json` (`smoke.yml:20`), `templates/**`
      (`smoke-public-install.yml:50`), `src/scripts/install.py` (`:42`). Also a
      stale `heavy-tests` job reference at `tests.yml:237` and a "29 scenarios"
      comment against 30 baselines. The source spec found a subset of this.
      <!-- verify: ./scripts-run src/scripts/lint_workflow_paths -->

## Phase 4 — Cancelled against a lock

Recorded with the lock cited inline, because each source file argues its case
persuasively and will outlive this roadmap in `tmp.old/`.

- [-] **Doctrine recency cue** (per-turn kernel-constraint injection at the
      payload tail). Three independent locks: `ADR-054` is `status: rejected` and
      *is* this proposal; `agents/settings/contexts/reminder-injection-verdict.md`
      records the pilot at **Δ = 0 pp on both hosts**, torn down in the branch
      that built it per a pre-committed threshold; and the premise was searched
      across **1,158 sessions** under a bar registered in its own commit before
      the data was read — **0 of 67** confirmed, at distances up to 240× the
      threshold (`activation-red-baseline.md`). The one carrier that does fire
      per turn on that surface was measured at **24 of 29 misses**
      (`session-canary` § enforcement). The next mechanism must be able to
      **refuse**, not remind.
- [-] **Spawn-env allowlist.** `ADR-123:120` records "env allowlist instead of
      deny-by-family" as an explicitly rejected alternative and `:164` reaffirms
      "deny-by-family stands unchanged". The proposed six-variable set omits the
      `ANTHROPIC_*` variants and config paths the council transport needs.
- [-] **Role-contract budget fields** (`max_iterations`, `anomaly_caps`,
      per-role budget). ADR-109 § 2 bans them by name as "fields that would imply
      runtime we do not have".
- [-] **An eight-role catalog behind a flag.** ADR-109's Gate A governs shipping:
      each unit needs an eval beating both baselines. The one completed eval is an
      honest null. Seven of the eight proposed roles already exist as skills.
- [-] **`role@version` in every dispatch trace** and PreToolUse-enforced
      per-role tool scope. A resolved host probe
      (`archive/road-to-token-economy-dispatch.md:435-455`) established that an
      Agent-tool subagent's env is indistinguishable from the parent's and
      upstream marked it NOT_PLANNED — so the bundle's own declared hard
      precondition is unpassable.
- [-] **Recycling × caching interaction test.** `ai-council-config.md:1042-1044`:
      "Host subagents are unaffected. This key governs ONLY the council's own
      Anthropic API calls." The two share no code path; the flagged blow-up has no
      call site. Caching is also already opt-in, default **off**.
- [-] **Cost-tracking chokepoint doctrine.** This repo does not own the LLM call
      sites it costs — `cost/track.mjs` reconstructs spend from host transcripts
      after the fact — and nothing streams. Both halves are inapplicable.
- [-] **A host-flag compiler and an NDJSON subprocess driver.**
      `subagent_spawn.ts:1-12` is "pure, no-I/O" brief composition; the host
      spawns. No call site exists for either.
- [-] **TTL extension / cache pre-warm.** `'5m'` is a permanent default with a
      published falsification condition; blanket 1h measured **+8.6 % worse**, and
      98 % of cache reuse happens within ~34 s.
- [-] **Pre-commit gate softened to refresh-and-stage.** Weakens a blocking gate
      that enforces `roadmap-progress-sync` Iron Law 3; `engineering-safety-floor`
      lists "disabling tests / quality gates to ship faster" as forbidden, and a
      hook that stages its own generated diff is the tree-mutating-gate trap.
- [-] **A usage-count ship bar** ("fewer than two citing decisions per quarter →
      demote"). ADR-216 strikes adoption as a gate condition outright.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A cancelled item is re-adopted from the source file | product | Eleven items are cancelled against locks, but sixteen bundles argue for them with drafted roadmaps and frozen pre-registrations, and they outlive this file in `tmp.old/` | Every cancellation names the lock and its file:line inline, so a re-reader meets the evidence before the argument; the four dossier-level defects are stated once at the top rather than per item | Phase 4 — Cancelled against a lock |
| 2 | Phase 1 invents a second anonymisation vocabulary | implementation | The obvious implementation adds `member_slot` to `events_log.ts`, while `road-to-council-blind-review` has Phase 3 open and owns the de-anonymisation seam — producing two vocabularies for one property | 1.1 names the seam (`orchestrator.ts:1431,:1591`) and the sequencing constraint is stated as an exit condition, not a footnote | Phase 1 — The quorum-attendance defect |
| 3 | 3.3 flips a gate to blocking and reds an unrelated release | implementation | A blocking release-head check fires on any release whose head was not curated, including one already in flight | The placeholder string is generator-emitted so the false-positive class is empty; the item is scoped to the **final** release head only, and the exclusive alternative is named for the maintainer | Phase 3 — Single-artefact extensions |
| 4 | 3.1 is read as a tier-policy change | product | Recording the served model looks like a licence to re-tier work, when it only makes existing attribution honest | The step states that ADR-035 is unchanged and the extension is additive; the consumer assertion lands in the same change | Phase 3 — Single-artefact extensions |
| 5 | The batch is re-triaged from scratch by a later session | product | Sixteen bundles with plausible drafted roadmaps invite a second full pass costing what this one cost | The four prevention findings are stated as reusable facts (fictional ID namespace, shared-dossier defects, ADR-211 additive shape) rather than per-item verdicts | The four findings that prevent the most work |

## Blockers

### blocker: quorum-solo-floor
- **Status:** open
- **Owner:** maintainer
- **Blocks:** 1.5 only — 1.1–1.4 ship and are useful without it.
- **What to do:** the solo-conclusion rate is a rate over real passes, and no
  quorum event exists yet to accumulate it. After 1.1 lands, pick between three
  pre-registered outcomes: add a third CLI member (`gemini` is already in
  `cli_hints.ts:40-43` and `environment_detector.ts:138` marks it
  **non-metered** — vendor-official CLI under the user's own subscription, so
  this option is spend-free on a host with the binary); scope `min_present: 2`
  to gate-class passes only; or publish a null under 5 %. Tightening `ceil(n/2)`
  itself is out of scope — the ceil-vs-floor divergence is a recorded decision.
- **Resolved when:** one of the three outcomes is chosen against real
  attendance data, or 1.5 is cancelled against the null.

### blocker: release-head-cadence-decision
- **Status:** open
- **Owner:** maintainer
- **Blocks:** 3.3
- **What to do:** two mutually exclusive fixes. Either the final release head may
  never carry the generator's placeholder (flip
  `check_release_highlights.ts:205` to blocking), or the head comment is rewritten
  to document retro-curation as the real cadence and the placeholder is legitimate
  until then. The recurrence is verified — v9.32.0 carries it, v9.31.0 does not —
  so doing neither leaves a known-recurring defect advisory.
- **Resolved when:** one of the two is chosen and the other recorded as rejected.

### blocker: adr-221-acceptance
- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap; recorded because it was the cheapest
  survivor the release review surfaced and it needs no code.
- **What to do:** `ADR-221-host-native-first-ladder.md:3` is `status: proposed`.
  Four of five reviews treat host-native-first as settled doctrine. Accepting or
  rejecting it is an owner decision, not an agent edit.
- **Resolved when:** the status field is `accepted` or `rejected`.

## Explicitly parked

- **The org pack / plugin system** (`plugin-system.txt`). Blocked on
  [`ADR-011`](../../docs/decisions/ADR-011-domain-pack-readiness.md) (accepted):
  the platform ships future domains as in-repo capability bundles, **not**
  separately-installable packs, until at least two independent domains with
  overlapping execution surfaces exist. Three named triggers, none met. The
  spec never mentions it. Most of what it proposes already ships —
  `packs:` frontmatter on all 289 skills, twelve `src/domains/*/pack.yaml`,
  a closed id vocabulary, `packs:active`, scoped projection with `--packs` /
  `--core-only`. Its own non-goal "no override semantics" contradicts the shipped
  `agents/overrides/` layer, which has an `extend` **and** a `replace` mode.
  Unparks only if ADR-011 is reopened. **One real gap is independently
  shippable and does not need the pack system:** there is no uninstall path in
  `install.ts` at all (only a `surgical-uninstall` comment at `:3682`), so
  removal leaves ghost artefacts in every projected host tree.
- **The third-party skill install** (`chief-of-staff.txt`). Downloading and
  installing third-party code into a global skills directory is a safety-floor
  action, and it would be a 290th skill with no retire candidate. Its highest-value
  pattern — staleness metadata on rules and skills — is already contemplated in
  Phase 5.1 of `later/road-to-cost-parity-1-rule-payload-diet.md`, parked
  2026-08-10 by council convergence under a "do not relitigate" header. Taking it
  is a **decision-revisit offer against a same-day lock**, not fresh work. Note
  the lock is not ADR-088: that record scopes to an external multi-agent runtime,
  and citing it here would be a lock invoked out of scope.
- **A `SELF.md` / self-knowledge doc family.** Its governing problem — an agent
  that cannot tell what capabilities it has — was measured across twelve
  instances and closed four phases deep in `road-to-capability-answerability`
  (merged in-window): eleven probe verbs, a per-capability carry-vs-name contract
  with an empirical revisit bar, and per-field provenance so `false` reads as
  "nobody answered". Any future proposal must clear that contract's own revisit
  bar — the same wrong guess observed twice.
- **Programmatic tool calling** (model-authored scripts against a tool RPC). The
  largest novel mechanism in the batch, and the wrong shape here: ADR-123 holds
  behavioural enforcement out of scope, and its gate-equivalence precondition
  presumes PreToolUse guards that bind on three of eight hosts.
- **All 38 pre-registered benchmarks.** Eight need live spend; `B-01`'s corpus
  does not exist; `B-16` pre-registers an interaction against a phantom paper;
  `B-42` needs ignore-data that measured 0 of 67; `B-131` would disable a live
  gate as a control. Any that is ever run re-homes into `docs/CLAIMS.md` with an
  `exec:` pointer, where the exit code is the verdict.
