#!/usr/bin/env tsx
/**
 * Is the INSTALLED copy of this repository's git hooks still what the installer
 * would write?
 *
 * WHY. `src/scripts/install-hooks.sh` writes six hooks into the shared
 * `.git/hooks` directory. Afterwards it runs only on the package manager's
 * `prepare` lifecycle step (git clones only) or when a human runs
 * `task install-hooks`. Between those two events the installed copy drifts from
 * the source that writes it, silently and without bound. Measured in this
 * repository on 2026-09-05, before this gate existed: the installed `pre-push`
 * was 146 lines against a 189-line source body, and the 43 missing lines were
 * the entire base-freshness gate merged five days earlier. In the source, in
 * CI, and in the skill documenting it, that gate read as live. On the checkout
 * that actually runs it, it did not exist.
 *
 * That is the general shape of an INSTALLED copy of a generated file: the
 * source is gated, the copy is not, and the copy is what runs.
 *
 * HOW. Not by re-parsing the heredocs. `install-hooks.sh` writes `post-merge`
 * and `post-checkout` as a heredoc PLUS an appended auto-sync block, and it
 * interpolates the hook name into both — so no slice of the source file equals
 * a hook body, and a comparison built on slicing would be wrong for two of six
 * hooks and brittle for the rest. Instead the gate runs the real installer with
 * `AGENT_CONFIG_HOOKS_DIR` pointed at a scratch directory and byte-compares
 * what it produced against what is installed. Anything the installer does
 * deterministically — interpolation, appends, future additions — compares equal
 * by construction, which is what keeps this from being the too-strict check its
 * roadmap's risk register warned about.
 *
 * WHERE IT IS BOUND, AND WHY NOT IN CI. The pre-push hook body calls it
 * (blocking, with `AGENT_CONFIG_SKIP_PREPUSH_HOOKFRESH=1` to bypass), and the
 * `post-merge` / `post-checkout` auto-sync block calls it advisory-only, which
 * is the event that CAUSES the staleness. It is deliberately NOT in `task ci`
 * or `task preflight`: CI cannot observe a contributor's `.git/hooks`, so a
 * CI-registered run would scan nothing and report a green that means "no data"
 * — the vacuous-pass class this repository audited in 2026-07. Its correctness
 * is covered by `tests/scripts/check_installed_hooks_fresh.test.ts`, which does
 * run in CI, and which asserts BOTH directions.
 *
 * EMPTY IS A REAL STATE. A checkout that never ran the installer has no managed
 * hook to compare. That exits 0 and says so in one line, rather than pretending
 * to have checked something.
 *
 * CLI contract: exit 0 = every installed managed hook matches, or none is
 * installed; 1 = at least one is missing or differs; 2 = the installer could
 * not be rendered (usage error, or the installer itself failed).
 *
 * Usage:
 *     ./scripts-run src/scripts/check_installed_hooks_fresh
 *     ./scripts-run src/scripts/check_installed_hooks_fresh --quiet
 *     ./scripts-run src/scripts/check_installed_hooks_fresh --hooks-dir <path>
 */
// ledger-exempt: this gate has one target — the installed hook set — and it
// reports every managed hook by name with a fingerprint on both the clean and
// the failing path, so per-target accounting is already the whole output.

import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const INSTALLER_REL = 'src/scripts/install-hooks.sh';
const FIX = 'task install-hooks';
const SKIP_ENV = 'AGENT_CONFIG_SKIP_PREPUSH_HOOKFRESH';

export interface HookVerdict {
    name: string;
    state: 'match' | 'differs' | 'missing';
    expectedSha: string;
    installedSha: string | null;
}

export interface FreshnessReport {
    hooksDir: string;
    /** Managed hooks the installer would write. */
    verdicts: HookVerdict[];
    /** True when NONE of the managed hooks is installed — a fresh clone. */
    neverInstalled: boolean;
}

function sha(buf: Buffer): string {
    return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
}

/** The shared hooks dir, resolved the way the installer resolves it. */
export function resolveHooksDir(repoRoot: string): string {
    const res = spawnSync('git', ['-C', repoRoot, 'rev-parse', '--git-common-dir'], {
        encoding: 'utf-8',
    });
    const out = (res.stdout ?? '').trim();
    if (res.status !== 0 || out === '') return path.join(repoRoot, '.git', 'hooks');
    return path.join(path.isAbsolute(out) ? out : path.join(repoRoot, out), 'hooks');
}

/**
 * Render every hook the installer would write, into a scratch directory.
 *
 * Shells out to the real installer rather than reimplementing it: an
 * independent renderer would be a second source of truth, and the drift between
 * the two would be invisible in exactly the way this gate exists to catch.
 */
