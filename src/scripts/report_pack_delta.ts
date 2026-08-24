#!/usr/bin/env tsx
/**
 * Branch-vs-base packed-payload delta — make accretion legible while it is small.
 *
 * WHY, and this is the whole argument: the 2026-08-24 cap trip was a **merge
 * artifact**. `origin/main` measured 8.3911 and the branch 8.4305, against a cap
 * of 8.4 — *neither side was over alone*, and together they crossed. No
 * per-branch absolute check can see that shape, which is why the cap had to be
 * re-baselined rather than the payload fixed. `check_pack_size` answers "is the
 * total under the cap"; this answers "how much did THIS branch add", which is
 * the number that would have made the accretion visible four raises ago.
 *
 * It is a REPORT, not a gate. It prints a delta and exits 0 whatever the number,
 * because a threshold here would be a second cap with no derivation behind it
 * and the absolute cap already owns the refusal. `--fail-over <MB>` exists for a
 * caller that wants one, and is deliberately not wired into CI.
 *
 * Measurement matches `pack-size-budget.json`'s documented conditions exactly —
 * `npm pack --dry-run --json --ignore-scripts` on an unbuilt tree — because a
 * delta between two figures measured differently is noise. Both sides are
 * measured in throwaway detached worktrees for the same reason: a built working
 * tree reads ~2 MB high, which the budget file records as a trap its own method
 * invites.
 *
 * ```bash
 *   report_pack_delta                      # vs origin/main
 *   report_pack_delta --base origin/main --head HEAD
 *   report_pack_delta --json
 *   report_pack_delta --markdown           # a PR-comment / step-summary block
 * ```
 *
 * Exit codes: 0 = reported · 2 = could not measure (a missing ref, a failed
 * pack). Never non-zero for a large delta unless `--fail-over` says so.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _FILE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_FILE), '..', '..');

export interface Side {
    readonly ref: string;
    readonly packedBytes: number;
    readonly unpackedBytes: number;
    readonly entries: number;
}

export interface Delta {
    readonly base: Side;
    readonly head: Side;
    readonly packedDeltaBytes: number;
    readonly entryDelta: number;
    readonly capMb: number | null;
    readonly headroomBytes: number | null;
}

const run = (cmd: string, args: readonly string[], cwd: string): { code: number; out: string; err: string } => {
    const r = spawnSync(cmd, [...args], {
        cwd,
        encoding: 'utf8',
        timeout: 600_000,
        maxBuffer: 64 * 1024 * 1024,
    });
    return { code: r.status ?? 1, out: r.stdout ?? '', err: r.stderr ?? '' };
};

/** Measure one ref in a throwaway detached worktree, unbuilt. */
export function measure(ref: string): Side {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-pack-delta-'));
    const tree = path.join(dir, 'tree');
    try {
        const add = run('git', ['worktree', 'add', '--quiet', '--detach', tree, ref], REPO);
        if (add.code !== 0) throw new Error(`cannot check out ${ref}: ${add.err.trim()}`);
        const packed = run('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], tree);
        if (packed.code !== 0) throw new Error(`npm pack failed for ${ref}: ${packed.err.slice(-600)}`);
        const start = packed.out.indexOf('[');
        if (start === -1) throw new Error(`npm pack produced no JSON for ${ref}`);
        const meta = JSON.parse(packed.out.slice(start)) as Array<{
            size: number;
            unpackedSize: number;
            entryCount: number;
        }>;
        const m = meta[0];
        if (m === undefined) throw new Error(`npm pack produced no entry for ${ref}`);
        return { ref, packedBytes: m.size, unpackedBytes: m.unpackedSize, entries: m.entryCount };
    } finally {
        run('git', ['worktree', 'remove', '--force', tree], REPO);
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function readCap(): number | null {
    try {
        const raw = fs.readFileSync(path.join(REPO, 'src', 'config', 'pack-size-budget.json'), 'utf8');
        const d = JSON.parse(raw) as { budgets?: { packed_size_mb?: { max?: number } } };
        const max = d.budgets?.packed_size_mb?.max;
        return typeof max === 'number' ? max : null;
    } catch {
        return null;
    }
}

export function delta(baseRef: string, headRef: string): Delta {
    const base = measure(baseRef);
    const head = measure(headRef);
    const capMb = readCap();
    return {
        base,
        head,
        packedDeltaBytes: head.packedBytes - base.packedBytes,
        entryDelta: head.entries - base.entries,
        capMb,
        headroomBytes: capMb === null ? null : Math.round(capMb * 1e6 - head.packedBytes),
    };
}

const kb = (n: number): string => `${(n / 1024).toFixed(1)} KB`;
const mb = (n: number): string => `${(n / 1e6).toFixed(4)} MB`;
const signed = (n: number): string => `${n >= 0 ? '+' : '−'}${kb(Math.abs(n))}`;

export function markdown(d: Delta): string {
    const dir = d.packedDeltaBytes === 0 ? 'unchanged' : d.packedDeltaBytes > 0 ? 'grew' : 'shrank';
    const lines = [
        `**Packed payload ${dir}: ${signed(d.packedDeltaBytes)}**`,
        '',
        '| | packed | entries |',
        '|---|---|---|',
        `| base \`${d.base.ref}\` | ${mb(d.base.packedBytes)} | ${d.base.entries} |`,
        `| head \`${d.head.ref}\` | ${mb(d.head.packedBytes)} | ${d.head.entries} |`,
        `| delta | **${signed(d.packedDeltaBytes)}** | ${d.entryDelta >= 0 ? '+' : ''}${d.entryDelta} |`,
    ];
    if (d.capMb !== null && d.headroomBytes !== null) {
        lines.push(
            '',
            `Cap ${d.capMb} MB · headroom after this branch **${kb(d.headroomBytes)}**.`,
            '',
            '<sub>Measured `npm pack --dry-run --ignore-scripts` on unbuilt detached worktrees of both refs — the ' +
                'conditions `pack-size-budget.json` documents. A report, not a gate: the absolute cap owns the refusal. ' +
                'This line exists because the 2026-08-24 trip was a MERGE artifact — neither side was over alone.</sub>',
        );
    }
    return lines.join('\n');
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const arg = (name: string, dflt: string): string => {
        const i = argv.indexOf(name);
        return i !== -1 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : dflt;
    };
    const baseRef = arg('--base', 'origin/main');
    const headRef = arg('--head', 'HEAD');
    const failOver = arg('--fail-over', '');

    let d: Delta;
    try {
        d = delta(baseRef, headRef);
    } catch (exc) {
        process.stderr.write(`report_pack_delta: ${String(exc)}\n`);
        return 2;
    }

    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(d, null, 2)}\n`);
    } else if (argv.includes('--markdown')) {
        process.stdout.write(`${markdown(d)}\n`);
    } else {
        process.stdout.write(
            `pack delta ${baseRef} → ${headRef}: ${signed(d.packedDeltaBytes)} ` +
                `(${mb(d.base.packedBytes)} → ${mb(d.head.packedBytes)}, ` +
                `${d.entryDelta >= 0 ? '+' : ''}${d.entryDelta} entries)\n`,
        );
        if (d.capMb !== null && d.headroomBytes !== null) {
            process.stdout.write(`  cap ${d.capMb} MB · headroom ${kb(d.headroomBytes)}\n`);
        }
    }
    // `scanned:` per the gate-coverage contract — two refs is what it inspected.
    process.stdout.write('scanned: 2\n');

    if (failOver !== '') {
        const limit = Number(failOver) * 1e6;
        if (Number.isFinite(limit) && d.packedDeltaBytes > limit) {
            process.stderr.write(`report_pack_delta: delta ${kb(d.packedDeltaBytes)} exceeds --fail-over ${failOver} MB\n`);
            return 1;
        }
    }
    return 0;
}

function _isCliEntry(): boolean {
    const a = process.argv[1];
    if (!a) return false;
    if (a === _FILE || pathToFileURL(path.resolve(a)).href === import.meta.url) return true;
    try {
        return fs.realpathSync(a) === fs.realpathSync(_FILE);
    } catch {
        return false;
    }
}
if (_isCliEntry()) process.exit(main());

export { REPO };
