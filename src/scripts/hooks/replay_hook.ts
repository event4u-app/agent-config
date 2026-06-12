#!/usr/bin/env node
/**
 * Fixture-driven hook replay — read-only dispatch through the runtime.
 *
 * TypeScript twin of `src/scripts/hooks/replay_hook.py` (ADR-090 —
 * Python→TS migration, Phase 6 / hooks core). Mirrors the Python CLI
 * contract exactly: same payload resolution, replay env flag, dispatcher
 * argument forwarding, `--json` summary shape, stdout/stderr split, and
 * exit codes (propagated from the dispatcher).
 *
 * Reads a stdin payload fixture from `tests/fixtures/hooks/` (one file per
 * event in `EVENT_VOCABULARY`), sets `AGENT_CONFIG_REPLAY=1`, and invokes
 * the universal dispatcher with the platform / event / payload tuple. The
 * replay flag tells `state_io` (and concerns that honour it) to skip every
 * write under `agents/runtime/state/` so the replay never mutates real session
 * state.
 *
 * Invocation:
 *
 *     node scripts/hooks/replay_hook.js \
 *         --platform <name> \
 *         --event <agent-config-event> \
 *         --payload tests/fixtures/hooks/<event>.json \
 *         [--native-event <native>] \
 *         [--manifest <path>] \
 *         [--json]
 *
 * The `--json` flag prints a structured replay summary on stdout
 * (platform, event, dispatcher exit code, captured stderr lines).
 * Non-zero exit is propagated from the dispatcher.
 *
 * Contract reference: `docs/contracts/hook-architecture-v1.md` § Replay mode.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// src/scripts/hooks/replay_hook.ts → parents[3] is the repo root.
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const DISPATCHER = path.join(
  REPO_ROOT,
  "src",
  "scripts",
  "hooks",
  "dispatch_hook.ts",
);
const DEFAULT_MANIFEST = path.join(
  REPO_ROOT,
  "src",
  "scripts",
  "hook_manifest.yaml",
);
const FIXTURE_DIR = path.join(REPO_ROOT, "tests", "fixtures", "hooks");
const REPLAY_ENV_VAR = "AGENT_CONFIG_REPLAY";

const TSX_BIN = path.join(
  REPO_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx",
);

function _isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * Accept either an absolute path, a path relative to CWD, or a bare
 * event name that resolves to `tests/fixtures/hooks/<name>.json`.
 */
function _resolve_payload(arg: string): string {
  if (_isFile(arg)) {
    return arg;
  }
  const bare = path.join(FIXTURE_DIR, `${arg}.json`);
  if (_isFile(bare)) {
    return bare;
  }
  throw new FileNotFoundError(
    `replay_hook: payload not found — tried '${arg}' and '${bare}'`,
  );
}

class FileNotFoundError extends Error {}

interface ReplayArgs {
  platform: string;
  event: string;
  payload: string;
  native_event: string;
  manifest: string;
  json: boolean;
  dry_run: boolean;
}

function _parse_args(argv: string[]): ReplayArgs {
  const args: ReplayArgs = {
    platform: "",
    event: "",
    payload: "",
    native_event: "",
    manifest: DEFAULT_MANIFEST,
    json: false,
    dry_run: false,
  };
  const required = { platform: false, event: false, payload: false };
  const take = (i: number, inline: string | null): [string, number] =>
    inline !== null ? [inline, i] : [argv[i + 1] ?? "", i + 1];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? "";
    let key = a;
    let inline: string | null = null;
    if (a.startsWith("--") && a.includes("=")) {
      key = a.slice(0, a.indexOf("="));
      inline = a.slice(a.indexOf("=") + 1);
    }
    switch (key) {
      case "--platform": {
        const [v, ni] = take(i, inline);
        args.platform = v;
        i = ni;
        required.platform = true;
        break;
      }
      case "--event": {
        const [v, ni] = take(i, inline);
        args.event = v;
        i = ni;
        required.event = true;
        break;
      }
      case "--payload": {
        const [v, ni] = take(i, inline);
        args.payload = v;
        i = ni;
        required.payload = true;
        break;
      }
      case "--native-event": {
        const [v, ni] = take(i, inline);
        args.native_event = v;
        i = ni;
        break;
      }
      case "--manifest": {
        const [v, ni] = take(i, inline);
        args.manifest = v;
        i = ni;
        break;
      }
      case "--json":
        args.json = true;
        break;
      case "--dry-run":
        args.dry_run = true;
        break;
    }
  }
  const missing: string[] = [];
  if (!required.platform) missing.push("--platform");
  if (!required.event) missing.push("--event");
  if (!required.payload) missing.push("--payload");
  if (missing.length > 0) {
    process.stderr.write(
      `replay_hook: the following arguments are required: ${missing.join(", ")}\n`,
    );
    process.exit(2);
  }
  return args;
}

