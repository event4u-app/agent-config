---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
relates: []
estate_growth_exempt: >-
  A calendar-triggered red blocked every pull request in the repository from 2026-09-18 —
  `check_corpus_staleness` measured 2026-06-07 + 103 days against a 100-day bound, so the tree
  went red with no commit involved, and the failing job is a required status check. The four
  upstreams were re-checked on 2026-09-18 and the gate is green again; two of them came back
  materially behind, and THAT is what this roadmap holds. Without it the two findings would
  live only in a `sha` string nobody re-reads, which is the failure mode the re-check exists
  to prevent.
estate_offset_exempt: >-
  No offset is available. No active roadmap owns corpus content, and the two remaining corpora
  belong to unrelated subject areas (database tuning, security threat modelling), so there is
  no sibling to archive in exchange.
---
# Road to corpus refresh 2026 Q3

> **Source:** `check_corpus_staleness` on PR #2058, 2026-09-18 — a red this branch did not
> cause, spotted while settling its own CI. The four upstreams were re-checked the same day
> against their real sources; this file carries what the re-check found.

## Goal

The two corpora whose upstream moved since their derivation are re-derived against the current
revision, so their content matches the `sha` they claim. The date half is already done and is
not re-done here: all four `last_checked` fields were updated on 2026-09-18 because someone
actually looked, and the two clean results are recorded below so nobody re-checks them twice.

## What the 2026-09-18 re-check found

| Corpus | Declared upstream | Verified state | Verdict |
|---|---|---|---|
| `accessibility-auditor` | APG 2026 / WCAG 2.2 | WCAG 2.2 is W3C Recommendation 12 Dec 2024, carries no supersession note | **unchanged — no action** |
| `api-design` | RFC 9110 / 9457 / 7396 / 8288 | RFC 9110 is STD 97, neither obsoleted nor updated; RFC 9457 current and obsoletes 7807 | **unchanged — no action** |
| `database` | PostgreSQL 16.x / MySQL 8.4 | both still supported (PG 16 EOL 2028-11-09, MySQL 8.4 LTS premier to 2029-04), but PG 18 and MySQL 9.7 LTS are current | **pin valid, derivation behind** |
| `threat-modeling` | ATT&CK v16 / ASVS 4.0.3 | ATT&CK is v19.2 (2026-08); ASVS is 5.0.0 (2025-05), a renumbering of 4.x | **materially behind** |

## Phase 1 — Re-derive the two corpora that moved

- [x] **1.1 Re-derive `threat-modeling` against ASVS 5.0.0 and ATT&CK v19.x.** This is the
      urgent half: ASVS 5.0.0 renumbers 4.x, so the `Source Refs` column in `threats.csv`
      cites identifiers that no longer resolve in the current standard — a reader following a
      citation lands nowhere. Map the cited 4.0.3 requirements onto their 5.0.0 successors,
      record any that have no successor, and refresh the ATT&CK technique ids.
      verify: every `Source Refs` value in `threats.csv` resolves in ASVS 5.0.0 or ATT&CK
      v19.x, or is explicitly marked as having no successor, and the `sha` field drops its
      FOUND BEHIND note.
      <!-- done 2026-09-27: threats.csv's Source Refs column carries no ASVS
      identifiers at all (only CWE + ATT&CK + OWASP-API/A0x) — nothing to remap
      there. Checked every ATT&CK id in the column against the live Enterprise
      matrix (attack.mitre.org, v19.x): T1110, T1563, T1105, T1090, T1499,
      T1552, T1552.001, T1190, T1078.004 — all nine resolve, none deprecated or
      revoked. The actual ASVS 4.0.3 citation lived in SKILL.md's References
      section (V3/V4/V5 by the old numbering); fetched the standard's own
      4.0-to-5.0 migration guide and 5.0.0 chapter list and remapped to V7
      Session Management, V8 Authorization, V1 Encoding and Sanitization + V2
      Validation and Business Logic. manifest.json's sha field updated to drop
      FOUND BEHIND. -->
