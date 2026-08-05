// Tests for src/scripts/lint_skill_tools.ts.
//
// The gate was reduced and re-pointed on 2026-08-05 (AI council): its corpus is
// `src/scripts/skill_tools/*.ts` (was `*.py`) and it keeps exactly three pure
// regex checks — snake_case_verb_noun naming, a registered `--json` flag, and an
// embedded `_SAMPLE` constant or CLI-entry guard. The 200-LOC size cap, the
// `argparse` import check, the `add_help=False` check, and the stdlib-only
// import scan are gone, so nothing here tests them; the former python3-gated
// golden-parity layer is gone with the Python original.
//
// Every fixture is a TypeScript tool source written into a temp dir, and every
// expectation is derived from the fixture that produced it — no assertion here
// depends on the real `src/scripts/skill_tools/` corpus or its size.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as st from '../../src/scripts/lint_skill_tools.js';

// --- fixtures ---------------------------------------------------------------
//
// Built by joining lines so the tool sources need no escaping, and derived from
// one another by targeted replacement so each variant differs in exactly the
// invariant it is meant to break.

/** Satisfies all three surviving invariants: naming (by filename), `--json`, `_SAMPLE`. */
const VALID = [
    '#!/usr/bin/env tsx',
    '/** Sample tool that obeys the three surviving D1 invariants. */',
    "import * as YAML from 'yaml';",
    '',
    "const _SAMPLE = { hello: 'world' };",
    '',
    'export function main(argv: readonly string[]): number {',
    "    if (argv.includes('--json')) {",
    '        process.stdout.write(YAML.stringify(_SAMPLE));',
    '    }',
    '    return 0;',
    '}',
    '',
].join('\n');

/** No `--json` anywhere — breaks the CLI check only. */
const NO_JSON = VALID.replace("argv.includes('--json')", 'argv.length > 0');

/** No `_SAMPLE` and no `import.meta.url` — breaks the sample check only. */
const NO_SAMPLE = VALID.replace(
    "const _SAMPLE = { hello: 'world' };",
    "const payload = { hello: 'world' };",
).replace('YAML.stringify(_SAMPLE)', 'YAML.stringify(payload)');

/** No `_SAMPLE`, but carries the CLI-entry guard the sample check also accepts. */
const ENTRY_GUARD_ONLY = [
    NO_SAMPLE,
    'if (import.meta.url === pathToFileURL(process.argv[1]).href) {',
    '    process.exit(main(process.argv.slice(2)));',
    '}',
    '',
].join('\n');

/** Breaks both text checks at once (naming depends on the filename it is written to). */
const NO_JSON_NO_SAMPLE = NO_SAMPLE.replace("argv.includes('--json')", 'argv.length > 0');

/** The leading token of each violation string — `naming` / `cli` / `sample`. */
function kinds(viols: readonly string[]): string[] {
    return viols.map((v) => v.split(':')[0]!).sort();
}

function only(findings: Record<string, string[]>): string[] {
    const keys = Object.keys(findings);
    expect(keys).toHaveLength(1);
    return findings[keys[0]!]!;
}

describe('lint_skill_tools — exported constants', () => {
    it('TOOLS_DIR points at the .ts tool package under ROOT', () => {
        expect(path.relative(st.ROOT, st.TOOLS_DIR).split(path.sep)).toEqual([
            'src',
            'scripts',
            'skill_tools',
        ]);
    });

    it('NAME_RE accepts snake_case_verb_noun.ts and rejects the near misses', () => {
        expect(st.NAME_RE.test('do_thing.ts')).toBe(true);
        expect(st.NAME_RE.test('score_skill_relevance.ts')).toBe(true);
        expect(st.NAME_RE.test('lonely.ts')).toBe(false);
        expect(st.NAME_RE.test('Do-Thing.ts')).toBe(false);
        expect(st.NAME_RE.test('do_thing.py')).toBe(false);
    });
});

