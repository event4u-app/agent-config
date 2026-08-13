# Command frontmatter — per-host projection parity

> Which command frontmatter fields each host bridge actually consumes, and the
> deliberate divergences from the official command-authoring field standard.
> Source of truth for command definitions: `src/domains/<pack>/<name>/command.md`
> (projected verbatim to `dist/agent-src/commands/` by the condensation
> pipeline). Schema: [`command.schema.json`](../../src/scripts/schemas/command.schema.json).
> Roadmap origin: `road-to-ecosystem-harvest-skill-quality-gates` Phase 4 (Source C).

## Projection paths per host

| Host | Projection | Frontmatter reaches host? |
|---|---|---|
| Claude Code | `.claude/skills/<slug>/SKILL.md` — symlink to the command source; rendered copy (with native `model:`) when `model.auto_switch: auto` and a `model_tier` maps | Yes — full frontmatter, verbatim |
| Cursor | `.cursor/commands/<slug>.md` — symlink to the command source | Yes — file verbatim; Cursor treats unknown frontmatter as inert |
| Windsurf | `.windsurf/workflows/<slug>.md` — symlink to the command source | Yes — same inert-passthrough as Cursor |
| Cline / Gemini / Copilot / Roo / Codex / Continue | Text reference via `AGENTS.md` only (no native command surface) | No — invocation is conversational |

## Field consumption matrix (official-standard fields)

| Field | Claude Code | Cursor / Windsurf | Notes |
|---|---|---|---|
| `name` | ✅ load rule: must equal the skill directory slug | inert | Path-derived hyphen slug; enforced by `check_host_loadability` |
| `description` | ✅ routing + display | inert | ≤ 200 chars per schema |
| `argument-hint` | ✅ rendered next to the slash command | inert | Added Phase 4; set on every command whose body documents an invocation argument (140/183 at introduction) |
| `disable-model-invocation` | ✅ honored natively | inert (vacuously true — no model-invocation surface) | Schema pins `enum: [true]` — commands are user-invoked by design |
| `model` | ✅ (rendered copies only) | inert | Never authored by hand: the generator rewrites `model_tier:` → native `model:` at projection time (ADR-034/035) |

All other fields (`visibility`, `pack`, `cluster`, `intent`,
`routes_to`, `replaces`, `suggestion`, `workspaces`, `packs`, `trust`,
`install`, `model_tier`, …) are **suite governance metadata** — consumed by the
package's own linters, router, discovery manifest, and docs generators, never
by a host. Hosts that read the file verbatim ignore them; that is the intended
contract, not drift.

## Deliberate divergences from the official standard

1. **No colon names.** The official examples allow `/cluster:sub` invocation;
   this suite forbids colons in `name:` (Agent-Skills-spec compliance for
   strict consumers like Zed). Claude Code's `/cluster:sub` invocation still
   works — it is path-derived from `commands/<cluster>/<sub>.md`, not from the
   `name:` field.
2. **`disable-model-invocation` is locked to `true`.** The standard allows
   model-invocable commands; this suite's commands are always user-invoked
   (`command-suggestion-policy` owns proactive surfacing instead — suggest,
   never invoke).
3. **`model` is generated, never authored.** Authors declare the
   vendor-neutral `model_tier:`; the Claude bridge renders a native `model:`
   only when the consumer opted into `model.auto_switch: auto`.
4. **`argument-hint` is host-passthrough.** Only Claude Code renders it today;
   it stays in the neutral source (harmless elsewhere) rather than being
   projected host-specifically — per the do-NOT-chase-host-fields rule for the
   neutral tree.

## Verification

- `./scripts-run src/scripts/validate_frontmatter` — every command validates
  against the schema (including `argument-hint` shape, ≤ 120 chars).
- `./scripts-run src/scripts/check_host_loadability --root .` — generated
  `.claude/skills/` entries parse and satisfy the host load rule.
