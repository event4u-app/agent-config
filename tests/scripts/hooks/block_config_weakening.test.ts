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
    changedKeys,
    classCVerdict,
    findPackageRoot,
    count_entries,
    decide,
    parseSettingsDoc,
} from '../../../src/scripts/hooks/block_config_weakening.js';
import {
    buildSettingsClassIndex,
    classOfPath,
    parseSettingsClassRows,
} from '../../../src/shared/settingsClasses.js';

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

// Class C: the key is the unit, never the file.
//
// road-to-a-kernel-that-guards-its-plumbing 2.1. The guard fences a POLICY DIAL
// inside a settings file and leaves every other key in the same file writable,
// which is why every case below pairs a refusal with the allow that proves the
// fence is per-key and not per-file.
describe('block_config_weakening — class-c', () => {
    const REAL_CONTRACT = path.resolve(__dirname, '..', '..', '..', 'docs', 'contracts', 'settings-classes.md');
    const index = buildSettingsClassIndex(parseSettingsClassRows(fs.readFileSync(REAL_CONTRACT, 'utf-8')));

    it('classifies project settings files and nothing that merely shares a basename', () => {
        expect(classify_target('.agent-settings.yml')).toBe('class-c');
        expect(classify_target('some/project/.claude/settings.json')).toBe('class-c');
        // A bare `settings.json` is a common filename; fencing it on the
        // basename alone would refuse files carrying no settings key at all.
        expect(classify_target('src/server/settings.json')).toBeNull();
        expect(classify_target('README.md')).toBeNull();
    });

    it('refuses an edit that flips a Class C key', () => {
        const before = 'hooks:\n  injection_scan:\n    enabled: false\n';
        const reason = classCVerdict(
            { old_string: 'enabled: false', new_string: 'enabled: true' },
            before,
            '.agent-settings.yml',
            index,
        );
        expect(reason).not.toBeNull();
        expect(reason).toContain('hooks.injection_scan.enabled');
    });

    it('allows an edit that changes only a Class A key in the same file', () => {
        const before = 'personal:\n  play_by_play: false\n  minimal_output: true\n';
        expect(
            classCVerdict(
                { old_string: 'play_by_play: false', new_string: 'play_by_play: true' },
                before,
                '.agent-settings.yml',
                index,
            ),
        ).toBeNull();
    });

    it('resolves a child of a Class C map through its nearest classified ancestor', () => {
        // `personal.autonomy` is C; a leaf under a C map has no row of its own
        // and must still resolve to C rather than to "unclassified".
        expect(classOfPath(index, 'personal.autonomy')).toBe('C');
    });

    // Fail-closed, both shapes. Each would otherwise be a bypass that needs no
    // authorisation: make one file unreadable for the length of one tool call.
    it('refuses every changed key when the class contract cannot be read', () => {
        const reason = classCVerdict(
            { old_string: 'play_by_play: false', new_string: 'play_by_play: true' },
            'personal:\n  play_by_play: false\n',
            '.agent-settings.yml',
            null,
        );
        expect(reason).not.toBeNull();
        expect(reason).toContain('fail-closed');
    });

    it('refuses an edit whose result does not parse as settings', () => {
        const reason = classCVerdict(
            { old_string: 'enabled: false', new_string: 'enabled: [unclosed' },
            'hooks:\n  injection_scan:\n    enabled: false\n',
            '.agent-settings.yml',
            index,
        );
        expect(reason).not.toBeNull();
        expect(reason).toContain('does not parse');
    });

    it('allows when the edit would not apply at all', () => {
        expect(
            classCVerdict(
                { old_string: 'not present anywhere', new_string: 'x' },
                'personal:\n  play_by_play: false\n',
                '.agent-settings.yml',
                index,
            ),
        ).toBeNull();
    });

    it('diffs leaves, not interior nodes — a changed child reports the child', () => {
        expect(changedKeys({ a: { b: 1, c: 2 } }, { a: { b: 9, c: 2 } })).toEqual(['a.b']);
        expect(changedKeys({ a: { b: 1 } }, {})).toEqual(['a.b']);
    });
});

