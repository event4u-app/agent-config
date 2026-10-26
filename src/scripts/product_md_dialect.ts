#!/usr/bin/env node
/**
 * Which dialect is this PRODUCT.md? (road-to-tells-a-near-miss-can-refute 6.1)
 *
 * Two formats share the filename: this package's interaction-pattern memory,
 * and the product-truth format other design tools write (Register / Users /
 * Product Purpose / Anti-references / Design Principles). `design-system-capture`
 * rewrites only a file it owns; a file in another dialect is read, never
 * rewritten, and additions to it are proposed as a diff.
 *
 *   superset        — product truth + an `## Interaction patterns` section (the
 *                     current template; owned)
 *   ac-interaction  — the older interaction-only template (owned)
 *   product-truth   — the other dialect (read-only)
 *   unknown         — neither (read-only)
 *
 * Usage: npx tsx src/scripts/product_md_dialect.ts <PRODUCT.md>   → prints the dialect
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

export type ProductMdDialect = "superset" | "ac-interaction" | "product-truth" | "unknown";

const INTERACTION = [
  "destructive actions",
  "mutation feedback",
  "filter and sort persistence",
  "empty states",
  "error handling",
  "navigation and routing",
  "mental model",
];
const TRUTH = ["register", "users", "product purpose", "purpose", "anti-references", "design principles", "principles"];

function headings(text: string): string[] {
  return [...text.matchAll(/^#{2,4}\s+(.+?)\s*$/gm)].map((m) => (m[1] ?? "").toLowerCase().replace(/[`*]/g, "").trim());
}

export function classifyProductMd(text: string): ProductMdDialect {
  const hs = headings(text);
  const interaction = hs.filter((h) => INTERACTION.includes(h)).length;
  const truth = new Set(hs.filter((h) => TRUTH.includes(h)).map((h) => h.replace(/^product /, "").replace(/^design /, ""))).size;
  if (truth >= 2 && hs.includes("interaction patterns")) return "superset";
  if (truth >= 2) return "product-truth";
  if (interaction >= 2) return "ac-interaction";
  return "unknown";
}

/** A capture may rewrite only a file it owns, or create one that is absent. */
export function captureMayRewrite(existing: string | null): boolean {
  if (existing === null) return true;
  const d = classifyProductMd(existing);
  return d === "superset" || d === "ac-interaction";
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const file = argv[0];
  if (!file) {
    process.stderr.write("usage: product_md_dialect <PRODUCT.md>\n");
    return 2;
  }
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) {
    process.stdout.write("absent — create from the template\n");
    return 0;
  }
  const dialect = classifyProductMd(fs.readFileSync(abs, "utf8"));
  const owned = dialect === "superset" || dialect === "ac-interaction";
  process.stdout.write(`${dialect} — ${owned ? "owned: update in place" : "not owned: read it, never rewrite it; propose additions as a diff"}\n`);
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(main());
}
