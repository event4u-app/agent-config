# Inbox harvest 2026-08-c — triage, verification, and the not-adopted register

> **Produced by:** an `analyze:inbox` run over `agents/tmp/` on 2026-08-15,
> against `main` @ `e44e87865` (release 12.0.0, tree identical to the tag).
> **Inputs:** three dropped files, two of them external release reviews.
> **Method:** seven parallel verification agents, one per review pass, each
> required to label every repo claim against the current tree with a
> `file:line` or a command output.

This document exists so the *rejections* survive. Four roadmaps came out of this
harvest; roughly thirty other recommendations did not, and without a written
reason each of them returns in the next review cycle and is re-analysed from
zero. The register at the end is the point of the document.

## 1. Triage table

| file | genre | lines | drafted-against | disposition |
|---|---|---:|---|---|
| `feedback-12.0.0.txt` | external-review, 5 independent passes | 8,643 | current `main` (self-declared, verified: `12.0.0...main` = `0 0`) | **deep-read, 3 roadmaps** |
| `feedback-10.1.0.txt` | external-review, superseded generation | 6,419 | release 10.1.0, 434 commits behind | **spent** — see § 4 |
| `road-to-viral-prompt-intake-hardening.md` | feature-spec / proposal roadmap | 177 | pinned `73ac7b8` (v11.0.0) | **adopt-narrowed, 1 roadmap** |

The provenance line paid for itself twice. The viral-prompt proposal declared its
drafting SHA, so the overtaken-vs-wrong split was mechanical: 57 commits landed
since, `git diff --quiet 73ac7b8..HEAD` over every path it cites returns clean,
and therefore **zero** of its claims could have been overtaken — a hard result,
not an absence. The 12.0.0 review declared that it re-read current `main`, which
`git rev-list --left-right --count 12.0.0...main` → `0 0` confirms.

## 2. What the five passes converged on

Five independent passes over one span is a convergence instrument, and the
agreement is concentrated in four places:

| theme | passes raising it | coverage before this harvest |
|---|---|---|
| release head does not tell the truth about its own span | **5 of 5** | none |
| evidence binding churn / review-evidence growth | 3 of 5 | none |
| workspace + worktree identity is fragmented | 2 of 5 | none |
| one runtime-eligibility resolver over `runtime_requires` + host caps | 3 of 5 | partial |

Everything else appears in one pass only, which is a weaker signal than the
count suggests: the five passes are the same reviewer family reading the same
diff, so a single-pass item is closer to "one reader's preference" than to
"four readers missed it".

## 3. The finding this harvest actually rests on

Every pass raised the release head. Four of them asked for the same remedy —
hard-block a release whose curated head still carries the derived marker — and
**that remedy is a locked decision**: resolved 2026-08-13 on an AI-council 2/2
convergence, recorded in `docs/contracts/CHANGELOG-conventions.md`, with the
rejected branch and two pre-registered falsifiers written down. Re-proposing it
without new evidence is relitigation, and the reviews supply none.

What no pass had was the measurement underneath. The contract's own sentence is
that a contradiction — a `_none_` curated field against a populated derived
category — is *the sole blocking condition*. Measured on this branch, over the
74-commit span `11.0.0..12.0.0`:

- `Security and correctness` derives from `/secur/i` in the conventional scope
  or the whole word `security` in the subject
  (`src/scripts/_lib/release_highlights.ts:116`). Span hits: **0**.
  `fix(...)`-scoped commits in the same span: **13**.
- `Honest nulls` derives from a literal `honest[ -]null` in subject or body
  (`release_highlights.ts:137`). Span hits: **0**, over a span containing a
  commit whose subject records that a soak was waived rather than met.
- Both fields shipped as `_none_` in the released head
  (`CHANGELOG.md:367-368`).

So the label reads *Security **and correctness*** while the classifier only ever
looks for security, and the sole blocking condition is structurally unreachable
for the half of that label the 12.0.0 span was actually full of. This is not the
locked question. The lock chose retro-curation over hard-blocking *on the premise
that the contradiction check still catches the false ones*; a derivation that
cannot populate the category removes the premise rather than the decision.

