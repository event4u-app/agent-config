#!/usr/bin/env node
/**
 * Logo export kit (road-to-tells-a-near-miss-can-refute 7.5) — the step
 * `logo-generation` stops before, produced from one confirmed SVG mark:
 *
 *   mark.svg                 the input, byte for byte
 *   mark@1x.png, mark@2x.png at the mark's intrinsic size and twice it
 *   favicon.svg              the mark
 *   favicon-16.png, favicon-32.png, apple-touch-icon.png (180),
 *   icon-192.png, icon-512.png
 *   site.webmanifest         name + the two maskable-size icons
 *   lockup-light.svg, lockup-dark.svg   mark + name, side by side
 *   mark.svg.provenance.json  the origin sidecar, written last
 *
 * Deterministic by construction: fixed file order, PNGs rendered by one
 * headless Chromium with a transparent background, and the sidecar's only
 * timestamp is the `created` date, taken from `--date`, else
 * `SOURCE_DATE_EPOCH`, else today's UTC date — day-granular, so two runs on
 * one day, or any two runs with `--date`, give the same bytes. The test runs
 * it twice and compares.
 *
 * The sidecar follows `agents/settings/policies/media/transparency.md` in the
 * field shape `embed-provenance.sh` writes (schema 2): assertion, label, C2PA
 * action and IPTC source type from the policy's one vocabulary row, provider,
 * model, created, generator, the sha256 of the mark's final bytes, and the
 * prompt hash when one is given. It adds three fields the kit needs: `licence`,
 * `commercial` (`yes|no|verify`, default `verify`) and `kit`, the sha256 of
 * every other file written. A hand-authored mark is `provider: "none"` — an
 * agent-authored SVG is still AI output, so the assertion stays `ai_generated`
 * unless `--assertion ai_edited` says the agent modified supplied material.
 *
 * The lockups colour the mark through `currentColor`, so a mark drawn in
 * `currentColor` follows the scheme and one with literal fills keeps them —
 * which is a fact about the mark, reported, never silently repainted.
 *
 * Needs Chromium (`@playwright/test` or `playwright-core`; AGENT_CONFIG_BROWSER
 * names a system one). Without one it writes the SVG half, says the PNG half is
 * missing, and exits 1.
 *
 * Usage: logo_export_kit <mark.svg> --name "<Name>" --out <dir>
 *        [--light <#hex>] [--dark <#hex>] [--date <YYYY-MM-DD>]
 *        [--backend <id>] [--model <id>] [--licence <text>]
 *        [--commercial yes|no|verify] [--assertion ai_generated|ai_edited]
 *        [--prompt-sha256 <hex>]
 */
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

export type Commercial = "yes" | "no" | "verify";
export type Assertion = "ai_generated" | "ai_edited";

export interface Provenance {
  backend?: string;
  model?: string;
  licence?: string;
  commercial?: Commercial;
  assertion?: Assertion;
  promptSha256?: string;
}

interface Options {
  mark: string;
  name: string;
  out: string;
  light: string;
  dark: string;
  /** The sidecar's `created` value. Defaults per the header; pin it for byte-identical runs. */
  created?: string;
  provenance?: Provenance;
}

export const COMMERCIAL: readonly Commercial[] = ["yes", "no", "verify"];
export const ASSERTIONS: readonly Assertion[] = ["ai_generated", "ai_edited"];

/** The policy's vocabulary rows (transparency.md § Vocabulary), one per assertion. */
const VOCABULARY: Record<Assertion, { label: string; action: string; dst: string }> = {
  ai_generated: { label: "generated", action: "c2pa.created", dst: "trainedAlgorithmicMedia" },
  ai_edited: { label: "modified", action: "c2pa.edited", dst: "compositeWithTrainedAlgorithmicMedia" },
};

export const SIDECAR = "mark.svg.provenance.json";

