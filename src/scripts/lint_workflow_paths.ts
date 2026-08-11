#!/usr/bin/env tsx
/**
 * lint_workflow_paths — a workflow `paths:` filter that matches nothing runs
 * nothing, silently, forever.
 *
 * ## The defect class
 *
 * A GitHub `on.<event>.paths` filter is a promise: "run this job when these
 * files change". When the named tree is renamed, retired, or gitignored, the
 * promise stops being kept and nothing says so — the workflow does not error,
 * it simply never triggers. The job still appears in the Actions list, still
 * shows green from its last real run, and a reader auditing the pipeline reads
 * an intent the pipeline no longer has.
 *
 * That is strictly worse than a missing filter. A missing filter over-triggers
 * and wastes minutes; a dead one under-triggers and hides regressions, and it
 * is invisible to every other gate in this suite: `actionlint` validates the
 * schema (a string is a valid string), and no reference checker resolves a
 * glob against the tree.
 *
 * ## Measured, not assumed
 *
 * The census that motivated this gate found **20** dead entries across 6
 * workflow files in four classes: a source tree retired by ADR-051, a
 * **gitignored** projection tree (matched by no diff, ever), two paths that
 * moved during the Python-to-TS migration, and two bare repo-root paths whose
 * real files live under `src/`. All 20 were classified before this gate was
 * written, and all 20 were repaired in the same change — so the gate ships
 * **strict** over a corpus verified empty, rather than advisory over a corpus
 * nobody looked at. A gate that reports zero findings on a corpus it has never
 * been proven able to fail on is blind, not clean; `--self-test` is what
 * separates those two.
 *
 * ## What counts as a match
 *
 * A glob matches when at least one **tracked** file matches it. Tracked, not
 * on-disk, is the correct universe on purpose: a `paths:` filter is evaluated
 * against a diff, and only tracked files appear in diffs. This is exactly why
 * `.augment/**` is dead here despite the directory existing locally — it is
 * gitignored, so no change to it can ever reach a pull request.
 *
 * Directory-shaped entries (`taskfiles/**`, or a bare `src/scripts`) match by
 * prefix, mirroring GitHub's own semantics.
 *
 * ## The escape, and why it is inline
 *
 * A filter naming a path that does not exist *yet* — a tree an in-flight PR
 * introduces — declares itself on the entry:
 *
 *     - "future/tree/ **"  # workflow-path-allow: lands in PR #1234, filter pre-staged
 *
 * The reason is required and must be more than one word. There is deliberately
 * no allowlist JSON: a side-channel file is the shape that grows past twenty
 * entries and quietly becomes the budget bypass `autonomous-execution` names.
 */
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REAL_REPO_ROOT = path.resolve(SCRIPTS_DIR, '..', '..');

const ALLOW_RE = /#\s*workflow-path-allow:\s*(.+?)\s*$/;
/** A reason must carry real content — two words minimum, eight characters. */
const MIN_REASON_WORDS = 2;
const MIN_REASON_CHARS = 8;

export interface PathFinding {
    readonly file: string;
    readonly line: number;
    readonly glob: string;
    readonly why: 'no-match' | 'thin-reason';
}

/**
 * Translate the subset of glob syntax GitHub path filters use into a RegExp.
 *
 * `**` crosses directory separators, `*` and `?` do not. Everything else is a
 * literal — no brace expansion, no character classes, because GitHub does not
 * document them for this field and guessing at unsupported syntax would make
 * the gate disagree with the thing it is auditing.
 */
