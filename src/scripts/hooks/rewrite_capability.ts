/**
 * The only way to obtain permission to rewrite a channel on a host.
 *
 * A parsed `host_lowering.yaml` row states what a host may do; it authorizes
 * nothing by itself. Authority is a `RewriteCapability`, and the only code that
 * issues one is `resolveRewriteCapability`, after every prerequisite has passed —
 * so a consumer that skipped the lint still cannot act on an unchecked row. The
 * lint runs the same function and reports its gaps, which keeps "what the lint
 * accepts" and "what a stage may do" one decision instead of two.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { REWRITE_CHANNEL_SLOT, type RewriteChannel, type SurfaceRow } from "./host_lowering.js";

/** Where a live rewrite probe record lives, and the one name shape it may have. */
export const REWRITE_PROBE_PATH = /^agents\/evidence\/analysis\/host-[a-z0-9-]+-probe-(\d{4}-\d{2}-\d{2})\.md$/;

const ISSUED = new WeakSet<object>();

/** Opaque: only `resolveRewriteCapability` creates one, and `isRewriteCapability` recognises only those. */
export interface RewriteCapability {
  readonly host: string;
  readonly channel: RewriteChannel;
  readonly mode: "replace" | "gate";
  /** The host version the cited probe observed; `null` for a gate, which rests on no probe. */
  readonly probedVersion: string | null;
  readonly expires: string;
}

export function isRewriteCapability(v: unknown): v is RewriteCapability {
  return typeof v === "object" && v !== null && ISSUED.has(v);
}

/** A probe record on disk, reduced to the lines the decision reads. */
export interface ProbeRecord {
  readonly path: string;
  readonly date: string;
  readonly host: string | null;
  readonly host_version: string | null;
  readonly channel: string | null;
  readonly result: string | null;
}

export interface CapabilityContext {
  readonly today: string;
  readonly root: string;
  /** The running host's version when the event carries one; a different minor revokes a `replace`. */
  readonly observedHostVersion?: string | null;
  /** Every probe record in the tree; read from disk when absent. */
  readonly probes?: readonly ProbeRecord[];
}

export type CapabilityResult =
  | { readonly ok: true; readonly capability: RewriteCapability }
  | { readonly ok: false; readonly gaps: readonly string[] };

function lineValue(lines: readonly string[], key: string): string | null {
  const hit = lines.find((l) => l.startsWith(`${key}: `));
  return hit === undefined ? null : hit.slice(key.length + 2).trim();
}

