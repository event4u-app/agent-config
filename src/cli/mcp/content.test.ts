/**
 * Content-loader test — reads the REAL bundled tree from the repo root,
 * proving the disk read produces the expected uris/kinds. Tolerant to a
 * partial dist/ (asserts on what must be present in this repo).
 */
import { describe, expect, it } from 'vitest';
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
});
