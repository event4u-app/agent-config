#!/usr/bin/env tsx
/**
 * Generate `docs/contracts/exit-code-register.md` — the exit codes of `init`,
 * `sync`, `doctor` and `uninstall`, read out of the code that returns them.
 *
 * WHAT IS GENERATED AND WHAT IS WRITTEN. The SET of codes each command can
 * return is scanned from its sources; only the one-line meaning of each code is
 * written by hand, in {@link COMMANDS}. The two are reconciled on every run: a
 * code the scan finds with no meaning, or a meaning for a code the scan does
 * not find, fails the build. So the register cannot list a code the command
 * stopped returning, and a new code cannot ship undocumented.
 *
 * THE SCAN, and its blind spot. A code is counted where it appears as a
 * literal exit: `return N;`, `return <cond> ? N : M;`, `ArgparseExit(N)`,
 * `process.exit(N)`, bash `exit N`, or a `return` of an exported `EXIT_*`
 * constant, resolved to its value. A code passed through a variable
 * (`return rc;`) is invisible to it — that is what `inherits` is for: a command
 * that forwards another command's code names the forwarding line, and the
 * generator asserts the line still exists before it unions the codes.
 *
 * `return N;` also matches helpers that return a count; scanning only the
 * command's own entry files keeps that to the codes {0, 1, 2}, which every
 * command returns anyway. A helper returning another literal would surface
 * here as an undocumented code — a false alarm that fails loudly, which is the
 * acceptable direction.
 *
 * Exit: 0 written / up to date · 1 drift under `--check`, or a scan that
 * disagrees with the declared meanings · 2 usage error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

export const OUT_REL = 'docs/contracts/exit-code-register.md';

export interface Inherit {
    readonly from: string;
    /** The file and the literal line that forwards `from`'s code. */
    readonly file: string;
    readonly fragment: string;
}

export interface CommandSpec {
    readonly verb: string;
    readonly sources: readonly string[];
    readonly meanings: Readonly<Record<number, string>>;
    readonly inherits?: readonly Inherit[];
}

export const COMMANDS: readonly CommandSpec[] = [
    {
        verb: 'init',
        sources: ['src/scripts/install', 'src/scripts/install.ts', 'src/install/conflictTracker.ts'],
        meanings: {
            0: 'installed, and every written file is current',
            1: 'the install failed or was refused partway (missing payload, payload sync failed, a write failed, `--scope=project` without dev mode)',
            2: 'usage error, or a refusal before anything is written (own source checkout, unsupported schema version, rule-layer overlap, no TS runner)',
            3: 'installed what it could, but preserved at least one user-modified file — the install is stale until the `.agent-config.new` sidecars are resolved',
        },
    },
    {
        verb: 'sync',
        sources: ['src/scripts/_cli/cmd_sync.ts'],
        meanings: {
            0: 'every tool in the lockfile is present, or was replayed',
            1: 'no install lockfile to replay, or a replay the installer failed (its `1`, forwarded)',
            2: 'usage error, or a replay the installer refused (its `2`, forwarded)',
            3: 'replayed, but the installer preserved a user-modified file (its `3`, forwarded) — stale until resolved',
        },
        inherits: [{ from: 'init', file: 'src/scripts/_cli/cmd_sync.ts', fragment: 'return rc;' }],
    },
    {
        verb: 'doctor',
        sources: ['src/scripts/_cli/cmd_doctor.ts', 'src/scripts/_cli/_doctor_strict.ts'],
        meanings: {
            0: 'no manifest drift; under `--ci`, `--check` or `--strict`, also no check at the tripping status',
            1: 'manifest drift; or, under `--ci`, `--check` or `--strict`, a check at the tripping status',
            2: 'usage error, unresolvable project root, failed repair, no install in the tree, or `--check` on a check that was skipped',
        },
    },
    {
        verb: 'uninstall',
        sources: ['src/scripts/_cli/cmd_uninstall.ts'],
        meanings: {
            0: 'removed what it owned, or there was nothing to remove',
            1: 'no lockfile and no `--force`, or a removal was refused',
            2: 'usage error',
        },
    },
];

