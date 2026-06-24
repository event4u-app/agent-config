# Domain-pack architecture — a retrospective observation (NOT a design driver)

> **Status: retrospective hypothesis, N=1.** This documents the sequence the
> **legal** pack happened to follow. It is **not** a rule and **not** a template
> that future packs must fit. Validate it against a *second* domain before
> promoting any of it to a rule or building scaffolding tooling — per
> `domain-adoption-policy` and the `domain-pack-extraction-when-triggered` (N=2)
> roadmap. Designing a new pack to fit this speculative pattern would invert the
> lever: build the domain correctly on its own legs, then observe whether the
> pattern recurred.

## The sequence legal followed

1. **Safety floor first** — a domain `*-safety-floor` rule (Iron-Law-shaped,
   ~100 lines) before any drafting skill. A drafting skill shipped before its
   floor is the exact liability the floor prevents.
2. **Enforcement teeth** — the floor's machine-checkable elements become a
   deterministic linter (`lint_legal_pack`) wired into CI. Prompt rules are not
   governance; lint rules are. This is the differentiator vs prompt-only suites.
3. **Eval = regression harness, not a correctness oracle** — self-labeled
   fixtures in the maintainer's genuine-competence sub-domain; the *objective*
   eval (attorney-validated gold set, inter-annotator ≥0.7) is a separate,
   demand-and-funding-gated track. See `domain-eval-anti-pattern.md`.
4. **Skills = procedure + output template only** — no default domain positions;
   positions live in a practice profile, so one skill set behaves
   team-specifically and the pack stays portable.
5. **Practice profile (the keystone)** — a cold-start interview writing a
   plain-prose profile into `.agent-settings.yml` / the setup wizard; skills read
   it and halt on unresolved placeholders.
6. **Deferred by default** — personas, scheduled watchers, installer hubs, and
   broader scope are recorded as rejected/gated, not built, until evidence pulls
   them in.

## Why it is NOT yet a rule

- **N=1.** Finance might need real-time-data evals; security might need red-team
  evals; neither looks like "clause extraction + self-labeled fixtures." The
  shape that fit legal may not fit them.
- **Premature tooling is the maintainer's enemy.** No `domain-pack:new`
  scaffolding ships from this observation. Extraction waits for N=2, where a
  second domain either confirms the sequence (promote to a rule) or diverges
  (document the delta, keep both bespoke).

## What to do at N=2

Build the second domain on its own merits. *Then* compare: which steps generalised,
which broke. If the sequence held twice, promote it to a rule and consider
scaffolding. If it diverged, this note records why a one-size pattern was wrong —
itself a useful result.

## See also

- [ADR-107 — Legal domain-pack adoption](../../decisions/ADR-107-legal-domain-pack-adoption.md)
- `domain-adoption-policy` (rule) — the three gates before opening any domain.
- `domain-eval-anti-pattern.md` — why the legal eval is a regression harness, not an objective gate.
