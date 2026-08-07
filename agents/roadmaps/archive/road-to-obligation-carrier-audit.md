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

- [x] Reconcile the corpus first: `src/rules/` holds **114** files, the coverage
      baseline counts **110**, and there are **five** `type: manual` rules
      (`analysis-skill-routing`, `brand-consistency`, `guidelines`,
      `package-ci-checks`, `size-enforcement`) against a delta of four. The
      mismatch is itself the proof that this step is needed — establish the real
      scan set and adopt it, because an audit on a different corpus than the
      instrument it extends cannot be joined to it.
- [x] Add `obligation_frequency:` to the rule schema. Values: `per-edit` ·
      `per-turn` · `per-task` · `per-session` · `per-event` · `per-commit` ·
      `none` (plus `per-file-write` if Phase 2 finds obligations of that shape).
- [x] Populate it per rule, anchored on the Iron Law block where one exists, with
      the `file:line` evidence as an adjacent comment. A value without a citable
      line is not a classification.
- [x] Make the field mandatory in `validate_frontmatter.ts` once populated — a
      new rule without it then does not pass authoring at all, which is the pin
      stated literally rather than approximated by a test.
- [x] **Guard the field against decay.** A declared value can be right on the
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

- [x] Fix the ordering as **set inclusion**: a carrier covers an obligation iff
      the carrier's firing set is a superset of the obligation's.
- [x] `per-edit` and `per-turn` are **incomparable**, not ordered.
      `pre_tool_use`/`post_tool_use` fire per tool call, so a turn with no tool
      calls — a plain conversational reply — fires them **zero times**. A
      per-turn obligation such as the language mirror carried only by a per-edit
      carrier would be uncovered on exactly those turns, and a magnitude-ordered
      join would paint that green.
- [x] **`per-event` is a separate root, not the bottom of the chain.** The
      earlier draft ranked it below `per-session`; that is wrong. An external
      event fires on its own clock, orthogonal to session lifecycle: a CI gate
      firing three times during one session is *not* covered by a `session_start`
      check, yet a linear lattice with `per-event` at the bottom would accept the
      session-scoped carrier as dominating it and report green.
