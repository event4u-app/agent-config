#!/usr/bin/env tsx
/**
 * Round 7 § 6.3 — the promissory-closing rate, as a script instead of an ad-hoc probe.
 *
 * `verify-before-complete` § Turn-completion forbids ending a turn on a promise of
 * unexecuted work ("I'll…", "als nächstes mache ich…"). Round 7 measured the rate
 * to decide whether to build a mechanism, and the answer was: don't — a blocking
 * `detectPromissory` ALREADY ships in `turn-end-gate`.
 *
 * That inverts the reading of a low number, and the inversion is the reason this
 * script exists. Round 7's first draft declined the class as "below any threshold
 * worth a gate"; with a gate already in place, 0.6 % is plausibly the mechanism
 * WORKING, not the class being rare. A rate over a gated class measures residual
 * leakage. Read it that way or not at all.
 *
 * WHAT IS COUNTED: only a HAND-BACK turn — an assistant turn immediately followed
 * by a genuine user turn, i.e. where the agent actually stopped. A promise in a
 * mid-turn message is not a violation; the agent kept going. A turn that ASKS is
 * also excluded: a question is a legitimate stop condition.
 *
 * HONEST BOUND: the predicate is deliberately narrow (first-person + future,
 * anchored in the closing lines), so the figure is a FLOOR. A looser predicate
 * over the same corpus read 1.2 % against this one's 0.6 %; both are printed so a
 * reader can see the width of the bracket rather than trust one edge of it.
 *
 * Usage:
 *   ./scripts-run src/scripts/probe_promissory_closing [--limit N] [--store PATH]
 *
 * Exit codes: 0 always — a measurement, not a gate.
 */
import fs from "node:fs";
import path from "node:path";

import { defaultStore, HARNESS_TEXT, isInjectedBody } from "./conformance_scan.js";
import { isSyntheticPrompt } from "./_lib/prompt_shape.js";

/** First person + intent, at the start of a closing sentence. Narrow on purpose. */
export const PROMISE_NARROW: readonly RegExp[] = [
  /\bich (mache|baue|schreibe|starte|prüfe|räume|setze|lege|fixe|committe|pushe|nehme|ziehe|hole|führe|erstelle|implementiere)\b[^.?!]{0,80}\b(jetzt|als nächstes|gleich|danach|anschließend|im nächsten schritt)\b/i,
  /\b(als nächstes|im nächsten schritt|danach) (mache|baue|schreibe|starte|prüfe|nehme|committe|pushe|erstelle|implementiere) ich\b/i,
  /\bi'?(ll| will) (now |next |then )?(start|build|write|check|run|fix|commit|push|create|implement|add|wire|measure)\b/i,
  /\bnext,? i'?(ll| will)\b/i,
  /\bi'?m going to (start|build|write|check|run|fix|commit|push|create|implement)\b/i,
];

/** The bracket's other edge — any future-intent marker at all. */
export const PROMISE_LOOSE =
  /\b(ich werde|ich mache|ich baue|ich starte|ich prüfe|als nächstes|next up|i'll |i will |i'm going to|nun mache ich|jetzt mache ich)/i;

/** A reply that asks is a legitimate stop condition, never a promissory closing. */
const ASKS = /(\?\s*$)|(^\s*\d\.\s)/m;

interface Turn {
  role: "user" | "assistant";
  text: string;
  at: string;
}

