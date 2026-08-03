---
complexity: lightweight
status: ready
parent: road-to-package-renewal.md
---

# Road to renewal — ADR hygiene (chip-mode)

> Sub-roadmap of [`road-to-package-renewal.md`](road-to-package-renewal.md).
> Council verdict: not a blocking track — chip items alongside other PRs.
> Kept as a roadmap (not a loose backlog) so the dashboard tracks drain-down.
> Kernel-rule edits stay under the slow-rollout guarantee (own PR, ≥24h soak).

## Phase 1 — dated-era dispositions

- [x] Batch-disposition the drive-loop era: ADR-068 + ADR-070–084 (16 ADRs,
      all 2026-06-08/09) encode a homegrown `claude -p` turn-loop workspace
      GUI — capabilities the host now provides natively (subagents, sessions,
      hooks, background tasks). One superseding record, statuses flipped,
      index regenerated — not 16 separate PRs — ADR-206 (decisions superseded,
      code explicitly frozen beta-internal per council safeguards); 16 flips +
      callouts, banners on `daily-workspace.md` + `host-agent-protocol.md`,
      freeze headers in the 6 workspace modules; ADR-069 excluded (shared
      primitive)
- [x] Amend ADR-085 for the post-Python world: its scope, rejected
      alternatives, and pre-approved Phase-2 flip path are framed around the
      retired Python kernel (`src/scripts/mcp_server/`, pipx/uvx) and are
      impossible as written — council escalated amend → full supersede
      (unanimous): ADR-207 restates A2×B1 on Node-only grounds, ADR-085
      flipped superseded; stale Python text in `taskfiles/mcp.yml` +
      `docs/contracts/adr-mcp-runtime.md` corrected alongside
- [x] Disposition the 6 perma-proposed ADRs (status `proposed`, 1.6–2.7 months
      old: ADR-008/010/055/057/067/101): accept, reject, or supersede each —
      no third state — 5 accepted (008/010/055/057/101, each de-facto
      implemented with evidence cited in the Status prose), 067 superseded by
      ADR-111 with an external-publication note (stale `.venv-mcp` quick-start
      sources corrected in-repo; Glama refreshes on re-crawl)
- [x] Fix INDEX.md staleness/self-misdescription and regenerate via
      `src/scripts/adr/regenerate_index.ts` — header no longer names the
      retired `.py` generator (renderer + pinned test updated), stale ADR-054
      `proposed` row corrected by regen (now 0 proposed / 23 superseded);
      stale `.py` refs in `docs/contracts/adr-layout.md` + wrong `--check`
      exit-code claim in `adr-create` skill fixed alongside

## Phase 2 — structural decisions with new evidence

- [x] Decide the ADR-201 open question and record it: `dist/agent-src/` is now
      a byte-identical path-rewritten copy of `src/` — write the deciding ADR
      (collapse vs keep-forever, with reason). Chip-sized: the decision only —
      ADR-208: KEEP forever (council-converged; installer/npm anchoring,
      byte-gate removed the drift risk, deployment-observable review_trigger);
      ADR-201 § Open question carries the resolution pointer
- [-] If collapse is decided: execute the tree collapse (installer + symlink
      retarget to `src/`, consumer-facing) as its OWN full-size PR —
      explicitly EXCLUDED from chip-mode <!-- skipped: not applicable — ADR-208
      decided KEEP-forever, there is no collapse to execute -->
- [x] Reconcile the router linter contract: 41 of 97 non-kernel router entries
      have empty `routes_to` — enforce ≥1 or amend `rule-router.md` to name
      the body-carrying rule class explicitly — ADR-210: contract amended
      ("≥1 unless self-contained"), explicit `self_contained: true` marker
      (schema + linter; replaces the dead `trust.level: core` carve-out,
      missing-both escalated info → error), 40 rules certified with per-rule
      rationale appendix, 2 mechanical routes fixed (code-comment-discipline,
      untrusted-input-defense), false `triggered_by` contract promise removed;
      router recompiled, linter 430 pass/0 fail, linter tests 135/135
- [x] Retrofit `review_trigger` on the ~10 most load-bearing pre-2026-07-25
      ADRs with demonstrably time-bound premises (narrow retrofit; the blanket
      retrofit stays rejected per ADR-127 § Alternatives) — 11 retrofitted
      (027/029/031/032/033/035/037/039 replace dead `review_date`; 044/051/112
      new), ADR-028's dead `review_date` dropped; 090/092 excluded (trigger
      owned by ADR-137); `check_adr_frontmatter` green

## Phase 3 — dead-tree endgame (after Foundation Phase 1 drains the gates)

- [x] Sweep the remaining non-gate `.agent-src.uncondensed/` references in
      `src/` (164 files at analysis time; Foundation Phase 1 removes the
      executable gate class first) — docs/comments batch-rewritten to the
      `src/` truth — 53 files rewritten (362 → 258 mentions), every target
      existence-verified; retained classes: detector needles, executable
      path-construction, `validator_ignore` data, forbidden-pattern docs,
      historical narration. Finding: `data/low-impact-decisions-seed.md` is
      referenced by `learn-low-impact` command + privacy-floor rule but does
      not exist — left as-is, needs an owner decision (follow-up, not chip)
- [x] Retire the ADR-030 "temporary" dual projection once the Foundation
      command-dedup lands (146 command-as-skill symlinks still ship through
      the plugin per ADR-089) — done documentary via ADR-209: ADR-030
      Decision-2 carve-out retired (partial supersede, paren-annotated),
      ADR-089 fully superseded. Step premise was stale: the plugin has been a
      1-pointer-skill shim since 2026-07-08 (0 symlinks), and #1117's dedup
      left only the 47 ADR-044 flat-command wrappers — no code change needed,
      consumer surface untouched

## Blockers

### blocker: kernel-router-value-rebaseline

- **Status:** gated
- **Owner:** maintainer
- **Blocks:** nothing (optional input to Foundation Phase 3's go/no-go if
  landed; that gate does not wait on it)
- **What to do:** run a `bench_ab_v2_run` comparison on current frontier
  hosts with the pre-registered comparison + recorded artifact named up
  front. The locked numbers are stale or unbacked (docs/CLAIMS.md
  vocabulary). Mechanism-match note: this is a DIFFERENT measurement from
  the TERMINAL activation red-baseline null (value-of-loading bench, not
  adherence adjudication) — it does not re-run that null.
- **Resolved when:** the maintainer authorizes the bench spend and the
  recorded artifact lands.
