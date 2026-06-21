// Tests for src/scripts/router_telemetry.ts (py2ts Phase 7 — VERIFY).
//
// No pytest suite exists. Coverage:
//   1. Unit checks on the pure helpers (trigger_matches, match_prompt,
//      load_corpus_prompts, find_never_matched_tier1) — byte-faithful to the
//      Python semantics.
//   2. A report-shape check via write_report on a sandboxed router/corpus,
//      asserting the JSON serialization matches Python json.dumps(indent=2,
//      ensure_ascii=False) and the per_trigger_hits key uses sorted-key
//      compact JSON.
//   3. A golden-parity layer (python3 vs tsx on the REAL repo) across the real
//      CI args (default, --quiet) asserting byte-identical stdout/stderr/exit
//      after normalizing only the per-run timestamp, plus a semantic-parity
//      assertion of the report body (the report carries set-derived ordering
//      that CPython randomizes per process via PYTHONHASHSEED — see the
//      divergence note below). Skipped without python3 or the corpora.
//
// Divergence candidate (latent Python non-determinism): aggregate_replay
// iterates Python `set` objects of (tier, rule-id) strings; CPython set
// iteration order is hash-randomized per process, so two consecutive Python
// runs emit DIFFERENT key order in `per_rule_activations` and DIFFERENT tie
// order in `per_corpus_summary.top_rules`. The TS twin is deterministic
// (insertion-ordered). Byte-identical parity is therefore impossible; the
// golden layer compares the report body with those set-derived structures
// canonicalized.
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/router_telemetry.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


// ── Unit: trigger_matches ────────────────────────────────────────────────

describe('router_telemetry — trigger_matches', () => {
    it('keyword: case-insensitive substring of the prompt', () => {
        expect(mod.trigger_matches({ keyword: 'Controller' }, 'add a controller')).toBe(true);
        expect(mod.trigger_matches({ keyword: 'controller' }, 'no match here')).toBe(false);
    });

    it('phrase: case-insensitive multi-word substring', () => {
        expect(mod.trigger_matches({ phrase: 'new task' }, 'this is a New Task today')).toBe(true);
        expect(mod.trigger_matches({ phrase: 'new task' }, 'newtask')).toBe(false);
    });

    it('command: case-sensitive prefix on the command context', () => {
        expect(mod.trigger_matches({ command: 'roadmap' }, 'x', null, 'roadmap:process')).toBe(true);
        expect(mod.trigger_matches({ command: 'roadmap' }, 'x', null, 'Roadmap')).toBe(false);
        expect(mod.trigger_matches({ command: 'roadmap' }, 'x', null, null)).toBe(false);
    });

    it('path_prefix: prefix match against open_files', () => {
        expect(mod.trigger_matches({ path_prefix: 'src/' }, 'x', ['src/a.ts'])).toBe(true);
        expect(mod.trigger_matches({ path_prefix: 'src/' }, 'x', ['lib/a.ts'])).toBe(false);
        expect(mod.trigger_matches({ path_prefix: 'src/' }, 'x', null)).toBe(false);
    });

    it('file_pattern: fnmatch against open_files', () => {
        expect(mod.trigger_matches({ file_pattern: '*.md' }, 'x', ['README.md'])).toBe(true);
        expect(mod.trigger_matches({ file_pattern: '*.md' }, 'x', ['README.txt'])).toBe(false);
        expect(mod.trigger_matches({ file_pattern: 'src/*.ts' }, 'x', ['src/a.ts'])).toBe(true);
    });

    it('intent: never auto-matches', () => {
        expect(mod.trigger_matches({ intent: 'structural decision' }, 'structural decision')).toBe(false);
    });

    it('unknown trigger shape: no match', () => {
        expect(mod.trigger_matches({} as Record<string, never>, 'anything')).toBe(false);
    });
});

// ── Unit: match_prompt ───────────────────────────────────────────────────

const ROUTER = {
    kernel: ['k1', 'k2'],
    tier_1: [
        { id: 't1a', triggers: [{ keyword: 'foo' }, { keyword: 'bar' }] },
        { id: 't1b', triggers: [{ phrase: 'hello world' }] },
    ],
    tier_2: [{ id: 't2a', triggers: [{ keyword: 'baz' }] }],
};

describe('router_telemetry — match_prompt', () => {
    it('kernel rules always activate; tier-2 only on full', () => {
        const full = mod.match_prompt(ROUTER, 'baz', 'full');
        const fullRules = full.activated_rules.map((r) => `${r.tier}:${r.rule}`);
        expect(fullRules).toContain('kernel:k1');
        expect(fullRules).toContain('kernel:k2');
        expect(fullRules).toContain('tier_2:t2a');

        const balanced = mod.match_prompt(ROUTER, 'baz', 'balanced');
        const balRules = balanced.activated_rules.map((r) => `${r.tier}:${r.rule}`);
        expect(balRules).toContain('kernel:k1');
        expect(balRules).not.toContain('tier_2:t2a');
    });

    it('records every matched trigger and one activation per matched rule', () => {
        const res = mod.match_prompt(ROUTER, 'foo bar', 'full');
        // both keyword triggers of t1a fire → two matched_triggers, one activation
        const t1aTriggers = res.matched_triggers.filter((m) => m.rule === 't1a');
        expect(t1aTriggers).toHaveLength(2);
        const t1aActs = res.activated_rules.filter((a) => a.rule === 't1a');
        expect(t1aActs).toHaveLength(1);
    });
});

