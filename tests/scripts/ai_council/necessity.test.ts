// Tests for src/scripts/ai_council/necessity.ts (py2ts Phase 1).
//
// necessity is a pure heuristic classifier (no CLI, no network). It scans a
// prompt for marker words and emits verdict / category / rationale / hit
// counts. Three public surfaces: classify_necessity, classify_size_fit,
// classify_impact (+ corpus / routing variants).
//
// Golden parity drives the LIVE Python twin via a `python3 -c` importlib
// direct-file load. necessity.py imports `low_impact_corpus` lazily INSIDE
// `load_validated_phrases`, so the bare classifier surfaces load straight
// off disk without pulling the networked package `__init__`. The corpus
// helper is exercised separately with a real temp corpus.
//
// Number divergence (ADR-094): Python `:.2f` rationale strings are already
// formatted to a fixed string, so the differential compares raw rationale
// text. Hit counts are ints on both sides.
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import {
    classify_impact,
    classify_necessity,
    classify_size_fit,
    downgrade_message,
    educate_message,
    IMPACT_TRIGGERS,
    LOCKED_IMPACT_CLASSES,
    NECESSARY_TRIGGERS,
    route_decision,
    UNNECESSARY_TRIGGERS,
} from '../../../src/scripts/ai_council/necessity.js';

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

const NECESSITY_PY = 'src/scripts/ai_council/necessity.py';

function pyLoadPreamble(): string[] {
    return [
        'import importlib.util, sys, json',
        `_spec = importlib.util.spec_from_file_location("nc", ${JSON.stringify(NECESSITY_PY)})`,
        'nc = importlib.util.module_from_spec(_spec)',
        'sys.modules["nc"] = nc',
        '_spec.loader.exec_module(nc)',
    ];
}

