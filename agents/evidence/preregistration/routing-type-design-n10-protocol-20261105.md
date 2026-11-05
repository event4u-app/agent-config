<!-- evidence-type: analysis -->

# Pre-registration — `type-design` at ten runs per catalogue

**Roadmap:** `road-to-routing-assurance-live-floors-carried` 1.3.
**Written:** 2026-11-05, committed before any run of this measurement.
**Why it exists:** `agents/evidence/metrics/routing-fixture-v1-20261105.md` —
`type-design` fired 6/6 on the frozen catalogue and 0/3 on today's, and the
ablation cells sat at 1/3 and 3/3, which three runs cannot separate.

## The measurement

| Arm | Catalogue | Skills | Runs |
|---|---|---:|---:|
| frozen | `1c967b17…` (the baseline's) | 301 | 10 |
| today | `e0ec68d3…` (fixture series v1's) | 303 | 10 |

- Case: `061-type-design-q5`, byte-identical in both arms, with the v1 fixture
  `type-design/q5/scaffold.sh` (`9663e579`). No extra tools.
- Instrument as in the fixture series v1: `claude plugin eval --scaffold`,
  `claude-opus-5-5`, `--ablation none`, `--no-publish`, `--trust-plugin`,
  `--keep-temp`, through the subscription CLI; the artefact names the host
  version.
- Fresh runs only; the earlier 6 frozen and 3 today runs are not pooled.
- No retries; an errored run is UNKNOWN, is not replaced, and leaves the
  denominator.

## Decision rules, fixed now

- **Pass rule:** unchanged — the run called `Skill` with `type-design`.
- **Floor:** 0.90 (`docs/contracts/routing-assurance-floors.json`). Today's
  arm at ≥ 9/10 closes the unit for the fixture series; below it, the unit
  stays below its floor.
- **Catalogue effect:** the two arms differ when a two-sided Fisher exact test
  on the 2×2 table gives p < 0.05. Otherwise the effect is reported as not
  shown at this run count, and the v1 0/3 is not called a regression caused
  by the catalogue.
- No further ablation follows from this measurement under this contract.
