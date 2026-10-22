/**
 * Global test setup — close the network, for this process and for the children
 * it spawns. Step 5.2 of `road-to-unknowns-that-say-so`, decision D5.
 *
 * WHY, measured rather than assumed (F8 of that roadmap). Before this file the
 * suite's only setup files neutralised the locale and pinned the config home
 * (`vitest.config.ts`, `tests/_lib/`), and nothing stopped a test reaching a
 * real host. That matters here more than in most suites because the metered
 * council transport is a `curl` SUBPROCESS (`src/scripts/ai_council/
 * api_transport.ts`), so a patch of the in-process HTTP stack would not have
 * covered the one path that can actually spend money.
 *
 * TWO MECHANISMS, because one does not reach both halves:
 *
 *   1. PROXY VARIABLES, inherited by every child. `HTTP_PROXY`, `HTTPS_PROXY`
 *      and `ALL_PROXY` point at a closed loopback port, in both cases, because
 *      curl reads the lower-case `http_proxy` and ignores the upper-case one
 *      (a deliberate CGI-confusion defence) while other tools read only the
 *      upper-case spelling. `NO_PROXY` exempts loopback so the suite's own
 *      local servers keep working.
 *   2. AN IN-PROCESS `fetch` WRAPPER. `globalThis.fetch` refuses any origin
 *      that is not loopback, before a socket is opened — including the target
 *      of every redirect, which it follows itself one hop at a time.
 *
 * `undici`'s `setGlobalDispatcher` would be the more thorough version of (2),
 * and it is deliberately NOT used: `undici` is not a dependency of this
 * package, and adding one to close a test-side hole is a dependency decision
 * rather than a guard. Wrapping the global is weaker in one specific way —
 * code that reaches for `node:http` / `node:https` directly is not covered —
 * and that is named below rather than papered over.
 *
 * THE GAP, stated because the alternative is a claim of isolation this file
 * cannot keep: a child process that does not honour proxy variables reaches
 * the network exactly as before. `node:http` used directly, a Go or Rust
 * binary, and anything using a hard-coded proxy-less client all escape. This
 * is defence in depth, not a sandbox. The honest boundary is: the two paths
 * this suite actually uses — in-process `fetch` and a spawned `curl` — are
 * closed, and a third path is a finding when somebody adds one.
 *
 * THE OPT-IN. `AGENT_CONFIG_ALLOW_NETWORK=1` lifts both mechanisms. A live-test
 * flag on its own does NOT: a run that sets one without the opt-in throws here,
 * rather than silently executing a live test behind a guard somebody assumed
 * was open. That is step 5.3's case, and it is in this file so the throw cannot
 * be lost when a test file is deleted.
 */

/** Loopback hosts the guard lets through. The suite's own servers bind here. */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/**
 * A port nothing listens on. 1 is privileged and unbound on every platform the
 * suite runs on, so a proxied connection is refused immediately rather than
 * hanging — a guard that costs a timeout per call would be removed within a
 * week.
 */
export const CLOSED_PROXY = 'http://127.0.0.1:1';

/** The variable that opens the network, for a live test that has asked for it. */
export const ALLOW_NETWORK_VAR = 'AGENT_CONFIG_ALLOW_NETWORK';

/**
 * Variables that mean "this run includes a live test". Matched by prefix so a
 * new one does not have to be added here to be covered; `LIVE` is the bare
 * spelling `check_test_delta`'s own fixture uses.
 */
export const LIVE_TEST_VARS = ['LIVE', 'AGENT_CONFIG_LIVE'] as const;

export function networkIsOpen(env: NodeJS.ProcessEnv = process.env): boolean {
    const value = env[ALLOW_NETWORK_VAR];
    return value === '1' || value === 'true';
}

/** The live-test variables that are set in this environment, in order. */
export function liveTestFlagsSet(env: NodeJS.ProcessEnv = process.env): string[] {
    return Object.keys(env)
        .filter((name) => LIVE_TEST_VARS.some((prefix) => name === prefix || name.startsWith(`${prefix}_`)))
        .filter((name) => {
            const value = env[name];
            return value !== undefined && value !== '' && value !== '0' && value !== 'false';
        })
        .sort();
}

