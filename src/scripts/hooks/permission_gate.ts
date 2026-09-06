/**
 * permission_gate — whether a `pre_tool_use` call gets an explicit
 * `permissionDecision`, and which one.
 *
 * Four independent conditions, each able to withhold an allow on its own: the
 * host offers the field on `pre_tool_use` only; the dispatcher's reduced
 * severity must already be `allow`; no concern may have voted `ask` or `deny`;
 * and the call itself must be category A. An allow is emitted only when all
 * four hold, so widening any one of them is a visible edit rather than an
 * emergent effect.
 *
 * Separate from `dispatch_hook` because that file is against the per-file
 * source-size budget, and because the seam is real: the dispatcher runs
 * concerns and reduces exit codes, this module reads the result and decides
 * what the host is told about permission.
 */
import { isCategoryA, type ToolInput } from "./category_a.js";
import {
  composePermissionDecision,
  type PermissionDecision,
  type PermissionEmission,
} from "./host_semantics.js";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function _isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Mirrors `dispatch_hook.EXIT_ALLOW` / `EXIT_BLOCK`; imported would be a cycle. */
const EXIT_ALLOW = 0;
const EXIT_BLOCK = 1;

/** The host's `tool_name`, or `""` when the event carries none. */
export function _payload_tool_name(envelope: JsonObject): string {
  const payload = envelope["payload"];
  if (!_isObject(payload)) return "";
  const raw = payload["tool_name"];
  return typeof raw === "string" ? raw : "";
}

/** The host's `tool_input` object, or `{}` when the event carries none. */
export function _payload_tool_input(envelope: JsonObject): ToolInput {
  const payload = envelope["payload"];
  if (!_isObject(payload)) return {};
  const raw = payload["tool_input"];
  return _isObject(raw) ? (raw as ToolInput) : {};
}

/**
 * The root every category-A path argument must resolve inside.
 *
 * The host's own `cwd` wins over `workspace_root` because the latter is the
 * dispatcher's process cwd, which in a worktree is the parent checkout rather
 * than the tree the user is working in — confining against it would admit a
 * path outside the tree the call actually runs in.
 */
export function _working_tree_root(envelope: JsonObject): string {
  const payload = envelope["payload"];
  if (_isObject(payload) && typeof payload["cwd"] === "string" && payload["cwd"].trim()) {
    return payload["cwd"];
  }
  const workspace = envelope["workspace_root"];
  return typeof workspace === "string" ? workspace : "";
}

/**
 * One concern's permission verdict.
 *
 * A block is a deny. A concern may also say `{"decision":"ask"}` on stdout —
 * the field has been recorded in the feedback file since v1 and read by
 * nothing, so an advisory concern that wanted a confirmation got silence.
 * `ask` is honoured regardless of the exit code: an advisory concern cannot
 * block and must not have to in order to be heard. Everything else abstains,
 * which composes as `allow`.
 */
export function _concern_permission_verdict(
  rc: number,
  reply: JsonObject,
): PermissionDecision {
  if (rc === EXIT_BLOCK) return "deny";
  const stated = String(reply["decision"] ?? "").trim().toLowerCase();
  if (stated === "ask") return "ask";
  if (stated === "deny") return "deny";
  return "allow";
}

/**
 * The permission field to hand the host, or `null` to keep the legacy envelope.
 *
 * Four independent conditions, each able to withhold the allow on its own:
 * the host offers the field on `pre_tool_use` only; the reduced severity must
 * already be `allow`; no concern may have voted `ask` or `deny`; and the call
 * itself must be category A. An allow is emitted only when all four hold, so
 * widening any one of them is a visible edit rather than an emergent effect.
 */
export function _permission_for(
  event: string,
  envelope: JsonObject,
  final_rc: number,
  verdicts: readonly PermissionDecision[],
): PermissionEmission | null {
  if (event !== "pre_tool_use") return null;
  if (final_rc !== EXIT_ALLOW) return null;
  if (composePermissionDecision(verdicts) !== "allow") return null;
  const tool_name = _payload_tool_name(envelope);
  if (!isCategoryA(tool_name, _payload_tool_input(envelope), _working_tree_root(envelope))) {
    return null;
  }
  return {
    decision: "allow",
    reason:
      `agent-config: category-A ${tool_name} inside the working tree — ` +
      `no concern gates it and none asked to.`,
  };
}
