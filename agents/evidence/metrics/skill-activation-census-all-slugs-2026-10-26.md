<!-- evidence-type: analysis -->

# Skill-activation census over every store slug of this repository — 2026-10-26

Owner answer to OQ-14 (2026-10-26): census first, then decide. This is
`road-to-a-run-that-knows-its-skills` step 1.1, read without `--emit`, so the
published record `agents/evidence/metrics/skill-activation-census.json` is untouched.

Command (from a worktree, every slug passed explicitly, no session limit):

```bash
a=(); for d in ~/.claude/projects/-Users-mathiasberg-projects-galawork-galawork-packages-event4u-agent-config*; do a+=(--store "$d"); done
./scripts-run src/scripts/report_skill_activation "${a[@]}" --limit 100000 --allow-empty-store
```

Population: the main checkout and every worktree slug of this repository — 11
stores. Scratchpad probe projects and bench clones that carry the repository
name are not this repository's sessions and are excluded.

```text
populations — the three ways a skill can be reached, reconciled
  machine-matchable trigger key        13
  evals/triggers.json corpus           176  (a test fixture; no host reads it at routing time)
  both of the above                    5
  human-named only (remainder)         117
  reconciles                           13 + 176 - 5 + 117 = 301 of 301

galawork-packages-event4u-agent-config sessions=115 asst= 69743 Skill calls= 42
aude-worktrees-agent-a7d833e5e4f7ac6eb sessions=  9 asst=    34 Skill calls=  2
aude-worktrees-agent-ab739a115dffed3e0 sessions=  2 asst=     5 Skill calls=  0
aude-worktrees-code-graph-auto-refresh sessions=  1 asst=  1702 Skill calls=  1
--claude-worktrees-decision-continuity sessions=  1 asst=     0 Skill calls=  0
onfig--claude-worktrees-fewer-blockers sessions=  1 asst=   525 Skill calls=  0
-claude-worktrees-fix-test-tmpdir-leak sessions=  1 asst=   397 Skill calls=  0
nt-config--claude-worktrees-hook-trust sessions=  1 asst=     2 Skill calls=  0
fig--claude-worktrees-inbox-2026-10-az sessions=  1 asst=  2301 Skill calls=  2
nt-config--claude-worktrees-step-depth sessions=  1 asst=  1941 Skill calls=  1
config--claude-worktrees-tdd-hardening sessions=  1 asst=     0 Skill calls=  0

invocations total                      48
distinct skills invoked                8 of 301 (2.7%)
```

Skills invoked: `agent-status`, `analyze:inbox`, `image-provider-routing`,
`plugin-authoring`, `roadmap:next`, `roadmap:process-full`,
`using-git-worktrees`, `worktree:create`. The count is of `Skill` tool calls; it
does not separate a call the user asked for by name from one the model chose.

Against the published record (2026-09-06: 30 sessions, 11,338 assistant turns,
0 invocations), this reading is larger on every axis and is not zero.