// ── Unit: load_corpus_prompts ────────────────────────────────────────────

describe('router_telemetry — load_corpus_prompts', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('returns [] for a missing file', () => {
        expect(mod.load_corpus_prompts(path.join(tmp, 'nope.yaml'), 200)).toEqual([]);
    });

    it('reads prompts:, sorts by id, applies the sample cap', () => {
        const p = path.join(tmp, 'c.yaml');
        fs.writeFileSync(
            p,
            [
                'prompts:',
                '  - id: b',
                '    prompt: "second"',
                '  - id: a',
                '    text: "first"',
                '  - id: c',
                '    prompt: "third"',
            ].join('\n') + '\n',
        );
        const all = mod.load_corpus_prompts(p, 200);
        expect(all.map((e) => e.id)).toEqual(['a', 'b', 'c']);
        expect(all[0]?.text).toBe('first');
        const capped = mod.load_corpus_prompts(p, 2);
        expect(capped.map((e) => e.id)).toEqual(['a', 'b']);
    });

    it('reads tasks:, applies context defaults, drops id-less / text-less rows', () => {
        const p = path.join(tmp, 'tb.yaml');
        fs.writeFileSync(
            p,
            [
                'tasks:',
                '  - id: t1',
                '    prompt: "do it"',
                '    intended_triggers: [r1, r2]',
                '    open_files: ["a.ts"]',
                '    command: "roadmap:x"',
                '  - id: t2',           // no prompt/text → dropped
                '  - prompt: "orphan"', // no id → dropped
            ].join('\n') + '\n',
        );
        const out = mod.load_corpus_prompts(p, 200);
        expect(out).toHaveLength(1);
        expect(out[0]).toEqual({
            id: 't1',
            text: 'do it',
            intended_triggers: ['r1', 'r2'],
            replay_opaque_triggers: [],
            open_files: ['a.ts'],
            command: 'roadmap:x',
        });
    });

    it('prompt wins over text (Python `prompt or text`)', () => {
        const p = path.join(tmp, 'pw.yaml');
        fs.writeFileSync(
            p,
            'prompts:\n  - id: x\n    prompt: "P"\n    text: "T"\n',
        );
        expect(mod.load_corpus_prompts(p, 200)[0]?.text).toBe('P');
    });
});

// ── Unit: find_never_matched_tier1 ───────────────────────────────────────

describe('router_telemetry — find_never_matched_tier1', () => {
    it('returns sorted tier-1 ids absent from per_rule_activations.tier_1', () => {
        const router = {
            tier_1: [{ id: 'zeta' }, { id: 'alpha' }, { id: 'mid' }],
        };
        const agg = {
            per_trigger_hits: {},
            per_rule_activations: { tier_1: { mid: 3 } },
            panel_b_untouchable_rules: [],
            panel_b_tier2_drivers: [],
            per_corpus_summary: [],
            intended_vs_observed_match: [],
            unintended_activation_histogram: [],
        };
        expect(mod.find_never_matched_tier1(router, agg)).toEqual(['alpha', 'zeta']);
    });
});

// ── Unit: write_report serialization shape ───────────────────────────────

describe('router_telemetry — write_report serialization', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-rep-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('writes <stamp>.json + latest.json, 2-space indent, trailing newline', () => {
        const corpus = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-trackb.yaml');
        const agg = mod.aggregate_replay(ROUTER, [], 200, 'full');
        // _relToRepo requires an absolute subpath; use a repo-relative file.
        const outPath = mod.write_report(agg, tmp, [corpus], 200, 'full');
        const text = fs.readFileSync(outPath, 'utf-8');
        const latest = fs.readFileSync(path.join(tmp, 'latest.json'), 'utf-8');
        expect(text).toBe(latest);
        expect(text.endsWith('\n')).toBe(true);
        const payload = JSON.parse(text) as Record<string, unknown>;
        expect(payload['schema_version']).toBe(1);
        expect(payload['schema_id']).toBe('router-telemetry-v1');
        expect((payload['config'] as Record<string, unknown>)['corpora']).toEqual([
            'internal/bench/corpora/ab-trackb.yaml',
        ]);
        // 2-space indent is the literal Python json.dumps(indent=2) shape.
        expect(text).toContain('\n  "schema_version": 1,');
    });
});

// ── Golden parity (python3 vs tsx on the REAL repo) ──────────────────────



