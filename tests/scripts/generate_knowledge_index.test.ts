// Tests for src/scripts/generate_knowledge_index.ts (road-to-knowledge-system,
// Phase 1). Exercises: empty-dir no-op, cards-only, mixed cards + typed dirs,
// stable ordering, --check drift detection, idempotence.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { main } from '../../src/scripts/generate_knowledge_index.ts';

function mkTmpRepo(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-index-'));
}

function writeFile(root: string, relPath: string, body: string): void {
    const abs = path.join(root, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body, 'utf8');
}

describe('generate_knowledge_index — empty / missing dir', () => {
    it('no agents/knowledge/ directory → exit 0, no write', () => {
        const root = mkTmpRepo();
        const rc = main(['--dir', root, '--quiet']);
        expect(rc).toBe(0);
        expect(fs.existsSync(path.join(root, 'agents', 'knowledge', 'INDEX.md'))).toBe(false);
    });

    it('empty agents/knowledge/ directory → writes a header-only index', () => {
        const root = mkTmpRepo();
        fs.mkdirSync(path.join(root, 'agents', 'knowledge'), { recursive: true });
        const rc = main(['--dir', root, '--quiet']);
        expect(rc).toBe(0);
        const content = fs.readFileSync(path.join(root, 'agents', 'knowledge', 'INDEX.md'), 'utf8');
        expect(content).toContain('# Knowledge Index');
        expect(content).not.toContain('## Knowledge Cards');
    });
});

describe('generate_knowledge_index — cards only', () => {
    it('flat cards produce a Knowledge Cards section, README/INDEX excluded', () => {
        const root = mkTmpRepo();
        writeFile(
            root,
            'agents/knowledge/stripe.md',
            '---\ntype: anti-hallucination\ndescription: "Stripe webhook signature quirks"\n---\n\n# Stripe\n',
        );
        writeFile(root, 'agents/knowledge/README.md', '# ignore me\n');
        const rc = main(['--dir', root, '--quiet']);
        expect(rc).toBe(0);
        const content = fs.readFileSync(path.join(root, 'agents', 'knowledge', 'INDEX.md'), 'utf8');
        expect(content).toContain('## Knowledge Cards');
        expect(content).toContain('[stripe](stripe.md) — Stripe webhook signature quirks');
        expect(content).not.toContain('README');
    });
});

describe('generate_knowledge_index — mixed + ordering', () => {
    it('sections appear in fixed order; entries sorted alphabetically within a section', () => {
        const root = mkTmpRepo();
        writeFile(root, 'agents/knowledge/zeta-card.md', '# Zeta\n');
        writeFile(root, 'agents/knowledge/alpha-card.md', '# Alpha\n');
        writeFile(root, 'agents/knowledge/concepts/b-concept.md', '# B concept\n');
        writeFile(root, 'agents/knowledge/concepts/a-concept.md', '# A concept\n');
        writeFile(root, 'agents/knowledge/sessions/2026-07-05-fix.md', '# Fixed the thing\n');
        writeFile(root, 'agents/knowledge/decisions/keep-flat.md', '# Keep cards flat\n');

        const rc = main(['--dir', root, '--quiet']);
        expect(rc).toBe(0);
        const content = fs.readFileSync(path.join(root, 'agents', 'knowledge', 'INDEX.md'), 'utf8');

        const cardsIdx = content.indexOf('## Knowledge Cards');
        const sessionsIdx = content.indexOf('## Sessions');
        const conceptsIdx = content.indexOf('## Concepts');
        const decisionsIdx = content.indexOf('## Decisions');
        expect(cardsIdx).toBeGreaterThan(-1);
        expect(sessionsIdx).toBeGreaterThan(cardsIdx);
        expect(conceptsIdx).toBeGreaterThan(sessionsIdx);
        expect(decisionsIdx).toBeGreaterThan(conceptsIdx);
        expect(content).not.toContain('## Procedures');

        // Alphabetical within the Cards section: alpha before zeta.
        expect(content.indexOf('alpha-card.md')).toBeLessThan(content.indexOf('zeta-card.md'));
        // Alphabetical within Concepts: a-concept before b-concept.
        expect(content.indexOf('a-concept.md')).toBeLessThan(content.indexOf('b-concept.md'));
    });
});

describe('generate_knowledge_index — --check', () => {
    it('exits 1 when INDEX.md is stale, 0 once regenerated', () => {
        const root = mkTmpRepo();
        writeFile(root, 'agents/knowledge/card.md', '# Card\n');

        const checkBefore = main(['--dir', root, '--check', '--quiet']);
        expect(checkBefore).toBe(1);

        const write = main(['--dir', root, '--quiet']);
        expect(write).toBe(0);

        const checkAfter = main(['--dir', root, '--check', '--quiet']);
        expect(checkAfter).toBe(0);
    });

    it('is idempotent — a second run without changes does not rewrite content', () => {
        const root = mkTmpRepo();
        writeFile(root, 'agents/knowledge/card.md', '# Card\n');
        main(['--dir', root, '--quiet']);
        const first = fs.readFileSync(path.join(root, 'agents', 'knowledge', 'INDEX.md'), 'utf8');
        main(['--dir', root, '--quiet']);
        const second = fs.readFileSync(path.join(root, 'agents', 'knowledge', 'INDEX.md'), 'utf8');
        expect(second).toBe(first);
    });
});

describe('generate_knowledge_index — usage', () => {
    it('unknown flag exits 1', () => {
        const rc = main(['--bogus']);
        expect(rc).toBe(1);
    });

    it('--help exits 0', () => {
        const rc = main(['--help']);
        expect(rc).toBe(0);
    });
});
