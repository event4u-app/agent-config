---
complexity: lightweight
review_by: 2026-09-25
---

# Stub: road to restoring the `never-act-while-asking` kernel clause

> **Stub — not active work.** A **drain-run transfer**, not a demand-gated stub.
> Created 2026-08-26 when
> [`road-to-kernel-invariant-restoration`](../archive/road-to-kernel-invariant-restoration.md)
> was drained: its last item is a **two-line edit to a kernel rule**, and
> `block_kernel_rule_writes` denies that write to an agent on every channel while
> `scope-control` § kernel-rule-edits requires a >= 24 h soak no single run can
> satisfy. Framework of record:
> [`drain-blocker-dispositions-b.md`](../../evidence/council/drain-blocker-dispositions-b.md).
> Outcome state recorded on the parent: **transferred** — chosen so that
> "archived" can never read as "achieved".
>
> **Transferred, not completed. The clause is still missing and
> `check_rule_invariants` is still red on `main`.**
>
> **This is a privileged-execution transfer, not an undecided one.** The remedy
> was settled by AI council on 2026-08-26, 2/2 convergent. Nothing here is
> waiting on a judgement; it is waiting on an authority an agent does not have.

## The criterion, verbatim from the parent

> **2.1 Land the chosen remedy in its own PR, with the soak window.** No
> other change rides along; that is the process, not a preference.
> `verify:` `./scripts-run src/scripts/check_rule_invariants` exits 0 on the
> merged tree, and the PR carries the >= 24 h soak.

> **AC-1** — `check_rule_invariants` exits 0 on `main`, and the reason is either
> a restored literal or a § 10 amendment with its record — never a deleted
> invariant entry.

## The exact edit — decided, not open

In `src/rules/non-destructive-by-default.md:41`, restore the protected literal
and **keep the sentence that follows it**, so the line reads:

```
**Never act while asking.** The ask and the action are strictly sequential: surface the confirmation, then WAIT for the answer. Never fire the action in the turn you ask — no do-then-ask race, no "I went ahead and…".
```

Then regenerate the projection (`task sync`) so
`dist/agent-src/rules/non-destructive-by-default.md` carries the same text — the
gate checks both, which is why it currently reports two findings and not one.

Then land it in **its own PR** with the >= 24 h soak, per
`scope-control` § kernel-rule-edits.

## Why restore rather than amend — the argument, so it is not re-litigated

AI council 2026-08-26, 2/2 convergent, and the reasoning **reversed the parent
roadmap's own guess**. That file assumed clause 1 was the amend candidate
because the current sentence reads better. Both seats rejected that, and the
decisive point is semantic rather than stylistic:

> *"WAIT"* plus *"never fire the action in the turn you ask"* does **not** forbid
> acting in a LATER turn without an answer. *"WAIT for the answer"* does.

The reworded form is a tighter sentence about a **narrower guarantee** — which is
precisely the shape the invariant gate exists to catch, and precisely the shape a
reviewer reading only the prose would approve. Both seats also refuted the
premise that restoring costs the improvement: the newer *"no do-then-ask race"*
sentence follows the restored literal without conflict, so there is no forced
choice between them.

Amending clause 1 through `kernel-membership.md` § 10 would require arguing that
*"WAIT"* is assertion-equivalent to *"WAIT for the answer"*, which both seats say
it is not.

## Probe — the gate itself, and the authority behind it

- **Producer:** a **human with kernel-rule write authority**, working in a
  checkout where `block_kernel_rule_writes` does not apply to them. That is the
  named party, and no other party can substitute: the guard's own docblock reads
  *"No agent-accessible override: the sole legitimate bypass is the human-owned
  exception registry the deny message points to."*
- **Probe — one reading, and it is the parent's own verify:**

  ```bash
  ./scripts-run src/scripts/check_rule_invariants   # exits 0 == this stub closes
  ```

- **Measured on this tree, 2026-08-26, as the transfer-date baseline:**

  ```
  ❌  2 missing kernel rule invariant(s):
     🔴 non-destructive-by-default — src/rules/non-destructive-by-default.md
     🔴 non-destructive-by-default — dist/agent-src/rules/non-destructive-by-default.md
        missing: "**Never act while asking.** The ask and the action are strictly
                  sequential: surface the confirmation, then WAIT for the answer."
  ```

  Two findings, down from four: **clause 2 already landed** in the parent (a § 10
  amendment to `tests/golden/invariants.json`, legal because that file is not a
  kernel rule under a `rules/` path). Both remaining findings are clause 1, in
  the source and in its projection.

