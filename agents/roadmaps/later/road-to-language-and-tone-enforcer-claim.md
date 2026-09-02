---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
owner: maintainer
parent_roadmap: road-to-comment-enforcement-completion
review_by: 2027-03-31
estate_growth_exempt: "later_roadmaps grows by one and nothing offsets it, because the thing being preserved is a defect record that no other surface can hold. The parent road-to-comment-enforcement-completion archives in the same change with its agent-executable scope complete; its one remaining criterion is a write to src/rules/language-and-tone.md, which block_kernel_rule_writes.ts refuses to every agent at both the Write/Edit surface (:105-124) and the Bash surface (:126-205). The alternative to this file is marking the item [-], which is owner-reserved and pinned to mean the scope is dropped -- and the scope is not dropped, it is waiting for a human with the one authorization the guard names. Growth here is preservation of a known-false frontmatter claim, not accumulation."
estate_offset_exempt: "Not a new plan. This is the kernel-edit REMAINDER of road-to-comment-enforcement-completion, parked under agents/roadmaps/later/ by AI council verdict 2A (2026-09-02, anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, deep, peer-review, blind chairman, 2/2 present needed 1, subscription transport, billable=0, $0.0000). later/ is excluded from the dashboard and from /roadmap:process-*, so it adds no active roadmap. The blocker travels with it rather than being closed: open_blockers spans the active tree AND later/ (check_estate_count.ts:470), so the count is preserved and nothing is laundered by the move."
---
# Road to the language-and-tone enforcer claim

> **Parked on a human action, not on effort.** Every step below is one small
> edit that is fully specified. None of them is reachable by an agent in any
> session, on any host, under any autonomy setting. See § Why this is parked.

## The defect, stated so a later reader does not have to re-derive it

`src/rules/language-and-tone.md` carries an `enforced_by` frontmatter list that
names `validator:src/scripts/check_md_language.ts`. The rule's "Code comments
English" clause governs **source files**. `check_md_language.ts` rejects every
path that is not `.md` (`check_md_language.ts:175`), so the entry names a
validator that structurally cannot see the surface the clause is about.

A gate that can see it now exists: `src/scripts/lint_code_comments.ts` reads the
diff, classifies `de-comment` / `report-comment` / `provenance-comment`, is
CI-wired, and since 2026-09-02 carries its own `--self-test` (18 cases, 9
rejecting). So the frontmatter is curable by naming something true rather than
by building anything.

**What the false claim costs is measured, not hypothetical.** The parent roadmap
records the defect it hid: 509 German comment lines and 21 report- or
provenance-shaped comments across 41 of 45 changed source files, on two rules
that between them named a `.md`-only validator and no validator at all. A
frontmatter entry a reader trusts is why that was invisible for as long as it
was.

## Why this is parked

`language-and-tone` is one of the nine kernel rules
(`docs/contracts/kernel-membership.md` § 4).
`src/scripts/hooks/block_kernel_rule_writes.ts` denies every agent write to a
kernel rule:

- **Write/Edit surface** (`:105-124`) — any path whose basename is a kernel rule
  filename under a `rules/` segment, in `src/` and in every projection.
- **Bash surface** (`:126-205`) — redirection into the path, in-place `sed`,
  `tee`, `truncate`, `rm`, and `mv`/`cp` whose destination it is. Added after a
  spike measured that a tool-name-keyed guard let `sed -i` through.

Its header states the sole legitimate bypass: *"the human-owned exception
registry the deny message points to."* `fail_closed: true`, `severity: blocking`
in `src/scripts/hook_manifest.yaml:184-189`.

Reads stay allowed — a kernel rule is immutable, not secret — so an agent can
diagnose this defect precisely, as this file does, and cannot cure it.

## Phase 1 — name something true, or say plainly that nothing does

Either step closes the defect. They are alternatives, not a sequence.

