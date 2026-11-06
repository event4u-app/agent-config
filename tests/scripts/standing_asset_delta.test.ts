/**
 * A pull request that changes an always-loaded asset reports that asset's own
 * byte delta, not only the bucket it falls in. Sizes are measured the way the
 * ratchet measures them: a rule by its file size, a skill by its catalog entry
 * (name and description), CLAUDE.md by its file size.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { assetDeltas, assetSizes, renderAssetDeltas } from '../../src/scripts/_lib/standing_asset_delta.js';

const tmps: string[] = [];
afterEach(() => {
    for (const t of tmps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
});
function tree(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-delta-'));
    tmps.push(root);
    for (const [rel, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), text);
    }
    return root;
}
const skill = (name: string, description: string, body = 'Body.'): string => `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;

describe('assetSizes', () => {
    it('measures rules by file size, skills by catalog entry, CLAUDE.md by file size', () => {
        const root = tree({
            'dist/agent-src/rules/a.md': 'x'.repeat(100),
            'dist/agent-src/rules/notes.txt': 'ignored',
            'dist/agent-src/skills/s1/SKILL.md': skill('s1', 'does s1'),
            'CLAUDE.md': 'y'.repeat(30),
        });
        expect(Object.fromEntries(assetSizes(root))).toEqual({
            'dist/agent-src/rules/a.md': 100,
            'dist/agent-src/skills/s1/SKILL.md': '- s1: does s1\n'.length,
            'CLAUDE.md': 30,
        });
    });
});

describe('assetDeltas', () => {
    const base = (): string =>
        tree({
            'dist/agent-src/rules/a.md': 'x'.repeat(100),
            'dist/agent-src/rules/gone.md': 'g'.repeat(40),
            'dist/agent-src/skills/s1/SKILL.md': skill('s1', 'short'),
            'dist/agent-src/skills/s2/SKILL.md': skill('s2', 'same', 'old body'),
        });
    const head = (): string =>
        tree({
            'dist/agent-src/rules/a.md': 'x'.repeat(180),
            'dist/agent-src/rules/new.md': 'n'.repeat(20),
            'dist/agent-src/skills/s1/SKILL.md': skill('s1', 'a much longer description'),
            'dist/agent-src/skills/s2/SKILL.md': skill('s2', 'same', 'a body that never loads by default'),
        });
    it('lists every asset whose loaded size changed, added and removed ones included, largest change first, ties by path', () => {
        expect(assetDeltas(base(), head())).toEqual([
            { asset: 'dist/agent-src/rules/a.md', base: 100, head: 180, delta_chars: 80, delta_tokens: 20 },
            { asset: 'dist/agent-src/rules/gone.md', base: 40, head: null, delta_chars: -40, delta_tokens: -10 },
            { asset: 'dist/agent-src/rules/new.md', base: null, head: 20, delta_chars: 20, delta_tokens: 5 },
            { asset: 'dist/agent-src/skills/s1/SKILL.md', base: 12, head: 32, delta_chars: 20, delta_tokens: 5 },
        ]);
    });
    it('a skill body edit is not a change to the default load', () => {
        expect(assetDeltas(base(), head()).some((r) => r.asset.includes('/s2/'))).toBe(false);
    });
    it('renders a table, and says so plainly when nothing changed', () => {
        const md = renderAssetDeltas(assetDeltas(base(), head()));
        expect(md).toContain('### Changed always-loaded assets');
        expect(md).toContain('| `dist/agent-src/rules/a.md` | 100 | 180 | +80 | +20 |');
        expect(md).toContain('| `dist/agent-src/rules/gone.md` | 40 | — | -40 | -10 |');
        expect(renderAssetDeltas([])).toContain('_No always-loaded asset changed in this diff._');
    });
});
