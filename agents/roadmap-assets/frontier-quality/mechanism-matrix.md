# Frontier-Quality Mechanism Matrix

Phase 1 of `road-to-frontier-quality-operating-system`. Source-anonymous
inventory of every transferable mechanism from the harvested prompt families,
each with a **carrier disposition**, existing coverage, dependency ids, conflict
ids, and rollout state. Downstream phases reference row ids (`FQ-*`). Provenance
is checksums + local-only notes (per `quality-metrics.md` § 3); no named source
or raw link appears here.

Carrier vocabulary: `kernel-rule` · `auto-rule` · `skill` · `command` ·
`contract` · `eval` · **`covered`** (already shipped — cite owner, do not
duplicate) · **`reject`** (host/vendor-specific).

## Matrix

| id | Mechanism | Carrier | Existing coverage / owner | Missing acceptance gate | Deps | Rollout |
|---|---|---|---|---|---|---|
| FQ-01 | Currentness-risk classification | `auto-rule` (Phase 3) | partial — none dedicated | trigger recall on fast-changing-fact set | — | advisory |
| FQ-02 | Tool priority (project/official first) | `contract` (Phase 3) | partial — `surface-agent-contracts` tool-composition | negative precision (web-before-internal) | FQ-01 | advisory |
| FQ-03 | Research-mode routing (deep-research, ≤3 Qs) | `covered` | `research:deep`/`research:report` + execution-discipline disconfirmation/per-part grounding | — | routed |
| FQ-04 | Memory application gating (3 classes) | `contract` (Phase 4) | partial — `memory-consolidation` write-guards | non-application precision | FQ-14 | advisory |
| FQ-05 | Preference/sycophancy hard floor | `covered` | `memory-consolidation` (refuse self-harmful standing prefs) + `direct-answers` (no-flattery) | — | default-on |
| FQ-06 | Prior-conversation retrieval decision | `contract` (Phase 4) | partial — chat-history import | "no I-don't-see-it before searching" eval | FQ-04 | advisory |
| FQ-07 | Artifact carrier routing (inline/file/visual/app) | `contract` (Phase 5) | partial — `surface-agent-contracts` taxonomy | 5 golden carrier-split tasks | FQ-08 | advisory |
| FQ-08 | Connected-app/MCP-first for owned data | `covered` | `surface-agent-contracts` (MCP/connector row + conflict rule) | — | routed |
| FQ-09 | Visual/diagram routing | `contract` (Phase 5) | partial — `surface-agent-contracts` visualizer row | visual-trigger negative examples | FQ-07 | advisory |
| FQ-10 | Citation + quoting discipline | `covered` | `content-quoting-floor` (15-word cap, one-quote-per-source, no displacive summary) | — | default-on |
| FQ-11 | Domain overlays (finance/legal/research/rec) | `contract` (Phase 6) | partial — `spreadsheet-source-quality`, `legal-safety-floor`, `domain-safety-*` | overlay-boundary eval (no over-cite prose) | FQ-10, FQ-02 | advisory |
| FQ-12 | Claim self-check (stable/cited/uncertain) | `auto-rule` (Phase 6) | partial — `direct-answers` IL2 (no invented facts) | post-retrieval self-check eval | FQ-10 | advisory |
| FQ-13 | Design verification (render before claim) | `covered` | `design-artifact-verification` + `design-artifact-lifecycle` | — | routed |
| FQ-14 | Surface-specific office/browser/mobile/code contracts | `covered` | `surface-agent-contracts` (+ spreadsheet-authoring, deck/doc floors) | — | routed |
| FQ-15 | Conversational formatting (mobile/chat) | `covered` | `surface-agent-contracts` § Mobile/chat interaction floor | — | advisory |
| FQ-16 | Cross-surface handoff envelope | `covered` | `surface-agent-contracts` § Cross-surface handoff envelope | — | routed |
| FQ-17 | No-time-estimates | `covered` | `direct-answers` § no-duration | — | default-on |
| FQ-18 | Verification honesty (prove-or-caveat) | `covered` | `verify-before-complete` + `design-artifact-verification` Iron Law | — | default-on |

## Dependency graph (hidden coupling made explicit)

- **Currentness feeds citation/source-quality:** FQ-01 → FQ-02 → FQ-10/FQ-11 (a freshness miss upstream poisons every cited claim downstream).
- **Tool composition feeds artifact routing:** FQ-02 → FQ-07/FQ-08 (where data lives decides the carrier).
- **Capability maps feed design + surface contracts:** `design-artifact-verification` + `host-capabilities.yml` → FQ-13/FQ-14 (a gate is never default-on where the host lacks the primitive).
- **Memory safety feeds personalization + prior-chat retrieval:** FQ-04 → FQ-05/FQ-06 (the safety floor gates what personalization may apply).

## Conflict-resolution tie-breakers (deterministic)

1. **Safety / verification floors beat preference + tone** (FQ-05, FQ-18 win over FQ-15).
2. **Project/internal data beats public web for internal facts** (FQ-08 > ordinary web in FQ-02).
3. **Connected app beats browser for owned data** (FQ-08 > browser fetch).
4. **Explicit user file request beats inline brevity** (FQ-07 file-trigger > mobile brevity FQ-15).
5. **Host capability limits beat aspirational workflow wording** (`host-capabilities.yml`/`design-artifact-verification` degrade > any FQ-* "should").

## Rejected (do not adopt)

- Vendor product claims + exact model names — `source-confidentiality` + `direct-answers` (no vendor comparison).
- Environment-specific tool syntax — host-owned, not portable.
- Hidden system-prompt secrecy boilerplate — the host already owns refusal; `direct-answers` § never-cite-the-rule already forbids "my rules require X".
- Anything conflicting with `source-confidentiality` (named sources / raw links).

## Linter-friendly convention (Phase 1 §6)

Every future external-prompt-harvest roadmap MUST include a mechanism matrix
(this shape) or cite an existing one — recorded in
[`roadmap-writing` § 8](../../../src/skills/roadmap-writing/SKILL.md) (source-derived
roadmaps gap-table + provenance). The gap-table `KEEP`/`FOLD`/`CUT` audit that
skill already mandates IS the per-roadmap mechanism-matrix discipline; this row
makes the tie explicit so a harvest cannot skip the disposition step.

## Disposition summary

Of 18 mechanisms: **9 already covered** by shipped rules (the injection-authority,
execution-discipline, design-artifact, and surface-contract harvests + kernel
rules) — cite, never duplicate. **9 need a planning contract or auto-rule**
(Phases 3–6), each landing in a follow-up **implementation** roadmap per the
Phase-0 execution contract (this program roadmap produces the governed plan +
eval gates; it does not ship the src rules itself — acceptance criterion §5).
