// The required-check comparator, driven offline through `--from-json` so the
// comparison itself is tested without a network read or a token.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ENFORCED_CHECKS } from '../../src/scripts/print_required_checks.js';
import { compare, requiredContexts } from '../../src/scripts/report_required_checks_drift.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
const SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'report_required_checks_drift.ts');

function ruleset(contexts: readonly string[]): unknown {
    return {
        id: 1,
        name: 'main protection',
        rules: [
            { type: 'deletion' },
            {
                type: 'required_status_checks',
                parameters: {
                    strict_required_status_checks_policy: false,
                    required_status_checks: contexts.map((context) => ({ context })),
                },
            },
        ],
    };
}

const tmp: string[] = [];
afterEach(() => {
    for (const d of tmp.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

function run(body: unknown): { code: number | null; out: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rrcd-'));
    tmp.push(dir);
    const file = path.join(dir, 'ruleset.json');
    fs.writeFileSync(file, JSON.stringify(body), 'utf-8');
    const r = spawnSync(TSX, [SCRIPT, '--from-json', file], { cwd: REPO_ROOT, encoding: 'utf-8' });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('report_required_checks_drift', () => {
    it('exits 0 when the ruleset requires exactly the contract list', () => {
        const r = run(ruleset([...ENFORCED_CHECKS].reverse()));
        expect(r.code, r.out).toBe(0);
    });

    it('exits 1 when the ruleset requires a context the contract does not name', () => {
        const r = run(ruleset([...ENFORCED_CHECKS, 'Some new required check']));
        expect(r.code).toBe(1);
        expect(r.out).toContain('required by the ruleset, absent from the contract: Some new required check');
    });

    it('exits 1 when the contract names a context the ruleset no longer requires', () => {
        const r = run(ruleset([ENFORCED_CHECKS[0]]));
        expect(r.code).toBe(1);
        expect(r.out).toContain(`named by the contract, not required by the ruleset: ${ENFORCED_CHECKS[1]}`);
    });

    it('exits 2 when the ruleset has no required-status-checks rule — never "agrees"', () => {
        const r = run({ id: 1, name: 'main protection', rules: [{ type: 'deletion' }] });
        expect(r.code).toBe(2);
    });

    it('exits 2 on an unknown argument', () => {
        const r = spawnSync(TSX, [SCRIPT, '--bogus'], { cwd: REPO_ROOT, encoding: 'utf-8' });
        expect(r.status).toBe(2);
    });

    it('compare and requiredContexts agree with the CLI on a direct call', () => {
        expect(requiredContexts(ruleset(['b', 'a']))).toEqual(['a', 'b']);
        expect(compare(['a', 'c'], ['a', 'b'])).toEqual({
            missingFromContract: ['c'],
            missingFromRuleset: ['b'],
        });
    });
});
