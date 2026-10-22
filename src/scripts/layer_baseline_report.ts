#!/usr/bin/env tsx
/**
 * The rule layer a setup delivers today, per host, as a reproducible fixture.
 *
 * Installed layer: a real `--global --tools=<host>` install into a scratch HOME,
 * which is the only scope a consumer gets (ADR-020). Projected layer: the
 * project rule directories of the package root at the measured commit. Hook
 * commands: what the install wrote into the scratch HOME's claude settings.
 * Resolved form: the layer-form decision fed the scratch HOME's machine evidence.
 *
 * DETERMINISTIC BY EXCLUSION, NOT BY CHANCE. A receipt, lock or install log is
 * never read: each carries an install time. The scratch root is replaced by
 * `<HOME>` and the measured checkout by `<PACKAGE_ROOT>` before a hook command
 * is recorded, and the host's own version is not
 * read, because it belongs to the machine and not to the commit. What remains is
 * a function of the package tree, so two runs at one commit are byte-equal.
 *
 * REPORT-ONLY: exit 0 whenever every install ran, 1 when one failed, 2 on usage.
 * Not named `check_*` or `lint_*`, which would enter it into the gate population.
 *
 * Usage:
 *   ./scripts-run src/scripts/layer_baseline_report                     # print
 *   ./scripts-run src/scripts/layer_baseline_report --write             # write the evidence file
 *   ./scripts-run src/scripts/layer_baseline_report --package-root <dir> # measure another checkout
 *   ./scripts-run src/scripts/layer_baseline_report --hosts claude-code # a subset
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { GLOBAL_RULE_DIRS, PROJECT_RULE_DIRS } from '../install/globalRuleLayers.js';
import { decideLayerForm, gatherShippedEvidence, type LayerFormDecision } from './_lib/layer_form_decision.js';
import { readMachineEvidence, withMachineEvidence } from './_lib/layer_form_evidence.js';
import { is_thin_entry } from './_lib/thin_rules.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REPORT_REL = 'agents/evidence/analysis/setup-layer-baseline.md';

export interface RuleFile {
    readonly name: string;
    readonly bytes: number;
    readonly form: 'full' | 'stub';
}

export interface LayerFixture {
    readonly host: string;
    readonly scope: 'installed' | 'projected';
    readonly dir: string;
    readonly present: boolean;
    readonly files: readonly RuleFile[];
    readonly bytes: number;
    readonly full: number;
    readonly stub: number;
    readonly digest: string;
}

export interface HostFixture {
    readonly host: string;
    readonly installed: LayerFixture;
    readonly hookCommands: readonly string[];
    readonly form: LayerFormDecision;
}

export interface Baseline {
    readonly commit: string;
    readonly packageVersion: string;
    readonly hosts: readonly HostFixture[];
    readonly projected: readonly LayerFixture[];
}

export function readRuleLayer(host: string, scope: LayerFixture['scope'], dir: string, label: string): LayerFixture {
    const present = fs.existsSync(dir);
    const names = present ? fs.readdirSync(dir).filter((f) => /\.(md|mdc)$/.test(f)).sort() : [];
    const files: RuleFile[] = names.map((name) => {
        const body = fs.readFileSync(path.join(dir, name));
        return { name, bytes: body.length, form: is_thin_entry(body.toString('utf-8')) ? 'stub' : 'full' };
    });
    const digest = createHash('sha256')
        .update(files.map((f) => `${f.name}\t${f.bytes}\t${f.form}`).join('\n'))
        .digest('hex')
        .slice(0, 16);
    return {
        host,
        scope,
        dir: label,
        present,
        files,
        bytes: files.reduce((n, f) => n + f.bytes, 0),
        full: files.filter((f) => f.form === 'full').length,
        stub: files.filter((f) => f.form === 'stub').length,
        digest,
    };
}

/** Tokens a hook command may carry into committed evidence; anything else becomes `<arg>`. */
const SAFE_TOKEN = [
    /^<(?:HOME|PACKAGE_ROOT)>(?:\/[\w.-]+)*\/?$/u,
    /^--?[A-Za-z][A-Za-z0-9-]*$/u,
    /^[a-z][a-z_]{0,23}$/u,
    /^\d{1,3}$/u,
    /^(?:&&|\|\||;|\||\[|\]|!)$/u,
];

