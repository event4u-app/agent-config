# Phase 2.1 — Inventory of `autonomous-execution.md`

> **Roadmap step:** [`road-to-pr-34-followups.md`](../roadmaps/road-to-pr-34-followups.md) § Phase 2.1
> **Source under inventory:** `.agent-src.uncompressed/rules/autonomous-execution.md` (192 lines, 9.4 kB)
> **Goal of inventory:** classify every section so 2.2 (LOGIC + MECHANICS → contexts/) and 2.3 (EXAMPLES → examples/) can be executed without obligation regression.

## Classification scheme

| Class | Definition | Target in 2.2–2.4 |
|---|---|---|
| **RULE** | Obligation, prohibition, or hard cross-reference to a canonical rule. The decision the agent acts on. | Stays in the rule file. |
| **LOGIC** | Decision procedure, heuristic, disambiguation algorithm — *how* to recognize a trigger. | `.agent-src.uncompressed/contexts/autonomy-detection.md` (lazy `load_context:`). |
| **MECHANICS** | Schema, config-value semantics, platform notes, cross-ref tables — supporting infra. | `.agent-src.uncompressed/contexts/autonomy-mechanics.md` (lazy). |
| **EXAMPLE** | Anchor lists, illustrative cases, failure-mode enumerations. Content the rule cites but does not need to obey. | **Schema-gap — see § Schema decision needed.** |

## Section-by-section inventory

| Lines | Section | Class | Notes |
|---|---|---|---|
| 1–6 | Frontmatter | MECHANICS | `type: "auto"` + description. Stays in rule (required by tooling). |
| 8–13 | Title + intro paragraph | RULE | Defines scope: trivial / blocking / hard floor / commit default. Keep verbatim. |
| 15–26 | Hard Floor delegation | RULE | Pure delegation to `non-destructive-by-default`. Obligation: "stop and ask". 12 lines, all retained. |
| 28–34 | `personal.autonomy` setting table | MECHANICS | Three-row config table (`on` / `off` / `auto`). Move to mechanics context; rule keeps a one-line pointer. |
| 36–37 | Read-once + cache + missing-key | RULE | "Read the value once and cache. Missing key → treat as `on`." Keep in rule. |
| 39–44 | Opt-in detection intro | LOGIC | "Recognize intent, not literal substring." Move to detection context. |
| 46–49 | DE/EN opt-in anchor examples | EXAMPLE | 4 anchor phrases (DE+EN). Move to examples. |
| 51–55 | Litmus test + single-decision delegation | LOGIC | Disambiguation between standing-permission and one-shot delegation. Move to detection context. |
| 57–62 | Speech-act check intro (H3) | LOGIC | "Phrase must be meta-instruction to the agent." Move to detection context. |
| 64–71 | Speech-act don't-flip cases | EXAMPLE | 6 illustrative non-trigger patterns (content / quote / subject / code / third-party / question). Move to examples. |
| 73–75 | Heuristic (strip-and-read) | LOGIC | The actual algorithm. Move to detection context. |
| 77–80 | Opt-out anchor examples | EXAMPLE | DE/EN reverse-trigger phrases. Move to examples. |
| 82 | "Same speech-act check applies" | RULE | One-liner obligation, restates the gate. Keep in rule. |
| 84–88 | Counter-examples (no-flip cases) | EXAMPLE | Meta-questions, self-descriptions, one-shot delegations. Move to examples. |
| 89 | "In doubt → keep current mode" | RULE | Default-safe statement. Keep in rule. |
| 90–115 | Trivial-act enumeration (8 cases) | EXAMPLE | Lengthy enumeration of "just act" patterns. Move to examples. |
| 116–117 | Trivial-act binding (`off` vs `on`) | RULE | One sentence binding examples to setting values. Keep in rule. |
| 119–140 | Blocking obligations (6 bullets) | RULE | Vague-request / architectural / security / scope / remote-state / destructive. All cross-references to canonical rules. Keep verbatim — this is the core obligation block. |
| 139–140 | "When in doubt → blocking" | RULE | Default-safe statement. Keep. |
| 142–154 | Commit policy delegation + summary | RULE | Delegation to `commit-policy` + 3 summary bullets ("NEVER commit", "NEVER ask", autonomous-mode pre-scan). Keep verbatim. |
| 156–164 | Failure modes (autonomy side, 5 bullets) | EXAMPLE | Wrong-behavior patterns. Move to examples. |
| 166–170 | Failure-mode pointer to Hard Floor | RULE (delegation) | Two-sentence pointer with a list. Keep — it's a cross-rule routing instruction. |
| 172–177 | Cloud Behavior | MECHANICS | Platform default for missing settings file. Move to mechanics context; rule keeps a one-liner pointer. |
| 179–192 | See also | MECHANICS | Cross-reference list (5 entries). Stays in rule (link surface), but compact form. |

