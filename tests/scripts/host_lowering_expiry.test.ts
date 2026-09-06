// 3.2 / AC-5 — an expired host-capability row cannot carry a blocking binding.
//
// The fixtures render `__YESTERDAY__` at run time rather than pinning a date:
// a fixture with a hard-coded past date stops testing "expired" the moment
// someone reads it as "old fixture, probably fine", and one with a hard-coded
// future date silently stops testing anything at all when that date arrives.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _check_host_lowering, lint } from '../../src/scripts/lint_hook_manifest.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'host_lowering');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');
const COMMITTED = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'host_lowering.yaml');

function isoDaysFromNow(days: number): string {
    return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

// The fixtures are rendered against the wall clock, so the verdict must be read
// against the same clock. Left to resolve itself the check would use `asOf()`,
// which under CI is the COMMIT date — older than the fixture's "yesterday", so
// the row would read as not-yet-expired and the test would assert nothing.
const TODAY = isoDaysFromNow(0);

let tmp: string;

/** Materialise a fixture with `__YESTERDAY__` resolved. */
function fixture(name: string): string {
    const text = fs.readFileSync(path.join(FIXTURES, name), 'utf8').replace('__YESTERDAY__', isoDaysFromNow(-1));
    const out = path.join(tmp, name);
    fs.writeFileSync(out, text);
    return out;
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'host-lowering-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('host_lowering expiry gate', () => {
    it('fails and names the row when an expired row carries a blocking binding', () => {
        const errors: string[] = [];
        const warnings: string[] = [];
        _check_host_lowering(fixture('expired_blocking.yaml'), errors, warnings, TODAY);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('host_lowering fixturehost/any');
        expect(errors[0]).toContain(isoDaysFromNow(-1));
        expect(errors[0]).toContain('pre_tool_use');
    });

    it('makes lint_hook_manifest exit non-zero on that fixture', () => {
        expect(lint(MANIFEST, false, fixture('expired_blocking.yaml'), TODAY)).not.toBe(0);
    });

    it('warns and passes when the same expired row carries no blocking binding', () => {
        const errors: string[] = [];
        const warnings: string[] = [];
        _check_host_lowering(fixture('expired_advisory.yaml'), errors, warnings, TODAY);
        expect(errors).toEqual([]);
        expect(warnings.some((w) => w.includes('host_lowering fixturehost/any'))).toBe(true);
        expect(lint(MANIFEST, false, fixture('expired_advisory.yaml'), TODAY)).toBe(0);
    });

    it('refuses a blocking binding on a row that was never verified', () => {
        const errors: string[] = [];
        const warnings: string[] = [];
        _check_host_lowering(fixture('unverified_blocking.yaml'), errors, warnings, TODAY);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('verified: null');
    });

    it('passes at HEAD', () => {
        const errors: string[] = [];
        const warnings: string[] = [];
        _check_host_lowering(COMMITTED, errors, warnings, TODAY);
        expect(errors).toEqual([]);
    });

    it('reports an unreadable table rather than passing it', () => {
        const errors: string[] = [];
        const warnings: string[] = [];
        _check_host_lowering(path.join(tmp, 'does-not-exist.yaml'), errors, warnings, TODAY);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('could not be read or parsed');
    });
});
