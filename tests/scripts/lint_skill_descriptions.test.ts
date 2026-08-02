/**
 * Fixture tests for `src/scripts/lint_skill_descriptions.ts`
 * (ecosystem-harvest skill-quality-gates, Phase 1).
 *
 * Must-fail: the auto-generated-skill-farm circular frontmatter (name-echo
 * description, no routing signal) — the index Reject-log specimen, used here
 * ONLY as a must-fail lint fixture. Must-pass: three shipped skills whose
 * descriptions carry real routing signal.
 *
 * Unit-level against the exported `analyseSkill` (deterministic, no model/API),
 * plus one CLI-contract assertion that the linter runs clean on the real repo.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { analyseSkill } from '../../src/scripts/lint_skill_descriptions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const TSX = path.join(REPO, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPT = path.join(REPO, 'src', 'scripts', 'lint_skill_descriptions.ts');

const codes = (slug: string, fm: Record<string, string>) => analyseSkill(slug, fm).map((v) => v.code);
const codesFor = (slug: string, fm: Record<string, string>, siblings: string[]) =>
    analyseSkill(slug, fm, siblings).map((v) => v.code);

describe('lint_skill_descriptions — must-fail specimens', () => {
    it('flags the farm-generator name-echo description (desc ≡ name + no signal)', () => {
        const c = codes('data-export', { name: 'data-export', description: 'Data export' });
        expect(c).toContain('desc-equals-name');
        expect(c).toContain('no-routing-signal');
    });

    it('flags a verbatim duplicated multi-word trigger phrase', () => {
        const c = codes('foo', {
            name: 'foo',
            description: 'Export the ledger to CSV. Export the ledger to CSV.',
        });
        expect(c).toContain('duplicated-trigger');
    });

    it('flags triggers that are all substrings of the name', () => {
        const c = codes('image-resizer', { name: 'image-resizer', description: 'image resizer' });
        expect(c).toContain('triggers-are-name');
    });

    it('flags a bare topic restatement with no routing signal', () => {
        const c = codes('widgets', { name: 'widgets', description: 'Widgets stuff' });
        expect(c).toContain('no-routing-signal');
    });
});

describe('lint_skill_descriptions — must-pass specimens', () => {
    const pass: Array<[string, Record<string, string>]> = [
        ['security-audit', { name: 'security-audit', description: 'ONLY when user explicitly requests: security audit, vulnerability scan, or penetration test review. NOT for regular feature work.' }],
        ['laravel', { name: 'laravel', description: 'Writes Laravel PHP — Eloquent, Artisan controllers, FormRequests, jobs, events, policies, providers.' }],
        ['markitdown', { name: 'markitdown', description: "Convert PDF, DOCX, XLSX to Markdown via the markitdown-mcp server — 'extract this PDF', 'OCR this image'." }],
    ];
    for (const [slug, fm] of pass) {
        it(`passes the shipped skill "${slug}"`, () => {
            expect(analyseSkill(slug, fm)).toEqual([]);
        });
    }
});

describe('lint_skill_descriptions — clustered-only positive checks', () => {
    // A skill with NO sibling is never subject to (e) or (f) — that scoping is
    // the whole reason a quoted-phrase mandate is not corpus-wide noise.
    const bare = { name: 'roadmap-writing', description: 'Use when authoring a roadmap in agents/roadmaps.' };

    it('unclustered: no quoted phrase and no sibling named — still clean', () => {
        expect(analyseSkill('roadmap-writing', bare)).toEqual([]);
    });

    it('clustered + missing BOTH → both codes fire, and name the sibling', () => {
        const v = analyseSkill('roadmap-writing', bare, ['roadmap-management']);
        const c = v.map((x) => x.code);
        expect(c).toContain('clustered-no-sibling-routing');
        expect(c).toContain('clustered-no-quoted-phrase');
        expect(v.find((x) => x.code === 'clustered-no-sibling-routing')?.detail).toContain('roadmap-management');
    });

    it('clustered + sibling named but no quoted phrase → only the quote code', () => {
        const c = codesFor('roadmap-writing', {
            name: 'roadmap-writing',
            description: 'Use when authoring a roadmap — lifecycle management is roadmap-management.',
        }, ['roadmap-management']);
        expect(c).not.toContain('clustered-no-sibling-routing');
        expect(c).toContain('clustered-no-quoted-phrase');
    });

    it('clustered + both present → clean', () => {
        expect(
            analyseSkill('roadmap-writing', {
                name: 'roadmap-writing',
                description: "Use when authoring a roadmap — triggers 'write a plan for X'. Lifecycle → roadmap-management.",
            }, ['roadmap-management']),
        ).toEqual([]);
    });

    it('every sibling must be named, not just the first', () => {
        const v = analyseSkill('video-director', {
            name: 'video-director',
            description: "Use when a beat becomes the 11-block prompt — 'cinematic prompt'. Animated → pixar-storyteller.",
        }, ['pixar-storyteller', 'scene-expander']);
        const routing = v.find((x) => x.code === 'clustered-no-sibling-routing');
        expect(routing?.detail).toContain('scene-expander');
        expect(routing?.detail).not.toContain('pixar-storyteller');
    });

    it('the shipped video trio descriptions satisfy both checks under a synthetic cluster', () => {
        // The real corpus has no cluster (0 pairs >= threshold), so pin the
        // retrofitted descriptions against the cluster they WOULD form.
        const trio: Array<[string, string, string[]]> = [
            [
                'video-director',
                "Use when a live-action beat becomes the 11-block cinematic prompt — lens, lighting, negatives. Triggers 'cinematic prompt', 'film-grade scene'. Animated → pixar-storyteller; 12-block → scene-expander.",
                ['pixar-storyteller', 'scene-expander'],
            ],
            [
                'scene-expander',
                "Use when expanding a one-line idea into the 12-block Cinematic Scene Blueprint — optional dialogue + ambient. Triggers 'expand this scene', 'blueprint for X'. 11-block refine → video-director.",
                ['video-director'],
            ],
            [
                'pixar-storyteller',
                "Use when an idea becomes a Pixar-style animation prompt — character sheet, scene, image, video; emotional beat, want, obstacle. Triggers 'Pixar prompt', 'animated scene'. Live-action → video-director.",
                ['video-director'],
            ],
        ];
        for (const [slug, description, siblings] of trio) {
            expect(analyseSkill(slug, { name: slug, description }, siblings), slug).toEqual([]);
        }
    });
});

describe('lint_skill_descriptions — CLI contract', () => {
    it('runs clean on the real repo (exit 0)', () => {
        const r = spawnSync(TSX, [SCRIPT, '--quiet'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        expect(r.status).toBe(0);
    });

    it('reports the clustered count, and it is currently zero', () => {
        const r = spawnSync(TSX, [SCRIPT], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/\(0 clustered\)/);
    });
});
