#!/usr/bin/env tsx
/**
 * Gate: the package-delivered session-start layer of a DEFAULT global install
 * stays at or under 80,000 chars (`road-to-a-session-start-under-the-host-limit`
 * step 3.1, council D2 (b)).
 *
 * Claude Code sums every unconditional instruction file it loads at session
 * start and warns once the total passes its combined limit — 120,000 chars on a
 * 200K window, 150,000 on a 1M one. The package's share is the user layer,
 * `~/.claude/rules`; the project layer and the memory index share what is left.
 * So this measures the package's share, fails above the budget, and always
 * prints the allowance the project layer keeps under the smaller limit.
 *
 * WHAT IS MEASURED. A real `install --global --tools=claude-code` into a scratch
 * HOME — default packs, no settings file, no enrolment, no `--full` pin — the
 * same orchestrator `tests/install/global_install_hooks_smoke.test.ts` drives.
 * A copied fixture would measure what the fixture author thought the installer
 * writes; this measures what it writes, including the thin pass and its carrier
 * probe. Then every `.md` under `<home>/.claude/rules` WITHOUT a `paths:`
 * frontmatter key is summed (a path-scoped file loads on a path match, not at
 * session start), counted as the whole file's characters — the unit the host's
 * notice is stated in.
 *
 * THE HOME PATH IS NORMALISED, AND SAID SO. The layer carries absolute paths
 * under the HOME it was installed into (the bodies index declares the bodies
 * directory; a kept or older file may name one too), and a scratch HOME under the OS temp directory
 * runs to ~70 chars where a consumer's is `/Users/<name>` or `/home/<name>`.
 * Measured raw, every occurrence of the scratch path would bill a length no
 * consumer pays. So each occurrence of the measured HOME (and its realpath) is
 * replaced by {@link REPRESENTATIVE_HOME} (15 chars) before counting; the gate
 * decides on that normalised total, and the report prints the raw total beside
 * it. A consumer with a longer HOME pays the difference — it is a declared
 * normalisation, not a hidden discount.
 *
 * THE CARRIER MATTERS. The installer thins only when the SessionStart probe
 * reaches the hook dispatcher, which needs `dist/hooks/dispatch.js`. Without the
 * bundle the layer stays full and this gate goes red for that reason; the
 * report names the probe outcome so the cause is not mistaken for a size
 * regression. Build it with `npm run build:hooks`.
 *
 * `--home <dir>` measures an existing HOME instead of projecting one; `--keep`
 * leaves the scratch HOME in place for inspection; `--quiet` is accepted for the
 * Taskfile's uniform call and changes nothing — the report is the instrument.
 *
 * Exit: 0 within budget · 1 over budget · 2 usage, or the install failed.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { parseGateArgs, USAGE_EXIT } from './_lib/gate_args.js';
import { isUnconditional } from './_lib/installed_layer.js';
import { reportScanned } from './_lib/scan_scope.js';

const GATE = 'check_session_start_budget';
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

/** The package's share of the session-start layer (D2 (b), the stricter seat). */
export const SESSION_START_BUDGET = 80_000;
/** The host's combined limit on a 200K window — the smaller of the two it states. */
export const HOST_COMBINED_LIMIT = 120_000;
export const TOP_FILES = 10;
/** A representative consumer HOME (`/Users/<name>`, `/home/<name>`) — the normalisation target. */
export const REPRESENTATIVE_HOME = '/Users/username';

export interface SessionStartFile {
    readonly file: string;
    /** Chars after the HOME normalisation — what the gate decides on. */
    readonly chars: number;
    /** Chars as found on disk. */
    readonly rawChars: number;
}

export interface SessionStartReading {
    readonly rulesDir: string;
    /** Every `.md` read, path-scoped ones included. */
    readonly scanned: number;
    /** The unconditional files, largest first. */
    readonly files: readonly SessionStartFile[];
    /** Normalised total — the figure the budget applies to. */
    readonly total: number;
    /** The same files, counted as found on disk. */
    readonly rawTotal: number;
    /** The HOME paths replaced by {@link REPRESENTATIVE_HOME}, empty when none was given. */
    readonly normalisedFrom: readonly string[];
}

