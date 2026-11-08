# Compaction: session identity and summary presence, read from host transcripts

drafted-against: ceea998a0d · measured 2026-11-08 · round `inbox-2026-11-zb`

## Why this exists

Two questions were parked as "needs a live instrumented session and a human":

1. **Identity.** `rule-inject` arms its restore set under the session id at
   `pre_compact` and reads it under the session id at `session_start(compact)`
   (`src/scripts/hooks/rule_inject_hook.ts:1007–1029`); `language-mirror` does the
   same with `pinLostMarker(session_id)` (`src/scripts/language_mirror_hook.ts:208`,
   `:641–672`). Both are sound only if the host keeps the id across a compaction.
   The council record `agents/evidence/council/compact-resume-2026-10.md:34–36`
   names that "not measured".
2. **Presence.** `agents/roadmaps/stubs/road-to-compaction-survival-census.md`
   holds its whole census behind a manual compaction in a live session.

Neither needs a new session. The host already writes every compaction into the
session JSONL: a `system` record with `subtype: compact_boundary` (carrying
`compactMetadata.trigger`, `preTokens`, `postTokens`), then a `user` record with
`isCompactSummary: true` whose text is the summary the model continues from.

## Method

`./scripts-run src/scripts/compaction_census --root <projects-dir>… --canary <name>`
over the maintainer's host transcript stores (every `projects/` directory of
each configured host account), files deduplicated by real path. Output is
aggregate counts only — no path, id or text leaves the process. Reproduced
independently by a throwaway scan that compared `sessionId` on the first record
after each boundary; both gave the same boundary count.

## Result

| Measure | Value |
|---|---|
| transcripts with a compaction | 123 |
| compactions | 274, all `trigger: auto` |
| session id kept across the boundary | **274 / 274** (0 changed, 0 unobserved) |
| host versions | 2.1.277 – 2.1.316 |
| tokens before / after (median) | 404,085 → 21,697 |
| summary names an `agents/roadmaps/*.md` path | 168 / 274 (61 %) |
| summary names any `src/rules/` slug | 103 / 274 (38 %) |
| summary names the canary name | 147 / 274 (54 %) |
| summary contains "Iron Law" | 6 / 274 (2 %) |

## Reading

- **Identity — answered for automatic compaction.** The id-keyed restores in
  `rule-inject` and `language-mirror` are not running empty on the path the host
  actually takes; the fear that they "silently fail" is refuted for `auto`.
  **Not observed:** a manual `/compact` (zero in the corpus) — the one residual.
- **The council's open question is untouched.** Its verdict rests on
  *lineage*, not id equality: "id preservation alone does not establish that an
  own record is intended for reinjection" (`compact-resume-2026-10.md`). A
  same-session checkpoint written at `pre_compact` is a lineage signal the
  council has not yet judged; that is a new round, not this file's call.
- **Presence is a lower bound on presence, nothing more.** A rule slug in a
  summary is not a rule followed, and a name in a summary is not the canary
  obligation (the name also appears in quoted user text). The four probes are
  proxies chosen because they are deterministic; the adherence half of the
  census remains eval work.
- **The corpus is one maintainer's, across several repositories.** Not every
  session had a reason to name a rule or a roadmap, so the rates are not a
  per-obligation survival rate. They are a baseline that a restore mechanism has
  to move.
