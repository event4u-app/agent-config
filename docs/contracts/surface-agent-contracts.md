---
stability: beta
keep-beta-until: 2026-11-24
keep-beta-reason: >-
  Beta review 2026-09-05. Normatively dependent on `design-artifact-verification.md`
  at §§ 15-18 and 63, where it is the design surface's truth source; that contract
  is extended to 2026-11-24 here, and this file takes the same date because they
  are one review. Independently unpromotable: its own § 13 self-description
  "advisory first" is still accurate 57 days on. Three of eleven surfaces are at
  advisory (spreadsheet, deck, document); the other eight have no artefact
  referencing the contract at all. The advisory-to-routed transition has no
  mechanism — `tests/surface-contracts/` holds the fixture file and nothing else,
  no runner, no Taskfile target, no CI registration — so "eval fixtures pass" can
  never be reported. Before the window ends: a runner or a recorded rubric pass
  exists for those fixtures, and the browser row at § 67 names a real owner or is
  marked unowned; no `src/skills/browser/` exists today.
---

# Surface-Agent Contracts — medium invariants, not one generic agent

Backbone for `road-to-surface-specific-agent-contracts`.
One generic agent does every medium badly. Each **surface** (spreadsheet, deck,
document, browser, mobile/chat, code, …) has non-negotiable local invariants and
its own verification truth source. This contract names them, maps them to owner
skills, and defines how the agent detects a surface, resolves conflicts, and
hands off between surfaces — advisory first (staged rollout below).

Capability + honest-degrade for the *verification* primitives these contracts
rely on is the sibling [`design-artifact-verification`](design-artifact-verification.md)
(browser / screenshot / pdf_render / doc_export / image_decode / static_inspect);
this contract adds the office/data primitives and the surface-routing layer.

## Iron Law — the medium's truth source verifies the work

```
EACH SURFACE HAS A NON-NEGOTIABLE INVARIANT AND ITS OWN TRUTH SOURCE.
VERIFY WITH THE MEDIUM'S TRUTH SOURCE — A FORMULA READ-BACK, A RENDERED SLIDE,
A FETCHED PAGE — NEVER A GENERIC "LOOKS RIGHT". WHEN THE SURFACE TOOL IS
ABSENT, SAY WHAT COULD NOT BE VERIFIED — NEVER PRETEND THE MEDIUM STEP RAN.
```

## Surface detection — before applying any surface rule

Resolve the surface from these signals, in priority order:

1. **Explicit file type** — `.xlsx`/`.csv` → spreadsheet, `.pptx`/`.key` → deck, `.docx`/`.md` → document, `.ipynb` → notebook.
2. **Requested output format** — "as a deck", "export to PDF", "a spreadsheet".
3. **Named tool / plugin / connector** — a named app connector wins over generic browsing.
4. **User environment** — mobile/chat host vs desktop IDE vs CI.
5. **Data shape** — tabular/numeric → spreadsheet; slides → deck; prose → document.
6. **Task verb** — "chart", "model", "present", "browse", "refactor".
7. **Target deliverable** — what the user will actually use.

**Ambiguity handling.** When ≥2 surfaces plausibly apply and the choice changes
the work materially, ask ONE compact question (per
[`ask-when-uncertain`](../../src/rules/ask-when-uncertain.md)); when the user
already constrained it, proceed and state the surface assumption.

## Surface conflict rule

When the user asks for output **native to a different connected surface**,
delegate to (or ask to enable) that surface — do not force a local workaround.
A request for a spreadsheet answered with a markdown table, or a deck answered
with prose, is a surface violation. Prefer the connected surface; if it is
unavailable, say so and offer the degraded form explicitly as degraded.

## Surface taxonomy

Each surface records: **owner** skills/commands · **allowed** tools · **forbidden**
shortcuts · **truth source** (how the medium verifies) · **handoff** in/out ·
**trigger** examples · **capability** requirement · **degrade** language.

| Surface | Owner skills | Forbidden shortcut | Truth source | Capability → degrade |
|---|---|---|---|---|
| **code** | `scope-control`/`verify-before-complete` (rules), stack skills | edit unread files; broad refactor around a fix | tests + type-checker + fresh run | local exec → static-only caveat |
| **design** | `fe-design`, `design-review`, `existing-ui-audit` | taste before inspecting the system | rendered artifact ([design-artifact-verification](design-artifact-verification.md)) | browser/screenshot → static caveat |
| **spreadsheet** | `spreadsheet-authoring` (Phase 2) | hardcode a computed value; unofficial financial source unmarked | formula read-back after write | native tooling → exported-file only → "cannot verify" |
| **document** | `doc-coauthoring`, `markitdown` | rasterize selectable text to PDF | open/export readback | doc parser → format caveat |
| **deck** | `html-deck` | build slides before an outline; tiny text | export + slide render | deck export → outline-only caveat |
| **browser** | `browser` surface (Phase 4), MCP fetch | invent a URL; fetch when not needed | the fetched page itself | fetch → "not fetched, cannot confirm" |
| **mobile/chat** | interaction floor (Phase 5) | markdown tables in narrow chat; multi-question walls | the host's rendering | tappable UI → concise text choices |
| **research** | `research:deep`/`research:report` | claim without a retrieved source | per-part grounding + disconfirmation | — |
| **visualizer/diagram** | `html-deck`, image skills | decorative chart over the data's shape | the rendered diagram | render → described-structure caveat |
| **cowork/dispatch** | `subagent-orchestration` | one agent doing parallel-safe work serially | verified subagent returns | spawn primitive → in-session |
| **MCP/app connector** | `mcp` | generic web search when a connector fits | the connector's own result | connector present → suggest/opt-in |