// The three defects an independent review found before this landed.
describe('block_config_weakening — class-c, the reviewed defects', () => {
    const REAL_CONTRACT = path.resolve(__dirname, '..', '..', '..', 'docs', 'contracts', 'settings-classes.md');
    const index = buildSettingsClassIndex(parseSettingsClassRows(fs.readFileSync(REAL_CONTRACT, 'utf-8')));

    // The guard must evaluate the edit that will actually run. Modelling only
    // the first occurrence let a `replace_all` edit whose SECOND occurrence is
    // the Class C one pass while the real edit changed it.
    it('models replace_all — a later occurrence being the Class C one is caught', () => {
        const before = [
            'personal:',
            '  play_by_play: false',
            'hooks:',
            '  injection_scan:',
            '    enabled: false',
            '',
        ].join('\n');
        const ti = { old_string: 'false', new_string: 'true', replace_all: true };
        const reason = classCVerdict(ti, before, '.agent-settings.yml', index);
        expect(reason).not.toBeNull();
        expect(reason).toContain('hooks.injection_scan.enabled');

        // Without the flag only the first occurrence changes, and the first is
        // a Class A key — so the same strings must be ALLOWED. This pair is
        // what makes the case about `replace_all` rather than about the keys.
        expect(
            classCVerdict({ old_string: 'false', new_string: 'true' }, before, '.agent-settings.yml', index),
        ).toBeNull();
    });

    it('refuses a replace_all value it cannot interpret', () => {
        const reason = classCVerdict(
            { old_string: 'false', new_string: 'true', replace_all: 'yes' as unknown as boolean },
            'personal:\n  play_by_play: false\n',
            '.agent-settings.yml',
            index,
        );
        expect(reason).not.toBeNull();
        expect(reason).toContain('cannot interpret');
    });

    // The guard reads the contract out of the package it is running from. A
    // fixed `..` hop count resolves a different root from every layout but the
    // source tree — and the bundle is one of those layouts.
    it('finds the package root by the contract it carries, not by a hop count', () => {
        const here = path.resolve(__dirname, '..', '..', '..', 'src', 'scripts', 'hooks', 'x.ts');
        const root = findPackageRoot(here);
        expect(root).not.toBeNull();
        expect(fs.existsSync(path.join(root as string, 'docs', 'contracts', 'settings-classes.md'))).toBe(true);
    });

    it('returns null rather than a default root when no ancestor carries the contract', () => {
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'no-contract-'));
        try {
            expect(findPackageRoot(path.join(empty, 'a', 'b', 'c.ts'))).toBeNull();
        } finally {
            fs.rmSync(empty, { recursive: true, force: true });
        }
    });

    // Packaging regression: the fence is only reachable in a consumer install
    // while the contract ships. Dropping it from `files[]` would leave the
    // guard permanently fail-closed there — refusing every settings edit.
    it('ships the class contract, so a consumer install can read it', () => {
        const pkgPath = path.resolve(__dirname, '..', '..', '..', 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { files: string[] };
        expect(pkg.files).toContain('docs/contracts/settings-classes.md');
    });
});

// Characterization of the settings parser, written BEFORE the dispatch path was
// moved off `js-yaml` onto the `yaml` package the bundle already carried
// (`road-to-a-hook-bundle-with-one-yaml-reader` 1.2). Every assertion below is a
// READING of the behaviour the guard had under `js-yaml`, taken while it still
// ran under `js-yaml` — so a swap that changes any of them is a behaviour change
// wearing a dependency change's clothes, which is Risk 1 of that roadmap made
// mechanical rather than argued.
describe('block_config_weakening — parseSettingsDoc, pinned across the parser swap', () => {
    // YAML 1.1 resolved `on` / `yes` / `off` / `no` to booleans; YAML 1.2 core
    // leaves them strings. Both readers implement 1.2 here, so a class-C key
    // written `on` is the STRING "on" under either. Pinned because the opposite
    // would silently change what `changedKeys` reports as changed.
    it('reads YAML 1.1 boolean words as 1.2 strings', () => {
        for (const word of ['on', 'yes', 'off', 'no', 'On', 'YES']) {
            expect(parseSettingsDoc(`k: ${word}\n`, '.agent-settings.yml')).toEqual({ k: word });
        }
    });

    it('still reads real booleans as booleans', () => {
        expect(parseSettingsDoc('k: true\n', '.agent-settings.yml')).toEqual({ k: true });
        expect(parseSettingsDoc('k: false\n', '.agent-settings.yml')).toEqual({ k: false });
    });

    // The fail-closed half. `null` from this function is NOT "no keys" — the
    // caller treats it as an unreadable corpus and refuses. An emptied settings
    // file must land there, never on "parsed fine, nothing changed". `js-yaml`
    // threw on an empty document and the `yaml` package returns `null` for one,
    // so this is the single place the two readers genuinely differ and the one
    // the port has to normalise.
    it('treats an empty or value-less document as unparseable, not as an empty settings doc', () => {
        for (const text of ['', '   \n', '~\n', 'null\n']) {
            expect(parseSettingsDoc(text, '.agent-settings.yml')).toBeNull();
        }
    });

    it('returns null for a document that does not parse at all', () => {
        expect(parseSettingsDoc('a: [unclosed\n', '.agent-settings.yml')).toBeNull();
        expect(parseSettingsDoc('a: 1\na: 2\n', '.agent-settings.yml')).toBeNull();
    });

    it('still reads JSON settings through JSON.parse, not the YAML reader', () => {
        expect(parseSettingsDoc('{"a": {"b": 1}}', 'settings.json')).toEqual({ a: { b: 1 } });
        expect(parseSettingsDoc('{a: 1}', 'settings.json')).toBeNull();
    });

    // End-to-end through the guard, on a real class-C key: flipping between two
    // YAML 1.1 boolean words is still a refusal, under either reader.
    it('sees a class C key flip between two 1.1 boolean words', () => {
        const REAL = path.resolve(__dirname, '..', '..', '..', 'docs', 'contracts', 'settings-classes.md');
        const idx = buildSettingsClassIndex(parseSettingsClassRows(fs.readFileSync(REAL, 'utf-8')));
        const cKey = [...idx.entries()].find(([, cls]) => cls === 'C')?.[0];
        expect(cKey).toBeDefined();
        const segments = (cKey as string).split('.');
        const before =
            segments
                .map((seg, i) => (i === segments.length - 1 ? `${'  '.repeat(i)}${seg}: off` : `${'  '.repeat(i)}${seg}:`))
                .join('\n') + '\n';
        const reason = classCVerdict(
            { old_string: ': off', new_string: ': on' },
            before,
            '.agent-settings.yml',
            idx,
        );
        expect(reason).not.toBeNull();
        expect(reason).toContain(cKey as string);
    });
});
