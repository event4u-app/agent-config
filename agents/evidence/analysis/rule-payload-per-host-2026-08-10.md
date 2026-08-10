# Rule payload, per host — measured 2026-08-10

> **Why this note exists.** Every diet target in the source drafts that produced
> the `road-to-cost-parity-*` family was set against **one aggregate number**
> ("a 419 KB always-loaded layer"). No host loads that. The payload is per host,
> the spread between hosts is large, and two of the numbers previously in
> circulation were artefacts of an unregenerated checkout rather than facts about
> the commit. The next diet proposal starts here.

## Method, stated because the figures depend on it

| Field | Value |
| --- | --- |
| Commit | `c073d5732fb890bbf8b41ec879f62f651c7ba293` |
| Date | 2026-08-10 |
| Checkout | a git worktree of the maintainer checkout |
| Regenerated first | **yes** — `task sync` then `task generate-tools`, both re-run to a clean `git status` (0 changed files), so the figures measure the commit and not when a generator last ran |
| Emitter generation | **real, frontmatter-less** projection files; 25 of 110 `.claude/rules/` entries carry a `paths:` block, the rest carry no frontmatter. NOT the older emitter that symlinked `.claude/rules/*` into `dist/agent-src/rules/`. |
| Unit | bytes of the `.md` files the host actually loads, `wc -c` over the carrier's own glob |

## The table

| Surface | Files | Bytes | KB | Tracked? |
| --- | ---: | ---: | ---: | --- |
| `src/rules/*.md` (maintained source) | 116 | 424,896 | 415 | tracked |
| `dist/agent-src/rules/*.md` (projection source) | 115 | 420,051 | 410 | **tracked** |
| `.augment/rules/*.md` | 115 | 420,051 | 410 | generated (symlink to `dist/`) |
| `.claude/rules/*.md` | 110 | 339,035 | 331 | generated |
| `.cursor/rules/*.mdc` | 110 | 356,754 | 348 | generated |
| `.windsurf/rules/*.md` | 110 | 357,018 | 349 | generated |
| `.clinerules/*.md` | 111 | 417,703 | 408 | generated |
| `.windsurfrules` (single file) | 1 | 338,160 | 330 | generated |
| `GEMINI.md` | 1 | 2,982 | 3 | tracked |

Adjacent corpora, same commit and method:

| Surface | Files | Bytes |
| --- | ---: | ---: |
| rules by type | 9 `always` · 102 `auto` · 5 `manual` | — |
| MUST / NEVER / ALWAYS occurrences across `src/rules/` | 178 | — |
| skills | 289 directories / 537 files | 3,845,058 |
| skill frontmatter only | 289 | 114,432 |
| shipped contexts (`src/agent-src/contexts/`) | 57 | 391,977 |
| project-local contexts (`agents/settings/contexts/`) | 77 | 730,565 |
| CLI verbs | 100 | — |
| `user_prompt_submit` concerns (claude) | 9 | — |

## Three findings a reader should not have to re-derive

**1. The "lean hosts" were never lean.** A figure in circulation recorded
`.clinerules` / `.windsurfrules` as *"~3 KB / ~0 KB"* and therefore as hosts
needing no diet target at all. They are **408 KB** and **330 KB**. Both carriers
are **untracked** and written only by `task generate-tools`, so a checkout that
has not run it reads them as near-empty. The earlier figure measured *when
someone last ran a generator*. `GEMINI.md` at 2,982 B is the only genuinely lean
carrier in the set — it is a pointer file, not a rule payload.

**2. Only one payload figure is stable across machines.**
`dist/agent-src/rules/` (115 files / 420,051 B) is committed; every other row
above is regenerated on demand and is therefore a property of the checkout. Any
before/after comparison must name its checkout **and** state that it regenerated
first, or it is not comparing what it claims to compare.

**3. The aggregate everyone dieted against does not describe a host.** 413 KB of
`src/rules/` is the whole maintained tree. Only **9 of 116** rules are
`type: always`, and because no host consumes `dist/router.json` at runtime,
`type: auto` does not gate delivery either — an `auto` rule is projected and
shipped like any other. So neither "9 always rules" nor "413 KB always-loaded"
is the payload: the payload is the per-host column above. Among the carriers
that actually ship rules the spread is modest — 420,051 B down to 338,160 B,
a factor of **1.24** — which is the point: no host is anywhere near lean, so a
diet cannot be justified by pointing at one outlier host. `GEMINI.md` sits
outside that comparison because it is a pointer file, not a rule carrier.

## What this note does not claim

It does not measure **tokens**, only bytes — the token ceiling for delivered
rules is owned by `src/config/budgets.yml § standing_rule_delivery`
(`total_cap_tokens: 110000`), measured with the exact BPE tokenizer, and this
note deliberately does not open a second, byte-denominated target for the same
surface. It also derives nothing from `report_carrier_divergence`, which
compares two carrier caches and so measures their relative staleness rather than
any property of the source.

The registered baseline rows built from this note live in
[`src/config/cost-parity-budget.json`](../../../src/config/cost-parity-budget.json);
the running trail that appends against them is
[`cost-parity-ledger.md`](cost-parity-ledger.md).