This taxonomy table **is** the canonical work-surface map. (Note: the existing
`src/config/surface-matrix.yml` is a *different* concept — per-tool **install-surface**
de-duplication, set-equality-enforced against `install.ts::USER_SCOPE_PATHS` by
`lint_surface_matrix`; extending it with *work* surfaces would break that
linter, so the work-surface map lives here, not there.) Host verification
capability is `src/config/host-capabilities.yml` +
[`design-artifact-verification`](design-artifact-verification.md). Carrier
choice vs host capability vs these invariants stay aligned with the
artifact-routing work — do not let the three diverge.

## Staged rollout

Each surface contract: **advisory** (skills reference the invariant) →
**routed** (owner skills updated + eval fixtures pass) → **default-on** only
once the host capability/degrade behaviour is documented for that surface. A
contract is never default-on for a host class that cannot run the surface's
truth-source check — it stays advisory + caveat there.

## Cross-surface handoff envelope

When work moves between surfaces (spreadsheet → deck, research → document,
browser evidence → report, design prototype → production code), the source
surface emits a **handoff envelope** the target consumes instead of redoing
work:

```
source_surface · target_surface · user_goal · assets/files ·
constraints · verification_already_done · pending_checks ·
capability_limits · assumptions · privacy/source_restrictions
```

- The target surface **trusts `verification_already_done`** and does not repeat
  it; it runs only `pending_checks`.
- The target honours `privacy/source_restrictions` — a source-specific
  restriction (e.g. an internal-only dataset) is never widened by the handoff.
- **Degrade:** if the target surface's tooling is absent, the envelope remains a
  durable **plan** (what to do + what is verified) — never a faked generated
  artifact.

## Mobile/chat interaction floor

Interaction style is host-sensitive, not one verbose desktop default.

- **Narrow-chat output.** Avoid markdown tables in a narrow chat host; use short
  prose/bullets. Keep post-tool summaries short.
- **Ask at most one compact question**, and only when it changes the work:
  - **No options** when the user asked for the agent's *analysis* of A vs B — give the recommendation (fixture `ssac-a-or-b-analysis`).
  - **Offer options** when *eliciting a preference* — tappable choices where the host supports them, degrading to concise text choices otherwise (fixture `ssac-preference-elicitation`).
  - **Proceed on stated constraints** when the prompt already fixes them — no redundant questions (fixture `ssac-enough-constraints-no-question`).

## Code surface — audit dispositions (Phase 6)

The external code-prompt mechanisms, audited against existing rules — **covered**
(cite the owner, do not duplicate), **tightened** (a note added), or **rejected**
(host-specific):

| Mechanism | Disposition | Owner / note |
|---|---|---|
| Read before proposing | **covered** | `think-before-action`, `source-discovery-gate` (fixture `ssac-edit-unread-file`) |
| Minimal scoped changes | **covered** | `minimal-safe-diff` (fixture `ssac-broad-refactor-around-bugfix`) |
| Todo/task visibility | **covered** | host task tooling + roadmap loop; no new rule |
| Parallel independent exploration | **tighten** | note in `subagent-orchestration` / this contract's cowork row — sequential independent reads when parallel is available is a miss |
| Specialized tools over shell | **covered** | `mcp` § tool-tier ladder (execution-discipline harvest) |
| No shell as user communication | **covered** | `output-discipline` / `direct-answers` |
| Line-specific references | **covered** | `file_path:line` convention in host instructions |
| No time estimates | **covered** | `direct-answers` § no-duration (execution-discipline harvest) |
| Fresh verification before "done" | **covered** | `verify-before-complete` (fixture `ssac-claim-done-without-verification`) |

No new code-surface rule is created — the deltas are already owned; the one
**tighten** (parallel-safe exploration) is recorded here + in the cowork row. No
Codex/host-specific phrasing is adopted.

## Rejected (host/vendor-specific — not adopted)

Vendor-specific tool names, per-host UI affordance details, and single-provider
prompt phrasings from the source family are **not** adopted here — this contract
encodes surface invariants, not one vendor's tooling. Per-phase rejects are
recorded in the roadmap.

## Related

- [`design-artifact-verification`](design-artifact-verification.md) — verification-primitive capability + honest-degrade (design surface).
- [`design-artifact-lifecycle`](design-artifact-lifecycle.md) — the design surface's own lifecycle.
- [`host-capability-manifest`](../../src/agent-src/contexts/execution/host-capability-manifest.md) — subagent primitives (cowork/dispatch surface).
- [`tests/surface-contracts/eval-fixtures.md`](../../tests/surface-contracts/eval-fixtures.md) — the surface-contract eval fixtures.
