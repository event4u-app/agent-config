/**
 * Shared `model_tier` → native Claude `model:` mapping (ADR-034 / ADR-035).
 *
 * TypeScript twin of `src/scripts/_lib/model_tier.py` (ADR-090 —
 * Python→TS migration, Phase 2 / Wave 1). Public API mirrors the
 * Python module exactly (snake_case kept deliberately).
 *
 * Single source of truth for the tier→model rewrite, used by **both**
 * render paths so they can never drift:
 *
 * - the repo generator (`condense.py generate_claude_skills`), which
 *   builds the package's own `.claude/skills/` tree, and
 * - the consumer install finalizer
 *   (`install.py finalize_claude_model_tiers`), which rewrites the
 *   installed `.claude/skills/` tree so Claude Code performs the
 *   per-turn model switch on a consumer with `model.auto_switch: auto`.
 *
 * Only `auto` triggers the rewrite — `suggest` / `off` keep skills as
 * pure symlinks so the package never silently overrides a user's
 * explicit `/model` choice. A skill with `model_tier: inherit` (or no
 * `model_tier`) is never rewritten.
 */

import fs from "node:fs";

// Tier → Claude model. The ONLY per-vendor mapping the package maintains
// (ADR-035 § 3); other agents resolve the tier band to their own line-up.
export const TIER_TO_CLAUDE_MODEL: Record<string, string> = {
  high: "opus",
  medium: "sonnet",
  lite: "haiku",
};

// Matches a `model_tier: <tier>` frontmatter line (quoted or bare).
export const MODEL_TIER_RE = /^model_tier:\s*"?([a-z]+)"?\s*$/m;

/** Return the `model_tier` frontmatter value, or null if absent/unparsable. */
export function read_model_tier(skill_md: string): string | null {
  if (!fs.existsSync(skill_md)) return null;
  // Buffer.toString("utf8") substitutes U+FFFD for invalid sequences —
  // same tolerance as Python's errors="replace".
  const text = fs.readFileSync(skill_md).toString("utf-8");
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return null;
  const m = MODEL_TIER_RE.exec(text.slice(4, end));
  return m ? (m[1] as string) : null;
}

/**
 * Rewrite the first `model_tier: <tier>` line to native `model: <mapped>`.
 *
 * The rest of the SKILL.md stays byte-identical. `tier` must be a key
 * of `TIER_TO_CLAUDE_MODEL` (callers gate on that) — an unknown tier
 * throws, mirroring Python's `KeyError`.
 */
export function render_native_model_md(text: string, tier: string): string {
  const model = TIER_TO_CLAUDE_MODEL[tier];
  if (model === undefined) {
    // Python raises KeyError('<tier>') here.
    throw new Error(`'${tier}'`);
  }
  // Non-global regex → replaces the first match only (re.sub count=1).
  return text.replace(MODEL_TIER_RE, `model: ${model}`);
}
