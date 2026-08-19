# Single-delivery census — the two layers, measured on a known projection shape

> **Evidence artefact.** Written 2026-08-19 for `road-to-single-delivery` Phase 0.
> Machine-local reading; re-run rather than cite. Every figure carries the command
> that produced it.

## REQUIRED FIELD — the projection shape this census was taken on

```
projection:            EMITTED REAL FILES (post-PR-#1231)
project rule files:    111 real files, 0 symlinks
of those carrying paths:  8
regenerated with:      task sync && task generate-tools
worktree HEAD:         b490f3845
host:                  claude, macOS, single machine
```

**This field is mandatory and it is the point of the artefact.** Its absence is
what produced two refuted drafts (§ The refutation). A census of these two layers
is *not interpretable* without it, because the same commit classifies differently
depending on which generation of the emitter wrote the project tree:

- **pre-#1231** — the project layer is a *symlink* tree into `dist/agent-src/rules/`,
  so against installed global copies the only difference is the install stamp, and
  `paths:` disagreements are structurally invisible (count 0 for the wrong reason).
- **post-#1231** — the project layer is *emitted real files* carrying `paths:`, so
  the same pairs read as frontmatter-divergent.

A number from another checkout is not comparable to one here.
`report_carrier_divergence` states this limitation in its own output.

## Per-type overlap

```
ls ~/.claude/<type> | sort > g ; ls .claude/<type> | sort > p ; comm -12 g p
```

| type | global `~/.claude/` | project `.claude/` | global-only | project-only | **in BOTH** |
|---|---:|---:|---:|---:|---:|
| rules | 115 | 111 | 5 | 1 | **110** |
| skills | 298 | 338 | 8 | 48 | **290** |
| commands | 93 | 40 | 53 | 0 | **40** |
| agents | 0 | 1 | 0 | 1 | 0 |

**Total delivered twice: 440 names.** The commands row is a **correction to this
artefact's first version**, and it is worth stating how it was wrong: the first
reading was taken in the stale main checkout, where no commands were projected at
all, so the row read `93 / 0 / 0` and commands looked clean. `check_single_delivery`
— written afterwards for Phase 4, against a freshly regenerated worktree — reported
40 in both on its very first run. So a third artefact type was duplicated and three
of the four inbox drafts plus the first version of this census all missed it, for
the same reason the rules figures were wrong: the projection shape.

`agents` is the one type with a genuinely absent layer (`~/.claude/agents` does not
exist), which is reported as `absent` rather than as `0` — the two are different
facts.

- **global-only rules (5):** `analysis-skill-routing`, `brand-consistency`,
  `guidelines`, `package-ci-checks`, `size-enforcement`.
- **project-only rule (1):** `source-of-truth` — `workspaces:
  [agent-config-maintainer]`, the asymmetry ADR-226 rests on. Confirmed present.

## Cost

```
./scripts-run src/scripts/check_standing_rule_delivery
```

```
global    115 file(s)   114361 tok
project   111 file(s)    89512 tok
overlap   110 rule(s) in both layers (0 duplicate, 110 divergent)
TOTAL          203873 tok / 110000 cap (185.3%)
```

Standing prose and the skill catalogue are **different buckets** and are not
added together. Catalogue side, measured on the stale tree and reported as a
proxy: the duplicated skills carried 57,668 bytes of `name:` + `description:`,
≈ 16,018 tok at chars/3.6. Re-measure on the fresh tree before citing — the
duplicate count moved from 261 to 290.

## Divergence breakdown

```
./scripts-run src/scripts/report_carrier_divergence
```

```
shared rule names                    110
  byte-identical                       0
  differ ONLY in the install stamp     0
  differ ONLY in frontmatter         110
    of which disagree on `paths:`      7   <- ACTIONABLE
  differ in PROSE                      0
present at project scope only          1
present at global scope only           5
```

**Prose divergence is 0 and that does not make suppression safe.** The tool's own
output names the mechanism for the 7: *a copy that lacks `paths:` DEFEATS the
other copy's scoping.*

### The 7 `paths:`-disagreement rules, by name

Project carries `paths:`, global does not, in all seven cases:

| rule | exclusively package-only? | under the partition |
|---|---|---|
| `design-review-after-ui-write` | no | global-only → unscoped, survives `/compact` |
| `roadmap-progress-sync` | no | global-only → unscoped, survives `/compact` |
| `ui-audit-gate` | no | global-only → unscoped, survives `/compact` |
| `no-roadmap-references` | **yes** | project-only → path-scoped, **stops surviving `/compact`** |
| `rule-type-governance` | **yes** | project-only → path-scoped, **stops surviving `/compact`** |
| `skill-quality` | **yes** | project-only → path-scoped, **stops surviving `/compact`** |
| `source-confidentiality` | **yes** | project-only → path-scoped, **stops surviving `/compact`** |

ADR-227:79-80: *path-scoped rules are not re-injected after `/compact`, so an
obligation that must survive compaction cannot be path-scoped at all.* The
unscoped global twin is therefore **accidentally preserving compaction survival**
today. The partition narrows the problem from 7 rules to 4; those 4 are the
`compact-survival-of-package-only-rules` blocker.

## The partition, read off `workspaces:`

No new metadata is required — the field that already governs consumer delivery
decides the layer:

| | exclusively `[agent-config-maintainer]` → project | everything else → global |
|---|---:|---:|
| rules (117 in `src/rules/`) | **16** | 101 |
| skills (290 in `src/skills/`) | **0** | 290 |

The 16: `augment-edit-discipline`, `domain-adoption-policy`,
`framework-neutrality-in-generic-skills`, `low-impact-corpus-privacy-floor`,
`no-roadmap-references`, `package-ci-checks`, `persona-governance`,
`preservation-guard`, `rule-type-governance`, `size-enforcement`, `skill-quality`,
`source-confidentiality`, `source-of-truth`, `telegraph-speak`, plus two more.

**Zero package-only skills is a finding, not a parse failure.** It means the
project layer's `.claude/skills/` can be empty and all 290 duplicate catalogue
entries disappear in one move.

Measured with a frontmatter parse that distinguishes `workspaces:
[agent-config-maintainer]` **alone** from a list that merely contains it — a bare
`grep -l agent-config-maintainer` over `src/rules/` reports **73**, which
over-counts by matching prose and multi-workspace declarations. The 73 is recorded
here because it is the number a casual probe returns.

## The gate that should have caught the stale tree, and did not

```
./scripts-run src/scripts/check_rule_projection_integrity
```

```
⚠️  check_rule_projection_integrity: no host rule tree is active
    (agents/.agent-tools.yml selects zero tools) — nothing to audit.
    This gate has teeth only where a tool is active; CI activates all eight.
```

The gate exists for "stale tree on a developer's working checkout" and is ordered
first in preflight for that reason. On the maintainer machine it is **inert**,
because the local tool selection is empty — so the 5-July symlink tree that
produced two refuted drafts was invisible to it. **The hole is local-only:** CI
activates all eight tools, so a PR is covered. Recorded rather than fixed, per
Phase 0.2.

## The refutation — why the projection shape is a required field

Two of the four inbox drafts measured the stale tree. Same checkout, same commit,
before and after `task sync && task generate-tools`:

| | stale (92 symlinks, 5 July, 0 `paths:`) | **fresh (111 emitted, 8 `paths:`)** |
|---|---:|---:|
| rules in both | 91 | **110** |
| rules global-only | 24 | **5** |
| skills in both | 261 | **290** |
| shared PROSE-divergent | 0 | **0** |
| shared FRONTMATTER-divergent | 0 | **110** |
| of those `paths:`-disagreeing | 0 | **7** |
| standing total | 195,383 tok (177.6 %) | **203,873 tok (185.3 %)** |

Three conclusions the stale reading got wrong:

1. **"24 global-only live obligations"** — actually 5, and none is a safety floor.
   The stale list named `secret-vcs-guard`, `session-canary`, `self-repair-loop`
   and others that are in **both** layers on a fresh tree.
2. **"The duplication is bounded at 91/261"** — it is 110/290. The defect survived
   its own draft's refutation and got larger.
3. **"`install --layer` would not refuse today"** — it refuses over divergence,
   and a fresh tree is 110-way divergent. The remedy the tooling prints in its own
   error message is unavailable here.

What survived the refutation unchanged: the two-producer diagnosis (`scope_guard`
classifies by drift risk not cost; `generate-tools` has no overlap gate at all),
the gate-coverage audit, and the existence of the skills half.

## Honest limits

- Single machine, single host, one date. `later/` and consumer topologies are not
  measured here.
- The catalogue token figure is a chars/3.6 **proxy** and was taken on the stale
  tree; the standing-prose figures are exact BPE.
- No claim is made that removing duplication lifts the host's catalogue
  truncation. That question belongs to `road-to-release-review-p0`, which owns
  host catalogue behaviour.