function py(snippet: string): string {
    const code = [...pyLoadPreamble(), snippet].join('\n');
    const r = spawnSync('python3', ['-c', code], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr}`);
    }
    return r.stdout;
}

// A broad prompt corpus exercising every bucket + the mixed / empty / strict
// / fence paths. Kept deterministic so the differential is reproducible.
const PROMPTS: string[] = [
    '',
    '   ',
    'Should we refactor the architecture and decouple these microservices?',
    'fix this crash — stack trace shows a failing test',
    'what is the syntax of a list comprehension',
    'rename this function and fix the typo', // mixed (rename in both tables)
    'I am unsure about the trade-off between these two competing options',
    'just a small change to this file',
    'we need a strategic roadmap decision on the long-term vision',
    'add a getter and a setter to this method',
    'should we choose monorepo or microservices? I am uncertain, sanity check please',
    'lint and format the file, fix indentation',
    'plain prompt with no markers at all here',
    'documentation lookup for the api of the widget',
    'rewrite the migration plan — this is a redesign with a module boundary',
];

const LENSES = ['analysis', 'debate', 'pr'];

describe('necessity — classify_necessity golden parity', () => {
    it.runIf(py3)('verdict / category / rationale / hits match python3', () => {
        const tsResults: unknown[] = [];
        for (const prompt of PROMPTS) {
            for (const lens of LENSES) {
                const r = classify_necessity(prompt, lens);
                tsResults.push({
                    verdict: r.verdict,
                    category: r.category,
                    rationale: r.rationale,
                    n: r.necessary_hits,
                    u: r.unnecessary_hits,
                });
            }
        }

        const out = py(
            `prompts = ${JSON.stringify(PROMPTS)}\n` +
                `lenses = ${JSON.stringify(LENSES)}\n` +
                'res = []\n' +
                'for p in prompts:\n' +
                '    for l in lenses:\n' +
                '        r = nc.classify_necessity(p, l)\n' +
                '        res.append({"verdict": r.verdict, "category": r.category,' +
                ' "rationale": r.rationale, "n": r.necessary_hits, "u": r.unnecessary_hits})\n' +
                'print(json.dumps(res))\n',
        );
        expect(tsResults).toEqual(JSON.parse(out));
    });
});

describe('necessity — classify_size_fit golden parity', () => {
    it.runIf(py3)('fit / suggested / reason / index / tier / hits match python3', () => {
        const ladder = ['nano', 'mini', 'standard', 'pro'];
        const models = ['nano', 'mini', 'pro', 'not-on-ladder'];
        const sizePrompts = [
            'short',
            'rename this',
            'should we decouple the architecture and rewrite the system design boundary',
            'x'.repeat(250),
            'x'.repeat(900),
            '',
        ];
        const sizeLenses = ['analysis', 'debate'];

        const tsResults: unknown[] = [];
        for (const prompt of sizePrompts) {
            for (const model of models) {
                for (const lens of sizeLenses) {
                    const v = classify_size_fit(prompt, model, ladder, lens);
                    tsResults.push({
                        fit: v.fit,
                        suggested: v.suggested_model,
                        reason: v.reason,
                        idx: v.current_index,
                        tier: v.length_tier,
                        hits: v.complexity_hits,
                    });
                }
            }
        }

        const out = py(
            `ladder = ${JSON.stringify(ladder)}\n` +
                `models = ${JSON.stringify(models)}\n` +
                `prompts = ${JSON.stringify(sizePrompts)}\n` +
                `lenses = ${JSON.stringify(sizeLenses)}\n` +
                'res = []\n' +
                'for p in prompts:\n' +
                '    for m in models:\n' +
                '        for l in lenses:\n' +
                '            v = nc.classify_size_fit(p, m, ladder, l)\n' +
                '            res.append({"fit": v.fit, "suggested": v.suggested_model,' +
                ' "reason": v.reason, "idx": v.current_index, "tier": v.length_tier,' +
                ' "hits": v.complexity_hits})\n' +
                'print(json.dumps(res))\n',
        );
        expect(tsResults).toEqual(JSON.parse(out));
    });
});

describe('necessity — classify_impact golden parity', () => {
    it.runIf(py3)('class / confidence / rationale / category match python3', () => {
        const impactPrompts = [
            '',
            'rename this variable, fix the whitespace and the typo',
            'should we use a dto vs array here, or a value object',
            'this is a breaking change to the api shape and module boundary',
            'we are touching auth, tenant boundary, billing and a schema migration',
            'plain question with no markers',
            'plan only — ask me before deciding',
            'add encryption and rotate the secret api key', // high_impact
            'wait for me, I will decide on the contract change', // fence wins over medium
        ];

        const tsResults: unknown[] = impactPrompts.map((q) => {
            const v = classify_impact(q);
            return {
                cls: v.impact_class,
                conf: v.confidence,
                rationale: v.rationale,
                category: v.category,
            };
        });

        const out = py(
            `prompts = ${JSON.stringify(impactPrompts)}\n` +
                'res = []\n' +
                'for q in prompts:\n' +
                '    v = nc.classify_impact(q)\n' +
                '    res.append({"cls": v.impact_class, "conf": v.confidence,' +
                ' "rationale": v.rationale, "category": v.category})\n' +
                'print(json.dumps(res))\n',
        );
        // Confidence is a float on both sides; JSON parse makes 0.85 == 0.85.
        expect(tsResults).toEqual(JSON.parse(out));
    });
});

describe('necessity — route_decision golden parity', () => {
    it.runIf(py3)('mode / upgraded / rationale match python3', () => {
        // Python passes objects exposing .mode / .confidence_threshold; the
        // differential builds equivalent SimpleNamespace entries.
        const classes: Record<string, { mode: string; confidence_threshold: number }> = {
            trivial: { mode: 'agent', confidence_threshold: 0.6 },
            low_impact: { mode: 'agent', confidence_threshold: 0.6 },
            medium_impact: { mode: 'council', confidence_threshold: 0.6 },
            // high_impact / user_required intentionally omitted to also test
            // the Iron-Law lock + the no-entry fallback.
        };
        const routePrompts = [
            'rename this variable', // trivial agent
            'plain question, no markers', // medium_impact default 0.3 < 0.6 → upgrade
            'should we use a dto vs array', // low_impact, conf 0.65 ≥ 0.6 → agent
            'touch auth and billing', // high_impact → user (locked)
            'a breaking change to the api shape', // medium_impact council
        ];

        const tsResults: unknown[] = routePrompts.map((q) => {
            const r = route_decision(q, classes as never);
            return { mode: r.mode, upgraded: r.upgraded, rationale: r.rationale };
        });

        const out = py(
            'from types import SimpleNamespace\n' +
                `classes_raw = ${JSON.stringify(classes)}\n` +
                'classes = {k: SimpleNamespace(**v) for k, v in classes_raw.items()}\n' +
                `prompts = ${JSON.stringify(routePrompts)}\n` +
                'res = []\n' +
                'for q in prompts:\n' +
                '    r = nc.route_decision(q, classes)\n' +
                '    res.append({"mode": r.mode, "upgraded": r.upgraded, "rationale": r.rationale})\n' +
                'print(json.dumps(res))\n',
        );
        expect(tsResults).toEqual(JSON.parse(out));
    });
});

// ── Unit tests (pure logic, no python3) ──────────────────────────────────

describe('necessity — classify_necessity unit', () => {
    it('empty prompt → unnecessary / empty', () => {
        const r = classify_necessity('   ');
        expect(r.verdict).toBe('unnecessary');
        expect(r.category).toBe('empty');
        expect(r.necessary_hits).toBe(0);
        expect(r.unnecessary_hits).toBe(0);
    });
    it('strong necessary signal → necessary', () => {
        const r = classify_necessity('architecture rewrite with a migration plan');
        expect(r.verdict).toBe('necessary');
        expect(r.category).toBe('architecture');
        expect(r.necessary_hits).toBeGreaterThanOrEqual(2);
    });
    it('strong unnecessary signal → unnecessary', () => {
        const r = classify_necessity('fix this bug — crash with a stack trace');
        expect(r.verdict).toBe('unnecessary');
        expect(r.category).toBe('bugfix');
    });
    it('debate lens nudges borderline → unnecessary with zero necessary hits', () => {
        const a = classify_necessity('lint the file', 'analysis');
        const d = classify_necessity('lint the file', 'debate');
        expect(a.verdict).toBe('borderline');
        expect(d.verdict).toBe('unnecessary');
    });
});

describe('necessity — classify_size_fit unit', () => {
    const ladder = ['nano', 'mini', 'pro'];
    it('not-on-ladder → fit, index -1', () => {
        const v = classify_size_fit('hi', 'gpt-x', ladder);
        expect(v.fit).toBe(true);
        expect(v.current_index).toBe(-1);
        expect(v.suggested_model).toBeNull();
    });
    it('smallest tier → fit', () => {
        const v = classify_size_fit('hi', 'nano', ladder);
        expect(v.fit).toBe(true);
        expect(v.current_index).toBe(0);
    });
    it('debate lens never downgrades', () => {
        const v = classify_size_fit('hi', 'pro', ladder, 'debate');
        expect(v.fit).toBe(true);
        expect(v.suggested_model).toBeNull();
    });
    it('short + no complexity → suggests next rung down', () => {
        const v = classify_size_fit('hi', 'pro', ladder);
        expect(v.fit).toBe(false);
        expect(v.suggested_model).toBe('mini');
        expect(v.length_tier).toBe('short');
    });
});

describe('necessity — classify_impact unit', () => {
    it('empty → user_required confidence 1.0', () => {
        const v = classify_impact('');
        expect(v.impact_class).toBe('user_required');
        expect(v.confidence).toBe(1.0);
    });
    it('user fence beats topic', () => {
        const v = classify_impact('plan only — change the api contract');
        expect(v.impact_class).toBe('user_required');
        expect(v.category).toBe('user_fence');
    });
    it('high_impact floors confidence at 0.85', () => {
        const v = classify_impact('rotate the secret'); // one high marker
        expect(v.impact_class).toBe('high_impact');
        expect(v.confidence).toBeGreaterThanOrEqual(0.85);
    });
    it('no markers → medium_impact 0.3', () => {
        const v = classify_impact('plain words here');
        expect(v.impact_class).toBe('medium_impact');
        expect(v.confidence).toBe(0.3);
    });
});

describe('necessity — route_decision unit', () => {
    it('locked class → user regardless of config', () => {
        const r = route_decision('rotate the secret', { high_impact: { mode: 'agent' } });
        expect(r.mode).toBe('user');
        expect(r.upgraded).toBe(false);
    });
    it('no entry → user fallback', () => {
        const r = route_decision('rename this variable', {});
        expect(r.mode).toBe('user');
    });
    it('low confidence upgrades the rung', () => {
        const r = route_decision('plain words', { medium_impact: { mode: 'agent', confidence_threshold: 0.6 } });
        // medium_impact default confidence 0.3 < 0.6 → agent → council
        expect(r.mode).toBe('council');
        expect(r.upgraded).toBe(true);
    });
});

describe('necessity — message helpers + structural parity', () => {
    it('educate_message includes category + lens', () => {
        const r = classify_necessity('fix this bug crash');
        const msg = educate_message(r, 'analysis');
        expect(msg).toContain('`bugfix`');
        expect(msg).toContain('`analysis`');
        expect(msg).toContain('--proceed-anyway');
    });
    it('downgrade_message names current + suggested', () => {
        const v = classify_size_fit('hi', 'pro', ['nano', 'mini', 'pro']);
        const msg = downgrade_message(v, 'pro');
        expect(msg).toContain('`pro`');
        expect(msg).toContain('`mini`');
    });
    it('LOCKED_IMPACT_CLASSES holds high_impact + user_required', () => {
        expect(LOCKED_IMPACT_CLASSES.has('high_impact')).toBe(true);
        expect(LOCKED_IMPACT_CLASSES.has('user_required')).toBe(true);
        expect(LOCKED_IMPACT_CLASSES.has('trivial')).toBe(false);
    });
    it('trigger-table insertion order matches python (tie-break priority)', () => {
        expect(Object.keys(NECESSARY_TRIGGERS)).toEqual([
            'architecture',
            'tradeoff',
            'ambiguity',
            'strategic',
        ]);
        expect(Object.keys(UNNECESSARY_TRIGGERS)).toEqual([
            'bugfix',
            'syntax',
            'single_file',
            'lookup',
        ]);
        expect(IMPACT_TRIGGERS.high_impact.length).toBeGreaterThan(0);
    });
});