describe('lint_skill_tools.lint', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lst-'));
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function write(name: string, body: string): string {
        const p = path.join(tmp, name);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, body, 'utf-8');
        return p;
    }

    it('a clean tool passes', () => {
        write('do_thing.ts', VALID);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(0);
        expect(findings).toEqual({});
    });

    it('a CLI-entry guard satisfies the sample check without a _SAMPLE constant', () => {
        expect(ENTRY_GUARD_ONLY).not.toContain('_SAMPLE');
        write('do_thing.ts', ENTRY_GUARD_ONLY);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(0);
        expect(findings).toEqual({});
    });

    it('a non-snake_case filename fails on naming alone', () => {
        write('Do-Thing.ts', VALID);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(1);
        expect(kinds(only(findings))).toEqual(['naming']);
        expect(only(findings)[0]).toContain('Do-Thing.ts');
    });

    it('a filename with no underscore fails on naming alone', () => {
        write('lonely.ts', VALID);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(1);
        expect(kinds(only(findings))).toEqual(['naming']);
    });

    it('a missing --json flag fails on the CLI check alone', () => {
        expect(NO_JSON).not.toContain('--json');
        write('do_thing.ts', NO_JSON);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(1);
        expect(kinds(only(findings))).toEqual(['cli']);
        expect(only(findings)[0]).toContain('--json');
    });

    it('no _SAMPLE and no entry guard fails on the sample check alone', () => {
        expect(NO_SAMPLE).not.toContain('_SAMPLE');
        expect(NO_SAMPLE).not.toContain('import.meta.url');
        write('do_thing.ts', NO_SAMPLE);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(1);
        expect(kinds(only(findings))).toEqual(['sample']);
        expect(only(findings)[0]).toContain('_SAMPLE');
    });

    it('all three checks report together on one file', () => {
        write('Bad-Name.ts', NO_JSON_NO_SAMPLE);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(1);
        expect(kinds(only(findings))).toEqual(['cli', 'naming', 'sample']);
    });

    it('index.ts is skipped — it is the package marker, not a tool', () => {
        // Would trip naming-free but both text checks if it were treated as a tool.
        write('index.ts', "export * from './do_thing.js';\n");
        write('do_thing.ts', VALID);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(0);
        expect(findings).toEqual({});
    });

    it('.d.ts and .test.ts siblings are not tools', () => {
        write('Bad-Name.d.ts', 'export declare const x: number;\n');
        write('Bad-Name.test.ts', 'export const y = 1;\n');
        write('do_thing.ts', VALID);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(0);
        expect(findings).toEqual({});
    });

    it('a directory whose name ends in .ts is not a tool', () => {
        fs.mkdirSync(path.join(tmp, 'Not-A-Tool.ts'));
        write('do_thing.ts', VALID);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(0);
        expect(findings).toEqual({});
    });

    it('violations from several tools aggregate, keyed by the offending file', () => {
        // Fixtures live outside ROOT, so the key is the absolute path (inside the
        // repo the gate keys findings by the POSIX path relative to ROOT).
        const noJson = write('do_thing.ts', NO_JSON);
        const badName = write('Bad-Name.ts', VALID);
        write('do_other.ts', VALID);

        const [code, findings] = st.lint(tmp);
        expect(code).toBe(1);
        expect(Object.keys(findings).sort()).toEqual([noJson, badName].sort());
        expect(kinds(findings[noJson]!)).toEqual(['cli']);
        expect(kinds(findings[badName]!)).toEqual(['naming']);
    });

    it('a missing tools dir returns the usage code with an _error finding', () => {
        const missing = path.join(tmp, 'nope');
        const [code, findings] = st.lint(missing);
        expect(code).toBe(2);
        expect(Object.keys(findings)).toEqual(['_error']);
        expect(findings['_error']![0]).toContain(missing);
    });
});

describe('lint_skill_tools.main', () => {
    let tmp: string;
    let stdoutSpy: { mockRestore: () => void };
    let stderrSpy: { mockRestore: () => void };

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lst-main-'));
        stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('returns 0 on a clean corpus', () => {
        fs.writeFileSync(path.join(tmp, 'do_thing.ts'), VALID, 'utf-8');
        expect(st.main(['--tools-dir', tmp, '--quiet'])).toBe(0);
        expect(st.lintedCount()).toBe(1);
    });

    it('returns 1 on a genuine violation', () => {
        fs.writeFileSync(path.join(tmp, 'do_thing.ts'), NO_JSON, 'utf-8');
        expect(st.main(['--tools-dir', tmp, '--quiet'])).toBe(1);
    });

    it('returns 2 on a dead scan scope — an empty tools dir is blindness, not success', () => {
        expect(st.main(['--tools-dir', tmp, '--quiet'])).toBe(2);
        expect(st.lintedCount()).toBe(0);
    });

    it('returns 2 when only the package marker is present — index.ts is not a scanned tool', () => {
        fs.writeFileSync(path.join(tmp, 'index.ts'), 'export {};\n', 'utf-8');
        expect(st.main(['--tools-dir', tmp, '--quiet'])).toBe(2);
        expect(st.lintedCount()).toBe(0);
    });
});
