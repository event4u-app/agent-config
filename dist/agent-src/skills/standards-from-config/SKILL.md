---
model_tier: medium
name: standards-from-config
description: "Use when you need this project's coding standards (line length, quotes, import order, naming, commit format) — derive them from the REAL tooling config as a pointer + digest, never a guessed claim."
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
---

# standards-from-config

Evidence v2 **Class A** — configured convention. The safe, on-thesis half of
self-building project context: coding standards are not *guessed* and not
*observed*, they are **derived from the real tooling config**. The config *is*
the standard; this skill produces a **pointer + digest**, never a flattened
claim. High-trust, auto-refreshable, drift-proof — because the truth lives in
the config file, and the card only points at it plus distils the 3–5 points an
agent needs most while writing.

Definitions (Class A/B/C, trust tiers, the v1↔v2 isolation contract) live in
[`evidence-discipline`](../../agent-src/contexts/execution/evidence-discipline.md);
the parent context mechanism is [`context-document`](../context-document/SKILL.md).

## When to use

- Before writing or reformatting code in an unfamiliar project and you need its
  enforced style (indent, line length, quote style, import order, naming).
- Before writing a commit message / branch name and you need the project's
  commit convention.
- When orienting in a repo and a committed Class-A standards card would save the
  next agent from re-deriving the same config.

Do NOT use for: a standard that has **no** config backing (that is a *guessed*
or *observed* convention — Class B, not A; never invent a Class-A claim); the
concrete shape of code (that is v1 `source-discovery`, read fresh); a project
with no tooling config at all (record a negative fact: "no enforced standard
found", do not fabricate one).

## Procedure

1. **Detect the real config sources** (read fresh, never from memory). Common
   sources, by ecosystem — inspect what actually exists:
   - cross-stack: `.editorconfig`, `CONTRIBUTING.md`, commitlint /
     `.gitmessage`, the lint/format steps in the CI workflow.
   - JS/TS: `eslint.config.js` / `.eslintrc*`, `.prettierrc*`, `biome.json`,
     `tsconfig.json` (strictness).
   - PHP: `pint.json`, `.php-cs-fixer.dist.php`, `phpcs.xml`.
   - Python: `pyproject.toml` / `ruff.toml` (`[tool.ruff]`, `[tool.black]`),
     `setup.cfg`.
   - Ruby: `.rubocop.yml`. Go: `gofmt`/`golangci.yml`.
2. **Derive as pointer + digest, never a flattened claim.** Each standard is one
   line: the **value**, the **config file it came from**, and the **scope** it
   applies to. Write `ruff.toml → line-length = 88 (scope: src/**/*.py)`, NOT
   "the project uses line length 88". The pointer makes the claim re-checkable
   and the next agent can open the config to confirm.
3. **Preserve scope; surface conflicts, never flatten them.** If two configs (or
   an inline / per-directory override) give two values, emit **two pointers with
   two values + their scopes** — never one ambiguous merged claim. A visible
   conflict is correct; a hidden flattened guess is the failure mode.
4. **Stamp staleness.** Record each source's `config_mtime` (or content hash).
   The digest is stale when the config file's mtime/hash changes → re-derive. No
   human gate is needed (Class A is deterministic) — the digest is **regenerated
   from the config, never hand-edited**.
5. **Persist** as a Class-A context card under `agents/settings/contexts/` (see
   Output format). Class A is high-trust *because* config-derived — it is read
   for heuristics only and never bypasses a fresh structural read (the v1↔v2
   isolation contract in `evidence-discipline`).

## Output format

A Class-A standards card MUST contain, in order:

1. **Frontmatter** `class: A`, `trust: high (config-derived)`, and a
   `sources:` list of `{path, config_mtime}` for every config the digest reads.
2. **A pointer+digest table** — one row per standard: `standard | value | source
   (file:key) | scope`. No standard appears without a `source` cell pointing at
   a real config file.
3. **A conflicts block** (may be empty) listing any standard where ≥2 sources /
   scopes disagree, as two-or-more rows, never one merged value.
4. **A refresh line** stating the card is regenerated when any listed
   `config_mtime` changes, and is read for heuristics only (never a structural
   bypass).

## Gotcha

- A standard with no config backing is **not** Class A — do not write it here;
  it is a guessed/observed convention (Class B) or nothing. Class A never
  fabricates.
- Do not flatten conflicting configs into one value — the conflict is the
  signal; surface both pointers.
- The card is a **regenerated digest**, not a hand-edited doc — editing the
  value by hand instead of the config defeats the drift-proofing.
- A green pointer is not "the code obeys this" — it means the config declares it;
  whether a given file complies is a fresh read, not this card's claim.

## Do NOT

- Do NOT emit a coding standard as a believed fact ("we use 4 spaces") — emit a
  pointer to the config that declares it.
- Do NOT merge conflicting configs into a single claim.
- Do NOT hand-edit the digest value instead of the config.
- Do NOT use a Class-A card to skip a fresh structural read (v1 stays in force).
- Do NOT commit the card without permission (`scope-control`).

## See also

- [`evidence-discipline`](../../agent-src/contexts/execution/evidence-discipline.md) — Class A/B/C, trust tiers, the isolation contract.
- [`context-document`](../context-document/SKILL.md) — the parent context mechanism + storage locations.
- [`source-discovery`](../source-discovery/SKILL.md) — v1 structural discovery (read fresh; Class A never bypasses it).
