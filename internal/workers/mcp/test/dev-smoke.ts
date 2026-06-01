/**
 * Dev smoke harness — issues a small set of JSON-RPC calls against a
 * locally-running `wrangler dev` Worker and prints pass/fail.
 *
 * Usage:
 *   pnpm dev           # in one shell — starts wrangler on :8787
 *   pnpm smoke:dev     # in another shell — runs this script
 *
 * The full live-replay baseline lives in `scripts/mcp_server/` and is
 * driven by Python. This script exists only for fast local feedback;
 * the canonical contract test is the Python harness with --target.
 */

const BASE_URL = process.env.MCP_WORKER_URL ?? "http://127.0.0.1:8787";
// Optional bearer token — when the deployed Worker has the `MCP-Token`
// secret set, every POST must carry `Authorization: Bearer <token>`.
// Provided to CI via the `MCP_SMOKE_TOKEN` repo secret; unset locally → no auth.
const AUTH_TOKEN = process.env.MCP_SMOKE_TOKEN;

type Probe = { name: string; method: string; params?: unknown };

const PROBES: readonly Probe[] = [
  { name: "initialize", method: "initialize" },
  { name: "ping", method: "ping" },
  { name: "prompts/list", method: "prompts/list" },
  { name: "resources/list", method: "resources/list" },
  { name: "tools/list", method: "tools/list" },
];

type JsonRpcResp = {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
};

async function rpc(probe: Probe, id: number): Promise<JsonRpcResp> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(AUTH_TOKEN ? { authorization: `Bearer ${AUTH_TOKEN}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: probe.method,
      params: probe.params ?? {},
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${probe.method}`);
  return (await res.json()) as JsonRpcResp;
}

async function main(): Promise<void> {
  let failed = 0;
  for (let i = 0; i < PROBES.length; i++) {
    const probe = PROBES[i]!;
    try {
      const r = await rpc(probe, i + 1);
      if (r.error) {
        console.error(`❌  ${probe.name}: ${r.error.code} ${r.error.message}`);
        failed++;
      } else {
        console.log(`✅  ${probe.name}`);
      }
    } catch (e) {
      console.error(`❌  ${probe.name}: ${(e as Error).message}`);
      failed++;
    }
  }
  if (failed > 0) {
    console.error(`\n${failed}/${PROBES.length} probes failed`);
    process.exit(1);
  }
  console.log(`\n${PROBES.length}/${PROBES.length} probes passed`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
