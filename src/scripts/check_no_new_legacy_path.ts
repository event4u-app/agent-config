#!/usr/bin/env tsx
/**
 * Regression guard: no NEW `.agent-src.uncondensed/` references in `src/`.
 *
 * TypeScript twin of `src/scripts/check_no_new_legacy_path.py` (ADR-096,
 * Phase 4 / Wave 4c). The CLI contract is mirrored EXACTLY — `--base`
 * / `--stdin` flags, exit codes (0 no new references, 1 a new reference,
 * 2 internal error), stdout split, byte-identical finding messages,
 * same diff parsing, same EXEMPT set, and the same faithful-twin rule.
 * No behaviour changes — latent bugs replicated.
 *
 * NOTE (faithful-twin rule): this guard's `.py` original is in its own
 * EXEMPT set and legitimately contains the literal `.agent-src.uncondensed`
 * as data. This `.ts` twin contains it too — and the faithful-twin rule
 * (matching the bare directory name against the same-stem `.py` sibling)
 * auto-exempts it, so the guard does not flag its own port.
 *
 * `.agent-src.uncondensed/` is the dead pre-relocation source path (the source
 * of truth moved to `src/`, ADR-051). Existing stale prose mentions in `src/`
 * are fixed opportunistically; this guard stops the debt from growing: it
 * fails when a diff ADDS a new `.agent-src.uncondensed/` line under `src/`.
 *
 * Files that legitimately contain the literal forever are exempt:
 *   - src/scripts/_lib/agent_src.py        (the LEGACY_SRC constant)
 *   - src/scripts/check_references.py       (forbidden-substring detector)
 *   - src/scripts/check_condensed_paths.py  (forbidden-substring detector)
 *
 * Faithful-twin rule (Python→TypeScript migration): a `*.ts` file is also
 * exempt when a same-stem `*.py` sibling exists AND already contains the
 * literal. A TS twin that faithfully mirrors a pre-existing legacy reference
 * (e.g. agent_src.ts, install_regenerator.ts) is not a NEW dead-path — the
 * reference already lived in the ported `.py`. This cannot mask a genuinely
 * new dead-path: a fresh one introduced only in a `.ts` has no `.py` sibling
 * already carrying it.
 *
 * Diff-based: compares added lines against a base ref (default `origin/main`).
 * On a clean checkout with no diff, it is a no-op (exit 0).
 *
 * Usage:  tsx src/scripts/check_no_new_legacy_path.ts [--base <ref>]
 * Exit:   0 = no new references, 1 = a new reference was added, 2 = internal error.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LEGACY = '.agent-src.uncondensed/';
const EXEMPT: ReadonlySet<string> = new Set([
    'src/scripts/_lib/agent_src.py',
    'src/scripts/check_references.py',
    'src/scripts/check_condensed_paths.py',
    'src/scripts/check_no_new_legacy_path.py', // this file documents the literal
]);

type TwinCheck = (curFile: string) => boolean;

/**
 * True when `curFile` is a `*.ts` whose same-stem `*.py` sibling exists and
 * already references the legacy tree — a faithful TS port of a pre-existing
 * legacy reference, not a new dead-path. The sibling check matches the bare
 * directory name (`.agent-src.uncondensed`, no trailing slash) because the
 * `.py` may reference it as a path SEGMENT (`root / ".agent-src.uncondensed"`)
 * while the `.ts` twin / its comments use the slash form — both are the same
 * faithful reference. Reads from disk relative to cwd (CI runs the guard at
 * the repo root); injectable in tests via the `twinCheck` param of
 * `find_offenders`.
 */
function _is_faithful_twin(curFile: string): boolean {
    if (!curFile.endsWith('.ts')) {
        return false;
    }
    const sibling = curFile.slice(0, -3) + '.py';
    try {
        const content = fs.readFileSync(sibling, 'utf-8');
        return content.includes(LEGACY.replace(/\/+$/, ''));
    } catch {
        return false;
    }
}

function _base(): string {
    const argv = process.argv;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--base' && i + 1 < argv.length) {
            return argv[i + 1]!;
        }
    }
    return 'origin/main';
}

/**
 * Added (`+`) lines under a non-exempt src/ file that introduce the legacy
 * path. Pure over the diff string except for the faithful-twin sibling check
 * (`twinCheck`, injectable for unit tests).
 */
function find_offenders(diffText: string, twinCheck: TwinCheck = _is_faithful_twin): string[] {
    let curFile: string | null = null;
    const offenders: string[] = [];
    for (const line of diffText.split('\n')) {
        if (line.startsWith('+++ b/')) {
            curFile = line.slice(6);
            continue;
        }
        if (line.startsWith('+') && !line.startsWith('+++')) {
            // src/-scoped: a full diff (e.g. `gh pr diff`) carries every path;
            // only added lines under src/ (minus the exempt detectors and
            // faithful TS twins) count.
            if (
                curFile &&
                curFile.startsWith('src/') &&
                !EXEMPT.has(curFile) &&
                line.includes(LEGACY) &&
                !twinCheck(curFile)
            ) {
                offenders.push(`${curFile}: ${line.slice(1).trim().slice(0, 100)}`);
            }
        }
    }
    return offenders;
}

function main(): number {
    // --stdin: read a unified diff from stdin (CI pipes `gh pr diff` — auth-safe,
    // no `git fetch <base>` extraheader race on shallow PR-merge checkouts, the
    // documented failure the kernel-bundle step sidesteps the same way).
    let offenders: string[];
    if (process.argv.includes('--stdin')) {
        const stdin = fs.readFileSync(0, 'utf-8') as string;
        offenders = find_offenders(stdin);
    } else {
        const base = _base();
        // Two-dot diff: working tree vs base — catches committed + uncommitted
        // additions (robust locally and where the working tree is the branch tip).
        let proc: ReturnType<typeof spawnSync>;
        try {
            proc = spawnSync('git', ['diff', base, '--', 'src/'], {
                encoding: 'utf-8',
            });
        } catch (exc) {
            const msg = exc instanceof Error ? exc.message : String(exc);
            process.stdout.write(`❌  check_no_new_legacy_path: git diff failed: ${msg}\n`);
            return 2;
        }
        if (proc.error) {
            process.stdout.write(
                `❌  check_no_new_legacy_path: git diff failed: ${proc.error.message}\n`,
            );
            return 2;
        }
        const code = proc.status;
        if (code !== 0 && code !== 1) {
            // base ref missing (shallow clone / detached) — degrade to no-op.
            process.stdout.write(
                `⚠️  check_no_new_legacy_path: base '${base}' unavailable; skipping (no-op).\n`,
            );
            return 0;
        }
        offenders = find_offenders((proc.stdout as string | null) ?? '');
    }

    if (offenders.length) {
        process.stdout.write(
            '❌  New `.agent-src.uncondensed/` reference(s) added under src/ ' +
                '(the source of truth is `src/` — ADR-051):\n',
        );
        for (const o of offenders) {
            process.stdout.write(`  🔴 ${o}\n`);
        }
        process.stdout.write(
            '\nFix: reference the real `src/` target. Existing stale prose is ' +
                'migrated opportunistically; do not ADD new dead-path references.\n',
        );
        return 1;
    }

    process.stdout.write('✅  No new `.agent-src.uncondensed/` references added under src/.\n');
    return 0;
}

const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { LEGACY, EXEMPT, _is_faithful_twin, find_offenders, main };
