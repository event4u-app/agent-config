# Commit-mix baseline — 2026-10

<!-- evidence-type: analysis -->

> **Pin:** `9bc8cd4` (merge of `release/16.2.0`, 2026-10-01). Measured 2026-10-01
> over the last 400 commits reachable from that pin. Written once, by step 1.3 of
> `road-to-leading-every-row`, as the reading blocker b2 decides on. Nothing here
> is a target: it is what the tree spent its last 400 commits on.

## Command

```bash
git log 9bc8cd4 --max-count=400 --format='%s' \
  | grep -oE '^(feat|fix)\([a-z0-9/_-]+\)' \
  | sed -E 's/^(feat|fix)\((.+)\)$/\2/' \
  | sort | uniq -c | sort -rn
```

Of the 400 subjects, 125 are scoped `feat(...)` / `fix(...)` and 4 more are
unscoped `feat:` / `fix:`. The remaining 271 are `docs`, `chore`, `test`,
`refactor`, `ci`, `build` and merge commits, which this reading does not classify.

## Top scopes

| scope | count |
|---|---|
| hooks | 11 |
| roadmap | 10 |
| scripts | 8 |
| install | 8 |
| gates | 6 |
| work-engine | 4 |
| roadmaps | 4 |
| report | 4 |
| probe | 4 |
| skills | 1 |

`skills` is listed out of rank order because it is the comparison the reading
exists for: the five leading scopes are plumbing — hooks, roadmap bookkeeping,
scripts, the installer and the gates — and the content surface the package
publishes moved once.

## What this does and does not establish

**Establishes.** A number, at a named pin, from a stated command, that the next
round can re-run and compare against. Blocker b2 of `road-to-leading-every-row`
asks whether ADR-260 § 1's consumer-first guard is re-armed for the next three
release cuts; this is the first reading that guard would read.

**Does not establish.** Nothing about value. A `hooks` commit may be a one-line
manifest row and a `skills` commit a 400-line artefact; the counter measures
subjects, not work. It also does not classify the 271 non-`feat`/`fix` subjects,
so it is a reading of the *feature and fix* mix, never of the whole tree's
activity. Treating it as a ratio to optimise would be the measurement corrupting
its own signal — the scopes are author-chosen free text, and the cheapest way to
move this table is to rename a scope.
