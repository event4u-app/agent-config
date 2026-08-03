// Tests for src/scripts/hooks/block_config_weakening.ts.
//
// House pattern (mirrors block_kernel_rule_writes.test.ts): the decision lives
// in exported pure functions and is tested directly; `main()` is thin wiring
// over them. The one impure piece — the per-session counter — is exercised
// against a temp root so no repo state is touched.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    SESSION_ENTRY_CAP,
    SESSION_WARN_AT,
    added_entries,
    bump_session,
    classify_target,
    count_entries,
    decide,
} from '../../../src/scripts/hooks/block_config_weakening.js';

describe('block_config_weakening — classify_target', () => {
    it('classifies allowlists as the blocking surface', () => {
        expect(classify_target('src/scripts/lint_framework_leakage_allowlist.json')).toBe('allowlist');
        expect(classify_target('src/scripts/ghostwriter_fixture_allowlist.txt')).toBe('allowlist');
        expect(classify_target('allowlist_backup.json')).toBe('allowlist');
    });

    it('classifies baselines and budgets as advisory, never blocking', () => {
        expect(classify_target('src/config/gate-violation-baselines.json')).toBe('advisory');
        expect(classify_target('src/config/hook-latency-budget.json')).toBe('advisory');
        expect(classify_target('src/config/budgets.yml')).toBe('advisory');
    });

    it('ignores everything else', () => {
        expect(classify_target('src/rules/commit-policy.md')).toBeNull();
        expect(classify_target('package.json')).toBeNull();
        // A file merely mentioning "allowlist" in its name is not one.
        expect(classify_target('docs/allowlists-explained.md')).toBeNull();
    });

    it('handles Windows-style separators', () => {
        expect(classify_target('src\\scripts\\lint_x_allowlist.json')).toBe('allowlist');
    });
});

describe('block_config_weakening — count_entries', () => {
    it('counts string leaves in a JSON array', () => {
        expect(count_entries('["a", "b", "c"]')).toBe(3);
    });

    it('counts string leaves inside a rule→paths map', () => {
        expect(count_entries('{"rule-a": ["p1", "p2"], "rule-b": ["p3"]}')).toBe(3);
    });

    it('is stable under reformatting — a reindent is not growth', () => {
        expect(count_entries('["a","b"]')).toBe(count_entries('[\n  "a",\n  "b"\n]'));
    });

    it('falls back to non-blank, non-comment lines for txt and JSON fragments', () => {
        expect(count_entries('a\n\n# comment\nb\n// also comment\nc\n')).toBe(3);
        expect(count_entries('  "x",\n  "y",')).toBe(2);
    });
});

describe('block_config_weakening — added_entries', () => {
    it('measures a Write against what is on disk', () => {
        expect(added_entries({ content: '["a","b","c"]' }, '["a"]')).toBe(2);
    });

    it('treats a shrinking allowlist as zero, never as banked credit', () => {
        expect(added_entries({ content: '["a"]' }, '["a","b","c"]')).toBe(0);
    });

    it('measures an Edit from its own replacement pair', () => {
        expect(added_entries({ old_string: '  "a",', new_string: '  "a",\n  "b",\n  "c",' }, null)).toBe(2);
    });

    it('returns 0 for a tool input carrying neither shape', () => {
        expect(added_entries({ file_path: 'x' }, '["a"]')).toBe(0);
    });
});

describe('block_config_weakening — decide', () => {
    it('allows an unrecognised surface and a zero delta', () => {
        expect(decide(null, 'x', 99, 5).action).toBe('allow');
        expect(decide('allowlist', 'x', 99, 0).action).toBe('allow');
    });

    it('allows a small allowlist addition below the warn point', () => {
        expect(decide('allowlist', 'x', SESSION_WARN_AT - 1, 1).action).toBe('allow');
    });

    it('warns once the session total reaches the warn point', () => {
        const d = decide('allowlist', 'x', SESSION_WARN_AT, 1);
        expect(d.action).toBe('warn');
        expect(d.reason).toContain(String(SESSION_ENTRY_CAP));
    });

    it('blocks past the cap the recorded rule already states', () => {
        const d = decide('allowlist', 'lint_x_allowlist.json', SESSION_ENTRY_CAP + 1, 1);
        expect(d.action).toBe('block');
        expect(d.reason).toContain('the LINTER is wrong');
        // The deny names a human action outside the session (kernel-guard shape).
        expect(d.reason).toContain('hook_manifest.yaml');
    });

    it('never blocks an advisory surface, however large the edit', () => {
        expect(decide('advisory', 'src/config/gate-violation-baselines.json', 999, 999).action).toBe('warn');
    });
});

describe('block_config_weakening — bump_session', () => {
    it('accumulates per session and per file, and isolates both', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bcw-'));
        expect(bump_session(root, 's1', 'a.json', 3)).toBe(3);
        expect(bump_session(root, 's1', 'a.json', 4)).toBe(7);
        expect(bump_session(root, 's1', 'b.json', 2)).toBe(2);
        expect(bump_session(root, 's2', 'a.json', 1)).toBe(1);
    });

    it('starts from zero on an unreadable state file rather than throwing', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bcw-'));
        const f = path.join(root, 'agents', 'runtime', 'state', 'config-weakening.json');
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, 'not json', 'utf-8');
        expect(bump_session(root, 's1', 'a.json', 2)).toBe(2);
    });
});