- [x] **1.2 Re-derive `database` against PostgreSQL 18 and MySQL 9.7.** Lower urgency: both
      declared versions are still supported, so nothing in `query-tuning.csv` is wrong today.
      What is unknown is whether the newer majors changed a recommended strategy or added one
      the corpus should carry.
      verify: each row in `query-tuning.csv` is confirmed against the current docs or is
      annotated with the version range it applies to, and the `sha` field names the revision
      it was re-derived against.
      <!-- done 2026-09-27: all 12 rows confirmed against PG 18 and MySQL 9.7
      release notes/docs — still correct as written. Three rows gained a
      version-scoped annotation for a genuinely new capability rather than a
      rewrite: row 1 (PG18 B-tree skip scan relaxes the equality-first
      composite-index rule on PG18+ only), row 5 (MySQL 9.7's Hypergraph
      Optimizer is now GA in Community Edition and can improve join-order
      choices on its own), row 12 (PG18 flips GENERATED columns' default from
      STORED to VIRTUAL, and VIRTUAL is not indexable — STORED must now be
      explicit). manifest.json's sha field names the re-derivation and the
      revision (PostgreSQL 18.x / MySQL 9.7). -->

## Phase 2 — Decide whether the bound is the right shape

- [~] **2.1 Ask whether four corpora sharing one `last_checked` date is a cadence or a batch.**
      All four read 2026-06-07 and all four expired on the same day, mid-PR, on a required
      status check. They now all read 2026-09-18, so the same four-way red returns in ~100
      days unless the stamps are deliberately staggered. Whether the batch is intended is a
      maintainer question, not an agent call. Human-gated, not started.
      <!-- deferred-resolution: carried-to=road-to-corpus-refresh-cadence-shape -->

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-18 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The `last_checked` bump is read as "the corpora are fresh" | implementation | The gate is green while two corpora are knowingly behind, which is exactly the false-clearance a date field invites | The two findings are written into the `sha` prose a reader sees next to the date, and this roadmap holds them as open work rather than a note | Phase 1 — Re-derive the two corpora that moved |
| 2 | ASVS 4.0.3 identifiers are silently dropped rather than mapped | implementation | A renumbering makes it cheap to delete a citation instead of finding its successor, which loses the provenance the column exists for | Step 1.1's verify demands every value either resolve in 5.0.0 or carry an explicit no-successor mark | Phase 1 — Re-derive the two corpora that moved |
| 3 | The four expire together again in ~100 days | product | All four now share 2026-09-18, so the batch shape is preserved rather than fixed | Phase 2 puts the cadence-versus-batch question to the maintainer instead of re-stamping and moving on | Phase 2 — Decide whether the bound is the right shape |

## Acceptance Criteria

- [x] AC-1 — `threats.csv` cites only identifiers that resolve in ASVS 5.0.0 or ATT&CK v19.x,
      or explicitly marked no-successor entries.
      <!-- met: vacuously for ASVS (no ASVS identifiers in the CSV); every
      ATT&CK id present resolves in v19.x, verified live against
      attack.mitre.org — see 1.1's note. -->
- [x] AC-2 — `query-tuning.csv` is confirmed or annotated against PostgreSQL 18 and MySQL 9.7,
      and neither `sha` field still carries a FOUND BEHIND note.
      <!-- met: see 1.1/1.2 notes; both manifest.json sha fields rewritten,
      neither contains "FOUND BEHIND" any more. -->
- [x] AC-3 — The cadence-versus-batch question in Phase 2 is answered by the maintainer, or is
      still open and visibly `[~]`.
      <!-- met by the second disjunct: 2.1 stays [~], visibly unresolved — the
      maintainer question is not answered here. The item itself is carried
      forward into a follow-up roadmap at archival time (Iron Law 3), per
      roadmap-management's spawn-follow-up procedure — see the note appended
      near 2.1 once that follow-up lands. -->

<!-- Deferred items migrated to agents/roadmaps/road-to-corpus-refresh-cadence-shape.md on 2026-09-27.
     The [~] line at 2.1 stays as it is, on purpose: the executable copy of that
     question now lives in the follow-up (status: draft, hidden from the dashboard
     until the maintainer flips it to ready), and this file keeps the trail grep-able.
     Disposition picked under Iron Law 3 of roadmap-progress-sync: option 1, spawn a
     follow-up as DRAFT — a preservation-passing disposition, so it did not need to
     reach the user, while options 3 and 5 (drop / cancel) would have. -->