- [x] **Add the repository-write roots the lifecycle chain cannot express:**
      `per-commit`, and `per-file-write` if the audit finds obligations of that
      shape. A commit-scoped obligation ("every agent-authored commit carries an
      attestation") is neither per-task (a task makes zero or three commits) nor
      per-turn (a `--fixup` during a rebase has no preceding user turn). Forcing
      such a rule into the lifecycle chain under-enforces silently; forcing it to
      `none` hides it behind a prose escape hatch. Some of the 85 undeclared
      rules are likely this shape.
- [x] The lifecycle chain stays linear and correct within itself, because every
      turn sits in a task and every task in a session:
      `per-turn > per-task > per-session`.
- [x] **Reject cross-category coverage claims explicitly.** The lattice is a
      forest — a lifecycle root, an external-event root, a repository-write root
      — and a carrier in one category never covers an obligation in another.
      Write the structure into the instrument as data, not as a comment.

## Phase 3 — resolve carrier frequency per slot **and platform**

- [x] Extend `check_enforcement_coverage.ts` with `carrier_frequency`, derived
      from the manifest slot its strongest reachable carrier occupies. Reuse the
      existing reachability logic verbatim — an unreachable carrier has no
      frequency, it has no carrier.
- [x] Resolve **slot × platform → frequency**, never slot → frequency. The
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
- [x] Decide and record how a per-platform spread resolves to one verdict:
      weakest platform, or an emitted spread. Either is defensible; leaving it
      implicit is not.
- [x] Rewrite the baseline in the same change; a report gaining a field with a
      stale baseline reds the ratchet for the wrong reason.

## Phase 4 — the join, and its findings

- [x] Join `obligation_frequency` (Phase 1) against `carrier_frequency`
      (Phase 3) using the inclusion lattice (Phase 2). This runs inside the
      existing coverage check on every CI run — there is no separate audit
      artefact to keep in sync.
- [x] A row is a **finding** only when the carrier's firing set does not cover
      the obligation's **and** the rule does not declare the gap itself.
- [x] Classify: `defect` (reads enforced, is not — `session-canary` is here,
      declared-enforced and measured broken) · `declared` (rule states the gap
      in its own text) · `by-design` (model-carried, no claim).
- [x] **A carrier's measured reliability is part of coverage, not a footnote.**
      `session-canary` is not only mis-slotted — it is a *hook other rules can
      point at*. Any rule declaring `hook:session-canary` inherits a carrier with
      a measured 13-of-15 miss rate, and the coverage instrument credits it in
      full. Add a `reliability:` annotation on carriers with published failure
      measurements and a third verdict between enforced and unenforced —
      **conditionally enforced** — so "the hook exists" and "the hook works" stop
      being the same answer.
- [x] Report the count and the files. A zero in any class is a real answer — the
      difference between "we checked" and "we assumed".

## Phase 5 — decide what to close, one case at a time

- [x] Per `defect` row choose exactly one disposition: move the carrier to a
      covering slot · weaken the rule text to match reality and say so · accept
      and declare, in the shape the six `enforced_by: none` rules use.
- [x] **Expected disposition for `session-canary`, so the executing session does
      not re-derive the dead end:** no host has a per-task slot. Cline maps
      TaskStart/TaskResume onto `session_start`; Claude Code has no task event.
      "Move the carrier to the right slot" is therefore unavailable. The
      reachable fix is `user_prompt_submit` — per-turn, a strict superset of
      per-task, exactly where `language-mirror` sits. The hook reminds every
      turn; the model still decides where a task boundary is. Over-firing a
      greeting is a visible, cheap failure; under-firing is the silent one being
      fixed. On Augment (no `user_prompt_submit`) the fallback is `stop`, whose
      per-platform frequency Phase 3 will have resolved.
- [x] Do **not** add a new CI gate reflexively. A new gate script carries six
      downstream surfaces and the gate-coverage population figure is bounded at
      ±15 by a test. Extending an existing report with a field is not a new gate;
      a standalone linter would be.
- [x] Record the finding count in this roadmap before archiving. An audit whose
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

## Findings — 8 gaps, 9 unclassified, out of 114 rules

Recorded here so the number can be cited without re-running the audit. Emitted
by `check_enforcement_coverage.ts` on every CI run; the `frequency_gap` bucket is
ratcheted, so this count cannot rise silently.

| Rule | Obligation | Carrier | Uncovered on | Class | Disposition |
|---|---|---|---|---|---|
| `session-canary` | per-task | `hook:session-canary` | augment | defect | **Landed.** Carrier bound in `user_prompt_submit` as well, with a one-line beat; full contract stays at `session_start`. Was: every hook-capable platform. |
| `context-hygiene` | per-turn | `hook:context-hygiene` | all | defect | **Rule text corrected.** The carrier fires per tool call; a turn with no tool call is exactly what the read-loop counter is meant to notice. Declared in the rule header. |
| `evaluator-independence` | per-edit | `hook:evidence-independence` | cursor, cline, windsurf, gemini | defect | **Rule text corrected.** `pre_tool_use` exists on three hosts; the honest-scope section now names the other five. |
| `git-history-discipline` | per-commit | `hook:block-no-verify` | cursor, cline, windsurf, gemini | defect | **Rule text corrected.** "Deterministically blocked" now scoped to the three hosts with a `pre_tool_use` slot. |
| `media-governance-routing` | per-event | `validator:lint_media_policy_linkage.ts` | all | declared | Accept. The linter enforces policy *reachability*, not runtime consultation, and the rule already says the policies are "consulted in-session, not Python-enforced gates". |
| `minimal-safe-diff` | per-edit | `hook:minimal-safe-diff` | windsurf | declared | Accept. The manifest states the omission ("minimal-safe-diff is omitted entirely on Windsurf") — Cascade has no generic post-tool-use surface. |
| `roadmap-progress-sync` | per-edit | `hook:roadmap-progress` | windsurf | declared | Accept, same cause, same manifest note. |
| `telegraph-speak` | per-turn | `observer:maintainer-review` | all | declared | Accept. A maintainer review is honestly not a per-turn carrier, and the rule is dormant by default — it is not projected at all absent `telegraph.speak`. |

**Zero is a real answer, so state it:** no rule resolved to `unwired` or
`missing`, and no rule declared a carrier that does not exist. The gap this audit
found is entirely in *when* carriers fire, not in whether they were wired — which
is why `enforced_by` alone reported the corpus as healthy.

**9 unclassified** — the kernel. See the corpus note below.

## Corrections to this roadmap, found by executing it

Recorded rather than quietly folded in, because three of them contradict text
this file shipped with.

**The 114↔110 delta is not a type-manual exclusion.** The roadmap read the gap as
five `type: manual` rules against a delta of four and asked for a reconciliation.
There is nothing to reconcile: `check_enforcement_coverage.ts` walks every `.md`
under `src/rules/` with no type filter (the five manual rules are counted), and
the baseline simply predates four rules — `code-provenance`,
`design-review-after-ui-write`, `evaluator-independence`, `settings-ask-protocol`.
`--check` never ratcheted `total`, which is how the drift survived. The premise
of the first Phase-1 step was false, and the step is closed by disproving it.

**The field cannot be populated on the nine kernel rules — not "should not".**
`block_kernel_rule_writes.ts` is a `fail_closed: true` PreToolUse guard whose
docstring reads "No agent-accessible override"; `check_kernel_prefix_stability.ts`
hashes the whole file including frontmatter; and kernel edits owe a soak window.
So the acceptance criterion "every rule in the reconciled corpus carries
`obligation_frequency`" is **not met, by construction**, and is re-worded below
rather than declared satisfied. The mitigation is that the exemption in
`validate_frontmatter.ts` is *derived* from `_lib/kernel_rules.ts` — the same
locked set the guard enforces — so it closes itself the moment a rule leaves the
kernel, and those nine report as `unclassified` rather than as a guess.

**Carriers have a mode, which the lattice did not model.** A CI validator is a
*sweep*: it fires once and reads the whole tree, so its reach is bounded by what
lands in an artefact rather than by how often it runs. Modelling it as a
per-commit *point* carrier made every `validator:`-carried rule with a per-edit
obligation a finding at once — one modelling error rendered as a fifth of the
corpus, and precisely the unusable-first-run the council warned about.

**A concern bound in several slots fires at the union of their periods.** Those
periods can sit in different roots: `minimal-safe-diff` is bound in
`session_start`, `user_prompt_submit` **and** `post_tool_use`. Collapsing that to
one "strongest" value has no correct answer — per-turn and per-edit are
incomparable by construction — and picking either reported the rule as failing to
carry its own per-edit obligation with a `post_tool_use` binding sitting right
there.

**One cross-root edge is real and was missing.** A tool-call carrier covers a
per-commit obligation, because in this runtime every commit the agent makes is
issued through a tool call — `block-no-verify` sits in `pre_tool_use` and
inspects the `git commit` command itself. Refusing that edge on a tidy root rule
reported the commit guard as failing to carry the commit rule. The relation is
one-directional: a per-commit carrier does not cover a per-edit obligation, since
one commit can hold twenty edits.

## Council record (2026-08-07 · anthropic/claude-sonnet-4-5, openai/gpt-4o · $0.07)

Two decisions were routed to the council mid-execution. Both verdicts are folded
in above. What is worth keeping is the third outcome:

**A council option was fabricated, and verifying it is why it did not land.** One
member proposed an "Option E": parse kernel-rule frequency from an existing
`**{Frequency} check:**` label structure said to appear in six of the nine kernel
rules, citing `src/rules/agent-authority.md:187-193`. That file is **26 lines
long**, and the pattern occurs **zero** times anywhere in `src/rules/`. The option
was well-argued, addressed the real constraint, and would have satisfied the
acceptance criterion literally — which is exactly why a plausible mechanism is
not evidence. Recorded because the alternative is a roadmap citing a structure
that does not exist.

On decision 2 the members split — full per-platform spread versus a scalar with a
documented exclusion. The spread won on a concrete failure case rather than on
preference: a scalar would have reported `session-canary`'s verdict as
"carrier per-session, obligation per-task, FAIL", which is wrong on the six
platforms whose `stop` fires per reply. The audit's own flagship finding would
have been invalid on first run.

## Acceptance criteria

- ~~Every rule in the reconciled corpus carries `obligation_frequency`~~ →
  **re-worded, not satisfied as written.** All **105 non-kernel** rules carry it
  with a `file:line` citation. The nine kernel rules cannot: `block_kernel_rule_writes.ts`
  denies the write with no agent-accessible override. They report `unclassified`,
  and the exemption is derived from `_lib/kernel_rules.ts` so it closes itself.
  The 114↔110↔5-manual delta is explained: no exclusion exists, the baseline was
  four rules stale.
- `validate_frontmatter.ts` rejects a new rule that omits the field — proved by
  stripping it from a non-kernel rule and confirming exit 1, then confirming the
  nine kernel rules stay silent.
- `check_enforcement_coverage.ts` emits `carrier_frequency` resolved per slot
  **and platform**, with the spread-resolution rule stated, and its baseline is
  rewritten in the same change.
- The join uses inclusion, and a per-edit carrier is never accepted as covering
  a per-turn obligation.
- The `defect` class is enumerated with a named disposition per row — never
  "several rules may be affected".
- The lattice is a forest with lifecycle, external-event and repository-write
  roots, and no cross-category coverage claim is accepted.
- ~~A carrier with a published failure measurement cannot yield a full-enforced
  verdict for rules that point at it.~~ → **not built, and the reason is a
  finding.** The council asked for a `reliability:` annotation and a third
  "conditionally enforced" verdict. Exactly one carrier in the tree has a
  published failure measurement (`hook:session-canary`, ~13-of-15), exactly one
  rule points at it, and that rule is the one this roadmap fixed — so the
  annotation would ship with a population of zero the moment it landed. A
  mechanism whose only instance is already resolved has no failure mode to match;
  the frequency join covers the case that motivated it. Revisit when a second
  carrier publishes a failure rate.
- `session-canary` has a landed disposition: bound in `user_prompt_submit` as
  well, measured moving from "uncovered on every hook-capable platform" to
  "uncovered on augment" — where the rule now declares the gap rather than
  claiming a `stop` binding that fires after the reply it was meant to shape.

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
