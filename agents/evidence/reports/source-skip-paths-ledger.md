<!-- evidence-type: analysis -->
# skip_paths ledger — all 32 entries, measured per entry

> Generated 2026-08-29 by `road-to-source-silence` Phase 2.3. The AI council
> (2026-08-29, 2/2) held decision D2 at "hold ≤20" and required this ledger
> before the criterion could be reassessed: *"Publish all 32 entries with
> classification, suppressed-hit count, removal disposition, and resulting
> total."* This is that publication.

## Method

The suppressed-hit count is **measured, not estimated**: each `skip_paths`
entry is removed in isolation and the gate's scan re-run over the tracked
tree at that ref; the number is how many deny-pattern matches that entry was
suppressing. `before` is measured at the merge base
(`63d06b7eb`), `after` at the working tree.

Unskipped deny hits — the number that must be zero for the gate to pass —
is **0 before** and **0 after**.

## The ledger

| # | entry | hits before | hits after | classification | disposition |
|--:|---|--:|--:|---|---|
| 1 | `src/scripts/check_no_external_sources.ts` | 1 | 1 | gate-own | kept |
| 2 | `src/scripts/external_sources_denylist.json` | 58 | 57 | gate-own | kept |
| 3 | `src/skills/design-intelligence/*` | 12 | 12 | vendored corpus (ADR-061) | kept |
| 4 | `src/skills/corpus-grounding/*` | 2 | 2 | vendored corpus (ADR-061) | kept |
| 5 | `src/skills/design-tokens/*` | 2 | 2 | vendored corpus (ADR-061) | kept |
| 6 | `src/skills/react-shadcn-ui/*` | 1 | 1 | vendored, Apache-2.0 §4b in-file notice | kept |
| 7 | `src/skills/tailwind-engineer/*` | 1 | 1 | vendored, Apache-2.0 §4b in-file notice | kept |
| 8 | `src/scripts/cost/*` | 4 | 4 | forked upstream, un-ledgered — see § What did not move | **RETIRED 2026-08-30** (see the update below) |
| 9 | `dist/agent-src/skills/design-intelligence/*` | 12 | 12 | generated projection of src (ADR-201) | kept |
| 10 | `dist/agent-src/skills/corpus-grounding/*` | 2 | 2 | generated projection of src (ADR-201) | kept |
| 11 | `dist/agent-src/skills/design-tokens/*` | 2 | 2 | generated projection of src (ADR-201) | kept |
| 12 | `dist/agent-src/skills/react-shadcn-ui/*` | 1 | 1 | generated projection of src (ADR-201) | kept |
| 13 | `dist/agent-src/skills/tailwind-engineer/*` | 1 | 1 | generated projection of src (ADR-201) | kept |
| 14 | `docs/decisions/ADR-061-corpus-grounding-layer.md` | 6 | 6 | recommendation / registry doc | kept |
| 15 | `docs/decisions/ADR-086-read-only-cross-agent-mcp-discovery-helper.md` | 12 | 12 | recommendation / registry doc | kept |
| 16 | `docs/mcp.md` | 1 | 1 | recommendation / registry doc | kept |
| 17 | `docs/mcp-registries.md` | 11 | 11 | recommendation / registry doc | kept |
| 18 | `docs/DISTRIBUTION_CHECKLIST.md` | 4 | 4 | recommendation / registry doc | kept |
| 19 | `src/templates/marketing-copy.yml` | 1 | — | single registry name in a build comment | REMOVED — comment rephrased generically |
| 20 | `internal/workers/mcp/content.json` | 2 | 2 | generated bundle | kept |
| 21 | `internal/workers/mcp/manifest.json` | 0 | — | DEAD — suppressed 0 hits | REMOVED |
| 22 | `src/rules/source-confidentiality.md` | 0 | — | DEAD — suppressed 0 hits | REMOVED |
| 23 | `dist/agent-src/rules/source-confidentiality.md` | 0 | — | DEAD — suppressed 0 hits | REMOVED |
| 24 | `agents/roadmaps/archive/road-to-final-state-and-market-readiness.md` | 10 | — | archived roadmap, by name | REMOVED — redacted in place (ADR-250) |
| 25 | `agents/roadmaps/archive/road-to-image-brand-typography.md` | 3 | — | archived roadmap, by name | REMOVED — redacted in place (ADR-250) |
| 26 | `agents/roadmaps/archive/road-to-subagent-value-realization.md` | 1 | — | archived roadmap, by name | REMOVED — redacted in place (ADR-250) |
| 27 | `agents/roadmap-assets/road-to-image-brand-typography.assets.md` | 4 | — | roadmap asset, by name | REMOVED — redacted in place (ADR-250) |
| 28 | `CREDITS.md` | 2 | 2 | license surface | kept |
| 29 | `agents/roadmaps/archive/road-to-ecosystem-harvest-index.md` | 4 | — | archived roadmap, by name | REMOVED — redacted in place (ADR-250) |
| 30 | `provenance/borrows.jsonl` | 2 | 2 | license surface | kept |
| 31 | `docs/THIRD-PARTY-NOTICES.md` | 2 | 2 | license surface | kept |
| 32 | `agents/evidence/reviews/*.review-input/diff.patch` | 0 | — | R2 snapshot capture | REMOVED — replaced by per-finding dedup (Phase 3.4) |

