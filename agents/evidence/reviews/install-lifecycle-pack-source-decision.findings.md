# Completion review — install-lifecycle org-pack source-root decision

**Skipped:** no code surface for this completion — the diff is five documentation files with zero code paths: a roadmap step and its blocker resolution, a decision section appended to an existing context brief, the archival rename of the completed roadmap, three relative links re-depthed by that rename, and the regenerated roadmap dashboard, scope 8afe41f50886feae55e58bdd388d7894604de82fa60f3ca7cc76e21fd197ff9f, declared 2026-08-11

## What the skip rests on

The completion is a **decision**, not an implementation. Its whole content is
that the external pack source root does not open — so ADR-011 stands, no ADR is
commissioned, ADR-013 § packs is unamended, and the closed pack-id vocabulary in
`src/config/discovery/packs.yml` is untouched. A decline changes no executable
surface by construction; only a reopening would have been a contract change, and
that is the branch that was not taken.

Nothing under `src/`, `tests/`, `dist/` or `.github/` is touched. The generated
host projections (`.augment/`, `.claude/`, `.cursor/`, `.clinerules/`,
`.windsurfrules`) were regenerated locally only to seed a fresh worktree so the
gates could run against the shape CI runs; they are gitignored and carry no
commit.

## What was verified rather than asserted

- `check_md_language`, `lint_roadmap_blockers`, `check_roadmap_trackable`,
  `lint_empty_roadmaps`, `lint_roadmap_complexity`, `lint_roadmap_family_cap`,
  `check_no_roadmap_refs`, `check_references` — all exit 0.
- `roadmap:progress-check` reports the dashboard up to date.
- `check_branch_freshness` reports the branch current with `origin/main`.
- The three links the archival rename broke were each re-resolved from
  `agents/roadmaps/archive/` before the fix was committed, not assumed.

## Known debt this completion surfaced but deliberately did not fix

The archival sweep moves a roadmap one directory deeper without re-depthing its
relative links, and `check_references` excludes `agents/roadmaps/`, so nothing
catches the result. Measured across the archive: **147 of 466 archived roadmaps
carry 530 dead relative links.** Only the three this rename caused are fixed
here; the rest is pre-existing debt far past the bounded-remediation bar and is
reported for a follow-up rather than swept into a decision PR.
