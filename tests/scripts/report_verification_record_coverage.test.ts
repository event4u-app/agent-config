/**
 * The instrument-gap reporter — what it counts, and what it refuses to count.
 *
 * Two properties carry the weight and both are easy to lose in a later edit: an
 * empty scan must throw rather than print a reassuring zero, and a host that
 * binds the recorder but left no witness must never share a row with a host that
 * left clean ones. Everything else here is arithmetic.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    computeCoverage,
    hostsBindingRecorder,
    main,
    renderText,
    UNATTRIBUTED,
    WITNESS_DIR,
} from '../../src/scripts/report_verification_record_coverage.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function witness(platform: string | null, runs: unknown[]): string {
    const state: Record<string, unknown> = { session_id: 's', verification_runs: runs };
    if (platform !== null) state['platform'] = platform;
    return JSON.stringify(state);
}

const PASS = {
    command: 'npx vitest run tests/unit',
    exit_code: 0,
    stdout_tail: ' Tests  3 passed (3)',
    runner: 'vitest',
};
const FAIL = {
    command: 'npx tsc --noEmit src/x.ts',
    exit_code: 2,
    exit_source: 'error_prefix',
    stdout_tail: 'Exit code 2\nerror TS2304: Cannot find name',
    runner: 'other',
};
const NO_EXIT = {
    command: 'npx vitest run tests/unit',
    exit_code: null,
    exit_source: null,
    stdout_tail: '',
    runner: 'vitest',
};

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'record-coverage-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('which hosts can produce a record at all', () => {
    it('reads the binding from the manifest rather than a hardcoded list', () => {
        const manifest = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'),
            'utf8',
        );
        const hosts = hostsBindingRecorder(manifest);
        expect(hosts.has('claude')).toBe(true);
        // Declared `fallback_only` — it binds nothing, so a record is not
        // possible there and the report must not imply one was expected.
        expect(hosts.has('copilot')).toBe(false);
    });

    it('an unreadable manifest yields an empty set, not a guess', () => {
        expect(hostsBindingRecorder(':\n  - [not yaml').size).toBe(0);
    });
});

describe('counting', () => {
    const binding = new Set(['claude', 'augment']);

    it('splits records by host and classifies each one', () => {
        const r = computeCoverage(
            [
                { path: 'a.json', text: witness('claude', [PASS, FAIL]) },
                { path: 'b.json', text: witness('claude', [NO_EXIT]) },
            ],
            binding,
            '/root',
        );
        const claude = r.hosts.find((h) => h.host === 'claude');
        expect(claude).toBeDefined();
        expect(claude?.sessions).toBe(2);
        expect(claude?.records).toBe(3);
        expect(claude?.exit_code_available).toBe(2);
        expect(claude?.binds_recorder).toBe(true);
        expect(claude?.verdicts['PASS_EVIDENCE_OK']).toBe(1);
        expect(claude?.verdicts['INVALID_RUN:exit_code_unavailable']).toBe(1);
    });

    it('an absent exit code is an instrument gap, a failing one is not', () => {
        const r = computeCoverage(
            [{ path: 'a.json', text: witness('claude', [NO_EXIT, FAIL, PASS, PASS]) }],
            binding,
            '/root',
        );
        const claude = r.hosts.find((h) => h.host === 'claude');
        // The whole point of the split: a red run is a statement about the work
        // and must never be counted as a hole in the instrument.
        expect(claude?.instrument_gaps).toBe(1);
        expect(claude?.instrument_gap_share).toBeCloseTo(0.25);
    });

    it('a witness with no host is unattributed, never folded into a real one', () => {
        const r = computeCoverage(
            [{ path: 'a.json', text: witness(null, [PASS]) }],
            binding,
            '/root',
        );
        expect(r.hosts.map((h) => h.host)).toEqual([UNATTRIBUTED]);
        expect(r.hosts[0]?.binds_recorder).toBe(false);
    });

    it('an unparseable witness still counts as a session', () => {
        const r = computeCoverage([{ path: 'a.json', text: '{ torn' }], binding, '/root');
        expect(r.hosts.find((h) => h.host === UNATTRIBUTED)?.sessions).toBe(1);
    });

    it('a host with no records has a null share, never a zero', () => {
        const r = computeCoverage(
            [{ path: 'a.json', text: witness('claude', []) }],
            binding,
            '/root',
        );
        // 0/0 printed as 0% would read as "no gaps here", which is the exact
        // misreading this roadmap's Risk 3 names.
        expect(r.hosts[0]?.instrument_gap_share).toBeNull();
    });
});

describe('unobserved is not clean', () => {
    it('names a binding host with no witness as unobserved', () => {
        const r = computeCoverage(
            [{ path: 'a.json', text: witness('claude', [PASS]) }],
            new Set(['claude', 'augment', 'cursor']),
            '/root',
        );
        expect(r.unobserved).toEqual(['augment', 'cursor']);
        expect(r.hosts.map((h) => h.host)).toEqual(['claude']);
    });

    it('renders unobserved in its own cell and says what it means', () => {
        const text = renderText(
            computeCoverage(
                [{ path: 'a.json', text: witness('claude', [PASS]) }],
                new Set(['claude', 'gemini']),
                '/root',
            ),
        );
        expect(text).toMatch(/\| gemini \| yes \| 0 \| 0 \| 0 \| 0 \| unobserved \|/);
        expect(text).toContain('absence of measurement, not an absence of gaps');
        // The blind spot is printed unconditionally — a reader must not have to
        // know that a never-recorded command cannot appear in this table.
        expect(text).toContain('blind spot');
    });
});

describe('the CLI', () => {
    it('refuses an empty scan instead of reporting zero gaps over nothing', () => {
        expect(() => main(['--root', tmp, '--quiet'])).toThrow(/scanned 0 witness files/);
    });

    it('reads a populated directory and exits 0', () => {
        fs.writeFileSync(path.join(tmp, 'one.json'), witness('claude', [PASS, NO_EXIT]));
        expect(main(['--root', tmp, '--quiet'])).toBe(0);
    });

    it('emits machine-readable output on request', () => {
        fs.writeFileSync(path.join(tmp, 'one.json'), witness('claude', [FAIL]));
        const chunks: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
            chunks.push(s);
            return true;
        };
        try {
            expect(main(['--root', tmp, '--json'])).toBe(0);
        } finally {
            (process.stdout as unknown as { write: typeof orig }).write = orig;
        }
        const parsed = JSON.parse(chunks.join('')) as { hosts: Array<{ host: string }> };
        expect(parsed.hosts[0]?.host).toBe('claude');
    });

    it('rejects an unknown flag rather than silently ignoring it', () => {
        expect(main(['--nope'])).toBe(2);
    });

    it("defaults its root to the recorder's own witness directory", () => {
        expect(WITNESS_DIR).toBe(path.join('agents', 'state', 'verify-before-complete'));
    });
});
