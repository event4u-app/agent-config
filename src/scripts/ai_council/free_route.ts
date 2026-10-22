/**
 * A council member reached over an OpenAI-compatible `base_url` — a route the
 * package does not pay for by default.
 *
 * Kept out of `config.ts` and `clients.ts`, which both sit far past the source
 * ceiling. Imports no client code: `config.ts` loads this and is itself in the
 * hook bundle. The client is `free_route_client.ts`.
 *
 * The rules, each failing toward the metered or restricted side:
 *
 * - billing is `free-quota` only with a dated proof (keyless endpoint or a
 *   documented free tier); without one the route is `per-token` and stays
 *   inside the USD gate;
 * - an HTTP 402 is `policy_unproven_cost` — the route asked for money, so its
 *   free claim is void for the pass, and no other route is tried in its place;
 * - every route sits at the `public-artifact` ceiling; only a loopback route
 *   whose per-model probe shows local weights and no outbound connection may
 *   carry its declared ceiling (`self-hosted`). Loopback alone proves nothing:
 *   a local proxy forwards upstream;
 * - identity is derived from the served id, and a route serving another model
 *   than the one requested is absent with `policy_model_mismatch`;
 * - random or auto routers are refused at config time: their family is unknown
 *   until after the call.
 */

import { admitsContent, classifyContentClass, DEFAULT_CONTENT_CLASS, type ContentClass } from './content_ceiling.js';
import type { BillingClass } from '../_lib/environment_detector.js';
import type { ResolvedTransport } from './transport_resolver.js';

export type RouteBilling = Extract<BillingClass, 'free-quota' | 'per-token' | 'self-hosted'>;

export const BILLING_PROOF_KINDS = ['keyless', 'free-tier'] as const;
export type BillingProofKind = (typeof BILLING_PROOF_KINDS)[number];

export interface BillingProof {
    readonly kind: BillingProofKind;
    readonly url: string;
    /** `YYYY-MM-DD` — the day someone read the documented free terms. */
    readonly checked: string;
}

export interface RouteSpec {
    readonly base_url: string;
    readonly keyless: boolean;
    readonly proof: BillingProof | null;
    readonly loopback: boolean;
    /** The configured ceiling; effective only for a probed self-hosted route. */
    readonly declared_ceiling: ContentClass;
}

/** What a self-hosted probe observed for one model. */
export interface SelfHostedProbeResult {
    readonly weights: 'local' | 'remote' | 'unknown';
    /** True when an outbound connection was seen during the probe call; null when unmeasured. */
    readonly outbound: boolean | null;
}

export type SelfHostedProbe = (route: RouteSpec, model: string) => SelfHostedProbeResult;

/** Nothing measured, nothing proven: the default, so production never raises a ceiling by omission. */
export const UNPROVEN_PROBE: SelfHostedProbe = () => ({ weights: 'unknown', outbound: null });

