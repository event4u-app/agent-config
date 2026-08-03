#!/usr/bin/env node
/**
 * Session-canary injection — `session_start` hook.
 *
 * Deterministic backstop for the `session-canary` rule. When the consumer has
 * set `personal.canary_name` in `.agent-settings.yml`, every NEW session gets a
 * `<session-canary>` context block injected at start (same mechanism as
 * hot-context: `{"decision":"allow","context":"<block>"}` on stdout; the
 * dispatcher forwards `context` on session_start so the host adds it to the
 * session context).
 *
 * Why a hook and not just the rule: the canary contract (greet the user by
 * name at task start; reply-close markers at the end of work replies) is a
 * liveness signal — the user watches it like a canary in a coal mine, and its
 * silent disappearance means the context window is degrading. A trigger-routed
 * rule alone is exactly the kind of surface that is dropped in fresh
 * conversations (found RED baseline on the reply-close PR-URL contract,
 * 2026-07-27); the session_start injection makes the contract present in every
 * new conversation on hook-capable hosts. Copilot (no hook surface) falls back
 * to the rule alone.
 *
 * Gate + name resolution (first non-empty wins — the canary is a PERSONAL,
 * user-global concern; the project file is only an override):
 *
 *   1. `<workspace_root>/.agent-settings.yml`            → `personal.canary_name`
 *   2. `<event4u_root>/settings/.agent-settings.yml`     → `personal.canary_name`
 *      (the wizard-managed user-global settings; legacy XDG root read as
 *      fallback via `user_global_paths.resolve_with_fallback`)
 *   3. `<event4u_root>/settings/.agent-user.yml`         → `identity.name`
 *      (the global user identity the setup wizard already collects — no
 *      per-project duplication of the name)
 *
 * No name anywhere → clean no-op (exit 0, no stdout). Never blocks
 * (fail_closed: false).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readHookStdin } from "./hooks/hook_stdin.js";
import { resolve_with_fallback } from "./_lib/user_global_paths.js";

const EXIT_ALLOW = 0;

export const SETTINGS_FILE = ".agent-settings.yml";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function _isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Minimal line-walker for `personal.canary_name` — no YAML dependency, same
 * approach as onboarding_gate_hook._read_onboarded. Returns the raw scalar or
 * null when the section/key is absent.
 */
export function read_canary_name(settings_path: string): string | null {
  let text: string;
  try {
    if (!fs.statSync(settings_path).isFile()) {
      return null;
    }
    text = fs.readFileSync(settings_path, "utf-8");
  } catch {
    return null;
  }
  let in_personal = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^personal\s*:\s*(?:#.*)?$/.test(line)) {
      in_personal = true;
      continue;
    }
    if (in_personal && /^\S/.test(line)) {
      in_personal = false; // left the personal: block
    }
    if (in_personal) {
      const m = /^\s+canary_name\s*:\s*(.*?)\s*(?:#.*)?$/.exec(line);
      if (m && m[1] !== undefined) {
        return m[1].trim();
      }
    }
  }
  return null;
}

/**
 * Line-walker for `identity.name` in the wizard's user-global
 * `settings/.agent-user.yml` — same no-YAML-dependency approach as
 * `read_canary_name`. Returns the raw scalar or null when absent.
 */
export function read_identity_name(user_yml_path: string): string | null {
  let text: string;
  try {
    if (!fs.statSync(user_yml_path).isFile()) {
      return null;
    }
    text = fs.readFileSync(user_yml_path, "utf-8");
  } catch {
    return null;
  }
  let in_identity = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^identity\s*:\s*(?:#.*)?$/.test(line)) {
      in_identity = true;
      continue;
    }
    if (in_identity && /^\S/.test(line)) {
      in_identity = false; // left the identity: block
    }
    if (in_identity) {
      const m = /^\s+name\s*:\s*(.*?)\s*(?:#.*)?$/.exec(line);
      if (m && m[1] !== undefined) {
        return m[1].trim();
      }
    }
  }
  return null;
}

