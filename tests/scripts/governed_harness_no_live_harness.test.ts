/**
 * The standing constraint of step 5.2
 * (road-to-governed-harness-evolution, Phase 5).
 *
 * > *Keep the live-floors park intact. No live harness.
 * > `agents/roadmaps/later/road-to-routing-assurance-live-floors.md` exists on
 * > this tree — verified — and its council park (2/2) is not reopened here.*
 * > verify: **no step in this roadmap invokes a live routing harness.**
 *
 * ## Why the scan is in two halves, and why neither is enough alone
 *
 * A roadmap step can reach a live harness in exactly two ways: by naming the
 * command in its own text, or by pointing at code that makes the call. So half
 * A reads the roadmap's step bullets and half B reads the source files that
 * declare themselves as belonging to this roadmap. Half B is the one that keeps
 * working after the roadmap is closed.
 *
 * ## Citation is not invocation, and the scan has to know the difference
 *
 * Step 5.1 cites `src/scripts/description_route_check.ts:18-30` — by name, in a
 * code span — because that file's header is the documented statement of the
 * proxy-to-real gap. A scanner that read a file citation as an invocation would
 * fire on the step that exists to describe the limitation, which is the
 * false-positive shape that gets a gate deleted. So half A narrows to code
 * spans with a COMMAND shape (a runner prefix, or a flag) and applies the
 * banned set only to those.
 *
 * ## What the park itself is owed
 *
 * `later/` is excluded from the dashboard and from `/roadmap:process-*`, so the
 * park is only intact while the file is actually there. The last case asserts
 * it, because "the park stays intact" is falsified by a deletion just as much
 * as by a live run.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/**
 * The roadmap, wherever it lives. It was archived on 2026-08-31 when its last
 * box closed, and a hardcoded active-tree path turned half A red on the move —
 * a guard that dies of its own subject being completed is a guard that stops
 * watching exactly when the file becomes read-only and nobody is looking. The
 * two candidates are tried in order and a miss THROWS: a resolver that returned
 * a missing path would let half A scan nothing and exit green, which is the
 * vacuity this file's own anti-vacuity assertions exist to prevent.
 */
function resolveRoadmap(): string {
    const candidates = [
        path.join(REPO, 'agents', 'roadmaps', 'road-to-governed-harness-evolution.md'),
        path.join(REPO, 'agents', 'roadmaps', 'archive', 'road-to-governed-harness-evolution.md'),
    ];
    const hit = candidates.find((c) => existsSync(c));
    if (hit === undefined) {
        throw new Error(
            `road-to-governed-harness-evolution.md is in neither the active tree nor archive/ — ` +
                `tried:\n  ${candidates.join('\n  ')}`,
        );
    }
    return hit;
}

const ROADMAP = resolveRoadmap();
const PARK = path.join(
    REPO,
    'agents',
    'roadmaps',
    'later',
    'road-to-routing-assurance-live-floors.md',
);
const ROADMAP_SLUG = 'road-to-governed-harness-evolution';

/** Every way this tree can reach a LIVE routing harness. */
const LIVE_HARNESS: Array<[string, RegExp]> = [
    ['live-backend', /\bLiveBackend\b/],
    ['cached-live', /cached-live/],
    ['route-check-invocation', /description_route_check\b/],
    ['live-flag', /--backend[= ]\S*live|--live\b/],
    ['model-endpoint', /api\.(openai|anthropic)\.com|\/v1\/(chat\/completions|messages)\b/],
    ['council-run', /\bcouncil_cli\b|\bai_council\b/],
    ['model-client', /\bnew\s+(OpenAI|Anthropic)\b|@anthropic-ai/],
];

export function findLiveHarness(text: string): string[] {
    return LIVE_HARNESS.filter(([, re]) => re.test(text)).map(([name]) => name);
}

export function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// --- § half A — the roadmap's own step bullets -------------------------------

export interface Step {
    line: number;
    text: string;
}

/** Each `- [ ]` bullet with its indented continuation lines. */
export function stepBullets(markdown: string): Step[] {
    const lines = markdown.split('\n');
    const steps: Step[] = [];
    let current: Step | null = null;
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i] ?? '';
        if (/^- \[[ x~\-]\] /.test(l)) {
            if (current !== null) steps.push(current);
            current = { line: i + 1, text: l };
        } else if (current !== null && /^ {4,}\S/.test(l)) {
            current.text += `\n${l}`;
        } else if (current !== null) {
            steps.push(current);
            current = null;
        }
    }
    if (current !== null) steps.push(current);
    return steps;
}

/**
 * Inline code spans that look like a COMMAND — a runner prefix or a flag.
 * A bare `path/to/file.ts:12-30` citation is deliberately not one.
 */
