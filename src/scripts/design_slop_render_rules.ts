/**
 * The render-engine design-slop rules (road-to-tells-a-near-miss-can-refute
 * 2.3/2.5). They read the rows `ui:render` captures, never source text, so
 * they live apart from `design_slop_rules.ts`: the hook bundle imports that
 * registry to scan written files and would carry these for nothing. The
 * catalog parity gate reads both files.
 */
import type { DesignContext, RawHit, Severity, SlopRule, StyleRow } from "./design_slop_rules.js";
import { SLOP_RULES } from "./design_slop_rules.js";

// ---------------------------------------------------------------------------
// Render-row helpers (the `render` engine reads ui:render style rows)
// ---------------------------------------------------------------------------

interface Box { x: number; y: number; w: number; h: number }

function boxOf(row: StyleRow): Box | null {
  const p = (row["rect"] ?? "").split(",").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return null;
  return { x: p[0]!, y: p[1]!, w: p[2]!, h: p[3]! };
}

const visibleRow = (r: StyleRow): boolean => r["visible"] === "1";
const px = (v: string | undefined): number => parseFloat(v ?? "") || 0;
const parentsOf = (r: StyleRow): number[] =>
  (r["parents"] ?? "").split(",").filter(Boolean).map(Number);

/** A painted surface: a border or a shadow, on a box big enough to hold content. */
function isSurface(r: StyleRow): boolean {
  const b = boxOf(r);
  if (!b || b.w < 80 || b.h < 40) return false;
  const border = px(r["border-top-width"]) > 0 || px(r["border-left-width"]) > 0;
  const shadow = (r["box-shadow"] ?? "none") !== "none";
  return border || shadow;
}

/** What makes two surfaces look the same. */
const surfaceKey = (r: StyleRow): string =>
  [r["background-color"], r["border-top-width"], r["border-radius"], r["box-shadow"]].join("|");

const clips = (r: StyleRow): boolean =>
  /hidden|clip/.test(`${r["overflow-x"] ?? ""} ${r["overflow-y"] ?? ""}`);
const scrolls = (r: StyleRow): boolean =>
  /auto|scroll|hidden|clip/.test(r["overflow-x"] ?? "");

const label = (r: StyleRow): string => `${r["selector"]}${r["class"] ? "." + r["class"].split(/\s+/)[0] : ""}`;

