# `target-repos` fixtures

Three synthetic TARGET repositories for `src/scripts/grade_target_readiness.ts`.
They are the corpus Phase 1 of `road-to-target-project-assurance-readiness`
requires — its verify asks that each dimension's presence be detected and its
absence not be, "both asserted by a vitest spec", which a prose gather list in a
command file cannot satisfy.

| Fixture | Shape | Asserted verdict |
|---|---|---|
| `full/` | every dimension present, CI blocking | a level above L0, bound by whichever knockout is lowest |
| `ci-absent/` | nine dimensions high, **no workflows at all** | `L0 — bound by CI enforcement` (the exact string) |
| `python/` | Python-primary | `static analysis & types: not detectable — quality-tools has no Python mode`, binding at L0 |

**None of these is a pack, a module, or installable.** They live under `tests/`
and are read only by the grader and its spec.

**Known limitation, stated rather than implied:** these are synthetic shapes, not
the maintainer's real target repos. The roadmap's Risk 3 names the drift that
follows — "the matrix can stay green while grading a repo shape no actual target
has" — and its mitigation is step 3.3, which bases promotion decisions on real
targets. Passing this spec proves the detector, never the taxonomy.
