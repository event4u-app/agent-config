// Tests for src/scripts/select_analysis_mode.ts — the delta-vs-full router
// `project-analysis-core`'s improvement mode consults.
//
// The fixture is a tmpdir concepts directory, so both branches are driven by
// what is actually on disk rather than by a mocked answer.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CONCEPTS_DIR,
    main,
    selectAnalysisMode,
    slugify,
} from '../../src/scripts/select_analysis_mode.js';

let root: string;

function writeConcept(slug: string, body: string): void {
    const dir = path.join(root, CONCEPTS_DIR);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${slug}.md`), body);
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sam-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('an existing artefact selects the delta path', () => {
    it('names the artefact it would update', () => {
        writeConcept('auth-module', '# Auth module\n\nPrior conclusions.\n');
        const v = selectAnalysisMode('auth-module', root);
        expect(v.mode).toBe('delta');
        expect(v.artefact).toBe(`${CONCEPTS_DIR}/auth-module.md`);
    });

    it('matches on the slug, so the caller\'s phrasing does not decide', () => {
        writeConcept('auth-module', 'content');
        for (const phrasing of ['Auth Module', 'auth module', '  AUTH-MODULE  ']) {
            expect(selectAnalysisMode(phrasing, root).mode).toBe('delta');
        }
    });

    it('says the structural claims are still re-verified — a cheaper write is not trust', () => {
        writeConcept('auth-module', 'content');
        expect(selectAnalysisMode('auth-module', root).reason).toContain('re-verified');
    });
});

describe('a missing artefact selects the full path', () => {
    it('an absent file', () => {
        const v = selectAnalysisMode('auth-module', root);
        expect(v.mode).toBe('full');
        expect(v.artefact).toBeNull();
        expect(v.reason).toContain('nothing to delta against');
    });

    it('an absent concepts directory entirely', () => {
        expect(selectAnalysisMode('anything', root).mode).toBe('full');
    });

    it('an EMPTY file is absent, not present — a zero-byte page carries no conclusions', () => {
        // The sabotage that matters: treating existence as sufficient would take
        // the delta path on a page with nothing in it and report a saving.
        writeConcept('auth-module', '');
        const v = selectAnalysisMode('auth-module', root);
        expect(v.mode).toBe('full');
        expect(v.reason).toContain('empty');
    });

    it('a DIRECTORY at the artefact path is absent, not present', () => {
        fs.mkdirSync(path.join(root, CONCEPTS_DIR, 'auth-module.md'), { recursive: true });
        expect(selectAnalysisMode('auth-module', root).mode).toBe('full');
    });

    it('a target that slugifies to nothing cannot address an artefact', () => {
        expect(selectAnalysisMode('///', root).mode).toBe('full');
        expect(selectAnalysisMode('   ', root).reason).toContain('empty slug');
    });
});

describe('the CLI', () => {
    it('prints the mode and exits 0 — it is a router, never a gate', () => {
        writeConcept('auth-module', 'content');
        const lines: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((c: string) => {
            lines.push(c);
            return true;
        }) as typeof process.stdout.write;
        try {
            expect(main(['auth-module'], root)).toBe(0);
        } finally {
            process.stdout.write = orig;
        }
        expect(lines.join('')).toMatch(/^delta: /);
    });

    it('a missing target is a usage error, not a silent full-path answer', () => {
        expect(main([], root)).toBe(2);
    });
});

describe('slugify', () => {
    it('collapses runs and trims edges', () => {
        expect(slugify('  Auth // Module  ')).toBe('auth-module');
        expect(slugify('API v2 Layer')).toBe('api-v2-layer');
    });
});
