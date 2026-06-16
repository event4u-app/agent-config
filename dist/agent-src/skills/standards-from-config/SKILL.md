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

Evidence v2 **Class A** — configured convention. Coding standards are not *guessed*
and not *observed* — **derived from the real tooling config**. The config *is* the
standard; this skill produces a **pointer + digest**, never a flattened claim.
High-trust, auto-refreshable, drift-proof.

Definitions (Class A/B/C, trust tiers, the v1↔v2 isolation contract) live in
[`evidence-discipline`](../../agent-src/contexts/execution/evidence-discipline.md);
parent context mechanism is [`context-document`](../context-document/SKILL.md).

## When to use

- Before writing or reformatting code in an unfamiliar project — need enforced style.
- Before writing a commit message / branch name — need project's commit convention.
- When orienting in a repo and a committed Class-A standards card would save the
  next agent from re-deriving the same config.

Do NOT use for: a standard with **no** config backing (that's Class B or nothing —
never invent a Class-A claim); concrete shape of code (that's v1 `source-discovery`,
read fresh); project with no tooling config (record a negative fact).

## Procedure

1. **Detect real config sources** (read fresh, never from memory). By ecosystem — inspect
   what actually exists:
   - cross-stack: `.editorconfig`, `CONTRIBUTING.md`, commitlint / `.gitmessage`, CI lint steps.
   - JS/TS: `eslint.config.js` / `.eslintrc*`, `.prettierrc*`, `biome.json`, `tsconfig.json`.
   - PHP: `pint.json`, `.php-cs-fixer.dist.php`, `phpcs.xml`.
   - Python: `pyproject.toml` / `ruff.toml` (`[tool.ruff]`, `[tool.black]`), `setup.cfg`.
   - Ruby: `.rubocop.yml`. Go: `gofmt`/`golangci.yml`.
2. **Derive as pointer + digest, never a flattened claim.** Each standard is one line:
   the **value**, the **config file it came from**, and the **scope**. Write
   `ruff.toml → line-length = 88 (scope: src/**/*.py)`, NOT "the project uses line
   length 88". The pointer makes the claim re-checkable.
3. **Preserve scope; surface conflicts, never flatten them.** Two configs or an inline
   override disagree → emit **two pointers with two values + their scopes** — never
   one ambiguous merged claim. A visible conflict is correct.
4. **Stamp staleness.** Record each source's `config_mtime` (or content hash).
   Digest is stale when config file's mtime/hash changes → re-derive. No human gate
   needed (Class A is deterministic) — digest **regenerated from config, never
   hand-edited**.
5. **Persist** as a Class-A context card under `agents/settings/contexts/`. Class A is
   high-trust *because* config-derived — read for heuristics only, never bypasses a
   fresh structural read (v1↔v2 isolation contract).

## Output format

A Class-A standards card MUST contain, in order:

1. **Frontmatter** `class: A`, `trust: high (config-derived)`, and a `sources:` list
   of `{path, config_mtime}` for every config the digest reads.
2. **A pointer+digest table** — one row per standard: `standard | value | source
   (file:key) | scope`. No standard appears without a `source` cell.
3. **A conflicts block** (may be empty) — any standard where ≥2 sources/scopes
   disagree, as two-or-more rows, never one merged value.
4. **A refresh line** — card is regenerated when any listed `config_mtime` changes;
   read for heuristics only (never a structural bypass).

## Gotcha

- A standard with no config backing is **not** Class A — do not write it here; it is
  Class B (observed) or nothing. Class A never fabricates.
- Do not flatten conflicting configs into one value — the conflict is the signal.
- Card is a **regenerated digest**, not a hand-edited doc — editing the value by hand
  defeats drift-proofing.
- A green pointer is not "the code obeys this" — it means the config declares it;
  whether a given file complies is a fresh read.

## Do NOT

- Do NOT emit a coding standard as a believed fact — emit a pointer to the config.
- Do NOT merge conflicting configs into a single claim.
- Do NOT hand-edit the digest value instead of the config.
- Do NOT use a Class-A card to skip a fresh structural read (v1 stays in force).
- Do NOT commit the card without permission (`scope-control`).

## See also

- [`evidence-discipline`](../../agent-src/contexts/execution/evidence-discipline.md) — Class A/B/C, trust tiers, the isolation contract.
- [`context-document`](../context-document/SKILL.md) — parent context mechanism + storage locations.
- [`source-discovery`](../source-discovery/SKILL.md) — v1 structural discovery (read fresh; Class A never bypasses it).