/**
 * Resolve the canary name across the three layers (project override →
 * user-global settings → user-global identity). First non-empty wins;
 * an empty scalar at a layer means "not set here", not "feature off",
 * so the walk continues to the next layer.
 */
export function resolve_canary_name(workspace_root: string): string {
  const project = sanitize_name(
    read_canary_name(path.join(workspace_root, SETTINGS_FILE)),
  );
  if (project) {
    return project;
  }
  const global_settings = resolve_with_fallback(
    path.join("settings", ".agent-settings.yml"),
  );
  if (global_settings) {
    const name = sanitize_name(read_canary_name(global_settings));
    if (name) {
      return name;
    }
  }
  const global_user = resolve_with_fallback(path.join("settings", ".agent-user.yml"));
  if (global_user) {
    const name = sanitize_name(read_identity_name(global_user));
    if (name) {
      return name;
    }
  }
  return "";
}

/**
 * The name is user-owned config, but it lands verbatim in model context —
 * strip quotes, collapse whitespace, drop markup-significant characters, and
 * cap the length so a mangled settings file cannot smuggle a paragraph in.
 */
export function sanitize_name(raw: string | null): string {
  if (raw === null) {
    return "";
  }
  let name = raw.trim();
  if (
    (name.startsWith('"') && name.endsWith('"')) ||
    (name.startsWith("'") && name.endsWith("'"))
  ) {
    name = name.slice(1, -1);
  }
  name = name.replace(/[<>&`]/g, "").replace(/\s+/g, " ").trim();
  return name.slice(0, 64);
}

export function build_canary_block(name: string): string {
  return [
    `<session-canary settings-key="personal.canary_name">`,
    `The user has configured a session canary. Two obligations, this whole conversation:`,
    `1. OPENING CANARY — the first reply of this session, and the first reply of each` +
      ` NEW task within it, opens by addressing the user by name: "${name}". One natural` +
      ` mention in the user's language; intermediate replies of the same task do not re-greet.`,
    `2. CLOSING CANARY — a reply that landed substantial work ends with ONE compact` +
      ` end-summary, and a PR created or updated this turn puts its raw URL as the` +
      ` LITERAL LAST LINE (reply-close contract of the direct-answers rule).`,
    `Purpose: the user watches these markers like a canary in a mine — their silent` +
      ` disappearance signals context degradation. Never fake continuity: if you notice` +
      ` you dropped a canary, say so and suggest a fresh session or /agent-handoff.`,
    `</session-canary>`,
  ].join("\n");
}

function _workspaceRoot(envelope: JsonObject): string {
  const v = envelope["workspace_root"];
  if (typeof v === "string" && v) {
    return v;
  }
  return process.cwd();
}

export function main(): number {
  let envelope: JsonValue = {};
  try {
    const raw = _readStdin();
    envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
  } catch {
    // malformed stdin — still try cwd-based settings below; never block
  }
  const env: JsonObject = _isObject(envelope) ? envelope : {};

  // Only session_start carries context-injection semantics; other events no-op.
  const event = env["event"];
  if (typeof event === "string" && event !== "" && event !== "session_start") {
    return EXIT_ALLOW;
  }

  const root = _workspaceRoot(env);
  const name = resolve_canary_name(root);
  if (!name) {
    return EXIT_ALLOW; // canary not configured on any layer — clean no-op
  }

  process.stdout.write(
    `${JSON.stringify({
      decision: "allow",
      reason: `session-canary: active for "${name}"`,
      context: build_canary_block(name),
    })}\n`,
  );
  return EXIT_ALLOW;
}

function _readStdin(): string {
  return readHookStdin();
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
  if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
    return false;
  }
  if (process.argv[1] === undefined) {
    return false;
  }
  const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
  if (import.meta.url === argvUrl) {
    return true;
  }
  try {
    const here = fs.realpathSync(fileURLToPath(import.meta.url));
    const argv = fs.realpathSync(path.resolve(process.argv[1]));
    return here === argv;
  } catch {
    return false;
  }
}

if (_isCliEntry()) {
  process.exit(main());
}
