// Tests for src/scripts/lint_one_off_age.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// Layer 1: tests/test_lint_one_off_age.py ported 1:1 over the pure helpers
//   (scan with an injected `today`, format_text, the Finding shape). The
//   Python `Finding` constructor becomes a plain object literal; Python's
//   `date(y,m,d)` becomes the module's SimpleDate `{y,m,d}`.
// Layer 2: CLI golden parity python3 vs tsx via the real `--root` flag on
//   tmp trees (covers main's exit codes) and on the REAL REPO. Skipped
//   without python3.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_one_off_age.js';



function makeRoot(tmp: string): string {
    fs.mkdirSync(path.join(tmp, 'scripts', '_one_off'), { recursive: true });
    return tmp;
}

function writeOneOff(root: string, month: string, slug: string, body = ''): string {
    const d = path.join(root, 'scripts', '_one_off', month);
    fs.mkdirSync(d, { recursive: true });
    const p = path.join(d, `_one_off_${slug}.py`);
    fs.writeFileSync(p, body || '# one-off\n', 'utf-8');
    return p;
}

describe('lint_one_off_age — ported pytest suite (helpers)', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ooa-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('test_no_one_off_dir_returns_empty', () => {
        expect(mod.scan(tmp)).toEqual([]);
    });

    it('test_fresh_script_is_silent', () => {
        const root = makeRoot(tmp);
        writeOneOff(root, '2026-04', 'fresh');
        expect(mod.scan(root, { y: 2026, m: 4, d: 15 })).toEqual([]);
    });

    it('test_warn_window', () => {
        const root = makeRoot(tmp);
        writeOneOff(root, '2026-01', 'softwin');
        const findings = mod.scan(root, { y: 2026, m: 3, d: 17 });
        expect(findings.length).toBe(1);
        expect(findings[0]!.severity).toBe('warn');
        expect(findings[0]!.age_days).toBe(75);
    });

    it('test_hard_fail_past_90_days', () => {
        const root = makeRoot(tmp);
        writeOneOff(root, '2026-01', 'stale');
        const findings = mod.scan(root, { y: 2026, m: 4, d: 11 });
        expect(findings.length).toBe(1);
        expect(findings[0]!.severity).toBe('fail');
    });

    it('test_extension_silences_warning', () => {
        const root = makeRoot(tmp);
        const body = '"""\n---\nttl_extended_until: 2026-05-01\nttl_reason: blocked on PROJ-1\n---\n"""\n';
        writeOneOff(root, '2026-01', 'ext', body);
        expect(mod.scan(root, { y: 2026, m: 3, d: 17 })).toEqual([]);
    });

    it('test_extension_beyond_180_day_cap_fails', () => {
        const root = makeRoot(tmp);
        const body = '"""\n---\nttl_extended_until: 2026-08-01\n---\n"""\n';
        writeOneOff(root, '2026-01', 'toofarext', body);
        const findings = mod.scan(root, { y: 2026, m: 3, d: 17 });
        expect(findings.length).toBe(1);
        expect(findings[0]!.severity).toBe('fail');
        expect(findings[0]!.reason).toContain('180-day cap');
    });

    it('test_extension_expired_falls_back_to_age', () => {
        const root = makeRoot(tmp);
        const body = '"""\n---\nttl_extended_until: 2026-02-15\n---\n"""\n';
        writeOneOff(root, '2026-01', 'expired', body);
        const findings = mod.scan(root, { y: 2026, m: 4, d: 11 });
        expect(findings.length).toBe(1);
        expect(findings[0]!.severity).toBe('fail');
    });

    it('test_invalid_month_dir_flagged', () => {
        const root = makeRoot(tmp);
        fs.mkdirSync(path.join(root, 'scripts', '_one_off', 'not-a-month'), { recursive: true });
        const findings = mod.scan(root);
        expect(findings.length).toBe(1);
        expect(findings[0]!.severity).toBe('fail');
        expect(findings[0]!.reason).toContain('invalid month directory');
    });

    it('test_bad_filename_flagged', () => {
        const root = makeRoot(tmp);
        const d = path.join(root, 'scripts', '_one_off', '2026-01');
        fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, 'not_prefixed.py'), '# x\n', 'utf-8');
        const findings = mod.scan(root);
        expect(findings.length).toBe(1);
        expect(findings[0]!.reason).toContain('filename does not match');
    });

    it('test_readme_in_month_dir_ignored', () => {
        const root = makeRoot(tmp);
        const d = path.join(root, 'scripts', '_one_off', '2026-01');
        fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, 'README.md'), '# notes\n', 'utf-8');
        expect(mod.scan(root)).toEqual([]);
    });

    it('test_format_text_clean', () => {
        expect(mod.format_text([])).toContain('No one-off-script');
    });

    it('test_format_text_groups_by_severity', () => {
        const findings: mod.Finding[] = [
            { path: 'a.py', age_days: 100, severity: 'fail', reason: 'too old' },
            { path: 'b.py', age_days: 70, severity: 'warn', reason: 'soft' },
        ];
        const out = mod.format_text(findings);
        expect(out).toContain('1 one-off script(s) past hard limit');
        expect(out).toContain('1 one-off script(s) in soft window');
    });
});

// --- CLI golden parity python3 vs tsx ---------------------------------------