## Aggregate counts

| Class | Lines (content, excl. blank) | Share | After split |
|---|---|---|---|
| RULE | ~62 | 40% | stays in rule |
| LOGIC | ~22 | 14% | → `.agent-src.uncompressed/contexts/autonomy-detection.md` |
| MECHANICS | ~28 | 18% | → `.agent-src.uncompressed/contexts/autonomy-mechanics.md` |
| EXAMPLE | ~43 | 28% | → see § Schema decision needed |
| **Total content** | **~155** | **100%** | rule-only target ≤ 90–95 lines |

The 192-line file size includes ~37 blank/separator lines. The 90-line rule-only target is below the 120-line ceiling defined in roadmap § Phase 2 success criteria, with ~25-line headroom.

## Obligation-keyword baseline (for 2.5 verification)

```
NEVER     2
ALWAYS    1
MUST      0
SHALL     0
"do not"  1   (lowercase, prose)
stop      8   (mostly content, not obligation marker)
ask       18  (mostly content)
```

This rule uses **prose obligations** ("Read the value once...", "When in doubt → blocking", "NEVER commit unless..."), not capital-letter Iron-Law markers. The 2.5 acceptance criterion ("counts must not drop **or** semantic equivalent") is the right target — a regex-only check would miss the actual obligation surface.

**Semantic obligation inventory (the surface that must survive 2.4):**

1. Hard Floor stops everything — autonomy never lifts it.
2. `personal.autonomy` is read once, cached, missing key → `on`.
3. `auto` mode flips on intent, not literal substring; speech-act-checked.
4. Opt-out flips back to `off`; same speech-act check.
5. In doubt → keep current mode.
6. Trivial in `off` → ask; trivial in `on` / `auto`-after-opt-in → act.
7. Six blocking categories always ask regardless of autonomy.
8. In doubt trivial-vs-blocking → blocking.
9. Commit policy delegated to canonical rule; never ask about committing.
10. Cloud platforms without settings file → treat as `on`.

These ten obligations are the regression-test surface for 2.5.

## Schema decision needed (blocks 2.3)

**Conflict:** Roadmap § Phase 2.3 says *"Extract EXAMPLES to `examples/rules/`."*
Schema (`docs/contracts/load-context-schema.md` line 48) only allows
`.agent-src.uncompressed/contexts/`, `agents/contexts/`, `.agent-src/contexts/`.

Three resolutions, ranked by minimal-safe-diff:

1. **Reuse `contexts/` for examples** — file e.g. `.agent-src.uncompressed/contexts/autonomy-examples.md`. Schema stays as-is, 2.3 just renames the target. Lowest blast radius.
2. **Extend schema** — add `examples/` as a fourth allowed root, update linter, update STABILITY note. Larger change but matches the roadmap wording.
3. **Inline examples in the LOGIC/MECHANICS context files** — no separate examples file at all; LOGIC context contains its own anchor lists. Smallest file count, highest coupling.

Recommended: **option 1**. Examples are reference material like contexts, the schema's intent ("knowledge available on demand") covers them, and option 1 keeps the contract surface untouched while the first consumer ships. Decision needed before 2.2 starts because the new file's `load_context:` entries depend on it.

## Status

- [x] 2.1 Inventory complete.
- [ ] 2.2 Awaiting schema decision (above).
- [ ] 2.3, 2.4, 2.5 follow.
