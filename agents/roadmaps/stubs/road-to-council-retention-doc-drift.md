---
complexity: lightweight
review_by: 2027-02-28
---

# Stub: road to council-retention documentation that matches the code

> **Stub — not active work.** Found 2026-08-31 (drain run 11) while diagnosing
> the retention defect that gated
> `road-to-inbox-harvest-2026-08-e-council-topology-evidence`'s
> `blocker: leakage-bench-needs-assembler-and-design-forks`. The diagnosis
> belonged in that blocker and is recorded there. The six documentation surfaces
> that assert the opposite are recorded here rather than repaired drive-by:
> two of them ship to consumers and one of them is a projected rule, which puts
> the repair above the fix-now bar.

## The finding, in one line

**No automatic prune of council artefacts exists.** Six surfaces say one does,
one of them instructs the agent to state it to the user, and one ships to
consumers with three separate errors in two sentences.

## The evidence

`session.save()` (`src/scripts/ai_council/session.ts:506`) is the only function
that calls `prune_old_artifacts(QUESTIONS_DIR, days)` / `(RESPONSES_DIR, days)`
(`:603-604`). Exactly two files in the repository import that module:
`src/scripts/council_prune.ts:36` (which imports `_load_retention_days` and
`prune_all_council_artifacts`, **not** `save`) and
`tests/scripts/ai_council/session.test.ts:18`. There is no barrel file in
`src/scripts/ai_council/`, and no dynamic, namespace, or string-built import
reaches it. `src/scripts/council_cli.ts` — the live writer — does not import it
at all.

No test exercises the tail either: all six `save()` call sites pass
`sessions_dir: base` (so the `if (sessions_dir === null)` branch at `:602-605`
is never entered) **and** `retention_days: 0` (which hits the `<= 0 → return []`
guard at `:360` and `:412`).

`src/scripts/janitor.ts` declares `agents/runtime/council/responses` at
`ttlDays: 7` but is a dry-run reporter by default (`:12-14`); deletion needs
`--apply`. Its `TTL_CONFIG` has **no entry for `questions/` or `sessions/`**.

Measured 2026-08-31 with `src/scripts/probe_council_retention.ts`: **1,287 of
1,313** council artefacts are older than the declared 7-day window, oldest
**120 days**. Independently corroborated by `janitor`'s own dry-run, which
reports 784 expired files in `responses/`.

**Prior art, so this is not presented as new.**
`src/scripts/ai_council/recouncil_savings.ts:237-240` already carries the
finding as a runtime string: *"ACCIDENTAL DENOMINATOR — the retained corpus is
what an unrun reaper left behind. prune_all_council_artifacts (session.ts:468)
has one caller, the manual CLI council_prune.ts, bound to no hook, Taskfile
target or workflow."*

## The six surfaces

| Surface | The false claim |
|---|---|
| `src/rules/no-roadmap-references.md:29-30`, `:37` | council artefacts are *"gitignored, local-only, and **auto-pruned**"*; *"pruned after retention window (gone even locally)"*. **A projected rule** — it reaches `.claude/`, `.augment/` and every consumer install. |
| `src/agent-src/contexts/execution/cheap-question-mechanics.md:97` | instructs the agent to *"State the fact inline"* that artefacts are auto-pruned after 7 days — **an agent-facing instruction to assert a falsehood to the user**. |
| `docs/contracts/ai-council-config.md:443`, `:537`, `:1380-1382` | *"pruned automatically on the next `save()`"*. |
| `docs/customization.md:189` | *"removed on the next `save()`"* — **and states the default as `14`** against `DEFAULT_RETENTION_DAYS = 7` (`session.ts:80`) and the rule's `7`. A three-way contradiction. |
| `src/skills/ai-council/references/output-and-synthesis.md:11` | *"auto-pruned after `ai_council.session_retention_days`"*. |
| `agents/templates/.ai-council.yml.example:113-116` | **ships to consumers**; *"pruned automatically on the next `save()`"*, and names `agents/council-sessions/` — a legacy path surviving only in `src/scripts/ai_council/one_off_archive/2026-05/README.md`. Wrong on three counts. |

The rule's *conclusion* survives — gitignored means absent from a clone — but
one of the three reasons it gives is false.

## Two further findings the repair must not lose

**The pruner is unreachable in a consumer install.** `dist/scripts/ai_council/`
ships only `modes.js` and `transport_resolver.js`; there is no compiled
`session.js`, `council_prune.js` or `janitor.js` anywhere in `dist/`, and a grep
of the shipped tree for `prune_all_council_artifacts|prune_old_artifacts`
returns zero. `scripts-run`, `Taskfile.yml` and `taskfiles/` do not ship, `tsx`
is absent from the install's `node_modules/.bin`, and neither pruner is an
`agent-config` verb. A consumer has the pruner's source on disk and **no way to
run it**.

**The obvious fix has a live trap in it.** `session.ts:70`'s `REPO_ROOT` is
file-relative while `council_cli.ts:217` resolves the root from the cwd. In the
maintainer checkout they coincide; from the global install `session.ts` resolves
to the installed package, so wiring `save()` up would prune the package's own
tree while artefacts accumulate in the consumer's — and the same defect makes
`janitor --apply` sweep the wrong tree from an install.

## What closes this

1. The six surfaces state what is true: pruning is manual, and in an install it
   is currently unavailable.
2. The `7` / `14` contradiction is resolved in one direction, with the code as
   the reference.
3. The consumer template stops naming a legacy path.
4. A decision — **not** taken here — on whether an automatic reaper should exist
   at all, and if so which root it resolves against.

## What must NOT happen first

**Do not wire an automatic prune before the leakage bench has run.** The
over-retained corpus is that bench's measurement subject: 1,402 eligible
provider-attributed bodies, of which **0** are within the TTL. A reaper landing
first deletes the instrument. The sequencing is stated in
`road-to-inbox-harvest-2026-08-e-council-topology-evidence`'s blocker todo 5 and
is the reason the diagnosis shipped without a fix.
