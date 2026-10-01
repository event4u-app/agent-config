**Skipped:** no code surface for this completion — the diff is one roadmap file plus grounding-corpus and eval data (a CSV citation, a manifest date stamp, one new triggers.json) and their byte-identical `dist/` projections; no script, test, hook or config logic changed, scope 4e31eea77d9d9d36506902dd94dfdb1ffe4378b1da346beacc4eb2a2cf3b2947, declared 2026-10-01

The gate's own reading agrees: it counts zero code paths across the changed files.

What the change actually does, for a reader deciding whether that skip is
honest: it records one of the four corpus re-checks `D1` of
`road-to-corpus-refresh-cadence-shape` prescribes. The verification ran against
live upstreams (WCAG 2.2 and the W3C ARIA Authoring Practices Guide), found one
renamed pattern, fixed the one stale citation it found, and moved that corpus's
`upstream.last_checked` to the date the check ran. The behaviour of
`check_corpus_staleness` is unchanged — it reads the same fields it always did
and still exits 0.

Touching the skill's `data/` pulled it into `check_routing_coverage`'s
touched-skill scope, so a 10-case `evals/triggers.json` was written for it. That
file is a routing corpus — declarative test data read by
`lint_skill_trigger_corpus` and `check_trigger_evals` — not executable surface,
which is why the skip still holds after it landed.
