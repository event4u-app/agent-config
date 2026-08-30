// The browser-dispatch corpus is frozen, and the freeze is checkable.
//
// `road-to-capability-native-execution` step 0.5. A "frozen" corpus with no
// digest check is a corpus nobody would notice being edited — the freeze is the
// digest, not the word. Same shape as the encoding-channels corpus, whose
// manifest carries a per-file sha256 for the same reason.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'internal', 'bench', 'corpora', 'browser-dispatch');

interface Manifest {
    corpus_version: number;
    note: string;
    counts: { scenarios: number; distinct_hosts: number };
    scenario_ids: string[];
    sha256: Record<string, string>;
}

interface Scenario {
    id: string;
    label: string;
    host: Record<string, boolean>;
    observable: Record<string, boolean>;
    capability: string;
    note: string;
}

const manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8')) as Manifest;
const raw = readFileSync(join(DIR, 'scenarios.jsonl'), 'utf8');
const scenarios = raw
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as Scenario);

describe('the browser-dispatch corpus', () => {
    it('matches its recorded digest', () => {
        const actual = createHash('sha256').update(readFileSync(join(DIR, 'scenarios.jsonl'))).digest('hex');
        expect(
            actual,
            'the corpus changed without its manifest — regenerate the sha256 in manifest.json deliberately, '
                + 'or revert the edit',
        ).toBe(manifest.sha256['scenarios.jsonl']);
    });

    // removing_this_constraint_reds_it: append a line to scenarios.jsonl — this
    // test names the drift. Deleting the digest key reds it too, with a
    // different message, which is the point: an absent freeze must not read as
    // a satisfied one.

    it('carries every scenario step 0.5 names, and the manifest agrees', () => {
        // The step lists eight states by hand. A corpus that silently dropped
        // one would still pass a digest check, so the SET is asserted too.
        expect(scenarios.map((s) => s.id).sort()).toEqual(
            [
                's1-project-playwright',
                's2-playwright-cli-only',
                's3-mcp-only',
                's4-cli-and-mcp',
                's5-backend-unavailable',
                's6-unhealthy-backend',
                's7-advertised-not-dispatchable',
                's8-evidence-degraded',
            ].sort(),
        );
        expect(manifest.scenario_ids.sort()).toEqual(scenarios.map((s) => s.id).sort());
        expect(manifest.counts.scenarios).toBe(scenarios.length);
    });

    it('freezes INPUTS only — no row carries an expected selector verdict', () => {
        // The load-bearing constraint, and the one a later commit is most
        // likely to break by "helpfully" adding expectations. Risk 3 in this
        // roadmap's register is acceptance criteria pre-registered against a
        // mechanism with no caller; a verdict column here would be exactly
        // that, before Phase 3 has produced a caller.
        const forbidden = ['expected', 'verdict', 'winner', 'selected', 'expect', 'score', 'rank'];
        for (const s of scenarios) {
            for (const key of Object.keys(s)) {
                expect(forbidden, `scenario ${s.id} carries a verdict-shaped key "${key}"`).not.toContain(
                    key.toLowerCase(),
                );
            }
        }
    });

    it('describes host states that actually differ', () => {
        // Eight rows that collapse to three host states would be a corpus with
        // eight labels and three cases.
        const distinct = new Set(scenarios.map((s) => JSON.stringify(s.host)));
        expect(distinct.size).toBe(manifest.counts.distinct_hosts);
        expect(distinct.size).toBeGreaterThanOrEqual(5);
    });

    it('separates PRESENT from HEALTHY, and ADVERTISED from REACHABLE', () => {
        // The two distinctions the corpus exists to make. s6 is installed and
        // not runnable; s7 advertises a capability it cannot dispatch. If
        // either pair collapsed, the corpus would stop covering the failure
        // modes step 0.5 lists by hand.
        const s6 = scenarios.find((s) => s.id === 's6-unhealthy-backend');
        expect(s6?.observable['playwright_module_resolvable']).toBe(true);
        expect(s6?.observable['browser_binaries_installed']).toBe(false);

        const s7 = scenarios.find((s) => s.id === 's7-advertised-not-dispatchable');
        expect(s7?.observable['mcp_tool_advertised']).toBe(true);
        expect(s7?.observable['mcp_server_reachable']).toBe(false);
    });
});
