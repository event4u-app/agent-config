/**
 * An ignored file is not a pass
 * (`road-to-touched-file-quality-that-says-when-it-did-not-look` Phase 1).
 *
 * The readings page § 5(a) found the defect with a probe: ESLint exits 0 over a
 * file its own config ignores, prints that it ignored it, and the record came out
 * `exit_code: 0, skipped: null` — the exact shape of a passing check. The spawn is
 * injected and returns the line real ESLint prints, verbatim, so the fixture pins
 * the signal the module has to read.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    advisoryLine,
    runTouchedFileQuality,
} from '../../src/scripts/_lib/touched_file_quality.js';

/** What ESLint 9 prints for an input its config ignores, exit status 0. */
const IGNORED_LINE =
    '  0:0  warning  File ignored because of a matching ignore pattern. Use "--no-ignore" to disable file ignore settings or use "--no-warn-ignored" to suppress this warning';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'tfq-ignored-'));
    // The fixture's OWN config ignores `generated/**` — the file below sits there.
    fs.writeFileSync(
        path.join(root, 'eslint.config.js'),
        "export default [{ ignores: ['generated/**'] }];\n",
    );
    fs.mkdirSync(path.join(root, 'generated'), { recursive: true });
    fs.writeFileSync(path.join(root, 'generated', 'out.ts'), 'export const x = 1;\n');
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'kept.ts'), 'export const y = 2;\n');
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

/** ESLint's stylish report: the absolute path, then the indented message. */
function stylishIgnored(files: readonly string[]): string {
    const blocks = files.map((f) => `${path.join(root, f)}\n${IGNORED_LINE}\n`);
    return `\n${blocks.join('\n')}\n✖ ${String(files.length)} problem (0 errors, ${String(files.length)} warning)\n`;
}

function runEslint(files: readonly string[], ignored: readonly string[]) {
    const [row] = runTouchedFileQuality({
        root,
        commands: ['npx eslint .'],
        files,
        spawn: () => ({ status: 0, output: stylishIgnored(ignored), enoent: false }),
    });
    if (row === undefined) throw new Error('no row');
    return row;
}

describe('1.1 — every matched file ignored is a verdict about nothing', () => {
    it('is not recorded in the shape of a pass', () => {
        const row = runEslint(['generated/out.ts'], ['generated/out.ts']);
        expect(row.exit_code === 0 && row.skipped === null).toBe(false);
    });

    it('records exit_code null and lists the ignored file', () => {
        const row = runEslint(['generated/out.ts'], ['generated/out.ts']);
        expect(row.exit_code).toBeNull();
        expect(row.ignored_files).toEqual(['generated/out.ts']);
    });
});

describe('1.2 — some matched files ignored keeps the verdict', () => {
    it('keeps the exit code and lists the ignored file beside it', () => {
        const row = runEslint(['generated/out.ts', 'src/kept.ts'], ['generated/out.ts']);
        expect(row.exit_code).toBe(0);
        expect(row.skipped).toBeNull();
        expect(row.ignored_files).toEqual(['generated/out.ts']);
    });

    it('an output without the signal ignores nothing', () => {
        const [row] = runTouchedFileQuality({
            root,
            commands: ['npx eslint .'],
            files: ['src/kept.ts'],
            spawn: () => ({ status: 0, output: '', enoent: false }),
        });
        expect(row?.exit_code).toBe(0);
        expect(row?.ignored_files).toEqual([]);
    });

    it('a row with no ignored-file signal carries an empty list', () => {
        const [row] = runTouchedFileQuality({
            root,
            commands: ['ruff check'],
            files: ['a.py'],
            spawn: () => ({ status: 0, output: IGNORED_LINE, enoent: false }),
        });
        // ruff's spec names no signal, so ESLint's wording means nothing to it.
        expect(row?.exit_code).toBe(0);
        expect(row?.ignored_files).toEqual([]);
    });
});

describe('1.3 — the advisory line names ignored files apart from verdicts', () => {
    it('an all-ignored stop emits a line that does not read as clean', () => {
        const row = runEslint(['generated/out.ts'], ['generated/out.ts']);
        const line = advisoryLine([row]);
        expect(line).not.toBeNull();
        expect(line).toContain('ignored');
        expect(line).toContain('generated/out.ts');
        expect(line).not.toMatch(/exited 0/);
    });

    it('a red names the ignored files after the verdict', () => {
        const [row] = runTouchedFileQuality({
            root,
            commands: ['npx eslint .'],
            files: ['generated/out.ts', 'src/kept.ts'],
            spawn: () => ({
                status: 1,
                output: stylishIgnored(['generated/out.ts']),
                enoent: false,
            }),
        });
        const line = advisoryLine(row === undefined ? [] : [row]) ?? '';
        expect(line).toMatch(/exited 1/);
        expect(line.indexOf('exited 1')).toBeLessThan(line.indexOf('ignored'));
    });

    it('a clean stop with nothing ignored still emits nothing', () => {
        const row = runEslint(['src/kept.ts'], []);
        expect(advisoryLine([row])).toBeNull();
    });
});
