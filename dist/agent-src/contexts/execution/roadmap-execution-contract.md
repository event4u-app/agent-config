# Roadmap Execution Contract

Loaded by [`roadmap-process-loop § 3`](roadmap-process-loop.md) when the
resolved roadmap declares `execution.mode` in frontmatter
(`autonomous` | `phase-checkpoints`; absent / `interactive` = legacy
behavior, this context stays unloaded). Defines the run-start pre-scan,
the contract summary the user confirms ONCE, the grants that
confirmation activates, and the per-mode gate table.

## Principle — declaration vs. authorization

`execution.mode` in frontmatter is a **declaration of intent** written
at authoring time. It grants nothing. Authorization happens exactly
once per run: the user invokes `/roadmap:process-*` (a this-turn
action), the loop derives the contract below from the roadmap's
CURRENT content, and the user's single confirmation converts the
declared mode into this-turn grants **cached for this run only**
(same mechanism as the commit pre-scan it extends). Stale frontmatter
is harmless: no confirmation, no grants.

## 1. Pre-scan — four detection classes

Scan every open step (text + inline notes) for:

1. **Commit-shaped steps** — `commit:` / `git commit` / `Commit phase`
   (the existing § 3 scan).
2. **Git-shape needs** — steps requiring a branch / push / PR
   (`branch`, `push`, `open a PR`, `create PR`, "in a worktree"), plus
   the run's own delivery needs when the roadmap's definition of done
   includes shipping (autonomous mode default, § 4).
3. **Artifact-authoring steps** — steps that create or materially
   rewrite a skill / rule / command / guideline (verbs `add`/`create`/
   `write`/`rewrite` + artifact nouns, or paths under
   `src/{skills,rules}/`, command/guideline trees). These feed the
   batched [`artifact-drafting-protocol`](../../rules/artifact-drafting-protocol.md)
   research pass (§ 3 below).
4. **Open questions / ambiguity** — explicit `?` markers, "decide
   whether", options left unresolved, or steps matching the
   [`ask-when-uncertain`](../../rules/ask-when-uncertain.md)
   vague-trigger patterns.

## 2. Contract summary — shown once, confirmed once

```
Roadmap: <path> · mode: <autonomous | phase-checkpoints>

Git: branch <feat/<roadmap-slug>> · commits: chunked (N commit steps
     detected / delivery commits) · push: to feat/<roadmap-slug> ONLY
     · PR: open against <default branch> (description only — no merge)
Artifacts: <N> planned (skills/rules/commands/guidelines) —
     batched overlap check: <result — run NOW, against current state>
Open questions: <N> → resolved via AI council (<members | "none
     configured — will halt on ambiguity">)
Quality: <cadence> · Dashboard: <cadence>

Always active regardless of this contract (never lifted):
  • Hard Floor per-commit diff gate (bulk deletions / infra)
  • Push anywhere except feat/<roadmap-slug>; any merge
  • security-sensitive-stop on auth/billing/tenant/secret paths
  • N=3 validation budget · context-hygiene read-loop abort
  • Deferred-[~] archival gate

1. Accept — run under this contract
2. Adjust (name the change) · 3. Run interactive instead · 4. Abort
```

Accept = the ONE authorization of the run. Cache all grants; never
re-ask inside the run. Adjust → apply, re-show once. The contract is
re-derived on every invocation — it always reflects the roadmap's and
repo's current state.

## 3. Grants activated by acceptance

| Grant | Boundary |
|---|---|
| Create feature branch `feat/<roadmap-slug>` (or reuse the current worktree branch) | Never a prod trunk; one branch per run |
| Chunked commits on that branch | Per-commit Hard-Floor diff gate stays ([`commit-mechanics`](../authority/commit-mechanics.md)); agent picks the split per [`commit-policy`](../../rules/commit-policy.md) |
| Push to that branch **only** | Push to any other ref = Hard Floor, ask |
| Open ONE PR (description-only flow) | Never merge, never close/retarget; merge is always conversational |
| Batched artifact drafting | The drafting-protocol **Research/overlap pass runs NOW at contract time against current artifact state**; results cached; Understand/Draft phases run non-interactively during the run. Artifacts NOT in the batch still trigger the interactive protocol |
| Council auto-enable | In-run open questions route to the AI council silently; `high_impact` / `user_required` classifications STILL escalate to the user per [`ask-when-uncertain`](../../rules/ask-when-uncertain.md). **No council configured** → the contract summary says so and in-run true ambiguity halts (never silent guessing) |

These grants satisfy [`scope-control`](../../rules/scope-control.md)'s
"standing instruction" clause for the run — see
[`scope-mechanics § Roadmap execution contract`](../authority/scope-mechanics.md).

## 4. Definition of done, per mode

| Mode | End state | Halts during run |
|---|---|---|
| `autonomous` | All steps `[x]` · quality green per cadence · work committed in chunks on `feat/<roadmap-slug>` · pushed · PR open · archival sweep run. **Merge out of scope, always.** | Safety floors only (+ quality-red, + step reveals out-of-roadmap work) |
| `phase-checkpoints` | Same end state | Safety floors + a compact status + "continue?" prompt at each phase boundary |
| `interactive` (absent field) | Legacy: work lands, no git delivery without per-op permission | All gates as authored by their owning rules |

If the roadmap contains **no** delivery need and no commit steps, the
git grants are omitted from the contract (nothing to authorize —
[`commit-policy`](../../rules/commit-policy.md) default: never commit).

## 5. What acceptance can NEVER cover

- Any [`non-destructive-by-default`](../../rules/non-destructive-by-default.md)
  trigger beyond the two named grants (own-branch push, PR-open):
  prod-trunk anything, deploys, bulk deletions, infra commits.
- Merging, closing, or retargeting a PR.
- Lifting [`security-sensitive-stop`](../../rules/security-sensitive-stop.md),
  the N=3 budget, context-hygiene aborts, or the deferred-`[~]` gate.
- Work outside the roadmap's scope (halt: scope-out-of-roadmap).
- Kernel-rule edits' own-PR + 24h-soak guarantee
  ([`kernel-rule-edits`](../authority/kernel-rule-edits.md)).
