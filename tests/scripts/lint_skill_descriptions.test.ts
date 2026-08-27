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

import { analyseSkill, preemptionPhrase } from '../../src/scripts/lint_skill_descriptions.js';

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

/**
 * The zero above is only meaningful while it is EARNED. A pair sitting at or
 * above the canonical threshold and reviewed into
 * `audit_skill_overlap_allowlist.json` is deliberately not a cluster — but the
 * exclusion has to be wired, and an unwired linter would report the same zero
 * only until someone edited a skill body.
 *
 * So this suite asserts the mechanism rather than the number: for every
 * allowlisted pair, the RAW cosine is at or above the threshold (the pair
 * genuinely qualifies) and the linter nonetheless counts zero clusters. Delete
 * the `reviewed.has(...)` line in `computeClusters` and the second assertion
 * goes red — verified by doing exactly that.
 */
describe('lint_skill_descriptions — reviewed overlaps are excluded from clusters', () => {
    it('every allowlisted pair is above threshold on the raw metric, and is still not a cluster', async () => {
        const overlap = await import('../../src/scripts/audit_skill_overlap.js');
        const allow = overlap._loadAllowlist(overlap.ALLOWLIST);
        if (allow.size === 0) {
            // Empty is the healthy state the allowlist's own comment names.
            // Nothing to prove, and asserting a non-empty list would make the
            // healthy state a failure.
            return;
        }
        const bySlug = new Map(
            overlap.collect().map((sk) => [path.basename(path.dirname(sk.relpath)), sk] as const),
        );
        for (const key of allow) {
            const [a, b] = key.split('::');
            const sa = bySlug.get(a as string);
            const sb = bySlug.get(b as string);
            expect(sa, `allowlisted slug not found: ${a}`).toBeDefined();
            expect(sb, `allowlisted slug not found: ${b}`).toBeDefined();
            const cos = overlap._cosine(sa!.vector, sb!.vector);
            expect(cos, `${key} is allowlisted but below threshold — the entry is stale`).toBeGreaterThanOrEqual(
                overlap.OVERLAP_THRESHOLD,
            );
        }
        const r = spawnSync(TSX, [SCRIPT], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        expect(r.status).toBe(0);
        expect(r.stdout, 'a reviewed overlap must not be counted as a cluster').toMatch(/\(0 clustered\)/);
    }, 120_000);
});

describe('lint_skill_descriptions — (g) preemption phrases', () => {
    // A description argues for its own routing CONDITIONS. The moment it argues
    // against its siblings, it stops competing on fit and starts competing on
    // volume — and the cost lands on skills that never mentioned it.
    it.each([
        ['unconditional activation', 'Always use this skill when formatting anything at all.'],
        ['activation regardless', 'Formats code. Applies regardless of what the user asked for.'],
        ['activation on every turn', 'Reviews the diff. Runs on every turn, no exceptions.'],
        ['priority over a sibling', 'Formats TypeScript. Use this instead of the prettier skill.'],
        ['authority claim', 'Formats code. This skill takes precedence over all other formatters.'],
        ['load-order claim', 'Formats code. Load this first, before any other skill.'],
    ])('rejects %s', (_kind, description) => {
        expect(codes('formatter', { name: 'formatter', description })).toContain('preemption-phrase');
    });

    // These three are the corpus lines that a word-keyed first draft flagged.
    // Each uses a precedence WORD as its subject, which is not a claim — pinning
    // them here is what stops the patterns being loosened back to vocabulary.
    it.each([
        [
            'decision-review',
            'Use to audit a past architectural decision — did the chosen option hold up, what assumptions drifted, should the ADR be superseded?',
        ],
        [
            'override-management',
            'Creates and manages project-level overrides for shared skills, rules, and commands — extending or replacing originals with project-specific behaviour.',
        ],
        [
            'prediction-pool-optimizer',
            "Optimize prediction-pool tips: rules + multi-book consensus odds → expected-points-max answer for every question, scores AND bonus. Triggers 'optimize my pool tips'.",
        ],
    ])('does not fire on %s, whose precedence word is its subject', (slug, description) => {
        expect(codes(slug, { name: slug, description })).not.toContain('preemption-phrase');
    });

    it('reports the kind, so a finding says which claim was made', () => {
        expect(preemptionPhrase('Always use this for everything.')?.kind).toBe('unconditional activation');
        expect(preemptionPhrase('Formats code beautifully.')).toBeNull();
    });

    it('the whole shipped corpus is free of preemption today — the gate lands at zero', () => {
        // If this ever fails, the fix is the description, not the pattern: a
        // gate that gets relaxed to fit the corpus is the inversion this
        // repository has already recorded three times.
        const r = spawnSync(TSX, [SCRIPT, '--quiet'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        expect(r.stderr).not.toMatch(/preemption-phrase/);
    });
});