/**
 * A hook command as committed evidence: the binary, flags, short lowercase
 * words and placeholder paths survive; every other token — a header value, a
 * URL, an assignment, an absolute path outside the placeholders — is `<arg>`,
 * so a token or an internal host embedded in a hook never reaches the report.
 */
export function redactHookCommand(command: string): string {
    return command
        .split(/\s+/u)
        .filter((t) => t !== '')
        .map((t) => (SAFE_TOKEN.some((re) => re.test(t)) ? t : '<arg>'))
        .join(' ');
}

export function readHookCommands(home: string, packageRoot?: string): string[] {
    const settings = path.join(home, '.claude', 'settings.json');
    if (!fs.existsSync(settings)) return [];
    const parsed = JSON.parse(fs.readFileSync(settings, 'utf-8')) as {
        hooks?: Record<string, { matcher?: string; hooks?: { command?: string }[] }[]>;
    };
    const out: string[] = [];
    for (const event of Object.keys(parsed.hooks ?? {})) {
        for (const group of parsed.hooks?.[event] ?? []) {
            for (const h of group.hooks ?? []) {
                if (typeof h.command !== 'string') continue;
                let command = h.command.split(home).join('<HOME>');
                if (packageRoot !== undefined) command = command.split(packageRoot).join('<PACKAGE_ROOT>');
                const matcher = group.matcher ? ` [${/^[\w|*.()-]{1,80}$/u.test(group.matcher) ? group.matcher : '<arg>'}]` : '';
                out.push(`${event}${matcher}: ${redactHookCommand(command)}`);
            }
        }
    }
    return out;
}

function scratchEnv(home: string): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env['AGENT_CONFIG_DEPLOY_INVENTORY'];
    delete env['AGENT_CONFIG_INSTALLED_TOOLS'];
    env['HOME'] = home;
    env['EVENT4U_CONFIG_HOME'] = path.join(home, '.event4u', 'agent-config');
    env['AGENT_CONFIG_NO_UI'] = '1';
    env['CI'] = '1';
    return env;
}

function readPackageVersion(packageRoot: string): string {
    try {
        const raw = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf-8')) as { version?: unknown };
        return typeof raw.version === 'string' && raw.version.trim() ? raw.version.trim() : 'unknown';
    } catch {
        return 'unknown';
    }
}

function readCommit(packageRoot: string): string {
    const r = spawnSync('git', ['-C', packageRoot, 'rev-parse', '--short=9', 'HEAD'], { encoding: 'utf-8' });
    return r.status === 0 ? r.stdout.trim() : 'unknown';
}

export function measureHost(host: string, packageRoot: string, version: string): HostFixture {
    const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'layer-baseline-')));
    try {
        const home = path.join(scratch, 'home');
        const cwd = path.join(scratch, 'cwd');
        fs.mkdirSync(home);
        fs.mkdirSync(cwd);
        const env = scratchEnv(home);
        const r = spawnSync('bash', [path.join(packageRoot, 'src', 'scripts', 'install'), '--global', `--tools=${host}`, '--yes', '--quiet'], {
            cwd,
            env,
            encoding: 'utf-8',
            timeout: 240_000,
        });
        if (r.status !== 0) throw new Error(`install --tools=${host} exited ${String(r.status)}:\n${r.stdout}\n${r.stderr}`);
        const rel = GLOBAL_RULE_DIRS[host] as string;
        const installed = readRuleLayer(host, 'installed', path.join(home, rel), `<HOME>/${rel}`);
        const machine = readMachineEvidence(packageRoot, { HOME: home, EVENT4U_CONFIG_HOME: env['EVENT4U_CONFIG_HOME'] });
        const form = decideLayerForm(withMachineEvidence(gatherShippedEvidence(packageRoot, version)(host), machine));
        return { host, installed, hookCommands: readHookCommands(home, packageRoot), form };
    } finally {
        fs.rmSync(scratch, { recursive: true, force: true });
    }
}