const _ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isRealDate(s: unknown): s is string {
    if (typeof s !== 'string' || !_ISO_DATE.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    const probe = new Date(Date.UTC(y, m - 1, d));
    return probe.getUTCFullYear() === y && probe.getUTCMonth() + 1 === m && probe.getUTCDate() === d;
}

/** `localhost`, `127.0.0.0/8` and `::1`. A name that merely resolves locally does not count. */
export function isLoopbackUrl(raw: string): boolean {
    let host: string;
    try {
        host = new URL(raw).hostname.toLowerCase();
    } catch {
        return false;
    }
    if (host === 'localhost' || host === '[::1]' || host === '::1') return true;
    return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

/** A model id that asks the route to pick for us (K2). */
export function isRandomRouter(model: string): boolean {
    return /^(?:.*\/)?(?:auto|random|free|router)(?::.*)?$/i.test(model.trim());
}

function _parseProof(name: string, raw: unknown, keyless: boolean): BillingProof | { error: string } | null {
    if (raw === undefined || raw === null) return null;
    const where = `members.${name}.billing_proof`;
    if (typeof raw !== 'object' || Array.isArray(raw)) return { error: `${where} must be a mapping with kind, url and checked.` };
    const p = raw as Record<string, unknown>;
    if (!BILLING_PROOF_KINDS.includes(p['kind'] as BillingProofKind)) {
        return { error: `${where}.kind must be one of ${BILLING_PROOF_KINDS.join(', ')}.` };
    }
    if (typeof p['url'] !== 'string' || !/^https:\/\/\S+$/.test(p['url'])) {
        return { error: `${where}.url must be the https URL documenting the free terms.` };
    }
    // An unquoted YAML date is a Date object and may have rolled an impossible value over.
    if (!isRealDate(p['checked'])) {
        return { error: `${where}.checked must be a quoted 'YYYY-MM-DD' date — an undated proof proves nothing.` };
    }
    if (p['kind'] === 'keyless' && !keyless) {
        return { error: `${where}.kind is 'keyless' but the member carries an api_key_ref.` };
    }
    return { kind: p['kind'] as BillingProofKind, url: p['url'], checked: p['checked'] };
}

/**
 * The route half of a member's config. `{ route: null }` for a member without
 * `base_url`; an error message (the loader raises it) for a malformed one.
 */
export function parseRouteFields(
    name: string,
    raw: Record<string, unknown>,
    knownProvider: boolean,
): { route: RouteSpec | null } | { error: string } {
    const base = raw['base_url'];
    if (base === undefined || base === null) {
        return raw['billing_proof'] === undefined ? { route: null } : { error: `members.${name}.billing_proof needs base_url.` };
    }
    if (knownProvider) {
        return { error: `members.${name}: base_url names a route, so the member needs its own name, not a provider's.` };
    }
    let url: URL;
    try {
        url = new URL(String(base));
    } catch {
        return { error: `members.${name}.base_url is not a URL (got ${JSON.stringify(base)}).` };
    }
    const loopback = isLoopbackUrl(url.href);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
        return { error: `members.${name}.base_url must use https unless it is a loopback address.` };
    }
    const model = raw['model'];
    if (typeof model === 'string' && isRandomRouter(model)) {
        return { error: `members.${name}.model ${JSON.stringify(model)} is a random/auto router; its identity is unknown before the call.` };
    }
    const ref = raw['api_key_ref'];
    const keyless = ref === undefined || ref === null || ref === '';
    const proof = _parseProof(name, raw['billing_proof'], keyless);
    if (proof !== null && 'error' in proof) return proof;
    return {
        route: {
            base_url: String(base).replace(/\/+$/, ''),
            keyless,
            proof,
            loopback,
            declared_ceiling: classifyContentClass(raw['content_ceiling']),
        },
    };
}

function _provenLocal(route: RouteSpec, probe: SelfHostedProbeResult): boolean {
    return route.loopback && probe.weights === 'local' && probe.outbound === false;
}

export function routeBilling(route: RouteSpec, probe: SelfHostedProbeResult = UNPROVEN_PROBE(route, '')): RouteBilling {
    if (_provenLocal(route, probe)) return 'self-hosted';
    return route.proof === null ? 'per-token' : 'free-quota';
}

/** `public-artifact` for every route, except a proven self-hosted one. */
export function routeCeiling(route: RouteSpec, probe: SelfHostedProbeResult = UNPROVEN_PROBE(route, '')): ContentClass {
    return _provenLocal(route, probe) ? route.declared_ceiling : 'public-artifact';
}

export interface ResolveRouteOptions {
    readonly name: string;
    readonly route: RouteSpec;
    readonly model: string;
    readonly contentClass?: ContentClass | null;
    /** Whether the member's `api_key_ref` resolves; ignored for a keyless route. */
    readonly keyPresent?: boolean;
    readonly probe?: SelfHostedProbe;
}

export function resolveRouteTransport(opts: ResolveRouteOptions): ResolvedTransport {
    const result = (opts.probe ?? UNPROVEN_PROBE)(opts.route, opts.model);
    const billing = routeBilling(opts.route, result);
    const absent = (reason: string, absentReason: ResolvedTransport['absentReason']): ResolvedTransport => ({
        available: false, transport: null, billing, authSource: null, makesProviderCall: false, reason, absentReason,
    });
    const verdict = admitsContent(routeCeiling(opts.route, result), opts.contentClass ?? DEFAULT_CONTENT_CLASS);
    if (!verdict.admitted) {
        return absent(`${opts.name}: ${verdict.reason ?? 'content ceiling refused the payload'}`, 'policy_content_ceiling');
    }
    if (!opts.route.keyless && opts.keyPresent !== true) {
        return absent(`${opts.name}: the route's api_key_ref does not resolve`, 'no_auth');
    }
    return {
        available: true,
        transport: 'api',
        billing,
        authSource: opts.route.keyless ? null : 'env-key',
        makesProviderCall: true,
        reason: null,
        absentReason: null,
    };
}

/** The family a served id belongs to: the leading word of its last path segment. */
export function familyOf(servedId: string): string {
    const last = servedId.trim().split('/').pop() ?? '';
    return (last.split(/[^a-zA-Z]+/).find((t) => t !== '') ?? '').toLowerCase();
}

/** Same model, allowing only a vendor prefix and a dated or variant suffix of the requested id. */
export function servedMatches(requested: string, served: string): boolean {
    const norm = (s: string): string => (s.trim().split('/').pop() ?? '').toLowerCase();
    const r = norm(requested);
    const s = norm(served);
    if (r === '' || s === '') return false;
    return s === r || (s.startsWith(`${r}-`) && familyOf(s) === familyOf(r));
}
