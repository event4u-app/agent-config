#!/usr/bin/env tsx
/**
 * Spike S0.5 — offloadable-catalog detection (road-to-scale-and-history-
 * discipline Phase 0). F9 sync-work-in-request-path + F11 non-durable async,
 * per stack (eloquent / ts), catalog as config data.
 *
 * TP = files under true/ with ≥1 non-waived finding; FP = files under
 * lookalike/ with ≥1 non-waived finding. PASS per stack: TP ≥ 9/10 and
 * FP ≤ 1/10. Verdict is data, not a gate — exit 0 always.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { detect_offload, type SourceFile, type Stack } from '../../../src/scripts/_lib/persistence/detect_offload.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, '..', '..', 'fixtures', 'persistence', 'offload');

function collect(dir: string, stack: Stack): SourceFile[] {
    const out: SourceFile[] = [];
    const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (stack === 'eloquent' ? p.endsWith('.php') : /\.(ts|js|mjs)$/.test(p)) {
                out.push({ path: p, content: fs.readFileSync(p, 'utf8') });
            }
        }
    };
    walk(dir);
    return out;
}

interface StackVerdict {
    tp: number;
    tp_total: number;
    fp: number;
    fp_total: number;
    pass: boolean;
    missed_true: string[];
    fired_lookalike: string[];
}

function run_stack(stack: Stack): StackVerdict {
    const true_files = collect(path.join(FIXTURES, stack, 'true'), stack);
    const lookalike_files = collect(path.join(FIXTURES, stack, 'lookalike'), stack);

    const fired = (files: SourceFile[]): Set<string> => {
        const s = new Set<string>();
        for (const f of files) {
            const findings = detect_offload([f], stack).filter((x) => !x.waived);
            if (findings.length > 0) s.add(f.path);
        }
        return s;
    };

    const true_fired = fired(true_files);
    const lookalike_fired = fired(lookalike_files);
    const tp = true_fired.size;
    const fp = lookalike_fired.size;
    return {
        tp,
        tp_total: true_files.length,
        fp,
        fp_total: lookalike_files.length,
        pass: tp >= 9 && fp <= 1 && true_files.length === 10 && lookalike_files.length === 10,
        missed_true: true_files.filter((f) => !true_fired.has(f.path)).map((f) => path.basename(f.path)),
        fired_lookalike: [...lookalike_fired].map((p) => path.basename(p)),
    };
}

function main(): void {
    const eloquent = run_stack('eloquent');
    const ts = run_stack('ts');
    const pass = eloquent.pass && ts.pass;
    const verdict = { spike: 'S0.5', stacks: { eloquent, ts }, pass };
    process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');
    process.stdout.write(
        `${pass ? '✅' : '❌'}  S0.5 offload: eloquent ${eloquent.tp}/10 TP · ${eloquent.fp}/10 FP — ` +
            `ts ${ts.tp}/10 TP · ${ts.fp}/10 FP (per-stack PASS: TP≥9, FP≤1)\n`,
    );
}

main();
