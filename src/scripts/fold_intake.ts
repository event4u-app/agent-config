#!/usr/bin/env tsx
/**
 * Idempotent extractive fold rollup over the gitignored intake JSONL —
 * road-to-second-brain Phase 3 (council 2026-07-07, verdict:
 * `agents/settings/contexts/second-brain-delta-verdict.md`).
 *
 * Deterministic compression for the linearly-growing intake stream:
 *   - **2^k batching** — consecutive, non-overlapping batches of
 *     `--batch-size` events (default 32; must be a power of two) in stable
 *     file+line order. Only COMPLETE batches fold; the tail stays live.
 *   - **Deterministic fold IDs** — sha256 over the batch's raw JSONL lines,
 *     first 12 hex chars. Same input → same ID, always.
 *   - **Children never mutated** — the intake files are read-only to this
 *     script; a fold is an ADDITIVE archive page with link-backs
 *     (`<file>:<first-line>-<last-line>` per child range), never a rewrite.
 *   - **Idempotent** — an existing `fold-<id>.md` is skipped, so re-runs are
 *     no-ops and interrupted runs resume cleanly.
 *
 * MANUAL TRIGGER ONLY (council decision): this script is deliberately NOT
 * wired into hooks or CI. The Phase-0 intake tripwire
 * (`lint_knowledge_scale.ts`, intake > 2000 events) names this script as its
 * pre-decided activation path — when it fires, wire the script into the
 * post-session/CI cadence. Tracked files (`agents/knowledge/sessions/`) are
 * NEVER fold-compressed here; that path requires the consolidate gate.
 *
 * Usage:
 *   fold_intake.ts [--intake-dir agents/knowledge/intake]
 *                  [--out-dir agents/memory/archive]
 *                  [--batch-size 32] [--dry-run] [--format text|json]
 *
 * Exit codes: 0 = ok (including nothing-to-fold), 2 = usage error,
 * 3 = internal error.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { generatedByQuote } from './_lib/generated_by.js';

const PROG = 'fold_intake.ts';

export const DEFAULT_BATCH_SIZE = 32;
const DEFAULT_INTAKE_DIR = path.join('agents', 'knowledge', 'intake');
const DEFAULT_OUT_DIR = path.join('agents', 'memory', 'archive');
const SNIPPET_CHARS = 140;

export interface IntakeLine {
    file: string; // relative or absolute path as discovered
    line: number; // 1-based line number within the file
    raw: string; // raw JSONL line (trimmed)
}

export interface FoldPlan {
    id: string;
    index: number; // 0-based batch index in the stable order
    children: IntakeLine[];
}

function listIntakeFiles(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    return names
        .filter((n) => n.startsWith('events-') && n.endsWith('.jsonl'))
        .sort()
        .map((n) => path.join(dir, n));
}

/** Stable event order: sorted(files) then line order. Children read-only. */
export function readIntakeLines(dir: string): IntakeLine[] {
    const out: IntakeLine[] = [];
    for (const file of listIntakeFiles(dir)) {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf-8');
        } catch {
            continue;
        }
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const raw = (lines[i] ?? '').trim();
            if (!raw) continue;
            out.push({ file, line: i + 1, raw });
        }
    }
    return out;
}

export function foldId(children: IntakeLine[]): string {
    const h = createHash('sha256');
    for (const c of children) {
        h.update(c.raw);
        h.update('\n');
    }
    return h.digest('hex').slice(0, 12);
}

/** Consecutive complete batches of `batchSize`; the tail stays unfolded. */
export function planFolds(lines: IntakeLine[], batchSize: number): FoldPlan[] {
    const plans: FoldPlan[] = [];
    const complete = Math.floor(lines.length / batchSize);
    for (let b = 0; b < complete; b++) {
        const children = lines.slice(b * batchSize, (b + 1) * batchSize);
        plans.push({ id: foldId(children), index: b, children });
    }
    return plans;
}

function snippet(raw: string): string {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return raw.slice(0, SNIPPET_CHARS);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return raw.slice(0, SNIPPET_CHARS);
    }
    const e = parsed as Record<string, unknown>;
    const ts = typeof e.ts === 'string' ? e.ts : '';
    const type = typeof e.type === 'string' ? e.type : 'event';
    // First string field that carries the claim, by event-type precedence.
    const claim =
        [e.pattern, e.correction, e.endpoint, e.observation, e.body, e.text].find(
            (v): v is string => typeof v === 'string' && v.trim().length > 0,
        ) ?? '';
    const oneLine = claim.replace(/\s+/g, ' ').trim();
    const clipped = oneLine.length > SNIPPET_CHARS ? oneLine.slice(0, SNIPPET_CHARS - 1) + '…' : oneLine;
    return [ts, type, clipped].filter(Boolean).join(' · ');
}

