---
complexity: lightweight
review_by: 2027-03-31
---

# Stub: re-measure who answers the owner's questions

> **Stub — not active work.** Filed by `road-to-questions-that-reach-the-right-decider`
> (step 4.3) under template rule 17c: the re-measurement needs elapsed owner
> sessions, not effort, so it is a stub rather than an open step.

## Trigger 1 — the decision-asks census

**Trigger:** 30 interactive owner sessions after the change that narrowed
`high_impact` to the owner's classes (D6 of the parent roadmap) is in `main`.

**What to run:** the same census command, over the same stores, into a new
file. Pass one `--store` per profile under `~/.agent-switch/claude/*/config/projects`
plus `~/.claude/projects`; the baseline's `Command` row lists the exact set.

```bash
./scripts-run src/scripts/probe_unblocked_ask --all-asks \
  --store ~/.agent-switch/claude/<profile>/config/projects --store ~/.claude/projects \
  --sample 60 --seed 20261121 --write
```

**What it settles:** the share of owner-reaching asks answered
`confirmed-recommendation`, compared with the baseline artefact
`agents/evidence/analysis/decision-asks-census-2026-11-21.md` (403 of 1,163).
A share that does not fall says the cascade is not reaching the sessions that
ask; a share that falls says fewer asks the owner only confirms reach the owner.

## Trigger 2 — owner attributions without a source

**Trigger:** 30 interactive owner sessions after the provenance line (floor
line 7 and the "Who answers a question" section) is in `main`.

**What to run:** `probe_owner_attribution` over the same stores into a new file,
never over the baseline:

```bash
./scripts-run src/scripts/probe_owner_attribution \
  --store ~/.agent-switch/claude/<profile>/config/projects --store ~/.claude/projects \
  --write agents/evidence/analysis/owner-attribution-remeasure-<date>.json
```

**What it settles:** `counts.unsourced` per 100 `assistant_turns`, and
`counts.fabricated_quote` (a subset of `unsourced`) per 100, against the
baseline `agents/evidence/analysis/owner-attribution-baseline.json`
(251 unsourced, 97 of them fabricated-quote, over 48,387 assistant turns).