export function defaultCreated(env: NodeJS.ProcessEnv = process.env, now: Date = new Date()): string {
  const epoch = Number(env["SOURCE_DATE_EPOCH"]);
  const at = Number.isFinite(epoch) && env["SOURCE_DATE_EPOCH"] !== "" ? new Date(epoch * 1000) : now;
  return at.toISOString().slice(0, 10);
}

const sha256 = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");

/** The origin sidecar for the kit in `out`, given the files already written there. */
export function provenanceSidecar(out: string, written: readonly string[], created: string, p: Provenance = {}): string {
  const assertion = p.assertion ?? "ai_generated";
  const vocab = VOCABULARY[assertion];
  const doc: Record<string, unknown> = {
    schema: 2,
    assertion: `c2pa.${assertion}`,
    label: vocab.label,
    c2pa_action: vocab.action,
    digital_source_type: vocab.dst,
    provider: p.backend ?? "none",
    model: p.model ?? "none",
    created,
    generator: "event4u/agent-config logo_export_kit",
    artifact_sha256: sha256(fs.readFileSync(path.join(out, "mark.svg"))),
    ...(p.promptSha256 ? { prompt_sha256: p.promptSha256 } : {}),
    licence: p.licence ?? "unspecified",
    commercial: p.commercial ?? "verify",
    kit: written.map((file) => ({ file, sha256: sha256(fs.readFileSync(path.join(out, file))) })),
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

const PNGS: Array<{ file: string; size: number | null; scale: number }> = [
  { file: "mark@1x.png", size: null, scale: 1 },
  { file: "mark@2x.png", size: null, scale: 2 },
  { file: "favicon-16.png", size: 16, scale: 1 },
  { file: "favicon-32.png", size: 32, scale: 1 },
  { file: "apple-touch-icon.png", size: 180, scale: 1 },
  { file: "icon-192.png", size: 192, scale: 1 },
  { file: "icon-512.png", size: 512, scale: 1 },
];

/** Intrinsic size: width/height attributes, else the viewBox, else 512 square. */
export function intrinsic(svg: string): { w: number; h: number } {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? "";
  const attr = (n: string) => Number(new RegExp(`\\b${n}="([\\d.]+)(?:px)?"`, "i").exec(root)?.[1] ?? NaN);
  const vb = /\bviewBox="\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*"/i.exec(root);
  const w = attr("width") || Number(vb?.[1]) || 512;
  const h = attr("height") || Number(vb?.[2]) || 512;
  return { w: Math.round(w), h: Math.round(h) };
}

const escapeXml = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

/** Mark and name side by side; the mark is nested, never rasterised. */
export function lockup(svg: string, name: string, color: string): string {
  const { w, h } = intrinsic(svg);
  const height = 64;
  const markW = Math.round((w / h) * height);
  const inner = svg.replace(/^<\?xml[^>]*>\s*/i, "").replace(/<svg\b/i, `<svg x="0" y="0" width="${markW}" height="${height}"`);
  const textX = markW + 16;
  const width = textX + Math.round(name.length * height * 0.55);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" color="${color}">`,
    inner,
    `<text x="${textX}" y="${Math.round(height * 0.68)}" font-family="system-ui, sans-serif" font-size="${Math.round(height * 0.5)}" fill="currentColor">${escapeXml(name)}</text>`,
    `</svg>`,
    "",
  ].join("\n");
}

export function manifest(name: string, light: string): string {
  const doc = {
    name,
    short_name: name,
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    theme_color: light,
    background_color: light,
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

async function launch(): Promise<{ newPage(o: object): Promise<unknown>; close(): Promise<void> } | null> {
  type Chromium = { launch(o: object): Promise<{ newPage(o: object): Promise<unknown>; close(): Promise<void> }> };
  let chromium: Chromium | null = null;
  for (const mod of ["@playwright/test", "playwright-core"]) {
    try {
      chromium = ((await import(mod)) as { chromium: Chromium }).chromium;
      break;
    } catch {
      /* next */
    }
  }
  if (chromium === null) return null;
  const exe = process.env["AGENT_CONFIG_BROWSER"];
  try {
    return await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
  } catch {
    return null;
  }
}

type Page = {
  setContent(html: string): Promise<void>;
  screenshot(o: object): Promise<Buffer>;
  close(): Promise<void>;
};

export async function exportKit(o: Options): Promise<{ written: string[]; missing: string[] }> {
  const svg = fs.readFileSync(o.mark, "utf8");
  fs.mkdirSync(o.out, { recursive: true });
  const written: string[] = [];
  const write = (file: string, data: string | Buffer) => {
    fs.writeFileSync(path.join(o.out, file), data);
    written.push(file);
  };
  write("mark.svg", fs.readFileSync(o.mark));
  write("favicon.svg", fs.readFileSync(o.mark));
  write("lockup-light.svg", lockup(svg, o.name, o.dark));
  write("lockup-dark.svg", lockup(svg, o.name, o.light));
  write("site.webmanifest", manifest(o.name, o.light));

  // The sidecar hashes final bytes, so it is written after everything else.
  const finish = (missing: string[]) => {
    const files = [...written];
    write(SIDECAR, provenanceSidecar(o.out, files, o.created ?? defaultCreated(), o.provenance));
    return { written, missing };
  };
  const browser = await launch();
  if (browser === null) return finish(PNGS.map((p) => p.file));
  try {
    const { w, h } = intrinsic(svg);
    for (const p of PNGS) {
      const width = p.size ?? w;
      const height = p.size ?? h;
      const page = (await browser.newPage({ viewport: { width, height }, deviceScaleFactor: p.scale })) as Page;
      const body = svg.replace(/<svg\b/i, `<svg width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"`);
      await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${body}</body></html>`);
      write(p.file, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width, height } }));
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return finish([]);
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const mark = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
  const name = get("--name");
  const out = get("--out");
  if (!mark || !name || !out) {
    process.stderr.write('usage: logo_export_kit <mark.svg> --name "<Name>" --out <dir> [--light #hex] [--dark #hex] [--date YYYY-MM-DD] [--backend id] [--model id] [--licence text] [--commercial yes|no|verify] [--assertion ai_generated|ai_edited] [--prompt-sha256 hex]\n');
    return 2;
  }
  const commercial = get("--commercial");
  if (commercial !== undefined && !COMMERCIAL.includes(commercial as Commercial)) {
    process.stderr.write(`logo_export_kit: --commercial must be one of ${COMMERCIAL.join("|")} (got: ${commercial})\n`);
    return 2;
  }
  const assertion = get("--assertion");
  if (assertion !== undefined && !ASSERTIONS.includes(assertion as Assertion)) {
    process.stderr.write(`logo_export_kit: --assertion must be one of ${ASSERTIONS.join("|")} (got: ${assertion})\n`);
    return 2;
  }
  const date = get("--date");
  if (date !== undefined && !/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/.test(date)) {
    process.stderr.write(`logo_export_kit: --date must be YYYY-MM-DD or an ISO UTC timestamp (got: ${date})\n`);
    return 2;
  }
  const provenance: Provenance = {
    ...(get("--backend") ? { backend: get("--backend") as string } : {}),
    ...(get("--model") ? { model: get("--model") as string } : {}),
    ...(get("--licence") ? { licence: get("--licence") as string } : {}),
    ...(commercial ? { commercial: commercial as Commercial } : {}),
    ...(assertion ? { assertion: assertion as Assertion } : {}),
    ...(get("--prompt-sha256") ? { promptSha256: get("--prompt-sha256") as string } : {}),
  };
  const r = await exportKit({
    mark,
    name,
    out,
    light: get("--light") ?? "#ffffff",
    dark: get("--dark") ?? "#111111",
    ...(date ? { created: date } : {}),
    provenance,
  });
  process.stdout.write(`wrote ${r.written.length} file(s) to ${out}\n`);
  if (r.missing.length) {
    process.stderr.write(`no Chromium — the PNG half was not rendered: ${r.missing.join(", ")}\n`);
    return 1;
  }
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then((c) => process.exit(c));
}