/** One record, or `null` when the path is not a probe record or cannot be read. */
export function readProbeRecord(root: string, rel: string): ProbeRecord | null {
  const m = REWRITE_PROBE_PATH.exec(rel);
  if (m === null) return null;
  let text: string;
  try {
    text = fs.readFileSync(path.join(root, rel), "utf-8");
  } catch {
    return null;
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  return {
    path: rel,
    date: m[1] as string,
    host: lineValue(lines, "host"),
    host_version: lineValue(lines, "host_version"),
    channel: lineValue(lines, "channel"),
    result: lineValue(lines, "result"),
  };
}

/** Every probe record in the evidence directory; an unreadable directory is an empty list. */
export function listProbeRecords(root: string): ProbeRecord[] {
  const dir = path.join(root, "agents", "evidence", "analysis");
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const out: ProbeRecord[] = [];
  for (const n of names.sort()) {
    const r = readProbeRecord(root, `agents/evidence/analysis/${n}`);
    if (r !== null) out.push(r);
  }
  return out;
}

function minorOf(v: string): string {
  return v.split(".").slice(0, 2).join(".");
}

/**
 * Every reason the answer for `channel` on `row` does not authorize `mode`.
 * Both modes need a propagating trampoline, a current `verified` block and a
 * bound native slot; a gate also needs a `block_exit`; a replace also needs a
 * native envelope and a structured probe record for this host, version and
 * channel, dated the day of the answer, that no later record contradicts. A
 * running host whose minor version differs from the probed one revokes it.
 */
export function rewriteCapabilityGaps(
  host: string,
  row: SurfaceRow,
  channel: RewriteChannel,
  ctx: CapabilityContext,
): string[] {
  const answer = row.rewrite.get(channel);
  const mode = answer?.mode;
  if (answer === undefined || (mode !== "replace" && mode !== "gate")) {
    return [`the answer is ${mode === undefined ? "unstated" : `'${mode}'`}, which authorizes nothing`];
  }
  const why: string[] = [];
  const slotName = REWRITE_CHANNEL_SLOT[channel];
  const slot = row.slots.get(slotName);
  if (row.fail_policy !== "propagate") why.push(`the trampoline does not propagate (\`fail_policy: ${row.fail_policy}\`)`);
  if (row.verified === null) why.push("the row is unverified");
  else if (row.verified.expires < ctx.today) why.push(`the row expired ${row.verified.expires}`);
  if (slot === undefined || !slot.native.some((n) => n !== "" && n !== "null")) {
    why.push(`this package binds no native \`${slotName}\` event here`);
  }
  if (mode === "gate") {
    if (slot !== undefined && slot.block_exit === null) why.push(`\`${slotName}\` carries no \`block_exit\``);
    return why;
  }
  if (row.json_shape === "none") why.push("the row has no native envelope (`json_shape: none`)");
  if (answer.host_version === null) why.push("the answer names no probed host version");
  if (answer.probe === null) {
    why.push("the answer cites no live substitution probe (use `offered` for a documented field)");
    return why;
  }
  if (!REWRITE_PROBE_PATH.test(answer.probe)) {
    why.push(`the probe ${answer.probe} is not a record under agents/evidence/analysis/ named host-<what>-probe-<date>.md`);
    return why;
  }
  const rec = readProbeRecord(ctx.root, answer.probe);
  if (rec === null) {
    why.push(`the cited probe ${answer.probe} does not exist`);
    return why;
  }
  if (answer.host_version !== null) {
    const want: Array<[string, string | null, string]> = [
      ["host", rec.host, host],
      ["host_version", rec.host_version, answer.host_version],
      ["channel", rec.channel, channel],
      ["result", rec.result, "delivered"],
    ];
    const missing = want.filter(([, got, exp]) => got !== exp).map(([k, , exp]) => `\`${k}: ${exp}\``);
    if (missing.length > 0) why.push(`the probe ${answer.probe} does not record ${missing.join(", ")}`);
  }
  if (answer.answered_at !== rec.date) {
    why.push(`the answer is dated ${answer.answered_at ?? "nowhere"} and its probe ${rec.date}; a replace is answered the day it was probed`);
  }
  const probes = ctx.probes ?? listProbeRecords(ctx.root);
  const later = probes.find(
    (p) => p.path !== rec.path && p.host === host && p.channel === channel && p.date > rec.date && p.result !== "delivered",
  );
  if (later !== undefined) why.push(`a later probe ${later.path} records \`result: ${later.result ?? "nothing"}\``);
  const seen = ctx.observedHostVersion;
  if (seen && answer.host_version !== null && minorOf(seen) !== minorOf(answer.host_version)) {
    why.push(`the running host is ${seen} and the probe observed ${answer.host_version}`);
  }
  return why;
}

/** A capability when every prerequisite passes; otherwise the gaps, and nothing a caller could act on. */
export function resolveRewriteCapability(
  host: string,
  row: SurfaceRow | null | undefined,
  channel: RewriteChannel,
  ctx: CapabilityContext,
): CapabilityResult {
  if (row === null || row === undefined) return { ok: false, gaps: [`no lowering row for ${host}`] };
  const gaps = rewriteCapabilityGaps(host, row, channel, ctx);
  if (gaps.length > 0) return { ok: false, gaps };
  const answer = row.rewrite.get(channel);
  const capability: RewriteCapability = Object.freeze({
    host,
    channel,
    mode: answer?.mode as "replace" | "gate",
    probedVersion: answer?.mode === "replace" ? answer.host_version : null,
    expires: row.verified?.expires ?? ctx.today,
  });
  ISSUED.add(capability);
  return { ok: true, capability };
}
