/**
 * How much of the project each route has seen, so no single provider collects
 * enough fragments to rebuild it.
 *
 * Counts distinct project files and symbols per route in gitignored runtime
 * state. Entries are digests, so the ledger holds no path or name in clear. The
 * chooser prefers the least-exposed admissible route and refuses one this call
 * would push past the share cap. This raises reconstruction cost; it never
 * replaces the content ceiling, which is what keeps project content off a
 * public-artifact route.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** The share of tracked files one route may have seen; a constant, not a setting. */
export const EXPOSURE_SHARE_CAP = 0.2;

export const EXPOSURE_LEDGER_RELPATH = path.join('agents', 'runtime', 'state', 'hand-exposure.json');

export interface Exposure {
    readonly files: readonly string[];
    readonly symbols: readonly string[];
}

interface RouteSeen {
    files: string[];
    symbols: string[];
}

function digest(kind: string, value: string): string {
    return createHash('sha256').update(`${kind}\u0000${value}`).digest('hex').slice(0, 16);
}

export class ExposureLedger {
    private readonly routes = new Map<string, { files: Set<string>; symbols: Set<string> }>();

    /** `file` null keeps the ledger in memory only. */
    constructor(private readonly file: string | null) {}

    static load(file: string): ExposureLedger {
        const ledger = new ExposureLedger(file);
        try {
            const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as { routes?: Record<string, RouteSeen> };
            for (const [name, seen] of Object.entries(raw.routes ?? {})) {
                ledger.routes.set(name, { files: new Set(seen.files ?? []), symbols: new Set(seen.symbols ?? []) });
            }
        } catch {
            /* absent or unreadable: start empty */
        }
        return ledger;
    }

    private entry(route: string): { files: Set<string>; symbols: Set<string> } {
        let e = this.routes.get(route);
        if (e === undefined) {
            e = { files: new Set(), symbols: new Set() };
            this.routes.set(route, e);
        }
        return e;
    }

    seen(route: string): { files: number; symbols: number } {
        const e = this.routes.get(route);
        return { files: e?.files.size ?? 0, symbols: e?.symbols.size ?? 0 };
    }

    /** Distinct files the route would have seen after `exposure` is sent to it. */
    filesAfter(route: string, exposure: Exposure): number {
        const known = this.routes.get(route)?.files ?? new Set<string>();
        let n = known.size;
        for (const f of new Set(exposure.files)) if (!known.has(digest('file', f))) n++;
        return n;
    }

    /** A payload that was sent cannot be recalled, so this runs whatever the call returned. */
    record(route: string, exposure: Exposure): void {
        if (exposure.files.length === 0 && exposure.symbols.length === 0) return;
        const e = this.entry(route);
        for (const f of exposure.files) e.files.add(digest('file', f));
        for (const s of exposure.symbols) e.symbols.add(digest('symbol', s));
        if (this.file === null) return;
        const routes: Record<string, RouteSeen> = {};
        for (const [name, seen] of this.routes) routes[name] = { files: [...seen.files], symbols: [...seen.symbols] };
        try {
            fs.mkdirSync(path.dirname(this.file), { recursive: true });
            fs.writeFileSync(this.file, `${JSON.stringify({ schema_version: 1, routes })}\n`, 'utf8');
        } catch {
            /* accounting never blocks the call; the in-memory ledger still holds */
        }
    }
}

/**
 * Each route's projected share of tracked files if this exposure is sent to it;
 * null when the denominator is unknown, which the chooser treats as refusal for
 * an unpaid route.
 */
export function exposureShareFn(
    ledger: ExposureLedger,
    exposure: Exposure,
    trackedFiles: number | null,
): (route: string) => number | null {
    return (route) => (trackedFiles === null || trackedFiles <= 0 ? null : ledger.filesAfter(route, exposure) / trackedFiles);
}

/** Files git tracks under `root`; null outside a repository. */
export function trackedFileCount(root: string): number | null {
    try {
        const out = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        return out.split('\0').filter(Boolean).length;
    } catch {
        return null;
    }
}
