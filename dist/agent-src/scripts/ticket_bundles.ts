/**
 * Ticket bundles, read from `agents/tickets/_registry.yml` for the dashboard.
 *
 * Extracted from `update_roadmap_progress.ts` and imported back, so behaviour is
 * unchanged. The move is mechanical: that file sits above the 1500-line ceiling
 * `check_source_size_budget` charges, and a run that adds lines there pays for
 * them by extraction rather than by raising a baseline.
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type * as YamlModule from 'yaml';

const _require = createRequire(import.meta.url);

/** Local copy: the parent keeps its own, and one tiny predicate is cheaper than
 * an export cycle between two scripts in the same directory. */
function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

export interface Bundle {
    slug: string;
    tickets: number;
    status: string;
    roadmap: string;
}

export function collect_bundles(repo_root: string): Bundle[] {
    const reg = path.join(repo_root, 'agents', 'tickets', '_registry.yml');
    if (!fs.existsSync(reg)) {
        return [];
    }
    let YAML: typeof YamlModule;
    try {
        YAML = _require('yaml') as typeof YamlModule;
    } catch {
        return [];
    }
    let data: unknown;
    try {
        // yaml.safe_load(...) or {} — PyYAML 1.1 semantics; graceful on malformed.
        data = YAML.parse(fs.readFileSync(reg, { encoding: 'utf-8' }), { version: '1.1' }) ?? {};
    } catch {
        return [];
    }
    const out: Bundle[] = [];
    const bundles =
        data && typeof data === 'object' && !Array.isArray(data)
            ? ((data as Record<string, unknown>)['bundles'] ?? null)
            : null;
    const bundleMap =
        bundles && typeof bundles === 'object' && !Array.isArray(bundles)
            ? (bundles as Record<string, unknown>)
            : {};
    for (const slug of Object.keys(bundleMap).sort()) {
        const metaRaw = bundleMap[slug];
        const meta =
            metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)
                ? (metaRaw as Record<string, unknown>)
                : {};
        const bdir = path.join(repo_root, 'agents', 'tickets', slug);
        let n = 0;
        if (_isDir(bdir)) {
            try {
                n = fs.readdirSync(bdir).filter((f) => f.startsWith('T-') && f.endsWith('.md')).length;
            } catch {
                n = 0;
            }
        }
        out.push({
            slug,
            tickets: n,
            status: (meta['status'] as string) ?? '?',
            roadmap: (meta['source_roadmap'] as string) ?? '',
        });
    }
    return out;
}
