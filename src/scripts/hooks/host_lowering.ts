/**
 * host_lowering — the reader for `host_lowering.yaml`.
 *
 * The table is the single place a host's block-exit, emission shape, fail
 * policy and bridge bindings are written. Before it, those five facts lived in
 * `host_semantics.ts`, in five private per-host binding constants in
 * `install.ts`, and in prose; three rounds of prose corrections did not stop
 * the drift, because prose has no single reader.
 *
 * LOADING IS STRICT. A missing or malformed table throws rather than
 * degrading to an empty one. An empty table would resolve `VERIFIED_PLATFORMS`
 * to the empty set, which silently downgrades the one host that actually
 * enforces from blocking to advisory — the exact failure this roadmap's risk
 * register ranks first. A throw is loud; a silent downgrade is not. The
 * dispatcher already reads `hook_manifest.yaml` unconditionally from the same
 * tree, so this adds no new class of failure.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _IN_BUNDLE = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
const _REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ...(_IN_BUNDLE ? ['..', '..'] : ['..', '..', '..']),
);

export const HOST_LOWERING_PATH = path.join(_REPO_ROOT, 'src', 'scripts', 'hooks', 'host_lowering.yaml');

/** Provenance of a row. Every field may be null; `expires` may not. */
export interface VerifiedBlock {
    docs_at: string | null;
    docs_url: string | null;
    probe_at: string | null;
    host_version: string | null;
    expires: string;
}

export interface SlotRow {
    /** Host-native event name(s) for this slot, in emission order. */
    native: string[];
    /** Exit code the host honours as a refusal here, or null if unestablished. */
    block_exit: number | null;
    /** Entry-shape-specific extra (gemini's per-binding matcher). */
    matcher?: string;
}

export interface SurfaceRow {
    entry_shape: string;
    json_shape: string;
    fail_policy: string;
    timeout_unit: string;
    timeout_default: number | null;
    verified: VerifiedBlock | null;
    /** Insertion-ordered: bridge entries are written in this order. */
    slots: Map<string, SlotRow>;
}

export type HostLowering = Map<string, Map<string, SurfaceRow>>;

/** The surface every row carries today — see the table header. */
export const DEFAULT_SURFACE = 'any';

function _asString(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    // A bare `2027-09-06` parses as a Date under YAML 1.1 timestamp rules.
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
}

function _parse(text: string): HostLowering {
    const raw = parseYaml(text) as Record<string, unknown> | null;
    const hostsRaw = raw?.['hosts'];
    if (typeof hostsRaw !== 'object' || hostsRaw === null) {
        throw new Error('host_lowering.yaml: missing `hosts:` map');
    }
    const out: HostLowering = new Map();
    for (const [host, hv] of Object.entries(hostsRaw as Record<string, unknown>)) {
        const surfacesRaw = (hv as Record<string, unknown> | null)?.['surfaces'];
        if (typeof surfacesRaw !== 'object' || surfacesRaw === null) {
            throw new Error(`host_lowering.yaml: ${host} has no \`surfaces:\` map`);
        }
        const surfaces = new Map<string, SurfaceRow>();
        for (const [surface, sv] of Object.entries(surfacesRaw as Record<string, unknown>)) {
            const s = sv as Record<string, unknown>;
            const verifiedRaw = s['verified'] as Record<string, unknown> | null | undefined;
            let verified: VerifiedBlock | null = null;
            if (verifiedRaw) {
                const expires = _asString(verifiedRaw['expires']);
                if (!expires) {
                    throw new Error(`host_lowering.yaml: ${host}/${surface} verified block has no \`expires\``);
                }
                verified = {
                    docs_at: _asString(verifiedRaw['docs_at']),
                    docs_url: _asString(verifiedRaw['docs_url']),
                    probe_at: _asString(verifiedRaw['probe_at']),
                    host_version: _asString(verifiedRaw['host_version']),
                    expires,
                };
            }
            const slots = new Map<string, SlotRow>();
            for (const [slot, rvRaw] of Object.entries((s['slots'] ?? {}) as Record<string, unknown>)) {
                const rv = rvRaw as Record<string, unknown>;
                const nativeRaw = rv['native'];
                const native = Array.isArray(nativeRaw) ? nativeRaw.map(String) : [String(nativeRaw)];
                const be = rv['block_exit'];
                const row: SlotRow = {
                    native,
                    block_exit: typeof be === 'number' ? be : null,
                };
                if (typeof rv['matcher'] === 'string') row.matcher = rv['matcher'];
                slots.set(slot, row);
            }
            surfaces.set(surface, {
                entry_shape: String(s['entry_shape'] ?? 'none'),
                json_shape: String(s['json_shape'] ?? 'none'),
                fail_policy: String(s['fail_policy'] ?? 'discard'),
                timeout_unit: String(s['timeout_unit'] ?? 'unknown'),
                timeout_default: typeof s['timeout_default'] === 'number' ? s['timeout_default'] : null,
                verified,
                slots,
            });
        }
        out.set(host, surfaces);
    }
    return out;
}

