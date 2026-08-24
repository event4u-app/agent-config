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
 * WHAT THE NEGATIVE FIXTURES ARE NOT: each rule ships one positive and one
 * negative fixture, and the suite asserts both exist. That is a PRESENCE guard —
 * "this regex stays quiet on one clean snippet crafted for it" — and it is NOT a
 * false-positive RATE. Nineteen green negatives say nothing about how often a
 * rule fires on clean UI it has never seen. Reading them as an FP measurement is
 * the mistake that makes the registry look better-evidenced than it is; the rate
 * is measured against the clean corpus under `internal/bench/corpora/`, not here.
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

/**
 * Stock render subjects — the default thing an image or 3D model becomes when
 * nobody decided what it should be about.
 *
 * Same mechanism as `BUZZWORDS` (CP2), applied to art direction instead of
 * prose: each entry names a *visual* that carries no subject matter. The
 * delete-test is the same one — swap the phrase for the product's actual
 * subject and the brief says more, which is the proof it said nothing.
 *
 * On the `copy` engine deliberately. A CSS engine cannot see subject matter:
 * `transform: translateZ()` looks identical whether it moves a product or a
 * glowing orb. The only detectable surface is the brief's own wording.
 */
const STOCK_RENDER_SUBJECTS = [
  "floating abstract shapes",
  "abstract floating shapes",
  "gradient mesh",
  "glowing orb",
  "glowing orbs",
  "floating particles",
  "particle field",
  "abstract 3d shape",
  "abstract 3d shapes",
  "futuristic hud",
  "digital landscape",
  "flowing ribbons",
  "liquid metal blob",
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
    description: "Default AI font (Inter/Roboto/DM Sans/Geist/Space Grotesk/Instrument Serif) without a stated reason",
    // Register-scoped by the catalog, NOT by this matcher: a CSS text pass carries
    // no register signal, so the scope lives in the rebuttal rather than in the
    // gate. `design-modes.md` sanctions a single reliable family in the PRODUCT
    // register, which makes "product register" a complete reason on its own — the
    // message names it so a product surface knows the rebuttal without reading two
    // guidelines. P2 is a rebuttable presumption (see the header), never a block.
    message:
      "This is a default AI-coding-tool font pick. Declare it with a reason (T7) — in the product register, \"single reliable family\" IS the reason; state it in DESIGN.md or the surface brief.",
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
    id: "slop-cp6-generic-art-direction",
    catalogId: "CP6",
    severity: "P2",
    engines: ["copy"],
    description: "Stock render subject named in a brief instead of the product's own subject matter",
    message:
      "This names a default visual, not a subject — swap it for what the product " +
      "actually shows and the brief says more (CP6).",
    detect: ({ content, ext }) => {
      const text = visibleText(content, ext);
      const lower = text.toLowerCase();
      const hits = STOCK_RENDER_SUBJECTS.filter((s) => lower.includes(s));
      if (hits.length === 0) {
        return [];
      }
      return [{ line: 1, snippet: hits.slice(0, 3).join(", ") }];
    },
  },
  {
    id: "slop-cp5-emoji-ui",
    catalogId: "CP5",
    severity: "P2",
    engines: ["html", "jsx"],
    description: "Emoji-decoration prepending headings, buttons, list items, or CTAs",
    message:
      "Emoji-prepended UI text (🚀 Get Started) is the default-startup-template tell — no emoji beats decorative emoji (CP5). Functional status/category emojis and brand-declared emoji strategies are exempt.",
    gated: (ctx) => ctx.has("emoji"),
    detect: ({ content }) => {
      // Emoji as the FIRST visible character inside a heading, button, list
      // item, or link — decoration position. Emojis elsewhere (mid-sentence,
      // table cells, status chips) are not matched: those are the functional
      // placements CP5 explicitly exempts.
      const re =
        /<(h[1-6]|button|li|a)\b[^>]*>\s*(?:<(?!\/)[^>]*>\s*)*(\p{Extended_Pictographic})/giu;
      const hits: RawHit[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const before = content.slice(0, m.index);
        hits.push({
          line: (before.match(/\n/g) ?? []).length + 1,
          snippet: content.slice(m.index, m.index + 60).replace(/\n/g, " "),
        });
      }
      return hits;
    },
  },
  {
    id: "slop-v8-lock-shape",
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
  // -------------------------------------------------------------------------
  // Catalog thresholds promoted to rules (road-to-design-detector-evidence
  // Phase 3). Each entry below already published its number in
  // docs/guidelines/design-antipatterns.md — the prose is the specification,
  // nothing here is invented, and each was graded per rule against the clean
  // corpus rather than as a batch.
  // -------------------------------------------------------------------------
  {
    id: "slop-v4-over-rounded",
    catalogId: "V4",
    severity: "P3",
    engines: ["css"],
    description: "border-radius > 16px on an element declared under 200px wide",
    message: "Heavy rounding on a small surface reads as scaffold-default; scale the radius to the element (V4).",
    gated: (ctx) => ctx.has("pill", "fully rounded", "soft ui", "claymorphism"),
    detect: ({ content }) =>
      cssBlocks(content)
        .filter((b) => {
          // A pill (9999px / 50% / 999px) and a circle are deliberate shapes,
          // not over-rounding — the tell is a mid-range radius on a small box.
          const r = /border-radius\s*:\s*(\d+)px/i.exec(b.body);
          if (!r?.[1]) return false;
          const radius = parseInt(r[1], 10);
          if (radius <= 16 || radius >= 100) return false;
          // "small" must be declared in the same block; nothing here infers
          // layout, because inferring it would need a cascade.
          const size = /(?:^|[;{\s])(?:max-)?(?:width|height)\s*:\s*(\d+)px/i.exec(b.body);
          return size?.[1] !== undefined && parseInt(size[1], 10) < 200;
        })
        .map((b) => ({ line: b.line, snippet: b.selector.slice(0, 80) })),
  },
  {
    id: "slop-c3-dark-glow",
    catalogId: "C3",
    severity: "P2",
    engines: ["css"],
    description: "Saturated zero-offset glow (box-shadow / text-shadow) in a dark context",
    message: "A neon glow on dark reads as gaming-UI default rather than a considered accent (C3).",
    gated: (ctx) => ctx.has("glow", "neon", "cyberpunk", "gaming"),
    detect: ({ content, lines }) => {
      // The tell is dark-context-specific, so a file with no dark surface at all
      // is out of scope — a glow on a light page is a different question.
      const darkContext =
        /prefers-color-scheme\s*:\s*dark/i.test(content) ||
        /\.dark\b|\[data-theme=["']?dark/i.test(content) ||
        /background(?:-color)?\s*:\s*#(?:0[0-9a-f]{5}|1[0-9a-f]{5}|000|111)\b/i.test(content);
      if (!darkContext) return [];
      const out: RawHit[] = [];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i] ?? "";
        // zero-offset + real blur is the glow signature; an offset shadow is depth.
        const m = /(?:box|text)-shadow\s*:\s*0\s+0\s+(\d+)px[^;]*?(#[0-9a-f]{3,8})/i.exec(l);
        if (!m?.[1] || !m[2]) continue;
        if (parseInt(m[1], 10) < 8) continue;
        if (hueBucket(m[2]) === null) continue; // a neutral halo is not a neon accent
        out.push({ line: i + 1, snippet: l.trim().slice(0, 80) });
      }
      return out;
    },
  },
  {
    id: "slop-t9-uppercase-body",
    catalogId: "T9",
    severity: "P3",
    engines: ["css"],
    description: "text-transform: uppercase applied to body-length text",
    message: "All-caps destroys word-shape for sustained reading; reserve it for short labels (T9).",
    gated: (ctx) => ctx.has("all caps", "all-caps", "uppercase display"),
    detect: ({ content }) =>
      cssBlocks(content)
        // Short UI surfaces (labels, buttons, table headers, badges, eyebrows)
        // are the legitimate home of uppercase and are excluded by selector.
        .filter((b) => /\b(p|body|article|\.prose|\.body|\.content|\.copy|blockquote|li)\b/i.test(b.selector))
        .filter((b) => !/label|button|\bth\b|badge|chip|tag|eyebrow|kicker|caption|nav/i.test(b.selector))
        .filter((b) => /text-transform\s*:\s*uppercase/i.test(b.body))
        .map((b) => ({ line: b.line, snippet: b.selector.slice(0, 80) })),
  },
  {
    id: "slop-t10-wide-tracking-body",
    catalogId: "T10",
    severity: "P3",
    engines: ["css"],
    description: "letter-spacing above 0.05em on body-length text",
    message: "Wide tracking slows sustained reading; it belongs to display type, not body (T10).",
    gated: (ctx) => ctx.has("wide tracking", "letterspacing", "letter-spacing"),
    detect: ({ content }) =>
      cssBlocks(content)
        .filter((b) => /\b(p|body|article|\.prose|\.body|\.content|\.copy|blockquote|li)\b/i.test(b.selector))
        .filter((b) => !/label|button|\bth\b|badge|chip|tag|eyebrow|kicker|caption|nav|h[1-6]/i.test(b.selector))
        .filter((b) => {
          const em = /letter-spacing\s*:\s*(\d*\.?\d+)(em|rem)/i.exec(b.body);
          if (em?.[1]) return parseFloat(em[1]) > 0.05;
          const px = /letter-spacing\s*:\s*(\d*\.?\d+)px/i.exec(b.body);
          return px?.[1] !== undefined && parseFloat(px[1]) > 0.8;
        })
        .map((b) => ({ line: b.line, snippet: b.selector.slice(0, 80) })),
  },
  {
    id: "slop-m1-bounce-easing",
    catalogId: "M1",
    severity: "P2",
    engines: ["css"],
    description: "Bounce or elastic easing on a UI transition",
    message: "Overshoot draws attention to the animation instead of the state change (M1).",
    gated: (ctx) => ctx.has("bounce", "playful motion", "elastic"),
    detect: ({ lines }) => {
      const out: RawHit[] = [];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i] ?? "";
        // Overshoot is decidable from the curve itself: a control point outside
        // [0,1] on the output axis means the value passes its target and returns.
        const cb = /cubic-bezier\(\s*[-\d.]+\s*,\s*(-?[\d.]+)\s*,\s*[-\d.]+\s*,\s*(-?[\d.]+)\s*\)/i.exec(l);
        if (cb?.[1] !== undefined && cb[2] !== undefined) {
          const y1 = parseFloat(cb[1]);
          const y2 = parseFloat(cb[2]);
          if (y1 < 0 || y1 > 1 || y2 < 0 || y2 > 1) {
            out.push({ line: i + 1, snippet: l.trim().slice(0, 80) });
            continue;
          }
        }
        if (/(?:transition|animation)[^;]*\b(?:bounce|elastic|back(?:In|Out|InOut))\b/i.test(l)) {
          out.push({ line: i + 1, snippet: l.trim().slice(0, 80) });
        }
      }
      return out;
    },
  },
  {
    id: "slop-m3-img-hover-transform",
    catalogId: "M3",
    severity: "P3",
    engines: ["css"],
    description: "transform or filter animation on an <img> hover",
    message: "Hover-scaling an image triggers composite plus decode and often shifts layout (M3).",
    gated: (ctx) => ctx.has("image hover", "hover zoom", "ken burns"),
    detect: ({ content }) =>
      cssBlocks(content)
        .filter((b) => /\bimg\b/i.test(b.selector) && /:hover|:focus-within/i.test(b.selector))
        .filter((b) => /(?:^|[;{\s])(?:transform|filter)\s*:/i.test(b.body))
        .map((b) => ({ line: b.line, snippet: b.selector.slice(0, 80) })),
  },
];
