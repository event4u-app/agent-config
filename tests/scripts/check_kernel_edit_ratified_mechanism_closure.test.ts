import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as gate from '../../src/scripts/check_kernel_edit_ratified.js';
import {
    classifyPaths,
    MECHANISM_IMPORT_PATHS,
    READER_PATH,
    requiresRatification,
    SELF_PATH,
} from '../../src/scripts/check_kernel_edit_ratified.js';
import { relativeSpecifiers } from '../../src/scripts/_lib/dispatch_import_closure.js';
import { gatedFilesOf } from '../../src/scripts/_lib/ratification_subject.js';
import { commitAll } from './ratification_git_fixture.js';

/**
 * The gate's verdict runs through the modules it imports: the record parser,
 * the ledger and the scan report. An edit to one is an edit to the gate.
 */

const IMPORTED = [
    'src/scripts/_lib/adr_frontmatter.ts',
    'src/scripts/_lib/gate_ledger.ts',
    'src/scripts/_lib/scan_scope.ts',
];

/**
 * The one module of the closure not gated yet. It is edited in the change that
 * routes its digest through `isMechanismPath`, and a change that gates a file
 * while editing it is digested differently by the base gate and its own, so it
 * joins in the next change, which removes it from here.
 */
const PENDING = ['src/scripts/_lib/ratification_subject.ts'];

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Repo-relative paths of every module reachable from the gate by relative static imports. */
function gateImportClosure(): string[] {
    const seen = new Set<string>();
    const queue = [SELF_PATH];
    while (queue.length > 0) {
        const rel = queue.shift() as string;
        if (seen.has(rel)) continue;
        seen.add(rel);
        const source = fs.readFileSync(path.join(REPO, rel), 'utf8');
        const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
        expect(code, `${rel} uses a dynamic import the walk cannot follow`).not.toMatch(/\bimport\s*\(/);
        for (const spec of relativeSpecifiers(source)) {
            const target = path.posix.normalize(
                path.posix.join(path.posix.dirname(rel), spec).replace(/\.js$/, '.ts'),
            );
            expect(fs.existsSync(path.join(REPO, target)), `${rel} imports ${spec}`).toBe(true);
            queue.push(target);
        }
    }
    return [...seen].sort();
}

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ker-mech-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('the gate watches the modules its verdict runs through', () => {
    it('each imported module requires a ratification record', () => {
        for (const p of IMPORTED) {
            expect(MECHANISM_IMPORT_PATHS, p).toContain(p);
            expect(classifyPaths([p], []).self, p).toBe(true);
            expect(requiresRatification(classifyPaths([p], [])), p).toBe(true);
        }
    });

    it('every module the gate imports is gated and digested, except the named pending one', () => {
        const closure = gateImportClosure();
        expect(closure).toContain(READER_PATH);
        for (const p of IMPORTED) expect(closure, p).toContain(p);
        const ungated = closure.filter((m) => !requiresRatification(classifyPaths([m], [])));
        expect(ungated).toEqual(PENDING);
        for (const m of closure.filter((x) => !PENDING.includes(x))) {
            expect(gatedFilesOf([m], []), m).toEqual([m]);
        }
    });

    it('refuses an unratified edit of the record parser end to end', () => {
        const rel = 'src/scripts/_lib/adr_frontmatter.ts';
        fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), 'export const x = 1;\n');
        commitAll(root);
        const r = gate.evaluate([rel], root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('no ratification artifact');
    });

    it('the digest covers every mechanism file the gate classifies', () => {
        for (const p of [...IMPORTED, READER_PATH]) {
            expect(gatedFilesOf([p, 'README.md'], []), p).toEqual([p]);
        }
    });

    it('the writer CLIs and the contract stay ungated', () => {
        for (const p of [
            'src/scripts/ratification_subject.ts',
            'src/scripts/ratification_header.ts',
            'docs/contracts/ratification-artifact.md',
        ]) {
            expect(requiresRatification(classifyPaths([p], [])), p).toBe(false);
            expect(gatedFilesOf([p], []), p).toEqual([]);
        }
    });

    it('the ledger counts a gated mechanism file as gated, not out of scope', () => {
        fs.writeFileSync(path.join(root, 'README.md'), 'x\n');
        commitAll(root);
        for (const p of [READER_PATH, 'src/scripts/_lib/gate_ledger.ts']) {
            const r = gate.evaluate([p, 'README.md'], root, 2);
            expect(r.exitCode, p).toBe(1);
            expect(r.lines.join('\n'), p).toContain('planned 2 · completed 0 · failed 1 · out_of_scope 1');
        }
    });
});
