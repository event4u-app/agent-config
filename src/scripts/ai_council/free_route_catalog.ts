/**
 * What the package ships about `base_url` routes: endpoints and dated data-use
 * attestations, never model ids. Catalogues lose and gain rows within weeks,
 * so a committed id is stale by the time it is read; the ids a route serves
 * are discovered from its own `/models` and kept in gitignored runtime state.
 *
 * An attestation records what someone read in the route's terms on a date. It
 * enforces nothing — every free route stays at the `public-artifact` ceiling
 * whatever it says. It decides one thing: whether a route may be offered to
 * consumers by default. A row without an attestation, or without the
 * EEA/Switzerland/UK client-distribution field, is for the maintainer's own
 * runs only: some free tiers require paid service once a client distributed
 * to users in those regions exists.
 */

import fs from 'node:fs';
import path from 'node:path';

import { isRealDate } from './free_route.js';

export interface RouteAttestation {
    /** `YYYY-MM-DD` the terms were read. */
    readonly checked: string;
    readonly source_url: string;
    readonly trains_on_prompts: boolean;
    /** Whether the terms permit use inside a client distributed to users in the EEA, Switzerland and the UK. */
    readonly client_distribution_eea_ch_uk?: 'permitted' | 'forbidden';
}

export interface CatalogRoute {
    readonly id: string;
    readonly base_url: string;
    readonly keyless: boolean;
    /** `null` until someone reads the terms and dates what they say. */
    readonly attestation: RouteAttestation | null;
}

/**
 * Base URLs only. No row carries an attestation yet: none has been read and
 * dated, so every row is maintainer-only until one is.
 */
export const ROUTE_CATALOG: readonly CatalogRoute[] = [
    { id: 'groq', base_url: 'https://api.groq.com/openai/v1', keyless: false, attestation: null },
    { id: 'cerebras', base_url: 'https://api.cerebras.ai/v1', keyless: false, attestation: null },
    { id: 'openrouter', base_url: 'https://openrouter.ai/api/v1', keyless: false, attestation: null },
    { id: 'huggingface', base_url: 'https://router.huggingface.co/v1', keyless: false, attestation: null },
    { id: 'nvidia', base_url: 'https://integrate.api.nvidia.com/v1', keyless: false, attestation: null },
];

/** Terms drift; an attestation older than this no longer speaks for the route. */
export const ATTESTATION_MAX_AGE_DAYS = 90;

export interface ConsumerDefaultVerdict {
    readonly admissible: boolean;
    readonly reason: string;
}

export function consumerDefaultVerdict(route: CatalogRoute, now: Date = new Date()): ConsumerDefaultVerdict {
    const a = route.attestation;
    if (a === null) return { admissible: false, reason: `${route.id}: unattested — maintainer runs only` };
    if (!isRealDate(a.checked)) return { admissible: false, reason: `${route.id}: attestation is undated — maintainer runs only` };
    const ageDays = (now.getTime() - Date.parse(`${a.checked}T00:00:00Z`)) / 86_400_000;
    if (ageDays > ATTESTATION_MAX_AGE_DAYS) {
        return { admissible: false, reason: `${route.id}: attestation from ${a.checked} is older than ${ATTESTATION_MAX_AGE_DAYS} days` };
    }
    if (a.client_distribution_eea_ch_uk === undefined) {
        return { admissible: false, reason: `${route.id}: attestation records no EEA/CH/UK distribution term — maintainer runs only` };
    }
    if (a.client_distribution_eea_ch_uk === 'forbidden') {
        return { admissible: false, reason: `${route.id}: terms forbid use in a client distributed to EEA/CH/UK users` };
    }
    return { admissible: true, reason: `${route.id}: attested ${a.checked}` };
}

export function consumerDefaultRoutes(now: Date = new Date()): CatalogRoute[] {
    return ROUTE_CATALOG.filter((r) => consumerDefaultVerdict(r, now).admissible);
}

/** Runtime state beside `council-probes.json`; gitignored, never committed. */
export const ROUTE_MODELS_RELPATH = path.join('agents', 'runtime', 'state', 'council-route-models.json');

export type RouteRoster =
    | { readonly status: 'known'; readonly models: readonly string[]; readonly observed_at: string }
    | { readonly status: 'unknown'; readonly reason: string };

interface StoredRoster {
    readonly base_url: string;
    readonly models: readonly string[];
    readonly observed_at: string;
}

function _storePath(repoRoot: string): string {
    return path.join(repoRoot, ROUTE_MODELS_RELPATH);
}

/** Corrupt or missing state reads as "nothing observed". */
function _readStore(repoRoot: string): Record<string, StoredRoster> {
    try {
        const raw = JSON.parse(fs.readFileSync(_storePath(repoRoot), 'utf8')) as unknown;
        return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, StoredRoster>) : {};
    } catch {
        return {};
    }
}

function _writeStore(repoRoot: string, store: Record<string, StoredRoster>): void {
    const target = _storePath(repoRoot);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, target);
}

export function readRouteRoster(repoRoot: string, routeKey: string): RouteRoster {
    const row = _readStore(repoRoot)[routeKey];
    if (row === undefined || !Array.isArray(row.models)) return { status: 'unknown', reason: 'never discovered' };
    return { status: 'known', models: row.models, observed_at: row.observed_at };
}

export interface DiscoverOptions {
    readonly repoRoot: string;
    readonly apiKey?: string | null;
    readonly fetchImpl?: typeof fetch;
    readonly now?: Date;
    readonly timeoutMs?: number;
}

/**
 * One GET of `<base_url>/models`. A failure clears the stored entry, so an
 * offline route reads `unknown` rather than the list it served last time.
 */
export async function discoverRouteModels(routeKey: string, baseUrl: string, opts: DiscoverOptions): Promise<RouteRoster> {
    const store = _readStore(opts.repoRoot);
    let models: string[];
    try {
        const headers: Record<string, string> = { accept: 'application/json' };
        if (opts.apiKey) headers['authorization'] = `Bearer ${opts.apiKey}`;
        const res = await (opts.fetchImpl ?? fetch)(`${baseUrl.replace(/\/+$/, '')}/models`, {
            headers,
            signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { data?: unknown };
        if (!Array.isArray(body.data)) throw new Error('no data array in the /models answer');
        models = body.data
            .map((m) => (m !== null && typeof m === 'object' ? (m as Record<string, unknown>)['id'] : undefined))
            .filter((id): id is string => typeof id === 'string' && id !== '');
    } catch (exc) {
        if (routeKey in store) {
            delete store[routeKey];
            _writeStore(opts.repoRoot, store);
        }
        return { status: 'unknown', reason: exc instanceof Error ? exc.message : String(exc) };
    }
    const observed_at = (opts.now ?? new Date()).toISOString();
    store[routeKey] = { base_url: baseUrl, models, observed_at };
    _writeStore(opts.repoRoot, store);
    return { status: 'known', models, observed_at };
}
