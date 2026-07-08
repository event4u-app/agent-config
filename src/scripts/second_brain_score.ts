#!/usr/bin/env tsx
/**
 * Deterministic second-brain recall scorer
 * (road-to-second-brain-delta-proof Phase 1).
 *
 * Scores a session-*k+1* transcript against a constructed multi-session recall
 * corpus (`internal/bench/second-brain/corpus/corpus.yml`) with ZERO
 * model-in-the-loop grading (mirrors the bench_ab scoring discipline): a task
 * passes iff the transcript contains every `must_contain` phrase and none of
 * the `must_not_contain` phrases (case-insensitive substring). The three
 * metrics (retrieval-accuracy / contradiction-catch / repair) share this
 * deterministic check; the metric label only categorises.
 *
 * This is the SCORER + the corpus — the measurement RIG. The paired 3-arm run
 * (memory-on vs memory-off vs placebo) that produces a delta is Phase 2 and is
 * spend-bearing; it is NOT run here. Until it is, the substrate carries no
 * measured task-lift claim (the CLAIMS honest-null + docs/second-brain-scope.md).
 *
 * Modes:
 *   (default)      summarise the corpus (task count per metric).
 *   --json         emit the parsed corpus.
 *   --dry-run      score the shipped hand-written transcripts under
 *                  corpus/dry-run/ (<id>.good.txt must PASS, <id>.bad.txt must
 *                  FAIL) — proves the scorer is correct AND discriminating on
 *                  known input, with no live spend. Exit 1 if any mis-scores.
 *
 * Exit codes: 0 ok / 1 dry-run mis-score / 2 usage or corpus error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const CORPUS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'second-brain', 'corpus');

export type Metric = 'retrieval-accuracy' | 'contradiction-catch' | 'repair';

export interface RecallTask {
    id: string;
    metric: Metric;
    session_k: string;
    session_k1_prompt: string;
    answer_key: {
        must_contain: string[];
        must_not_contain: string[];
    };
}

export interface TaskScore {
    id: string;
    metric: Metric;
    pass: boolean;
    missing: string[]; // required phrases absent
    forbidden: string[]; // banned phrases present
}

export function loadCorpus(corpusDir: string = CORPUS_DIR): RecallTask[] {
    const f = path.join(corpusDir, 'corpus.yml');
    const doc = parseYaml(fs.readFileSync(f, 'utf-8')) as { tasks?: RecallTask[] };
    const tasks = doc.tasks ?? [];
    if (tasks.length < 8) {
        throw new Error(`second_brain_score: corpus too small (${tasks.length} < 8)`);
    }
    return tasks;
}

/** Deterministic score of a transcript against one task. No LLM judge. */
export function scoreTask(transcript: string, task: RecallTask): TaskScore {
    const hay = transcript.toLowerCase();
    const missing = task.answer_key.must_contain.filter((p) => !hay.includes(p.toLowerCase()));
    const forbidden = task.answer_key.must_not_contain.filter((p) => hay.includes(p.toLowerCase()));
    return {
        id: task.id,
        metric: task.metric,
        pass: missing.length === 0 && forbidden.length === 0,
        missing,
        forbidden,
    };
}

interface DryRunResult {
    ok: boolean;
    problems: string[];
    goodScored: number;
    badScored: number;
}

/** Score the hand-written transcripts: good must pass, bad must fail. */
export function dryRun(corpusDir: string = CORPUS_DIR): DryRunResult {
    const tasks = loadCorpus(corpusDir);
    const dir = path.join(corpusDir, 'dry-run');
    const problems: string[] = [];
    let goodScored = 0;
    let badScored = 0;
    for (const task of tasks) {
        const goodPath = path.join(dir, `${task.id}.good.txt`);
        if (!fs.existsSync(goodPath)) {
            problems.push(`${task.id}: missing ${task.id}.good.txt`);
        } else {
            goodScored += 1;
            const s = scoreTask(fs.readFileSync(goodPath, 'utf-8'), task);
            if (!s.pass) {
                problems.push(
                    `${task.id}: good transcript scored FAIL (missing=${s.missing.join('|')} forbidden=${s.forbidden.join('|')})`,
                );
            }
        }
        const badPath = path.join(dir, `${task.id}.bad.txt`);
        if (fs.existsSync(badPath)) {
            badScored += 1;
            const s = scoreTask(fs.readFileSync(badPath, 'utf-8'), task);
            if (s.pass) {
                problems.push(`${task.id}: bad transcript scored PASS (scorer not discriminating)`);
            }
        }
    }
    if (badScored === 0) {
        problems.push('no <id>.bad.txt fixtures — cannot prove the scorer discriminates');
    }
    return { ok: problems.length === 0, problems, goodScored, badScored };
}

function _summary(tasks: RecallTask[]): string {
    const byMetric: Record<string, number> = {};
    for (const t of tasks) byMetric[t.metric] = (byMetric[t.metric] ?? 0) + 1;
    const rows = Object.entries(byMetric)
        .sort()
        .map(([m, n]) => `  ${m.padEnd(20)} ${n}`);
    return [`Second-brain recall corpus — ${tasks.length} tasks`, ...rows].join('\n');
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const known = new Set(['--json', '--dry-run']);
    for (const a of argv) {
        if (!known.has(a)) {
            process.stderr.write('usage: second_brain_score [--json | --dry-run]\n');
            return 2;
        }
    }
    let tasks: RecallTask[];
    try {
        tasks = loadCorpus();
    } catch (e) {
        process.stderr.write(`${String(e)}\n`);
        return 2;
    }
    if (argv.includes('--dry-run')) {
        const r = dryRun();
        if (!r.ok) {
            process.stdout.write('❌  second_brain_score --dry-run: scorer mis-scored known input:\n');
            for (const p of r.problems) process.stdout.write(`    - ${p}\n`);
            return 1;
        }
        process.stdout.write(
            `✅  second_brain_score --dry-run: ${r.goodScored} good→pass, ${r.badScored} bad→fail (deterministic, no spend).\n`,
        );
        return 0;
    }
    if (argv.includes('--json')) {
        process.stdout.write(JSON.stringify({ tasks }, null, 2) + '\n');
        return 0;
    }
    process.stdout.write(_summary(tasks) + '\n');
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
