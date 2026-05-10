/**
 * Prompts surface — `prompts/list` + `prompts/get`.
 *
 * Mirrors `scripts/mcp_server/prompts.py::to_mcp_prompt_meta` verbatim:
 *
 *   wire name  =  skill.<frontmatter-name>             (kind=skill)
 *   wire name  =  command.<frontmatter-name with : → .>   (kind=command)
 *
 * The internal `uri` field on ContentEntry (`skill://<name>` /
 * `command://<name>`) is the blob lookup key, NOT the wire identifier.
 */

import type { ContentBlob, ContentEntry } from "./content.js";
import { entriesOfKind } from "./content.js";

/** Cursor-pagination page size. Mirrors Python kernel (B4). */
const PAGE_SIZE = 50;

export type McpPromptMeta = {
  name: string;
  title: string;
  description: string;
  arguments: ReadonlyArray<{ name: string; description?: string; required?: boolean }>;
  _meta: {
    source: string;
    kind: "skill" | "command";
  };
};

export type McpPromptListResponse = {
  prompts: McpPromptMeta[];
  nextCursor?: string;
};

export type McpPromptGetResponse = {
  description?: string;
  messages: Array<{
    role: "user";
    content: { type: "text"; text: string };
  }>;
  _meta: {
    source: string;
    kind: "skill" | "command";
  };
};

/** Translate frontmatter name → MCP wire name. Mirrors Python. */
export function wireNameOf(entry: ContentEntry): string {
  const kind = entry.kind;
  if (kind === "command") return `command.${entry.name.replace(/:/g, ".")}`;
  return `skill.${entry.name}`;
}

function entryToMeta(e: ContentEntry): McpPromptMeta {
  const kind = e.kind as "skill" | "command";
  return {
    name: wireNameOf(e),
    title: e.name,
    description: e.description,
    arguments: [],
    _meta: { source: e.source, kind },
  };
}

/**
 * Returns `prompts/list` page. Sort is by MCP wire name ascending
 * (deterministic across boots, same as Python `load_all_prompts`).
 * Cursor is the wire name of the last returned entry.
 */
export function listPrompts(
  blob: ContentBlob,
  cursor: string | undefined,
): McpPromptListResponse {
  const all = entriesOfKind(blob, ["skill", "command"])
    .slice()
    .sort((a, b) => {
      const wa = wireNameOf(a);
      const wb = wireNameOf(b);
      return wa < wb ? -1 : wa > wb ? 1 : 0;
    });
  const startIdx = cursor ? all.findIndex((e) => wireNameOf(e) === cursor) + 1 : 0;
  const page = all.slice(startIdx, startIdx + PAGE_SIZE);
  const next =
    startIdx + PAGE_SIZE < all.length ? wireNameOf(page[page.length - 1]!) : undefined;
  return {
    prompts: page.map(entryToMeta),
    ...(next ? { nextCursor: next } : {}),
  };
}

/**
 * Returns `prompts/get` for a wire-name lookup (e.g. `skill.foo` or
 * `command.research.report`). Skill wins on cross-kind duplicates —
 * mirrors Python `load_all_prompts` dedup precedence.
 */
export function getPrompt(
  blob: ContentBlob,
  wireName: string,
): McpPromptGetResponse | null {
  const candidates = entriesOfKind(blob, ["skill", "command"]).filter(
    (e) => wireNameOf(e) === wireName,
  );
  if (candidates.length === 0) return null;
  candidates.sort((a) => (a.kind === "skill" ? -1 : 1));
  const e = candidates[0]!;
  const kind = e.kind as "skill" | "command";
  return {
    description: e.description,
    messages: [{ role: "user", content: { type: "text", text: e.body } }],
    _meta: { source: e.source, kind },
  };
}