export const RENDER_RULES: SlopRule[] = [
  {
    id: "slop-l7-overflow",
    catalogId: "L7",
    severity: "P1",
    engines: ["render"],
    description: "Content that overflows the viewport where no ancestor scrolls or clips it",
    message: "Content runs past the viewport edge with nothing scrolling it — an untested width (L7).",
    detect: ({ rows = [] }) => {
      const page = rows.find((r) => r["selector"] === "html");
      const width = page ? boxOf(page)?.w ?? 0 : 0;
      if (width === 0) return [];
      const out: RawHit[] = [];
      for (const r of rows) {
        const b = boxOf(r);
        if (!b || !visibleRow(r) || b.x + b.w <= width + 1 || b.x + b.w <= 0) continue;
        if (b.x < 0 && b.x + b.w < 0) continue;
        const contained = parentsOf(r).some((i) => rows[i] && scrolls(rows[i]!));
        if (contained || scrolls(r)) continue;
        // Report the outermost overflowing element only.
        if (parentsOf(r).some((i) => {
          const pb = rows[i] ? boxOf(rows[i]!) : null;
          return pb !== null && pb.x + pb.w > width + 1;
        })) continue;
        out.push({ line: Number(r["index"] ?? 0), snippet: `${label(r)} ends at ${b.x + b.w}px of ${width}px` });
      }
      return out;
    },
  },
  {
    id: "slop-l6-clipped-popover",
    catalogId: "L6",
    severity: "P1",
    engines: ["render"],
    description: "An absolutely positioned popup cut off by an overflow-hidden ancestor",
    message: "The popup is clipped by its container. Use <dialog>, the Popover API or a fixed / portalled layer (L6).",
    detect: ({ rows = [] }) => {
      const out: RawHit[] = [];
      for (const r of rows) {
        if (r["position"] !== "absolute" || !visibleRow(r)) continue;
        const b = boxOf(r);
        if (!b || b.w < 40 || b.h < 24) continue;
        for (const i of parentsOf(r)) {
          const a = rows[i];
          if (!a || !clips(a)) continue;
          const ab = boxOf(a);
          if (!ab) continue;
          const cut = b.x < ab.x - 1 || b.y < ab.y - 1 || b.x + b.w > ab.x + ab.w + 1 || b.y + b.h > ab.y + ab.h + 1;
          if (cut) out.push({ line: Number(r["index"] ?? 0), snippet: `${label(r)} clipped by ${label(a)}` });
          break;
        }
      }
      return out;
    },
  },
  {
    id: "slop-v7-nested-cards",
    catalogId: "V7",
    severity: "P2",
    engines: ["render"],
    description: "A card inside a card inside a card, all three the same surface",
    message: "Three nested surfaces of the same weight hide the hierarchy. Give each level its own weight, or flatten (V7).",
    detect: ({ rows = [] }) => {
      const out: RawHit[] = [];
      for (const r of rows) {
        if (!visibleRow(r) || !isSurface(r)) continue;
        const outer = parentsOf(r)
          .map((i) => rows[i])
          .filter((a): a is StyleRow => a !== undefined && isSurface(a));
        if (outer.length < 2) continue;
        const key = surfaceKey(r);
        if (outer.slice(0, 2).every((a) => surfaceKey(a) === key)) {
          out.push({ line: Number(r["index"] ?? 0), snippet: `${label(r)} is the third nested surface of one weight` });
        }
      }
      return out;
    },
  },
  {
    id: "slop-l2-identical-cards",
    catalogId: "L2",
    severity: "P3",
    engines: ["render"],
    description: "Three or more sibling cards of identical size and surface",
    message: "Identical sibling cards give every item the same weight. Vary the composition, or the emphasis (L2).",
    detect: ({ rows = [] }) => {
      const groups = new Map<string, StyleRow[]>();
      for (const r of rows) {
        if (!visibleRow(r) || !isSurface(r)) continue;
        const parent = parentsOf(r)[0];
        if (parent === undefined) continue;
        const b = boxOf(r)!;
        const k = `${parent}|${surfaceKey(r)}|${Math.round(b.w / 2)}|${Math.round(b.h / 2)}`;
        groups.set(k, [...(groups.get(k) ?? []), r]);
      }
      // A grid row, not a stacked list: the catalog names cards "in a grid".
      // Tuned 2026-10-26 on the render near-misses — three equal task cards
      // stacked in a board column are a list, and they fired.
      const sideBySide = (g: StyleRow[]): boolean =>
        new Set(g.map((r) => Math.round(boxOf(r)!.y / 4))).size < g.length &&
        new Set(g.map((r) => Math.round(boxOf(r)!.x / 4))).size >= 3;
      return [...groups.values()]
        .filter((g) => g.length >= 3 && sideBySide(g))
        .map((g) => ({ line: Number(g[0]!["index"] ?? 0), snippet: `${g.length} identical ${label(g[0]!)} siblings` }));
    },
  },
  {
    id: "slop-l1-hero-metric",
    catalogId: "L1",
    severity: "P3",
    engines: ["render"],
    description: "A giant number over a small label, beside a row of three or four stats, on a gradient",
    message: "The hero-metric template. Give the primary metric its context and vary the arrangement (L1).",
    detect: ({ rows = [] }) => {
      const gradient = rows.some((r) => /gradient\(/i.test(r["background-image"] ?? "") || /gradient/i.test(r["class"] ?? ""));
      if (!gradient) return [];
      const giant = rows.find((r) => visibleRow(r) && px(r["font-size"]) >= 48 && /^\s*[\d$€£%.,kKmM+-]+\s*$/.test(r["text"] ?? "x"));
      const stats = rows.filter((r) => visibleRow(r) && px(r["font-size"]) >= 24 && px(r["font-size"]) < 48);
      const byRow = new Map<number, number>();
      for (const s of stats) {
        const b = boxOf(s);
        if (b) byRow.set(Math.round(b.y / 8), (byRow.get(Math.round(b.y / 8)) ?? 0) + 1);
      }
      const row = [...byRow.values()].some((n) => n >= 3 && n <= 4);
      return giant && row ? [{ line: Number(giant["index"] ?? 0), snippet: "giant metric + stat row on a gradient" }] : [];
    },
  },
];

/** Every shipped rule, text and render — what the catalog's `backed` set must equal. */
export const ALL_SLOP_RULES: SlopRule[] = [...SLOP_RULES, ...RENDER_RULES];

export interface RenderFinding {
  rule: string;
  catalogId: string;
  severity: Severity;
  file: string;
  line: number;
  snippet: string;
  message: string;
}

/**
 * Run the `render`-engine rules over one viewport's captured rows. A text scan
 * never reaches them: they need a rendered page, which only `ui:render` makes.
 */
export function scanRender(rows: StyleRow[], relPath: string, ctx: DesignContext): RenderFinding[] {
  const out: RenderFinding[] = [];
  for (const rule of RENDER_RULES) {
    if (rule.gated && rule.gated(ctx)) continue;
    let hits;
    try {
      hits = rule.detect({ content: "", lines: [], ext: ".render", ctx, rows });
    } catch {
      continue;
    }
    for (const h of hits) {
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