export function renderExpected(repoRoot: string): Map<string, Buffer> {
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'hookfresh-'));
    try {
        const res = spawnSync('bash', [path.join(repoRoot, INSTALLER_REL)], {
            cwd: repoRoot,
            encoding: 'buffer',
            env: { ...process.env, AGENT_CONFIG_HOOKS_DIR: stage },
        });
        if (res.status !== 0) {
            const err = res.stderr ? res.stderr.toString('utf-8') : '';
            throw new Error(`${INSTALLER_REL} exited ${String(res.status)}\n${err}`);
        }
        const out = new Map<string, Buffer>();
        for (const name of fs.readdirSync(stage).sort()) {
            out.set(name, fs.readFileSync(path.join(stage, name)));
        }
        return out;
    } finally {
        fs.rmSync(stage, { recursive: true, force: true });
    }
}

export function inspect(repoRoot: string, hooksDirOverride?: string): FreshnessReport {
    const hooksDir = hooksDirOverride ?? resolveHooksDir(repoRoot);
    const expected = renderExpected(repoRoot);
    if (expected.size === 0) {
        // The installer produced nothing — it cannot have been read correctly.
        throw new DeadScopeError(
            'check_installed_hooks_fresh',
            `${INSTALLER_REL} wrote no hooks — the installer, not the installed copy, is the problem.`,
        );
    }
    const verdicts: HookVerdict[] = [];
    for (const [name, body] of expected) {
        const target = path.join(hooksDir, name);
        let installed: Buffer | null = null;
        try {
            installed = fs.readFileSync(target);
        } catch {
            installed = null;
        }
        verdicts.push({
            name,
            state: installed === null ? 'missing' : installed.equals(body) ? 'match' : 'differs',
            expectedSha: sha(body),
            installedSha: installed === null ? null : sha(installed),
        });
    }
    return {
        hooksDir,
        verdicts,
        neverInstalled: verdicts.every((v) => v.state === 'missing'),
    };
}

function render(report: FreshnessReport, quiet: boolean, write: (s: string) => void): number {
    // Outside the quiet guard on purpose: CI-shaped callers pass --quiet, and a
    // gate that reports no count there reads as silent.
    const collect = ((chunk: string | Uint8Array): boolean => {
        write(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
        return true;
    }) as typeof process.stdout.write;
    reportScanned(
        {
            gate: 'check_installed_hooks_fresh',
            scanned: report.verdicts.length,
            units: 'managed hook(s)',
            roots: [INSTALLER_REL],
        },
        collect,
    );

    if (report.neverInstalled) {
        write(
            `✅  check_installed_hooks_fresh: no managed hook is installed at ${report.hooksDir} — ` +
                `nothing to compare. Run '${FIX}' to install them.\n`,
        );
        return 0;
    }

    const stale = report.verdicts.filter((v) => v.state !== 'match');
    if (stale.length === 0) {
        if (!quiet) {
            for (const v of report.verdicts) {
                write(`    ${v.name}  ${v.expectedSha}\n`);
            }
        }
        write(
            `✅  check_installed_hooks_fresh: ${String(report.verdicts.length)} installed hook(s) match ${INSTALLER_REL}.\n`,
        );
        return 0;
    }

    write(`❌  check_installed_hooks_fresh: the installed git hooks are stale.\n`);
    write(`    hooks dir: ${report.hooksDir}\n`);
    write(`    worktree:  ${REPO}\n`);
    for (const v of stale) {
        write(
            v.state === 'missing'
                ? `    ${v.name}  MISSING            (source ${v.expectedSha})\n`
                : `    ${v.name}  installed ${String(v.installedSha)}  ≠  source ${v.expectedSha}\n`,
        );
    }
    write(`    → ${FIX}\n`);
    write(
        `    Every gate those hooks carry is inert on this checkout until you run it.\n` +
            `    Bypass for a genuine WIP push with ${SKIP_ENV}=1.\n`,
    );
    return 1;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let quiet = false;
    let hooksDir: string | undefined;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--quiet') quiet = true;
        else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: check_installed_hooks_fresh [--quiet] [--hooks-dir PATH]\n',
            );
            return 0;
        } else if (a === '--hooks-dir') {
            i += 1;
            const next = argv[i];
            if (next === undefined) {
                process.stderr.write('check_installed_hooks_fresh: --hooks-dir needs a path\n');
                return 2;
            }
            hooksDir = next;
        } else {
            process.stderr.write(`check_installed_hooks_fresh: unknown argument ${a}\n`);
            return 2;
        }
    }

    let report: FreshnessReport;
    try {
        report = inspect(REPO, hooksDir);
    } catch (e) {
        process.stderr.write(
            `❌  check_installed_hooks_fresh: ${e instanceof Error ? e.message : String(e)}\n`,
        );
        return 2;
    }

    const chunks: string[] = [];
    const code = render(report, quiet, (s) => chunks.push(s));
    const text = chunks.join('');
    if (code === 0) process.stdout.write(text);
    else process.stderr.write(text);
    return code;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main());
}
