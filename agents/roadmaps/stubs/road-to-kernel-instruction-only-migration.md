---
complexity: lightweight
review_by: 2027-02-19
---

# Stub: road to the last `enforced_by: "none"` leaving the kernel

> **Stub — not active work.** Drain-run descope, 2026-08-23, from
> [`road-to-deterministic-time-in-gates.md`](../road-to-deterministic-time-in-gates.md)
> step 2.3. One rule moved here because retiring its value needs a write path
> the agent does not have and a soak window no mandate lifts.

## Why this stub exists

Step 2.3 retired the bare `enforced_by: "none"` spelling in favour of
`instruction-only: <reason>` — same effective level (an honest, recorded gap),
with the triage record attached, because *"nothing enforces this"* and
*"nothing enforces this AND here is why that is the right call"* are not the same
statement and only the second survives review.

Measured at `c7e82087e` by a frontmatter-block parse over `src/rules/*.md`
(**not** an any-line grep — see § The count below): **10** rules declared
`enforced_by:\n  - "none"`. Nine were migrated in the parent change. The tenth is
`src/rules/non-destructive-by-default.md`, and it is a **kernel rule**:

- `block_kernel_rule_writes` denies the agent write with no agent-accessible
  override — the same guard `check_enforcement_coverage` already cites when it
  reports the nine kernel rules as `unclassified` for `obligation_frequency`,
  and for the same reason.
- `scope-control` § Kernel-rule edits requires a kernel-rule change to ship in
  **its own PR with a ≥ 24 h soak between merges**, a guarantee an autonomous
  mandate explicitly does not lift.

So the value could not be retired from the schema outright: doing so would make
`validate_frontmatter` fail on a file no agent may edit, i.e. it would make a
CI-green tree unreachable. `none` therefore stays legal in
`src/scripts/schemas/rule.schema.json`, with that single reason recorded inline
so a reader does not read the survival as an oversight.

## The count — why it is 10 and not 14

The parent roadmap tagged this figure `corrected-from-reproduction` and gave
**14**, correcting a source that said 10. The correction ran the wrong way, and
the mechanism is worth recording because it is the same class of defect the
parent's Phase 2 is about:

```
grep -n 'enforced_by: *"\?none' src/rules/*.md | wc -l     # 12 — all PROSE
```

Those twelve are sentences inside rule bodies of the form *"this rule ships
`enforced_by: none`"*. The tree declares the value in the **list** form
(`enforced_by:` on one line, `  - "none"` on the next), which that pattern never
matches. A grep that counts a rule's own discussion of a value as a declaration
of it is measuring the wrong population.

## What moved here — the complete list

1. `src/rules/non-destructive-by-default.md`: `enforced_by: ["none"]` →
   `enforced_by: ["instruction-only: <reason>"]`. Nothing else.

Every other half of 2.3 shipped in the parent: the schema pattern, the resolver's
`instruction-only` handling (including a bare marker resolving to `missing`, which
the `--check` ratchet reds on), the nine migrations, and the twelve prose
rewrites.

## Producer, probe and baseline

- **Producer:** the maintainer, in a kernel-rule PR of its own, observing the
  ≥ 24 h soak. The reason text is the only content decision, and one is already
  drafted by the parent's own § Honest enforcement section for that rule —
  the Hard Floor is model-carried on every host, and no gate reads a chat turn
  to see whether a confirmation was asked before an irreversible action.
- **Probe**, both halves required:
  1. A frontmatter-block parse over `src/rules/*.md` finds **zero**
     `enforced_by:` entries whose value is the bare string `none`. Deliberately
     not the any-line grep — see § The count.
  2. The value was not merely renamed into invisibility:
     `./scripts-run src/scripts/check_enforcement_coverage --check` still exits 0
     and its `missing` count is still 0, so no rule slipped to a bare
     `instruction-only` with no reason.
- **Baseline 2026-08-23:** one rule remains — `non-destructive-by-default`.
  Resolver reads `declared 37 · local-only 0 · observer 9 · unwired 0 ·
  missing 0 · undeclared 83` over 120 rules, `blocking 15`.

## What this stub does NOT claim

It does not claim the migration is nearly done — it is one line, and the whole
cost is the process the kernel deliberately imposes on it. It does not claim the
surviving `none` is a defect in that rule: the rule's gap is honest, recorded,
and identical in effect to the nine that were migrated. What is missing is only
the *reason* beside it, which is the whole point of the new spelling.

## See also

- [`road-to-deterministic-time-in-gates.md`](../road-to-deterministic-time-in-gates.md)
  — the parent; its step 2.3 names this descope.
- [`agents/roadmaps/stubs/README.md`](README.md) — the class of stub this belongs
  to and the per-item promotion rule.