export interface BudgetVerdict {
    readonly ok: boolean;
    readonly total: number;
    readonly budget: number;
    /** What the project layer may still add before the host limit — negative when already over. */
    readonly projectAllowance: number;
}

/** The spellings of `home` a stub may carry: as given and its realpath, longest first. */
export function homeSpellings(home: string): string[] {
    const out = new Set([path.resolve(home)]);
    try {
        out.add(fs.realpathSync(home));
    } catch {
        // A HOME that does not exist has no second spelling.
    }
    return [...out].filter((h) => h !== path.parse(h).root).sort((a, b) => b.length - a.length);
}

/** `text` with every occurrence of each spelling replaced by {@link REPRESENTATIVE_HOME}. */
export function normaliseHome(text: string, spellings: readonly string[]): string {
    let out = text;
    for (const h of spellings) out = out.split(h).join(REPRESENTATIVE_HOME);
    return out;
}

/**
 * Sum the session-start chars of one rule directory. A missing directory reads
 * as empty. With `home`, every occurrence of it is normalised before counting.
 */
export function measureSessionStartLayer(rulesDir: string, home: string | null = null): SessionStartReading {
    const spellings = home === null ? [] : homeSpellings(home);
    let names: string[] = [];
    try {
        names = fs.readdirSync(rulesDir).filter((n) => n.endsWith('.md')).sort();
    } catch {
        return { rulesDir, scanned: 0, files: [], total: 0, rawTotal: 0, normalisedFrom: spellings };
    }
    const files: SessionStartFile[] = [];
    let scanned = 0;
    for (const name of names) {
        const abs = path.join(rulesDir, name);
        let text: string;
        try {
            if (!fs.statSync(abs).isFile()) continue;
            text = fs.readFileSync(abs, 'utf8');
        } catch {
            continue;
        }
        scanned += 1;
        if (isUnconditional(text)) files.push({ file: name, chars: normaliseHome(text, spellings).length, rawChars: text.length });
    }
    files.sort((a, b) => b.chars - a.chars || a.file.localeCompare(b.file));
    return {
        rulesDir,
        scanned,
        files,
        total: files.reduce((n, f) => n + f.chars, 0),
        rawTotal: files.reduce((n, f) => n + f.rawChars, 0),
        normalisedFrom: spellings,
    };
}

export function budgetVerdict(
    total: number,
    budget: number = SESSION_START_BUDGET,
    hostLimit: number = HOST_COMBINED_LIMIT,
): BudgetVerdict {
    return { ok: total <= budget, total, budget, projectAllowance: hostLimit - total };
}

export function renderReport(reading: SessionStartReading, verdict: BudgetVerdict, note: string | null = null): string[] {
    const out = [
        `${verdict.ok ? '✅' : '❌'}  ${GATE}: ${verdict.total.toLocaleString('en-US')} chars at session start (HOME-normalised) ` +
            `from ${reading.files.length} unconditional file(s) under ${reading.rulesDir} ` +
            `(budget ${verdict.budget.toLocaleString('en-US')}${verdict.ok ? '' : `, over by ${(verdict.total - verdict.budget).toLocaleString('en-US')}`})`,
        `   project-layer allowance under the ${HOST_COMBINED_LIMIT.toLocaleString('en-US')}-char host limit: ` +
            `${verdict.projectAllowance.toLocaleString('en-US')} chars`,
    ];
    if (reading.normalisedFrom.length > 0) {
        out.push(
            `   normalised: HOME ${reading.normalisedFrom.join(' / ')} counted as ${REPRESENTATIVE_HOME}; ` +
                `raw total ${reading.rawTotal.toLocaleString('en-US')} chars`,
        );
    }
    if (note !== null) out.push(`   ${note}`);
    out.push(`   top ${Math.min(TOP_FILES, reading.files.length)} by size:`);
    for (const f of reading.files.slice(0, TOP_FILES)) out.push(`     ${String(f.chars).padStart(7)}  ${f.file}`);
    return out;
}