/** Contiguous per-file line ranges for the link-back section. */
export function childRanges(children: IntakeLine[]): string[] {
    const ranges: string[] = [];
    let start: IntakeLine | null = null;
    let prev: IntakeLine | null = null;
    const flush = (): void => {
        if (start && prev) {
            ranges.push(
                start.line === prev.line
                    ? `${start.file}:${start.line}`
                    : `${start.file}:${start.line}-${prev.line}`,
            );
        }
    };
    for (const c of children) {
        if (prev && c.file === prev.file && c.line === prev.line + 1) {
            prev = c;
            continue;
        }
        flush();
        start = c;
        prev = c;
    }
    flush();
    return ranges;
}

export function renderFold(plan: FoldPlan, batchSize: number): string {
    const lines: string[] = [
        `# Fold ${plan.id}`,
        '',
        '> Idempotent extractive rollup of a completed intake batch',
        `> (batch ${plan.index}, size ${batchSize}). Children are never mutated —`,
        '> this page is an additive archive with link-backs, not a rewrite.',
        generatedByQuote('fold_intake', '(deterministic, no LLM.)'),
        '',
        `Fold ID: ${plan.id}`,
        `Batch index: ${plan.index}`,
        `Events: ${plan.children.length}`,
        '',
        '## Extract',
        '',
    ];
    for (const c of plan.children) {
        lines.push(`- ${snippet(c.raw)}`);
    }
    lines.push('', '## Children (link-backs)', '');
    for (const r of childRanges(plan.children)) {
        lines.push(`- ${r}`);
    }
    lines.push('');
    return lines.join('\n');
}

function main(argv: string[]): number {
    let intakeDir = DEFAULT_INTAKE_DIR;
    let outDir = DEFAULT_OUT_DIR;
    let batchSize = DEFAULT_BATCH_SIZE;
    let dryRun = false;
    let format = 'text';

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = (): string => {
            const v = argv[++i];
            if (v === undefined) {
                process.stderr.write(`${PROG}: error: ${a} requires a value\n`);
                process.exit(2);
            }
            return v;
        };
        if (a === '--intake-dir') intakeDir = next();
        else if (a === '--out-dir') outDir = next();
        else if (a === '--batch-size') {
            batchSize = Number(next());
            if (!Number.isInteger(batchSize) || batchSize < 2 || (batchSize & (batchSize - 1)) !== 0) {
                process.stderr.write(`${PROG}: error: --batch-size must be a power of two >= 2\n`);
                return 2;
            }
        } else if (a === '--dry-run') dryRun = true;
        else if (a === '--format') {
            format = next();
            if (format !== 'text' && format !== 'json') {
                process.stderr.write(`${PROG}: error: --format must be text|json\n`);
                return 2;
            }
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                `usage: ${PROG} [--intake-dir <dir>] [--out-dir <dir>] ` +
                    `[--batch-size <2^k>] [--dry-run] [--format text|json]\n`,
            );
            return 0;
        } else {
            process.stderr.write(`${PROG}: error: unknown argument ${a}\n`);
            return 2;
        }
    }

    try {
        const lines = readIntakeLines(intakeDir);
        const plans = planFolds(lines, batchSize);
        const results: Array<{ id: string; index: number; events: number; action: string }> = [];

        for (const plan of plans) {
            const target = path.join(outDir, `fold-${plan.id}.md`);
            let action: string;
            if (fs.existsSync(target)) {
                action = 'exists (skipped — idempotent)';
            } else if (dryRun) {
                action = 'would write';
            } else {
                fs.mkdirSync(outDir, { recursive: true });
                const tmp = `${target}.tmp-${process.pid}`;
                fs.writeFileSync(tmp, renderFold(plan, batchSize), 'utf-8');
                fs.renameSync(tmp, target);
                action = 'written';
            }
            results.push({ id: plan.id, index: plan.index, events: plan.children.length, action });
        }

        const tail = lines.length - plans.length * batchSize;
        if (format === 'json') {
            process.stdout.write(
                JSON.stringify(
                    { dry_run: dryRun, batch_size: batchSize, total_events: lines.length, unfolded_tail: tail, folds: results },
                    null,
                    2,
                ) + '\n',
            );
        } else {
            for (const r of results) {
                process.stdout.write(`fold-${r.id}  batch=${r.index}  events=${r.events}  ${r.action}\n`);
            }
            process.stdout.write(
                `${PROG}: ${results.length} fold(s), ${tail} event(s) in the live tail (batch size ${batchSize}${dryRun ? ', dry-run' : ''})\n`,
            );
        }
        return 0;
    } catch (exc) {
        process.stderr.write(`${PROG}: internal error: ${String(exc)}\n`);
        return 3;
    }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
