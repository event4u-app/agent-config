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

/** Coarse HSL hue bucket (0–11, 30° each) from a #rgb/#rrggbb hex; null if grayscale/near-black/near-white (not an accent). */
export function hueBucket(hex: string): number | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1] ?? "";
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (s < 0.25 || l < 0.12 || l > 0.95) return null; // grayscale / near-black / near-white
  let hue = 0;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return Math.floor(hue / 30) % 12;
}

/** Approximate `<section>` bodies for layout-cap rules (no recursion; coarse, deterministic). */
export function sectionBodies(content: string): string[] {
  const starts: number[] = [];
  const re = /<section\b|<Section\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) starts.push(m.index);
  if (starts.length === 0) return [];
  const bodies: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1]! : content.length;
    bodies.push(content.slice(starts[i]!, end));
  }
  return bodies;
}

/** Coarse structural signature of a section body (for monotony / zigzag caps). */
function sectionSignature(body: string): { sig: string; mediaText: boolean } {
  const img = /<img\b|<picture\b|<Image\b|background-image/i.test(body);
  const grid = /\b(flex|grid|grid-cols|col-span|md:flex|lg:grid)\b/i.test(body);
  const heading = /<h[1-6]\b/i.test(body);
  const text = heading || /<(p|li)\b/i.test(body);
  const blocks = Math.min((body.match(/<div\b/gi) ?? []).length, 5);
  return { sig: `${img ? "I" : ""}${grid ? "G" : ""}${heading ? "H" : ""}${blocks}`, mediaText: img && text && grid };
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
  {
    id: "slop-lock-shape",
    catalogId: "V8",
    severity: "P2",
    engines: ["css"],
    description: "Shape Lock — too many distinct corner-radius scales",
    message: "Mixed corner-radius scales fragment the shape system; lock one scale (V8 / Shape Lock).",
    gated: (ctx) => ctx.has("shape lock"),
    detect: ({ content }) => {
      const vals = new Set<number>();
      for (const m of content.matchAll(/border-radius\s*:\s*([^;}]+)/gi)) {
        for (const pm of (m[1] ?? "").matchAll(/(\d+(?:\.\d+)?)px/gi)) {
          const v = parseFloat(pm[1] ?? "0");
          if (v > 0 && v < 9990) vals.add(v);
        }
      }
      if (vals.size >= 4) {
        const idx = content.search(/border-radius/i);
        return [
          {
            line: lineOf(content, Math.max(0, idx)),
            snippet: `${vals.size} distinct radius values: ${[...vals].sort((a, b) => a - b).join("/")}px`,
          },
        ];
      }
      return [];
    },
  },
  {
    id: "slop-lock-colour",
    catalogId: "C6",
    severity: "P3",
    engines: ["css"],
    description: "Colour Lock — multiple saturated accent hue families",
    message: "Several accent hue families read as no single accent identity; lock one (C6 / Colour Lock).",
    gated: (ctx) => ctx.has("colour lock", "color lock"),
    detect: ({ content }) => {
      const buckets = new Set<number>();
      for (const pm of content.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi)) {
        const b = hueBucket("#" + (pm[1] ?? ""));
        if (b !== null) buckets.add(b);
      }
      if (buckets.size >= 3) {
        const idx = content.search(/#[0-9a-f]{3,6}\b/i);
        return [{ line: lineOf(content, Math.max(0, idx)), snippet: `${buckets.size} distinct accent hue families` }];
      }
      return [];
    },
  },
  {
    id: "slop-l9-section-monotony",
    catalogId: "L9",
    severity: "P3",
    engines: ["html", "jsx"],
    description: "Section-layout monotony — too few distinct layout families across many sections",
    message: "Many sections but few distinct layouts → monotonous rhythm; vary the composition (L9).",
    gated: (ctx) => ctx.has("brutalist", "uniform grid", "repetitive grid"),
    detect: ({ content }) => {
      const bodies = sectionBodies(content);
      if (bodies.length < 8) return [];
      const sigs = new Set(bodies.map((b) => sectionSignature(b).sig));
      if (sigs.size < 4) {
        return [{ line: 1, snippet: `${bodies.length} sections, only ${sigs.size} distinct layout families` }];
      }
      return [];
    },
  },
  {
    id: "slop-l10-zigzag",
    catalogId: "L10",
    severity: "P3",
    engines: ["html", "jsx"],
    description: "Zigzag alternation — more than two consecutive media+text two-column sections",
    message: "More than two consecutive image+text two-column sections is the alternating-zigzag tell (L10).",
    gated: (ctx) => ctx.has("brutalist", "uniform grid", "repetitive grid"),
    detect: ({ content }) => {
      const bodies = sectionBodies(content);
      let run = 0;
      let maxRun = 0;
      for (const b of bodies) {
        if (sectionSignature(b).mediaText) {
          run += 1;
          maxRun = Math.max(maxRun, run);
        } else {
          run = 0;
        }
      }
      if (maxRun > 2) return [{ line: 1, snippet: `${maxRun} consecutive media+text sections` }];
      return [];
    },
  },
];
