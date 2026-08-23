# Importing an extracted design system

> The import contract, the supply path, the five-step procedure, and the two source shapes

_Split out of [`SKILL.md`](../SKILL.md) § Importing an extracted design system, which keeps
the one-line obligation and routes here. The split is ADR-217's rich-class ceiling doing its
job: adding the owned-components inventory took the skill to 3,764 tokens against a 3,500
ceiling, and this block is the largest self-contained one that a reader needs only when an
import is actually requested — the same lazy-load posture the schema reference already has._

A consumer can reverse-engineer an existing site/repo's look-and-feel with any
external static-extraction tool and hand the result to this skill as a
`design-system.json` artifact. We own the **import contract**, not the crawler:
the package never ships the Playwright runtime, a font-bundler, or a `.skill`
auto-installer (out of scope). Full schema is lazy-loaded from
[`design-system-json.md`](design-system-json.md) — read it
only when an import is requested.

**The supply path is real, and it is one command.** Where an extractor's output
is not already in this shape, run it through the three-lane adapter first —
`/design-system:import <file>`, which accepts a native artifact, a DTCG token
file, or an extraction tool's raw JSON and emits the contract. Lanes and
documented producers:
[`design-system-json.md`](design-system-json.md)
§ Extractor compatibility. The adapter is offline and pure — it does not change
what this skill owns.

**Import procedure:**

1. Read `design-system.json`; reject it if `source` (kind + ref + captured_at)
   is missing — no provenance, no import.
2. Diff every field against the current `DESIGN.md`.
3. Surface a **per-field confirm/merge proposal** — the artifact is *observed,
   not authoritative* (mirrors `source-discovery`). Never write silently.
4. **Conflict with a registered brand value** (a confirmed `.tokens.json` /
   brand token) → **flag, never auto-apply** (`brand-source-of-truth`:
   consumer brand wins). Precedence: brand tokens > confirmed `DESIGN.md` >
   imported observation.
5. On the human's accept, persist the chosen fields into `DESIGN.md`. Where the
   consumer wants a token source of truth, hand the mapped DTCG fields to
   [`brand-to-tokens`](../../brand-to-tokens/SKILL.md) / `design-tokens` to
   materialise `.tokens.json` — do not invent a parallel token format.

**Two sources, one shape:**

- **External target** (a site/repo you don't own) → an external tool emits the
  artifact; import it here.
- **Current repo** → prefer [`existing-ui-audit`](../../existing-ui-audit/SKILL.md);
  it already inventories the codebase and can emit the same `design-system.json`
  shape, so the import path is identical either way.