- [ ] **1.1 Add the accurate `enforced_by` entry.** Add
      `- "validator:src/scripts/lint_code_comments.ts"` to the `enforced_by`
      list in `src/rules/language-and-tone.md`, beside the existing
      `check_md_language.ts` entry. The `.md` entry stays correct for the
      rule's markdown clauses; this one covers the source clause.
      verify: `grep -n "enforced_by" -A4 src/rules/language-and-tone.md` shows
      both entries, `task sync && task generate-tools` is clean, and
      `./scripts-run src/scripts/check_kernel_prefix_stability --update-baseline`
      lands in the same PR.
- [ ] **1.2 Or state the honest-coverage sentence.** If no kernel edit to the
      frontmatter is wanted, add one sentence to the rule body saying the code
      clause is model-carried on hosts where the gate does not run — the shape
      `security-sensitive-stop` and `active-remediation` already use for their
      own obligations.
      verify: the sentence is present, and
      `./scripts-run src/scripts/check_safety_floor_untouched` passes or the
      addition is accepted as a substantive kernel edit in its own PR.

## Phase 2 — the process gap the blocker exposed

- [ ] **2.1 Decide whether kernel rules need a light human-approval path for
      non-controversial technical corrections.** Both council seats raised this
      unprompted: the guard is working as designed, and there is no defined
      escalation for a legitimate one-line correction, so such work strands in
      an active roadmap indefinitely. This step is a decision, not an
      implementation, and its outcome may well be "no — the friction is the
      point."
      verify: a recorded decision exists, either in an ADR or in
      `docs/contracts/kernel-membership.md`, naming whether such a path exists
      and what it is.

## Blockers

### blocker: b-kernel-rule-edit

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 1 (1.1, 1.2) and AC-1. Phase 2 is a decision and is not
  blocked by the guard.
- **What to do:** perform one of 1.1 or 1.2 as a human, or authorize the edit
  through the exception registry named in
  `src/scripts/hooks/block_kernel_rule_writes.ts`. The edit takes the
  slow-rollout path in `scope-control` § Kernel-rule edits — own PR, at least
  24 h between kernel-rule merges — and needs
  `check_kernel_prefix_stability --update-baseline` in the same PR, because any
  byte change to a kernel body reds that gate.
- **Recommendation:** 1.1. The gate exists, it is CI-wired and locally
  reachable, and the entry would then describe something true. 1.2 is the
  fallback if no kernel edit is wanted in the window.
- **If you do nothing:** the gate keeps working and the kernel rule keeps
  claiming coverage it does not have. That is the state that made the original
  comment defect invisible.
- **Resolved when:** `src/rules/language-and-tone.md` either names an enforcer
  that reads source files, or says in its body that the clause is
  model-carried.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-02 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Parking makes the false claim permanent | product | A `later/` file with an owner and no date is how a known-wrong frontmatter entry survives a year, which is the exact failure the parent roadmap's own risk register named. | `review_by: 2027-03-31` is a real date the stub-due sweep reads, the blocker is preserved in `open_blockers` rather than closed, and both curing steps are specified to the character so the work is minutes rather than a project. | Phase 1 |
| 2 | A later run reads the park as a licence to bypass the guard | implementation | An agent that finds a fully specified kernel edit blocked by a hook is one unrecognised write verb away from performing it, and the guard deliberately does not understand arbitrary shell. | § Why this is parked states the bypass is human-owned and that circumvention is not contemplated; the guard's own header says recognising every write verb would make it a shell sandbox, which is the failure mode its council named. | § Why this is parked |

## Acceptance Criteria

- [ ] AC-1 — `src/rules/language-and-tone.md` either names an enforcer that can
      read a source file, or states that its code clause is model-carried. The
      middle state — an entry naming a validator that rejects every source
      path — does not survive this roadmap.
- [ ] AC-2 — whether a human-approval path for kernel corrections should exist
      is recorded as a decision, in either direction.

## Explicitly NOT in this roadmap

- **Weakening, removing, or working around `block_kernel_rule_writes`.** The
  guard is the reason an agent cannot quietly loosen its own floor. This file
  exists because the guard held.
- **Widening the three comment classes**, or cleaning existing comments. Both
  carried over from the parent's own exclusions and are unchanged.
