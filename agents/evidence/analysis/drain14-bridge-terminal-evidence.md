# Drain run 14 — terminal-disposition evidence for the promotion bridge and the topology receiver

> **Evidence only.** This file changes no roadmap, flips no checkbox, resolves no
> blocker and closes no acceptance criterion. It records what is true at commit
> `b50b27281` on branch `drain/bridge-terminal-disposition`, with `file:line`
> provenance for every claim, so a disposition decision rests on measurement
> rather than recall. Where the answer is a null it is written as a null.

**Scope.** Two roadmaps: `agents/roadmaps/road-to-harness-promotion-bridge.md`
(1065 lines, `status: ready`) and
`agents/roadmaps/road-to-council-topology-evidence-followups.md` (175 lines,
`status: draft`).

**Verdict, up front.**

1. **AC-9 is unreachable by design while `blocker: merge-authority` is open.**
   Not "hard", not "unlikely" — mechanically impossible from any branch. The
   mechanism is a two-layer refusal: `acquirePromotionCapability` throws unless
   the blocker's own file reads `Status: resolved` **and**
   `Disposition: granted` (`src/scripts/_lib/promotion_capability.ts:274-282`),
   and `assertTransition(_, 'promoted')` throws without a named human approver
   (`src/scripts/_lib/candidate_record.ts:232-248`). Nothing in the tree is
   promoted, so nothing can enter post-promotion re-evaluation, and
   `promoted -> retired` is the only retirement edge
   (`src/scripts/_lib/candidate_record.ts:210-219`).
2. **The deferral-carry guard is buildable in this run in its narrow form and
   NOT in its full form.** Option 2 of the stub (charge the deletion in
   `classifyDiff`) is a ~2-file change. Option 1 (a standing carry validator) is
   a new CI gate: six registration surfaces per the measured downstream map, and
   — measured here for the first time — it has **two live findings today that
   are both false positives** under the naive rule, which is the "disposition
   vocabulary it does not have" problem made concrete. Option 1 is not
   responsibly shippable in this run.

---

## 1. ADR-239 § Decision 3, verbatim

**File.** `docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md`
— 212 lines.

**Frontmatter (`:1-19`), verbatim on the fields asked for:**

```
adr: 239
status: accepted
date: 2026-08-21
decision: drain-command-surface-and-merge-authority
supersedes: —
superseded_by: —
```

`supersedes` and `superseded_by` are both the em-dash placeholder — the record is
**neither superseding nor superseded**. `status: accepted` (`:3`).

**`review_trigger` (`:10-18`), verbatim:**

> Reopen on any of three observations, none of them a calendar. First — the
> owner resolves the `merge-authority` blocker in either direction, since this
> record's § Decision 3 is written as an open question and a resolved one needs
> a different record. Second — a second command wants `all`-style cardinality,
> since one flag is a decision and two are a pattern that belongs in the
> cluster contract rather than in two command files. Third — an authorization
> store appears anywhere under `src/scripts/hooks/` that an agent can write,
> since § Decision 3's whole argument is that no such store exists.

**§ Decision 3 (`:79-97`), verbatim:**