export function main(argv?: string[]): number {
  const args = _parse_args(argv ?? process.argv.slice(2));

  let payload_path: string;
  try {
    payload_path = _resolve_payload(args.payload);
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : String(exc);
    process.stderr.write(`❌  ${msg}\n`);
    return 2;
  }

  const payload_text = fs.readFileSync(payload_path, "utf-8");
  // Validate JSON early so dispatcher stderr stays focused on real
  // concern problems. Empty / non-object payloads are still dispatched
  // — that mirrors the platform contract (stdin can be empty).
  let decoded: unknown;
  try {
    decoded = payload_text.trim() ? JSON.parse(payload_text) : {};
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : String(exc);
    process.stderr.write(
      `❌  replay_hook: invalid JSON in ${payload_path}: ${msg}\n`,
    );
    return 2;
  }

  const env = { ...process.env };
  env[REPLAY_ENV_VAR] = "1";

  const cmd = [
    DISPATCHER,
    "--platform",
    args.platform,
    "--event",
    args.event,
    "--manifest",
    args.manifest,
  ];
  if (args.native_event) {
    cmd.push("--native-event", args.native_event);
  }
  if (args.dry_run) {
    cmd.push("--dry-run");
  }

  const proc = spawnSync(TSX_BIN, cmd, {
    input: payload_text,
    encoding: "utf-8",
    env,
  });

  const returncode = proc.status ?? 0;

  if (args.json) {
    const sid =
      decoded !== null && typeof decoded === "object" && !Array.isArray(decoded)
        ? ((decoded as Record<string, unknown>)["session_id"] ?? null)
        : null;
    const rel = payload_path.startsWith(REPO_ROOT)
      ? path.relative(REPO_ROOT, payload_path)
      : payload_path;
    const summary = {
      platform: args.platform,
      event: args.event,
      native_event: args.native_event || "",
      payload: rel,
      session_id: sid,
      exit_code: returncode,
      dispatcher_stdout: (proc.stdout || "").trim(),
      dispatcher_stderr: (proc.stderr || "").trim(),
      replay_mode: true,
    };
    process.stdout.write(_py_json_dumps(summary, 2) + "\n");
  } else {
    if (proc.stdout) {
      process.stdout.write(proc.stdout);
    }
    if (proc.stderr) {
      process.stderr.write(proc.stderr);
    }
    process.stderr.write(
      `replay_hook: platform=${args.platform} event=${args.event} ` +
        `payload=${path.basename(payload_path)} rc=${returncode} ` +
        `(AGENT_CONFIG_REPLAY=1, no writes)\n`,
    );
  }
  return returncode;
}

// Python json.dumps(summary, indent=2) byte-for-byte (ensure_ascii=True).
function _py_json_dumps(value: unknown, indent: number): string {
  const pad = " ".repeat(indent);
  const escapeString = (s: string): string => {
    let out = '"';
    for (const ch of s) {
      const code = ch.codePointAt(0) as number;
      switch (ch) {
        case '"':
          out += '\\"';
          break;
        case "\\":
          out += "\\\\";
          break;
        case "\n":
          out += "\\n";
          break;
        case "\r":
          out += "\\r";
          break;
        case "\t":
          out += "\\t";
          break;
        case "\b":
          out += "\\b";
          break;
        case "\f":
          out += "\\f";
          break;
        default:
          if (code < 0x20 || code > 0x7e) {
            if (code > 0xffff) {
              const c = code - 0x10000;
              const hi = 0xd800 + (c >> 10);
              const lo = 0xdc00 + (c & 0x3ff);
              out +=
                "\\u" +
                hi.toString(16).padStart(4, "0") +
                "\\u" +
                lo.toString(16).padStart(4, "0");
            } else {
              out += "\\u" + code.toString(16).padStart(4, "0");
            }
          } else {
            out += ch;
          }
      }
    }
    return out + '"';
  };
  const render = (v: unknown, depth: number): string => {
    if (v === null || v === undefined) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return escapeString(v);
    const curPad = pad.repeat(depth + 1);
    const closePad = pad.repeat(depth);
    if (Array.isArray(v)) {
      if (v.length === 0) return "[]";
      return (
        "[\n" +
        v.map((item) => curPad + render(item, depth + 1)).join(",\n") +
        "\n" +
        closePad +
        "]"
      );
    }
    if (typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 0) return "{}";
      return (
        "{\n" +
        keys
          .map((k) => curPad + escapeString(k) + ": " + render(obj[k], depth + 1))
          .join(",\n") +
        "\n" +
        closePad +
        "}"
      );
    }
    throw new TypeError(`Object of type ${typeof v} is not JSON serializable`);
  };
  return render(value, 0);
}

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
  process.exit(main(process.argv.slice(2)));
}
