/**
 * Deterministic 2-arm benchmark: code graph vs grep (tool-level retrieval).
 *
 * Contract: internal/bench/code-graph/PREREGISTRATION.md — uniform per-arm
 * strategies, single probe token per question, file-level scoring against
 * hash-bound local ground truth. Refuses to run when any local truth file's
 * SHA-256 differs from the pre-registered list (post-registration edits void
 * the run).
 *
 * Zero model calls. Re-runnable: needs only ripgrep, the agent-config CLI,
 * and local clones of the three target repos (paths in the truth files).
 *
 * Usage: npx tsx internal/bench/code-graph/run_bench.ts
 *   [--truth-dir agents/tmp/bench-local] [--out internal/bench/reports]
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as yaml from 'js-yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const PREREG_HASHES: Record<string, string> = {
    'repo-a-questions.yaml': '3355305af382ca7ae24e97b3dd92c9a5c6d014d13380f34660d1e5221f5c15af',
    'repo-b-questions.yaml': 'a5c8abf09ab0515b52c16dc4798f9e3a9ae0e5550f74769811a0f52098ce6161',
    'repo-c-questions.yaml': '41389a46be59f0dc17fe92232b0bd65fd25e0d64ca4eef94bd68b5c4e70c0336',
    'probes.yaml': '284cea15b5a869dc0628d51a431151e8fe3ff693fe53d1720363b8fd8158e24d',
};

const EXCLUDES = ['vendor', 'node_modules', 'dist', '.nuxt', '.git', 'storage'];
const NEGATIVE_CONTROL_CATEGORIES = new Set(['negative-control', 'negative-control-cross-language']);

interface TruthSite { path: string; line: number; why: string }
interface Question {
    id: string;
    category: string;
    question: string;
    truth: TruthSite[];
    scoring: string;
}
interface RepoFile {
    repo: string;
    repo_local_path: string;
    repo_profile: string;
    questions: Question[];
}
interface Probe { probe: string; kind: 'symbol' | 'literal' }

interface ArmResult {
    files: Set<string>;
    wall_ms: number;
    output_bytes: number;
}

function sha256(p: string): string {
    return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function run(cmd: string, args: string[], cwd: string): { stdout: string; wall_ms: number; status: number } {
    const t0 = performance.now();
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    const wall_ms = performance.now() - t0;
    return { stdout: r.stdout ?? '', wall_ms, status: r.status ?? 1 };
}

/**
 * Arm A — uniform `git grep` over the repo's tracked files; answer = files
 * with ≥1 hit. `git grep` inherently excludes untracked/ignored trees
 * (vendor/, node_modules/, dist/), matching the EXCLUDES intent; the
 * explicit pathspec excludes below guard repos that track any of them.
 */
function armGrep(repoRoot: string, probe: Probe): ArmResult {
    const args = ['grep', '-n'];
    if (probe.kind === 'literal') {
        args.push('-F', probe.probe);
    } else {
        args.push('-P', `\\b${probe.probe}\\b`);
    }
    args.push('--', '.');
    for (const e of EXCLUDES) args.push(`:(exclude)${e}`, `:(exclude)**/${e}/**`);
    const r = run('git', args, repoRoot);
    const files = new Set<string>();
    for (const line of r.stdout.split('\n')) {
        const m = line.match(/^(.+?):\d+:/);
        if (m?.[1] !== undefined) files.add(m[1]);
    }
    return { files, wall_ms: r.wall_ms, output_bytes: Buffer.byteLength(r.stdout) };
}