export interface ProjectionResult {
    readonly ok: boolean;
    /** The orchestrator's exit status; non-zero also when it preserved a user-modified file. */
    readonly status: number | null;
    readonly output: string;
    /** `reached` / `not-reached` from the install's own carrier record, or null when none was written. */
    readonly carrier: string | null;
    readonly layer: 'thinned' | 'demoted' | 'full';
}

/** The environment a default install sees: a scratch HOME and nothing that redirects or opts in. */
export function defaultInstallEnv(home: string, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...base };
    for (const key of Object.keys(env)) {
        if (key.startsWith('AGENT_CONFIG_') || key.startsWith('EVENT4U_')) delete env[key];
    }
    return {
        ...env,
        HOME: home,
        USERPROFILE: home,
        EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
        AGENT_CONFIG_NO_UI: '1',
        CI: '1',
    };
}

/**
 * Run the real global install for claude-code into `home`. `extraArgs` exists
 * for tests that stage a prior layer (`--full`); the gate passes none.
 */
export function projectDefaultInstall(packageRoot: string, home: string, extraArgs: readonly string[] = []): ProjectionResult {
    const env = defaultInstallEnv(home);
    const args = [path.join(packageRoot, 'src', 'scripts', 'install'), '--global', '--tools=claude-code', '--yes', '--quiet', ...extraArgs];
    // From an empty project under the scratch HOME, not the checkout: a checkout
    // carrying its own `.claude/rules` trips the installer's layer-overlap stop,
    // and HOME itself would be its own project layer.
    const cwd = path.join(home, 'project');
    fs.mkdirSync(cwd, { recursive: true });
    const r = spawnSync('bash', args, {
        cwd,
        encoding: 'utf8',
        timeout: 300_000,
        env,
    });
    const runtime = path.join(env['EVENT4U_CONFIG_HOME'] as string, 'runtime');
    let carrier: string | null = null;
    try {
        const rec = JSON.parse(fs.readFileSync(path.join(runtime, 'carrier.json'), 'utf8')) as { hosts?: Record<string, { outcome?: string }> };
        carrier = rec.hosts?.['claude']?.outcome ?? null;
    } catch {
        carrier = null;
    }
    const layer = fs.existsSync(path.join(runtime, 'demoted')) ? 'demoted' : fs.existsSync(path.join(runtime, 'thinned')) ? 'thinned' : 'full';
    return { ok: r.status === 0, status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}`, carrier, layer };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const parsed = parseGateArgs(GATE, argv, {
        home: { type: 'string' },
        keep: { type: 'boolean' },
        quiet: { type: 'boolean' },
    });
    if (!parsed.ok) {
        process.stderr.write(`${parsed.message}\n`);
        return USAGE_EXIT;
    }
    let home = parsed.values.home;
    let scratch: string | null = null;
    let note: string | null = null;
    if (home === undefined) {
        scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-session-start-'));
        home = scratch;
        const res = projectDefaultInstall(REPO_ROOT, home);
        if (!res.ok) {
            process.stderr.write(`${GATE}: the default install into ${home} failed:\n${res.output.slice(-4000)}\n`);
            if (parsed.values.keep !== true) fs.rmSync(scratch, { recursive: true, force: true });
            return 2;
        }
        note = `default install into a scratch HOME: layer ${res.layer}, carrier probe ${res.carrier ?? 'not recorded'}`;
        if (res.layer !== 'thinned') {
            note += ' — the installer thins only on a reached carrier; is dist/hooks/dispatch.js built (`npm run build:hooks`)?';
        }
    }
    try {
        const reading = measureSessionStartLayer(path.join(home, '.claude', 'rules'), home);
        reportScanned({
            gate: GATE,
            scanned: reading.scanned,
            units: 'rule file(s)',
            roots: [reading.rulesDir],
        });
        const verdict = budgetVerdict(reading.total);
        const lines = renderReport(reading, verdict, note);
        // Printed in full even under `--quiet`: the total and the allowance are
        // the instrument the project layer is budgeted against, not chatter.
        (verdict.ok ? process.stdout : process.stderr).write(`${lines.join('\n')}\n`);
        return verdict.ok ? 0 : 1;
    } finally {
        if (scratch !== null && parsed.values.keep !== true) fs.rmSync(scratch, { recursive: true, force: true });
    }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exitCode = main();
}
