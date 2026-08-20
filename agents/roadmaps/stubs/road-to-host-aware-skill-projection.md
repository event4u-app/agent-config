---
complexity: lightweight
---

# Stub: road to host-aware skill projection

> **Stub — not active work.** Transferred out of
> `road-to-release-review-p0.md` Phase 1 on 2026-08-20 by the drain-run
> disposition framework `agents/evidence/council/drain-blocker-dispositions-a.md` <!-- ref-ignore -->
> (disposition B — outcome `transferred`). **Provenance caveat, stated because
> a stub is exactly where an unverifiable citation would rot:** that framework
> path was supplied to this run as the framework of record and is **not
> present in this tree** at `206ab4f16` — `git log --all -- agents/evidence/council/drain-blocker-dispositions*`
> returns nothing. The disposition is recorded here as instructed; the
> *evidence* below is this repository's own tree, cited by `file:line`, and
> stands on its own if the framework document never materializes.
>
> Phase 1 was never started, and not on effort: the three preconditions below
> were each measured absent. Nothing here is half-shipped and nothing was
> rejected on merit.

## Transferred work — quoted as it stood

Phase 1 steps, verbatim from `road-to-release-review-p0.md` at the transfer commit:

- **1.1** — "Add a host capability profile that records measured catalogue
  behaviour per host — how many skills survive the host's own catalogue
  handling — rather than deriving the limit from the package's model of the
  host." `verify: ./scripts-run src/scripts/routing_doctor --help`
- **1.2** — "Compose the projected skill set from three inputs: the host
  capability profile, the measured catalogue behaviour, and the workspace
  profile." `verify: ./scripts-run src/scripts/lint_featured_skills`
- **1.3** — "Gate the aggressive path on measurement sufficiency: only hosts
  with an adequate measurement base project a reduced set. An unknown host
  receives no aggressive scoping — the safe direction is the full catalogue,
  because under-projecting a skill is a worse failure than paying for one that
  is never used." `verify: ./scripts-run src/scripts/check_enforcement_coverage`
- **1.4** — "Leave the primary host unchanged in this phase; it has no measured
  truncation pressure and changing it would move two variables at once."
  `verify: ./scripts-run src/scripts/routing_doctor`

Acceptance criterion, verbatim:

- **AC1** — "A host with measured truncation pressure projects a reduced set and
  a host without one does not, with both traceable to a recorded measurement."

Phase exit criteria, carried for completeness: "one host projects a
measured-reduced set, another projects unchanged, and the difference traces to a
recorded measurement rather than a constant."

## Resolved-when criteria, verbatim

The **original** criterion as authored 2026-08-17, kept because the correction
below only makes sense against it:

> **Resolved when:** at least one host accumulates observations whose `verdict`
> is something other than `insufficient-observation`, at which point the
> adequacy bar is read off that distribution instead of guessed. The
> measurement half is already built (`_lib/skill_catalogue.ts` —
> `ObservationRecord`, `truncationModeOf`, `measureCatalogueVolume`); what is
> missing is the evidence, not the instrument.

The **restated** criterion, verbatim from the 2026-08-20 correction, because the
original is unfalsifiable (see blocker 1):

> **Restated resume condition, on a field that can actually change:** the
> adequacy bar is read off `dropped_count` and `projected_skill_count` under a
> fixed `projection_mode`, not off `verdict`. The 2026-08-16 pair is the first
> evidence that those fields respond to a projection change at all —
> `legacy-all` measured 497 offered / 402 dropped, `scoped` measured 426 / 330
> on the same host one day apart. Two observations of one host is not a
> distribution; the bar needs repeated same-mode rows before a threshold read
> off them is anything but a guess.

## Re-entry producer and detection probes

Promotion is **not** "when someone builds it". Three named preconditions, each
with a probe that a reader can run today and that returns a decidable answer.
All three must pass; each was measured FAILING at `206ab4f16`.

