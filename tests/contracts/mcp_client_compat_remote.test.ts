/**
 * Client-compatibility falsification spike — Leg B (Phase 3 of
 * road-to-credible-install § MCP hygiene).
 *
 * Question: do mainstream remote MCP clients connect to the deployed
 * Cloud Worker in its CURRENT raw-POST form at all? The Worker serves
 * JSON-RPC over a plain POST (see internal/workers/mcp/README.md) — it does
 * NOT implement the full Streamable HTTP transport (session negotiation,
 * `Mcp-Session-Id`, SSE-framed responses on POST). A real client library
 * that speaks the full spec may refuse to connect even though a bare
 * `fetch(url, {method:'POST', body: <json-rpc>})` gets a valid reply.
 *
 * This leg is network-gated: it never runs on a normal `npx vitest run`
 * pass. It only executes when BOTH are set:
 *   - `AC_CLIENT_COMPAT_NET=1`   — explicit opt-in to make a real network call.
 *   - `MCP_WORKER_URL`           — the deployed Worker's URL (same env-var
 *     name `internal/workers/mcp/test/dev-smoke.ts` already uses). This
 *     package does not own the Cloudflare account subdomain
 *     (`CLOUDFLARE_WORKER_SUBDOMAIN` is a CI-only secret,
 *     `.github/workflows/deploy-mcp-worker.yml`), so there is no safe
 *     default URL to fall back to.
 * Missing either → skips cleanly with a logged reason (never a failure).
 *
 * Per the F2 rule (docs/mcp-client-compat.md): the test NEVER fails the
 * suite on a legitimate Streamable-HTTP rejection — that outcome is the
 * documented status quo. Only a genuine connection failure (network
 * unreachable, non-2xx on the bare-POST initialize itself) reopens the F2
 * (Streamable HTTP) deferral, and only a human reviewing the recorded
 * result decides that — this test records, it does not adjudicate.
 *
 * Re-run: `AC_CLIENT_COMPAT_NET=1 MCP_WORKER_URL=https://agent-config-mcp.<subdomain>.workers.dev \
 *   npx vitest run tests/contracts/mcp_client_compat_remote.test.ts`
 */
import { describe, it } from 'vitest';

const NET_ENABLED = process.env.AC_CLIENT_COMPAT_NET === '1';
const WORKER_URL = process.env.MCP_WORKER_URL;

type Outcome =
    | { kind: 'skipped'; reason: string }
    | { kind: 'unreachable'; reason: string }
    | { kind: 'reachable'; status: number; contentType: string | null; parsedJsonRpc: boolean };

/**
 * Perform the raw-POST initialize probe, mimicking a real Streamable-HTTP
 * client's request shape (both `content-type` and the spec-mandated
 * `Accept: application/json, text/event-stream`).
 */
async function probeWorker(url: string): Promise<Outcome> {
    const body = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'client-compat-probe-leg-b', version: '0' },
        },
    });
    let res: Response;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                accept: 'application/json, text/event-stream',
            },
            body,
            signal: AbortSignal.timeout(15_000),
        });
    } catch (err) {
        return { kind: 'unreachable', reason: (err as Error).message };
    }
    const contentType = res.headers.get('content-type');
    let parsedJsonRpc = false;
    try {
        const text = await res.text();
        const parsed = JSON.parse(text) as Record<string, unknown>;
        parsedJsonRpc = parsed.jsonrpc === '2.0' && ('result' in parsed || 'error' in parsed);
    } catch {
        parsedJsonRpc = false;
    }
    return { kind: 'reachable', status: res.status, contentType, parsedJsonRpc };
}

describe('mcp client-compat — leg B: remote raw-POST Worker reachability', () => {
    if (!NET_ENABLED) {
        it.skip('network-gated — set AC_CLIENT_COMPAT_NET=1 (and MCP_WORKER_URL) to run', () => {
            // intentionally empty — vitest requires a body even on a skipped test
        });
        return;
    }

    if (WORKER_URL === undefined || WORKER_URL === '') {
        it('skips — MCP_WORKER_URL not set', () => {
            console.log(
                '[mcp-client-compat leg B] skipped: AC_CLIENT_COMPAT_NET=1 but MCP_WORKER_URL is ' +
                    'unset. The deployed Worker URL depends on the CI-only ' +
                    'CLOUDFLARE_WORKER_SUBDOMAIN secret — set MCP_WORKER_URL explicitly to run ' +
                    'this leg against a real deployment. See docs/mcp-client-compat.md.',
            );
        });
        return;
    }

    it('records the observed reachability of the deployed Worker (never fails on a legitimate rejection)', async () => {
        const outcome = await probeWorker(WORKER_URL);
        console.log(`[mcp-client-compat leg B] observed: ${JSON.stringify(outcome)}`);
        // Deliberately no pass/fail assertion on `outcome.kind` — see the file
        // header. A human transcribes the printed result into
        // docs/mcp-client-compat.md; only THAT step decides whether F2
        // reopens.
    });
});
