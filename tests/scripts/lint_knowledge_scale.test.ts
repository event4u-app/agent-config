// Tests for src/scripts/lint_knowledge_scale.ts (memory/knowledge validation
// Phase 0-pre).
//
// Contract under test: the five scale tripwires fire above (and stay silent
// below) their thresholds, every warning names its pre-decided activation
// path, exclusions hold (README/INDEX, memory intake/archive/knowledge
// scratch), and the script NEVER fails the build (warn-only exit 0).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    CORPUS_FILES_MAX,
    HOT_CONTEXT_TOKENS_MAX,
    CHARS_PER_TOKEN,
    INTAKE_EVENTS_MAX,
    SESSIONS_PAGES_MAX,
    TYPE_FILES_MAX,
    collectTypeCounts,
    runChecks,
} from '../../src/scripts/lint_knowledge_scale.js';
import { runTs } from './_wave8g.js';

const tmp: string[] = [];
function mkRoot(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-scale-'));
    tmp.push(d);
    return d;
}
afterEach(() => {
    while (tmp.length) {
        fs.rmSync(tmp.pop() as string, { recursive: true, force: true });
    }
});

function seedFiles(dir: string, count: number, ext = '.md'): void {
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < count; i++) fs.writeFileSync(path.join(dir, `f-${i}${ext}`), 'x\n', 'utf-8');
}

function rules(root: string): string[] {
    return runChecks(root).map((w) => w.rule);
}

describe('lint_knowledge_scale — tripwires', () => {
    it('empty root: every tripwire silent', () => {
        expect(runChecks(mkRoot())).toEqual([]);
    });

    it('intake-scale fires above the event threshold and names fold_intake', () => {
        const root = mkRoot();
        const dir = path.join(root, 'agents', 'knowledge', 'intake');
        fs.mkdirSync(dir, { recursive: true });
        const lines = Array.from({ length: INTAKE_EVENTS_MAX + 1 }, (_, i) => `{"n":${i}}`);
        fs.writeFileSync(path.join(dir, 'events-2026-07.jsonl'), lines.join('\n') + '\n', 'utf-8');

        const warnings = runChecks(root);
        expect(warnings.map((w) => w.rule)).toEqual(['intake-scale']);
        expect(warnings[0]?.message).toContain('fold_intake.ts');
        expect(warnings[0]?.metric).toBe(`${INTAKE_EVENTS_MAX + 1}/${INTAKE_EVENTS_MAX}`);
    });

    it('intake-scale ignores non events-*.jsonl files', () => {
        const root = mkRoot();
        const dir = path.join(root, 'agents', 'knowledge', 'intake');
        fs.mkdirSync(dir, { recursive: true });
        const lines = Array.from({ length: INTAKE_EVENTS_MAX + 1 }, (_, i) => `{"n":${i}}`);
        fs.writeFileSync(path.join(dir, 'signals-2026-07.jsonl'), lines.join('\n') + '\n', 'utf-8');
        expect(rules(root)).toEqual([]);
    });

    it('sessions-scale fires above the page threshold', () => {
        const root = mkRoot();
        seedFiles(path.join(root, 'agents', 'knowledge', 'sessions'), SESSIONS_PAGES_MAX + 1);
        const warnings = runChecks(root);
        expect(warnings.map((w) => w.rule)).toEqual(['sessions-scale']);
        expect(warnings[0]?.message).toContain('consolidate-gate');
    });

    it('type-scale fires for a single oversized memory type', () => {
        const root = mkRoot();
        seedFiles(path.join(root, 'agents', 'memory', 'ownership'), TYPE_FILES_MAX + 1, '.yml');
        const warnings = runChecks(root);
        expect(warnings.map((w) => w.rule)).toEqual(['type-scale']);
        expect(warnings[0]?.message).toContain('BM25');
    });

    it('corpus-scale fires on the cross-type total without any single type firing', () => {
        const root = mkRoot();
        const perType = Math.ceil((CORPUS_FILES_MAX + 3) / 3); // each below TYPE_FILES_MAX? guard below
        expect(perType).toBeLessThanOrEqual(TYPE_FILES_MAX);
        for (const t of ['ownership', 'domain-invariants', 'product-rules']) {
            seedFiles(path.join(root, 'agents', 'memory', t), perType, '.yml');
        }
        const warnings = runChecks(root);
        expect(warnings.map((w) => w.rule)).toEqual(['corpus-scale']);
    });

    it('hot-context-budget fires above the token estimate cap', () => {
        const root = mkRoot();
        const hot = path.join(root, 'agents', 'runtime', 'state', 'hot-context.md');
        fs.mkdirSync(path.dirname(hot), { recursive: true });
        fs.writeFileSync(hot, 'y'.repeat((HOT_CONTEXT_TOKENS_MAX + 1) * CHARS_PER_TOKEN), 'utf-8');
        const warnings = runChecks(root);
        expect(warnings.map((w) => w.rule)).toEqual(['hot-context-budget']);
        expect(warnings[0]?.message).toContain('deterministic writer');
    });

    it('exclusions hold: README/INDEX cards, memory intake/archive/knowledge scratch', () => {
        const root = mkRoot();
        const kDir = path.join(root, 'agents', 'knowledge');
        fs.mkdirSync(kDir, { recursive: true });
        fs.writeFileSync(path.join(kDir, 'README.md'), 'x', 'utf-8');
        fs.writeFileSync(path.join(kDir, 'INDEX.md'), 'x', 'utf-8');
        fs.writeFileSync(path.join(kDir, 'a-card.md'), 'x', 'utf-8');
        seedFiles(path.join(root, 'agents', 'memory', 'intake'), 10, '.jsonl');
        seedFiles(path.join(root, 'agents', 'memory', 'archive'), 10);
        seedFiles(path.join(root, 'agents', 'memory', 'knowledge'), 10);

        const counts = collectTypeCounts(root);
        expect(counts.get('knowledge/cards')).toBe(1);
        expect([...counts.keys()].filter((k) => /memory\/(intake|archive|knowledge)/.test(k))).toEqual([]);
    });
});

describe('lint_knowledge_scale — CLI warn-only contract', () => {
    it('fired tripwires still exit 0 (warnings never fail the build)', () => {
        const root = mkRoot();
        seedFiles(path.join(root, 'agents', 'knowledge', 'sessions'), SESSIONS_PAGES_MAX + 1);
        const r = runTs('lint_knowledge_scale', ['--dir', root]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('[sessions-scale]');
        expect(r.stdout).toContain('warn-only, build not failed');
    });

    it('--format json emits the warnings envelope', () => {
        const root = mkRoot();
        seedFiles(path.join(root, 'agents', 'knowledge', 'sessions'), SESSIONS_PAGES_MAX + 1);
        const r = runTs('lint_knowledge_scale', ['--dir', root, '--format', 'json']);
        expect(r.status).toBe(0);
        const report = JSON.parse(r.stdout);
        expect(report.warnings).toHaveLength(1);
        expect(report.warnings[0].rule).toBe('sessions-scale');
    });

    it('clean root is quiet-capable and exits 0', () => {
        const root = mkRoot();
        expect(runTs('lint_knowledge_scale', ['--dir', root]).stdout).toContain('all scale tripwires silent');
        expect(runTs('lint_knowledge_scale', ['--dir', root, '--quiet']).stdout.trim()).toBe('');
    });

    it('usage errors exit 1', () => {
        const r = runTs('lint_knowledge_scale', ['--nope']);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('unknown argument');
    });
});
