#!/usr/bin/env tsx
/**
 * eval_ui_triviality — pre-registered recall of the ui/ui-trivial intent
 * classifier over the council-labelled golden corpus.
 *
 * Pre-registered claim (frozen in the corpus header BEFORE any classifier
 * change; commit ancestry is the freeze proof): the classifier must route
 * >= 0.80 of the `label: trivial` tasks to the `ui-trivial` directive set.
 *
 * READ-ONLY over both inputs: this runner never edits the corpus and never
 * touches the classifier. It REPORTS — the roadmap gates on the number, the
 * process does not fail on a MISS (exit 0 with a MISS verdict; exit 2 only
 * on a broken/empty corpus).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import {
    classify_intent,
    directive_set_for,
} from '../agent-src/templates/scripts/work_engine/intent/classify.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CORPUS_REL = 'internal/bench/corpora/ui-triviality-golden.yaml';
export const PREREGISTERED_RECALL = 0.8;
/** Pre-registered 2026-10-26 in the corpus, before any classifier change. */
export const BAR_ADD_CONTROL = 1.0;
export const BAR_DE_UI_RECALL = 0.8;
export const BAR_BACKEND = 1.0;

export type Category = 'trivial' | 'add-control' | 'backend' | 'ui-other';

const UI_SETS: ReadonlySet<string> = new Set(['ui', 'ui-trivial', 'mixed']);

export interface Task {
    id: string;
    prompt: string;
    label: 'trivial' | 'non-trivial';
    label_criterion?: string;
    source?: string;
    category?: Category;
    lang?: string;
}

export interface EvalRow {
    id: string;
    label: string;
    category: Category;
    lang: string;
    intent: string;
    directive_set: string;
    hit: boolean; // prediction agrees with the label
}

export interface Bar {
    name: 'add_control' | 'de_ui_recall' | 'backend';
    threshold: number;
    total: number;
    passed: number;
    share: number;
    verdict: 'PASS' | 'MISS' | 'EMPTY';
    failing: string[];
}

export interface EvalResult {
    total: number;
    trivial_total: number;
    trivial_routed: number;
    recall: number;
    precision: number;
    verdict: 'PASS' | 'MISS';
    bars: Bar[];
    rows: EvalRow[];
}

export function category_of(t: Task): Category {
    return t.category ?? (t.label === 'trivial' ? 'trivial' : 'ui-other');
}

function bar(
    name: Bar['name'],
    threshold: number,
    rows: EvalRow[],
    ok: (r: EvalRow) => boolean,
): Bar {
    const passing = rows.filter(ok);
    const share = rows.length === 0 ? 0 : passing.length / rows.length;
    return {
        name,
        threshold,
        total: rows.length,
        passed: passing.length,
        share,
        verdict: rows.length === 0 ? 'EMPTY' : share >= threshold ? 'PASS' : 'MISS',
        failing: rows.filter((r) => !ok(r)).map((r) => r.id),
    };
}

export function compute_bars(rows: EvalRow[]): Bar[] {
    return [
        bar(
            'add_control',
            BAR_ADD_CONTROL,
            rows.filter((r) => r.category === 'add-control'),
            (r) => r.directive_set !== 'ui-trivial' && r.directive_set !== 'backend',
        ),
        bar(
            'de_ui_recall',
            BAR_DE_UI_RECALL,
            rows.filter((r) => r.lang === 'de' && r.category !== 'backend'),
            (r) => UI_SETS.has(r.directive_set),
        ),
        bar(
            'backend',
            BAR_BACKEND,
            rows.filter((r) => r.category === 'backend'),
            (r) => r.directive_set === 'backend',
        ),
    ];
}

export function load_corpus(p: string): Task[] {
    const raw = parseYaml(fs.readFileSync(p, 'utf-8'));
    const tasks = Array.isArray(raw)
        ? raw
        : raw !== null && typeof raw === 'object'
          ? (raw as Record<string, unknown>)['tasks']
          : null;
    if (!Array.isArray(tasks)) {
        throw new Error(`corpus carries no task list: ${p}`);
    }
    return tasks as Task[];
}

export function run_eval(tasks: Task[]): EvalResult {
    const rows: EvalRow[] = tasks.map((t) => {
        const intent = classify_intent(t.prompt);
        const set = directive_set_for(intent);
        const predicted_trivial = set === 'ui-trivial';
        return {
            id: t.id,
            label: t.label,
            category: category_of(t),
            lang: t.lang ?? 'en',
            intent,
            directive_set: set,
            hit: predicted_trivial === (t.label === 'trivial'),
        };
    });
    const trivialRows = rows.filter((r) => r.label === 'trivial');
    const routed = trivialRows.filter((r) => r.directive_set === 'ui-trivial').length;
    const predictedTrivial = rows.filter((r) => r.directive_set === 'ui-trivial');
    const truePos = predictedTrivial.filter((r) => r.label === 'trivial').length;
    const recall = trivialRows.length === 0 ? 0 : routed / trivialRows.length;
    const precision = predictedTrivial.length === 0 ? 1 : truePos / predictedTrivial.length;
    return {
        total: rows.length,
        trivial_total: trivialRows.length,
        trivial_routed: routed,
        recall,
        precision,
        verdict: recall >= PREREGISTERED_RECALL ? 'PASS' : 'MISS',
        bars: compute_bars(rows),
        rows,
    };
}

export function render(result: EvalResult): string {
    const out: string[] = [];
    out.push(
        `ui-triviality eval — pre-registered trivial-lane recall >= ${PREREGISTERED_RECALL.toFixed(2)}`,
    );
    out.push(
        `tasks: ${result.total} · trivial: ${result.trivial_total} · routed to ui-trivial: ${result.trivial_routed}`,
    );
    out.push(
        `recall: ${result.recall.toFixed(3)} · precision: ${result.precision.toFixed(3)} · verdict: ${result.verdict}`,
    );
    for (const b of result.bars) {
        out.push(
            `bar ${b.name}: ${b.passed}/${b.total} = ${b.share.toFixed(3)} (>= ${b.threshold.toFixed(2)}) · ${b.verdict}` +
                (b.failing.length > 0 ? ` · failing: ${b.failing.join(', ')}` : ''),
        );
    }
    const misses = result.rows.filter((r) => !r.hit);
    if (misses.length > 0) {
        out.push('');
        out.push(`misses (${misses.length}):`);
        for (const m of misses) {
            out.push(`  ${m.id}: label=${m.label} → intent=${m.intent} (${m.directive_set})`);
        }
    }
    return out.join('\n') + '\n';
}

export function main(argv: string[]): number {
    const as_json = argv.includes('--json');
    const corpusPath = path.join(REPO_ROOT, CORPUS_REL);
    let tasks: Task[];
    try {
        tasks = load_corpus(corpusPath);
    } catch (e) {
        process.stderr.write(`eval_ui_triviality: ${String(e)}\n`);
        return 2;
    }
    try {
        assertScanned({
            gate: 'eval_ui_triviality',
            scanned: tasks.length,
            units: 'corpus task(s)',
            roots: [CORPUS_REL],
        });
    } catch (exc) {
        if (!(exc instanceof DeadScopeError)) throw exc;
        process.stderr.write(`❌  ${exc.message}\n`);
        return 2;
    }
    const result = run_eval(tasks);
    if (as_json) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else {
        process.stdout.write(render(result));
    }
    return 0;
}

const _HERE = fileURLToPath(import.meta.url);
if (process.argv[1] && (import.meta.url === pathToFileURL(process.argv[1]).href || path.resolve(process.argv[1]) === _HERE)) {
    process.exitCode = main(process.argv.slice(2));
}
