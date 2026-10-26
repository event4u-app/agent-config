#!/usr/bin/env node
/**
 * lint_design_slop — deterministic anti-slop DETECTOR for consumer projects.
 *
 * The aesthetic-PROVENANCE layer that `lint_design_quality` deliberately omits.
 * It scans HTML/CSS/JSX/Markdown for the "AI tells" catalogued in
 * `docs/guidelines/design-antipatterns.md` and emits structured findings
 * (rule-id + catalog-id + severity P0–P3 + file:line). The rule registry lives
 * in `design_slop_rules.ts`.
 *
 * FLAGS, NEVER A HARD BLOCK. Default exit is 0 regardless of findings — slop
 * tells are rebuttable presumptions, not failures. CI opts into failing with
 * `--fail-on <P0|P1|P2|P3>` (fails when any finding at or above that severity
 * remains). This honours the council 2026-06-28 "flags not blocks" verdict.
 *
 * Zero runtime token cost: this runs in Node (CI / pre-commit / optional hook),
 * never in the model's context. `design-review` cites the structured `--json`
 * output instead of reloading the 12 KB prose catalog.
 *
 * Dependency-free pattern analysis (no postcss/@babel) — see the design note in
 * design_slop_rules.ts. Same posture as lint_design_quality.
 *
 * Usage:
 *   npx tsx lint_design_slop.ts --dir src/ [--json] [--fail-on P1] [--quiet]
 *
 * Context gate: a consumer DESIGN.md (project root or scan dir) that declares a
 * pattern as intentional suppresses the matching rule (e.g. "warm-neutral" →
 * C5 cream-palette is not flagged). Inline-ignore (eslint-style):
 *   design-slop-disable <rule-id> -- <reason>            (file scope, top of file)
 *   design-slop-disable-next-line <rule-id> -- <reason>
 *   design-slop-disable-line <rule-id> -- <reason>
 * The reason is the same shape every design linter reads (_lib/ignore_reason.ts);
 * an ignore without one still applies this minor version and is reported as
 * ignore-without-reason. --json lists every honoured ignore under suppressions.
 * Per-project config (.design-quality.json, shared with lint_design_quality):
 *   { "ignoreRules": ["slop-c5-cream-palette"], "ignoreFiles": ["src/legacy/**"] }
 *
 * Exit codes: 0 = clean OR findings-below-threshold, 2 = findings at/above
 * --fail-on threshold, 1 = internal error.
 */
import fs from "node:fs";
import path from "node:path";
import {
  SLOP_RULES,
  type DesignContext,
  type Engine,
  type Severity,
} from "./design_slop_rules.js";
import { ignoreReason } from "./_lib/ignore_reason.js";

export interface Finding {
  rule: string;
  catalogId: string;
  severity: Severity;
  file: string;
  line: number;
  snippet: string;
  message: string;
}


/**
 * Rules the pre-0.2 substring gate would have suppressed and the declared-intent
 * reader did not. Report-only, collected across one run.
 */
export const wouldHaveSuppressed: Array<{ rule: string; file: string }> = [];

/** Every inline ignore the run honoured, with the reason it gave (null = none). */
export const suppressions: Array<{ rule: string; file: string; line: number; reason: string | null }> = [];


// ext → which engine-classes a file of that type can contain
function enginesForExt(ext: string): Set<Engine> {
  if (/\.(css|scss|sass|less)$/i.test(ext)) return new Set<Engine>(["css"]);
  if (/\.(html|htm|vue|svelte|astro)$/i.test(ext)) return new Set<Engine>(["css", "html", "copy"]);
  if (/\.(jsx|tsx)$/i.test(ext)) return new Set<Engine>(["css", "jsx", "copy"]);
  if (/\.(md|mdx)$/i.test(ext)) return new Set<Engine>(["copy"]);
  return new Set<Engine>();
}



const NEGATION = /\b(?:never|not|no|avoid|avoids|avoided|without|don't|do not|isn't|aren't|won't|refuse|ban|banned|forbid|forbidden)\b/i;

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The phrases a DESIGN.md declares as intentional (road-to-tells-a-near-miss-can-
 * refute 0.2): the frontmatter `intent:` list, and every non-negated sentence of
 * an `## Intentional` section. Lower-cased.
 */
