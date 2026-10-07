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
 * `show` exit codes: `0` every requested key in force is readable · `1` a
 * requested key in force is in a state `isRefusal` names (the set `sync`
 * refuses) · `2` usage error. `--key` (repeatable) narrows the keys read and
 * judged; without it all three are. A candidate in a refusal state is printed
 * as a warning: `sync` never reads it.
 *
 * `--base` names the commit `update_strategy` is read at. Without it that is
 * the default branch, which is the answer only for a branch that targets it: a
 * caller acting on a pull request passes `--base origin/<its base>`.
 *
 * `subject` reads subjects on stdin and exits `0` all valid · `1` a subject
 * fails, or the format cannot be read · `2` usage. It checks only the
 * convention in force; a `commit-msg` hook or a commitlint config is named in a
 * note as also running at commit, and never changes the exit, because what such
 * a validator accepts cannot be told without running it. `ticket` exits `0`; `branch`
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

import {
    GIT_CONVENTION_KEYS,
    conventionDefault,
    describeRefusal,
    invalidReason,
    isRefusal,
    type GitConventionKey,
    type GitConventionReading,
} from '../_lib/git_convention.js';
import { CARRIER_PATH, IGNORED_CARRIER_PATH, readCommittedConvention, type TargetDeps } from '../_lib/git_convention_carrier.js';
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
import {
    CLASSIFIER_VERSION,
    MEASURE_LIMIT,
    MEASURE_SINCE,
    MIN_N,
    measureBranches,
    measureSubjects,
    measureUpdateStyle,
    pct,
    readHistory,
    teamFile,
} from '../_lib/git_convention_measure.js';
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
 * Every repository-level commit-message validator: the `commit-msg` hook git
 * will run, then the commitlint config. Either may reject a commit the
 * convention accepts, so each is named beside the verdict, never inferred.
 *
 * A hook counts only where git will run it: the path comes from git, so
 * `core.hooksPath` and worktrees resolve, and a `.husky/commit-msg` this clone
 * never pointed `core.hooksPath` at is a file in the tree, not a hook.
 */
export function commitMessageValidators(cwd: string): CommitMessageValidator[] {
    const found: CommitMessageValidator[] = [];
    const top = _git(cwd, 'rev-parse', '--show-toplevel') ?? cwd;
    const hook = _git(cwd, 'rev-parse', '--path-format=absolute', '--git-path', 'hooks/commit-msg');
    if (hook !== null && _isExecutableFile(hook)) found.push({ kind: 'commit-msg hook', path: hook });
    const config = COMMITLINT_FILES.map((name) => path.join(top, name)).find((p) => fs.existsSync(p));
    if (config !== undefined) found.push({ kind: 'commitlint config', path: config });
    else {
        try {
            const pkg = JSON.parse(fs.readFileSync(path.join(top, 'package.json'), 'utf-8')) as Record<string, unknown>;
            if (pkg.commitlint !== undefined) found.push({ kind: 'commitlint config', path: path.join(top, 'package.json') });
        } catch {
            // No package.json, or one that does not parse: neither declares a validator.
        }
    }
    return found;
}

/** The first of `commitMessageValidators`, or null. */
export function commitMessageValidator(cwd: string): CommitMessageValidator | null {
    return commitMessageValidators(cwd)[0] ?? null;
}

function _validatorNote(v: CommitMessageValidator): string {
    return `note: the ${v.kind} at ${v.path} also runs at commit time and may be stricter`;
}


function _short(sha: string | null | undefined): string {
    return sha === null || sha === undefined ? '?' : sha.slice(0, 12);
}