/** Arm B — code-graph affected + query; answer = files in matching relation endpoints. */
function armGraph(graphPath: string, probe: Probe): ArmResult {
    // Invoke the engine CLI directly via tsx: the `agent-config code-graph`
    // dispatcher currently drops --root/--graph flags (found 2026-07-28
    // during this bench's dry run — recorded as a product finding).
    const cliTs = path.join(REPO_ROOT, 'src', 'scripts', 'code_graph', 'cli.ts');
    let stdout = '';
    let wall = 0;
    for (const sub of ['affected', 'query']) {
        const r = run('npx', ['tsx', cliTs, sub, probe.probe, '--graph', graphPath, '--budget', '500'], REPO_ROOT);
        stdout += r.stdout;
        wall += r.wall_ms;
    }
    const files = new Set<string>();
    // Relation lines look like: "  EXTRACTED <path>#<sym> --calls--> <path>#<sym>".
    // Keep an endpoint's file when its symbol segment (or file basename)
    // matches the probe — uniform across questions, no per-question tuning.
    const endpoint = /(\S+?)(?:#(\S+))?\s|(\S+?)(?:#(\S+))?$/;
    for (const line of stdout.split('\n')) {
        const m = line.match(/^\s+\w+\s+(\S+)\s+--\S+-->\s+(\S+)\s*$/);
        if (!m) continue;
        const parts = [m[1] as string, m[2] as string];
        const anyMatches = parts.some((p) => {
            const sym = p.includes('#') ? (p.split('#')[1] ?? '') : path.basename(p);
            return sym === probe.probe || sym.includes(probe.probe);
        });
        if (!anyMatches) continue;
        for (const p of parts) {
            const file = p.split('#')[0];
            if (file !== undefined && file.length > 0) files.add(file);
        }
    }
    void endpoint;
    return { files, wall_ms: wall, output_bytes: Buffer.byteLength(stdout) };
}

function score(answer: Set<string>, q: Question): { precision: number; recall: number; missed: string[]; wrong: string[] } {
    const expected = new Set<string>();
    const decoys = new Set<string>();
    for (const t of q.truth) {
        if (t.why.startsWith('DECOY')) decoys.add(t.path);
        else expected.add(t.path);
    }
    const hitExpected = [...expected].filter((f) => answer.has(f));
    const missed = [...expected].filter((f) => !answer.has(f));
    const wrong = [...answer].filter((f) => !expected.has(f));
    const recall = expected.size > 0 ? hitExpected.length / expected.size : 1;
    const precision = answer.size > 0 ? hitExpected.length / answer.size : 0;
    return { precision, recall, missed, wrong };
}

function mean(xs: number[]): number {
    return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function main(): number {
    const argv = process.argv.slice(2);
    const flag = (name: string): string | null => {
        const i = argv.indexOf(name);
        return i >= 0 ? (argv[i + 1] ?? null) : null;
    };
    const truthDir = path.resolve(REPO_ROOT, flag('--truth-dir') ?? 'agents/tmp/bench-local');
    const outDir = path.resolve(REPO_ROOT, flag('--out') ?? 'internal/bench/reports');

    // Prereg integrity gate — a hash mismatch voids the run.
    for (const [name, want] of Object.entries(PREREG_HASHES)) {
        const p = path.join(truthDir, name);
        if (!fs.existsSync(p)) {
            console.error(`missing truth file: ${p}`);
            return 2;
        }
        const got = sha256(p);
        if (got !== want) {
            console.error(`prereg hash mismatch for ${name}: ${got} != ${want} — run voided`);
            return 2;
        }
    }

    const probesDoc = yaml.load(fs.readFileSync(path.join(truthDir, 'probes.yaml'), 'utf-8')) as {
        probes: Record<string, Probe>;
    };
    const repos = ['repo-a-questions.yaml', 'repo-b-questions.yaml', 'repo-c-questions.yaml'].map(
        (f) => yaml.load(fs.readFileSync(path.join(truthDir, f), 'utf-8')) as RepoFile,
    );

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-bench-'));
    const rows: Record<string, unknown>[] = [];
    const detail: Record<string, unknown>[] = [];
    const buildTimes: Record<string, number> = {};

    for (const repo of repos) {
        if (!fs.existsSync(repo.repo_local_path)) {
            console.error(`target repo missing: ${repo.repo_local_path}`);
            return 2;
        }
        const graphPath = path.join(tmp, `${repo.repo}.json`);
        const cliTs = path.join(REPO_ROOT, 'src', 'scripts', 'code_graph', 'cli.ts');
        const b = run('npx', ['tsx', cliTs, 'build', '--root', repo.repo_local_path, '--out', graphPath], REPO_ROOT);
        if (b.status !== 0 || !fs.existsSync(graphPath)) {
            console.error(`graph build failed for ${repo.repo} (exit ${b.status})`);
            return 2;
        }
        buildTimes[repo.repo] = Math.round(b.wall_ms);

        for (const q of repo.questions) {
            const probe = probesDoc.probes[q.id];
            if (!probe) {
                console.error(`no probe registered for ${q.id}`);
                return 2;
            }
            const a = armGrep(repo.repo_local_path, probe);
            const g = armGraph(graphPath, probe);
            const sa = score(a.files, q);
            const sg = score(g.files, q);
            rows.push({
                id: q.id,
                category: q.category,
                grep: { precision: +sa.precision.toFixed(3), recall: +sa.recall.toFixed(3), wall_ms: Math.round(a.wall_ms), output_bytes: a.output_bytes },
                graph: { precision: +sg.precision.toFixed(3), recall: +sg.recall.toFixed(3), wall_ms: Math.round(g.wall_ms), output_bytes: g.output_bytes },
            });
            detail.push({
                id: q.id,
                grep: { answer: [...a.files].sort(), missed: sa.missed, wrong: sa.wrong },
                graph: { answer: [...g.files].sort(), missed: sg.missed, wrong: sg.wrong },
            });
            console.log(
                `${q.id} [${q.category}] grep P=${sa.precision.toFixed(2)} R=${sa.recall.toFixed(2)} | graph P=${sg.precision.toFixed(2)} R=${sg.recall.toFixed(2)}`,
            );
        }
    }

    const graphShaped = rows.filter((r) => !NEGATIVE_CONTROL_CATEGORIES.has(r['category'] as string));
    const negatives = rows.filter((r) => NEGATIVE_CONTROL_CATEGORIES.has(r['category'] as string));
    const m = (set: typeof rows, arm: 'grep' | 'graph', metric: 'precision' | 'recall'): number =>
        mean(set.map((r) => (r[arm] as Record<string, number>)[metric] as number));

    const summary = {
        generated: new Date().toISOString().slice(0, 10),
        questions: rows.length,
        graph_shaped: graphShaped.length,
        negative_controls: negatives.length,
        build_ms: buildTimes,
        graph_shaped_mean: {
            grep: { precision: +m(graphShaped, 'grep', 'precision').toFixed(3), recall: +m(graphShaped, 'grep', 'recall').toFixed(3) },
            graph: { precision: +m(graphShaped, 'graph', 'precision').toFixed(3), recall: +m(graphShaped, 'graph', 'recall').toFixed(3) },
        },
        negative_controls_mean: {
            grep: { recall: +m(negatives, 'grep', 'recall').toFixed(3) },
            graph: { recall: +m(negatives, 'graph', 'recall').toFixed(3) },
        },
        threshold: {
            recall_delta_pp: +((m(graphShaped, 'graph', 'recall') - m(graphShaped, 'grep', 'recall')) * 100).toFixed(1),
            recall_delta_required_pp: 10,
            precision_floor_ok: m(graphShaped, 'graph', 'precision') >= m(graphShaped, 'grep', 'precision') - 0.05,
            negative_control_ok: m(negatives, 'graph', 'recall') >= 0.9 * m(negatives, 'grep', 'recall'),
        },
        verdict: '' as string,
        rows,
    };
    const win =
        (summary.threshold.recall_delta_pp >= 10) &&
        summary.threshold.precision_floor_ok &&
        summary.threshold.negative_control_ok;
    summary.verdict = win ? 'WIN — graph clears the pre-registered threshold' : 'NULL — threshold not cleared';

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'code-graph-vs-grep.json'), `${JSON.stringify(summary, null, 2)}\n`);
    // Detail rows carry internal repo paths → local gitignored dir only.
    fs.writeFileSync(path.join(truthDir, 'run-detail.json'), `${JSON.stringify(detail, null, 2)}\n`);
    console.log(`\nverdict: ${summary.verdict}`);
    console.log(`recall delta (graph-shaped): ${summary.threshold.recall_delta_pp} pp (need >= +10)`);
    console.log(`wrote ${path.join(outDir, 'code-graph-vs-grep.json')} + local run-detail.json`);
    return 0;
}

process.exit(main());
