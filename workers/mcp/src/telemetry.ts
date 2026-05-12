/**
 * Worker-side telemetry — mirrors `scripts/mcp_server/telemetry.py`.
 *
 * Per `agents/roadmaps/road-to-mcp-full-coverage.md` §Phase 1 J4 +
 * `docs/contracts/mcp-tool-stub-envelope.md`, every `tools/call` emits a
 * single structured record:
 *
 *   { tool_name, client_id_hash, ts, transport, outcome }
 *
 * Outcomes mirror the stdio sink:
 *   - `implemented` — real handler ran (Worker has none in Phase 1).
 *   - `stub`        — catalog entry missing this transport.
 *   - `latent_demand` — caller asked for a name not in the catalog.
 *
 * Privacy: client identifier is hashed at the server boundary using
 * `CF-Connecting-IP` (or `X-Forwarded-For` fallback) + `User-Agent`,
 * truncated to 12 hex chars. Payload bodies are never logged.
 *
 * Transport: Cloudflare's runtime captures `console.log` lines into
 * Workers Logs — that is the queryable store Phase 2 reads from. No
 * external HTTP egress; no R2 write on the hot path.
 */

export const WORKER_TRANSPORT = "worker" as const;
export type Outcome = "implemented" | "stub" | "latent_demand";

const HASH_LEN = 12;

export type TelemetryRecord = {
  tool_name: string;
  client_id_hash: string;
  ts: string;
  transport: typeof WORKER_TRANSPORT;
  outcome: Outcome;
};

export type TelemetrySink = (record: TelemetryRecord) => void;

/** Default sink: one JSON line per call, picked up by Workers Logs. */
export const consoleSink: TelemetrySink = (record) => {
  // Stable single-line JSON so Logpush / Workers Logs queries can
  // jq-extract fields without ad-hoc parsing.
  console.log(JSON.stringify(record));
};

/** Identity seed for the hash. Public for tests. */
export function clientIdSeed(request: Request): string {
  const headers = request.headers;
  const ip =
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const ua = headers.get("user-agent") ?? "unknown";
  return `${ip}|${ua}`;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Boundary call — async (Web Crypto). Truncated to 12 hex chars. */
export async function hashClientId(request: Request): Promise<string> {
  const seed = clientIdSeed(request);
  const full = await sha256Hex(seed);
  return full.slice(0, HASH_LEN);
}

export function buildRecord(args: {
  toolName: string;
  outcome: Outcome;
  clientIdHash: string;
  ts?: string;
}): TelemetryRecord {
  return {
    tool_name: args.toolName,
    client_id_hash: args.clientIdHash,
    ts: args.ts ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    transport: WORKER_TRANSPORT,
    outcome: args.outcome,
  };
}

/** Best-effort emit. Swallows sink errors so the wire surface never breaks. */
export function emit(
  sink: TelemetrySink,
  record: TelemetryRecord,
): void {
  try {
    sink(record);
  } catch {
    // Intentionally silent — a broken logger must not surface as a
    // client error. The J6 healthcheck detects silent windows.
  }
}