/** `show` with the target lookups injectable; the verb passes none. */
export function showConvention(args: readonly string[], cwd: string, deps?: TargetDeps): GitConventionResult {
    let json = false;
    let base: string | null = null;
    const asked: GitConventionKey[] = [];
    for (let i = 0; i < args.length; i++) {
        const a = args[i] as string;
        const next = args[i + 1];
        if (a === '--json') json = true;
        else if (a === '--base' && next !== undefined && !next.startsWith('--')) base = args[++i] as string;
        else if (a === '--key' && next !== undefined && (GIT_CONVENTION_KEYS as readonly string[]).includes(next)) {
            if (!asked.includes(next as GitConventionKey)) asked.push(next as GitConventionKey);
            i++;
        } else return { code: 2, out: [], err: [a === '--key' ? `unknown key: ${next ?? '(none)'}` : `unknown argument: ${a}`, USAGE] };
    }
    const keys = asked.length === 0 ? GIT_CONVENTION_KEYS : GIT_CONVENTION_KEYS.filter((k) => asked.includes(k));
    const read = readCommittedConvention(cwd, { override: base, keys, ...(deps ? { deps } : {}) });
    const readings = read.readings as Record<GitConventionKey, GitConventionReading>;
    const validators = commitMessageValidators(cwd);
    const ok = !keys.some((k) => isRefusal(readings[k].state));
    const code: 0 | 1 = ok ? 0 : 1;
    const established = keys.includes('commit_format') ? _established(readings.commit_format, read.root) : null;
    const warnings = fs.existsSync(path.join(read.root, IGNORED_CARRIER_PATH))
        ? [`${IGNORED_CARRIER_PATH} is ignored — the team declaration is read only from ${CARRIER_PATH}; rename it to ${CARRIER_PATH}`]
        : [];

    if (json) {
        const entries: Record<string, unknown> = {};
        for (const k of keys) {
            const { key: _key, ...rest } = readings[k];
            const cand = read.candidates[k];
            entries[k] = {
                ...rest,
                read_at: read.readAt[k] ?? null,
                candidate: cand === undefined ? null : { value: cand.value, source: cand.source, state: cand.state, reason: cand.reason },
            };
        }
        return {
            code,
            out: [JSON.stringify({ ok, keys: entries, target: read.target, warnings, convention_established: established, commit_message_validator: validators[0] ?? null, commit_message_validators: validators }, null, 2)],
            err: [],
        };
    }

    const out: string[] = [];
    for (const k of keys) {
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
            if (cand.reason !== null) out.push(`  ⚠️  candidate only, not in force: ${describeRefusal(cand)}`);
        }
    }
    out.push(`team declaration: ${CARRIER_PATH} at the repository root (ADR-283)`);
    if (established === false) out.push(NO_CONVENTION);
    for (const w of warnings) out.push(`⚠️  ${w}`);
    if (validators.length === 0) out.push('commit-message validator: none in this repository');
    for (const v of validators) out.push(`commit-message validator: ${v.kind} at ${v.path} — also runs at commit time and may be stricter than git.commit_format`);
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

/**
 * A `git.commit_format` the user chose: any valid committed value, or a
 * developer value other than the template default — `settings:sync` inserts the
 * default into every project file, so the default there proves no choice.
 */
function _declares(reading: GitConventionReading): boolean {
    if (reading.state !== 'valid') return false;
    return (reading.source ?? '').startsWith(CARRIER_PATH) || reading.value !== conventionDefault('commit_format');
}

/** True with a declaration or an approved card, false with neither, null when the format cannot be read. */
function _established(reading: GitConventionReading, root: string): boolean | null {
    if (isRefusal(reading.state)) return null;
    return _declares(reading) || _cardFamily(root) !== null;
}

/** Printed when neither a declaration nor an approved card exists. */
export const NO_CONVENTION = 'no convention established — run git:convention measure';

