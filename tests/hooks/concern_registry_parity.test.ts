/**
 * Registry ↔ manifest parity (road-to-credible-install Phase 1).
 *
 * Every concern in hook_manifest.yaml MUST have an in-process registry
 * entry: a missing entry silently falls back to the spawn-per-concern
 * path and reintroduces the latency class the single-process dispatcher
 * removed. Red when a new concern lands without its registry line.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { describe, expect, it } from 'vitest';

import { CONCERN_REGISTRY } from '../../src/scripts/hooks/concern_registry.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');

describe('concern registry parity', () => {
    const manifest = parseYaml(fs.readFileSync(MANIFEST, 'utf-8')) as {
        concerns: Record<string, { script: string }>;
    };

    it('every manifest concern has an in-process registry entry', () => {
        const missing: string[] = [];
        for (const [name, def] of Object.entries(manifest.concerns)) {
            if (CONCERN_REGISTRY[def.script] === undefined) {
                missing.push(`${name} (${def.script})`);
            }
        }
        expect(missing, `add these to src/scripts/hooks/concern_registry.ts: ${missing.join(', ')}`).toEqual([]);
    });

    it('every registry entry is callable', () => {
        for (const [script, mainFn] of Object.entries(CONCERN_REGISTRY)) {
            expect(typeof mainFn, script).toBe('function');
        }
    });

    it('registry has no stale entries for scripts absent from disk', () => {
        for (const script of Object.keys(CONCERN_REGISTRY)) {
            expect(fs.existsSync(path.join(REPO_ROOT, script)), `${script} missing on disk`).toBe(true);
        }
    });
});
