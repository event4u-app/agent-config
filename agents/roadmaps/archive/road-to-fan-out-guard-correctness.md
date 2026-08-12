---
complexity: standard
status: ready
---

# Road to fan-out guard correctness — the block that ate the delegation

> **Source:** cross-project session audit, 2026-08-12. Scanned every transcript
> store holding sessions ≤28 days old: 7 stores, 129 sessions, 12 032 assistant
> turns, via `conformance_scan --store`. The audit's own scope limit is stated
> in Phase 0 and is not papered over.

## What the audit found, and what it refused to claim

Four numbers survived verification. One did not, and one turned out to be
already fixed — both are recorded here because a finding list that only grows
is a wish list, not a measurement.

| # | Finding | Status |
|---|---|---|
| F1 | `evidence-independence` blocks legitimate implementation fan-outs | **verified against real transcripts** |
| F2 | `conformance_scan` cannot find a store whose path contains `+` | **reproduced** |
| F3 | Two violation classes the scan itself calls "measured NOWHERE" | **stated by the instrument** |
| F4 | 3 irreversible git ops with no this-turn authorization | **counted, cause not established** |
| — | `language-pin` (408 hits, the largest raw count) | **already fixed — excluded** |

**Why `language-pin` is excluded.** It is the biggest number in the scan and
the most tempting item to ship. Splitting the corpus by date kills it: in this
package's main store the last language-pin violation is dated **2026-08-06** —
the day the `user_prompt_submit` carrier landed. Every violation predates its
own fix. Shipping work against it would be re-fixing a closed defect and
booking the old count as new value.

## F1 — the finding this roadmap is named after

`evidence-independence` ships `severity: blocking` on `pre_tool_use` for
augment, claude and cowork. It blocks the second *self-scoped evaluation*
dispatch in a turn as verdict shopping.

Measured on `road-to-release-truth/fc1ff181`, turn 3 — a 16-way fan-out of
**implementation** workers (`Harden gates batch A`, `Phase 2 wave 1 batch 0`,
…). Feeding those exact prompts through the shipped predicates:

```
[Harden gates batch A]  isEvaluationPrompt: true   isSelfScoped: true
[Harden gates batch B]  isEvaluationPrompt: true   isSelfScoped: true
[Phase 2 wave 1 batch 0] isEvaluationPrompt: true  isSelfScoped: true
```

`isEvaluationPrompt` fires on the words `review` / `audit` / `check` — which a
prompt about gate scripts cannot avoid. `isSelfScoped` fires on exactly one
phrase, in all 15 cases: **`this branch`** — which every worktree dispatch
prompt carries by construction (`Work in <worktree> (branch feat/…)`).

So on a hook-bound host, a 16-way implementation fan-out loses **15 workers**
to a blocking guard.

Three things make this a defect rather than a tuning question:

1. **The rule promises the opposite, by name.** `evaluator-independence`
   § "When it does NOT fire" reads: *"Ordinary parallel fan-out. Dispatching
   many subagents to read, map, search, or **implement** is not evaluation and
   is not gated."* The guard gates precisely that.
2. **The same false positive was already caught once, and the fix was too
   narrow.** `isSelfScoped` exists *because* an earlier audit found seven
   transcript-auditing subagents flagged as shopping. That fix requires a
   self-reference — and `this branch` satisfies it while meaning "the branch we
   are working on", not "my work, reviewed twice".
3. **The test suite covers the wrong half.** `evidence_independence.test.ts`
   asserts an *external* artifact is not shopping, and that ordinary fan-out is
   not an evaluation — using prompts that carry neither `this branch` nor
   `review`. The real shape is untested.

**It also sabotages the one behaviour the operator has repeatedly demanded.**
The same audit's user turns carry, verbatim: *"Wir haben ja festgelegt, dass <!-- md-language-check: ignore -->
der Hauptchat Subagents starten soll. Das ist nicht nur ein 'Ich möchte', <!-- md-language-check: ignore -->
sondern ein muss."* A blocking guard on the second implementation dispatch is
the mechanical opposite of that instruction.

## Phase 0 — state the audit's own limits, in the tree

- [x] Record the corpus and the scope limit in the audit note: 7 stores ·
      129 sessions · 12 032 assistant turns · window ≤28 days. Name the two
      shapes the scan cannot see (`ask-shape`, checkbox batching) and the one
      it now reports as era-split (`language-pin`).
      *Verify:* the note states a per-project session count for every store
      scanned, and does not claim "30 per project" — only this package's store
      holds ≥30 in-window sessions (102); the next largest are 24, 19 and 17.

## Phase 1 — F1, narrow the self-scope discriminator

- [x] Add the failing test FIRST, from the real prompt: an implementation
      dispatch carrying both `this branch` and `review` must not be treated as
      a second self-scoped evaluation.
      *Verify:* the new test in `tests/scripts/evidence_independence.test.ts`
      fails against the current predicate before any source edit.
- [x] Narrow `isSelfScoped` in `src/scripts/hooks/evidence_independence.ts` so
      a bare `this branch` no longer qualifies on its own. Verdict shopping
      needs a *subject the verdict is about* — `my diff`, `my change`, `this
      diff`, `what I wrote` — not the ambient location of the work.
      *Verify:* the new test passes; the existing shopping tests
      (`Audit my change again with a wider scope.`) still block.
