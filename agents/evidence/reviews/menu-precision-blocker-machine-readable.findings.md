# Findings: menu-precision-blocker-machine-readable

**Skipped:** no code surface for this completion — the diff changes exactly one file, the roadmap `agents/roadmaps/road-to-a-menu-whose-precision-is-measured.md`, and no executable path: it promotes an already-open obstacle out of step 3.1 prose into a parsed `## Blockers` entry, marks 3.1 and AC-4 with the inline `blocked-by:` annotation, claims the resulting `open_blockers` 39 -> 40 as a census correction, and re-reviews the risk register that the Acceptance-Criteria edit made stale, scope 11199ee1d1c339ff7cef4978deddbff36ee7d0cc28a5b16b7ed8fd3e34213828, declared 2026-09-30

**Why a skip and not a findings table.** The branch-scoped name list returns one
path and it is markdown under `agents/roadmaps/`. There is no behaviour to
review: no script, no test, no config, no projected surface. The verification
this change rests on is deterministic and was run rather than asserted —
`lint_roadmap_blockers` (138 files blocker-contract-clean, decidability 0),
`lint_plan_risk_register` (17 ready roadmaps clean), `check_estate_count`
(within its ratchet, growth claimed and read back in the output),
`check_references` (no broken references), `check_md_language` (no German
content), and `roadmap:progress`, whose blocker column for this roadmap moves
from `0` to `1`. That last one is the actual proof the change works, because the
defect being repaired was precisely that the column read `0` while the roadmap
carried a live blocker.

**The sibling artifact is not superseded by this one.**
`menu-precision.findings.md` records the R2 round over scope `775a1a32…`, the
Phase 1 / 2 / 4 implementation branch. Its findings 14 and 15 are still open and
still deferred to this roadmap; nothing here touches the readers they name. Two
artifacts now sit in this directory for related branches, which is the
contract's normal state — the gate matches on scope hash, not on filename.

**One thing a reader should check rather than take on trust.** The claim that
this blocker is real, rather than prose inherited from a previous run, was
re-established live on this branch:

```text
$ ./scripts-run src/scripts/report_host_injection_effect
scanned: 9 host(s)
  observed-false   1
  unobserved       8
```

Zero `observed-true` rows, so the blocker's `Resolved when` is unmet as a
measurement and not as a recollection.