/** True when `url` names a loopback origin, which the guard always allows. */
export function isLoopback(url: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        // A relative URL has no origin to leave the machine through.
        return true;
    }
    if (parsed.protocol === 'file:' || parsed.protocol === 'data:' || parsed.protocol === 'blob:') return true;
    return LOOPBACK.has(parsed.hostname);
}

export class NetworkRefused extends Error {
    constructor(target: string) {
        super(
            `network refused by tests/_lib/network-guard.ts: ${target} is not loopback. ` +
                `A test that needs a real host sets ${ALLOW_NETWORK_VAR}=1 and says in its own ` +
                `comment why the cost and the flakiness are worth it.`,
        );
        this.name = 'NetworkRefused';
    }
}

/** Point the proxy variables at a closed port, in both spellings. */
function closeProxies(env: NodeJS.ProcessEnv): void {
    for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY']) {
        env[name] = CLOSED_PROXY;
        env[name.toLowerCase()] = CLOSED_PROXY;
    }
    env.NO_PROXY = 'localhost,127.0.0.1,::1';
    env.no_proxy = env.NO_PROXY;
}

/** Statuses `fetch` follows on its own under the default `redirect: 'follow'`. */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 20;

/** Replace `globalThis.fetch` with one that refuses a non-loopback origin. */
function closeFetch(): void {
    const real = globalThis.fetch;
    if (typeof real !== 'function') return;
    // `async`, so a refusal is a REJECTION, never a throw. The real `fetch`
    // returns a promise on every path, so a synchronous throw escapes
    // `fetch(...).catch(...)` and lands somewhere the caller has no handler —
    // measured here as three suites timing out rather than failing. A guard
    // that changes the SHAPE of the API it guards is a second defect wearing
    // the first one's clothes.
    const guarded: typeof fetch = async (input, init) => {
        const request = input instanceof Request ? input : null;
        let target = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
        if (!isLoopback(target)) throw new NetworkRefused(target);
        if ((init?.redirect ?? request?.redirect ?? 'follow') !== 'follow') return real(input, init);
        // A loopback server may answer 3xx to a public host, and the real
        // `fetch` would follow it. So redirects are followed here, one hop at a
        // time, and every hop's target is checked before it is requested.
        let hopInit: RequestInit = request ? { method: request.method, headers: request.headers, ...init } : { ...init };
        let res = await real(input, { ...init, redirect: 'manual' });
        for (let hop = 0; REDIRECT_STATUSES.has(res.status); hop += 1) {
            const location = res.headers.get('location');
            if (location === null) return res;
            if (hop >= MAX_REDIRECTS) throw new TypeError('fetch failed: redirect count exceeded');
            target = new URL(location, target).href;
            if (!isLoopback(target)) throw new NetworkRefused(target);
            await res.body?.cancel();
            const method = (hopInit.method ?? 'GET').toUpperCase();
            if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === 'POST')) {
                hopInit = { ...hopInit, method: 'GET' };
                delete hopInit.body;
            }
            res = await real(target, { ...hopInit, redirect: 'manual' });
        }
        return res;
    };
    globalThis.fetch = guarded;
}

/**
 * Refuse a run that asks for a live test without asking for the network. The
 * check is a function rather than an inline block so step 5.3's case can
 * exercise it against a constructed environment instead of poisoning the
 * worker's own — a case that could only be written by setting a real variable
 * would have to be skipped, and a skipped case is what this phase exists to
 * stop.
 */
export function assertLiveFlagsHaveOptIn(env: NodeJS.ProcessEnv = process.env): void {
    if (networkIsOpen(env)) return;
    const live = liveTestFlagsSet(env);
    if (live.length === 0) return;
    throw new Error(
        `a live test ran without the network opt-in: ${live.join(', ')} is set and ` +
            `${ALLOW_NETWORK_VAR} is not. Set ${ALLOW_NETWORK_VAR}=1 for a run that is ` +
            `allowed to reach a real host, or unset the live flag.`,
    );
}

assertLiveFlagsHaveOptIn();
if (!networkIsOpen()) {
    closeProxies(process.env);
    closeFetch();
}
