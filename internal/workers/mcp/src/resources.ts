/**
 * Resources surface — `resources/list` + `resources/read`.
 *
 * Mirrors `scripts/mcp_server/resources.py` wire shape. Three URI
 * schemes: `rule://`, `guideline://`, `context://`. All served as
 * `text/markdown`.
 */

import type { ContentBlob } from "./content.js";
import { entriesOfKind } from "./content.js";

const PAGE_SIZE = 50;
const MIME_MARKDOWN = "text/markdown";

export type McpResourceMeta = {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  _meta: {
    source: string;
    kind: "rule" | "guideline" | "context";
  };
};

export type McpResourceListResponse = {
  resources: McpResourceMeta[];
  nextCursor?: string;
};

export type McpResourceReadResponse = {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
  _meta: {
    source: string;
    kind: "rule" | "guideline" | "context";
  };
};

export function listResources(
  blob: ContentBlob,
  cursor: string | undefined,
): McpResourceListResponse {
  const all = entriesOfKind(blob, ["rule", "guideline", "context"])
    .slice()
    .sort((a, b) => (a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0));
  const startIdx = cursor ? all.findIndex((e) => e.uri === cursor) + 1 : 0;
  const page = all.slice(startIdx, startIdx + PAGE_SIZE);
  const next = startIdx + PAGE_SIZE < all.length ? page[page.length - 1]?.uri : undefined;
  return {
    resources: page.map((e) => {
      const kind = e.kind as "rule" | "guideline" | "context";
      return {
        uri: e.uri,
        name: e.name,
        description: e.description,
        mimeType: e.mime_type ?? MIME_MARKDOWN,
        _meta: { source: e.source, kind },
      };
    }),
    ...(next ? { nextCursor: next } : {}),
  };
}

export function readResource(
  blob: ContentBlob,
  uri: string,
): McpResourceReadResponse | null {
  const e = blob.uris[uri];
  if (!e || (e.kind !== "rule" && e.kind !== "guideline" && e.kind !== "context")) {
    return null;
  }
  const kind = e.kind;
  return {
    contents: [
      {
        uri: e.uri,
        mimeType: e.mime_type ?? MIME_MARKDOWN,
        text: e.body,
      },
    ],
    _meta: { source: e.source, kind },
  };
}