- [x] Add the counter-test that keeps the narrowing honest: a genuine second
      review of the agent's own diff in one turn must still block.
      *Verify:* `decide("Agent", "Review my diff again, wider scope.", 1)`
      returns the block exit code.
- [x] Re-run the scan over the store that produced the finding and confirm the
      21 `evidence-steering` violations collapse to the genuine ones.
      *Verify:* `conformance_scan --store …road-to-release-truth` reports
      `evidence-steering` strictly below 21, and every remaining hit names a
      subject rather than a branch.

## Phase 2 — F2, the scan cannot see its own store

- [x] Align the store-slug derivation in `src/scripts/conformance_scan.ts`
      (line ~650, `projectDir.replace(/[/.]/g, "-")`) with what Claude Code
      actually writes: this worktree is `feat+turn-end-gate-always-on` on disk
      and `feat-turn-end-gate-always-on` in the store name, so the scan run
      from here reports "no transcript store" and measures nothing.
      *Verify:* running `conformance_scan` with no `--store` from a worktree
      whose path contains `+` resolves a real store and reports a session
      count > 0.
- [x] Pin it with a unit test over the mangling function alone.
      *Verify:* a path containing `+` maps to the hyphenated slug.
- [x] **Sibling search (added during execution).** The defect-pattern sweep for
      the literal construct `replace(/[/.]/g, "-")` found it is not unique:
      **6 production sites** carry the identical mangling, plus one test copy.
      `report_skill_activation.ts:121` · `report_consultation_rate.ts:110` ·
      `report_skill_obligation_violations.ts:411` ·
      `cache_realization_report.ts:437` · `cost/track.mjs:122` ·
      `_cli/handoff_sessions.ts:107`. Every one is a measurement tool, and every
      one returns a silent empty corpus in a `+` worktree. `track.mjs` even
      carries a comment describing the *previous* round of this same defect
      (only `/` was replaced, so dotted segments missed) — which is the argument
      for generalising the class instead of appending one more character.
      Extract one shared helper for the five TypeScript sites; `cost/track.mjs`
      keeps an inline copy (module boundary — it imports only node builtins) with
      a pointer comment.
      *Verify:* zero occurrences of the old construct remain outside the
      documented `.mjs` carve-out; the affected reports still resolve a store.

## Phase 3 — F4, establish the cause before proposing a fix

Three irreversible ops (`gh pr create`, `gh release`) ran with no
authorization in the turn's prompt — all three in `private/*` projects, none
in this package. The guard *is* bound and the global binary *does* resolve
(`/opt/homebrew/bin/agent-config`, v10.1.0), so the obvious explanation is
already ruled out. Two candidates remain and they need different fixes.

- [x] Determine which of the two it is, per violation: (a) the authorization
      was given in an *earlier* turn and the guard is turn-scoped by design —
      in which case the count is a scan artifact, not a defect; or (b) the
      guard genuinely did not fire.
      *Verify:* for each of the 3 violations, the transcript is read back and
      the classification is recorded with the session id and the turn index.

      **Outcome: neither — it is (c), and the phase was written without that
      option.** Reading the full commands back (they were truncated to 110
      chars in the scan output, which is why the shape was invisible) shows all
      three are MISCLASSIFICATIONS of read-only or harmless commands:

      | Session | Command | Classified | Actually |
      |---|---|---|---|
      | `agent-switch/fe28ecf4` t32 | `gh pr create … --title "…(unblock npm publish)"` | `publish` (BLOCK) | a PR *about* a publish problem |
      | `agent-switch/fe28ecf4` t33 | `gh api repos/…/releases/latest --jq …` | `release` (BLOCK) | a GET |
      | `capisco/a88ef17a` t22 | `gh api repos/jdx/aube-action/releases --jq …` | `release` (BLOCK) | a GET on a third-party repo |

      Two distinct causes, both in `COMMAND_OPS`: the verb patterns were
      unanchored, so a verb NAMED in a quoted argument counted as one INVOKED;
      and the `gh api` alternatives for `release` / `pr-merge` matched a path
      with no HTTP-method check, unlike their `pr-create` sibling which already
      required `-X POST`.
- [x] Fix both causes and pin them. Anchor every `COMMAND_OPS` pattern at
      command position; gate the `gh api` alternatives behind a writing method
      (`-X`/`--method` `POST|PATCH|PUT|DELETE`), accepting the method on either
      side of the path.
      *Verify:* the three audited commands classify as `pr-create` / `null` /
      `null`; `gh api -X POST …/releases`, `gh api …/releases -X POST`,
      `gh api --method DELETE …`, and `gh api -X PUT …/pulls/N/merge` still
      classify as writes; `git_authorization.test.ts` green (46 tests).
- [x] Record the verdict in the audit note.
      *Verify:* re-scanning both control stores reports `git-authorization 0`,
      down from 2 and 1.

## Success criteria

- A 16-way implementation fan-out in a worktree dispatches 16 workers, not 1.
- The prompt shape that caused the block is in the test suite, from real data.
- A genuine second review of the agent's own diff still blocks.
- `conformance_scan` run from any worktree measures that worktree.
- Every count in the audit note is either era-split or stated as un-split.

## Non-goals

- Re-fixing `language-pin`. It is closed; the count is historical.
- Building a gate for `ask-shape`. `user-interaction` states plainly that the
  discriminator needs judgement and that no gate ships for it; inventing one
  here would be the theatre the conformance scan's own header refuses.
- Touching `turn-end-gate` / completion-claim. That surface is under active
  work on a neighbouring branch.
