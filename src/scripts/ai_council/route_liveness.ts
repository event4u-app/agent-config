/**
 * Liveness of a `base_url` route, per route and model: streaks, not last
 * outcomes (gateway M9).
 *
 * The outcome names are the closed failure vocabulary of
 * road-to-seats-that-know-why-they-failed — `rate_limited`,
 * `quota_exhausted`, `model_unservable`, `server_error`, `billing` — read here
 * from the route's own HTTP answer by a small local classifier, so the two
 * converge when that roadmap's shared table lands instead of meeting a second
 * vocabulary.
 *
 * Only `model_unservable` speaks about the model: a throttle, an empty quota or
 * a server fault says the route is busy or down for this pass, never that the
 * model is gone, so they never count against liveness and never break a streak.
 * An answered call resets it. Three consecutive unservable answers retire the
 * model from the discovered roster until a later discovery serves it again.
 */

import fs from 'node:fs';
import path from 'node:path';

import { readRouteRoster, retireRouteModel } from './free_route_catalog.js';
import type { CliFailureClass } from './transport_resolver.js';

export const ROUTE_OUTCOMES = [
    'ok',
    'rate_limited',
    'quota_exhausted',
    'model_unservable',
    'server_error',
    'billing',
    'other',
] as const;
export type RouteOutcome = (typeof ROUTE_OUTCOMES)[number];

export const RETIRE_STREAK = 3;

/** Runtime state beside `council-route-models.json`; gitignored, never committed. */
export const ROUTE_LIVENESS_RELPATH = path.join('agents', 'runtime', 'state', 'council-route-liveness.json');

const _QUOTA_TEXT = /insufficient_quota|quota exceeded|exceeded your current quota|usage limit/i;

/** The route's answer as one vocabulary name; `null` / empty means it answered. */
export function classifyRouteOutcome(error: string | null | undefined): RouteOutcome {
    if (error === null || error === undefined || error.trim() === '') return 'ok';
    const s = error.trim();
    if (s.startsWith('policy_unproven_cost')) return 'billing';
    const m = /^HTTP (\d{3})\b:?\s*([\s\S]*)$/.exec(s);
    if (m === null) return 'other';
    const status = Number(m[1]);
    const body = m[2] ?? '';
    if (status === 402) return 'billing';
    if (status === 429) return _QUOTA_TEXT.test(body) ? 'quota_exhausted' : 'rate_limited';
    if (status === 410) return 'model_unservable';
    if (status === 404) return /\bmodel\b/i.test(body) ? 'model_unservable' : 'other';
    // 501 and 505 say the route cannot do this at all; retrying is pointless.
    if (status >= 500 && status <= 599 && status !== 501 && status !== 505) return 'server_error';
    return 'other';
}

/** Absent for this pass only: busy or down, never evidence about the model. */
export function isAbsentForPass(outcome: RouteOutcome): boolean {
    return outcome === 'rate_limited' || outcome === 'quota_exhausted' || outcome === 'server_error';
}

/** The outcome as the class `MidFlightFallback` gates on. */
export function routeFailureClass(outcome: RouteOutcome): CliFailureClass {
    switch (outcome) {
        case 'rate_limited':
        case 'quota_exhausted':
            return 'quota_exhausted';
        case 'model_unservable':
            return 'model_unservable';
        case 'server_error':
            return 'server_error';
        default:
            return 'other';
    }
}

interface LivenessEntry {
    readonly streak: number;
    readonly last: RouteOutcome;
    readonly observed_at: string;
    readonly retired_at?: string;
}

type Store = Record<string, Record<string, LivenessEntry>>;

function _storePath(repoRoot: string): string {
    return path.join(repoRoot, ROUTE_LIVENESS_RELPATH);
}

function _readStore(repoRoot: string): Store {
    try {
        const raw = JSON.parse(fs.readFileSync(_storePath(repoRoot), 'utf8')) as unknown;
        return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Store) : {};
    } catch {
        return {};
    }
}

function _writeStore(repoRoot: string, store: Store): void {
    const target = _storePath(repoRoot);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, target);
}

/** A retirement stands until the roster is re-discovered after it. */
function _retirementStands(repoRoot: string, routeKey: string, entry: LivenessEntry | undefined): boolean {
    if (entry?.retired_at === undefined) return false;
    const roster = readRouteRoster(repoRoot, routeKey);
    return roster.status !== 'known' || roster.observed_at <= entry.retired_at;
}

export function isRouteModelLive(repoRoot: string, routeKey: string, model: string): boolean {
    return !_retirementStands(repoRoot, routeKey, _readStore(repoRoot)[routeKey]?.[model]);
}

export interface RecordedOutcome {
    readonly streak: number;
    readonly retired: boolean;
    readonly absentForPass: boolean;
}

export function recordRouteOutcome(
    repoRoot: string,
    routeKey: string,
    model: string,
    outcome: RouteOutcome,
    now: Date = new Date(),
): RecordedOutcome {
    const store = _readStore(repoRoot);
    const route = store[routeKey] ?? {};
    let prev = route[model];
    if (prev?.retired_at !== undefined && !_retirementStands(repoRoot, routeKey, prev)) prev = undefined;
    const before = prev?.streak ?? 0;
    const streak = outcome === 'ok' ? 0 : outcome === 'model_unservable' ? before + 1 : before;
    const observed_at = now.toISOString();
    let retiredAt = prev?.retired_at;
    if (retiredAt === undefined && streak >= RETIRE_STREAK) {
        retiredAt = observed_at;
        retireRouteModel(repoRoot, routeKey, model);
    }
    route[model] = { streak, last: outcome, observed_at, ...(retiredAt !== undefined ? { retired_at: retiredAt } : {}) };
    store[routeKey] = route;
    _writeStore(repoRoot, store);
    return { streak, retired: retiredAt !== undefined, absentForPass: isAbsentForPass(outcome) };
}