type SubjectPlan =
    | { kind: 'rule'; rule: SubjectRule; tier: string; notes: string[]; established?: false }
    | { kind: 'stop'; code: 1; lines: string[] };

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
    const notes = commitMessageValidators(cwd).map(_validatorNote);
    if (_declares(reading)) return { kind: 'rule', rule: { format: reading.value as CommitFormat }, tier: `declared in ${reading.source}`, notes };
    const family = _cardFamily(read.root);
    if (family !== null) {
        if (!FAMILY_ERE.some(([f]) => f === family)) return { kind: 'stop', code: 1, lines: [`the approved family ${family} in ${APPROVED_CARD} has no grammar to validate against`] };
        return { kind: 'rule', rule: { family: family as SubjectFamily }, tier: `approved in ${APPROVED_CARD}`, notes };
    }
    return { kind: 'rule', rule: { format: (reading.value ?? 'ticket-scope') as CommitFormat }, tier: 'default (Conventional Commits)', notes, established: false };
}

/** Under `--json` every exit prints one object carrying `ok`, `code` and the human `lines`. */
function _subjectResult(json: boolean, code: GitConventionResult['code'], lines: string[], err: string[] = [], extra: Record<string, unknown> = {}): GitConventionResult {
    if (!json) return { code, out: lines, err };
    return { code, out: [JSON.stringify({ ok: code === 0, code, lines, ...extra }, null, 2)], err };
}

/** Exit `2` here means the verb ran and received nothing — not that it cannot run. */
export const NO_SUBJECTS = 'no subjects on stdin — the verb ran; pipe the subjects into it, one per line';

export function subjectCommand(args: readonly string[], cwd: string, stdin = ''): GitConventionResult {
    const f = _flags(args, ['format', 'family']);
    if (f.bad !== null || f.positional.length > 0) {
        const why = `unknown argument: ${f.bad ?? f.positional[0]}`;
        return _subjectResult(f.json, 2, f.json ? [why] : [], [why, USAGE]);
    }
    const subjects = stdin.split('\n').map((l) => l.trimEnd()).filter((l) => l !== '');
    if (subjects.length === 0) return _subjectResult(f.json, 2, f.json ? [NO_SUBJECTS] : [], [NO_SUBJECTS, USAGE]);
    const plan = _planSubject(f.values, cwd);
    if (plan.kind === 'stop') return _subjectResult(f.json, plan.code, plan.lines);
    const failures = subjects.map((s) => ({ s, v: checkSubject(s, plan.rule) })).filter((x) => !x.v.ok);
    const lines = failures.length === 0
        ? [`${subjects.length} subject(s) valid under ${ruleName(plan.rule)} (${plan.tier})`, ...plan.notes]
        : [...failures.map((x) => `✗ ${x.s}\n  ${x.v.ok ? '' : x.v.rule}`), ...plan.notes];
    if (plan.established === false) lines.push(NO_CONVENTION);
    return _subjectResult(f.json, failures.length === 0 ? 0 : 1, lines, [], {
        rule: ruleName(plan.rule),
        tier: plan.tier,
        notes: plan.notes,
        convention_established: plan.established === false ? false : plan.tier === 'passed by the caller' ? null : true,
        failures: failures.map((x) => ({ subject: x.s, rule: x.v.ok ? null : x.v.rule })),
    });
}

