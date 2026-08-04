// Parity by construction: the router trigger matcher has exactly ONE
// implementation (`src/scripts/_lib/router_match.ts`) and every surface that
// answers "which rules fire on this prompt?" imports it. Nothing can drift
// between `route:explain`, `explain route`, and the telemetry replay because
// there is nothing to drift between. A second matcher implementation
// appearing anywhere in src/ turns this suite red (grep-guard pattern,
// precedent: tests/scripts/code_graph.test.ts install-bundle guard).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const CANONICAL = path.join('src', 'scripts', '_lib', 'router_match.ts');

function walk(dir: string, acc: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules') continue;
            walk(p, acc);
        } else if (entry.name.endsWith('.ts')) {
            acc.push(p);
        }
    }
    return acc;
}

const SOURCE_FILES = [
    ...walk(path.join(REPO_ROOT, 'src', 'scripts')),
    ...walk(path.join(REPO_ROOT, 'src', 'cli')),
];

const MATCHER_DEFS = [
    /function\s+keyword_matches_anchored\s*\(/,
    /function\s+trigger_matches\s*\(/,
    /function\s+match_prompt\s*\(/,
];

describe('router matcher — single implementation', () => {
    it('the matcher functions are defined ONLY in _lib/router_match.ts', () => {
        const offenders: string[] = [];
        for (const file of SOURCE_FILES) {
            const rel = path.relative(REPO_ROOT, file);
            if (rel === CANONICAL) continue;
            const body = fs.readFileSync(file, 'utf-8');
            for (const re of MATCHER_DEFS) {
                if (re.test(body)) {
                    offenders.push(`${rel} defines ${re.source}`);
                }
            }
        }
        expect(offenders, offenders.join('\n')).toEqual([]);
    });

    it('the canonical module exists and defines all three matchers', () => {
        const body = fs.readFileSync(path.join(REPO_ROOT, CANONICAL), 'utf-8');
        for (const re of MATCHER_DEFS) {
            expect(re.test(body), `router_match.ts must define ${re.source}`).toBe(true);
        }
    });

    it.each([
        ['src/scripts/_cli/cmd_explain.ts'],
        ['src/scripts/_cli/cmd_route_explain.ts'],
        ['src/scripts/router_telemetry.ts'],
    ])('%s imports the shared matcher', (rel) => {
        const body = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
        expect(/from\s+['"][^'"]*_lib\/router_match(\.js)?['"]/.test(body), `${rel} must import _lib/router_match`).toBe(true);
    });
});