export function buildBaseline(packageRoot: string, hosts: readonly string[]): Baseline {
    const version = readPackageVersion(packageRoot);
    const projected = Object.keys(PROJECT_RULE_DIRS)
        .sort()
        .map((rel) => readRuleLayer(PROJECT_RULE_DIRS[rel] as string, 'projected', path.join(packageRoot, rel), rel));
    return {
        commit: readCommit(packageRoot),
        packageVersion: version,
        hosts: hosts.map((h) => measureHost(h, packageRoot, version)),
        projected,
    };
}

function layerRow(l: LayerFixture, form: string): string {
    return `| ${l.host} | ${l.scope} | \`${l.dir}\` | ${l.present ? l.files.length : 'absent'} | ${l.bytes} | ${l.full} | ${l.stub} | \`${l.digest}\` | ${form} |`;
}

export function renderBaseline(b: Baseline): string {
    const lines = [
        '<!-- evidence-type: analysis -->',
        '# Setup layer baseline',
        '',
        `Measured at commit \`${b.commit}\`, package version \`${b.packageVersion}\`, by`,
        '`./scripts-run src/scripts/layer_baseline_report`. Every row below names that commit.',
        '',
        'Excluded so that two runs at one commit are byte-equal: the install receipt, lock and',
        'log (each carries an install time), the scratch root (recorded as `<HOME>`), the',
        'measured checkout (recorded as `<PACKAGE_ROOT>`), and the host\'s own version (a',
        'property of the machine, not of the commit).',
        '',
        '| host | scope | dir | files | bytes | full | stub | file-set digest | resolved form |',
        '|---|---|---|---|---|---|---|---|---|',
    ];
    for (const h of b.hosts) lines.push(layerRow(h.installed, `${h.form.form} (${h.form.reason})`));
    for (const p of b.projected) lines.push(layerRow(p, 'project tree, not decided per machine'));
    lines.push('', '## Hook commands written', '');
    for (const h of b.hosts) {
        lines.push(`### ${h.host} — ${h.hookCommands.length} command(s)`, '');
        if (h.hookCommands.length === 0) lines.push('None written.', '');
        else lines.push('~~~text', ...h.hookCommands, '~~~', '');
    }
    lines.push('## File sets', '');
    const seen = new Set<string>();
    for (const l of [...b.hosts.map((h) => h.installed), ...b.projected]) {
        if (!l.present || seen.has(l.digest)) continue;
        seen.add(l.digest);
        lines.push(`### \`${l.digest}\``, '', '~~~text', ...l.files.map((f) => `${f.name}\t${f.bytes}\t${f.form}`), '~~~', '');
    }
    return `${lines.join('\n').trimEnd()}\n`;
}

interface Args {
    readonly write: boolean;
    readonly packageRoot: string;
    readonly hosts: readonly string[];
}

export function parseArgs(argv: readonly string[]): Args | null {
    let write = false;
    let packageRoot = REPO_ROOT;
    let hosts: string[] = Object.keys(GLOBAL_RULE_DIRS).sort();
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--write') write = true;
        else if (a === '--package-root' && argv[i + 1] !== undefined) packageRoot = path.resolve(argv[++i] as string);
        else if (a === '--hosts' && argv[i + 1] !== undefined) {
            hosts = (argv[++i] as string).split(',').filter(Boolean);
            if (hosts.some((h) => !(h in GLOBAL_RULE_DIRS))) return null;
        } else return null;
    }
    return { write, packageRoot, hosts };
}

export function main(argv: readonly string[]): number {
    const args = parseArgs(argv);
    if (args === null) {
        process.stderr.write(
            `usage: layer_baseline_report [--write] [--package-root <dir>] [--hosts ${Object.keys(GLOBAL_RULE_DIRS).sort().join(',')}]\n`,
        );
        return 2;
    }
    let report: string;
    try {
        report = renderBaseline(buildBaseline(args.packageRoot, args.hosts));
    } catch (e) {
        process.stderr.write(`layer_baseline_report: ${(e as Error).message}\n`);
        return 1;
    }
    if (args.write) {
        fs.writeFileSync(path.join(REPO_ROOT, REPORT_REL), report);
        process.stdout.write(`wrote ${REPORT_REL}\n`);
    } else process.stdout.write(report);
    return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    process.exit(main(process.argv.slice(2)));
}
