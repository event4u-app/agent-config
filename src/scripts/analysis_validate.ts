/**
 * analysis_validate.ts — the deterministic gate between `emitted` and
 * `validated`. Every claim carries an anchor and a tier, every step a
 * `verify:` line, a council dissent has its section, and the emitted files
 * pass the roadmap gates. Any failure leaves the run in `emitted`, naming
 * each failure; no model judge decides.
 *
 * `lint_roadmap_complexity` and `lint_plan_risk_register` read the emitted
 * files where they lie. The other three gates read this package's own tree,
 * so for a run on another project they check nothing of it — the content
 * checks are what travels.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { EVIDENCE_TIERS } from './analysis_ledger.js';
import { RunError, loadRun, transition, type RunRecord } from './analysis_run.js';

export const VALIDATION_GATES = [
    'lint_roadmap_complexity',
    'lint_roadmap_blockers',
    'lint_plan_risk_register',
    'check_references',
    'check_estate_count',
] as const;
export type ValidationGate = (typeof VALIDATION_GATES)[number];

export type GateRunner = (gate: ValidationGate, ctx: { projectRoot: string; files: readonly string[] }) => { ok: boolean; detail: string };

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EVIDENCE_RE = new RegExp(`Evidence \\((${EVIDENCE_TIERS.join('|')})\\): \`[^\`]+\``);

export const scriptGateRunner: GateRunner = (gate, ctx) => {
    const args =
        gate === 'lint_roadmap_complexity' ? ['--root', ctx.projectRoot] : gate === 'lint_plan_risk_register' ? [...ctx.files] : [];
    const res = spawnSync(path.join(PACKAGE_ROOT, 'scripts-run'), [`src/scripts/${gate}`, ...args], {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
    });
    const detail = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim().split('\n').slice(-3).join(' | ');
    return { ok: res.status === 0, detail };
};

/** Content failures of one emitted roadmap, in document order. */
export function contentFailures(body: string, name: string, opts: { councilDissent: boolean }): string[] {
    const out: string[] = [];
    const phases = body.split(/^## /m).slice(1);
    for (const section of phases) {
        const heading = section.split('\n', 1)[0] as string;
        if (!heading.startsWith('Phase ')) continue;
        if (!EVIDENCE_RE.test(section)) out.push(`${name}: claim of "${heading}" carries no anchor and tier`);
        const lines = section.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const m = /^- \[[ x~-]\] \*\*(\d+\.\d+)/.exec(lines[i] as string);
            if (m === null) continue;
            let j = i + 1;
            let found = false;
            while (j < lines.length && !/^- \[/.test(lines[j] as string)) {
                if (/^\s+verify:/.test(lines[j] as string)) found = true;
                j++;
            }
            if (!found) out.push(`${name}: step ${m[1] as string} has no verify: line`);
        }
    }
    if (opts.councilDissent && !/^## Dissent\b/m.test(body)) {
        out.push(`${name}: the council recorded dissent and the roadmap carries no "## Dissent" section`);
    }
    return out;
}

export function validateEmitted(input: {
    runDir: string;
    record: RunRecord;
    projectRoot: string;
    files: readonly string[];
    councilDissent: boolean;
    runner?: GateRunner;
    /** On a fixture run: the findings the fixture holds, and the ones the run emitted. */
    recovery?: { expected: readonly string[]; found: readonly string[] };
}): { record: RunRecord; failures: string[] } {
    if (input.record.state !== 'emitted') {
        throw new RunError(`validation runs on an emitted run, not one in ${input.record.state}`);
    }
    const failures = input.files.flatMap((f) =>
        contentFailures(fs.readFileSync(f, 'utf8'), path.basename(f), { councilDissent: input.councilDissent }),
    );
    if (input.recovery !== undefined) {
        const { expected, found } = input.recovery;
        for (const id of expected) if (!found.includes(id)) failures.push(`fixture finding ${id} not recovered`);
        for (const id of found) if (!expected.includes(id)) failures.push(`finding ${id} is not in the fixture`);
    }
    const runner = input.runner ?? scriptGateRunner;
    for (const gate of VALIDATION_GATES) {
        const res = runner(gate, { projectRoot: input.projectRoot, files: input.files });
        if (!res.ok) failures.push(`gate ${gate} failed: ${res.detail}`);
    }
    if (failures.length > 0) return { record: input.record, failures };
    return { record: transition(input.runDir, input.record, 'validated'), failures };
}

function flag(argv: readonly string[], name: string): string | null {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? (argv[i + 1] ?? null) : null;
}

/**
 * `analysis_validate --run <run-dir> --root <project-root> [--content-only] [<emitted file>…]`.
 * `--content-only` skips the five tree gates and says so: they read this
 * package's tree, so on another project they check nothing of it.
 */
export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const runDir = flag(argv, 'run');
    const root = flag(argv, 'root');
    if (runDir === null || root === null) {
        process.stderr.write('usage: analysis_validate --run <run-dir> --root <project-root> [--content-only] [<file>…]\n');
        return 2;
    }
    const valued = new Set([runDir, root]);
    const files = argv.filter((a) => !a.startsWith('--') && !valued.has(a));
    const contentOnly = argv.includes('--content-only');
    const runner: GateRunner | undefined = contentOnly ? () => ({ ok: true, detail: 'skipped (--content-only)' }) : undefined;
    let record: RunRecord;
    try {
        record = loadRun(runDir);
        const res = validateEmitted({ runDir, record, projectRoot: root, files, councilDissent: argv.includes('--council-dissent'), ...(runner === undefined ? {} : { runner }) });
        for (const f of res.failures) process.stdout.write(`${f}\n`);
        process.stdout.write(`analysis_validate: ${res.record.state}${contentOnly ? ' (tree gates skipped: --content-only)' : ''}\n`);
        return res.failures.length === 0 ? 0 : 1;
    } catch (err) {
        process.stderr.write(`analysis_validate: ${err instanceof Error ? err.message : String(err)}\n`);
        return 2;
    }
}

function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    try {
        return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href ||
            fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (isCliEntry()) process.exit(main());
