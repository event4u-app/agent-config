---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Porting external code, or asserting an externally-sourced claim — close the source, re-derive; borrows need a ledger entry + license check, harvested claims an id or an own-analysis label"
triggers:
  - keyword: "port this"
  - keyword: "adapt this"
  - keyword: "based on this repo"
  - keyword: "similar implementation"
  - keyword: "found this on GitHub"
  - keyword: "borrow"
  - keyword: "vendored"
  - keyword: "reference implementation"
  - keyword: "harvest"
  - keyword: "adopt from"
routes_to:
  - "skill:license-compliance-borrow-check"
  - "skill:license-compliance-credits"
  - "skill:license-compliance-audit"
workspaces: [engineering]
packs: [engineering-base]
roles: [developer, reviewer, tester, po, incident, planner]
enforced_by:
  - "instruction-only: close-the-source-and-re-derive is a pre-write reasoning step only the model observes; CI checks the ledger, never the derivation"
# obligation: line 40
obligation_frequency: "per-edit"
evidence:
  source_type: external-research
  verified_on: 2026-08-30
  normative_level: informative
---

# Code Provenance

AI coding agents can emit code near-verbatim from training data — output-side
legal exposure is live (*Doe v. GitHub* proceeds on that factual premise). No
rule previously told a worker what to do on a **conscious** borrow at the
code layer. This rule closes that gap.

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

## The knowledge layer — cite a harvest id, or label it own analysis

The clauses above cover borrowed **code**. The same failure has a prose half:
a comparative pass concludes "their citation registry is worth adopting", the
sentence lands in a skill, and six months later nobody can say where it came
from or whether it was ever true. An unattributed idea is not a licensing
problem, which is why it needs its own clause rather than a wider reading of
the one above — it is an **epistemic** one, and it fails silently.

```
AN ARTEFACT ASSERTING AN EXTERNALLY-SOURCED CLAIM EITHER CITES A HARVEST ID
OR LABELS THE STATEMENT AS OWN ANALYSIS. SILENCE IS NEITHER.
```

Fires when a skill, rule, command, guideline, or roadmap states a heuristic, a
number, or a mechanism taken from a source outside this repo. Two acceptable
discharges, and the choice is the author's:

1. **Cite** — append `<!-- harvest:<id> -->` and add the row to
   `provenance/harvests.jsonl` (shape: `provenance/README.md`). The row pins
   the source to a revision, or names it opaquely when
   [`source-confidentiality`](source-confidentiality.md) keeps it out of the
   tracked tree.
2. **Label** — say in the text that this is own analysis. A stated derivation
   is a complete discharge; the ledger exists for what came from elsewhere.

Only `adopt` and `adapt` findings produce a row. A rejected or already-present
finding has no artefact citing it and belongs in the analysis document.

**The prose carve-out below does not reach this section.** "Prose/docs-only
edits" excuses the *code* clauses, where there is no borrowed code to record;
prose is precisely where a harvested claim lands, so excluding it here would
empty the obligation of everything it applies to.

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
observes — so this rule ships `instruction-only`, same honesty stance as
`security-sensitive-stop` and `untrusted-input-defense`.

`lint_harvest_provenance.ts` stands in exactly the same relation to the
knowledge layer, and the sentence is worth repeating rather than assuming
transferred: it validates the harvest ledger's own rows and citations — schema,
uniqueness, pinning, dead rows, orphan ids — and **cannot see a claim nobody
recorded**. A harvested assertion that was never cited and never labelled
passes every gate in this repo. That is the honest coverage statement, and it
is why the discipline is the control on both layers.

## When NOT to fire

- A well-known, unpatentable algorithm shape (a hash map, a for-loop) with
  no specific source in mind.
- Reusing your **own** prior code within this repo.
- Prose/docs/config-only edits — **for the code clauses only**. The knowledge
  layer fires on exactly these surfaces; see its own note above.
- Common knowledge with no nameable source, on either layer. "Indexes speed up
  lookups" needs no row; a specific number, threshold, or mechanism read
  somewhere does.
- **A design artifact the user handed over** — a prototype, an exported
  `design.html`, a token sidecar. That is the user's own material, not
  third-party external code, so adapting its markup/CSS/JS is not a borrow and
  needs no ledger entry. Same carve-out
  [`content-quoting-floor`](content-quoting-floor.md) makes for user-owned text.
  **The carve-out is authorship, not delivery:** a vendored component or a
  licensed template that merely *arrives inside* a handover stays under this
  rule in full. Boundary stated from the other side in
  [`design-fidelity-mechanics`](../docs/guidelines/design-fidelity-mechanics.md)
  § Adopt the code.
  **It exempts the code clauses only.** A claim *about* the artifact's origin —
  that a pattern in it came from somewhere nameable — is a knowledge-layer
  statement and takes a harvest id or an own-analysis label like any other.

## See also

- [`license-compliance-borrow-check`](../skills/license-compliance-borrow-check/SKILL.md), [`license-compliance-credits`](../skills/license-compliance-credits/SKILL.md), [`license-compliance-audit`](../skills/license-compliance-audit/SKILL.md) — the borrowing / notices / on-demand-scan skill family this rule routes to.
- `provenance/README.md`, `src/scripts/lint_provenance.ts`, `src/scripts/detect_target_license.ts` — the code ledger, its linter, and the S1.2 policy derivation.
- `provenance/harvests.jsonl`, `src/scripts/lint_harvest_provenance.ts` — the knowledge ledger and its linter. Neither is `docs/CLAIMS.md` / `check_claims.ts`, which govern public claims this package makes about **itself**; the shared vocabulary is a grep hazard, so `provenance/README.md` states the three-way split.
- [`secret-vcs-guard`](secret-vcs-guard.md) — sibling detect → ask → act discipline for a different leak class.
- [`ask-when-uncertain`](ask-when-uncertain.md) — the escalation shape for `conditional`/`unknown` verdicts.