That is the one item in this harvest with five-way convergence, a measured cause,
a small diff, and no coverage anywhere in 33 active or 42 parked roadmaps.

## 4. `feedback-10.1.0.txt` — spent, with the reasoning kept

Its recommendations resolve into three states and none of them is "live and
lost":

- **Implemented** — the confirmation threat model as executable invariants, the
  routing-metadata consumer audit, completion evidence as a first-class record.
  **Corrected 2026-08-21: the untrusted-content boundary was listed here and does
  not belong.** `src/scripts/_lib/untrusted_content.ts` exists, and every export
  it has (`wrapUntrusted`, `checkCredentialFilePermissions`, `MIN_NONCE_LENGTH`,
  `WrapOptions`, `PermissionVerdict`, `PermissionFinding`) has **zero consumers**
  outside the module and its own test file; there are **zero** occurrences of an
  `<untrusted_content>` tag anywhere in `src/` or `dist/`. The entry also carried
  a count of ingress sites, and that count was never true at any commit this
  triage could have been written against — the number of wired ingress sites was
  and is nought. Measured at HEAD `492873f09` (v14.7.0), six releases after the
  claim was written; re-measure before citing it either way.
  **Whether that module is wired or removed is undecided, and it is the
  maintainer's call — not a documentation pass's.** Wiring it adds live behaviour
  to an untrusted-content boundary, which is a security surface and needs its own
  threat pass first (`security-sensitive-stop`); deleting it is a scope decision
  no correction of the record owns. This sentence exists so the question stays
  open: an honest label on an unwired module removes the pressure to resolve it
  unless the open decision is named beside it.
- **Declined by a recorded decision** — the eight-kind split of
  `runtime_requires` (the schema refuses a speculative vocabulary and ships four
  kinds), the extended executable skill contract, and the release-highlight
  blocking gate.
- **Still open but restated more currently by the newer review** — the runtime
  eligibility resolver, the release head, evidence retention, activation
  integrity, machine-matchable triggers, the live eval runner.

One caveat on the newer review's own scoreboard: its "what was implemented"
table reads as if `runtime_requires` landed complete. The tree says the schema
landed and the resolver did not — `runtime_requires` has exactly one consumer in
the whole tree, `src/scripts/skill_linter.ts`. The review's own § 45 corrects
this, so the table overstates rather than misleads.

## 5. The not-adopted register

Each row is a recommendation that survived at least one pass and was still not
turned into a roadmap. The reason column is the point.

