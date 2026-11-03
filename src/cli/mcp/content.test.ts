/**
 * Content-loader test — reads the REAL bundled tree from the repo root,
 * proving the disk read produces the expected uris/kinds. Tolerant to a
 * partial dist/ (asserts on what must be present in this repo).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { _frontmatter_text, _parse_inputs } from '../../scripts/mcp_server/prompts.js';
import { loadContentTree, entriesOfKind } from './content.js';

const tree = loadContentTree(process.cwd());

describe('loadContentTree (real dist/agent-src)', () => {
    it('loads a non-empty surface', () => {
        expect(Object.keys(tree.uris).length).toBeGreaterThan(100);
    });
    it('skills become skill:// prompts', () => {
        const skills = entriesOfKind(tree, ['skill']);
        expect(skills.length).toBeGreaterThan(50);
        expect(skills.every((e) => e.uri.startsWith('skill://'))).toBe(true);
    });
    it('rules become rule:// resources with markdown mime', () => {
        const rules = entriesOfKind(tree, ['rule']);
        expect(rules.length).toBeGreaterThan(20);
        expect(rules.every((e) => e.uri.startsWith('rule://') && e.mime_type === 'text/markdown')).toBe(true);
    });
    it('commands + guidelines are present', () => {
        expect(entriesOfKind(tree, ['command']).length).toBeGreaterThan(50);
        expect(entriesOfKind(tree, ['guideline']).length).toBeGreaterThan(10);
    });
    it('every entry carries name + body + source', () => {
        for (const e of Object.values(tree.uris)) {
            expect(e.name.length).toBeGreaterThan(0);
            expect(typeof e.body).toBe('string');
            expect(e.source.length).toBeGreaterThan(0);
        }
    });
    it('a known rule resolves with its body', () => {
        const commitPolicy = tree.uris['rule://commit-policy'];
        expect(commitPolicy).toBeDefined();
        expect(commitPolicy!.body.length).toBeGreaterThan(0);
    });

    it('guideline uris are relpath-from-guidelines-root (no `guidelines/` prefix; nesting preserved)', () => {
        // Regression guard for the Phase-4 parity-smoke finding: top-level
        // guidelines must NOT carry a spurious `guidelines/` prefix, and nested
        // ones must keep their full path — mirrors the Python kernel's
        // `guideline://<relpath-no-ext>` convention (resources.py).
        const guidelines = entriesOfKind(tree, ['guideline']);
        expect(guidelines.length).toBeGreaterThan(10);
        for (const g of guidelines) {
            expect(g.uri.startsWith('guideline://guidelines/')).toBe(false);
        }
        // a known nested guideline keeps its directory segment(s)
        const nested = guidelines.find((g) => g.uri.includes('php/patterns/'));
        expect(nested, 'expected a nested php/patterns/ guideline').toBeDefined();
    });
});

describe('loadContentTree — declared inputs', () => {
    it('carries inputs on prompts that declare them and agrees with the kernel reader', () => {
        const prompts = entriesOfKind(tree, ['skill', 'command']);
        const declaring = prompts.filter((e) => e.inputs !== undefined);
        expect(declaring.length).toBeGreaterThan(0);
        for (const e of prompts) {
            const file = e.kind === 'skill' ? `dist/agent-src/skills/${e.uri.slice('skill://'.length)}/SKILL.md` : null;
            if (file === null) continue;
            let raw: string;
            try {
                raw = readFileSync(file, 'utf8');
            } catch {
                continue; // frontmatter name differs from the slug
            }
            const kernel = _parse_inputs(_frontmatter_text(raw));
            expect(e.inputs ?? [], e.name).toEqual(kernel);
        }
    });
    it('never sets inputs on a resource', () => {
        for (const e of entriesOfKind(tree, ['rule', 'guideline'])) expect(e.inputs).toBeUndefined();
    });
});
