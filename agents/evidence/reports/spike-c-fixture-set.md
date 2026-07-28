# Spike C/B — Frozen Fixture Set (20 real, unaffiliated public repos)

Council-frozen selection rule (2026-07-27), published here **before** the
coverage/availability numbers were computed, then applied mechanically. This
file is the pre-registration; `spike-c-coverage.md` and
`spike-b-signal-availability.md` consume this fixture list unchanged.

## Selection rule (as pre-registered)

- **Strata:** 8 PHP (query keyword `laravel`), 8 TypeScript, 4 mixed/polyglot.
- **Within each language:** split across star strata `>500` / `51..500` /
  `5..50`, roughly equal (3/3/2 for the 8-repo strata; 2/1/1 for the 4-repo
  mixed stratum).
- **Filters:** `archived:false`, forks excluded (`--include-forks=false`),
  pushed/updated within the last 90 days (`--updated ">2026-04-27"`), repo
  size 100 KB–80 MB (`--size "100..81920"`, size in KB per the GitHub search
  `size` field).
- **Deterministic pick:** per stratum, sort by stars descending (API
  `--sort=stars --order=desc`), take the first K rows that pass language +
  filter checks. **Exclusions:** no `event4u*`/`galawork*` orgs, no two repos
  from the same owner across the whole 20-repo set.

## Exact queries run (gh CLI, flags — not a single quoted qualifier string)

A first attempt embedded all qualifiers in one quoted string
(`gh search repos "laravel language:PHP stars:>500 ..."`); this was **not**
honored by the GitHub search API (returned repos up to 4.2 GB in size, and a
non-PHP repo) — confirmed by inspecting the `size`/`language` fields of the
returned rows. Every stratum below was re-run (or, for `php_A`, replaced)
using **separate CLI flags**, which GitHub does honor:

```
# PHP (8 total: 3 / 3 / 2)
gh search repos laravel --language=PHP --stars=">500"   --archived=false --include-forks=false --updated=">2026-04-27" --size="100..81920" --sort=stars --order=desc --limit=30 --json fullName,stargazersCount,size,pushedAt,isArchived,isFork,language,url,owner
gh search repos laravel --language=PHP --stars="51..500" ...same flags...
gh search repos laravel --language=PHP --stars="5..50"   ...same flags...

# TypeScript (8 total: 3 / 3 / 2) — no keyword text, qualifiers only
gh search repos --language=TypeScript --stars=">500"    --archived=false --include-forks=false --updated=">2026-04-27" --size="100..81920" --sort=stars --order=desc --limit=30 --json ...same fields...
gh search repos --language=TypeScript --stars="51..500" ...same flags...
gh search repos --language=TypeScript --stars="5..50"    ...same flags...

# Mixed/polyglot (4 total: 2 / 1 / 1)
```

**Mixed/polyglot deviation from the pre-registered query (documented, not
silent):** the pre-registered keyword `"php typescript"` returned **0**
results even before any star filter. The `monorepo` fallback keyword returned
30 results, but every one was a single-dominant-language repo (TypeScript,
Vue, Rust, Go, …) with no PHP presence at all — not a polyglot PHP+TS shape.
Neither pre-registered option worked, so a **third, still-in-spirit** keyword
combination was used and is disclosed here rather than silently substituted:

```
gh search repos laravel typescript --archived=false --include-forks=false --updated=">2026-04-27" --size="100..81920" --sort=stars --order=desc --limit=30 --json fullName,stargazersCount,size,pushedAt,isArchived,isFork,language,url,owner
```

This single query (no `--stars` filter) returned a star-count spread wide
enough to stratify post-hoc by the same rule (sort desc within each stratum
band, first K that pass filters). Total gh **search** calls used: 10
(1 wasted first attempt + 9 valid stratum queries — at the ~10-call budget).

## Frozen fixture list (20 repos)

| # | owner/name | stars | size (KB) | language (API) | stratum |
|---|---|---:|---:|---|---|
| 1 | coollabsio/coolify | 59625 | 74219 | PHP | php->500 |
| 2 | livewire/livewire | 23559 | 45668 | PHP | php->500 |
| 3 | krayin/laravel-crm | 23509 | 52843 | PHP | php->500 |
| 4 | whitecube/laravel-cookie-consent | 496 | 2223 | PHP | php-51..500 |
| 5 | leandrocfe/filament-apex-charts | 496 | 52742 | PHP | php-51..500 |
| 6 | shipmonk-rnd/dead-code-detector | 496 | 1123 | PHP | php-51..500 |
| 7 | GrahamCampbell/Laravel-TestBench | 50 | 425 | PHP | php-5..50 |
| 8 | bnussbau/laravel-trmnl | 50 | 127 | PHP | php-5..50 |
| 9 | clash-verge-rev/clash-verge-rev | 133945 | 77688 | TypeScript | ts->500 |
| 10 | shadcn-ui/ui | 119892 | 68835 | TypeScript | ts->500 |
| 11 | modelcontextprotocol/servers | 88924 | 29386 | TypeScript | ts->500 |
| 12 | obsidianmd/obsidian-maps | 500 | 2800 | TypeScript | ts-51..500 |
| 13 | webcomponents/custom-elements-manifest | 500 | 102 | TypeScript | ts-51..500 |
| 14 | mxstbr/mxstbr.com | 500 | 43174 | TypeScript | ts-51..500 |
| 15 | nuxt-community/imagemin-module | 50 | 490 | TypeScript | ts-5..50 |
| 16 | fmaclen/svelte-currency-input | 50 | 528 | TypeScript | ts-5..50 |
| 17 | pterodactyl/panel | 9060 | 29751 | PHP (mixed: PHP+TS frontend) | mixed->500 |
| 18 | MohmmedAshraf/laravel-translations | 816 | 14713 | PHP (mixed) | mixed->500 |
| 19 | spatie/laravel-typescript-transformer | 388 | 415 | PHP (mixed) | mixed-51..500 |
| 20 | h3ravel/h3ravel | 86 | 1224 | TypeScript (mixed) | mixed-5..50 |

Stratum counts: PHP >500=3, 51-500=3, 5-50=2 (8 total). TypeScript >500=3,
51-500=3, 5-50=2 (8 total). Mixed >500=2, 51-500=1, 5-50=1 (4 total).
20 unique owners, no two repos share an owner, none under `event4u*` /
`galawork*`.

## Exclusions applied

- Forks excluded via `--include-forks=false` on every query.
- Archived repos excluded via `--archived=false`.
- Size band 100 KB – 80 MB enforced via `--size="100..81920"` (verified
  post-hoc against the returned `size` field for every selected repo — no
  repo above 81920 KB or below 100 KB made the final 20).
- Pushed/updated after 2026-04-27 enforced via `--updated=">2026-04-27"`
  (last-90-days floor from the run date 2026-07-27).
- No `event4u*` / `galawork*` owner (none matched).
- No duplicate owner across the 20 (verified manually against the owner
  column above).

## Clone method

`git clone --depth 1 https://github.com/<owner>/<name>.git` into
`spikec/<owner>__<name>/` under the session scratchpad (never inside this
repo). All 20 clones succeeded. Clones were deleted at the end of the task.