let _cache: HostLowering | null = null;

/** Parse the table once per process. Throws on a missing or malformed file. */
export function loadHostLowering(): HostLowering {
    if (_cache === null) _cache = _parse(fs.readFileSync(HOST_LOWERING_PATH, 'utf-8'));
    return _cache;
}

/** Test seam — drop the memoized table so a fixture can be loaded instead. */
export function _resetHostLoweringCache(table?: HostLowering): void {
    _cache = table ?? null;
}

/** Parse a fixture table without touching the committed file. */
export function parseHostLowering(text: string): HostLowering {
    return _parse(text);
}

export function surfaceRow(
    host: string,
    surface: string = DEFAULT_SURFACE,
    table: HostLowering = loadHostLowering(),
): SurfaceRow | null {
    return table.get(host)?.get(surface) ?? table.get(host)?.get(DEFAULT_SURFACE) ?? null;
}

/**
 * Is the row's provenance still current?
 *
 * A row past `expires` is treated exactly as `verified: null` — it cannot
 * carry a blocking binding. Comparison is on the calendar date so the answer
 * does not depend on the runner's clock time of day.
 */
export function isVerifiedNow(row: SurfaceRow | null, today: string = new Date().toISOString().slice(0, 10)): boolean {
    if (row?.verified == null) return false;
    return row.verified.expires >= today;
}

/** Hosts carrying an unexpired `verified` block. */
export function verifiedPlatforms(table: HostLowering = loadHostLowering()): ReadonlySet<string> {
    const out = new Set<string>();
    for (const [host, surfaces] of table) {
        for (const row of surfaces.values()) {
            if (isVerifiedNow(row)) {
                out.add(host);
                break;
            }
        }
    }
    return out;
}

/** Exit code this host honours as a refusal on `slot`, or null. */
export function blockExitFor(host: string, slot: string, table: HostLowering = loadHostLowering()): number | null {
    const row = surfaceRow(host, DEFAULT_SURFACE, table);
    if (!isVerifiedNow(row)) return null;
    return row?.slots.get(slot)?.block_exit ?? null;
}

/** One bridge binding: an agent-config slot lowered onto one native event. */
export interface HostBinding {
    slot: string;
    native: string;
    matcher: string;
}

/**
 * Ordered bridge bindings for a host.
 *
 * Order is the table's `slots:` insertion order and is part of the generated
 * output — the emitted bridge JSON is keyed by native event, so re-ordering
 * changes bytes. Never sort this.
 */
export function hostBindings(host: string, table: HostLowering = loadHostLowering()): HostBinding[] {
    const row = surfaceRow(host, DEFAULT_SURFACE, table);
    if (!row) return [];
    const out: HostBinding[] = [];
    for (const [slot, sr] of row.slots) {
        for (const native of sr.native) {
            out.push({ slot, native, matcher: sr.matcher ?? '' });
        }
    }
    return out;
}
