#!/usr/bin/env node
/**
 * PreToolUse anti-slop nudge — surfaces high-severity aesthetic tells in
 * proposed UI content BEFORE the write (road-to-anti-slop-detector Phase 3).
 *
 * OPTIONAL, host-limited (pre_tool_use fires on ~2–3 hosts). The universal
 * source of truth is the `lint_design_slop` linter / CI gate; this hook is a
 * convenience layer that runs the same registry against the about-to-be-written
 * content. Default-OFF: no-ops unless `hooks.design_slop.enabled: true` in
 * `.agent-settings.yml`. fail_closed: false (never break a write for a flag).
 *
 * FLAGS, NEVER A BLOCK. On a P0/P1 finding it WARNS (exit 2 + reason); it never
 * returns block (exit 1). Mirrors the injection-scan "warn, don't block" shape.
 *
 * Anti-loop degradation (council-required safety valve): a `file::rule`
 * signature surfaced ≥ DEGRADE_AFTER times is downgraded to silent, so a
 * deliberate-but-undeclared pattern the agent keeps re-writing never traps it.
 * State: <root>/agents/runtime/state/design-slop-hook.json.
 *
 * Exit codes (dispatcher contract): 0 allow · 2 warn (+ JSON reason on stdout).
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { type DesignContext } from "../design_slop_rules.ts";
import { loadDesignContext, scanFile } from "../lint_design_slop.ts";

const SETTINGS_FILE = ".agent-settings.yml";
const EXIT_ALLOW = 0;
const EXIT_WARN = 2;
const DEGRADE_AFTER = 3; // surfaces of the same file::rule signature before going silent
const UI_EXT = /\.(html|htm|css|scss|sass|less|vue|svelte|astro|jsx|tsx)$/i;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Minimal `.agent-settings.yml` reader for hooks.design_slop.enabled (mirrors injection-scan). */
function enabled(root: string): boolean {
  const f = path.join(root, SETTINGS_FILE);
  let text: string;
  try {
    if (!fs.statSync(f).isFile()) return false;
    text = fs.readFileSync(f, "utf-8");
  } catch {
    return false;
  }
  let inHooks = false;
  let inDs = false;
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/\s+$/, "");
    if (!line || line.replace(/^\s+/, "").startsWith("#")) continue;
    if (!(line.startsWith(" ") || line.startsWith("\t"))) {
      inHooks = /^hooks\s*:\s*$/.test(line);
      inDs = false;
      continue;
    }
    if (inHooks) {
      if (/^\s+design_slop\s*:\s*$/.test(line)) {
        inDs = true;
        continue;
      }
      if (inDs && /^\s{0,3}\S/.test(line)) inDs = false;
    }
    if (inDs && /^\s+enabled\s*:\s*true\b/.test(line)) return true;
  }
  return false;
}

/** Best-effort: pull (toolName, filePath, proposedContent) from the PreToolUse envelope. */
function extract(envelope: JsonObject): { file: string; content: string } | null {
  const ti = envelope["tool_input"] ?? envelope["toolInput"] ?? envelope["input"];
  if (!isObject(ti)) return null;
  const fileVal = ti["file_path"] ?? ti["path"] ?? ti["filePath"];
  const file = typeof fileVal === "string" ? fileVal : "";
  // Edit → new_string/new_str; Write → content; some hosts → text
  for (const key of ["content", "new_string", "new_str", "text", "newText"]) {
    const v = ti[key];
    if (typeof v === "string" && v.length > 0) return { file, content: v };
  }
  return null;
}

function stateFile(root: string): string {
  return path.join(root, "agents", "runtime", "state", "design-slop-hook.json");
}

function readState(root: string): Record<string, number> {
  try {
    const t = fs.readFileSync(stateFile(root), "utf-8");
    const parsed = JSON.parse(t);
    return isObject(parsed) ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function writeState(root: string, state: Record<string, number>): void {
  try {
    const sf = stateFile(root);
    fs.mkdirSync(path.dirname(sf), { recursive: true });
    fs.writeFileSync(sf, JSON.stringify(state, null, 2) + "\n");
  } catch {
    /* fail-open: never break a write because state could not persist */
  }
}

function readStdin(): string {
  try {
    return fs.readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

export function main(): number {
  let envelope: JsonValue;
  try {
    const raw = readStdin();
    envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
  } catch {
    return EXIT_ALLOW;
  }
  if (!isObject(envelope)) return EXIT_ALLOW;

  const rootVal = envelope["cwd"] ?? envelope["project_root"] ?? ".";
  const root = typeof rootVal === "string" && rootVal ? rootVal : ".";
  if (!enabled(root)) return EXIT_ALLOW;

  const ex = extract(envelope);
  if (!ex || !ex.file || !UI_EXT.test(ex.file)) return EXIT_ALLOW;

  let ctx: DesignContext;
  try {
    ctx = loadDesignContext(path.dirname(path.resolve(root, ex.file)));
  } catch {
    ctx = { raw: "", has: () => false };
  }

  let findings;
  try {
    findings = scanFile(ex.content, ex.file, ctx).filter(
      (f) => f.severity === "P0" || f.severity === "P1",
    );
  } catch {
    return EXIT_ALLOW;
  }
  if (findings.length === 0) return EXIT_ALLOW;

  // Anti-loop degradation: drop any signature already surfaced DEGRADE_AFTER times.
  const state = readState(root);
  const surfaced = findings.filter((f) => {
    const sig = `${ex.file}::${f.rule}`;
    const seen = state[sig] ?? 0;
    if (seen >= DEGRADE_AFTER) return false; // gone silent — never trap the agent
    state[sig] = seen + 1;
    return true;
  });
  writeState(root, state);

  if (surfaced.length === 0) return EXIT_ALLOW;

  const lines = surfaced
    .map((f) => `${f.catalogId} (${f.rule}) ${f.file}:${f.line} — ${f.message}`)
    .join("; ");
  const reason =
    "⚠️ Anti-slop: high-severity aesthetic tell(s) in the proposed UI — " +
    lines +
    ". Rebuttable: declare intent in DESIGN.md, add design-slop-disable-next-line, " +
    "or proceed if deliberate (this is a flag, not a block).";
  process.stdout.write(JSON.stringify({ decision: "warn", reason }) + "\n");
  return EXIT_WARN;
}

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) process.exit(main());