function _commitlintProposal(cwd: string): { keys: string[]; from: string } | null {
    // A husky setup lists its commit-msg hook first, ahead of the config.
    const v = commitMessageValidators(cwd).find((c) => c.kind === 'commitlint config');
    if (v === undefined) return null;
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

/** The convention card `/commit` writes under `approved/` once the user has answered. */
export function cardText(m: { family: SubjectFamily; observedN: number; share: number; authors: number; trunk: string }): string {
    return [
        '---',
        `dominant_family: ${m.family}`,
        `observed_n: ${m.observedN}`,
        `dominant_share: ${m.share.toFixed(2)}`,
        `author_count: ${m.authors}`,
        `sample_window: "${MEASURE_SINCE}, newest ${MEASURE_LIMIT} non-merge commits"`,
        `classifier_version: ${CLASSIFIER_VERSION}`,
        `confirm_against: ${m.trunk}`,
        'ticket_keys: []',
        '---',
        '',
        `Approved by the user from \`agent-config git:convention measure\`. Re-measure when a tier-1 source appears or the newer half's family changes.`,
        '',
    ].join('\n');
}

export function measureCommand(args: readonly string[], cwd: string): GitConventionResult {
    const f = _flags(args, ['limit', 'family']);
    const limit = f.values.limit === undefined ? MEASURE_LIMIT : Number(f.values.limit);
    if (f.bad !== null || f.positional.length > 0 || !Number.isInteger(limit) || limit < 1) {
        return { code: 2, out: [], err: [f.bad === null && f.positional.length === 0 ? `--limit must be a positive integer: ${f.values.limit}` : `unknown argument: ${f.bad ?? f.positional[0]}`, USAGE] };
    }
    const chosen = f.values.family;
    if (chosen !== undefined && !FAMILY_ERE.some(([fam]) => fam === chosen)) return { code: 2, out: [], err: [`no grammar for family: ${chosen}`, USAGE] };
    const history = readHistory(cwd, limit);
    if (history === null) return { code: 1, out: [], err: ['not a git repository'] };
    if ('unresolved' in history) {
        const line = `sample    none — ${history.unresolved}; nothing was sampled and nothing is proposed. Set it with: git remote set-head origin --auto`;
        return f.json
            ? { code: 1, out: [JSON.stringify({ classifier_version: CLASSIFIER_VERSION, sample: { trunk: null, limit, since: MEASURE_SINCE, read: 0 }, trunk_unresolved: history.unresolved }, null, 2)], err: [] }
            : { code: 1, out: [line], err: [] };
    }
    const m = measureSubjects(history.commits);
    const b = measureBranches(history.branches);
    const u = measureUpdateStyle(history.mergeSubjects, history.defaultBranch);
    const read = readCommittedConvention(cwd, { keys: ['commit_format'] });
    const established = _established(read.readings.commit_format as GitConventionReading, read.root);
    const family = (chosen as SubjectFamily | undefined) ?? m.established;
    const share = family === null ? 0 : (m.families.find((x) => x.family === family)?.share ?? 0);
    const team = teamFile(family, b.pattern);
    const card = family === null ? null : cardText({ family, observedN: m.eligible, share, authors: m.authors, trunk: history.trunk });

    if (f.json) {
        return {
            code: 0,
            out: [JSON.stringify({
                convention_established: established,
                classifier_version: CLASSIFIER_VERSION,
                sample: { trunk: history.trunk, limit, since: MEASURE_SINCE, read: history.commits.length, eligible: m.eligible, excluded: m.excluded, authors: m.authors, capped: m.capped, capped_total: m.cappedTotal },
                bar: { min_n: MIN_N, share: m.bar },
                families: m.families,
                halves: { newer: m.newer, older: m.older, agree: m.halvesAgree },
                verdict: { established: m.established, migrating: m.migrating, reasons: m.reasons, strongest: m.strongest },
                branches: { sampled: b.sampled, pattern: b.pattern, share: b.share, shapes: b.shapes },
                update_style: { observed: u.observed, base_merges: u.baseMerges, merges: u.merges, adopted: false },
                chosen: family,
                team_file: team,
                card,
            }, null, 2)],
            err: [],
        };
    }

    const out = [
        established === true ? 'convention: already established — a declaration or an approved card is in force; this measurement is advisory'
            : established === null ? 'convention: git.commit_format cannot be read — see git:convention show' : 'convention: none established — /commit offers the result below once',
        `sample    ${history.commits.length} commit(s) on ${history.trunk} since ${MEASURE_SINCE} · classifier ${CLASSIFIER_VERSION}`,
        `          eligible ${m.eligible} (excluded: bots ${m.excluded.bots}, automation ${m.excluded.automation}, bulk ${m.excluded.bulk}) · authors ${m.authors}`
            + (m.capped ? ` · capped per author per half → ${m.cappedTotal}` : ' · uncapped (fewer than three authors)'),
        ...m.families.map((x) => `          ${x.family.padEnd(20)} ${String(x.count).padStart(4)}  ${pct(x.share)}`),
        `halves    newer ${m.newer.family ?? '—'} ${pct(m.newer.share)} · older ${m.older.family ?? '—'} ${pct(m.older.share)} — ${m.halvesAgree ? 'agree' : 'disagree'}`,
        m.established !== null
            ? `verdict   established: ${m.established}${m.migrating ? ' (migrating — the newer half alone clears the bar)' : ''} — bar n ≥ ${MIN_N}, share ≥ ${pct(m.bar)}`
            : `verdict   below the bar (${m.reasons.join('; ')}) — strongest: ${m.strongest.join(', ') || 'none with a grammar'}`,
        b.pattern !== null
            ? `branches  ${b.sampled} sampled — proposed branch_pattern "${b.pattern}" (${pct(b.share)})`
            : `branches  ${b.sampled} sampled — no clear pattern`,
        `update    observed ${u.observed} (${u.baseMerges} of ${u.merges} merge(s) bring the default branch into a topic branch) — shown, never adopted`,
    ];
    if (team !== null) {
        out.push(`team file ${chosen === undefined ? 'for the measured result' : `for --family ${chosen}`} — a human creates and commits ${CARRIER_PATH}; this verb writes nothing:`);
        out.push(...team.trimEnd().split('\n').map((l) => `  ${l}`));
    }
    if (chosen !== undefined && card !== null) {
        out.push(`card      for ${APPROVED_CARD}:`);
        out.push(...card.trimEnd().split('\n').map((l) => `  ${l}`));
    }
    return { code: 0, out, err: [] };
}

export const SUBCOMMANDS: Readonly<Record<string, (args: readonly string[], cwd: string, stdin?: string) => GitConventionResult>> = {
    show: (args, cwd) => showConvention(args, cwd),
    subject: (args, cwd, stdin) => subjectCommand(args, cwd, stdin),
    ticket: (args, cwd) => ticketCommand(args, cwd),
    branch: (args, cwd) => branchCommand(args, cwd),
    measure: (args, cwd) => measureCommand(args, cwd),
    // Prints as it runs; a later `--repo` in `args` overrides the directory.
    sync: (args, cwd) => ({ code: syncPrBranch(['--repo', cwd, ...args]) as GitConventionResult['code'], out: [], err: [] }),
};

const USAGE = [
    'usage: agent-config git:convention show [--json] [--base REF] [--key KEY]...   (a pull request passes --base origin/<its base>)',
    '       agent-config git:convention subject [--format F | --family F] [--json]   (subjects on stdin)',
    '       agent-config git:convention ticket [BRANCH] [--keys "DEV, OPS"] [--json]',
    '       agent-config git:convention branch --slug S [--type T] [--ticket K] [--pattern P] [--json]',
    '       agent-config git:convention measure [--limit N] [--family F] [--json]   (proposes a convention from the history; writes nothing)',
    '       agent-config git:convention sync [--base REF] [--dry-run] [--auto-resolve-generated] [--quiet]   (without --base: the default branch)',
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

/**
 * Every chunk to EOF, awaited. A synchronous read of fd 0 returns early on a
 * pipe with no data yet, so a late writer or a batch past one pipe buffer read
 * as no subjects at all. A terminal is not read: nothing was piped, and waiting
 * on it would look like a hang.
 */
async function _stdin(): Promise<string> {
    if (process.stdin.isTTY) return '';
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    return Buffer.concat(chunks).toString('utf-8');
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
    const result = runGitConvention(argv, process.cwd(), argv[0] === 'subject' ? await _stdin() : undefined);
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
    process.exitCode = await main();
}
