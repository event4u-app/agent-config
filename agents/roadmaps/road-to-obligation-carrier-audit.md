---
complexity: lightweight
status: ready
---

# Road to obligation-carrier audit — which rules fire more often than anything that carries them

**Goal:** make obligation frequency a declared, machine-readable field on every
rule, join it against the carrier's real per-platform firing frequency in the
existing coverage instrument, and close the cases where a rule's text claims an
enforcement its carrier cannot deliver.

## Context

The session-canary failure that triggered this roadmap is not a model lapse and
not context decay. It is a frequency mismatch, mechanically visible in one file:

- `src/scripts/hook_manifest.yaml` lists `session-canary` in the `session_start`
  slot only — on all eight platforms.
- The obligation in `src/rules/session-canary.md` is **per task** ("the first
  reply of each NEW task within it").
- The only per-turn slot is `user_prompt_submit`, carrying `chat-history,
  verify-before-complete, minimal-safe-diff, language-mirror, git-authorization`.

That is why the language mirror holds across a long session and the canary does
not: `language-mirror` sits in the turn slot, `session-canary` does not.

### Why the existing coverage instrument does not already answer this

`src/scripts/check_enforcement_coverage.ts` already resolves, per rule, the
strongest `enforced_by` **and checks reachability** — a validator declared but
wired to nothing does not count (on its first run it caught `lint_output_slop.ts`
as exactly that defect). Baseline in `internal/reports/enforcement-coverage.json`:
110 total, 25 declared, 15 blocking, 0 unwired, 85 undeclared.

`session-canary` is the case that proves the gap:

```yaml
# src/rules/session-canary.md — frontmatter
enforced_by:
  - "hook:session-canary"
```

The hook exists, is wired, and fires. The coverage instrument therefore counts
this rule as **enforced** — and it is nonetheless measured broken (30-session
audit in `session-canary.md`: opening canary dropped on ~13 of 15 task starts,
honesty clause fired zero times). Coverage asks *does something carry this*.
Nothing asks *does it carry it often enough*. That second question is the entire
delta of this roadmap, and it is why Phase 3 extends the existing resolution
rather than rebuilding a parallel one.

### Three states, only one of which is a defect

| State | Known members | Verdict |
|---|---|---|
| Obligation frequency not covered by carrier frequency | `session-canary` (proven, and *declared-enforced*); `user-interaction` § ask-shape (proven, no gate ships) | defect |
| `enforced_by: none`, declared honestly | 6 rules — `ui-audit-gate`, `security-sensitive-stop`, `code-provenance`, `design-review-after-ui-write`, `settings-ask-protocol`, `untrusted-input-defense` | not a defect — they claim nothing |
| Model-carried by design, no claim either way | the 85 undeclared in the baseline | unmeasured |

## Prerequisites

- `src/scripts/check_enforcement_coverage.ts` — the carrier resolution this
  extends. Do **not** build a second resolver; two truth sources for "what
  enforces this rule" is worse than the gap staying open.
- `internal/reports/enforcement-coverage.json` — the ratchet baseline; a new
  field changes the report shape, so the baseline rewrite is part of the work.
- `src/scripts/hook_manifest.yaml` — slot source of truth, **per platform**.
- `src/scripts/validate_frontmatter.ts` + `src/scripts/schemas/` — where the new
  field becomes mandatory at authoring time.

## Phase 1 — declare obligation frequency as a field, not a report

The pin this roadmap promises (a new rule with a per-turn obligation and no
turn-carrier being visible at authoring time) cannot be built on a prose audit:
a regression test cannot reliably parse Iron-Law prose, and an external table
diverges the moment someone edits a rule. So the audit's output is a **frontmatter
field**, and the evidence artefact falls out as a by-product. This is the same
move `enforced_by` itself made — from prose claim to declared, resolved field.

- [ ] Reconcile the corpus first: `src/rules/` holds **114** files, the coverage
      baseline counts **110**, and there are **five** `type: manual` rules
      (`analysis-skill-routing`, `brand-consistency`, `guidelines`,
      `package-ci-checks`, `size-enforcement`) against a delta of four. The
      mismatch is itself the proof that this step is needed — establish the real
      scan set and adopt it, because an audit on a different corpus than the
      instrument it extends cannot be joined to it.
- [ ] Add `obligation_frequency:` to the rule schema. Values: `per-edit` ·
      `per-turn` · `per-task` · `per-session` · `per-event` · `per-commit` ·
      `none` (plus `per-file-write` if Phase 2 finds obligations of that shape).
- [ ] Populate it per rule, anchored on the Iron Law block where one exists, with
      the `file:line` evidence as an adjacent comment. A value without a citable
      line is not a classification.
- [ ] Make the field mandatory in `validate_frontmatter.ts` once populated — a
      new rule without it then does not pass authoring at all, which is the pin
      stated literally rather than approximated by a test.
- [ ] **Guard the field against decay.** A declared value can be right on the
      day it is written and wrong two edits later, and nothing in the join
      notices — the field would then be a stale claim wearing a schema. Ship a
      keyword heuristic over the Iron-Law prose ("every reply", "each task",
      "before every edit") that flags a rule whose prose and declared value
      disagree. Emit it as a **warning**, not a failure, because the heuristic
      will be noisy; suppress a known-good mismatch with an explicit
      `# frequency-override: <reason>` comment, so a suppression is a decision
      someone signed rather than silence.

## Phase 2 — the frequency lattice is inclusion, and it is a forest

The join is only decidable against an explicit ordering, and the intuitive linear
one is wrong in two ways that both produce **false greens** — the most expensive
error class an audit can have.

- [ ] Fix the ordering as **set inclusion**: a carrier covers an obligation iff
      the carrier's firing set is a superset of the obligation's.
- [ ] `per-edit` and `per-turn` are **incomparable**, not ordered.
      `pre_tool_use`/`post_tool_use` fire per tool call, so a turn with no tool
      calls — a plain conversational reply — fires them **zero times**. A
      per-turn obligation such as the language mirror carried only by a per-edit
      carrier would be uncovered on exactly those turns, and a magnitude-ordered
      join would paint that green.
- [ ] **`per-event` is a separate root, not the bottom of the chain.** The
      earlier draft ranked it below `per-session`; that is wrong. An external
      event fires on its own clock, orthogonal to session lifecycle: a CI gate
      firing three times during one session is *not* covered by a `session_start`
      check, yet a linear lattice with `per-event` at the bottom would accept the
      session-scoped carrier as dominating it and report green.
- [ ] **Add the repository-write roots the lifecycle chain cannot express:**
      `per-commit`, and `per-file-write` if the audit finds obligations of that
      shape. A commit-scoped obligation ("every agent-authored commit carries an
      attestation") is neither per-task (a task makes zero or three commits) nor
      per-turn (a `--fixup` during a rebase has no preceding user turn). Forcing
      such a rule into the lifecycle chain under-enforces silently; forcing it to
      `none` hides it behind a prose escape hatch. Some of the 85 undeclared
      rules are likely this shape.
- [ ] The lifecycle chain stays linear and correct within itself, because every
      turn sits in a task and every task in a session:
      `per-turn > per-task > per-session`.
- [ ] **Reject cross-category coverage claims explicitly.** The lattice is a
      forest — a lifecycle root, an external-event root, a repository-write root
      — and a carrier in one category never covers an obligation in another.
      Write the structure into the instrument as data, not as a comment.

## Phase 3 — resolve carrier frequency per slot **and platform**

- [ ] Extend `check_enforcement_coverage.ts` with `carrier_frequency`, derived
      from the manifest slot its strongest reachable carrier occupies. Reuse the
      existing reachability logic verbatim — an unreachable carrier has no
      frequency, it has no carrier.
- [ ] Resolve **slot × platform → frequency**, never slot → frequency. The
      one-dimensional table is wrong on two hosts already:
      - `stop` is **not** session-end on Claude Code. The native `Stop` event
        fires after every assistant reply — the manifest says so itself, calling
        the `stop` write a "deterministic … overwrite of hot-context.md", i.e. a
        working-memory refresh per reply. On Claude Code `stop` ≈ per-turn.
      - On Cline `stop` is mapped from `TaskCancel` — per-interruption.
      - True session end is the separate `session_end` slot, present on six
        platforms and **absent on Windsurf** (its manifest comment: handled "in
        the `stop` slot rather than `session_end`").
      - `user_prompt_submit` is absent on Augment.
- [ ] Decide and record how a per-platform spread resolves to one verdict:
      weakest platform, or an emitted spread. Either is defensible; leaving it
      implicit is not.
- [ ] Rewrite the baseline in the same change; a report gaining a field with a
      stale baseline reds the ratchet for the wrong reason.

## Phase 4 — the join, and its findings

- [ ] Join `obligation_frequency` (Phase 1) against `carrier_frequency`
      (Phase 3) using the inclusion lattice (Phase 2). This runs inside the
      existing coverage check on every CI run — there is no separate audit
      artefact to keep in sync.
- [ ] A row is a **finding** only when the carrier's firing set does not cover
      the obligation's **and** the rule does not declare the gap itself.
- [ ] Classify: `defect` (reads enforced, is not — `session-canary` is here,
      declared-enforced and measured broken) · `declared` (rule states the gap
      in its own text) · `by-design` (model-carried, no claim).
- [ ] **A carrier's measured reliability is part of coverage, not a footnote.**
      `session-canary` is not only mis-slotted — it is a *hook other rules can
      point at*. Any rule declaring `hook:session-canary` inherits a carrier with
      a measured 13-of-15 miss rate, and the coverage instrument credits it in
      full. Add a `reliability:` annotation on carriers with published failure
      measurements and a third verdict between enforced and unenforced —
      **conditionally enforced** — so "the hook exists" and "the hook works" stop
      being the same answer.
- [ ] Report the count and the files. A zero in any class is a real answer — the
      difference between "we checked" and "we assumed".

## Phase 5 — decide what to close, one case at a time

- [ ] Per `defect` row choose exactly one disposition: move the carrier to a
      covering slot · weaken the rule text to match reality and say so · accept
      and declare, in the shape the six `enforced_by: none` rules use.
- [ ] **Expected disposition for `session-canary`, so the executing session does
      not re-derive the dead end:** no host has a per-task slot. Cline maps
      TaskStart/TaskResume onto `session_start`; Claude Code has no task event.
      "Move the carrier to the right slot" is therefore unavailable. The
      reachable fix is `user_prompt_submit` — per-turn, a strict superset of
      per-task, exactly where `language-mirror` sits. The hook reminds every
      turn; the model still decides where a task boundary is. Over-firing a
      greeting is a visible, cheap failure; under-firing is the silent one being
      fixed. On Augment (no `user_prompt_submit`) the fallback is `stop`, whose
      per-platform frequency Phase 3 will have resolved.
- [ ] Do **not** add a new CI gate reflexively. A new gate script carries six
      downstream surfaces and the gate-coverage population figure is bounded at
      ±15 by a test. Extending an existing report with a field is not a new gate;
      a standalone linter would be.
- [ ] Record the finding count in this roadmap before archiving. An audit whose
      number is not written down has to be re-run to be cited.

## Council convergence (2026-08-07 · anthropic/claude-sonnet-4-5, openai/gpt-4o · $0.08)

Both members reviewed the locked design decisions. Converged, and folded in above:

- **`per-event` was mis-placed** — it is a separate root, not the bottom of the
  lifecycle chain. Failure case: a CI gate firing three times inside one session
  is not covered by a `session_start` check, yet the linear lattice would have
  reported green. This corrected an error in the previous draft.
- **`per-commit` is missing entirely.** Commit-scoped obligations map to neither
  lifecycle nor external events; without a root they under-enforce silently or
  hide behind `none`.
- **The frontmatter field is worth its cost, with a decay guard** — a keyword
  heuristic as a warning plus an explicit override comment.
- **A carrier's measured reliability belongs in the verdict** — rules pointing at
  `hook:session-canary` are over-credited by the current instrument.

Divergence, recorded rather than resolved: on ordering, one member argued Roadmap
1 first (with a concrete platform-spread failure case), the other saw value in
shipping the register first for earlier user value. The concrete failure case
carries more weight than the generic value argument, so the order stands.

Rejected after review: a submodule-CWD defect raised in an earlier round — agent
hooks run in the agent's process at workspace root, not in git's subprocess, so
the scenario needs git hooks, which neither roadmap introduces.

## Acceptance criteria

- Every rule in the reconciled corpus carries `obligation_frequency` in
  frontmatter with a `file:line` citation, and the 114↔110↔5-manual delta is
  explained rather than rounded away.
- `validate_frontmatter.ts` rejects a new rule that omits the field.
- `check_enforcement_coverage.ts` emits `carrier_frequency` resolved per slot
  **and platform**, with the spread-resolution rule stated, and its baseline is
  rewritten in the same change.
- The join uses inclusion, and a per-edit carrier is never accepted as covering
  a per-turn obligation.
- The `defect` class is enumerated with a named disposition per row — never
  "several rules may be affected".
- The lattice is a forest with lifecycle, external-event and repository-write
  roots, and no cross-category coverage claim is accepted.
- A carrier with a published failure measurement cannot yield a full-enforced
  verdict for rules that point at it.
- `session-canary` has a landed disposition.

## Quality gates

Targeted only — the remote CI on the PR is the authoritative full gate.

```bash
npx tsx src/scripts/check_enforcement_coverage.ts
npx tsx src/scripts/check_enforcement_coverage.ts --check
npx tsx src/scripts/validate_frontmatter.ts
npx tsx src/scripts/lint_roadmap_complexity.ts
```

## Blockers

### blocker: kernel-soak-check
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 5 — decide what to close
- **What to do:**
  1. Establish whether `session-canary` is one of the 9 kernel rules.
  2. If it is, the fix leaves this roadmap and ships with a ≥24 h soak.
- **Resolved when:** the kernel membership is stated with a citation.
  <!-- RESOLVED 2026-08-07: `src/rules/session-canary.md` frontmatter carries
  `alwaysApply: false` and `tier: "2a"`. The locked kernel set in
  `docs/contracts/kernel-membership.md` § 4 is the nine always-rules:
  agent-authority, ask-when-uncertain, commit-policy, direct-answers,
  language-and-tone, no-cheap-questions, non-destructive-by-default,
  scope-control, verify-before-complete. `session-canary` is not among them,
  so no soak window applies and Phase 5 stays in this roadmap. -->
