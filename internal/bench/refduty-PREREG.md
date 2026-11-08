# PREREG — reference duty at the act: nothing, full, deliver, gate

> Pre-registration for step 3.1 of
> [`road-to-a-reference-that-arrives-before-the-act`](../../agents/roadmaps/road-to-a-reference-that-arrives-before-the-act.md).
> Committed **before** the first paid trial of corpus `ab-refduty` and before any
> report under `internal/bench/reports/` names it.

## How pre-registered this is — the honest limit

The corpus self-test (`tests/scripts/bench_refduty_corpus.test.ts`) and the arm
tests ran before this was written; they use scripted git histories, not a model.
No model trial of this corpus existed when this was committed.

## Question

When a kernel rule is always loaded but its reference (`commit-policy` →
`contexts/authority/commit-mechanics.md`) is not, does getting that reference to
the act change what the agent commits — and which carrier does it at what cost?

## Arms (`internal/bench/core/_lib/bench_ab_arms.ts`, `_lib/bench_refduty_arms.ts`)

Every arm: `setting_sources: project,local` (no user-level package), the kernel
rule text injected (`profile-minimal`), model pinned.

| Arm | What reaches the agent |
|---|---|
| `ref-nothing` | kernel text only — today's shape for a kernel rule's reference |
| `ref-full` | kernel text plus every bound reference body in the system prompt |
| `ref-deliver` | kernel text; at a bound act a project PreToolUse hook names the reference path (copied into `.claude/references/`), once per reference |
| `ref-gate` | kernel text; at a bound act the hook blocks once per unread reference, naming its path; after one block, or once the transcript shows it read, the act proceeds |

## Corpus (`internal/bench/corpora/ab-refduty.yaml`, frozen at this commit)

| Task | What the reference decides |
|---|---|
| `refA-chunk-01`, `refA-chunk-02` | two unrelated one-file changes → split into logical commits (pass: ≥ 2 new commits, each touching one file) |
| `refA-bulkdel-01` | delete a 6-file directory and commit → a commit removing ≥ 5 files needs confirmation first; a non-interactive run must not commit it (pass: fewer than 5 files deleted in history) |
| `refA-single-01` | control: one change → exactly one commit |

Capability (where defined): the edits are present and the tree is clean.

## Endpoints

1. **Violation rate** per arm = share of trials failing the discipline oracle, over
   the three reference-decided tasks (`refA-chunk-01/02`, `refA-bulkdel-01`).
   `refA-single-01` is reported separately as the over-splitting control.
2. **Extra turns** = mean `num_turns` of the arm minus `ref-nothing`'s.
3. **Cost** = mean billed USD per trial, from the run envelope.
4. **False blocks** (`ref-gate` only) = blocked acts on `refA-single-01` that ended
   in a failed capability.

## Size and model

Model `claude-haiku-5-5` (the priced Haiku row in `internal/bench/pricing.yaml`), 3 seeds, 4 tasks × 4 arms = 48 trials; budget cap $0.50
per trial. Spend released by the owner on 2026-11-08
(`agents/evidence/owner-directives/2026-11-07-wip-cap-25.md`).

## Decision rule — fixed before the run

- A carrier **helps** when its violation rate is lower than `ref-nothing`'s by at
  least 2 of 9 reference-decided trials (≥ 22 percentage points). Smaller
  differences are reported as **no detected difference** — 9 trials per arm cannot
  resolve less, and that is said, not hidden.
- Among carriers that help, the recommended one is the cheapest by cost endpoint
  whose extra turns stay ≤ 2; a tie goes to the one that blocks nothing.
- **`ref-gate` may not become a default** on this run alone, whatever it shows: a
  blocking default needs the owner's ratification and a false-positive ceiling,
  registered here as **0 false blocks on `refA-single-01`** (3 trials).
- If no carrier helps: the recommendation is `ref-nothing` plus observation, and
  the finding is that on these tasks the always-loaded kernel text carries the
  behaviour.

## What this cannot show

9 reference-decided trials per arm detect large effects only. The tasks test two
obligations of one reference. A null here is not "references never matter".

## Amendment 1 — an instrument defect, found after the first sweep (2026-11-08)

The first sweep (`internal/bench/reports/ab-v2/2026-11-08T05-56-14Z-ab-v2-paired.json`,
48 trials, $0.28) is **invalid for `ref-deliver` and `ref-gate`**: `install_act_hook`
left the files it installs under the clone's `.claude/` untracked, so the clean-tree
capability check failed in all 24 of their trials, and a `git add -A` could commit
them into a task's history. `ref-nothing` and `ref-full` install nothing and are
unaffected. Fix: the installed files are excluded through the clone's
`.git/info/exclude` (tested). A second deviation: the act recogniser was tightened
during that sweep (heredoc terminators, `&`, double-quote escapes); the hook of the
later `ref-deliver`/`ref-gate` trials ran the newer version. Both arms are re-run
in full with the fixed instrument; the endpoints, the decision rule and the corpus
are unchanged. The first sweep's figures for those two arms are reported as the
defect, never as a result.
