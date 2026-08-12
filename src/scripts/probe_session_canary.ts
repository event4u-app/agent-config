#!/usr/bin/env tsx
/**
 * Round 7 § 6.3 — the opening-canary rate, as a script instead of an ad-hoc probe.
 *
 * `session-canary` obliges the agent to address the user by name in the first
 * reply of a session AND of each new task within it. The rule's own text records
 * two audits reading it as broadly missed (~13/15, then 24/29 task starts) and
 * concludes the reminder carrier does not move it.
 *
 * This measures the half that is DECIDABLE from a transcript: the per-SESSION
 * instance. The per-TASK instance is not measurable at all — no task boundary is
 * recorded anywhere in a transcript — which is why the mechanism the rule
 * pre-registers ("a check at delivery that rejects a task-start reply carrying no
 * greeting") cannot be built as specified. Round 7 states that as an honest
 * downgrade rather than an unbuilt promise.
 *
 * Two instrument defects this probe was born with, fixed and recorded:
 *   1. Its first version omitted `You've hit your` from the harness predicate, so
 *      a spend-limit banner counted as a missed greeting: 24/28 instead of 25/28.
 *      The predicate is now the same one `conformance_scan` uses.
 *   2. It reads the first assistant turn carrying PROSE, not the first assistant
 *      entry: a session opening with 30 tool calls has no prose to greet in.
 *
 * Usage:
 *   ./scripts-run src/scripts/probe_session_canary [--limit N] [--store PATH] [--name NAME]
 *
 * Exit codes: 0 always — this is a measurement, not a gate. A rate is not a
 * verdict, and the round-7 reading (96 % post-carrier) is not a number anyone
 * should gate on before it has a second window to compare against.
 */
import fs from "node:fs";
import path from "node:path";

import { defaultStore, HARNESS_TEXT } from "./conformance_scan.js";

/** The first assistant turn that carries prose, or null. */
function firstProse(lines: string[]): { text: string; at: string } | null {
  for (const line of lines) {
    if (!line.trim()) continue;
    let e: Record<string, unknown>;
    try {
      e = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (e["isSidechain"] === true) continue;
    const msg = e["message"] as { role?: string; content?: unknown } | undefined;
    if (msg?.role !== "assistant") continue;
    const c = msg.content;
    if (!Array.isArray(c)) continue;
    const text = c
      .filter((b: { type?: string }) => b?.type === "text")
      .map((b: { text?: string }) => b.text ?? "")
      .join("\n")
      .trim();
    if (!text) continue;
    // A harness banner occupies an assistant turn without being the assistant
    // writing. Same predicate as the scan's, imported rather than re-typed.
    if (HARNESS_TEXT.test(text)) continue;
    return { text, at: String(e["timestamp"] ?? "") };
  }
  return null;
}

export interface CanaryRow {
  session: string;
  at: string;
  greeted: boolean;
  opener: string;
}

export function measure(store: string, limit: number, name: string): CanaryRow[] {
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return fs
    .readdirSync(store)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({ f, m: fs.statSync(path.join(store, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m)
    .slice(0, limit)
    .flatMap(({ f }) => {
      const lines = fs.readFileSync(path.join(store, f), "utf8").split("\n");
      const first = firstProse(lines);
      if (first === null) return [];
      // The name has to be in the OPENING, not anywhere in a long first reply —
      // a greeting is a greeting only where the reader looks for it.
      const head = first.text.split("\n").slice(0, 3).join(" ");
      return [
        {
          session: f.replace(/\.jsonl$/, "").slice(0, 8),
          at: first.at,
          greeted: re.test(head),
          opener: first.text.split("\n")[0]?.slice(0, 70).replace(/\s+/g, " ") ?? "",
        },
      ];
    });
}

export function main(argv?: string[]): number {
  const args = argv ?? process.argv.slice(2);
  const arg = (flag: string, dflt: string): string => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] !== undefined ? (args[i + 1] as string) : dflt;
  };
  const store = arg("--store", defaultStore(process.cwd()));
  const limit = Number(arg("--limit", "30"));
  const name = arg("--name", "Matze");

  if (!fs.existsSync(store)) {
    process.stdout.write(`probe:session-canary · store not found: ${store}\n`);
    return 0;
  }
  const rows = measure(store, limit, name);
  if (rows.length === 0) {
    process.stdout.write(`probe:session-canary · 0 session(s) with assistant prose in ${store}\n`);
    return 0;
  }
  const hit = rows.filter((r) => r.greeted).length;
  process.stdout.write(`probe:session-canary · ${rows.length} session(s) · name=${name}\n`);
  for (const r of rows.filter((r) => !r.greeted).sort((a, b) => a.at.localeCompare(b.at))) {
    process.stdout.write(`  MISS ${r.session} ${r.at.slice(0, 16)}  "${r.opener}"\n`);
  }
  process.stdout.write(
    `  opening canary present in ${hit}/${rows.length} sessions ` +
      `(${((100 * hit) / rows.length).toFixed(1)}%)\n`,
  );
  process.stdout.write(
    "  Per-SESSION only. The per-TASK instance the rule also obliges is NOT decidable\n" +
      "  from a transcript — no task boundary is recorded — so this figure is a floor on\n" +
      "  compliance, never a verdict on the obligation as a whole.\n",
  );
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  process.exit(main());
}
