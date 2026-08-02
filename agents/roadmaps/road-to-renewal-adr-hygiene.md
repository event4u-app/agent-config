---
complexity: simple
status: ready
parent: road-to-package-renewal.md
---

# Road to renewal — ADR hygiene (chip-mode)

> Sub-roadmap of [`road-to-package-renewal.md`](road-to-package-renewal.md).
> Council verdict: not a blocking track — chip items alongside other PRs.
> Kept as a roadmap (not a loose backlog) so the dashboard tracks drain-down.
> Kernel-rule edits stay under the slow-rollout guarantee (own PR, ≥24h soak).

## Phase 1 — dated-era dispositions

- [ ] Batch-disposition the drive-loop era: ADR-068 + ADR-070–084 (16 ADRs,
      all 2026-06-08/09) encode a homegrown `claude -p` turn-loop workspace
      GUI — capabilities the host now provides natively (subagents, sessions,
      hooks, background tasks). One superseding record, statuses flipped,
      index regenerated — not 16 separate PRs
- [ ] Amend ADR-085 for the post-Python world: its scope, rejected
      alternatives, and pre-approved Phase-2 flip path are framed around the
      retired Python kernel (`src/scripts/mcp_server/`, pipx/uvx) and are
      impossible as written
- [ ] Disposition the 6 perma-proposed ADRs (status `proposed` for 2.5+
      months): accept, reject, or supersede each — no third state
- [ ] Fix INDEX.md staleness/self-misdescription and regenerate via
      `scripts/adr/regenerate_index.ts`

## Phase 2 — structural decisions with new evidence

- [ ] Decide the ADR-201 open question: `dist/agent-src/` is now a
      byte-identical path-rewritten copy of `src/` — either collapse the
      duplicated tree (installer + symlinks retarget to src/) or record a
      keep-forever ADR with the reason; today's state is an undecided
      duplication every consumer ships
- [ ] Reconcile the router linter contract: 41 of 97 non-kernel router entries
      have empty `routes_to` — enforce ≥1 or amend `rule-router.md` to name
      the body-carrying rule class explicitly
- [ ] Re-baseline the kernel/router value claim on current frontier hosts
      (locked numbers are stale or were later shown fabricated); outcome feeds
      Foundation Phase 3's go/no-go context, not a new mechanism
- [ ] Retrofit `review_trigger` on the ~10 most load-bearing pre-2026-07-25
      ADRs with demonstrably time-bound premises (narrow retrofit; the blanket
      retrofit stays rejected per ADR-127 § Alternatives)

## Phase 3 — dead-tree endgame (after Foundation Phase 1 drains the gates)

- [ ] Sweep the remaining non-gate `.agent-src.uncondensed/` references in
      `src/` (164 files at analysis time; Foundation Phase 1 removes the
      executable gate class first) — docs/comments batch-rewritten to the
      `src/` truth
- [ ] Retire the ADR-030 "temporary" dual projection once the Foundation
      command-dedup lands (146 command-as-skill symlinks still ship through
      the plugin per ADR-089)
