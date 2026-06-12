/**
 * Append-only log of dispatch-time issues — Phase 1 of `road-to-hooks-actually-fire-in-consumers`.
 *
 * TypeScript twin of `src/scripts/hooks/dispatch_issues.py` (ADR-090 —
 * Python→TS migration, Phase 6 / hooks core). Public API mirrors the
 * Python module exactly (snake_case kept deliberately — fidelity over
 * TS idiom).
 *
 * When a concern's resolver returns `None` (script missing, regenerator
 * missing, `./agent-config` symlink unresolvable) the dispatcher (or the
 * concern hook itself, when invoked as a subprocess) records ONE line in
 * `agents/runtime/state/dispatch-issues.jsonl` so the failure is
 * discoverable post-hoc instead of vanishing into the never-block
 * contract.
 *
 * Schema (locked by Council R3 pre-check, 2026-05-29):
 *
 *     {
 *       "timestamp": "<ISO-8601 UTC>",
 *       "hook":      "<concern-id>",
 *       "issue":     "prerequisite_missing | script_not_found | "
 *                    "permission_denied | execution_failed",
 *       "detail":    "<freeform one-line explanation>",
 *       "resolution": "<one-line command or doc link>"
 *     }
 *
 * Cap: 200 entries (council-revised from the original 50; debug
 * sessions with many tool calls would have lost evidence at the old
 * cap). Rotation drops the oldest line.
 *
 * Errors writing the log are swallowed — observability never breaks
 * the agent loop.
 */

import fs from "node:fs";
import path from "node:path";

export const LOG_CAP = 200;

export const VALID_ISSUE: ReadonlySet<string> = new Set([
  "prerequisite_missing",
  "script_not_found",
  "permission_denied",
  "execution_failed",
]);

export interface DispatchIssueEntry {
  timestamp: string;
  hook: string;
  issue: string;
  detail: string;
  resolution: string;
}

function _utc_iso(): string {
  // Python: datetime.now(timezone.utc).isoformat(timespec="seconds")
  //         .replace("+00:00", "Z") → "YYYY-MM-DDTHH:MM:SSZ".
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function _log_path(workspace_root: string): string {
  return path.join(
    workspace_root,
    "agents",
    "runtime",
    "state",
    "dispatch-issues.jsonl",
  );
}

// Python `sorted(VALID_ISSUE)` repr for str sets: ['a', 'b', ...].
function _sorted_repr(s: ReadonlySet<string>): string {
  const items = [...s].sort();
  return `[${items.map((x) => `'${x}'`).join(", ")}]`;
}

// Python json.dumps(entry, ensure_ascii=False) — compact separators
// (", ", ": "), no indent, non-ASCII preserved verbatim. Entry is a flat
// object of string values so the renderer stays minimal.
function _json_dumps_flat(entry: DispatchIssueEntry): string {
  const escape = (s: string): string => {
    let out = '"';
    for (const ch of s) {
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
        default: {
          const code = ch.codePointAt(0) as number;
          if (code < 0x20) {
            out += "\\u" + code.toString(16).padStart(4, "0");
          } else {
            out += ch; // ensure_ascii=False — keep non-ASCII verbatim.
          }
        }
      }
    }
    return out + '"';
  };
  const parts = (
    ["timestamp", "hook", "issue", "detail", "resolution"] as const
  ).map((k) => `${escape(k)}: ${escape(entry[k])}`);
  return `{${parts.join(", ")}}`;
}

/**
 * Append one dispatch-issue line. Best-effort; never raises.
 *
 * No-op when `AGENT_CONFIG_REPLAY=1` is set — fixture-driven replay
 * must not mutate state (contract: `docs/contracts/hook-architecture-v1.md`
 * § Replay mode).
 */
export function log_dispatch_issue(
  workspace_root: string,
  hook: string,
  issue: string,
  detail: string,
  resolution: string,
): void {
  if (process.env["AGENT_CONFIG_REPLAY"] === "1") {
    return;
  }

  if (!VALID_ISSUE.has(issue)) {
    // Schema violation is a bug in the caller, not a runtime failure —
    // surface on stderr so it's noticed during dev, but do not crash.
    process.stderr.write(
      `dispatch_issues: invalid issue '${issue}' (valid: ` +
        `${_sorted_repr(VALID_ISSUE)})\n`,
    );
    return;
  }

  const log = _log_path(workspace_root);
  const entry: DispatchIssueEntry = {
    timestamp: _utc_iso(),
    hook: String(hook),
    issue,
    detail: String(detail),
    resolution: String(resolution),
  };

  try {
    fs.mkdirSync(path.dirname(log), { recursive: true });
    // Read existing lines (cheap — bounded log).
    let existing: string[] = [];
    if (fs.existsSync(log)) {
      try {
        existing = fs.readFileSync(log, "utf-8").split("\n");
        // Python str.splitlines() drops a trailing empty element from a
        // trailing newline; mirror that.
        if (existing.length > 0 && existing[existing.length - 1] === "") {
          existing.pop();
        }
      } catch {
        existing = [];
      }
    }
    existing.push(_json_dumps_flat(entry));
    // Cap rotation: drop the oldest entries.
    if (existing.length > LOG_CAP) {
      existing = existing.slice(existing.length - LOG_CAP);
    }
    fs.writeFileSync(log, existing.join("\n") + "\n", { encoding: "utf-8" });
  } catch (exc) {
    // Observability never blocks the agent.
    const msg = exc instanceof Error ? exc.message : String(exc);
    process.stderr.write(`dispatch_issues: failed to append to ${log}: ${msg}\n`);
  }
}

/**
 * Return the log as a list of dicts. Empty list when missing.
 */
export function read_dispatch_issues(
  workspace_root: string,
): Record<string, unknown>[] {
  const log = _log_path(workspace_root);
  if (!fs.existsSync(log)) {
    return [];
  }
  const out: Record<string, unknown>[] = [];
  let lines: string[];
  try {
    lines = fs.readFileSync(log, "utf-8").split("\n");
  } catch {
    return [];
  }
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    try {
      out.push(JSON.parse(line) as Record<string, unknown>);
    } catch {
      continue;
    }
  }
  return out;
}

/**
 * Best-known fix hint string. Returned for use in `resolution` field.
 */
export function fix_hint(_workspace_root?: string): string {
  return "./agent-config init";
}
