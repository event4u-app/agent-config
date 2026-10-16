/**
 * `brand:status` — the probe from `road-to-capability-answerability` 2.4.
 *
 * Two properties matter and both are asserted. The probe must search the SAME
 * paths the real resolver searches — a probe with its own copy of the list is a
 * second answer waiting to disagree — and it must distinguish "no brand" from
 * "a brand file nothing can read", because those need opposite actions.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    findBrandTokens,
    findDottedNearMisses,
    parseArgv,
    runBrandStatus,
} from '../../src/scripts/_cli/cmd_brand_status.js';
import { BRAND_TOKEN_PATHS } from '../../src/agent-src/templates/scripts/work_engine/directives/ui/scaffold.js';

function scratch(): string {
    return mkdtempSync(join(tmpdir(), 'brand-status-'));
}

const VALID_DTCG = JSON.stringify({ color: { brand: { $type: 'color', $value: '#0055ff' } } });

function writeAt(root: string, rel: string, body: string = VALID_DTCG): void {
    mkdirSync(join(root, dirname(rel)), { recursive: true });
    writeFileSync(join(root, rel), body, 'utf-8');
}

describe('brand:status argv', () => {
    it('accepts nothing and --json only', () => {
        expect(parseArgv([]).ok).toBe(true);
        expect(parseArgv(['--json'])).toMatchObject({ ok: true, json: true });
        expect(parseArgv(['x']).ok).toBe(false);
    });
});

describe('brand token discovery', () => {
    it('finds a tokens file at every canonical path the resolver searches', () => {
        // Iterating BRAND_TOKEN_PATHS rather than naming paths keeps this test
        // correct when the resolver's list changes — which is the same reason
        // the probe imports the list instead of copying it.
        for (const rel of BRAND_TOKEN_PATHS) {
            const root = scratch();
            writeAt(root, rel);
            expect(findBrandTokens(root)).toBe(rel);
        }
    });

    it('returns null when no canonical path holds a file', () => {
        expect(findBrandTokens(scratch())).toBeNull();
    });

    it('honours the resolver precedence: first hit wins', () => {
        const root = scratch();
        const [first, second] = BRAND_TOKEN_PATHS;
        writeAt(root, second as string);
        writeAt(root, first as string);
        expect(findBrandTokens(root)).toBe(first);
    });
});

describe('dot-prefixed near-misses', () => {
    it('reports a .tokens.json that the resolver can never find', () => {
        const root = scratch();
        writeAt(root, '.tokens.json');

        expect(findBrandTokens(root)).toBeNull();
        expect(findDottedNearMisses(root)).toContain('.tokens.json');

        const text = runBrandStatus({ cwd: root, json: false }).out.join('\n');
        // The two facts must not collapse into one: no brand layer AND a file
        // that looks authored. Reporting only the first sends the user to
        // create a second file; reporting only the second hides the real state.
        expect(text).toContain('brand layer   none');
        expect(text).toContain('is NOT read by anything');
    });

    it('stays quiet when there is no near-miss', () => {
        const root = scratch();
        writeAt(root, BRAND_TOKEN_PATHS[0] as string);
        const result = runBrandStatus({ cwd: root, json: true });
        const payload = JSON.parse(result.out.join('\n')) as {
            brand_layer_present: boolean;
            dotted_near_misses: string[];
        };
        expect(payload.brand_layer_present).toBe(true);
        expect(payload.dotted_near_misses).toEqual([]);
    });

    it('treats absence as an answer, never as a failure', () => {
        // Greenfield is a legitimate state under brand-source-of-truth, so the
        // verb must not exit non-zero on it.
        expect(runBrandStatus({ cwd: scratch(), json: false }).code).toBe(0);
    });
});

interface StatusJson {
    brand_layer_present: boolean;
    tokens_file: string | null;
    state?: string;
    qualifiers?: string[];
    sources?: Array<{ path: string; kind: string; sha256: string; status: string; error?: string; winner?: string }>;
    voice?: { read: boolean };
}

function statusJson(root: string): StatusJson {
    return JSON.parse(runBrandStatus({ cwd: root, json: true }).out.join('\n')) as StatusJson;
}

// road-to-a-brand-the-tree-can-check 0.2 / 2.1-2.3: a file that merely exists
// is not a brand, and a second file at another canonical path is reported,
// never silently ignored. The voice side has no slot yet and reads as absent.
describe('brand:status state-fixtures', () => {
    const [first, second] = BRAND_TOKEN_PATHS as [string, string];

    it('state-fixtures: a malformed first file is invalid, never the brand', () => {
        const root = scratch();
        writeAt(root, first, 'not json {');
        writeAt(root, second);
        const s = statusJson(root);
        expect(s.tokens_file).toBe(second);
        expect(s.sources?.[0]).toMatchObject({ path: first, status: 'invalid' });
        expect(s.sources?.[0]?.error).toMatch(/not JSON/);
        expect(s.qualifiers).toContain('invalid');
        expect(s.state).toBe('mixed');
    });

    it('state-fixtures: invalid — a non-DTCG root is invalid with its reason', () => {
        const root = scratch();
        writeAt(root, first, JSON.stringify({ colors: { primary: '#fff' } }));
        const s = statusJson(root);
        expect(s.brand_layer_present).toBe(false);
        expect(s.tokens_file).toBeNull();
        expect(s.sources?.[0]).toMatchObject({ status: 'invalid' });
        expect(s.sources?.[0]?.error).toMatch(/\$value/);
        expect(s.state).toBe('bare');
        expect(s.qualifiers).toEqual(['invalid']);
        expect(runBrandStatus({ cwd: root, json: false }).out.join('\n')).toContain('invalid');
    });

    it('state-fixtures: shadowed — two different files name the winner and both hashes', () => {
        const root = scratch();
        writeAt(root, first);
        writeAt(root, second, JSON.stringify({ color: { brand: { $type: 'color', $value: '#ff0000' } } }));
        const s = statusJson(root);
        expect(s.tokens_file).toBe(first);
        expect(s.sources?.map((x) => x.status)).toEqual(['valid', 'shadowed']);
        expect(s.sources?.[1]?.winner).toBe(first);
        expect(s.sources?.[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(s.sources?.[0]?.sha256).not.toBe(s.sources?.[1]?.sha256);
        expect(s.qualifiers).toEqual(['shadowed']);
    });

    it('state-fixtures: two identical files are a duplicate, not a shadow', () => {
        const root = scratch();
        writeAt(root, first);
        writeAt(root, second);
        const s = statusJson(root);
        expect(s.sources?.map((x) => x.status)).toEqual(['valid', 'duplicate']);
        expect(s.sources?.[0]?.sha256).toBe(s.sources?.[1]?.sha256);
        expect(s.qualifiers).toEqual([]);
    });

    it('state-fixtures: tokens without voice is mixed', () => {
        const root = scratch();
        writeAt(root, first);
        const s = statusJson(root);
        expect(s.state).toBe('mixed');
        expect(s.sources?.map((x) => x.kind)).toEqual(['tokens']);
        expect(s.voice?.read).toBe(false);
    });

    it('state-fixtures: voice without tokens reads as absent until the slot ships', () => {
        const root = scratch();
        writeAt(root, 'agents/context-spine/brand-voice.md', '---\nversion: 1\n---\n');
        const s = statusJson(root);
        expect(s.state).toBe('bare');
        expect(s.sources).toEqual([]);
        expect(s.voice?.read).toBe(false);
    });

    it('state-fixtures: a DESIGN.md is listed with its hash and never decides the state', () => {
        const root = scratch();
        writeAt(root, 'DESIGN.md', '# DESIGN.md\n');
        const s = statusJson(root);
        expect(s.sources).toEqual([
            expect.objectContaining({ path: 'DESIGN.md', kind: 'design-md', status: 'valid' }),
        ]);
        expect(s.sources?.[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(s.state).toBe('bare');
    });

    it('state-fixtures: nothing is greenfield with no sources', () => {
        const s = statusJson(scratch());
        expect(s.state).toBe('bare');
        expect(s.sources).toEqual([]);
        expect(s.qualifiers).toEqual([]);
        expect(s.brand_layer_present).toBe(false);
    });
});

// road-to-a-brand-the-tree-can-check 0.1 / 1.2: every authored surface that
// names the token file names the file the resolver reads. A dotted
// `.tokens.json` may appear only where the same line says it is wrong.
describe('token-name-parity', () => {
    const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const ROOTS = ['src/skills', 'src/domains', 'docs/contracts'];
    const DOTTED = /(?<![\w.])\.tokens\.json/;
    const EXPLAINS = /NEVER|nothing reads|near-miss/;

    function walk(dir: string, out: string[]): void {
        for (const name of readdirSync(dir)) {
            const abs = join(dir, name);
            if (statSync(abs).isDirectory()) {
                if (name !== 'evals') walk(abs, out);
            } else if (name !== 'README.md') {
                out.push(abs);
            }
        }
    }

    it('token-name-parity: the resolver reads tokens.json, never a dotfile', () => {
        for (const rel of BRAND_TOKEN_PATHS) {
            expect(rel.split('/').pop()).toBe('tokens.json');
        }
    });

    it('token-name-parity: no authored surface tells the reader to write .tokens.json', () => {
        const files: string[] = [];
        for (const r of ROOTS) walk(join(REPO, r), files);
        const offenders: string[] = [];
        for (const f of files) {
            const lines = readFileSync(f, 'utf-8').split('\n');
            lines.forEach((line, i) => {
                if (DOTTED.test(line) && !EXPLAINS.test(line)) offenders.push(`${relative(REPO, f)}:${i + 1}`);
            });
        }
        expect(offenders).toEqual([]);
    });
});
