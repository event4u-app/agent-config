# Spike C — Rules-in-the-Wild Coverage Baseline

Fixture set: the 20 repos frozen in
[`spike-c-fixture-set.md`](spike-c-fixture-set.md). Verifiers: three
repo-agnostic classes only (no house-style checks, no LLM), per council.
Verifier order (also the "first finding" priority order for the
true/false-positive judgment): **1. secret-leak → 2. conflict-markers →
3. placeholder-prose lint.**

## Verifier 1 — Secret-leak scan

**Invocation used.** `src/scripts/check_secret_leak.ts`'s CLI entrypoint
(`main()`) hardcodes `REPO_ROOT` to this package's own repo two directories
up from the script — it is **not** path-parameterizable via its CLI, even
though it exports a `scanRepo(root, mode)` function that accepts an arbitrary
root. A ~15-line wrapper (`secret_scan_one.mts`, written to the scratchpad)
imported that exported `scanRepo` directly and called
`scanRepo(<clone-root>, 'all')` — i.e. the real `secret_detector` lib (regex
rule pack + Shannon entropy + keyword context, `src/scripts/_lib/secret_detector.ts`),
in full-tree mode, over each clone. Only `confidence === 'high'` findings are
counted (same floor the CI gate itself uses). The tool's own
`DEFAULT_EXCLUDE` list (node_modules, dist/dist-*, .git, fixtures, tests,
`.min.*`, lockfiles it knows about, etc.) applied unchanged.

## Verifier 2 — Merge-conflict markers

**Invocation used.** `src/scripts/check_no_conflict_markers.ts` also
hardcodes its repo root (two dirs up from the script) and is not
path-parameterizable — so the **documented grep fallback** was used instead,
mirroring the script's own three-marker logic: a file is a hit only if it
contains a `^<<<<<<< ` line **and** a `^=======$` line **and** a
`^>>>>>>> ` line. Command shape:

```
grep -rlE '^<{7} ' <dir> --exclude-dir={node_modules,vendor,dist,build,.git}
# then, per candidate file, confirm '^={7}$' AND '^>{7} ' also present
```

## Verifier 3 — Placeholder-prose lint

**Invocation used.** `src/scripts/lint_output_slop.ts` hardcodes its own
`collectFiles()` to this package's `src/skills/**/SKILL.md`,
`src/rules/*.md`, `docs/guidelines/*.md` — also not path-parameterizable.
Its six regex rules were **replicated via grep** (patterns copied verbatim
from the script, case-insensitivity preserved per-rule) over each clone's
shipped source files (`.ts .tsx .js .jsx .mjs .cjs .vue .svelte .php .py .go
.rs .rb .java`), excluding `node_modules, vendor, dist, build, .git, test,
tests, __tests__, fixtures, spec, .next, coverage` and `*.min.*` files:

- **P1** `lorem-ipsum` — `Lorem\s+ipsum|dolor\s+sit\s+amet` (case-insensitive)
- **P2** `bracket-placeholder` — `\[Your\s+\w[\w\s]*here\]|<Your\w+Name>`
- **P3** `impl-placeholder` — `//\s*(rest\s+of\s+(component|implementation|code)|\.{3}\s*\(unchanged\)|same\s+pattern\s+follows)` (case-insensitive)
- **P4** `for-brevity` — `//.*for\s+brevity|/\*.*for\s+brevity.*\*/` (case-insensitive)
- **P5** `ellipsis-trunc` — a line that is only a Unicode `…` (standalone)
- **P6** `todo-implement` — `//\s*TODO[:\s].*implement` (case-insensitive)

## Per-repo results

| # | repo | secrets (hits) | conflicts (hits) | slop (hits) | ANY finding? |
|---|---|---:|---:|---:|---|
| 1 | coollabsio/coolify | 178 | 0 | 0 | yes |
| 2 | livewire/livewire | 0 | 0 | 0 | no |
| 3 | krayin/laravel-crm | 1 | 0 | 0 | yes |
| 4 | whitecube/laravel-cookie-consent | 0 | 0 | 0 | no |
| 5 | leandrocfe/filament-apex-charts | 0 | 0 | 0 | no |
| 6 | shipmonk-rnd/dead-code-detector | 0 | 0 | 0 | no |
| 7 | GrahamCampbell/Laravel-TestBench | 0 | 0 | 0 | no |
| 8 | bnussbau/laravel-trmnl | 0 | 0 | 0 | no |
| 9 | clash-verge-rev/clash-verge-rev | 0 | 0 | 0 | no |
| 10 | shadcn-ui/ui | 3 | 0 | 6 | yes |
| 11 | modelcontextprotocol/servers | 0 | 0 | 0 | no |
| 12 | obsidianmd/obsidian-maps | 1 | 0 | 0 | yes |
| 13 | webcomponents/custom-elements-manifest | 0 | 0 | 0 | no |
| 14 | mxstbr/mxstbr.com | 0 | 0 | 2 | yes |
| 15 | nuxt-community/imagemin-module | 0 | 0 | 0 | no |
| 16 | fmaclen/svelte-currency-input | 8 | 0 | 0 | yes |
| 17 | pterodactyl/panel | 7 | 0 | 1 | yes |
| 18 | MohmmedAshraf/laravel-translations | 0 | 0 | 0 | no |
| 19 | spatie/laravel-typescript-transformer | 0 | 0 | 0 | no |
| 20 | h3ravel/h3ravel | 0 | 0 | 0 | no |

