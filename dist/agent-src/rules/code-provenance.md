---
type: "auto"
tier: "2a"
alwaysApply: false
description: "About to port/adapt/reuse external code (algorithm, structure, >~10 lines) — read, close the source, re-derive; conscious borrows need a ledger entry + license check first"
triggers:
  - intent: "porting or adapting code from an external source"
  - intent: "implementing an algorithm or structure seen in another project"
  - intent: "reusing a snippet from online / another repo / a training-data recall"
  - keyword: "port this"
  - keyword: "adapt this"
  - keyword: "based on this repo"
  - keyword: "similar implementation"
  - keyword: "found this on GitHub"
  - keyword: "borrow"
  - keyword: "vendored"
  - keyword: "reference implementation"
routes_to:
  - "skill:license-compliance-borrow-check"
  - "skill:license-compliance-credits"
  - "skill:license-compliance-audit"
workspaces: [engineering]
packs: [engineering-base]
roles: [developer, reviewer, tester, po, incident, planner]
enforced_by:
  - "none"
---

# Code Provenance

AI coding agents can emit code near-verbatim from training data — output-side
legal exposure is live (*Doe v. GitHub* proceeds on that factual premise). No
rule previously told a worker what to do on a **conscious** borrow at the
code layer — this rule closes that gap.

## The Iron Law

```
NEVER ADOPT EXTERNAL CODE VERBATIM.
BORROWING = READ → CLOSE THE SOURCE → RE-DERIVE AGAINST HOUSE STANDARDS → ADAPT.
ANY CONSCIOUS BORROW (ALGORITHM, NON-TRIVIAL STRUCTURE, >~10 LINES OF LOGIC
SHAPE) REQUIRES A PROVENANCE LEDGER ENTRY AND A LICENSE-COMPATIBILITY CHECK
BEFORE THE CODE LANDS.
UNKNOWN LICENSE ⇒ DO NOT BORROW. ESCALATE — NEVER GUESS PERMISSIVE.
```

## When it fires

Porting, adapting, or reusing an algorithm, a non-trivial structure, or
>~10 lines of logic shape from a source you read — a repo, an answer, a blog
post, or a training-data recall with a nameable source. Before it lands:

1. **Close the source** — copy-paste with edits is not re-derivation.
2. **Re-derive** against this repo's own conventions — a renamed copy is
   not a rewrite.
3. **Check license compatibility** via
   [`skill:license-compliance-borrow-check`](../skills/license-compliance-borrow-check/SKILL.md)
   (wraps `detect_target_license.ts`'s derived policy) BEFORE the code
   lands, never as a post-hoc justification.
4. **Record the borrow** in `provenance/borrows.jsonl` with a real
   `transformation_note` — rename-only phrasing is rejected by
   `lint_provenance.ts`.

An **unknown** source license is never permissive-by-default. Stop and
escalate (numbered options, per
[`ask-when-uncertain`](ask-when-uncertain.md)) instead of guessing.

## Self-interrogation clause (AUXILIARY — never a control)

Before finalizing any non-trivial function, ask internally: *"Did I derive
this, or do I remember it?"* "Remember" + nameable source ⇒ treat as a
borrow, run the steps above. "Remember" + no nameable source ⇒ flag
`origin: uncertain` in the PR description (~0 tokens).

Explicitly **non-load-bearing** (council 2026-07-28): an LLM cannot
introspect recall vs. derivation, so the flag is an audit surface only — no
gate, escalation, or clearance ever depends on it; the deterministic layer
(where one exists at all, see below) scans regardless. It projects to every
role in `roles:` above, `planner` included — the clause costs ~0 tokens, and
excluding one role leaves a hole exactly where that role drafts
implementation sketches.

## No CI-facing detector — the ledger is the control

Gate G0 measured both candidate similarity scanners against a frozen golden
corpus; both missed their pre-registered thresholds — rename-only recall
**0/8** (SCANOSS) / **4/8** (jscpd), union false positives 2/12 over the
ceiling. Council resolved (2026-07-28, Option A): **no
`lint_code_provenance.ts` in any form — not even advisory.** The scan
capability exists only as the on-demand
[`skill:license-compliance-audit`](../skills/license-compliance-audit/SKILL.md)
a human invokes deliberately. CI enforces only `lint_provenance.ts` — it
checks the ledger's own records, not similarity, and cannot catch an
unrecorded borrow. The discipline above **is** the control; skipping it is
not caught downstream by anything automatic. No script can enforce "close
the source and re-derive" — a pre-write reasoning step only the model
observes — so this rule ships `enforced_by: none`, same honesty stance as
`security-sensitive-stop` and `untrusted-input-defense`.

## When NOT to fire

- A well-known, unpatentable algorithm shape (a hash map, a for-loop) with
  no specific source in mind.
- Reusing your **own** prior code within this repo.
- Prose/docs/config-only edits.

## See also

- [`license-compliance-borrow-check`](../skills/license-compliance-borrow-check/SKILL.md), [`license-compliance-credits`](../skills/license-compliance-credits/SKILL.md), [`license-compliance-audit`](../skills/license-compliance-audit/SKILL.md) — the borrowing / notices / on-demand-scan skill family this rule routes to.
- `provenance/README.md`, `src/scripts/lint_provenance.ts`, `src/scripts/detect_target_license.ts` — the ledger, its linter, and the S1.2 policy derivation.
- [`secret-vcs-guard`](secret-vcs-guard.md) — sibling detect → ask → act discipline for a different leak class.
- [`ask-when-uncertain`](ask-when-uncertain.md) — the escalation shape for `conditional`/`unknown` verdicts.
