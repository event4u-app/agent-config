
import * as fs from 'node:fs';
import * as os from 'node:os';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as crt from '../../src/scripts/check_roadmap_trackable.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_roadmap_trackable.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

describe('check_roadmap_trackable — replicated dashboard helpers', () => {
    it('parse_frontmatter reads flat string flags', () => {
        const fm = crt.parse_frontmatter('---\nstatus: draft\nmode: "x"\n---\nbody\n');
        expect(fm.get('status')).toBe('draft');
        expect(fm.get('mode')).toBe('x');
    });

    it('parse_frontmatter empty when no frontmatter', () => {
        expect(crt.parse_frontmatter('# Heading\n').size).toBe(0);
    });

    it('is_draft true only for status: draft', () => {
        expect(crt.is_draft(new Map([['status', 'draft']]))).toBe(true);
        expect(crt.is_draft(new Map([['status', 'ready']]))).toBe(false);
        expect(crt.is_draft(new Map())).toBe(false);
    });

    it('is_roadmap_candidate excludes template/README/archive/skipped', () => {
        expect(crt.is_roadmap_candidate('agents/roadmaps/road-to-x.md')).toBe(true);
        expect(crt.is_roadmap_candidate('agents/roadmaps/template.md')).toBe(false);
        expect(crt.is_roadmap_candidate('agents/roadmaps/README.md')).toBe(false);
        expect(crt.is_roadmap_candidate('agents/roadmaps/archive/done.md')).toBe(false);
        expect(crt.is_roadmap_candidate('agents/roadmaps/skipped/dead.md')).toBe(false);
        expect(crt.is_roadmap_candidate('agents/roadmaps/open-questions-x.md')).toBe(false);
    });

    it('violations_for: phase with no checkbox is flagged', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crt-'));
        try {
            const p = path.join(tmp, 'road-to-x.md');
            fs.writeFileSync(p, '# Roadmap\n\n## Phase 1 — Setup\n\nNo checkboxes here.\n');
            const v = crt.violations_for(p);
            expect(v).toHaveLength(1);
            expect(v[0]).toContain('Phase 1');
            expect(v[0]).toContain('zero');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('violations_for: no Phase heading is flagged', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crt-'));
        try {
            const p = path.join(tmp, 'road-to-y.md');
            fs.writeFileSync(p, '# Roadmap\n\nNot trackable.\n- [ ] orphan item\n');
            const v = crt.violations_for(p);
            expect(v).toHaveLength(1);
            expect(v[0]).toContain('PHASE_RE');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('violations_for: clean phase with a checkbox passes', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crt-'));
        try {
            const p = path.join(tmp, 'road-to-z.md');
            fs.writeFileSync(p, '# Roadmap\n\n## Phase 1 — Setup\n\n- [ ] do the thing\n');
            expect(crt.violations_for(p)).toEqual([]);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('violations_for: dotted sub-phase ids ("1.0", "4.1") are trackable', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crt-'));
        try {
            const p = path.join(tmp, 'road-to-dotted.md');
            fs.writeFileSync(
                p,
                '# Roadmap\n\n## Phase 1.0 — Kickoff\n\n- [ ] a\n\n## Phase 4.1 — Sub track\n\n- [x] b\n',
            );
            expect(crt.violations_for(p)).toEqual([]);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------
// The `relates:` ratchet — road-to-roadmap-situational-awareness § 4.2
// ---------------------------------------------------------------------------

describe('relates: ratchet — new roadmaps must declare relations, old ones are held', () => {
    /** Baseline recorded when the check landed. Read from the committed file. */
    const BASELINE = 9;

    function tree(count_without_relates: number, count_with: number): string {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crt-relates-'));
        const dir = path.join(tmp, 'agents', 'roadmaps');
        fs.mkdirSync(dir, { recursive: true });
        const body = '## Phase 1 — Do\n\n- [ ] a thing\n';
        for (let i = 0; i < count_without_relates; i++) {
            fs.writeFileSync(
                path.join(dir, `road-to-old-${i}.md`),
                `---\ncomplexity: lightweight\n---\n# Old ${i}\n\n${body}`,
            );
        }
        for (let i = 0; i < count_with; i++) {
            fs.writeFileSync(
                path.join(dir, `road-to-new-${i}.md`),
                `---\ncomplexity: lightweight\nrelates: []   # scanned: 0 hits\n---\n# New ${i}\n\n${body}`,
            );
        }
        return tmp;
    }

    function run(cwd: string): { code: number; out: string } {
        const r = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd, encoding: 'utf-8' });
        return { code: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
    }

    it('declares_relates is presence-only — an empty list counts', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crt-dr-'));
        try {
            const a = path.join(tmp, 'a.md');
            const b = path.join(tmp, 'b.md');
            fs.writeFileSync(a, '---\nrelates: []\n---\n# a\n');
            fs.writeFileSync(b, '---\ncomplexity: lightweight\n---\n# b\n');
            expect(crt.declares_relates(a)).toBe(true);
            expect(crt.declares_relates(b)).toBe(false);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('stays green at the baseline — pre-existing roadmaps are not retroactively broken', () => {
        const tmp = tree(BASELINE, 0);
        try {
            const { code, out } = run(tmp);
            expect(out).toContain(`${BASELINE} violation(s) at baseline`);
            expect(code).toBe(0);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('reds when one MORE roadmap arrives without the block', () => {
        const tmp = tree(BASELINE + 1, 0);
        try {
            const { code, out } = run(tmp);
            expect(code).toBe(1);
            expect(out).toContain(`${BASELINE + 1} violation(s) against a baseline of ${BASELINE}`);
            expect(out).toContain('no `relates:` block in the frontmatter');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('stays green when the new roadmap DOES declare the block', () => {
        const tmp = tree(BASELINE, 3);
        try {
            expect(run(tmp).code).toBe(0);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
