---
stability: draft
keep-draft-until: first-skill-ships
owner: road-to-analysis-workbench
---

# Analysis Memory Loop — produce → propose → promote → retrieve

> **Status:** draft · **Owner:** road-to-analysis-workbench
> · **Governed by:** `src/rules/non-destructive-by-default.md`,
> `src/rules/domain-safety-disclaimer.md`

Contract for the closed learning loop in the `analysis-workbench` pack.
Binds all analysis skills: `blameless-post-mortem`, `root-cause-frameworks`,
`premortem`, `decision-review`.

---

## § 1 — Produce: what analysis flows draft

Post-mortem, RCA, decision-review, and near-miss flows MUST draft
`incident-learnings` and `historical-patterns` **candidates** into the
`/memory propose` provisional JSONL intake stream.

Candidates are produced; they are **never auto-promoted** to curated memory.
The human drives promotion. An analysis skill that skips the draft step or
claims self-promotion violates this contract.

### Candidate schema (minimum)

```jsonc
{
  "type":               "incident-learnings" | "historical-patterns",
  "summary":            "one-line human-readable pattern",
  "evidence_paths":     ["path/to/file", "path/to/other"],
  "decision_surface":   ["area1", "area2"],
  "last_validated":     "YYYY-MM-DD",
  "review_after_days":  90,
  "applicable_scope":   "project" | "domain" | "global"
}
```

`last_validated` defaults to today. `review_after_days` defaults to 90.
`applicable_scope` defaults to `"project"`.

---

## § 2 — Propose: intake and dedup pre-check

Before drafting a **new** candidate, each skill calls `retrieve()` over the
same key-space (incident type, affected paths, decision area).

- **Match found** — propose a `frequency`/`supersedes` **update** to the
  existing entry, not a new entry. The proposal notes which existing entry is
  being reinforced or superseded.
- **No match** — draft a new candidate as described in § 1.

This dedup check is not optional. A skill that skips it and produces a
duplicate candidate fails the loop contract.

---

## § 3 — Promote: the admission gate

`/memory promote` runs `scripts/check_memory_proposal.py`.

**Admission criteria** (unchanged from the existing gate):

- `≥ 2 distinct file paths` referenced in `evidence_paths`, OR
- `≥ 3 future decisions` the pattern would change (listed in
  `decision_surface`).

Failing either criterion → proposal stays provisional; skill surfaces the
gap to the user and suggests either deferring or strengthening evidence.

The agent NEVER overrides or bypasses this gate. Redaction is enforced by
`check_memory.py` (no customer names, secrets, internal IPs, project-rooted
paths) before any entry is promoted.

---

## § 4 — Retrieve: staleness is explicit

`retrieve()` returns:

```jsonc
{
  "results": [...],
  "skipped": [
    {
      "id":      "...",
      "reason":  "stale",
      "details": "last_validated=YYYY-MM-DD, review_after_days=90"
    }
  ]
}
```

Stale entries (age > `review_after_days`) appear in `skipped`, NOT in
`results`. A skill that silently uses stale entries (ignores `skipped`)
violates this contract. Stale matches MUST be surfaced to the user.

---

## § 5 — Handoff: incident-commander → blameless-post-mortem

`incident-commander` produces a handoff skeleton. That skeleton **may carry
an empty or TBD root cause** — incomplete evidence at incident close is
normal.

`blameless-post-mortem`:

1. **Accepts** any incoming skeleton, complete or not.
2. Invokes `root-cause-frameworks` to fill gaps; `root-cause-frameworks`
   returns ranked candidates with confidence levels, not a forced verdict.
3. Marks the post-mortem `status: draft` if root cause remains unresolved
   after the analysis pass.
4. NEVER rejects or stalls on an incomplete skeleton.

A post-mortem marked `draft` can still produce `incident-learnings`
candidates (`summary` must note the open question).

---

## § 6 — Framework-neutrality scope

The `framework-neutrality-in-generic-skills` rule governs **tech-stack names**
(Laravel, React, Django). It does **not** govern analysis method names.

5-whys, fishbone, fault-tree, STAMP/STPA, and similar are method names used
generically across analysis skills. Using them in a skill named
`root-cause-frameworks` is not a framework-neutrality violation.

---

## § 7 — What this contract does NOT cover

- The schema of curated memory entries (governed by `low-impact-corpus-format.md`).
- The internal mechanics of `check_memory_proposal.py` (lives in `src/scripts/`).
- AI-specific RCA (deferred; gated on `road-to-security-hardening`).

---

## See also

- [`low-impact-corpus-format.md`](low-impact-corpus-format.md) — curated memory schema.
- [`ADR-096`](../decisions/ADR-096-analysis-workbench.md) — council decisions behind this contract.
- `src/skills/blameless-post-mortem/SKILL.md` — primary consumer (Phase 2).
- `src/skills/root-cause-frameworks/SKILL.md` — RCA engine (Phase 2).
