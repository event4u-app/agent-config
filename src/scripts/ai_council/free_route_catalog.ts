// egress-content: fixed-corpus — a GET of the route's /models listing with no request body, never session content
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
    /** What the terms say about keeping prompts and outputs, in their words' substance. */
    readonly retention?: string;
    /**
     * Whether the terms permit use inside a client distributed to users in the
     * EEA, Switzerland and the UK. `unknown` records that the terms were read
     * and say neither, which keeps the route maintainer-only like an absent field.
     */
    readonly client_distribution_eea_ch_uk?: 'permitted' | 'forbidden' | 'unknown';
}

export interface CatalogRoute {
    readonly id: string;
    readonly base_url: string;
    readonly keyless: boolean;
    /** `null` until someone reads the terms and dates what they say. */
    readonly attestation: RouteAttestation | null;
    /**
     * The route's own model list marking each entry `community: true|false`.
     * When set, discovery admits only first-party ids and fails closed when the
     * list cannot be read, because the attestation speaks for first-party
     * models only.
     */
    readonly first_party_list?: string;
}

/**
 * Base URLs only. One row carries an attestation (council 2026-10-22,
 * decision 2): its terms were read from the provider's published policy, and
 * they settle neither way whether a distributed client may serve EEA, CH or UK
 * users, so it stays maintainer-only.
 */
export const ROUTE_CATALOG: readonly CatalogRoute[] = [
    {
        id: 'pollinations',
        base_url: 'https://text.pollinations.ai/openai',
        keyless: true,
        first_party_list: 'https://text.pollinations.ai/models',
        attestation: {
            checked: '2026-10-22',
            source_url: 'https://pollinations.ai/privacy',
            trains_on_prompts: false,
            retention:
                'prompts and outputs processed transiently, with short-lived response caches; the selected model\'s inference host sets its own retention',
            client_distribution_eea_ch_uk: 'unknown',
        },
    },
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
    if (a.client_distribution_eea_ch_uk === undefined || a.client_distribution_eea_ch_uk === 'unknown') {
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

/**
 * Drop one model from a route's discovered roster; the next discovery that
 * serves it brings it back. False when the roster does not list it.
 */
export function retireRouteModel(repoRoot: string, routeKey: string, model: string): boolean {
    const store = _readStore(repoRoot);
    const row = store[routeKey];
    if (row === undefined || !Array.isArray(row.models) || !row.models.includes(model)) return false;
    store[routeKey] = { ...row, models: row.models.filter((m) => m !== model) };
    _writeStore(repoRoot, store);
    return true;
}

export interface DiscoverOptions {
    readonly repoRoot: string;
    readonly apiKey?: string | null;
    readonly fetchImpl?: typeof fetch;
    readonly now?: Date;
    readonly timeoutMs?: number;
    /** A route's `first_party_list`; when set, only ids it marks `community: false` are kept. */
    readonly firstPartyListUrl?: string;
}

async function firstPartyIds(url: string, opts: DiscoverOptions): Promise<Set<string>> {
    const res = await (opts.fetchImpl ?? fetch)(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    });
    if (!res.ok) throw new Error(`first-party list HTTP ${res.status}`);
    const body = (await res.json()) as unknown;
    if (!Array.isArray(body)) throw new Error('first-party list is not a list');
    const ids = new Set<string>();
    for (const m of body) {
        if (m === null || typeof m !== 'object') continue;
        const e = m as Record<string, unknown>;
        if (e['community'] !== false) continue;
        if (typeof e['name'] === 'string') ids.add(e['name']);
        if (Array.isArray(e['aliases'])) for (const a of e['aliases']) if (typeof a === 'string') ids.add(a);
    }
    return ids;
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
        if (opts.firstPartyListUrl) {
            const fp = await firstPartyIds(opts.firstPartyListUrl, opts);
            models = models.filter((id) => fp.has(id));
        }
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