## Why no agent can move this — established by READING, never by attempting

Three independent blocks, any one sufficient. A council seat ruled earlier that
probing a safety guard by writing to it is not an acceptable way to learn its
reach, and **no run has attempted the write**.

1. **`block_kernel_rule_writes` denies it on every channel.**
   `src/scripts/hooks/block_kernel_rule_writes.ts` is a `pre_tool_use` guard,
   `fail_closed: true`. It denies Write / Edit / NotebookEdit **and shell
   commands** — the `COMMAND_TOOLS` branch at `:247-255` runs
   `_bash_targets_kernel_rule` over the command string — for any target whose
   basename is one of the nine kernel rule filenames under a `rules/` path
   segment, in the source tree and in every projection.
   `non-destructive-by-default` is one of the nine
   (`src/scripts/_lib/kernel_rules.ts:24`). There is no editor path and no shell
   path left open, so there is no gap here to exploit and this stub does not
   propose one.
2. **The >= 24 h soak is not satisfiable by one run.** `scope-control`
   § kernel-rule-edits requires an own PR and >= 24 h between merges, and states
   the soak guarantee is **not lifted by an autonomous mandate**.
3. **Authoring the patch for a human to merge is refused, not merely
   impractical.** Both council seats ruled on this directly: the human-owned
   exception registry is an **authorization boundary, not an agent-accessible
   bypass**, and creating a patch, commit, branch or PR containing the protected
   edit is still agent authorship of the forbidden change. One seat foregrounded
   the decisive property: the guard is `fail_closed: true` with *"no
   agent-accessible override"* — that is a hard boundary, not a preference, so
   any indirection around it is definitionally illegitimate.

   The single stated carve-out: **if a human had already created an explicit
   exception covering this exact edit**, agent authorship might become legitimate
   subject to that exception's terms, the separate-PR rule and the soak. No such
   authorization exists, and this stub does not create one.

## What this costs while it stays open — do not read this as low priority

- **`check_rule_invariants` is red on `main`.** `task ci` fails at that gate, so
  every later gate in the chain goes unrun locally unless a contributor knows to
  skip past it. A transfer does **not** fix this — one council seat corrected the
  other on exactly this point: moving the work item cleans the roadmap queue and
  repairs nothing. The gate goes green when the literal is restored, and not one
  moment before.
- **The kernel floor is currently the NARROWER guarantee.** The prose in force
  forbids acting in the same turn as the ask and permits acting in a later turn
  with no answer — which is the confirmation bypass the clause exists to close.
- **A red gate nobody can clear trains readers to treat its findings as
  background noise**, which is how the #840 / #844 content losses it was built
  for become invisible again.

## Promotion gates

The README's shared promotion criteria (recruited customer, funded security
audit, ADR sign-off) **do not govern this stub** — see that file's
§ The two classes. One gate governs it, and it is an authority rather than a
measurement:

1. **A human with kernel-rule write authority performs the edit.** There is no
   second condition, because there is no second unknown: the remedy, the exact
   text, the file, the line and the regeneration step are all written above.

## Closing in the other direction — the honest-null path

A drain-run transfer closes when its criterion is satisfied **in either
direction**. The null direction here is a **§ 10 amendment of clause 1's
invariant** instead of a restore — legal, and it would close this stub as
legitimately as the restore does. It is not the recommendation: it would have to
argue assertion-equivalence between *"WAIT"* and *"WAIT for the answer"*, which
the council says does not hold. But an owner may take it, and § 10 is the path.

What is **not** a close in either direction: deleting the invariant entry from
`tests/golden/invariants.json`. That makes CI green in one line and silently
retires a protection that caught two real content losses. The parent's Risk 1
names it, and the gate's own failure message forbids it.

## Seed content on promotion

- Make the two-line edit exactly as quoted above. Keep the following sentence.
- Run `task sync` in the same change — the gate reads the projection too, and a
  source-only fix leaves one of the two findings standing.
- Run `./scripts-run src/scripts/check_rule_invariants` and confirm it exits 0.
- Land it in **its own PR**, nothing else riding along, with the >= 24 h soak.
- Note that clause 2 is already done and needs no further action: its § 10
  amendment, its assertion-equivalence statement, its `--mutation-selftest`
  quote and its explicit "no behavioural eval exists" declaration are all
  recorded at the parent's step 2.1.