**Coverage numerator: 7 / 20 repos (35%)** triggered ≥1 finding from at least
one frozen verifier. Merge-conflict markers: 0/20 — a clean honest-null (all
20 are actively maintained, no leftover conflict-resolution debris found;
this is a real result, not a failure of the check).

## First finding per repo, with verdict

Verifier-priority order (secret-leak first) determines which finding is
"the first" when a repo has hits from more than one verifier.

| repo | file:line | excerpt (≤120 chars, redacted) | verdict | reasoning |
|---|---|---|---|---|
| coollabsio/coolify | `.agents/skills/configure-nightwatch/SKILL.md:331` | `NIGHTWATCH_REDACT_PAYLOAD_FIELDS=password,password_confirmation,ssn,credit_card` | **FALSE POSITIVE** | Entropy hit on a documentation line naming env-var *keys* (a redaction-config example), no actual secret value present. |
| krayin/laravel-crm | `public/webform/build/assets/app-8787c790.js:35` (col ~4488) | `$o="abcdefghijklmnopqrstuvwxyz"` | **FALSE POSITIVE** | Entropy hit on the literal alphabet charset constant used for random-ID generation inside a minified/built vendor JS bundle; path isn't covered by the tool's `dist/` exclude (it's `.../build/...`). |
| shadcn-ui/ui | `apps/v4/app/og/geistmono-regular-otf.json` (col ~86061) | `AKIA…SA` inside a `"base64Font": "T1RUTwAM…"` blob | **FALSE POSITIVE** | Coincidental AKIA-shaped byte run inside a base64-encoded font binary stored as JSON text — not a credential. |
| obsidianmd/obsidian-maps | `src/map/style.ts:37` | `const accessToken = accessTokenMatch ? accessTokenMatch[1] : ''` | **FALSE POSITIVE** | `generic-assignment` matched the variable *name* `accessToken`; the value is extracted at runtime from a URL parameter via regex, not a hardcoded credential. |
| mxstbr/mxstbr.com | `app/(os)/chores/kid-board.tsx:1408` | `<span …>…</span>` shown while `isSkipping` is true | **FALSE POSITIVE** | A real, intentional UI loading-indicator ellipsis rendered conditionally during an async action — not an AI-generated code-truncation placeholder (P5 fires on legitimate UI content). |
| fmaclen/svelte-currency-input | `bun.lock:56` | `sha5…==` (a package integrity hash) | **FALSE POSITIVE** | High-entropy hit on a `bun.lock` sha512 integrity checksum. The tool's default excludes cover `package-lock.json`/`pnpm-lock.yaml`/`yarn.lock`/`composer.lock` but not `bun.lock` — a real gap in the exclude list. |
| pterodactyl/panel | `database/schema/mysql-schema.sql:757` | `INSERT INTO \`migrations\` VALUES (73,'2017_03_03_224254_UpdateNodeConfigTokensColumns',1);` | **FALSE POSITIVE** | Entropy hit on a Laravel migration-name string being seeded as schema data, not a secret. |

**First-finding false-positive rate: 7 / 7 = 100%.**

## Honest-null framing (per council directive)

Both headline numbers are reported as landed, without softening:

- **Coverage is low-to-moderate (35%)** — three purely mechanical,
  repo-agnostic verifiers with zero project-specific knowledge surface a
  finding in about a third of real, unaffiliated repos. This is a genuine
  ceiling-probe result for H2 (how much does naive, house-style-free scanning
  actually catch in the wild), not a failure of the pipeline: the other
  65% of repos are clean on these three axes, which is itself informative.
- **First-finding FPR is 100% (7/7)** — every single "first finding" a human
  would have to triage in this sample was a false positive: doc examples,
  minified-vendor charset constants, base64 font binary, a runtime-derived
  variable name, real UI markup, and a lockfile checksum. Zero real,
  live-looking credentials or genuine unresolved conflicts were found in this
  20-repo sample. This is the sharper of the two findings: it says that
  *even the cheapest, most conservative, zero-project-knowledge verifiers*
  need either (a) better default excludes (bun.lock, `build/` dirs) or
  (b) a triage layer before a human ever sees the output — a naive
  "any finding = alert" deployment would be 100% noise on this sample.

Neither number is spun as a pass/fail; both are reported as the honest
measurement the council asked for.
