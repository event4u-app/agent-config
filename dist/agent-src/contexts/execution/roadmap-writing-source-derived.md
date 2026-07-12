# Roadmap Writing — source-derived & capability-adoption roadmaps

Conditional procedure for [`roadmap-writing`](../../skills/roadmap-writing/SKILL.md)
§ 8. Split out of the skill body to keep it under the size budget. This fires
**only** for source-derived or capability-adoption roadmaps; an ordinary
internally-originated roadmap skips it entirely (§§ 0–7 of the skill are the
whole job). Pull this when the roadmap originates from an external input or
adopts capabilities into the suite.

## When this section fires

This section fires **only** when the roadmap originates from an
external input or adopts capabilities into the suite:

- a competitive / capability harvest, an external suggestion, or an
  external LLM ideation thread, **or**
- a decision to integrate/adopt new skills, commands, or a pack, **or**
- a plan whose design has genuinely contested, not-yet-resolved
  trade-offs.

For an ordinary internally-originated roadmap, **skip this section** —
§§ 0–7 are the whole job. Do not bolt a Provenance block or a
gap-table onto a plan that needs neither (template rule 19).

## The four extra moves

When it fires, add these four moves to the §§ 0–7 procedure:

**A. Gap-table before drafting (don't adopt — integrate).** Audit each
proposed item against the *existing* skill / command / rule surface and
classify it `KEEP` (verified gap), `FOLD` (into a named existing
artefact), or `CUT` (already covered). Only `KEEP` items become
roadmap scope; `FOLD`/`CUT` are recorded so the cut is auditable. A
negative grep is not proof — open the nearest existing artefacts (per
[`think-before-action`](../../rules/think-before-action.md) and, for an
external source, [`external-reference-deep-dive`](../../rules/external-reference-deep-dive.md)).

**B. Resolve contested design in the council *first*, then author.**
The default council flow (`/roadmap:ai-council`) *challenges a finished
roadmap*. For a contested or source-derived plan, run the council
**up front** on the design questions (`/council:design`, or the
[`ai-council`](../../skills/ai-council/SKILL.md) skill), converge, **then** write
the roadmap encoding the verdicts — so the plan ships already-decided,
not as open questions in prose. One run, converge; do not relitigate.

**C. Encode the decision so it survives.**
- Inline council convergence under a `## Council notes (<date>, <depth>)`
  block — members + date, **never** a session filepath
  ([`no-roadmap-references`](../../rules/no-roadmap-references.md)).
- Add a `## Provenance` block — source by a **neutral descriptor**
  (never the raw competitor/tool name,
  [`source-confidentiality`](../../rules/source-confidentiality.md));
  retain the real link as an `ENC1:` token via
  `src/scripts/_lib/link_crypto.ts encrypt --value <url>`.
- Save the locked decision to memory (project type, "don't relitigate")
  so a future session does not re-derive it.

**D. Make "integration, not dump" a testable acceptance criterion.**
The AC must encode the anti-dump litmus, decidably: visible commands
within the pack's `size_class` budget; each new visible command reuses
≥ 2 existing skills; no new artefact duplicates an existing one;
governance preflight recorded — `domain-adoption-policy` (does it open a
new domain?), `persona-governance` (new personas?),
`framework-neutrality`, `size-enforcement` — with the disposition
stated in the roadmap.
