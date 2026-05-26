/**
 * Manifest types — the prebaked-signature contract.
 *
 * Governed by `docs/contracts/mcp-cloud-scope.md` §A0-cloud invariant 5:
 * `skillSetSignature` is computed once by `scripts/pack_mcp_content.py`,
 * stored in `manifest.json`, read here. The Worker NEVER computes a
 * signature at runtime.
 *
 * Schema version 1 — see `road-to-cloudflare-mcp-hosting.md` Phase 3.
 */

export type SchemaVersion = 1;

export type ContentUriCount = {
  skill: number;
  command: number;
  rule: number;
  guideline: number;
  context: number;
};

export type Manifest = {
  schema_version: SchemaVersion;
  /** SHA-256 hex (12 chars) — same algo as local kernel. Wire-surfaced. */
  signature: string;
  /** Full SHA-256 hex of the uncondensed content JSON. Diagnostic. */
  content_hash_sha256: string;
  /** Mirrors `package.json::version` at pack time. Wire-surfaced. */
  package_version: string;
  /** `v<X.Y.Z>-<sha>`. Wire-surfaced (URL path segment). */
  release_key: string;
  /** Full git SHA the pack was taken from. */
  git_sha: string;
  /** ISO-8601 build timestamp (UTC). */
  built_at: string;
  /** `scripts/pack_mcp_content.py` version. RCA aid. */
  packer_version: string;
  /** Per-kind URI count for diagnostics. Not on wire. */
  content_uri_count: ContentUriCount;
  /** Number of tools in the discovery catalog. Diagnostic. */
  tool_count: number;
};

/**
 * Narrow runtime validator — refuses to boot the Worker on a malformed
 * manifest. Lives separately from TS types so a runtime mismatch
 * (e.g. schema_version drift) surfaces at cold start, not at first
 * request.
 */
export function assertManifest(value: unknown): asserts value is Manifest {
  if (typeof value !== "object" || value === null) {
    throw new Error("manifest: not an object");
  }
  const m = value as Partial<Manifest>;
  if (m.schema_version !== 1) {
    throw new Error(
      `manifest: unsupported schema_version=${String(m.schema_version)}; expected 1`,
    );
  }
  for (const key of [
    "signature",
    "content_hash_sha256",
    "package_version",
    "release_key",
    "git_sha",
    "built_at",
    "packer_version",
  ] as const) {
    if (typeof m[key] !== "string" || !m[key]) {
      throw new Error(`manifest: missing or non-string field '${key}'`);
    }
  }
  if (typeof m.content_uri_count !== "object" || m.content_uri_count === null) {
    throw new Error("manifest: content_uri_count must be an object");
  }
  if (typeof m.tool_count !== "number" || !Number.isFinite(m.tool_count) || m.tool_count < 0) {
    throw new Error("manifest: tool_count must be a non-negative number");
  }
}