export function globToRegExp(glob: string): RegExp {
    let out = '';
    for (let i = 0; i < glob.length; i += 1) {
        const c = glob[i] as string;
        if (c === '*') {
            if (glob[i + 1] === '*') {
                out += '.*';
                i += 1;
                if (glob[i + 1] === '/') {
                    i += 1;
                }
            } else {
                out += '[^/]*';
            }
        } else if (c === '?') {
            out += '[^/]';
        } else {
            out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(`^${out}$`);
}

/** Does `glob` match at least one path in `tracked`? */
export function globMatchesAny(glob: string, tracked: readonly string[]): boolean {
    const re = globToRegExp(glob);
    const prefix = `${glob.replace(/\/?\*\*$/, '').replace(/\/$/, '')}/`;
    return tracked.some((t) => re.test(t) || t === glob || t.startsWith(prefix));
}

/**
 * Extract every `paths:` / `paths-ignore:` list entry from one workflow body.
 *
 * A hand-rolled scan rather than a YAML parse, deliberately: the gate must
 * report the LINE an entry sits on so a maintainer can jump to it, and a parsed
 * document has thrown that away. The block ends at the first non-comment,
 * non-list line — which is how YAML block sequences end anyway.
 */
export function extractPathEntries(
    body: string,
): { line: number; glob: string; allow: string | null }[] {
    const out: { line: number; glob: string; allow: string | null }[] = [];
    let inBlock = false;
    const lines = body.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] as string;
        if (/^\s*paths(-ignore)?:\s*$/.test(line)) {
            inBlock = true;
            continue;
        }
        if (!inBlock) {
            continue;
        }
        if (line.trim() === '' || line.trim().startsWith('#')) {
            continue;
        }
        const m = line.match(/^\s*-\s*(?:'([^']*)'|"([^"]*)"|([^#\s]+))\s*(#.*)?$/);
        if (m === null) {
            inBlock = false;
            continue;
        }
        const glob = (m[1] ?? m[2] ?? m[3] ?? '').trim();
        if (glob === '') {
            continue;
        }
        const allowMatch = (m[4] ?? '').match(ALLOW_RE);
        out.push({ line: i + 1, glob, allow: allowMatch ? (allowMatch[1] as string) : null });
    }
    return out;
}

function _trackedFiles(repoRoot: string): string[] {
    try {
        return execFileSync('git', ['ls-files'], {
            cwd: repoRoot,
            encoding: 'utf-8',
            maxBuffer: 256 * 1024 * 1024,
        })
            .split('\n')
            .filter((l) => l !== '');
    } catch {
        return [];
    }
}

function _reasonIsThin(reason: string): boolean {
    return (
        reason.trim().length < MIN_REASON_CHARS ||
        reason.trim().split(/\s+/).filter(Boolean).length < MIN_REASON_WORDS
    );
}

export interface ScanOptions {
    readonly repoRoot: string;
    readonly workflowDir: string;
    readonly tracked: readonly string[];
}

export function scanWorkflowDir(
    opts: ScanOptions,
    ledger: GateLedger,
): PathFinding[] {
    const findings: PathFinding[] = [];
    let files: string[] = [];
    try {
        files = fs
            .readdirSync(opts.workflowDir)
            .filter((f) => /\.ya?ml$/.test(f))
            .sort();
    } catch {
        files = [];
    }
    ledger.plan(files);

    for (const f of files) {
        let body: string;
        try {
            body = fs.readFileSync(path.join(opts.workflowDir, f), 'utf-8');
        } catch {
            ledger.fail(f, 'unreadable');
            continue;
        }
        const before = findings.length;
        for (const entry of extractPathEntries(body)) {
            if (entry.allow !== null) {
                if (_reasonIsThin(entry.allow)) {
                    findings.push({ file: f, line: entry.line, glob: entry.glob, why: 'thin-reason' });
                }
                continue;
            }
            if (!globMatchesAny(entry.glob, opts.tracked)) {
                findings.push({ file: f, line: entry.line, glob: entry.glob, why: 'no-match' });
            }
        }
        if (findings.length > before) {
            ledger.fail(f, `${String(findings.length - before)} dead path filter(s)`);
        } else {
            ledger.complete(f);
        }
    }
    return findings;
}

interface Args {
    quiet: boolean;
    selfTest: boolean;
    root: string | null;
}

function _parseArgs(argv: readonly string[]): Args {
    const args: Args = { quiet: false, selfTest: false, root: null };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--quiet') {
            args.quiet = true;
        } else if (a === '--self-test') {
            args.selfTest = true;
        } else if (a === '--root') {
            args.root = argv[i + 1] ?? null;
            i += 1;
        }
    }
    return args;
}

