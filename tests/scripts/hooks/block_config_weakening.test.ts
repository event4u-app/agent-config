// Tests for src/scripts/hooks/block_config_weakening.ts.
//
// House pattern (mirrors block_kernel_rule_writes.test.ts): the decision lives
// in exported pure functions and is tested directly; `main()` is thin wiring
// over them. The one impure piece — the per-session counter — is exercised
// against a temp root so no repo state is touched.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { load as jsYamlLoad } from 'js-yaml';
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
        expect(classify_target('.git-convention.yml')).toBe('class-c');
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
        const before = 'personal:\n  rtk_installed: false\n  ide: code\n';
        expect(
            classCVerdict(
                { old_string: 'rtk_installed: false', new_string: 'rtk_installed: true' },
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
            { old_string: 'rtk_installed: false', new_string: 'rtk_installed: true' },
            'personal:\n  rtk_installed: false\n',
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

    // The host creates a missing file from an Edit whose old_string is empty, so
    // a missing file is empty text, not a reason to stop checking.
    it('checks an Edit or MultiEdit that creates the carrier', () => {
        const create = { old_string: '', new_string: 'git:\n  update_strategy: rebase\n' };
        expect(classCVerdict(create, null, '.git-convention.yml', index)).toContain('git.update_strategy');
        expect(classCVerdict({ edits: [create] }, null, '.git-convention.yml', index)).toContain('git.update_strategy');
        expect(classCVerdict({ ...create, replace_all: true }, null, '.git-convention.yml', index)).toContain('git.update_strategy');
    });

    it('allows creating a settings file that sets only Class A keys', () => {
        const create = { old_string: '', new_string: 'personal:\n  rtk_installed: true\n' };
        expect(classCVerdict(create, null, '.agent-settings.yml', index)).toBeNull();
        expect(classCVerdict({ edits: [create] }, null, '.agent-settings.yml', index)).toBeNull();
    });

    it('allows when the edit would not apply at all', () => {
        expect(
            classCVerdict(
                { old_string: 'not present anywhere', new_string: 'x' },
                'personal:\n  rtk_installed: false\n',
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
            '  rtk_installed: false',
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

    // MultiEdit carries its replacement pairs under `edits`, applied in order;
    // reading only the top-level pair let every MultiEdit through.
    it('models MultiEdit — a Class C change in any of the edits is caught', () => {
        const before = [
            'personal:',
            '  rtk_installed: false',
            'hooks:',
            '  injection_scan:',
            '    enabled: false',
            '',
        ].join('\n');
        const ti = {
            file_path: '.agent-settings.yml',
            edits: [
                { old_string: 'rtk_installed: false', new_string: 'rtk_installed: true' },
                { old_string: '    enabled: false', new_string: '    enabled: true' },
            ],
        };
        const reason = classCVerdict(ti, before, '.agent-settings.yml', index);
        expect(reason).not.toBeNull();
        expect(reason).toContain('hooks.injection_scan.enabled');
        expect(
            classCVerdict({ edits: [{ old_string: 'rtk_installed: false', new_string: 'rtk_installed: true' }] }, before, '.agent-settings.yml', index),
        ).toBeNull();
    });

    // The host applies a MultiEdit atomically: when any pair misses, it writes
    // none of them. A Class C change in an earlier pair is then never written,
    // so the guard allows the payload rather than judging a text nobody wrote.
    it('allows a MultiEdit whose Class C edit is followed by one that misses — the host applies none', () => {
        const before = 'hooks:\n  injection_scan:\n    enabled: false\n';
        const clear = { old_string: '  injection_scan:\n    enabled: false\n', new_string: '' };
        expect(classCVerdict({ edits: [clear] }, before, '.agent-settings.yml', index)).toContain('hooks.injection_scan');
        const miss = { old_string: 'no such text in the file', new_string: 'x' };
        expect(classCVerdict({ edits: [clear, miss] }, before, '.agent-settings.yml', index)).toBeNull();
    });

    it('refuses a MultiEdit edits list it cannot interpret', () => {
        const reason = classCVerdict(
            { edits: [{ old_string: 'false' }] } as never,
            'personal:\n  rtk_installed: false\n',
            '.agent-settings.yml',
            index,
        );
        expect(reason).not.toBeNull();
        expect(reason).toContain('cannot interpret');
    });

    // The host writes `new_string` literally; `String.replace` expands `$&`,
    // `$$` and friends, so a guard that simulates with it evaluates a
    // different text from the one written. `$&` re-inserts the match, which
    // made the class C value look unchanged while the host wrote `$&`.
    it('applies new_string literally — replacement tokens do not hide a Class C change', () => {
        const before = 'hooks:\n  injection_scan:\n    enabled: false\n';
        const edit = { old_string: 'false', new_string: '$&' };
        expect(classCVerdict(edit, before, '.agent-settings.yml', index)).toContain('hooks.injection_scan.enabled');
        expect(classCVerdict({ edits: [edit] }, before, '.agent-settings.yml', index)).toContain(
            'hooks.injection_scan.enabled',
        );
    });

    // The guard decides which edit form it models from the payload's fields. A
    // payload carrying two forms at once — a decoy `content` or `old_string`
    // beside `edits` — would be checked as one form while the host runs
    // another, so an ambiguous payload is refused rather than guessed.
    it('refuses a payload that carries more than one edit form', () => {
        const before = 'hooks:\n  injection_scan:\n    enabled: false\n';
        const edits = [{ old_string: '    enabled: false', new_string: '    enabled: true' }];
        for (const decoy of [{ content: before }, { old_string: 'x', new_string: 'x' }]) {
            const reason = classCVerdict({ ...decoy, edits }, before, '.agent-settings.yml', index);
            expect(reason).toContain('more than one edit form');
        }
    });

    it('refuses an edits value that is not a list', () => {
        const reason = classCVerdict(
            { edits: { old_string: 'false', new_string: 'true' } } as never,
            'hooks:\n  injection_scan:\n    enabled: false\n',
            '.agent-settings.yml',
            index,
        );
        expect(reason).toContain('cannot interpret');
    });

    it('refuses a replace_all value it cannot interpret', () => {
        const reason = classCVerdict(
            { old_string: 'false', new_string: 'true', replace_all: 'yes' as unknown as boolean },
            'personal:\n  rtk_installed: false\n',
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

    // The explicit-tag class, which is the one the swap would have WEAKENED. The
    // old reader threw on each of these and the guard refused; the `yaml`
    // package resolves them by default and the guard would have gone on to allow
    // an edit it used to refuse. Found by an independent council review
    // (openai/codex-default, 2026-10-01) and closed by `resolveKnownTags: false`
    // plus treating a warning as a refusal.
    it('refuses a document carrying an explicit YAML 1.1 tag, as the old reader did', () => {
        for (const text of [
            'k: !!timestamp 2026-10-01\n',
            'k: !!binary aGk=\n',
            'k: !!set\n  ? a\n  ? b\n',
            'k: !!omap\n  - a: 1\n',
            'k: !!pairs\n  - a: 1\n',
            'k: !custom 1\n',
        ]) {
            expect(parseSettingsDoc(text, '.agent-settings.yml'), text).toBeNull();
        }
    });

    // …and the near-miss in the other direction: the CORE tags both readers
    // carry must still parse, or the constraint above would be a refuse-anything
    // gate wearing an equivalence test's name.
    it('still reads the core tags both readers carry', () => {
        expect(parseSettingsDoc('k: !!str 1\n', '.agent-settings.yml')).toEqual({ k: '1' });
        expect(parseSettingsDoc('k: !!int 3\n', '.agent-settings.yml')).toEqual({ k: 3 });
        expect(parseSettingsDoc('k: !!bool true\n', '.agent-settings.yml')).toEqual({ k: true });
        expect(parseSettingsDoc('k: !!seq [1]\n', '.agent-settings.yml')).toEqual({ k: [1] });
    });

    // A merge key was raised as a difference by one seat and is not one at these
    // versions. Pinned so the question is settled by a reading rather than
    // re-litigated from documentation.
    it('leaves a merge key literal, which is what the old reader did too', () => {
        expect(parseSettingsDoc('d: &d\n  p: false\npersonal:\n  <<: *d\n', '.agent-settings.yml')).toEqual({
            d: { p: false },
            personal: { '<<': { p: false } },
        });
    });

    // The second review round's follow-up: `yaml` documents `merge` as
    // defaulting to the document's YAML VERSION, so a `%YAML 1.1` directive was
    // proposed as a route past the schema pin. It is not one here — measured —
    // and `merge: false` is set explicitly so a future default cannot make it
    // one silently. This asserts the measurement, not the option.
    it('leaves a merge key literal even under a %YAML 1.1 directive', () => {
        expect(
            parseSettingsDoc('%YAML 1.1\n---\nd: &d\n  p: false\npersonal:\n  <<: *d\n', '.agent-settings.yml'),
        ).toEqual({ d: { p: false }, personal: { '<<': { p: false } } });
    });

    it('a version directive does not reopen the 1.1 scalar or tag resolutions', () => {
        expect(parseSettingsDoc('%YAML 1.1\n---\nk: on\n', '.agent-settings.yml')).toEqual({ k: 'on' });
        expect(parseSettingsDoc('%YAML 1.1\n---\nk: !!timestamp 2026-10-01\n', '.agent-settings.yml')).toBeNull();
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

// The differential suite the council asked for: BOTH readers, ONE corpus, the
// same refusal set asserted — not a reading of either one alone. It exists
// because an independent review (2026-10-01, anthropic + openai seats) refused
// the swap on the grounds that characterizing the OLD reader proves the old
// behaviour and not that the new one matches it. That objection was correct and
// found a real hole (explicit YAML 1.1 tags); this is the evidence it asked for.
//
// `js-yaml` is still a package dependency — ≈30 modules outside the hook bundle
// import it — so the old reader is importable here and this is a measurement
// rather than a transcription of what it used to do. The day that stops being
// true this suite stops compiling, which is the correct failure: an equivalence
// claim whose other side is gone is not an equivalence claim.
describe('block_config_weakening — differential: the two readers refuse the same set', () => {
    /** What the guard did BEFORE the swap: `js-yaml.load`, nullish collapsed to null. */
    function oldReader(text: string): unknown | null {
        try {
            return (jsYamlLoad(text) as unknown) ?? null;
        } catch {
            return null;
        }
    }

    const CORPUS: readonly string[] = [
        // explicit tags — the class that would have weakened the guard
        'k: !!timestamp 2026-10-01\n', 'k: !!binary aGk=\n', 'k: !!set\n  ? a\n  ? b\n',
        'k: !!omap\n  - a: 1\n', 'k: !!pairs\n  - a: 1\n', 'k: !custom 1\n',
        // core tags both readers carry
        'k: !!str 1\n', 'k: !!int 3\n', 'k: !!float 1.5\n', 'k: !!bool true\n',
        'k: !!null ~\n', 'k: !!map {a: 1}\n', 'k: !!seq [1]\n',
        // YAML 1.1 scalar words and number forms
        'k: on\n', 'k: yes\n', 'k: off\n', 'k: no\n', 'k: On\n', 'k: YES\n',
        'k: true\n', 'k: false\n', 'k: .inf\n', 'k: .nan\n', 'k: 1_000\n',
        'k: 0b101\n', 'k: 0o17\n', 'k: 012\n', 'k: 2026-10-01\n', 'k: 12:30\n',
        // emptiness and absent values — the fail-closed path
        '', '   \n', '~\n', 'null\n', 'k:\n', 'k: ~\n',
        // malformed and multi-document
        'a: 1\na: 2\n', '---\na: 1\n---\nb: 2\n', '\ttab: 1\n', 'a: [unclosed\n',
        // anchors, aliases, merge keys — including under an explicit version
        // directive, which `yaml` documents as the thing `merge` defaults off
        // and the second review round named as the way past the schema pin
        'a: &x 1\nb: *x\n', 'd: &d\n  p: false\npersonal:\n  <<: *d\n',
        '%YAML 1.1\n---\nd: &d\n  p: false\npersonal:\n  <<: *d\n',
        '%YAML 1.1\n---\nk: on\nj: 012\n',
        '%YAML 1.2\n---\nk: on\n',
        '%YAML 1.1\n---\nk: !!timestamp 2026-10-01\n',
        // scalars and nesting that must keep working
        'k: "q"\n', "k: 'q'\n", 'k: |\n  block\n', 'k: >\n  folded\n',
        'a:\n  b:\n    c: 1\n', 'a:\n  - 1\n  - 2\n',
        // a realistic settings shape
        'personal:\n  rtk_installed: false\nhooks:\n  injection_scan:\n    enabled: false\n',
    ];

    it('agrees with the old reader on every entry of the corpus', () => {
        const disagreements: string[] = [];
        for (const text of CORPUS) {
            const before = JSON.stringify(oldReader(text));
            const after = JSON.stringify(parseSettingsDoc(text, '.agent-settings.yml'));
            if (before !== after) disagreements.push(`${JSON.stringify(text)}: ${before} -> ${after}`);
        }
        expect(disagreements).toEqual([]);
    });

    // The corpus must contain both outcomes, or an all-refused or all-parsed
    // corpus would pass the comparison while proving nothing.
    it('the corpus exercises both outcomes, so the agreement is not vacuous', () => {
        const refused = CORPUS.filter((t) => parseSettingsDoc(t, '.agent-settings.yml') === null);
        expect(refused.length).toBeGreaterThan(8);
        expect(CORPUS.length - refused.length).toBeGreaterThan(20);
    });
});
