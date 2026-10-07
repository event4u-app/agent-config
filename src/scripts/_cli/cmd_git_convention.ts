/**
 * `agent-config git:convention <subcommand>` — the git convention as code an
 * installed command can reach.
 *
 * A consumer project has neither `scripts-run` nor `node_modules`, so a command
 * that needs the strategy, the commit format or the branch pattern can only ask
 * the `agent-config` binary. `settings:get` answers "not set" for a file that
 * does not parse, which is the reading that turns an unreadable `rebase` into a
 * merge; this verb reports the six states of `_lib/git_convention.ts` instead.
 *
 * Subcommands live in one table so a new one is a row, not a new verb.
 *
 * Every key is read through `_lib/git_convention_carrier.ts`: the committed
 * `.git-convention.yml` over the developer layers, `update_strategy` at the
 * commit the branch is judged against. Where this checkout's own value differs,
 * it is printed as a candidate beside the value in force.
 *
 * `show` exit codes: `0` every key readable · `1` a key, or this checkout's
 * candidate for it, is in a state `isRefusal` names (the set `sync` refuses
 * with exit 4) · `2` usage error.
 *
 * `subject` reads subjects on stdin and exits `0` all valid · `1` a subject
 * fails, or the format cannot be read · `2` usage · `3` decided by a validator
 * this verb does not run, or a validator and the committed declaration
 * disagree. A `commit-msg` hook does not replace the check; it is named as
 * also running at commit. `ticket` exits `0`; `branch`
 * prints the name and exits `0`, or `1` on a value it would have to rewrite.
 *
 * `sync` is `sync_pr_branch` run in-process, its arguments and exit codes
 * unchanged: `0` current or merged · `1` conflict or no base · `2` internal
 * error · `3` behind under a strategy other than `merge` · `4` the strategy
 * cannot be read.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GIT_CONVENTION_KEYS, conventionDefault, describeRefusal, invalidReason, isRefusal, parseLayerText, type GitConventionReading } from '../_lib/git_convention.js';
import { CARRIER_PATH, readCommittedConvention, type TargetDeps } from '../_lib/git_convention_carrier.js';
import {
    FAMILY_ERE,
    checkSubject,
    commitlintIssuePrefixes,
    parseTicketKeys,
    renderBranch,
    ruleName,
    ticketCandidates,
    type CommitFormat,
    type SubjectFamily,
    type SubjectRule,
} from '../_lib/git_convention_grammar.js';
import { main as syncPrBranch } from '../sync_pr_branch.js';

export interface GitConventionResult {
    code: 0 | 1 | 2 | 3 | 4;
    out: string[];
    err: string[];
}

export interface CommitMessageValidator {
    kind: 'commit-msg hook' | 'commitlint config';
    path: string;
}

/** Every file name in commitlint's documented config search places; `package.json` is checked separately. */
const COMMITLINT_FILES = [
    '.commitlintrc',
    '.commitlintrc.json',
    '.commitlintrc.yaml',
    '.commitlintrc.yml',
    '.commitlintrc.js',
    '.commitlintrc.cjs',
    '.commitlintrc.mjs',
    '.commitlintrc.ts',
    '.commitlintrc.cts',
    '.commitlintrc.mts',
    'commitlint.config.js',
    'commitlint.config.cjs',
    'commitlint.config.mjs',
    'commitlint.config.ts',
    'commitlint.config.cts',
    'commitlint.config.mts',
] as const;

function _git(cwd: string, ...args: string[]): string | null {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
}

function _isExecutableFile(p: string): boolean {
    try {
        const st = fs.statSync(p);
        return st.isFile() && (st.mode & 0o111) !== 0;
    } catch {
        return false;
    }
}

/**
 * A repository-level commit-message validator, which outranks
 * `git.commit_format` because it rejects the commit the setting would shape.
 *
 * A hook counts only where git will run it: the path comes from git, so
 * `core.hooksPath` and worktrees resolve, and a `.husky/commit-msg` this clone
 * never pointed `core.hooksPath` at is a file in the tree, not a hook.
 */
