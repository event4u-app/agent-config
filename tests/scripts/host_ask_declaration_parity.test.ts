// Two files answer "does this host have a picker": the `ask:` row of each
// platform in hook_manifest.yaml, and `structured_ask` in the host-capability
// registry. Nothing tied them together, so one could move without the other.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { resolveHostCapabilities } from '../../src/scripts/_lib/host_capability.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

interface PlatformRow {
    ask?: string;
}

function askRows(): Record<string, string> {
    const manifest = parseYaml(
        fs.readFileSync(path.join(REPO, 'src', 'scripts', 'hook_manifest.yaml'), 'utf8'),
    ) as { platforms: Record<string, PlatformRow> };
    const rows: Record<string, string> = {};
    for (const [host, row] of Object.entries(manifest.platforms)) {
        if (typeof row?.ask === 'string') {
            rows[host] = row.ask;
        }
    }
    return rows;
}

/** Hosts whose declaration disagrees with the registry. */
function askMismatches(rows: Record<string, string>): string[] {
    return Object.entries(rows)
        .filter(([host, ask]) => (ask === 'native') !== resolveHostCapabilities(host).structured_ask)
        .map(([host]) => host);
}

describe('hook_manifest ask: agrees with the host-capability registry', () => {
    it('every platform row declares an ask shape', () => {
        expect(Object.keys(askRows()).length).toBeGreaterThan(0);
    });

    it('ask: native exactly where structured_ask is true', () => {
        expect(askMismatches(askRows())).toEqual([]);
    });

    it('a flipped row is caught', () => {
        const rows = askRows();
        const host = Object.keys(rows).find((h) => rows[h] === 'text')!;
        expect(askMismatches({ ...rows, [host]: 'native' })).toEqual([host]);
    });
});
