// Tests for src/scripts/check_test_coverage_diff.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_check_test_coverage_diff.py — evaluate() core,
// _pragma_reason_from_tree (monkeypatch REPO_ROOT → temp dir), and main()
// warn-only behaviour (monkeypatch the git/pragma hooks). Plus golden parity
// on the REAL REPO (skipped without python3).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/check_test_coverage_diff.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


const NO_PRAGMA = (_p: string): string | null => null;

describe('check_test_coverage_diff — evaluate (ported pytest)', () => {
    it('new gate with matching test is clean', () => {
        const changed: Array<[string, string]> = [
            ['A', 'src/scripts/check_foo.py'],
            ['A', 'tests/test_check_foo.py'],
        ];
        const [warnings, suppressed] = mod.evaluate(changed, NO_PRAGMA);
        expect(warnings).toEqual([]);
        expect(suppressed).toEqual([]);
    });

    it('naming variance still matches', () => {
        const changed: Array<[string, string]> = [
            ['A', 'src/scripts/check_foo.py'],
            ['A', 'tests/sub/foo_test.py'],
        ];
        const [warnings] = mod.evaluate(changed, NO_PRAGMA);
        expect(warnings).toEqual([]);
    });

    it('new gate without test warns', () => {
        const changed: Array<[string, string]> = [['A', 'src/scripts/lint_bar.py']];
        const [warnings, suppressed] = mod.evaluate(changed, NO_PRAGMA);
        expect(warnings).toEqual(['src/scripts/lint_bar.py']);
        expect(suppressed).toEqual([]);
    });

    it('pragma suppresses warning', () => {
        const changed: Array<[string, string]> = [['A', 'src/scripts/check_baz.py']];
        const reason = (p: string): string | null =>
            p === 'src/scripts/check_baz.py' ? 'no behaviour — thin re-export' : null;
        const [warnings, suppressed] = mod.evaluate(changed, reason);
        expect(warnings).toEqual([]);
        expect(suppressed).toEqual([['src/scripts/check_baz.py', 'no behaviour — thin re-export']]);
    });

    it('modified existing gate does not trigger', () => {
        const changed: Array<[string, string]> = [['M', 'src/scripts/check_foo.py']];
        const [warnings, suppressed] = mod.evaluate(changed, NO_PRAGMA);
        expect(warnings).toEqual([]);
        expect(suppressed).toEqual([]);
    });

    it('non-gate additions ignored', () => {
        const changed: Array<[string, string]> = [
            ['A', 'src/scripts/helper_thing.py'],
            ['A', 'Taskfile.yml'],
            ['A', 'docs/guide.md'],
            ['M', 'src/config/discovery/packs.yml'],
        ];
        const [warnings, suppressed] = mod.evaluate(changed, NO_PRAGMA);
        expect(warnings).toEqual([]);
        expect(suppressed).toEqual([]);
    });
});

describe('check_test_coverage_diff — _pragma_reason_from_tree', () => {
    let tmp: string;
    afterEach(() => {
        if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
        mod._set_repo_root_for_test(REPO_ROOT);
    });

    it('reads the in-file opt-out reason; returns null otherwise', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cdiff-'));
        const gate = path.join(tmp, 'src', 'scripts', 'check_demo.py');
        fs.mkdirSync(path.dirname(gate), { recursive: true });
        fs.writeFileSync(
            gate,
            '#!/usr/bin/env python3\n# coverage-diff-ignore: trivial wrapper\nx = 1\n',
            'utf-8',
        );
        mod._set_repo_root_for_test(tmp);
        expect(mod._pragma_reason_from_tree('src/scripts/check_demo.py')).toBe('trivial wrapper');
        const other = path.join(tmp, 'src', 'scripts', 'check_none.py');
        fs.writeFileSync(other, 'x = 1\n', 'utf-8');
        expect(mod._pragma_reason_from_tree('src/scripts/check_none.py')).toBeNull();
    });
});

describe('check_test_coverage_diff — main is warn-only exit zero', () => {
    afterEach(() => {
        mod._set_hooks_for_test({
            git_name_status: mod._git_name_status,
            pragma_reason_from_tree: mod._pragma_reason_from_tree,
        });
    });

    it('emits the metric line and exits 0', () => {
        const out: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        (process.stdout as { write: unknown }).write = (s: string): boolean => {
            out.push(String(s));
            return true;
        };
        try {
            mod._set_hooks_for_test({
                git_name_status: () => [['A', 'src/scripts/check_untested.py']],
                pragma_reason_from_tree: () => null,
            });
            const rc = mod.main(['--base-ref', 'main']);
            expect(rc).toBe(0);
        } finally {
            process.stdout.write = orig;
        }
        const joined = out.join('');
        expect(joined).toContain('check_untested.py');
        expect(joined).toContain('warned=1 suppressed=0');
    });
});