function turns(lines: string[]): Turn[] {
  const out: Turn[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    let e: Record<string, unknown>;
    try {
      e = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (e["isSidechain"] === true) continue;
    if (e["type"] === "user" && e["toolUseResult"] !== undefined) continue;
    if (e["isCompactSummary"] === true) continue;
    const msg = e["message"] as { role?: string; content?: unknown } | undefined;
    const role = msg?.role;
    if (role !== "user" && role !== "assistant") continue;
    const c = msg?.content;
    const text =
      typeof c === "string"
        ? c
        : Array.isArray(c)
          ? c
              .filter((b: { type?: string }) => b?.type === "text")
              .map((b: { text?: string }) => b.text ?? "")
              .join("\n")
          : "";
    if (!text.trim()) continue;
    if (role === "assistant" && HARNESS_TEXT.test(text.trim())) continue;
    // A skill / slash-command body arrives in the user role and is not a chat
    // message, so it must not close a hand-back.
    if (role === "user" && (isSyntheticPrompt(text) || isInjectedBody(text))) continue;
    out.push({ role, text, at: String(e["timestamp"] ?? "") });
  }
  return out;
}

export interface PromissoryResult {
  /** Hand-back turns that could carry a promissory closing — asking ones excluded. */
  handbacks: number;
  /** Asking hand-backs, excluded from the population. R2 finding 6. */
  asked: number;
  narrow: { session: string; at: string; span: string }[];
  loose: number;
}

export function measure(store: string, limit: number): PromissoryResult {
  const result: PromissoryResult = { handbacks: 0, asked: 0, narrow: [], loose: 0 };
  const files = fs
    .readdirSync(store)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({ f, m: fs.statSync(path.join(store, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m)
    .slice(0, limit);

  for (const { f } of files) {
    const session = f.replace(/\.jsonl$/, "").slice(0, 8);
    const ts = turns(fs.readFileSync(path.join(store, f), "utf8").split("\n"));
    for (let i = 0; i < ts.length; i += 1) {
      const t = ts[i] as Turn;
      if (t.role !== "assistant") continue;
      const next = ts[i + 1];
      // A hand-back: the next turn is the user's, or the session ends here.
      if (next !== undefined && next.role !== "user") continue;
      const tail = t.text.trimEnd().split("\n").slice(-4).join("\n");
      // R2 finding 6: `handbacks` was incremented BEFORE this guard, so every
      // asking hand-back sat in the denominator while being excluded from both
      // numerators — understating both rates by the ask share. An asking closing
      // is a legitimate stop condition and cannot be a promissory closing, so it
      // is not in the population at all. Counted separately, because a reader who
      // cannot see the ask share cannot judge the denominator.
      if (ASKS.test(tail)) {
        result.asked += 1;
        continue;
      }
      result.handbacks += 1;
      if (PROMISE_LOOSE.test(tail)) result.loose += 1;
      const hit = PROMISE_NARROW.find((re) => re.test(tail));
      if (hit) {
        result.narrow.push({ session, at: t.at, span: (tail.match(hit)?.[0] ?? "").slice(0, 110) });
      }
    }
  }
  return result;
}

export function main(argv?: string[]): number {
  const args = argv ?? process.argv.slice(2);
  const arg = (flag: string, dflt: string): string => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] !== undefined ? (args[i + 1] as string) : dflt;
  };
  const store = arg("--store", defaultStore(process.cwd()));
  const limit = Number(arg("--limit", "30"));

  if (!fs.existsSync(store)) {
    process.stdout.write(`probe:promissory-closing · store not found: ${store}\n`);
    return 0;
  }
  const r = measure(store, limit);
  process.stdout.write(
    `probe:promissory-closing · ${r.handbacks} eligible hand-back turn(s) ` +
      `(+${r.asked} that ASK, excluded — a question is a legitimate stop condition) in ${store}\n`,
  );
  for (const h of r.narrow) {
    process.stdout.write(`  ${h.session} ${h.at.slice(0, 16)}  ${JSON.stringify(h.span)}\n`);
  }
  const pct = (n: number): string => (r.handbacks === 0 ? "—" : `${((100 * n) / r.handbacks).toFixed(1)}%`);
  process.stdout.write(
    `  narrow predicate: ${r.narrow.length} (${pct(r.narrow.length)}) · ` +
      `loose predicate: ${r.loose} (${pct(r.loose)})\n`,
  );
  process.stdout.write(
    "  The class is ALREADY GATED — `turn-end-gate` ships a blocking `detectPromissory`.\n" +
      "  So a low figure here is residual leakage past a working mechanism, not evidence\n" +
      "  the class is rare. The narrow figure is a floor; the loose one is the other edge.\n",
  );
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  process.exit(main());
}
