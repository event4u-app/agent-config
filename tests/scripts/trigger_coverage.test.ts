// Tests for src/scripts/trigger_coverage.ts (py2ts Phase 8 / Wave 8b).
//
// 1:1 port of tests/test_trigger_coverage.py — the corpus-driven CI gate
// (every required rule must fire) plus the kernel-always-fires floor — over
// the REAL dist/router.json + tests/eval/trigger-coverage.yaml. Adds a
// golden-parity layer (python3 vs tsx) for `--json` and the human report.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

import * as tc from '../../src/scripts/trigger_coverage.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'trigger_coverage.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'trigger_coverage.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

interface Case {
    id: string;
    prompt: string;
    expect?: string[];
}

const CORPUS =
    (parseYaml(fs.readFileSync(tc.CORPUS, 'utf-8'), { version: '1.1' }) as Case[] | null) ?? [];
const ROUTER = tc.load_router();

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('trigger_coverage — corpus + router present', () => {
    it('router file exists', () => {
        expect(fs.statSync(tc.ROUTER).isFile()).toBe(true);
    });
    it('seeds at least 20 adversarial coverage cases', () => {
        expect(CORPUS.length).toBeGreaterThanOrEqual(20);
    });
});

describe('trigger_coverage — required rules fire', () => {
    for (const c of CORPUS) {
        it(`case ${c.id}`, () => {
            const fired = tc.fired_rules(c.prompt, ROUTER);
            const missing = (c.expect ?? []).filter((r) => !fired.has(r));
            expect(missing).toEqual([]);
        });
    }
});

describe('trigger_coverage — kernel always fires', () => {
    it('every kernel rule fires for an arbitrary prompt', () => {
        const fired = tc.fired_rules('an arbitrary unrelated prompt', ROUTER);
        for (const kid of ROUTER.kernel ?? []) {
            expect(fired.has(kid)).toBe(true);
        }
    });
});

describe('trigger_coverage — matching primitives', () => {
    it('keyword trigger is a case-insensitive substring match', () => {
        const router = {
            kernel: [],
            tier_1: [{ id: 'kw', triggers: [{ keyword: 'Webhook Secret' }] }],
            tier_2: [],
        };
        expect(tc.fired_rules('add a webhook secret', router).has('kw')).toBe(true);
        expect(tc.fired_rules('nothing here', router).has('kw')).toBe(false);
    });
    it('intent trigger requires every alpha word (len>2) as a token', () => {
        const router = {
            kernel: [],
            tier_1: [],
            tier_2: [{ id: 'it', triggers: [{ intent: 'structural decision' }] }],
        };
        expect(tc.fired_rules('a structural decision was made', router).has('it')).toBe(true);
        expect(tc.fired_rules('only structural here', router).has('it')).toBe(false);
    });
});

describe.runIf(hasPython3())('trigger_coverage — golden parity (python3 vs tsx)', () => {
    for (const args of [[], ['--json']]) {
        it(`byte-identical for: ${args.join(' ') || '(human)'}`, () => {
            const py = spawnSync('python3', [PY_SCRIPT, ...args], {
                encoding: 'utf8',
                cwd: REPO_ROOT,
            });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
                encoding: 'utf8',
                cwd: REPO_ROOT,
            });
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
        });
    }
});
