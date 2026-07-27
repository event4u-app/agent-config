import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sga from '../../src/scripts/sync_gitattributes.js';

const TEMPLATE_CONTENT = `# Agent memory — merge-safety attributes.
agents/memory/intake/*.jsonl merge=union eol=lf
agents/memory/historical-patterns.yml merge=union text eol=lf
agents/memory/historical-patterns/*.yml text eol=lf
`;

let tmp: string;
let template: string;
let gitattributes: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgattr-'));
    template = path.join(tmp, '.gitattributes.fragment');
    fs.writeFileSync(template, TEMPLATE_CONTENT, 'utf-8');
    gitattributes = path.join(tmp, '.gitattributes');
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
});

interface RunResult {
    rc: number;
    out: string;
    err: string;
}
class _Exit extends Error {
    constructor(public code: number) {
        super(`exit ${code}`);
    }
}
function runMain(args: string[]): RunResult {
    let out = '';
    let err = '';
    const so = vi.spyOn(process.stdout, 'write').mockImplementation((c: any) => {
        out += typeof c === 'string' ? c : c.toString('utf-8');
        return true;
    });
    const se = vi.spyOn(process.stderr, 'write').mockImplementation((c: any) => {
        err += typeof c === 'string' ? c : c.toString('utf-8');
        return true;
    });
    const ex = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new _Exit(code ?? 0);
    }) as never);
    let rc: number;
    try {
        rc = sga.main(args);
    } catch (e) {
        if (e instanceof _Exit) {
            rc = e.code;
        } else {
            so.mockRestore();
            se.mockRestore();
            ex.mockRestore();
            throw e;
        }
    }
    so.mockRestore();
    se.mockRestore();
    ex.mockRestore();
    return { rc, out, err };
}

describe('sync_gitattributes', () => {
    it('appends a fresh managed block when .gitattributes is missing', () => {
        const res = runMain(['--path', gitattributes, '--template', template]);
        expect(res.rc).toBe(0);
        const text = fs.readFileSync(gitattributes, 'utf-8');
        expect(text).toContain(sga.SECTION_HEADER);
        expect(text).toContain(sga.SECTION_FOOTER);
        expect(text).toContain('agents/memory/intake/*.jsonl merge=union eol=lf');
    });

    it('is idempotent — running twice produces byte-identical output', () => {
        runMain(['--path', gitattributes, '--template', template]);
        const first = fs.readFileSync(gitattributes, 'utf-8');

        const res2 = runMain(['--path', gitattributes, '--template', template]);
        const second = fs.readFileSync(gitattributes, 'utf-8');

        expect(res2.rc).toBe(0);
        expect(second).toBe(first);
    });

    it('never touches unrelated pre-existing lines', () => {
        fs.writeFileSync(
            gitattributes,
            '# Authoring + dev tooling\n/agents export-ignore\n',
            'utf-8',
        );
        runMain(['--path', gitattributes, '--template', template]);
        const text = fs.readFileSync(gitattributes, 'utf-8');
        expect(text).toContain('/agents export-ignore');
        expect(text).toContain(sga.SECTION_HEADER);
    });

    it('appends only the missing managed lines when the block already has some entries', () => {
        const partialBlock = [
            sga.SECTION_HEADER,
            'agents/memory/intake/*.jsonl merge=union eol=lf',
            sga.SECTION_FOOTER,
            '',
        ].join('\n');
        fs.writeFileSync(gitattributes, partialBlock, 'utf-8');

        const res = runMain(['--path', gitattributes, '--template', template]);
        expect(res.rc).toBe(0);
        const text = fs.readFileSync(gitattributes, 'utf-8');
        expect(text).toContain('agents/memory/historical-patterns.yml merge=union text eol=lf');
        expect(text).toContain('agents/memory/historical-patterns/*.yml text eol=lf');
    });

    it('--check exits 0 when already in sync, without writing', () => {
        runMain(['--path', gitattributes, '--template', template]);
        const before = fs.readFileSync(gitattributes, 'utf-8');

        const res = runMain(['--path', gitattributes, '--template', template, '--check']);
        expect(res.rc).toBe(0);

        const after = fs.readFileSync(gitattributes, 'utf-8');
        expect(after).toBe(before);
    });

    it('--check exits 1 and does not write when entries are missing', () => {
        expect(fs.existsSync(gitattributes)).toBe(false);
        const res = runMain(['--path', gitattributes, '--template', template, '--check']);
        expect(res.rc).toBe(1);
        expect(fs.existsSync(gitattributes)).toBe(false);
    });

    it('exits 2 when the template file is missing', () => {
        const missingTemplate = path.join(tmp, 'does-not-exist.fragment');
        const res = runMain(['--path', gitattributes, '--template', missingTemplate]);
        expect(res.rc).toBe(2);
        expect(res.err).toContain('template not found');
    });
});