function _selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lwp-selftest-'));
    const mkRepo = (name: string, workflow: string): string => {
        const repo = path.join(tmp, name);
        fs.mkdirSync(path.join(repo, '.github', 'workflows'), { recursive: true });
        fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
        fs.writeFileSync(path.join(repo, 'src', 'real.ts'), '// real\n');
        execFileSync('git', ['init', '-q'], { cwd: repo });
        execFileSync('git', ['add', '-A'], { cwd: repo });
        fs.writeFileSync(path.join(repo, '.github', 'workflows', 'w.yml'), workflow, 'utf-8');
        execFileSync('git', ['add', '-A'], { cwd: repo });
        return repo;
    };
    const run = (repo: string): number =>
        runGateCli(
            REAL_REPO_ROOT,
            'src/scripts/lint_workflow_paths.ts',
            ['--root', repo, '--quiet'],
            REAL_REPO_ROOT,
        );

    const HEAD = 'on:\n  pull_request:\n    paths:\n';
    try {
        const dead = mkRepo('dead', `${HEAD}      - "retired/tree/**"\n`);
        const live = mkRepo('live', `${HEAD}      - "src/**"\n`);
        const allowed = mkRepo(
            'allowed',
            `${HEAD}      - "future/tree/**"  # workflow-path-allow: lands in the follow-up PR\n`,
        );
        const thin = mkRepo('thin', `${HEAD}      - "future/tree/**"  # workflow-path-allow: soon\n`);
        const bareDir = mkRepo('baredir', `${HEAD}      - "src"\n`);
        return runSelfTest({
            gate: 'lint_workflow_paths',
            minCases: 4,
            minRejectCases: 2,
            cases: [
                {
                    name: 'a filter naming a retired tree is rejected',
                    expect: 'reject',
                    run: () => run(dead),
                },
                { name: 'a filter that matches tracked files passes', expect: 'accept', run: () => run(live) },
                {
                    name: 'a bare directory entry matches by prefix, as GitHub does',
                    expect: 'accept',
                    run: () => run(bareDir),
                },
                {
                    name: 'a declared pre-staged filter with a real reason passes',
                    expect: 'accept',
                    run: () => run(allowed),
                },
                {
                    name: 'a one-word reason is rejected — an unclassifiable exception is boilerplate',
                    expect: 'reject',
                    run: () => run(thin),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = _parseArgs(argv);
    if (args.selfTest) {
        return _selfTest();
    }
    const repoRoot = args.root !== null ? path.resolve(args.root) : REAL_REPO_ROOT;
    const workflowDir = path.join(repoRoot, '.github', 'workflows');
    const tracked = _trackedFiles(repoRoot);

    const ledger = new GateLedger('lint_workflow_paths');
    const findings = scanWorkflowDir({ repoRoot, workflowDir, tracked }, ledger);
    const tally = ledger.finalize();

    if (!args.quiet && findings.length > 0) {
        process.stdout.write('\nlint_workflow_paths — path filters that can never fire:\n\n');
        for (const f of findings) {
            const why =
                f.why === 'no-match'
                    ? 'matches no tracked file'
                    : 'workflow-path-allow reason is too thin to classify';
            process.stdout.write(
                `  ${f.file}:${String(f.line)}  ${f.glob}\n      ${why}\n`,
            );
        }
        process.stdout.write(
            '\n  Fix: delete the entry if the tree is retired, or repoint it if the path moved.\n' +
                '  A filter that matches nothing does not over-trigger — it never triggers.\n',
        );
    }
    if (!args.quiet) {
        process.stdout.write(
            `\nlint_workflow_paths: ${String(findings.length)} dead filter(s) across ` +
                `${String(new Set(findings.map((f) => f.file)).size)} workflow file(s)\n`,
        );
        ledger.report();
    }
    reportScanned({
        gate: 'lint_workflow_paths',
        scanned: tally.completed + tally.failed,
        units: 'workflow file(s)',
        roots: ['.github/workflows'],
    });
    return findings.length > 0 ? 1 : 0;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}