export function declaredIntent(raw: string): string[] {
  const out: string[] = [];
  const fm = /^---\n([\s\S]*?)\n---/.exec(raw);
  if (fm?.[1]) {
    const inline = /^intent:\s*\[([^\]]*)\]/m.exec(fm[1]);
    if (inline?.[1]) out.push(...inline[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")));
    const block = /^intent:\s*\n((?:\s*-\s*.+\n?)+)/m.exec(fm[1]);
    if (block?.[1]) out.push(...block[1].split("\n").map((l) => l.replace(/^\s*-\s*/, "").trim().replace(/^["']|["']$/g, "")));
  }
  const lines = raw.split("\n");
  const start = lines.findIndex((l) => /^##\s+intentional\b/i.test(l));
  if (start >= 0) {
    for (const l of lines.slice(start + 1)) {
      if (/^##\s/.test(l)) break;
      for (const sentence of l.replace(/^\s*[-*]\s*/, "").split(/[.;!?]/)) {
        const s = sentence.trim();
        if (s !== "" && !NEGATION.test(s)) out.push(s);
      }
    }
  }
  return out.map((s) => s.toLowerCase()).filter((s) => s !== "");
}

/** Read DESIGN.md (scan dir, then project root) as the context-gate source. */
export function loadDesignContext(scanDir: string): DesignContext {
  const candidates = [
    path.join(scanDir, "DESIGN.md"),
    path.join(process.cwd(), "DESIGN.md"),
    path.join(scanDir, "..", "DESIGN.md"),
  ];
  let raw = "";
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      raw = fs.readFileSync(c, "utf-8").toLowerCase();
      break;
    }
  }
  const declared = declaredIntent(raw);
  return {
    raw,
    has: (...keywords: string[]) =>
      keywords.some((k) => {
        const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(k.toLowerCase())}(?![\\p{L}\\p{N}])`, "u");
        return declared.some((d) => re.test(d));
      }),
    legacyHas: (...keywords: string[]) => keywords.find((k) => raw.includes(k.toLowerCase())) ?? null,
  };
}

/** rule → (line → reason). Line 0 stands for the whole file. */
function parseIgnores(lines: string[]): Map<string, Map<number, string | null>> {
  const ignores = new Map<string, Map<number, string | null>>();
  const add = (rule: string, line: number, reason: string | null) => {
    const m = ignores.get(rule) ?? new Map<number, string | null>();
    m.set(line, reason);
    ignores.set(rule, m);
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const reason = ignoreReason(line);
    const file = /design-slop-disable\s+([\w-]+)/i.exec(line);
    if (file && file[1] && !/-line|-next-line/.test(line)) add(file[1].toLowerCase(), 0, reason);
    const next = /design-slop-disable-next-line\s+([\w-]+)/i.exec(line);
    if (next && next[1]) add(next[1].toLowerCase(), i + 2, reason);
    const cur = /design-slop-disable-line\s+([\w-]+)/i.exec(line);
    if (cur && cur[1]) add(cur[1].toLowerCase(), i + 1, reason);
  }
  return ignores;
}

export function scanFile(
  content: string,
  relPath: string,
  ctx: DesignContext,
): Finding[] {
  const lines = content.split("\n");
  const ext = path.extname(relPath).toLowerCase();
  const fileEngines = enginesForExt(ext);
  if (fileEngines.size === 0) return [];
  const ignores = parseIgnores(lines);

  const out: Finding[] = [];
  for (const rule of SLOP_RULES) {
    if (!rule.engines.some((e) => fileEngines.has(e))) continue;
    if (rule.gated && rule.gated(ctx)) continue; // DESIGN.md declares intent → suppress
    if (rule.gated && ctx.legacyHas && rule.gated({ ...ctx, has: (...k: string[]) => ctx.legacyHas!(...k) !== null })) {
      // Report-only for one minor version: the old substring gate would have
      // suppressed this rule. The finding still stands.
      wouldHaveSuppressed.push({ rule: rule.id, file: relPath });
    }
    let hits;
    try {
      hits = rule.detect({ content, lines, ext, ctx });
    } catch {
      continue; // a single rule throwing never kills the scan
    }
    for (const h of hits) {
      const ruleIgnore = ignores.get(rule.id.toLowerCase());
      const at = ruleIgnore?.has(h.line) ? h.line : ruleIgnore?.has(0) ? 0 : null;
      if (ruleIgnore && at !== null) {
        suppressions.push({ rule: rule.id, file: relPath, line: h.line, reason: ruleIgnore.get(at) ?? null });
        continue;
      }
      out.push({
        rule: rule.id,
        catalogId: rule.catalogId,
        severity: rule.severity,
        file: relPath,
        line: h.line,
        snippet: h.snippet,
        message: rule.message,
      });
    }
  }
  return out;
}

// Run only when invoked directly (not when imported by the test guard or the
// hook bundle). The CLI body lives in `lint_design_slop_main.ts` and is loaded
// through a COMPUTED specifier so esbuild leaves it out of
// `dist/hooks/dispatch.js`, which imports this module for `scanFile` alone.
const invokedDirectly =
  process.argv[1] !== undefined && /lint_design_slop\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  const mainModule = ["./lint_design_slop_main", "js"].join(".");
  void import(new URL(mainModule, import.meta.url).href).then((m: { main: () => void }) => m.main());
}