> **3. Merge authority is not extended here, and the reason is recorded rather
> than the conclusion.** `--merge` and the `/pr:merge` merge step are specified
> and **inert**, gated on an owner decision tracked as the `merge-authority`
> blocker. Three independent reviews reached that verdict and none of them was
> the plan's author:
>
> - The AI council (2 reviewers + chairman, deep, peer-reviewed, 2026-08-21):
>   mergeability-only until authorization is target-bound and tamper-resistant.
> - The committed `road-to-gate-preauth-authorization` stub: `agents/runtime/`
>   is agent-writable, so an authorization read out of it "would let the agent
>   consent on the user's behalf — which is the thing the abort exists to
>   prevent, reimplemented as a feature".
> - The runtime classifier, which refused this roadmap's own attempt to edit
>   "merge is out of scope in every mode" out of the canonical loop.
>
> Lowering a recorded safety floor is owner-reserved
> ([`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md)), and an
> agent that both wants the capability and writes the amendment authorising it is
> the shape the reservation exists for.

**The decision table (`:185-188`), verbatim:**

| Decision | Who made it | Status |
|---|---|---|
| This roadmap will not implement `--merge` | AI council, 2026-08-22 | **settled** |
| Preauthorized merge authority is granted or refused | owner | **open** |

Immediately after it, `:196-198`:

> **Explicit non-rejection.** This disposition does not constitute owner rejection
> of preauthorized merging. It closes the current implementation path pending an
> owner authorization that the autonomous process could not obtain.

**Amendment / supersession status.** No amendment block and no successor. The
only other ADR that mentions ADR-239 is the evidence sweep
(`docs/decisions/adr-evidence-sweep-2026-08.md:179`, `:466`), which records it as
**`REVIEW-NOW` (unread by that sweep)** with *"first adjudication by
**2026-09-26**"* and routing *"council to adjudicate · **owner** for any widening
of merge authority"*. That is an unadjudicated backlog entry, not an amendment.

**`adr_cite_check` output, verbatim:**

```
ADR-239  ·  docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md
  status           accepted   date 2026-08-21
  decision         drain-command-surface-and-merge-authority
  review_trigger   Reopen on any of three observations, none of them a calendar. …
  trigger state    indeterminate
  referenced by    1 other ADR(s): docs/decisions/adr-evidence-sweep-2026-08.md
  provenance       — (no provenance axis)
  evidence         — (ungraded)  ·  discovery —
  authority_basis  — (absent → evidence)
  evidence_basis   — (none recorded)
  reopen_policy    unclassified (absent → default)
  protected dims   — (none declared)
  →  LIVE, TRIGGER INDETERMINATE — the reopen condition is semantic and this tool cannot decide it. Not an unqualified lock: evaluate the condition against the current tree and route the result.
```

**Reading the trigger against the tree, since the tool declines to.** All three
conditions are **unfired**: (1) the owner has not resolved the blocker in either
direction — `agents/roadmaps/road-to-harness-promotion-bridge.md:861` still reads
`- **Status:** open`; (2) no second command has taken `all`-style cardinality;
(3) no authorization store exists under `src/scripts/hooks/`. The record is a
**live lock with an unfired trigger**.

**Honest null on the ADR's evidence axes.** `provenance`, `evidence`,
`discovery`, `authority_basis`, `evidence_basis`, `reopen_policy` and
`protected dims` are all **absent** on this record. `reopen_policy` therefore
defaults to `unclassified`. Under
[`decision-revisit-gate`](../../../src/rules/decision-revisit-gate.md) that
default permits council **investigation** and reversible experiments; it does not
permit **execution** of an owner-reserved transition, and § Decision 3's own text
plus the decision table put the grant/refuse decision on the owner explicitly.

---

## 2. AC-9 reachability — unreachable by design, and the mechanism

**AC-9, at `agents/roadmaps/road-to-harness-promotion-bridge.md:906-908`:**

> - [ ] AC-9 — At least one promoted artefact has been through post-promotion
>       re-evaluation and at least one RETIRE path has been exercised, so the
>       lifecycle is shown to close in both directions.

Two halves. Both were checked from the code, not from the roadmap's own note.

### 2.1 Half (a) — a PROMOTED artefact through post-promotion re-evaluation: **unreachable**

**`src/scripts/evolution_lab.ts` — the `promote` verb returns `EXIT_REFUSED`
unconditionally.** `EXIT_REFUSED = 3` (`:151`). `verbPromote` is `:988-1052`. It
has exactly **three** return paths:

| Line | Return | Condition |
|---|---|---|
| `:992` | `usageError(...)` | `--record` absent |
| `:998` | `fail(...)` | the record file will not load |
| `:1029` | `fail(...)` | an `--evidence` file is present but unreadable |
| **`:1051`** | **`EXIT_REFUSED`** | **every other path — the only terminal return** |

There is no branch that returns success. The refusal is written into the
function's own contract at `:965-986`:

> The promotion verb. It exists, it is named, and it always refuses. …
> There is no flag, no environment variable and no argument that turns this
> into a promotion. `--approver` is deliberately NOT a flag: adding one is what
> would let an unattended run name a human who never approved.

and the header restates it at `:36-41`:

> `promote` exists, is named, is documented — and always refuses with
> {@link EXIT_REFUSED}, naming the blocker.

The refusal message it writes (`:1040-1050`) names both gates:
`lifecycle gate: <assertTransition error>` and
`blocker: merge-authority is OPEN on <roadmap>`.

**The two independent refusals underneath it.**

1. **`assertTransition(record.lifecycle, 'promoted')` is called with NO approval
   argument** (`src/scripts/evolution_lab.ts:1036`). In
   `src/scripts/_lib/candidate_record.ts:232-248`:

   ```
   232:    if (to === 'promoted') {
   233:        assertHumanApproval(approval);
   234:    }
   ...
   237: function assertHumanApproval(approval: HumanApproval | undefined): void {
   238:     if (approval === undefined || approval.approver.trim() === '') {
   239:         throw new LifecycleTransitionError(
   ...
   242:             'promotion into canonical agent-config requires a NAMED human approver. '
   ```

2. **`acquirePromotionCapability` is unobtainable while the blocker is open**
   (`src/scripts/_lib/promotion_capability.ts:270-291`):

   ```
   274:    const status = readMergeAuthorityStatus(repoRoot);
   275:    if (isRefusingStatus(status)) {
   276:        throw new PromotionCapabilityUnobtainableError(
   ...
   278:            'promotion into canonical agent-config is gated on the owner-reserved blocker '
   279:                + '(ADR-239 Decision 3), which does not read as GRANTED. No flag, environment '
   280:                + 'variable or argument lifts it.',
   ```

   Its contract at `:260-264` states the read: *"now means BOTH `Status:
   resolved` AND `Disposition: granted`. While it reads anything else — including
   "the roadmap is missing", "the blocker was closed as refused" and "the blocker
   was closed without saying which" — the capability is unobtainable."*

   And `src/scripts/lint_promotion_paths.ts:619-629` proves this tree-wide by
   **calling** `acquirePromotionCapability` and failing if it returns a token
   while the blocker reads open.

**Therefore no artefact in this tree can hold `lifecycle: 'promoted'`**, and half
(a) has no subject.

### 2.2 Half (b) — an exercised RETIRE path on a PROMOTED artefact: **built, and it does not reach a promoted artefact**

`src/scripts/_lib/promotion_review.ts` (294 lines) is the machinery 7.6 built:

- `POST_PROMOTION_VERDICTS = ['KEEP', 'REVISE', 'MERGE', 'SPLIT', 'RETIRE']` (`:71`).
- `reviewTriggerFor` (`:145`) — five triggers, `regression` first.
- `reviewPromoted` (`:160`) — one verdict per trigger; `RETIRE` at `:175` and `:182`.
- `retirePromoted` (`:202`) — executes the verdict.
- `NotPromotedError` (`:107-111`) — *"PROMOTED artefact. A candidate that never
  landed is rejected, not retired"*.

Its own header is explicit about the boundary (`:41-44`):

> It reads promoted artefacts and it can RETIRE one — the only transition it
> expresses is `promoted -> retired` … There is no path here that moves anything
> INTO `promoted`; that stays behind [the capability].

**The RETIRE path IS exercised — in a fixture.**
`tests/scripts/promotion_review.test.ts:115-125`, *"runs review -> RETIRE -> the
lifecycle transition, end to end"*, over `promoted({ invocations: 0 })` where
`promoted()` (`:33-38`) is a **synthetic state object literal** with
`lifecycle: ACCEPTED_STATE`. It is not an artefact that was promoted; it is a
struct constructed to hold that value.

**The curator's RETIRE is a different RETIRE.**
`tests/scripts/curator_ops.test.ts:63-67` tests `RETIRE` arity only
(`validateOp(proposal({ op: 'RETIRE', targets: ['a'], produces: [] }))`), and
`src/scripts/_lib/curator_ops.ts:120-124` types every screened proposal's
lifecycle as the **literal** `'candidate'`:

```
120: export interface ScreenedProposal {
121:     proposal: CuratorProposal;
122:     /** Literal. There is no other value this field can hold. */
123:     lifecycle: 'candidate';
124: }
```

So the curator's RETIRE retires a **candidate**. And a candidate cannot take the
retirement edge at all — `src/scripts/_lib/candidate_record.ts:210-218` makes
`promoted` the only legal `from` for `to === 'retired'`, which
`tests/scripts/promotion_review.test.ts:127-133` pins directly.

### 2.3 Stated plainly

**AC-9 is unreachable-by-design while `merge-authority` is open.** The mechanism
is not a missing feature or an unwritten test — it is a pair of deliberate,
tested refusals whose stated purpose is to make promotion impossible until an
owner acts: `acquirePromotionCapability`
(`src/scripts/_lib/promotion_capability.ts:274-282`) and `assertHumanApproval`
(`src/scripts/_lib/candidate_record.ts:237-248`), with
`src/scripts/lint_promotion_paths.ts:609,619-629` enforcing tree-wide that no
other path promotes either.

Closing AC-9 requires three acts, **none performable from any branch**: an owner
settles ADR-239 § Decision 3 as *granted*; a named human promotes one artefact
through the capability; that artefact reaches a review trigger and a verdict is
recorded. The roadmap's own audit reaches the same conclusion at `:948-952`, and
this pass verified it against the code rather than adopting it.

**No honest disposition of this roadmap can close AC-9.** It can be left `[ ]`,
or it can be **descoped** — carried to a receiver — and § 4 below prices that.

---

## 3. The seven PROVISIONAL Phase 7 marks

### 3.1 The gate header carrying the 1C ruling

`agents/roadmaps/road-to-harness-promotion-bridge.md`. Phase heading at `:390`.
The gate header runs `:392-459`. The 1C ruling is `:430-459`, verbatim:

> **ADJUDICATED 2026-09-01 — the owner call is CONFIRMED as an owner call, so
> the seven marks are PROVISIONAL. They are not upgraded and they are not
> reverted.**
>
> *AI council 2026-09-01 (anthropic/claude-sonnet-4-5 + openai/codex-default,
> 2 rounds, blind chairman, quorum concluded 2/2) — Decision 1: **1C —
> OWNER-RESERVED**, 2/2 convergent.*
>
> The question put was whether closing a Phase 7 step under an open
> `merge-authority` blocker is (1A) legitimate because the blocker gates
> promotion and no promotion occurred, (1B) illegitimate because the blocker's
> `Blocks:` field reaches the steps themselves, or (1C) an owner call no council
> may make. **Both seats answered 1C, and both named the same reason:** this
> gate header expressly assigns the interpretation to the owner, so answering
> 1A or 1B would convert a live reservation into a settlement. openai: *"Choosing
> 1A or 1B here would override that reservation. The `[x]` marks may remain
> flagged and provisional; they are not unqualified closure."*
>
> Both seats also recorded that **1B is credible**, not a strawman. openai named
> it the strongest counter-argument: *"the blocker's literal statement that it
> blocks 'every promotion step in Phase 7' … supports reverting all seven
> marks."* anthropic showed why the text cannot settle it: *"by consequence"*
> reads as a causal chain, which **explains** the ambiguity and does not resolve
> it — *"it shows why 'promotion step' can legitimately mean either 'the step
> itself' or 'promotions performed by the step.'"*
>
> **So the operative status of every `[x]` in this phase is: closed on tested
> refusing mechanism, PROVISIONAL pending an owner scope ruling, revertible to
> `[ ]` at that ruling with the work standing unchanged underneath.** Risk 6 of
> the register carries the misreading risk this creates.

The earlier `:400-401` STATUS block and the `:420-428` owner-reserved reading are
the antecedent this ruling confirms. The `Blocks:` field the question turns on is
at `:861-862`: *"Phase 0 step 0.8, and by consequence every promotion step in
Phase 7."* Risk 6 is at `:895`.

### 3.2 The seven `[x]` marks — CURRENT line numbers

The roadmap text cites `:342, :365, :387, :409, :445, :463, :493`. **Those are
stale.** Measured at this commit:

| Step | Cited in text | **Actual now** | Δ |
|---|---:|---:|---:|
| 7.1 One evidence package per promotion | 342 | **461** | +119 |
| 7.2 Route through the existing gate | 365 | **484** | +119 |
| 7.3 Promote by scope, with a transfer gate | 387 | **506** | +119 |
| 7.4 Reject semantic no-ops | 409 | **528** | +119 |
| 7.5 Roll out by canary, never silently | 445 | **564** | +119 |
| 7.6 A promoted artefact is not immortal | 463 | **582** | +119 |
| 7.7 Best-known-state reference on regression | 493 | **612** | +119 |

Uniform +119, consistent with the 1C block (`:430-459`, 30 lines) and the
2026-09-01 dispositions inserted above Phase 7 rather than any reordering. The
stale citations appear at `:917-919` inside AC-9's own TENSE-CORRECTED note; they
are a **provenance defect in the roadmap text**, not a movement of the work.

The only other checkboxes in the file: `:336` (`[~]` step 0.8) and `:906`
(`[ ]` AC-9). Nine items total, which is the `7/9` the dashboard reports.

### 3.3 Step 0.8

`:336`, verbatim:

```
- [~] **0.8 Merge authority resolved.** Deferred: owner decision, see Blockers. <!-- blocked-by: merge-authority -->
```

Carrying two written dispositions: `:348` (*"WRITTEN DISPOSITION 2026-09-01 — 0.8
STAYS `[~]`. It is not closeable…"*) and `:371` (*"RE-CONFIRMED 2026-09-01 (drain
run 13) — 0.8 STAYS `[~]`"*). Note the `<!-- blocked-by: -->` sits **on the
checkbox line**, deliberately: `:342-344` records that it previously sat on a
continuation line where `lint_roadmap_blockers`' `BLOCKED_BY_LINE_RE` could not
see it.

---

## 4. What a descope-into-stub would take

### 4.1 The stub format this repo requires

Source: `agents/roadmaps/stubs/README.md`. Frontmatter contract:

| Field | Required | Meaning |
|---|---|---|
| `complexity:` | yes | the key `lint_roadmap_complexity` expects |
| `review_by:` | **yes** | ISO date; the day the file is next read. Surfaced by `agent-config stubs:due` |
| `reviewed_at:` | no | ISO date; last substantive read. Absent = never re-read since creation |
| `probe:` | only if the body names none | the literal `probe: none` |

Cadence: **30 days** for a drain-run transfer (capability-gated), **120 days**
for an org-mode stub (demand-gated) — the README states 120 in one table and 180
in a second (§ "What the date means, per class"); that internal inconsistency is
in the README as written and is noted rather than resolved here.

Body contract, from § "What every stub carries": the original criterion
**verbatim**, the complete list of dependent steps moved, and **a named producer
with a detection probe** (never "when some subsystem exists"), plus the probe's
measured baseline on the transfer date.

**Classification of a 0.8 / AC-9 descope.** It is a **drain-run transfer**, not
an org-mode stub: the scope decision is made, the work is wanted, and the missing
thing is a capability — an owner ruling — that the run does not have. The shared
promotion criteria (recruited customer, funded audit, ADR sign-off) explicitly do
**not** govern it; the README states this as an Iron Law. Its probe is already
written and mechanical: *does `blocker: merge-authority` read `Status: resolved`
AND `Disposition: granted`* — the exact predicate
`readMergeAuthorityStatus` / `isRefusingStatus` already implement
(`src/scripts/_lib/promotion_capability.ts:260-264, 274`).

`review_by:` would be **2026-10-01** (creation + 30d).

**The forbidden shape:** no inventory table may be added to
`agents/roadmaps/stubs/README.md`. `check_no_stub_inventory_table` fails the
build on one, and the README records that a merge restored a deleted table once
already.

### 4.2 Which gates run over roadmaps, and what each enforces

**Scope, established first, because it decides most of the answer.**
`lint_roadmap_blockers` (`:35`) and `lint_roadmap_complexity` (`:49`) both glob
the **non-recursive** `agents/roadmaps/*.md`. `check_roadmap_trackable:60` and
`update_roadmap_progress.ts:95` carry an explicit
`EXCLUDE_DIRS = {archive, skipped, stubs, later}`. So **a file under
`agents/roadmaps/stubs/` is outside every roadmap gate** — by glob shape for two
of them and by exclusion list for the others. `lint_empty_roadmaps` is the
exception: its header (`:12`) says it walks *"`agents/roadmaps/` (active,
`archive/`, `skipped/`, `stubs/`, `later/`)"*, i.e. it **does** see stubs, and it
enforces only non-emptiness.

Taskfile registration (`Taskfile.yml`): `lint-roadmap-complexity` (`:174`),
`lint-roadmap-ci-steps` (`:175`), `lint-empty-roadmaps` (`:176`),
`lint-roadmap-blockers` (`:178`), `lint-roadmap-later-disposition` (`:179`),
`lint-roadmap-family-cap` (`:180`), `check-estate-count` (`:213`),
`check-no-roadmap-refs` (`:283`), `check-roadmap-trackable` (`:379`).

**On a `[~]` item.** No gate in the roadmap set validates a `[~]` carry. The
`[~]` cross-reference rule in `lint_roadmap_blockers` matches only a real
`- [ ]`-shaped checkbox line carrying `<!-- blocked-by: -->`
(`BLOCKED_BY_LINE_RE`, cited by the roadmap itself at `:342-344`); it links a
step to a **blocker**, not to a receiver. The only reader of
`deferred-resolution: carried-to=` anywhere in `src/` is
`archive_completed_roadmaps.ts`; the single other occurrence
(`src/scripts/lint_roadmap_complexity.ts:259`) is a warning **string**, not a
validator. This was re-verified this pass and matches § 3.1 of
[`topology-followups-disposition-evidence-2026-09-01.md`](topology-followups-disposition-evidence-2026-09-01.md).

**On an unmet AC.** Every `- [ ]` line counts as an open step:
`CHECKBOX_RE = /^[ \t\n\r\f\v]*[-*][ \t\n\r\f\v]+\[([ xX~\-])\][ \t\n\r\f\v]/gm`
(`src/agent-src/scripts/update_roadmap_progress.ts:81`) is **unscoped** — it does
not restrict to `## Phase` sections, so an acceptance criterion is counted
exactly like a step. That is why the bridge reads 7/9 and not 7/7. **Consequence:
AC-9 alone keeps `stats.open_ !== 0`, and `archive_completed_roadmaps.ts:562`
therefore `continue`s past the roadmap before any other check runs.**

**On a stub.** Nothing, per the scope paragraph above.


**Per-gate detail, verified script by script.**

| Gate | Scope | What it enforces | On a `[~]` | On `stubs/` | On an unmet AC |
|---|---|---|---|---|---|
| `lint_roadmap_blockers` | `agents/roadmaps/*.md`, non-recursive (`:35`, `_globRoadmaps` `:266-281`) | 5 required fields per `### blocker:` (`:47-53`, fail `:184-190`); optional `Class:` 0-3 (`:204-211`); every `<!-- blocked-by: -->` on a checkbox line resolves to a same-file entry (`:45`, `:251-258`); ratcheted decidability count (`:367-371`) | the blocked-by regex `:45` accepts `~` in its checkbox class — that is the **only** interaction. Requires nothing, never reads `carried-to=` | counted for the dead-scope assertion (`_countRoadmapTree` `:295-311`), **never linted** | nothing |
| `lint_roadmap_complexity` | `agents/roadmaps/*.md`, non-recursive (`:49`, `:687-702`) | `complexity:` required (`:199-212`); lightweight caps 600 lines / 6 phases (`:50-51`, `:153-179`); placeholder scan (`:220`); `execution.mode` + `relates:` validation (`:224-225`) | **warning only**, and only under `execution.mode: autonomous` (`:255-262`). `- [~]` is absent from `_lib/roadmap_granularity.ts:54` `TASK_PREFIXES`, so deferred bullets are exempt from the placeholder scan entirely | `ledger.outOfScope(rel, 'excluded_directory')` (`:605-609`) | nothing — `:388-390` explicitly skips checkboxes inside acceptance blocks |
| `lint_roadmap_ci_steps` | `agents/roadmaps/*.md`, non-recursive (`:30`, `:156-171`) | **self-disabling**: returns 0 unless `.agent-settings.yml` `quality.local_auto_run` is explicitly `false` (`:204-211`; default `true` ⇒ no-op). When armed, forbids full-pipeline literals (`:42-57`) on checkbox lines / in fences (`:138-141`) | `CHECKBOX_PAT` `:59` includes `~`, so it is scanned like any other line. No carry logic | counted only (`:185-201`) | **skipped by design** — `## Acceptance criteria` sections excluded (`:62`, `:135-137`) |
| `check_roadmap_trackable` | recursive minus `EXCLUDE_DIRS` (`:60`) | ≥1 `## Phase` per non-draft file (`:47-48`, fail `:197-204`); ≥1 checkbox per phase slice (`:207-222`); ratcheted `relates:` presence (`:287-305`) | `[~]` **satisfies** the per-phase checkbox requirement (`CHECKBOX_RE` `:42`, message `:217-219`) | `stubs` is in `EXCLUDE_DIRS` at `:60`, applied per path component `:104-107` — **never judged** | nothing — an unchecked `- [ ] AC-1` is indistinguishable from a step and in fact **helps** the file pass |
| `check_no_roadmap_refs` | reads **stable artefacts**, never roadmaps (`STABLE_TREES` `:44-54`, `STABLE_FILES` `:57-65`) | forbids a stable artefact from citing any `agents/roadmaps/**.md` (`:72-73`), 2-file allowlist (`:78-81`) | nothing | **the one gate that treats a stub as first-class** — the regex `:72-73` matches at any depth, so citing `agents/roadmaps/stubs/road-to-x.md` from a rule or skill **is a violation** | nothing |
| `lint_empty_roadmaps` | **recursive over the whole tree incl. `stubs/`** (`:12`, `_rglobMdSorted` `:64-85`, called `:103`) | one rule: a `.md` that is whitespace-only (`:91`, `:111`) is a violation | nothing — a file with a single `- [~]` line passes | **scanned** — the only one of the seven applying a real rule to stubs recursively | nothing |
| `lint_roadmap_later_disposition` | recursive, unfiltered by directory (`:155`); excludes 4 filenames + `open-questions*` (`:71-77`) | Rule A: `status: later` outside `later/` is a violation (`:167-176`). Rule B: a file under `later/` with `status != later` needs a `RESUME_RE` line (`:68`, `:179-191`) | nothing — never reads checkboxes | **walked, Rule A applies.** Inert in practice: no stub declares `status: later`. Rule B is `later/`-only (`_underLater` `:145-148`) | nothing |

**Three facts about where these actually run.**

1. **Six of the seven are local-only.** `taskfiles/ci-fast.yml:1329, 987, 992, 1883, 1051, 1344` and `taskfiles/content.yml:305` register them under `Taskfile.yml`'s `ci:` list, and **no workflow invokes `task ci` or `task ci-strict`** (stated in-tree at `.github/workflows/rule-backstops.yml:6`).
2. **`lint_roadmap_ci_steps` is the only one in a workflow** —
   `.github/workflows/rule-backstops.yml:594-595`, *"Roadmaps schedule no
   full-pipeline CI steps"* — and it is the one that **disables itself** unless
   `quality.local_auto_run: false`.
3. **`archive_completed_roadmaps.ts` is in NO Taskfile and NO workflow.** A grep
   over `Taskfile.yml`, `taskfiles/` and `.github/workflows/` returns nothing. It
   is **command-invoked**: `/create-pr § 1c` (`src/rules/roadmap-progress-sync.md:139`),
   the `agent-config` dispatcher (`src/scripts/_dispatch.bash:781`),
   `src/agent-src/scripts/archival_sweep.ts:79`, and the MCP tool at
   `src/scripts/mcp_server/tools.ts:705`.

```
THE ONLY ENFORCER OF A `[~]` CARRY IS THE ONE SCRIPT NO CI JOB RUNS.
THE SEVEN GATES THAT DO RUN LET A `[~]` WITH NO RECEIVER — OR ONE POINTING
AT `stubs/` — PASS IN SILENCE.
```

**And no gate anywhere reads an unmet AC as unmet.** None of the seven greps
`AC-`. The only AC-aware script in the tree declares itself a non-gate:
`src/scripts/check_requirements_trace.ts:256` — *"a dangling [AC:] annotation
still exits 0 — this is a listing, not a gate"*. An unmet AC has exactly one
mechanical consequence in this repository: it keeps `stats.open_` above zero and
so keeps `archive_completed_roadmaps` from archiving the file (`:562`).
### 4.3 Would `archive_completed_roadmaps.ts` accept a descoped roadmap?

`archive_completed` is `src/agent-src/scripts/archive_completed_roadmaps.ts:511`.

**It is command-invoked, not a CI gate** — no Taskfile task and no workflow runs
it (§ 4.2 fact 3). It fires from `/create-pr § 1c`, the `agent-config`
dispatcher, `archival_sweep.ts:79` and the MCP tool. So "would it accept the
roadmap" is a question about what happens when a human or a command runs the
sweep, not about what CI would say.

Its gate order, per roadmap, is:

| Order | Check | Line | Effect on a descoped bridge |
|---:|---|---|---|
| 1 | guarded-baseline steps present | `:548-561` | none (file carries none) |
| 2 | `stats.open_ !== 0` → skip | `:562-563` | **passes only if AC-9 is no longer `[ ]`** |
| 3 | `stats.deferred !== 0` → `deferralProblems` | `:568-581` | **fires** — 0.8 is `[~]` |
| 4 | `open_blockers.length > 0` → skip | `:590-599` | **BLOCKS** — `merge-authority` is open |

**Gate 4 is terminal and unavoidable.** `:591-598` refuses to archive any roadmap
with an open blocker, with the rationale at `:583-589`: *"An unresolved blocker
outlives its steps… a roadmap carrying an open decision stays visible until the
decision is made."*

**So the answer is NO, and it does not depend on AC-9 at all.** Descoping AC-9
into a stub removes obstacle 2; obstacle 4 remains, because the
`merge-authority` blocker lives in this file (`:637`, `Status: open` at `:861`).
Archiving the bridge requires **moving the blocker as well as the two items** —
i.e. the receiver must inherit the blocker entry, and the receiver must then be a
roadmap (blockers are parsed from `## Blockers` in the active glob), not a stub.
A stub cannot hold the blocker without taking it out of `open_blockers` entirely,
which is a silent drop.

**What `deferralProblems` requires of the receiver**
(`src/agent-src/scripts/archive_completed_roadmaps.ts:414-508`), for a
`carried-to` carry — all must hold:

| # | Requirement | Line |
|---:|---|---|
| 1 | the `[~]` item carries a well-formed `<!-- deferred-resolution: carried-to=<slug> -->` | `:435-441` |
| 2 | destination ≠ the source's own slug | `:454-460` |
| 3 | destination is not being archived by the same sweep | `:461-467` |
| 4 | `agents/roadmaps/<slug>.md` **or** `agents/roadmaps/later/<slug>.md` exists — a bare `fs.existsSync`, frontmatter never parsed | `:446-449`, `:468` |
| 5 | destination is not under `archive/` or `skipped/` — reported with its own message | `:470-477` |
| 6 | destination contains `^parent_roadmap:[ \t]*<sourceSlug>[ \t]*$` — for `carried-to` this is the **only** accepted proof | `:485-492` |

**Requirement 4 is decisive for a stub receiver.** The candidate list is
`agents/roadmaps/<slug>.md` and `agents/roadmaps/later/<slug>.md` **only**.
`agents/roadmaps/stubs/<slug>.md` is **not** in it, and it is not in the
`['archive','skipped']` dead-list at `:470` either — so a stub destination
produces the *"does not exist"* problem at `:475` and blocks archival.

```
A DESCOPE INTO agents/roadmaps/stubs/ IS NOT A LEGAL CARRY DESTINATION.
deferralProblems ACCEPTS EXACTLY TWO DIRECTORIES: agents/roadmaps/ AND
agents/roadmaps/later/. A STUB RECEIVER REDS THE ARCHIVAL SWEEP.
```

That is a hard, mechanical answer to the disposition question as posed. A descope
that intends to archive the bridge must send 0.8 and AC-9 to a **top-level or
`later/` roadmap** — and requirement 6 means that receiver must carry
`parent_roadmap: road-to-harness-promotion-bridge`. Note also that requirement 4
never parses frontmatter, so a `status: draft` receiver **is** legal — the
precedent already in the tree
(`agents/roadmaps/road-to-council-topology-evidence-followups.md:3`).

### 4.4 Estate-count consequence

`./scripts-run src/scripts/check_estate_count` at this commit, verbatim:

```
scanned: 77
  active_roadmaps        2  (floor 2 at origin/main, +0)
  later_roadmaps        75  (floor 75 at origin/main, +0)
  open_blockers         30  (floor 30 at origin/main, +0)
  skill_count          299  (floor 299 at origin/main, +0)
  skill_description_tokens 11455  (floor 11455 at origin/main, +0)
  concern_count         55  (floor 55 at origin/main, +0)
  this change         +0 active / -0 disposed
check_estate_count ledger: scanned=8 planned=8 skipped=0
✅  check_estate_count: estate within its ratchet.
```

**Every dimension sits at an EXACT floor with zero headroom.** Three top-level
`*.md` files exist but `active_roadmaps` reads **2**: the count comes from
`collect()` (`src/scripts/check_estate_count.ts:399`, `:424`), which drops
`status: draft`, so `road-to-council-topology-evidence-followups.md` is invisible
to the numerator. `later_roadmaps 75` and the ~104 stub files are counted
separately or not at all.

Consequences for each disposition:

- **New top-level receiver roadmap** → `active_roadmaps` 2→3 against an exact
  floor of 3-required-headroom-of-0. Reds unless it carries **both**
  `estate_offset_exempt:` and `estate_growth_exempt:` (the two halves are
  separate; `classifyDiff` computes offsets at `:498-535` and exemptions at
  `:526-533`). The bridge itself carries exactly that pair
  (`road-to-harness-promotion-bridge.md:14`, `:15`) — precedent exists.
- **New `later/` receiver** → `later_roadmaps` 75→76 against an exact floor.
- **New stub** → **no estate cost.** `isActiveTopLevel`
  (`src/scripts/check_estate_count.ts:444-451`) requires a path with no `/` after
  `agents/roadmaps/`; stubs are excluded, and `isDisposed` (`:462`) counts
  `stubs/` as a disposition directory. But per § 4.3 a stub is not a legal carry
  destination, so this cheapness is unavailable for a descope.
- **Archiving the bridge** → an offset (`classifyDiff:510-511`), a credit. Not
  reachable while its blocker is open (§ 4.3 gate 4).

---

## 5. The unguarded-carrier gap — how big is closing it?

Sources: `agents/roadmaps/stubs/road-to-deferral-carry-guard.md`
(`complexity: bounded`, `review_by: 2027-03-31`, created 2026-09-01) and
[`topology-followups-disposition-evidence-2026-09-01.md`](topology-followups-disposition-evidence-2026-09-01.md)
§ 3.

### 5.1 The gap, re-verified this pass

`deferralProblems` has **one** production call site (`:574`) inside
`for (const stats of collect(roadmap_root))` (`:540`), reached only when
`stats.open_ === 0` (`:562`) and `stats.deferred !== 0` (`:568`). `collect()`
(`update_roadmap_progress.ts:748-762`) skips `status: draft` (`:755-757`) and
every file under `archive`, `skipped`, `stubs`, `later`
(`EXCLUDE_DIRS` at `:95`, applied at `:315`). Once the parent is archived the
pair can never be re-examined. Nothing else reads the annotation. `classifyDiff`
(`src/scripts/check_estate_count.ts:498-535`) scores a `D` on an active top-level
roadmap as an **offset** at `:522-523`, with no knowledge of whether it is
somebody's receiver. All confirmed.

### 5.2 The census nobody had run — and it changes the answer

**Measured here for the first time.** Across `agents/roadmaps/archive/`:
**46** `deferred-resolution: carried-to=` occurrences in **5** files, naming **6**
distinct destinations (a 7th match is a slug-free prose mention at
`road-to-inbox-harvest-2026-08-e-council-topology-evidence.md:16`).

| Destination | Resolves to | Carriers | Status |
|---|---|---:|---|
| `road-to-council-topology-evidence-followups` | `agents/roadmaps/` (draft) | 38 + 1 prose | live |
| `road-to-experience-loop-owner-decisions` | `later/` | 2 | live (parked) |
| `road-to-experience-lifecycle-operational-proof` | `later/` | 1 | live (parked) |
| `road-to-composition-review-false-positive-rate` | `later/` | 1 | live (parked) |
| **`road-to-journal-host-capture-measurement`** | **`archive/`** | 1 (`road-to-runtime-event-journal.md:124`) | **would fail requirement 5 today** |
| **`road-to-obligation-delivery-verification`** | **`archive/`** | 1 (`road-to-turnaround-followups.md:82`) | **would fail requirement 5 today** |

**Two carries in the tree already point at a destination that
`deferralProblems:470-477` would reject as dead.** Both back-links are intact
(`archive/road-to-journal-host-capture-measurement.md:8`,
`archive/road-to-obligation-delivery-verification.md:4`).

**And both are almost certainly BENIGN.** A roadmap only reaches `archive/`
through `archive_completed` when `stats.open_ === 0` (`:562`) and its blockers
are closed (`:591`) — so each of these receivers **completed the work it
received** before being archived. A naive standing validator would emit two
findings on day one, and both would be false positives.

**That is the "disposition vocabulary it does not have today" the stub names,
converted from a prediction into a measurement.** The finding rate for the naive
rule at this commit is 2/46 carries, 2/2 false-positive.

### 5.3 Size estimate

**Option 2 — charge the deletion in `classifyDiff`. SMALL. Buildable in this run.**

Teach `classifyDiff` that a `D` on an active top-level roadmap which is some
archived roadmap's `carried-to` destination is not an offset. Files touched:

| # | File | Change |
|---|---|---|
| 1 | `src/scripts/check_estate_count.ts` | a receiver-set walk over `agents/roadmaps/archive/`, consulted at `:522-523` |
| 2 | `tests/scripts/check_estate_count.test.ts` | the polarity pair: a normal deletion still credits, a receiver deletion does not |

No new gate, no `gate-coverage.yml` row, no Taskfile change, no workflow step, no
ledger entry — the gate already exists and is already registered
(`Taskfile.yml:213`). **Registered is not the same as running in CI**: per § 4.2
fact 1 no workflow invokes `task ci`, so `check_estate_count` is a local gate,
and option 2 inherits that reach exactly. **Caveat, stated by the
stub itself:** it catches deletion and **not silent emptying**, and it does not
touch archiving-the-receiver, which is the class § 5.2 just measured. It is a
partial close.

**Option 1 — a standing carry validator. NOT buildable responsibly in this run.**

The check: walk every `*.md` under `agents/roadmaps/archive/`, parse each
`<!-- deferred-resolution: carried-to=<slug> -->`, and for each assert that the
destination still resolves under `agents/roadmaps/` or `agents/roadmaps/later/`
and still carries `^parent_roadmap: <sourceSlug>$`. Essentially
`deferralProblems`' requirements 4, 5 and 6 re-run over the archive.

The walk is trivial — 46 annotations over 5 files today. The cost is elsewhere:

*Registration surface* — a new `lint_*`/`check_*` script under `src/scripts/` is
a measured **six**-surface change:

1. a `src/config/gate-coverage.yml` entry (`id`, CI-identical `argv`,
   `min_scanned`, `status`, `canary:` recipe) — the file carries 81 entries today;
2. the header's two prose numbers in that same file;
3. **the header's gate-script POPULATION figure**, bounded by a test at ±15 —
   the trap;
4. `taskfiles/ci-fast.yml` + the `Taskfile.yml` `ci:` list, which
   `check_ci_local_parity` cross-derives;
5. a workflow step with identical argv;
6. the ledger ratchet — adopt `_lib/gate_ledger.ts` or carry a
   `// ledger-exempt:` marker, or `check_gate_completeness` grows and reds.

Plus the script, plus its polarity test (the denial, not just the claim), plus a
`--canary` proof that it can fail. **Realistic: 8-10 files touched.**

*The blocking problem is not size, it is semantics.* Per § 5.2 the naive rule is
**2/2 false-positive on the live corpus**. Shipping it means either shipping two
known-wrong findings, or first designing the disposition vocabulary that
distinguishes:

- a receiver archived **after discharging** the carry (benign — both live cases);
- a receiver archived **with the carry still open** (the real defect);
- a receiver renamed, re-parented, or itself carried onward;
- a receiver legitimately emptied because the item was cancelled by decision.

Only the second is a finding. Deciding that vocabulary is a design decision about
a **fail-closed gate every archival passes through**, and it needs its own review
rather than riding on a disposition run — which is exactly the reason the stub
gives at its § "Why it is not built here".

### 5.4 Feasibility of option 3C, stated plainly

**Not feasible as "close the gap".** Option 1 cannot be shipped in this run
without either a two-false-positive gate or an unreviewed change to a fail-closed
archival gate. Option 2 is feasible and is a **partial** close — it stops the
deletion credit and leaves the archiving and emptying paths open. Calling option
2 "the gap closed" would overstate it; calling it worthless would understate it.
It is the narrow half, and it should be named as the narrow half.

---

## Appendix — what this pass did NOT check

- **It did not run the roadmap gate suite.** Scope of each gate was read from its
  glob and exclusion constants, not by executing it over a mutated tree; mutating
  the tree to test a gate is out of scope for an evidence pass.
- **It did not verify the 38 carried items' faithfulness.** `deferralProblems`
  itself declines this (`:406-410`: *"NOT checked, and named rather than
  implied: that the destination's copy of the criterion is faithful"*). Neither
  did this pass.
- **It did not adjudicate ADR-239's `REVIEW-NOW` backlog entry**
  (`adr-evidence-sweep-2026-08.md:466`, due 2026-09-26). That is a separate
  obligation with a separate owner.
- **It did not put any question to a council**, and it did not evaluate whether
  the 1C ruling should be revisited. Both are outside an evidence pass.
- **The estate figures are branch-local.** `check_estate_count` compares against
  `origin/main` as fetched in this worktree; a merge on `main` moves the floors.
