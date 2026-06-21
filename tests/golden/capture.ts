/**
 * Golden Transcript baseline capture (TS twin of the retired `capture.py`).
 *
 * Drives every locked scenario through the live `.ts` work_engine via
 * `captureFull` and writes the Capture Pack under `tests/golden/baseline/GT-N/`:
 *
 *   transcript.json     — `serialise_capture` payload (per-cycle cmd/stdout/
 *                          stderr/exit + state_after, final outcome/exit)
 *   exit-codes.json     — `[{ exit_code }]` per cycle
 *   halt-markers.json   — cycle / exit / directive / recipe_action / questions
 *   delivery-report.md  — final `state.report`
 *   state-snapshots/cycle-NN.json — post-cycle state per cycle
 *   fixture/<basename>  — copy of the resolved input file
 *
 * After every pack is written it refreshes `baseline/summary.json`
 * (gt_id / outcome / exit_code / cycles, in registry order) and
 * `tests/golden/CHECKSUMS.txt` (sha256 of every baseline file, repo-relative,
 * path-sorted). The four harness-read files (exit-codes / halt-markers /
 * delivery-report / state-snapshots) are the replay contract; transcript +
 * fixture + summary are inspection / freeze-guard artifacts.
 *
 * Usage:
 *   tsx tests/golden/capture.ts                  # recapture every GT
 *   tsx tests/golden/capture.ts --scenarios GT-U1,GT-U4
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { BASELINE_ROOT, captureFull, allGtIds } from './harness.js';
import { REPO_ROOT, serialise_capture, type CaptureResult, type Dict } from './sandbox/runner.js';

const GOLDEN_ROOT = path.dirname(BASELINE_ROOT);

interface SummaryEntry {
    gt_id: string;
    outcome: string;
    exit_code: number;
    cycles: number;
}

function writeJson(file: string, value: unknown): void {
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function captureOne(gt_id: string): SummaryEntry {
    const cap: CaptureResult = captureFull(gt_id);
    const pack = path.join(BASELINE_ROOT, gt_id);
    fs.rmSync(pack, { recursive: true, force: true });
    fs.mkdirSync(path.join(pack, 'state-snapshots'), { recursive: true });
    fs.mkdirSync(path.join(pack, 'fixture'), { recursive: true });

    // transcript.json — full serialised capture
    writeJson(path.join(pack, 'transcript.json'), serialise_capture(cap));

    // exit-codes.json
    writeJson(
        path.join(pack, 'exit-codes.json'),
        cap.cycles.map((c) => ({ exit_code: c.exit_code })),
    );

    // halt-markers.json
    const markers = cap.cycles.map((c, i) => ({
        cycle: i + 1,
        exit_code: c.exit_code,
        directive: c.directive,
        recipe_action: c.recipe_action,
        questions: (c.state_after['questions'] as unknown[] | undefined) ?? [],
    }));
    writeJson(path.join(pack, 'halt-markers.json'), markers);

    // delivery-report.md
    const finalState: Dict = cap.cycles.length > 0 ? cap.cycles[cap.cycles.length - 1]!.state_after : {};
    fs.writeFileSync(path.join(pack, 'delivery-report.md'), (finalState['report'] as string | undefined) ?? '');

    // state-snapshots/cycle-NN.json
    cap.cycles.forEach((c, i) => {
        writeJson(
            path.join(pack, 'state-snapshots', `cycle-${String(i + 1).padStart(2, '0')}.json`),
            c.state_after,
        );
    });

    // fixture/<basename> — copy the resolved input file
    const inputAbs = cap.ticket_file ?? cap.prompt_file ?? cap.diff_file ?? cap.file_file;
    if (inputAbs != null) {
        fs.copyFileSync(inputAbs, path.join(pack, 'fixture', path.basename(inputAbs)));
    }

    return { gt_id, outcome: cap.final_outcome, exit_code: cap.final_exit_code, cycles: cap.cycles.length };
}

function refreshChecksums(): void {
    const files: string[] = [];
    const walk = (dir: string): void => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
            const abs = path.join(dir, ent.name);
            if (ent.isDirectory()) walk(abs);
            else files.push(abs);
        }
    };
    walk(BASELINE_ROOT);
    const lines = files
        .map((abs) => {
            const hash = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
            return `${hash}  ${path.relative(REPO_ROOT, abs)}`;
        })
        .sort((a, b) => (a.slice(66) < b.slice(66) ? -1 : 1));
    fs.writeFileSync(path.join(GOLDEN_ROOT, 'CHECKSUMS.txt'), `${lines.join('\n')}\n`);
}

function main(argv: string[]): void {
    const flagIdx = argv.indexOf('--scenarios');
    const all = allGtIds();
    let targets = all;
    if (flagIdx !== -1 && argv[flagIdx + 1] != null) {
        const requested = argv[flagIdx + 1]!.split(',').map((s) => s.trim()).filter(Boolean);
        targets = all.filter((id) => requested.includes(id));
        const missing = requested.filter((id) => !all.includes(id));
        if (missing.length > 0) throw new Error(`unknown GT id(s): ${missing.join(', ')}`);
    }

    const summaryByGt = new Map<string, SummaryEntry>();
    // Load the existing summary so a partial --scenarios run keeps other rows.
    const summaryFile = path.join(BASELINE_ROOT, 'summary.json');
    if (fs.existsSync(summaryFile)) {
        for (const e of JSON.parse(fs.readFileSync(summaryFile, 'utf-8')) as SummaryEntry[]) {
            summaryByGt.set(e.gt_id, e);
        }
    }

    for (const gt of targets) {
        const entry = captureOne(gt);
        summaryByGt.set(gt, entry);
        process.stdout.write(`captured ${gt}: ${entry.outcome} exit=${entry.exit_code} cycles=${entry.cycles}\n`);
    }

    // summary.json in registry order
    writeJson(summaryFile, all.filter((id) => summaryByGt.has(id)).map((id) => summaryByGt.get(id)!));
    refreshChecksums();
    process.stdout.write(`baseline refreshed: ${targets.length} scenario(s); summary + CHECKSUMS updated\n`);
}

main(process.argv.slice(2));
