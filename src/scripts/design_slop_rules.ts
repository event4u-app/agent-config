#!/usr/bin/env node
/**
 * design_slop_rules — the deterministic anti-slop rule registry.
 *
 * Data + matchers for the aesthetic-PROVENANCE tells that make a UI "look like
 * an AI made it" — the layer `lint_design_quality` deliberately does NOT cover
 * (it owns the OBJECTIVE floors: contrast, font-size, line-length, reduced-motion,
 * heading hierarchy, focus). This registry is the deterministic backing for the
 * PROSE catalog in `docs/guidelines/design-antipatterns.md`; every rule cites its
 * catalog id (V1, C2, …) so prose ↔ rule stay traceable.
 *
 * DESIGN CONSTRAINT (why no postcss/@babel): this package ships to consumers via
 * `npx` and is dependency-free by design (see lint_design_quality header). Heavy
 * parsers (postcss/@babel/tailwind resolver) would bloat the install and break
 * portability. The Phase-0 tells are all detectable by pattern analysis on
 * CSS/HTML/JSX text without a cascade — we follow lint_design_quality's proven
 * dependency-free approach. Council 2026-06-28 assumed those libs were present;
 * for THIS package, pattern-based is the correct, frugal adaptation.
 *
 * Severity is a REBUTTABLE PRESUMPTION, never a hard block:
 *   P0 — objective failure (none here; those live in lint_design_quality)
 *   P1 — high-confidence tell (e.g. the side-stripe signature)
 *   P2 — confident tell
 *   P3 — co-occurrence / lower-confidence heuristic
 * A rule is suppressed when the consumer's DESIGN.md declares the pattern as
 * intentional (the context gate), via inline-ignore, or via .design-quality.json.
 */

export type Severity = "P0" | "P1" | "P2" | "P3";
export type Engine = "css" | "html" | "jsx" | "copy";

export interface RawHit {
  line: number;
  snippet: string;
}

export interface DesignContext {
  /** lowercased DESIGN.md text, or "" when absent */
  raw: string;
  /** true when DESIGN.md mentions any of the given keywords */
  has(...keywords: string[]): boolean;
}

export interface RuleInput {
  content: string;
  lines: string[];
  ext: string; // e.g. ".css"
  ctx: DesignContext;
}

export interface SlopRule {
  id: string; // e.g. "slop-v1-side-stripe"
  catalogId: string; // e.g. "V1"
  severity: Severity;
  engines: Engine[];
  description: string;
  /** human-facing note on what to do — printed with the finding */
  message: string;
  /** suppress the rule entirely for this file when DESIGN.md declares intent */
  gated?: (ctx: DesignContext) => boolean;
  detect: (input: RuleInput) => RawHit[];
}

// ---------------------------------------------------------------------------
// Shared helpers (pattern-based, dependency-free)
// ---------------------------------------------------------------------------

/** Split CSS-ish text into naive `selector { body }` blocks with the line of `{`. */
export function cssBlocks(content: string): Array<{ selector: string; body: string; line: number }> {
  const blocks: Array<{ selector: string; body: string; line: number }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const before = content.slice(0, m.index);
    const line = (before.match(/\n/g) ?? []).length + 1;
    blocks.push({ selector: (m[1] ?? "").trim(), body: m[2] ?? "", line });
  }
  return blocks;
}

function lineOf(content: string, index: number): number {
  return (content.slice(0, index).match(/\n/g) ?? []).length + 1;
}

/** Visible text from HTML/JSX/Markdown: strip tags, code fences, attributes. */
export function visibleText(content: string, ext: string): string {
  let t = content;
  if (ext === ".md" || ext === ".mdx") {
    t = t.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ");
  }
  // strip HTML/JSX tags and JSX expression braces
  t = t.replace(/<[^>]+>/g, " ").replace(/\{[^}]*\}/g, " ");
  return t;
}

const DEFAULT_FONTS = [
  "inter",
  "roboto",
  "dm sans",
  "geist",
  "space grotesk",
  "instrument serif",
];

const BUZZWORDS = [
  "streamline",
  "empower",
  "supercharge",
  "world-class",
  "enterprise-grade",
  "seamlessly",
  "robust",
  "leverage",
];

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