| # | Precondition | Producer — who or what makes it true | Detection probe | Measured 2026-08-20 |
|---|---|---|---|---|
| P1 | Repeated same-`projection_mode` catalogue observations on the truncation-pressure host | Real sessions on that host with `capture_skill_catalogue` run against them; no command in this repo can synthesise them | At least **2 rows** in `agents/evidence/metrics/skill-catalogue.jsonl` sharing one `projection_mode` value with **differing** `dropped_count` | **FAIL** — 7 rows total; the only two carrying `projection_mode` carry *different* modes (`legacy-all`, `scoped`), so no same-mode pair exists at all |
| P2 | A non-throwing scoped projection path | Whoever ports the config-package twins (packs / session_profiles / profiles) into `condense.ts` | `_resolve_active_predicates` **returns** for `projection.mode=scoped` instead of raising at `condense.ts:1646` | **FAIL** — raises `projection.mode=scoped requires the config package (not ported in condense.ts)` |
| P3 | A published projected-away-skill-was-needed observation | A human who hits the miss in a real session and writes it up; this is the roadmap rank-1 risk mitigation and it cannot be self-served | A **dated finding under `agents/evidence/`** naming the host, the session, and the skill that was projected away and needed | **FAIL** — no such finding exists |

P1 and P3 both require a live host session and a human observation. P2 is
buildable by an agent, and is the only one of the three that is. Promoting on
P2 alone would produce a scoped path with no measurement to drive it, which is
the same shape as the original blocker.

## Blockers carried across in full

Three, all measured rather than argued.

**1. The original resume condition is unfalsifiable.** `buildBudgetEventRecord`
writes `verdict: 'insufficient-observation'` **unconditionally** for every
`budget-strip-and-drop` observation (`src/scripts/_lib/skill_catalogue.ts:595`),
and its own comment two lines above says why — "there is nothing to separate:
the host did not choose per entry, it stripped all of them". The field is a
**selector** verdict, not a measurement-adequacy verdict. No accumulation of
`codex` rows can ever move it, because nothing computes it from the data; and
the only other host row (`claude`, `no-selector`) comes from
`buildNoTruncationRecord` (`:643`), which is equally unconditional. The
observation base did grow — 5 rows at `6a679cc19`, **7 rows** at `206ab4f16` —
and the verdict distribution is byte-identical, which is the prediction the
correction makes and the data already confirms.

**2. There is no scoping mechanism to compose a host input into.**
`projection.mode` is a global setting with no host input
(`src/scripts/condense.ts:1594`), and `_resolve_active_predicates` **throws**
for `scoped` — "requires the config package (not ported in condense.ts)"
(`:1646`). So step 1.2 premise is that host measurement composes with a scoped
path, and the scoped path currently raises. Building the host input first would
produce a profile with no consumer.

**3. Step 1.1 has no home in the existing manifest.**
`HostCapabilityManifest` is all-boolean by contract with an all-`false` safe
default (`src/scripts/_lib/host_capability.ts:43-81`); a measured catalogue
count is neither a boolean nor safe-defaultable to `false`, so step 1.1 is a
new profile surface rather than a field addition.

## Seed content on promotion

- A **new** per-host catalogue-measurement profile, separate from
  `HostCapabilityManifest` — do not widen that manifest, its all-boolean
  all-`false` safe default is the contract that makes an unknown host safe.
- P2 first, then P1 feeding it: a scoped path that composes host measurement,
  workspace profile, and capability profile, with the unknown-host branch
  pinned to the **full** catalogue.
- The sufficiency threshold read off the observed `dropped_count` distribution
  for one fixed `projection_mode` — never a constant, which is the failure AC1
  names.
- Rank-1 risk mitigation shipped with it: a projected-away skill needed in a
  real session reverts that host to full projection and publishes the case.

## What does NOT apply to this stub

The **Promotion criteria (shared)** in `README.md` — recruited customer, funded
security audit, maintainer ADR lifting a Hard-Floor item — govern the six
org-mode stubs created by Phase 9 of the archived employee-product roadmap.
They do **not** govern this one: this is a drain-run transfer of internal
projection work that crosses no Hard Floor, introduces no org surface, and
needs no customer. Its gates are P1-P3 above and nothing else. Stating this is
the point of registering it in a separate row group rather than appending it to
that table.
