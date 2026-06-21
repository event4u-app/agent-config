// Tests for src/scripts/check_iron_law_prominence.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_check_iron_law_prominence.py — clean/violation
// scan_file cases on tmp files, the in-code-fence skip, the shipped-rules
// contract (all current rules clean), plus a golden-parity layer over the
// real repo (python3 vs tsx, skipped without python3).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/check_iron_law_prominence.js';
import { artefact_roots } from '../../src/scripts/_lib/agent_src.js';



function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}
function _rglobMd(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, ent.name);
            if (ent.name.endsWith('.md')) out.push(full);
            if (ent.isDirectory()) walk(full);
        }
    };
    walk(root);
    out.sort();
    return out;
}

describe('check_iron_law_prominence — scan_file', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ilp-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    const write = (name: string, body: string): string => {
        const p = path.join(tmp, name);
        fs.writeFileSync(p, body, 'utf-8');
        return p;
    };

    // --- clean cases ---
    it('iron law first H2 passes', () => {
        const p = write('good.md', '# Title\n\n## The Iron Law\n\nRULE.\n\n## Other section\n');
        expect(mod.scan_file(p)).toEqual([]);
    });

    it('iron law second H2 passes', () => {
        const p = write(
            'good2.md',
            '# Title\n\n## Setup context\n\nWhy this matters.\n\n## Iron Law — never skip\n\nRULE.\n',
        );
        expect(mod.scan_file(p)).toEqual([]);
    });

    it('no iron law at all passes', () => {
        const p = write('no-iron.md', '# Title\n\n## Section A\n\n## Section B\n');
        expect(mod.scan_file(p)).toEqual([]);
    });

    it('multiple iron laws at top passes', () => {
        const p = write('multi.md', '# Title\n\n## Iron Law 1 — Foo\n\n## Iron Law 2 — Bar\n\n## Other\n');
        expect(mod.scan_file(p)).toEqual([]);
    });

    it('iron law in code block ignored', () => {
        const p = write(
            'fenced.md',
            '# Title\n\n## Section A\n\n```\n## Iron Law (this is in code)\n```\n\n## Section B\n',
        );
        expect(mod.scan_file(p)).toEqual([]);
    });

    // --- violation cases ---
    it('iron law at H3 fails', () => {
        const p = write('h3.md', '# Title\n\n## Wrapper\n\n### The Iron Law — buried\n\nRULE.\n');
        const v = mod.scan_file(p);
        expect(v).toHaveLength(1);
        expect(v[0]!.kind).toBe('deep_iron_law');
        expect(v[0]!.detail).toContain('promote to H2');
    });

    it('iron law buried third H2 fails', () => {
        const p = write(
            'buried.md',
            '# Title\n\n## Section A\n\n## Section B\n\n## Section C\n\n## The Iron Law\n\nRULE.\n',
        );
        const v = mod.scan_file(p);
        expect(v).toHaveLength(1);
        expect(v[0]!.kind).toBe('buried_iron_law');
        expect(v[0]!.detail).toContain('first 2 H2 positions');
    });

    it('H4 iron law also fails', () => {
        const p = write('h4.md', '# Title\n\n## Wrapper\n\n### Sub\n\n#### Iron Law — too deep\n\nRULE.\n');
        const v = mod.scan_file(p);
        expect(v).toHaveLength(1);
        expect(v[0]!.kind).toBe('deep_iron_law');
    });
});

// --- repository contract ---
describe('check_iron_law_prominence — shipped rules', () => {
    it('all currently shipped rules pass', () => {
        const rulesDirs = artefact_roots()
            .map((r) => path.join(r, 'rules'))
            .filter((d) => _isDir(d));
        expect(rulesDirs.length).toBeGreaterThan(0);
        const allViolations: mod.Violation[] = [];
        for (const dir of rulesDirs) {
            for (const md of _rglobMd(dir)) {
                allViolations.push(...mod.scan_file(md));
            }
        }
        expect(allViolations).toEqual([]);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