function strip(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`$])\/\/.*$/gm, '$1');
}

const LITERAL_RES: readonly RegExp[] = [
    /\breturn (\d+);/g,
    /\breturn [^;?\n]+\? (\d+) : (\d+);/g,
    /\bArgparseExit\((\d+)\)/g,
    /(?:^|[\s;(])exit (\d+)\b/gm,
    /\bprocess\.exit\((\d+)\)/g,
];
const CONSTANT_RE = /\breturn (?:[^;\n]*\? )?(EXIT_[A-Z0-9_]+)\b/g;

/** `export const EXIT_X = N;` anywhere under `src/`, by name. */
export function exitConstants(root: string): Map<string, number> {
    const out = new Map<string, number>();
    const walk = (dir: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (e.name !== 'node_modules') walk(full);
            } else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) {
                const text = fs.readFileSync(full, 'utf8');
                for (const m of text.matchAll(/^export const (EXIT_[A-Z0-9_]+) = (\d+);/gm)) {
                    out.set(m[1] as string, Number(m[2]));
                }
            }
        }
    };
    const src = path.join(root, 'src');
    if (fs.existsSync(src)) walk(src);
    return out;
}

/** The literal exit codes one source returns, each with the files that emit it. */
export function scanCodes(text: string, constants: ReadonlyMap<string, number>): Set<number> {
    const s = strip(text);
    const codes = new Set<number>();
    for (const re of LITERAL_RES) {
        for (const m of s.matchAll(re)) {
            for (const g of m.slice(1)) if (g !== undefined) codes.add(Number(g));
        }
    }
    for (const m of s.matchAll(CONSTANT_RE)) {
        const v = constants.get(m[1] as string);
        if (v !== undefined) codes.add(v);
    }
    return codes;
}

export interface Row {
    readonly code: number;
    readonly meaning: string;
    readonly emittedIn: readonly string[];
}

export interface Register {
    readonly rows: ReadonlyMap<string, readonly Row[]>;
    readonly errors: readonly string[];
}

export function build(root: string, commands: readonly CommandSpec[] = COMMANDS): Register {
    const constants = exitConstants(root);
    const errors: string[] = [];
    const own = new Map<string, Map<number, string[]>>();
    for (const cmd of commands) {
        const byCode = new Map<number, string[]>();
        for (const rel of cmd.sources) {
            const abs = path.join(root, rel);
            if (!fs.existsSync(abs)) {
                errors.push(`${cmd.verb}: source ${rel} does not exist`);
                continue;
            }
            for (const c of scanCodes(fs.readFileSync(abs, 'utf8'), constants)) {
                byCode.set(c, [...(byCode.get(c) ?? []), rel]);
            }
        }
        own.set(cmd.verb, byCode);
    }
    const rows = new Map<string, Row[]>();
    for (const cmd of commands) {
        const byCode = new Map(own.get(cmd.verb));
        for (const inh of cmd.inherits ?? []) {
            const abs = path.join(root, inh.file);
            if (!fs.existsSync(abs) || !strip(fs.readFileSync(abs, 'utf8')).includes(inh.fragment)) {
                errors.push(`${cmd.verb}: inherits ${inh.from} through \`${inh.fragment}\` in ${inh.file}, which is no longer there`);
                continue;
            }
            for (const c of own.get(inh.from)?.keys() ?? []) {
                if (!byCode.has(c)) byCode.set(c, [`via ${inh.from}`]);
            }
        }
        const declared = new Set(Object.keys(cmd.meanings).map(Number));
        for (const c of byCode.keys()) {
            if (!declared.has(c)) {
                errors.push(`${cmd.verb}: returns ${c} (${(byCode.get(c) ?? []).join(', ')}) but the register gives it no meaning`);
            }
        }
        for (const c of declared) {
            if (!byCode.has(c)) errors.push(`${cmd.verb}: the register documents ${c}, which no scanned source returns`);
        }
        rows.set(
            cmd.verb,
            [...declared]
                .filter((c) => byCode.has(c))
                .sort((a, b) => a - b)
                .map((code) => ({ code, meaning: cmd.meanings[code] as string, emittedIn: byCode.get(code) ?? [] })),
        );
    }
    return { rows, errors };
}

export function render(reg: Register): string {
    const out: string[] = [
        '---',
        'stability: beta',
        'keep-beta-until: 2027-01-16',
        '---',
        '',
        '<!-- GENERATED by src/scripts/build_exit_code_register.ts — do not edit by hand. -->',
        '',
        '# Exit-code register',
        '',
        '> The exit codes a consumer can script against for `init`, `sync`, `doctor` and',
        '> `uninstall`. The set of codes is scanned from the code that returns them and',
        '> reconciled against the meanings on every regeneration, so a code listed here',
        '> is one the command returns today. Regenerate with',
        '> `./scripts-run src/scripts/build_exit_code_register`; the drift check is',
        '> `tests/scripts/build_exit_code_register.test.ts`.',
        '',
    ];
    for (const [verb, rows] of reg.rows) {
        out.push(`## \`${verb}\``, '', '| Code | Meaning | Emitted in |', '|---|---|---|');
        for (const r of rows) {
            out.push(`| \`${r.code}\` | ${r.meaning} | ${r.emittedIn.map((e) => (e.startsWith('via ') ? e : `\`${e}\``)).join(', ')} |`);
        }
        out.push('');
    }
    return `${out.join('\n').trimEnd()}\n`;
}

export function main(argv: readonly string[] = process.argv.slice(2), root: string = REPO): number {
    const check = argv.includes('--check');
    const unknown = argv.filter((a) => a !== '--check');
    if (unknown.length > 0) {
        process.stderr.write(`build_exit_code_register: unknown argument(s): ${unknown.join(' ')}\n`);
        return 2;
    }
    const reg = build(root);
    if (reg.errors.length > 0) {
        process.stderr.write(`❌  build_exit_code_register: the scan and the register disagree:\n`);
        for (const e of reg.errors) process.stderr.write(`    ${e}\n`);
        return 1;
    }
    const text = render(reg);
    const target = path.join(root, OUT_REL);
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (check) {
        if (current !== text) {
            process.stderr.write(
                `❌  ${OUT_REL} is stale — run ./scripts-run src/scripts/build_exit_code_register\n`,
            );
            return 1;
        }
        return 0;
    }
    if (current !== text) fs.writeFileSync(target, text);
    process.stdout.write(`✅  ${OUT_REL} ${current === text ? 'up to date' : 'written'}\n`);
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}