| # | recommendation | why not adopted |
|---|---|---|
| 1 | Hard-block a release head carrying the derived marker | **Locked** 2026-08-13, council 2/2, with pre-registered falsifiers. Needs new evidence, not a re-ask. |
| 2 | Canonical runtime event layer (`session.*`/`turn.*`/`tool.*`/`subagent.*`) | Real gap — no event-normalisation layer exists — but it is a platform, and four of the five passes explicitly ask for *no new subsystems* in the same breath. Re-propose only as a refactor of a concrete duplication that hurt. |
| 3 | Unified `Action{actor,type,target,…}` authorization contract | Same shape as #2 and touches five safety guards at once; a kernel-adjacent rewrite is the worst possible first move in a package whose own reviews ask it to shrink. |
| 4 | Unified runtime eligibility resolver | Genuinely uncovered and named P0 by three passes, but the capped `road-to-skill-ecosystem-*` family already holds its two slots, and the nearest member owns the `harness_compat` half. Fold there when a slot frees rather than opening a parallel track. |
| 5 | R2 merge barrier for risk-classed diffs | Configuring a merge barrier is repo-admin, i.e. a maintainer act, and the predicate ("which diffs are risky") is exactly the judgement the reviews elsewhere warn against mechanising. |
| 6 | `generated:doctor` freshness contract for every generated surface | Attractive, and the 12.0.0 `cli-delegate` staleness fix is one real instance — but the general form is a new subsystem over a class with two members. Revisit at the third instance. |
| 7 | Blocker taxonomy (`decision`/`authorization`/`capability`/…) | The motivating figure ("39 open blockers, 6 solvable") does not re-derive from the roadmap tree: only four `owner: maintainer` occurrences exist. Re-measure before planning. |
| 8 | `bench:doctor` preflight before paid runs | Sound, but it is a helper for a bench that is itself build-blocked; sequencing it first buys nothing. |
| 9 | Split `design_system_import.ts` (987 lines) into six stages | Single-file chore, no defect attached. |
| 10 | Modularise the scale-history bench runner | Its size claim (~1,034 lines) does not reproduce against any tracked file. |
| 11 | Cut releases to smaller commit spans | A cadence preference with no defect behind it. |
| 12 | Clear the two open skill-lint warnings | Two-file chore; belongs in the next patch, not in a plan. |
| 13 | Reduce 200 commands to 40–60 host-visible entries | Public-surface removal — a breaking change needing explicit permission and a deprecation window, and `road-to-surface-consolidation` already owns the axis. |
| 14 | Concern retirement (delete `ui-route-nudge`, `delegation-nudge`, …) | The retirement policy exists but the deletion candidates are exactly the carriers whose effect is *unmeasured*; deleting them now discards the instrument before the reading. Order: measure, then retire. |
| 15 | Never label a council pass `concluded` when answered < configured | Would reverse a council-locked quorum decision (`ceil(n/2)` is deliberate, so one absent member cannot deadlock an n=2 gate). The labelling half already shipped. |
| 16 | Ledger as sole source of truth for session-recycle / orchestration-explain / cost-tracking | Genuine and small, but it is the tail of a roadmap that already owns the ledger; add it there rather than opening a track for three call sites. |
| 17 | Requirements traceability graph (REQ→AC→PLAN→…→EVIDENCE) | A governance layer over a governance layer, in a package whose reviews name roadmap-about-roadmap work as its dominant failure mode. |
| 18 | Write a code-intelligence adapter for a named third-party graph service | The reviewer deprioritises it themselves; the orchestrator-first stance is already recorded, and the service is named in the source rather than here. |
| 19 | Viral-prompt proposal Phase 2 (`evals.json` fixtures) | Rests on a parity claim the tree does not hold: 247 of 289 skills carry no `evals.json`, so "the only one without fixtures" describes an 86 % norm, not a defect. The eval harness is also stubbed, so the fixtures could not execute. |
| 20 | Viral-prompt proposal Phase 4 (full-collection sweep) | Gated on an export from a source that already returned an honest null, and its own pre-registration expects "additional fixtures at most, zero template adoptions". That is a null worth publishing now, not a step worth parking. |

## 6. Safety flags raised during the harvest

- **Source confidentiality.** The viral-prompt proposal names its external source
  by domain, author and handle. It cannot land in the tracked tree in that form;
  the adopted roadmap carries the anonymised shape instead.
- **Quoting floor.** The same proposal reproduces a ~45-word third-party prompt
  verbatim and would have persisted it into a fixture. Not covered by the
  user-owned-text carve-out — it is relayed third-party text.
- **Language gate.** The proposal carries untagged German prose; anything derived
  from it into `agents/` must be English.
- **Consumer-default flip.** Any per-host skill-catalogue budget silently changes
  what every existing install sees. The owning roadmap already carries a
  user-owned blocker for exactly this and must keep "keep everything" as the
  default.
- **Kernel scope.** Rule/skill estate reduction reaches kernel rules in the
  limit; kernel edits are slow-rollout gated and agent-impossible by the write
  guard. Any estate work must exclude the kernel explicitly.

## 7. What this harvest produced

Four roadmaps: `road-to-inbox-harvest-2026-08-c-release-head-truth`,
`-workspace-identity`, `-evidence-lifecycle`, `-prompt-deinflation`. Every other
recommendation is in § 5 with its reason.
