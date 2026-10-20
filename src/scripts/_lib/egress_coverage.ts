/**
 * The egress coverage table (placeholders 6.3): channel × host × auth mode ×
 * launch mode × published state, generated from the lowering table's rewrite
 * axis, the probe records it cites, the sender census and the channels the
 * probes showed no hook reaches. Rendered into the contract by
 * `egress_sender_census --write` and printed by `hooks:status`.
 *
 * Four states, as the contract defines them: `asserted` only where this package
 * owns the bytes that leave (its own senders through the engine), `replaced`
 * where a hook substitutes, `gated` where a hook can only refuse, `uncovered`
 * everywhere else. A channel the inputs cannot place is `unclassified`, never
 * dropped. A state holds for the auth mode its probe record names and no other:
 * one working mode never greens another mode's row.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { parseHostLowering, type HostLowering } from "../hooks/host_lowering.js";
import { scanSenders, type SenderRow } from "./egress_sender_scan.js";
import { parseRewriteAxis, REWRITE_CHANNEL_SLOT, type RewriteChannel } from "./rewrite_axis.js";
import { readProbeRecord, resolveRewriteCapability } from "./rewrite_capability.js";

export type CoverageState = "asserted" | "replaced" | "gated" | "uncovered" | "unclassified";

export const AUTH_MODES = ["subscription", "api-key", "cloud-provider"] as const;
export const LAUNCH_MODES = ["direct"] as const;

export interface CoverageRow {
  readonly channel: string;
  readonly host: string;
  readonly auth: string;
  readonly launch: string;
  readonly state: CoverageState;
  readonly basis: string;
}

/** Hook channels a rewrite answer governs. */
const HOOK_CHANNELS: ReadonlyArray<{ channel: string; axis: RewriteChannel }> = [
  { channel: "tool result", axis: "output" },
  { channel: "tool input (restore)", axis: "input" },
  { channel: "typed prompt", axis: "prompt" },
];

/** Channels the 2026-10-20 probe showed, or K6 names, that no hook reaches on any host. */
const UNREACHED: ReadonlyArray<{ channel: string; basis: string }> = [
  { channel: "@file mention", basis: "no tool hook fires; the file arrives as a synthetic Read result (probe 0.2.4)" },
  { channel: "instruction files", basis: "loaded by the host before any hook runs (K6)" },
  { channel: "compaction request", basis: "built by the host; no hook carries its body (K6)" },
  { channel: "images and other non-text parts", basis: "never scanned (K6)" },
  { channel: "spilled tool output", basis: "the hook sees only the prefix; the spill file keeps the original until it is read (probe 0.1.5)" },
];

/** Host telemetry settings that would export prompts or request bodies: an egress path no hook closes. */
export const TELEMETRY: Readonly<Record<string, string>> = {
  claude:
    "`CLAUDE_CODE_ENABLE_TELEMETRY=1` with `OTEL_LOG_USER_PROMPTS=1` exports prompt text and assistant text; tool output was not exported (probe 0.1.7)",
};

/** Slots that carry session content, by the axis that governs them; any other bound content slot is unclassified. */
const MAPPED_SLOTS = new Set<string>(Object.values(REWRITE_CHANNEL_SLOT));
const CONTENT_SLOTS = new Set<string>(["user_prompt_submit", "pre_tool_use", "post_tool_use", "pre_compact", "subagent_start"]);

export function coverageRows(table: HostLowering, senders: readonly SenderRow[], root: string, today: string): CoverageRow[] {
  const rows: CoverageRow[] = [];
  for (const [host, surfaces] of table) {
    const row = surfaces.get("any") ?? [...surfaces.values()][0];
    if (row === undefined) continue;
    const axis = parseRewriteAxis(host, row.rewrite_raw);
    for (const { channel, axis: ch } of HOOK_CHANNELS) {
      const cap = resolveRewriteCapability(host, row, ch, { today, root });
      const answer = axis.ok ? axis.answers.get(ch) : undefined;
      const probed = answer?.probe ? readProbeRecord(root, answer.probe) : null;
      // A gate rests on a refusal code, a replace on a probe that names its auth mode; neither speaks for another mode.
      const mode = cap.ok ? (cap.capability.mode === "replace" ? (probed?.auth_mode ?? null) : "subscription") : null;
      for (const auth of AUTH_MODES) {
        const state: CoverageState = cap.ok && auth === mode ? (cap.capability.mode === "replace" ? "replaced" : "gated") : "uncovered";
        const basis = cap.ok
          ? auth === mode
            ? `${cap.capability.mode} on ${REWRITE_CHANNEL_SLOT[ch]}${probed ? ` (${probed.path}, ${probed.host_version})` : ""}`
            : `not probed for ${auth}`
          : cap.gaps[0] ?? "no capability";
        for (const launch of LAUNCH_MODES) rows.push({ channel, host, auth, launch, state, basis });
      }
    }
    for (const { channel, basis } of UNREACHED) {
      for (const auth of AUTH_MODES) rows.push({ channel, host, auth, launch: "direct", state: "uncovered", basis });
    }
    for (const auth of AUTH_MODES) {
      rows.push({
        channel: "host telemetry export",
        host,
        auth,
        launch: "direct",
        state: "uncovered",
        basis: TELEMETRY[host] ?? "not examined for this host",
      });
    }
    for (const slot of row.slots.keys()) {
      if (!CONTENT_SLOTS.has(slot) || MAPPED_SLOTS.has(slot)) continue;
      for (const auth of AUTH_MODES) {
        rows.push({ channel: `slot ${slot}`, host, auth, launch: "direct", state: "unclassified", basis: "carries session content; no rewrite answer governs it" });
      }
    }
  }
  for (const s of senders) {
    const state: CoverageState = s.status === "unclassified" ? "unclassified" : s.status === "local" ? "uncovered" : s.engine ? "asserted" : "uncovered";
    const basis = s.status === "local" ? "local endpoint" : s.engine ? "passes the egress engine before sending" : `sender census: ${s.status}, engine no`;
    rows.push({ channel: `package sender \`${s.module}\``, host: "this package", auth: "any", launch: "direct", state, basis });
  }
  return rows;
}

export function renderCoverage(rows: readonly CoverageRow[]): string {
  const lines = [
    "| channel | host | auth mode | launch mode | state | basis |",
    "|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.channel} | ${r.host} | ${r.auth} | ${r.launch} | **${r.state}** | ${r.basis} |`),
    "",
  ];
  const tally = new Map<CoverageState, number>();
  for (const r of rows) tally.set(r.state, (tally.get(r.state) ?? 0) + 1);
  lines.push(
    `Rows: ${rows.length} — ${["asserted", "replaced", "gated", "uncovered", "unclassified"].map((s) => `${s} ${tally.get(s as CoverageState) ?? 0}`).join(", ")}. ` +
      "A state other than `uncovered` holds only while `egress.placeholders.mode` is `protect` or `strict` and the kill switch is not thrown.",
  );
  return lines.join("\n");
}

/** The whole table from the tree at `root`. */
export function coverageFromTree(root: string, today: string = new Date().toISOString().slice(0, 10)): string {
  const table = parseHostLowering(fs.readFileSync(path.join(root, "src", "scripts", "hooks", "host_lowering.yaml"), "utf-8"));
  return renderCoverage(coverageRows(table, scanSenders(root), root, today));
}
