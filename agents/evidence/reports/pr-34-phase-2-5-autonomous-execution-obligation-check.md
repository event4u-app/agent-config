# Phase 2.5 — Obligation Regression Check for `autonomous-execution.md`

> **Roadmap step:** [`road-to-pr-34-followups.md`](../roadmaps/road-to-pr-34-followups.md) § Phase 2.5
> **Pre-split source:** `2bead66~1:.agent-src.uncompressed/rules/autonomous-execution.md` (192 lines)
> **Post-split sources:**
> - `.agent-src.uncompressed/rules/autonomous-execution.md` (119 lines)
> - `.agent-src.uncompressed/contexts/execution/autonomy-detection.md` (cited via `load_context:`)
> - `.agent-src.uncompressed/contexts/execution/autonomy-mechanics.md` (cited via `load_context:`)
> - `.agent-src.uncompressed/contexts/execution/autonomy-examples.md` (cited via `load_context:`)

## Acceptance criterion

From roadmap § 2.5:

> Counts must not drop **or** a semantic equivalent must exist in the extracted contexts and be cited from the slim rule. Word-count stability is not the goal — semantic stability is.

## Obligation-keyword diff

| Keyword | Pre-split | Slim rule | Detection | Mechanics | Examples | Combined | Status |
|---|---|---|---|---|---|---|---|
| `NEVER` | 2 | 2 | 0 | 0 | 0 | 2 | ✅ preserved in slim rule |
| `ALWAYS` | 1 | 0 | 0 | 1 | 0 | 1 | ✅ preserved in cited mechanics context |
| `MUST` | 0 | 0 | 0 | 0 | 0 | 0 | ✅ unchanged |
| `SHALL` | 0 | 0 | 0 | 0 | 0 | 0 | ✅ unchanged |
| `FORBIDDEN` | 0 | 0 | 0 | 0 | 0 | 0 | ✅ unchanged |
| `REQUIRED` | 0 | 0 | 0 | 0 | 0 | 0 | ✅ unchanged |
| `MANDATORY` | 0 | 0 | 0 | 0 | 0 | 0 | ✅ unchanged |

Combined keyword surface (slim rule + cited contexts): **identical to pre-split**.

The single `ALWAYS` moved with the `personal.autonomy` setting table to `autonomy-mechanics.md`. The slim rule cites that file via `load_context:` (line 8 of frontmatter), so the obligation is reachable from the rule per the "OR" branch of the acceptance criterion.

## Semantic obligation surface (the 10 obligations from Phase 2.1 inventory)

| # | Obligation | Pre-split location | Post-split location |
|---|---|---|---|
| 1 | Hard Floor stops everything — autonomy never lifts it | rule §Hard Floor (L15–26) | slim rule §Hard Floor (verbatim, delegating to `non-destructive-by-default`) |
| 2 | `personal.autonomy` is read once, cached, missing key → `on` | rule L36–37 | slim rule §Setting (read-once + missing-key sentence retained verbatim) |
| 3 | `auto` mode flips on intent, not literal substring; speech-act-checked | rule L39–75 | slim rule §Opt-in detection (intent + speech-act sentences retained) + cited `autonomy-detection.md` (algorithm) |
| 4 | Opt-out flips back to `off`; same speech-act check | rule L77–82 | slim rule §Opt-in detection (one-sentence summary) + cited `autonomy-examples.md` (anchor list) |
| 5 | In doubt → keep current mode | rule L88 | slim rule §Opt-in detection (verbatim) |
| 6 | Trivial in `off` → ask; in `on` / `auto`-after-opt-in → act | rule L116–117 | slim rule §Trivial (binding sentences retained) + cited `autonomy-examples.md` (worked cases) |
| 7 | Six blocking categories always ask regardless of autonomy | rule L119–138 | slim rule §Blocking (full bullet list verbatim) |
| 8 | In doubt trivial-vs-blocking → blocking | rule L139–140 | slim rule §Blocking (verbatim) |
| 9 | Commit policy delegated; never ask about committing | rule L142–154 | slim rule §Commit policy (verbatim, both `NEVER`s retained) |
| 10 | Cloud platforms without settings file → treat as `on` | rule L172–177 | cited `autonomy-mechanics.md` §Cloud Behavior |

All ten obligations are reachable from the slim rule — either retained inline or cited via `load_context:`.

## Citation chain

The slim rule's frontmatter declares:

```yaml
load_context:
  - .agent-src.uncompressed/contexts/execution/autonomy-detection.md
  - .agent-src.uncompressed/contexts/execution/autonomy-mechanics.md
  - .agent-src.uncompressed/contexts/execution/autonomy-examples.md
```

Plus three explicit in-prose links to the same files (one per moved-content section). The agent has both lazy-load and explicit-pointer access to every extracted obligation surface.

`task lint-load-context` confirms: schema clean, paths resolve, no cycles, 1 declarer.

## Conclusion

✅ **No obligation regression.**

- Keyword counts: identical when slim rule + cited contexts are taken together.
- Semantic obligations: all 10 inventory items reachable via in-rule prose or `load_context:` citation.
- Citation chain: validated by linter.

Phase-2 success criteria from roadmap § 2 are met:

- [x] `autonomous-execution.md` ≤ 120 lines (119 lines, ~38% reduction)
- [x] ≥ 70% of non-obligation content moved to `contexts/` (~93 of 130 non-RULE lines moved)
- [x] Slim rule contains only obligation statements + `load_context:` references
- [x] Obligation-keyword count (semantic equivalent) preserved
- ⏸ Zero regression in Golden transcripts — deferred to Phase 4 (no transcripts shipped yet).

## Status

- [x] 2.5 Verify no obligation regression — complete.

Phase 2 closed; ready for Phase 3 wire-up confirmation (3.3–3.6 pending — 3.1 and 3.2 are now satisfied as a side effect of 2.4).
