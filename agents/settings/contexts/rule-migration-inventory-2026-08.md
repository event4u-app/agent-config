# Rule body-migration inventory (measured 2026-08-06)

> The real set behind Phase 3 of `road-to-skill-ecosystem-authoring-discipline`,
> so the ledger is built over what exists rather than over a guess. Measured at
> `origin/main` `e6ef47863`. Cite this file; the roadmap's prerequisite step
> points here.

## The headline numbers

| Fact | Roadmap said | Measured |
|---|---|---|
| Rules carrying a body-migration line | "roughly thirty" | **44** of 111 (40 %) |
| Migration target references | — | **45** (one rule carries two) |
| Targets that do not resolve | — | **0** |
| Pre-migration bodies recoverable | unknown | **39 recoverable · 1 partial · 4 never existed** |

## Five things that change how Phase 3 must be built

### 1. `git log --follow` does not reach the migration commit for 24 of the 44

The prerequisite's prescribed check terminates their lineage at a 2026-05-18
merge where each file appears as an **add** already carrying the migration line.
Anyone running only that command concludes those 24 were born thin. They were
not — the real migration commits are `d4fe80e1c` (2026-05-06, 20 rules) and
`2a11c70b2` (2026-05-14, 4 rules), reachable only by searching all refs:

```
git log --reverse -S'igrated to' --all -- "*rules/<stem>.md" \
    ":(exclude)dist/*" ":(exclude).agent-src/*"
```

### 2. Twenty pre-migration bodies exist ONLY on unmerged side branches

```
git merge-base --is-ancestor d4fe80e1c HEAD   → NO
git merge-base --is-ancestor 2a11c70b2 HEAD   → NO
```

`d4fe80e1c` is contained in 31 `origin/*` branches and `2a11c70b2` in 2. The
content is safe today and **a remote branch-pruning sweep would destroy it
permanently.** If the ledger is to be populated honestly, harvest those 20
bodies before any branch cleanup — that ordering is the whole reason this
section exists.

### 3. Four rules were born thin — a third disposition is needed

`copilot-routing`, `devcontainer-routing`, `laravel-routing`, `symfony-routing`
were added by `2a11c70b2` as net-new files already carrying
`Body migrated to skill:X`. No pre-migration body ever existed at any path.

Phase 3 Step 4 offers "unledgered" for unrecoverable content, and that word is
wrong for these: **no source content** is a different fact from *content existed
and is now unrecoverable*, and a ledger that spells them the same way cannot be
audited. The disposition set needs a third value.

### 4. The ledger gate must key on heading TEXT, and must tolerate new headings

Two shapes break a naive "every pre-migration `##` appears as a ledger row":

- **Demotion.** `code-comment-discipline`'s six dropped `##` sections all exist
  in the target as `###`. Keying on level misses every one.
- **Addition.** `context-hygiene` went 8 `##` → 5, *and gained* a `## See also`
  that did not exist pre-migration. The P4 batches added that section
  everywhere, so a gate treating a post-migration-only heading as an unledgered
  row false-positives across the whole set.

### 5. Nine rules were thinned in more than one event

`artifact-drafting-protocol`, `autonomous-execution`, `context-hygiene` (three
events), `design-fidelity`, `git-history-discipline`, `minimal-safe-diff`,
`roadmap-progress-sync`, `untrusted-input-defense`. `roadmap-progress-sync` went
180 → 17 lines, regrew to 141, then was cut to 90. A ledger keyed on the first
migration commit silently misses the second wave.

## A separable defect this inventory surfaced

**Ten migration links have the wrong `../` depth**, and no gate sees it.

Nine write `../docs/guidelines/…` from `src/rules/`, which resolves to
`src/docs/` — a directory that does not exist. One writes
`../contexts/execution/…`, resolving to `src/contexts/`, which also does not
exist (the real path is `src/agent-src/contexts/`). Three rules use the correct
`../../docs/…`, so the convention is internally inconsistent 9 against 3.

The nine `../docs/` links are broken in the projected tree as well —
`dist/agent-src/` has no `docs/`. The `../contexts/` one resolves in the
projection, because `dist/agent-src/{rules,contexts}` are siblings, so it is a
source-tree-only break.

`check_references` cannot catch this: its path matcher captures from the first
known root segment and resolves repo-root-relative, so the `../` prefix is
discarded before resolution and the number of `../` is invisible to it.

**Affected:** `active-remediation`, `artifact-drafting-protocol`,
`code-comment-discipline`, `context-hygiene`, `design-fidelity`,
`domain-adoption-policy`, `framework-neutrality-in-generic-skills`,
`minimal-safe-diff`, `untrusted-input-defense` (`../docs/`) and
`roadmap-ci-steps-policy` (`../contexts/`).

This is a defect-pattern-search case in the exact shape Phase 1 Step 6 just
added to `downstream-changes`: one wrong link is a sample, ten is the
population. It is filed here rather than fixed inline because the fix touches
ten rules for a reason unrelated to the change that found it, and a batch
touching rules is the shape that trips the kernel-prefix byte-stability gate.

## Target taxonomy

| Kind | Count |
|---|---|
| `skill:<id>` token | 21 (19 distinct; `laravel` and `agent-docs-writing` twice each) |
| `guideline:<path>` token | 18 (15 under `agent-infra/`) |
| `contexts/…` path | 2 |
| `docs/contracts/…` path | 2 |
| bare skill link, no token | 1 (`legal-safety-floor`) |
| sibling rule | 1 (`brand-consistency` → `brand-source-of-truth`) |

Twenty-four targets are bare scheme tokens with no accompanying path. They
resolve through `src/scripts/rule_backlinks.ts` `candidate_paths()`, which is
the package's canonical map — `skill:<id>` → `src/skills/<id>/SKILL.md`,
`guideline:<p>` → `docs/guidelines/<p>.md`, `contexts/<p>.md` →
`src/agent-src/contexts/<p>.md`. All 24 resolve. **A ledger gate should assert
on the scheme token, not on the markdown link**, which is also how it sidesteps
the depth defect above.

## Phrasings a gate must match

`Body migrated to` covers 39. The other five need:

| Variant | Count | Rule |
|---|---|---|
| `Portability body migrated to` + `Sync body migrated to`, one line | 2 refs | `augment-edit-discipline` |
| `Body merged into` | 1 | `brand-consistency` |
| `Operating mechanics migrated to`, **mid-paragraph** | 1 | `legal-safety-floor` |
| the sentence **soft-wrapped across two lines** | 1 | `ui-audit-gate` |

The last two are the traps: an `^Body migrated`-anchored regex misses the
embedded one, and a single-line regex requiring the trailing `(per P4 …)` misses
the wrapped one.

## Prior art to cross-reference, not duplicate

`docs/guidelines/agent-infra/rule-body-migration-inventory.md` (241 lines,
compiled 2026-07-12) classifies every rule thin/migrate/stay with target homes.
It is a **forward plan** — what should migrate — not a **loss ledger** — what was
dropped. It does not satisfy Phase 3, and Phase 3 should cite its class column
rather than restate it.

## See also

- `agents/settings/contexts/skill-ecosystem-sweep-2026-08.md` — the sweep this roadmap executes.
- `src/scripts/rule_backlinks.ts` — the canonical scheme-token resolver.
- `src/scripts/check_references.ts` — the gate that cannot see the depth defect, and why.