export const SLOP_RULES: SlopRule[] = [
  {
    id: "slop-v1-side-stripe",
    catalogId: "V1",
    severity: "P1",
    engines: ["css"],
    description: "Colored side-stripe border (border-left/right > 1px) — the #1 AI-UI signature",
    message:
      "Side-stripe accent border reads as scaffold-default. Remove it, or declare an intentional stripe in DESIGN.md (V1).",
    gated: (ctx) => ctx.has("side stripe", "side-stripe", "stripe accent", "accent border"),
    detect: ({ content }) =>
      cssBlocks(content)
        // a side-stripe is a left/right border with a width > 1px and a color;
        // exclude semantic blockquote/quote selectors (legitimate left rule)
        .filter((b) => !/blockquote|\bquote\b|<q>/i.test(b.selector))
        .filter((b) =>
          /border-(?:left|right)\s*:\s*(?:[2-9]|\d{2,})px\s+\w+\s+(?:#|rgb|hsl|oklch|var\(|[a-z])/i.test(
            b.body,
          ),
        )
        .map((b) => ({ line: b.line, snippet: b.selector.slice(0, 80) })),
  },
  {
    id: "slop-v3-ghost-card",
    catalogId: "V3",
    severity: "P2",
    engines: ["css"],
    description: "Ghost card: 1px border AND a ≥16px box-shadow on the same surface",
    message:
      "Border + heavy shadow together signal no confident depth decision. Choose one (V3).",
    detect: ({ content }) =>
      cssBlocks(content)
        .filter(
          (b) =>
            /border\s*:\s*1px\s+solid/i.test(b.body) &&
            /box-shadow\s*:[^;]*?(?:1[6-9]|[2-9]\d)px/i.test(b.body),
        )
        .map((b) => ({ line: b.line, snippet: b.selector.slice(0, 80) })),
  },
  {
    id: "slop-v6-diagonal-stripes",
    catalogId: "V6",
    severity: "P2",
    engines: ["css"],
    description: "repeating-linear-gradient stripes as a background texture",
    message: "Repeating diagonal stripes are a generated-CSS-art cliché (V6).",
    gated: (ctx) => ctx.has("pattern background", "pattern-background", "stripe texture"),
    detect: ({ lines }) =>
      lines.flatMap((l, i) =>
        /background[^;]*repeating-linear-gradient\s*\(/i.test(l)
          ? [{ line: i + 1, snippet: l.trim().slice(0, 90) }]
          : [],
      ),
  },
  {
    id: "slop-c2-gradient-text",
    catalogId: "C2",
    severity: "P2",
    engines: ["css"],
    description: "Gradient text via background-clip: text",
    message:
      "Gradient text via background-clip:text is overused and has cross-platform rendering edges (C2).",
    gated: (ctx) => ctx.has("gradient identity", "gradient-identity", "gradient logo"),
    detect: ({ content }) =>
      cssBlocks(content)
        .filter(
          (b) =>
            /background-clip\s*:\s*text|-webkit-background-clip\s*:\s*text/i.test(b.body) &&
            /linear-gradient|radial-gradient|conic-gradient/i.test(b.body),
        )
        .map((b) => ({ line: b.line, snippet: b.selector.slice(0, 80) })),
  },
  {
    id: "slop-c5-cream-palette",
    catalogId: "C5",
    severity: "P3",
    engines: ["css"],
    description: "Cream/sand background + brass/clay/oxblood accent — the 2025 'premium-consumer' AI palette",
    message:
      "Warm cream/sand + brass/clay is the default 'tasteful AI' surface. Confirm it is first-party in DESIGN.md (C5).",
    gated: (ctx) => ctx.has("warm neutral", "warm-neutral", "cream", "sand", "premium consumer"),
    detect: ({ content }) => {
      const cream = /#f[5-9bdf][f0-9a-f]e[0-9a-f]|#fbf8f1|#f7f5f1|#f5f1ea/i.test(content);
      const brass = /#b08947|#b6553a|#9a2436|brass|oxblood|terracotta|clay/i.test(content);
      if (!cream || !brass) return [];
      const idx = content.search(/#f[5-9bdf][f0-9a-f]e[0-9a-f]|#fbf8f1|#f7f5f1|#f5f1ea/i);
      return [{ line: lineOf(content, Math.max(0, idx)), snippet: "cream/sand bg + warm accent co-occur" }];
    },
  },
  {
    id: "slop-t4-eyebrow-overuse",
    catalogId: "T4",
    severity: "P2",
    engines: ["html", "jsx", "css"],
    description: "More than one ALL-CAPS eyebrow per 3 sections",
    message:
      "Eyebrow/ALL-CAPS labels above every section collapse emphasis; cap is 1 per 3 sections (T4).",
    detect: ({ content }) => {
      const sections = (content.match(/<section\b|<Section\b/gi) ?? []).length;
      const eyebrows =
        (content.match(/text-transform\s*:\s*uppercase/gi) ?? []).length +
        (content.match(/(?:class|className)=["'][^"']*\buppercase\b/gi) ?? []).length;
      const cap = Math.max(1, Math.ceil(sections / 3));
      if (sections >= 3 && eyebrows > cap) {
        return [
          {
            line: 1,
            snippet: `${eyebrows} uppercase eyebrows across ${sections} sections (cap ${cap})`,
          },
        ];
      }
      return [];
    },
  },
  {
    id: "slop-t6-crushed-tracking",
    catalogId: "T6",
    severity: "P2",
    engines: ["css"],
    description: "Crushed display letter-spacing below −0.04em",
    message: "letter-spacing tighter than −0.04em makes glyphs collide optically (T6/Q7).",
    detect: ({ lines }) =>
      lines.flatMap((l, i) => {
        const m = /letter-spacing\s*:\s*(-?\d*\.?\d+)\s*em/i.exec(l);
        if (m && m[1] && parseFloat(m[1]) < -0.04) {
          return [{ line: i + 1, snippet: l.trim().slice(0, 80) }];
        }
        return [];
      }),
  },
  {
    id: "slop-t7-default-fonts",
    catalogId: "T7",
    severity: "P2",
    engines: ["css"],
    description: "Default AI font (Inter/Roboto/DM Sans/Geist/Space Grotesk/Instrument Serif) without a brand reason",
    message:
      "This is a default AI-coding-tool font pick. Declare it in DESIGN.md with a reason, or choose deliberately (T7).",
    gated: (ctx) => DEFAULT_FONTS.some((f) => ctx.has(f)),
    detect: ({ lines }) =>
      lines.flatMap((l, i) => {
        if (!/font-family\s*:/i.test(l)) return [];
        const lower = l.toLowerCase();
        const hit = DEFAULT_FONTS.find((f) => lower.includes(f));
        return hit ? [{ line: i + 1, snippet: l.trim().slice(0, 80) }] : [];
      }),
  },
  {
    id: "slop-l4-numbered-markers",
    catalogId: "L4",
    severity: "P3",
    engines: ["html", "jsx"],
    description: "Numbered section markers (01 / 02 / 03) as a decorative order device",
    message:
      "Numbered 01/02/03 section markers are a universal generated-landing-page tell (L4).",
    detect: ({ content, ext }) => {
      const text = visibleText(content, ext);
      const markers = text.match(/(?<![\d/.])0[1-9](?![\d%])/g) ?? [];
      const distinct = new Set(markers.map((s) => s.trim()));
      if (distinct.has("01") && distinct.has("02") && distinct.has("03")) {
        return [{ line: 1, snippet: "decorative 01/02/03 section markers" }];
      }
      return [];
    },
  },
  {
    id: "slop-l8-zindex-magic",
    catalogId: "L8",
    severity: "P2",
    engines: ["css"],
    description: "Magic z-index values (99 / 999 / 9999) with no semantic scale",
    message: "Magic z-index breaks the first time two elements compete. Use a named scale (L8).",
    detect: ({ lines }) =>
      lines.flatMap((l, i) =>
        /z-index\s*:\s*(?:99|999|9999)\b/i.test(l) ? [{ line: i + 1, snippet: l.trim().slice(0, 80) }] : [],
      ),
  },
  {
    id: "slop-m4-transition-all",
    catalogId: "M4",
    severity: "P2",
    engines: ["css"],
    description: "transition: all shorthand",
    message: "transition:all animates layout/color/opacity together — unpredictable + expensive (M4).",
    detect: ({ lines }) =>
      lines.flatMap((l, i) =>
        /transition\s*:\s*all\b/i.test(l) ? [{ line: i + 1, snippet: l.trim().slice(0, 80) }] : [],
      ),
  },
  {
    id: "slop-m2-animate-layout",
    catalogId: "M2",
    severity: "P2",
    engines: ["css"],
    description: "Transitioning layout properties (width/height/top/left/margin/padding)",
    message: "Animating layout props forces reflow; use transform instead (M2).",
    detect: ({ lines }) =>
      lines.flatMap((l, i) =>
        /transition\s*:\s*(?:[^;]*\b)?(?:width|height|top|left|right|bottom|margin|padding)\b[^;]*\d/i.test(l)
          ? [{ line: i + 1, snippet: l.trim().slice(0, 80) }]
          : [],
      ),
  },
  {
    id: "slop-cp1-em-dash",
    catalogId: "CP1",
    severity: "P2",
    engines: ["copy"],
    description: "Em-dash overuse in visible copy (> 2 per 500 words)",
    message: "Em-dash density above ~2 per 500 words is the #1 LLM syntactic tell (CP1).",
    detect: ({ content, ext }) => {
      const text = visibleText(content, ext);
      const words = (text.match(/\S+/g) ?? []).length;
      const dashes = (text.match(/—/g) ?? []).length;
      if (words >= 80 && dashes > Math.max(2, Math.round((words / 500) * 2))) {
        return [{ line: 1, snippet: `${dashes} em-dashes in ~${words} words` }];
      }
      return [];
    },
  },
  {
    id: "slop-cp2-buzzword",
    catalogId: "CP2",
    severity: "P2",
    engines: ["copy"],
    description: "Marketing buzzwords (streamline/empower/supercharge/world-class/…)",
    message: "These words carry no information — delete-test each one (CP2).",
    detect: ({ content, ext }) => {
      const text = visibleText(content, ext);
      const lower = text.toLowerCase();
      const hits = BUZZWORDS.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
      if (hits.length > 0) {
        return [{ line: 1, snippet: `buzzwords: ${hits.join(", ")}` }];
      }
      return [];
    },
  },
];