export function commitMessageValidator(cwd: string): CommitMessageValidator | null {
    const top = _git(cwd, 'rev-parse', '--show-toplevel') ?? cwd;
    const hook = _git(cwd, 'rev-parse', '--path-format=absolute', '--git-path', 'hooks/commit-msg');
    if (hook !== null && _isExecutableFile(hook)) return { kind: 'commit-msg hook', path: hook };
    for (const name of COMMITLINT_FILES) {
        const p = path.join(top, name);
        if (fs.existsSync(p)) return { kind: 'commitlint config', path: p };
    }
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(top, 'package.json'), 'utf-8')) as Record<string, unknown>;
        if (pkg.commitlint !== undefined) return { kind: 'commitlint config', path: path.join(top, 'package.json') };
    } catch {
        // No package.json, or one that does not parse: neither declares a validator.
    }
    return null;
}


function _short(sha: string | null | undefined): string {
    return sha === null || sha === undefined ? '?' : sha.slice(0, 12);
}

/** `show` with the target lookups injectable; the verb passes none. */
export function showConvention(args: readonly string[], cwd: string, deps?: TargetDeps): GitConventionResult {
    let json = false;
    let base: string | null = null;
    for (let i = 0; i < args.length; i++) {
        const a = args[i] as string;
        if (a === '--json') json = true;
        else if (a === '--base' && args[i + 1] !== undefined && !(args[i + 1] as string).startsWith('--')) base = args[++i] as string;
        else return { code: 2, out: [], err: [`unknown argument: ${a}`, USAGE] };
    }
    const read = readCommittedConvention(cwd, { override: base, ...(deps ? { deps } : {}) });
    const readings = read.readings as Record<(typeof GIT_CONVENTION_KEYS)[number], GitConventionReading>;
    const validator = commitMessageValidator(cwd);
    const ok = !GIT_CONVENTION_KEYS.some((k) => isRefusal(readings[k].state) || (read.candidates[k] !== undefined && isRefusal((read.candidates[k] as GitConventionReading).state)));
    const code: 0 | 1 = ok ? 0 : 1;

    if (json) {
        const keys: Record<string, unknown> = {};
        for (const k of GIT_CONVENTION_KEYS) {
            const { key: _key, ...rest } = readings[k];
            const cand = read.candidates[k];
            keys[k] = {
                ...rest,
                read_at: read.readAt[k] ?? null,
                candidate: cand === undefined ? null : { value: cand.value, source: cand.source, state: cand.state, reason: cand.reason },
            };
        }
        return {
            code,
            out: [JSON.stringify({ ok, keys, target: read.target, commit_message_validator: validator }, null, 2)],
            err: [],
        };
    }

    const out: string[] = [];
    for (const k of GIT_CONVENTION_KEYS) {
        const r = readings[k];
        out.push(r.value === null ? `git.${k} — unknown` : `git.${k} = ${r.value}`);
        out.push(`  state     ${r.state}`);
        out.push(`  source    ${r.source ?? '(template default)'}`);
        const at = read.readAt[k];
        if (k === 'update_strategy' && read.target !== null) {
            out.push(`  read at   ${_short(read.target.sha)} — ${read.target.ref}, the commit this branch is judged against`);
        } else if (at !== null && at !== undefined) {
            out.push(`  read at   ${_short(at)} — HEAD`);
        }
        if (r.reason !== null) out.push(`  ⚠️  ${describeRefusal(r)}`);
        const cand = read.candidates[k];
        if (cand !== undefined) {
            out.push(
                `  candidate ${cand.value ?? 'unknown'} (${cand.state}) from ${cand.source ?? '(template default)'} — this checkout's value; the value above is in force`,
            );
            if (cand.reason !== null) out.push(`  ⚠️  ${describeRefusal(cand)}`);
        }
    }
    out.push(`team declaration: ${CARRIER_PATH} at the repository root (ADR-282)`);
    out.push(
        validator === null
            ? 'commit-message validator: none in this repository'
            : `commit-message validator: ${validator.kind} at ${validator.path} — it outranks git.commit_format`,
    );
    return { code, out, err: [] };
}

/** Where the skill's tier 2 persists an approved measurement. */
export const APPROVED_CARD = 'agents/memory/curated/conventions/approved/commit-subject.md';

function _flags(args: readonly string[], names: readonly string[]): { values: Record<string, string>; json: boolean; positional: string[]; bad: string | null } {
    const values: Record<string, string> = {};
    const positional: string[] = [];
    let json = false;
    for (let i = 0; i < args.length; i++) {
        const a = args[i] as string;
        if (a === '--json') json = true;
        else if (a.startsWith('--')) {
            const v = args[i + 1];
            if (!names.includes(a.slice(2)) || v === undefined || v.startsWith('--')) return { values, json, positional, bad: a };
            values[a.slice(2)] = v;
            i++;
        } else positional.push(a);
    }
    return { values, json, positional, bad: null };
}