export function commandSpans(text: string): string[] {
    const spans = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? '');
    return spans.filter(
        (span) =>
            /^(\.\/scripts-run|agent-config|npx|node|task|bash|pnpm|yarn|gh)\b/.test(span.trim()) ||
            /(^|\s)--\S/.test(span),
    );
}

describe('5.2 half A — no step in this roadmap invokes a live routing harness', () => {
    const markdown = readFileSync(ROADMAP, 'utf-8');
    const steps = stepBullets(markdown);

    it('the step parser finds the roadmap`s steps (a scan over nothing exits green)', () => {
        expect(steps.length).toBeGreaterThan(20);
        expect(steps.some((s) => s.text.includes('**5.2 Keep the live-floors park intact.**'))).toBe(true);
    });

    it('the command-span extractor tells an invocation from a citation', () => {
        expect(commandSpans('cites `src/scripts/description_route_check.ts:18-30` only')).toEqual([]);
        expect(commandSpans('run `./scripts-run src/scripts/evolution_lab run`')).toEqual([
            './scripts-run src/scripts/evolution_lab run',
        ]);
        expect(commandSpans('run `agent-config gates --all --json`')).toEqual([
            'agent-config gates --all --json',
        ]);
    });

    it('the live-harness detector FIRES on an invocation (negative polarity)', () => {
        const planted =
            '- [ ] **9.9 Measure it live.** Run\n' +
            '      `./scripts-run src/scripts/description_route_check --backend cached-live`.\n' +
            '      verify: nothing.\n';
        const found = stepBullets(planted).flatMap((s) => commandSpans(s.text).flatMap(findLiveHarness));
        expect(found).toContain('cached-live');
        expect(found).toContain('route-check-invocation');
        expect(found).toContain('live-flag');
    });

    it('the detector is silent on a citation of the same file (positive polarity)', () => {
        const cited =
            '- [ ] **5.1 Measure the signal.** `src/scripts/description_route_check.ts:18-30`\n' +
            '      documents the proxy gap.\n';
        expect(stepBullets(cited).flatMap((s) => commandSpans(s.text).flatMap(findLiveHarness))).toEqual(
            [],
        );
    });

    it('and the real roadmap carries none of them', () => {
        const offenders: Array<{ line: number; hits: string[] }> = [];
        let spansSeen = 0;
        for (const s of steps) {
            const spans = commandSpans(s.text);
            spansSeen += spans.length;
            const hits = spans.flatMap(findLiveHarness);
            if (hits.length > 0) offenders.push({ line: s.line, hits });
        }
        // The scan must have had something to look at.
        expect(spansSeen).toBeGreaterThan(0);
        expect(offenders).toEqual([]);
    });
});

// --- § half B — the code this roadmap's steps touch --------------------------

/** Every `.ts` under `src/` that declares itself as belonging to this roadmap. */
export function roadmapOwnedSources(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
            const full = path.join(dir, entry);
            if (statSync(full).isDirectory()) {
                walk(full);
            } else if (entry.endsWith('.ts') && readFileSync(full, 'utf-8').includes(ROADMAP_SLUG)) {
                out.push(full);
            }
        }
    };
    walk(path.join(root, 'src'));
    return out.sort();
}

describe('5.2 half B — the code the steps touch reaches no live harness', () => {
    const owned = roadmapOwnedSources(REPO);

    it('finds the roadmap-owned modules (a scan over nothing exits green)', () => {
        const names = owned.map((f) => path.basename(f));
        expect(owned.length).toBeGreaterThan(5);
        expect(names).toContain('evolution_lab.ts');
        expect(names).toContain('evaluation_vector.ts');
        expect(names).toContain('curator_ops.ts');
    });

    it('none of them carries a live-harness construct', () => {
        const offenders: Record<string, string[]> = {};
        for (const f of owned) {
            const hits = findLiveHarness(stripComments(readFileSync(f, 'utf-8')));
            if (hits.length > 0) offenders[path.relative(REPO, f)] = hits;
        }
        expect(offenders).toEqual({});
    });

    it('the comment stripper is not why they pass', () => {
        const lab = owned.find((f) => f.endsWith('evolution_lab.ts'));
        expect(lab).toBeDefined();
        expect(stripComments(readFileSync(lab as string, 'utf-8')).length).toBeGreaterThan(4000);
    });
});

// --- § the park itself -------------------------------------------------------

describe('5.2 — the live-floors park is intact', () => {
    it('the parked roadmap still exists, under later/', () => {
        expect(existsSync(PARK)).toBe(true);
        const body = readFileSync(PARK, 'utf-8');
        expect(body).toContain('status: later');
        expect(body).toContain('2/2');
    });
});