**Totals.** 32 entries before, 22 after — 10 removed, 22 kept. Suppressed hits at the removed entries: 23 before, 0 after. Unskipped deny hits stayed at 0, so no coverage was traded for the reduction.

## What did not move, and why

The 22 survivors are the set `road-to-source-silence` step 1.3 calls
principled, plus one entry this change deliberately did not touch.

| class | entries | why it stays |
|---|--:|---|
| gate-own | 2 | the gate script and its own config necessarily contain the patterns |
| vendored corpus / Apache-2.0 in-file notice | 5 | license-required attribution; ADR-061 |
| generated projections of those five (ADR-201) | 5 | `dist == rewrite(src)` byte-for-byte, so the content is not independently authored |
| recommendation / registry docs | 5 | naming an integrated tool is explicitly allowed by the rule |
| license surfaces | 3 | `CREDITS.md`, `THIRD-PARTY-NOTICES.md`, `provenance/borrows.jsonl` — the only three step 1.3 declares principled |
| generated bundle | 1 | `internal/workers/mcp/content.json`, regenerated from `src/` |
| forked upstream, un-ledgered | 1 | `src/scripts/cost/*` — see below |

### `src/scripts/cost/*` — the one entry that could have moved and did not

Two files there carry a `Forked from <owner>/<repo>` header comment (4
suppressed hits). That is **harvest-shaped** attribution sitting outside the
three license surfaces, so step 1.3 would move it into
`provenance/borrows.jsonl` and de-name the comment — which would take the
floor to 21.

It was not done, and the reason is a rule rather than an oversight: the
upstream license is not established anywhere in this tree (nothing in
`CREDITS.md`, `THIRD-PARTY-NOTICES.md` or `provenance/borrows.jsonl` covers
these files), and `code-provenance` says an unknown source license is never
permissive-by-default — stop and escalate, never guess. Rewriting a fork
attribution without knowing whether the license requires it in-file is
exactly that guess. It is carried into
`road-to-source-silence-cutover` as a maintainer item.

#### UPDATE 2026-08-30 — retired, and the escalation was right

`road-to-source-silence-cutover` step 2.2 established the license: **MIT**,
read from the upstream repository's own `LICENSE` rather than inferred. MIT
requires the copyright and permission notice to travel with copies and says
nothing about placement, so a distributed notice discharges it and the in-file
source name was never required. Branch (a) executed: ledger entry, notices
regenerated, both comments de-named, entry removed. **The floor is 21.**

Two things the escalation bought that a guess would not have. The in-file
comment was a *"Forked from"* line and **not** an MIT copyright or permission
notice, so the previous state discharged the obligation nowhere — it only named
a source where a rule forbids it. And verifying the *packaged* artifact, which
the resolving council made a binding precondition, turned up that
`package.json`'s `files` list carried none of `NOTICE`, `CREDITS.md`,
`docs/THIRD-PARTY-NOTICES.md` or `provenance/borrows.jsonl` while carrying
`src/scripts/` — so every notice surface was missing from the published
package, the pre-existing Apache-2.0 entry included. All four are now shipped.

## The measured floor, against the authored criterion

> **Settled 2026-08-30: the target is 21**, by AI council with 2/2 seats
> present (`road-to-source-silence-cutover` step 2.1). The paragraphs below are
> the state as measured on 2026-08-29 and are kept as written — they are the
> evidence the decision was taken on, and rewriting them to match the outcome
> would erase the question.

Step 2.3 and AC-6 as authored require **≤ 20**. The measured floor with every
principled carve-out intact is **22**, and 21 if the fork attribution above is
resolved. Reaching 20 requires removing entries from the principled set — a
license surface, a registry doc, or a vendored-corpus glob.

One further option exists and was **not** taken unilaterally: excluding
`dist/agent-src/**` as a derived surface would replace 5 entries with 1 and
reach 18. Coverage would be materially unchanged, because `dist` is a
CI-verified byte-exact projection of `src` (ADR-201) and any leak in it
implies a leak in `src` the gate already catches. The cost is visibility: a
future `src/` exception would then silently extend to `dist/`, where today it
takes two entries a reviewer can see. The agent proposing it is the party
whose acceptance criterion it would satisfy, which is why it went to the
council rather than into this change.