function _cardFamily(root: string): string | null {
    let text: string;
    try {
        text = fs.readFileSync(path.join(root, APPROVED_CARD), 'utf-8');
    } catch {
        return null;
    }
    return /^dominant_family:\s*["']?([a-z-]+)/m.exec(text)?.[1] ?? null;
}

function _hasKey(value: unknown, key: string): boolean {
    if (value === null || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some((v) => _hasKey(v, key));
    return Object.entries(value).some(([k, v]) => k === key || _hasKey(v, key));
}

/**
 * Whether a commitlint config rejects a subject that leads with a ticket: it
 * extends the conventional preset and sets no header grammar of its own. Read
 * from the parsed config, so a name in a comment decides nothing. A JS or TS
 * config is code; evaluating it to find out would run it, so it is `unknown`,
 * as is a config that does not parse.
 */
function _commitlintRejectsTicketLead(configPath: string): boolean | 'unknown' {
    const base = path.basename(configPath);
    if (/\.[cm]?[jt]s$/.test(base)) return 'unknown';
    let config: unknown;
    try {
        const text = fs.readFileSync(configPath, 'utf-8');
        if (base === 'package.json') {
            config = (JSON.parse(text) as { commitlint?: unknown }).commitlint;
        } else {
            const layer = parseLayerText(text);
            if (layer.parsed !== 'valid') return 'unknown';
            config = layer.data;
        }
    } catch {
        return 'unknown';
    }
    if (config === null || typeof config !== 'object') return 'unknown';
    const ext = (config as { extends?: unknown }).extends;
    const presets = (Array.isArray(ext) ? ext : [ext]).filter((e): e is string => typeof e === 'string');
    return presets.some((e) => e.includes('config-conventional')) && !_hasKey(config, 'headerPattern');
}

type SubjectPlan =
    | { kind: 'rule'; rule: SubjectRule; tier: string; notes: string[] }
    | { kind: 'stop'; code: 0 | 1 | 3; lines: string[] };

function _planSubject(values: Record<string, string>, cwd: string): SubjectPlan {
    if (values.format !== undefined) {
        if (!['ticket-scope', 'ticket-conventional'].includes(values.format)) return { kind: 'stop', code: 1, lines: [`unknown format: ${values.format}`] };
        return { kind: 'rule', rule: { format: values.format as CommitFormat }, tier: 'passed by the caller', notes: [] };
    }
    if (values.family !== undefined) {
        if (!FAMILY_ERE.some(([f]) => f === values.family)) return { kind: 'stop', code: 1, lines: [`no grammar for family: ${values.family}`] };
        return { kind: 'rule', rule: { family: values.family as SubjectFamily }, tier: 'passed by the caller', notes: [] };
    }
    const read = readCommittedConvention(cwd, { keys: ['commit_format'] });
    const reading = read.readings.commit_format as GitConventionReading;
    if (isRefusal(reading.state)) return { kind: 'stop', code: 1, lines: [describeRefusal(reading)] };
    const committed = reading.state === 'valid' && (reading.source ?? '').startsWith(CARRIER_PATH);
    // A developer file holding the template default may only be `settings:sync`'s
    // insert, so only a value other than the default is a developer's choice.
    const declared = committed || (reading.state === 'valid' && reading.value !== conventionDefault('commit_format'));
    const validator = commitMessageValidator(cwd);
    // A hook's existence says nothing about what it checks (a Change-Id or
    // trailer hook checks nothing), so the subject is still checked here.
    const notes = validator?.kind === 'commit-msg hook' ? [`note: the commit-msg hook at ${validator.path} also runs at commit`] : [];
    if (validator?.kind === 'commitlint config') {
        const verdict = committed && reading.value === 'ticket-conventional' ? _commitlintRejectsTicketLead(validator.path) : false;
        if (verdict === true) {
            return {
                kind: 'stop',
                code: 3,
                lines: [
                    `validator: ${validator.path} extends the conventional preset, which rejects a subject that leads with a ticket`,
                    `declared:  git.commit_format: ticket-conventional in ${reading.source}`,
                    'the two disagree; this verb adopts neither — settle one of them',
                ],
            };
        }
        return {
            kind: 'stop',
            code: 3,
            lines: [
                ...(verdict === 'unknown'
                    ? [`cannot tell whether ${validator.path} accepts a ticket-led subject (git.commit_format: ticket-conventional in ${reading.source}); this verb does not evaluate it`]
                    : []),
                `the commitlint config at ${validator.path} outranks git.commit_format; no commit-msg hook runs it`,
                `run: printf '%s\n' "<subject>" | npx --no-install commitlint`,
            ],
        };
    }
    if (declared) return { kind: 'rule', rule: { format: reading.value as CommitFormat }, tier: `declared in ${reading.source}`, notes };
    const family = _cardFamily(read.root);
    if (family !== null) {
        if (!FAMILY_ERE.some(([f]) => f === family)) return { kind: 'stop', code: 3, lines: [`the approved family ${family} in ${APPROVED_CARD} has no grammar to validate against`] };
        return { kind: 'rule', rule: { family: family as SubjectFamily }, tier: `approved in ${APPROVED_CARD}`, notes };
    }
    return { kind: 'rule', rule: { format: (reading.value ?? 'ticket-scope') as CommitFormat }, tier: 'default (Conventional Commits)', notes };
}

/** Under `--json` every exit prints one object carrying `ok`, `code` and the human `lines`. */
function _subjectResult(json: boolean, code: GitConventionResult['code'], lines: string[], err: string[] = [], extra: Record<string, unknown> = {}): GitConventionResult {
    if (!json) return { code, out: lines, err };
    return { code, out: [JSON.stringify({ ok: code === 0, code, lines, ...extra }, null, 2)], err };
}

export function subjectCommand(args: readonly string[], cwd: string, stdin = ''): GitConventionResult {
    const f = _flags(args, ['format', 'family']);
    if (f.bad !== null || f.positional.length > 0) {
        const why = `unknown argument: ${f.bad ?? f.positional[0]}`;
        return _subjectResult(f.json, 2, f.json ? [why] : [], [why, USAGE]);
    }
    const subjects = stdin.split('\n').map((l) => l.trimEnd()).filter((l) => l !== '');
    if (subjects.length === 0) return _subjectResult(f.json, 2, f.json ? ['no subjects on stdin'] : [], ['no subjects on stdin', USAGE]);
    const plan = _planSubject(f.values, cwd);
    if (plan.kind === 'stop') return _subjectResult(f.json, plan.code, plan.lines);
    const failures = subjects.map((s) => ({ s, v: checkSubject(s, plan.rule) })).filter((x) => !x.v.ok);
    const lines = failures.length === 0
        ? [`${subjects.length} subject(s) valid under ${ruleName(plan.rule)} (${plan.tier})`, ...plan.notes]
        : [...failures.map((x) => `✗ ${x.s}\n  ${x.v.ok ? '' : x.v.rule}`), ...plan.notes];
    return _subjectResult(f.json, failures.length === 0 ? 0 : 1, lines, [], {
        rule: ruleName(plan.rule),
        tier: plan.tier,
        notes: plan.notes,
        failures: failures.map((x) => ({ subject: x.s, rule: x.v.ok ? null : x.v.rule })),
    });
}

function _commitlintProposal(cwd: string): { keys: string[]; from: string } | null {
    const v = commitMessageValidator(cwd);
    if (v?.kind !== 'commitlint config') return null;
    try {
        const keys = commitlintIssuePrefixes(fs.readFileSync(v.path, 'utf-8'));
        return keys.length === 0 ? null : { keys, from: v.path };
    } catch {
        return null;
    }
}

export function ticketCommand(args: readonly string[], cwd: string): GitConventionResult {
    const f = _flags(args, ['keys']);
    if (f.bad !== null || f.positional.length > 1) return { code: 2, out: [], err: [`unknown argument: ${f.bad ?? f.positional[1]}`, USAGE] };
    const name = f.positional[0] ?? _git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD') ?? '';
    const keys = f.values.keys === undefined ? null : parseTicketKeys(f.values.keys);
    const all = ticketCandidates(name, keys);
    const ticket = all.find((c) => c.status === 'ticket')?.token ?? null;
    const proposal = keys === null ? _commitlintProposal(cwd) : null;
    if (f.json) return { code: 0, out: [JSON.stringify({ branch: name, ticket, candidates: all, proposal }, null, 2)], err: [] };
    const out = [`ticket ${ticket ?? 'none'}`, ...all.map((c) => `  ${c.token.padEnd(14)} ${c.status}`)];
    if (proposal !== null) {
        out.push(`proposal ticket_keys: ${proposal.keys.join(', ')} (issuePrefixes in ${proposal.from}) — offer it for the convention card; this verb writes nothing`);
    }
    return { code: 0, out, err: [] };
}

export function branchCommand(args: readonly string[], cwd: string): GitConventionResult {
    const f = _flags(args, ['type', 'ticket', 'slug', 'pattern']);
    if (f.bad !== null || f.positional.length > 0 || f.values.slug === undefined) {
        return { code: 2, out: [], err: [f.bad === null && f.positional.length === 0 ? '--slug is required' : `unknown argument: ${f.bad ?? f.positional[0]}`, USAGE] };
    }
    let pattern = f.values.pattern;
    if (pattern === undefined) {
        const reading = readCommittedConvention(cwd, { keys: ['branch_pattern'] }).readings.branch_pattern as GitConventionReading;
        if (isRefusal(reading.state) || reading.value === null) return { code: 1, out: [], err: [describeRefusal(reading)] };
        pattern = reading.value;
    } else {
        const why = invalidReason('branch_pattern', pattern);
        if (why !== null) return { code: 1, out: [], err: [`invalid pattern: ${why}`] };
    }
    const r = renderBranch(pattern, { type: f.values.type ?? null, ticket: f.values.ticket ?? null, slug: f.values.slug });
    if (!r.ok) return { code: 1, out: [], err: [r.reason] };
    const check = spawnSync('git', ['check-ref-format', '--branch', r.name], { encoding: 'utf8' });
    if (check.error === undefined && check.status !== 0) return { code: 1, out: [], err: [`\`${r.name}\` fails git check-ref-format --branch`] };
    return { code: 0, out: f.json ? [JSON.stringify({ branch: r.name, pattern })] : [r.name], err: [] };
}

export const SUBCOMMANDS: Readonly<Record<string, (args: readonly string[], cwd: string, stdin?: string) => GitConventionResult>> = {
    show: (args, cwd) => showConvention(args, cwd),
    subject: (args, cwd, stdin) => subjectCommand(args, cwd, stdin),
    ticket: (args, cwd) => ticketCommand(args, cwd),
    branch: (args, cwd) => branchCommand(args, cwd),
    // Prints as it runs; a later `--repo` in `args` overrides the directory.
    sync: (args, cwd) => ({ code: syncPrBranch(['--repo', cwd, ...args]) as GitConventionResult['code'], out: [], err: [] }),
};

const USAGE = [
    'usage: agent-config git:convention show [--json] [--base REF]',
    '       agent-config git:convention subject [--format F | --family F] [--json]   (subjects on stdin)',
    '       agent-config git:convention ticket [BRANCH] [--keys "DEV, OPS"] [--json]',
    '       agent-config git:convention branch --slug S [--type T] [--ticket K] [--pattern P] [--json]',
    '       agent-config git:convention sync [--base REF] [--dry-run] [--auto-resolve-generated] [--quiet]',
].join('\n');

export function runGitConvention(argv: readonly string[], cwd: string, stdin?: string): GitConventionResult {
    const [sub, ...rest] = argv;
    if (sub === '-h' || sub === '--help') return { code: 0, out: [USAGE], err: [] };
    const handler = sub === undefined ? undefined : SUBCOMMANDS[sub];
    if (handler === undefined) {
        return { code: 2, out: [], err: [sub === undefined ? USAGE : `unknown subcommand: ${sub}`, ...(sub === undefined ? [] : [USAGE])] };
    }
    return handler(rest, cwd, stdin);
}

function _stdin(): string {
    if (process.stdin.isTTY) return '';
    try {
        return fs.readFileSync(0, 'utf-8');
    } catch {
        return '';
    }
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const result = runGitConvention(argv, process.cwd(), argv[0] === 'subject' ? _stdin() : undefined);
    for (const line of result.out) process.stdout.write(`${line}\n`);
    for (const line of result.err) process.stderr.write(`${line}\n`);
    return result.code;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
