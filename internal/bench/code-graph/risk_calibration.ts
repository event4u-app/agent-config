#!/usr/bin/env tsx
/**
 * Review-risk calibration (road-to-a-graph-that-wins 5.6), registered by
 * `PREREGISTRATION-risk-calibration-2026-11-06.md`; every rule here is that document's.
 *
 *   tsx internal/bench/code-graph/risk_calibration.ts extract  --subject <name> --clone <dir> --tip <sha> --cutoff <iso> --units N --out <units.jsonl>
 *   tsx internal/bench/code-graph/risk_calibration.ts label    --subject <name> --clone <dir> --tip <sha> --cutoff <iso> --units <units.jsonl> --out <labels.json>
 *   tsx internal/bench/code-graph/risk_calibration.ts evaluate --data <subject>=<units.jsonl>,<labels.json>… --out <report.md> --json <report.json>
 *
 * A unit is a first-parent commit on the subject's trunk against its first parent.
 * Labels are SZZ: fix units are named by message, blamed line by line at their
 * parent, and the trunk commit that introduced a blamed line is defect-inducing.
 * The scores evaluated are the shipped weighted sum and its registered variants,
 * never a fitted model; weights are not refitted here.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { withGitVisibleScopeAsync } from '../../../src/scripts/_lib/git_visible_files.js';
import { buildFromRepo } from '../../../src/scripts/code_graph/build.js';
import { diffHunks, RISK_BAND_CUTS, RISK_TERMS, RISK_WEIGHTS, reviewRisk, type RiskTerm } from '../../../src/scripts/code_graph/review_risk.js';
import { isTestFile } from '../../../src/scripts/code_graph/scope.js';

export const MATURITY_DAYS = 60;
export const GAP_WEIGHT = 2;
export const NONINFERIORITY = 0.02;
export const POINT_TOLERANCE = 0.01;
export const BOOTSTRAP = 1000;
export const BLOCK = 10;
export const SEED = 20261106;
export const VALIDATION_SHARE = 0.6;
export const UNKNOWN_SHARE_LIMIT = 0.2;

export const LANG: Readonly<Record<string, RegExp>> = {
    self: /\.(ts|mts|cts|tsx)$/,
    unopim: /\.php$/,
};

export interface Unit {
    sha: string;
    parent: string;
    date: string;
    subject: string;
    effort: number;
    counts: Record<string, number>;
    unknown: string[];
    untested: number;
}

/** The registered fix rule: a conventional `fix` type or a fix word in the subject line. */
export function isFixMessage(subjectLine: string): boolean {
    return /^fix(\(.+\))?!?:/i.test(subjectLine) || /\b(fix(es|ed)?|bug|bugfix|regression|hotfix)\b/i.test(subjectLine);
}

export function isProductionSource(subject: string, file: string): boolean {
    const re = LANG[subject];
    return re !== undefined && re.test(file) && !isTestFile(file) && !file.startsWith('vendor/') && !file.includes('node_modules/');
}

export type Rule = { name: string; weights: Partial<Record<RiskTerm, number>>; gap: number };

export const S0: Rule = { name: 'S0', weights: { ...RISK_WEIGHTS }, gap: 0 };

export function withoutTerm(t: RiskTerm): Rule {
    const w: Partial<Record<RiskTerm, number>> = { ...RISK_WEIGHTS };
    delete w[t];
    return { name: `S0 - ${t}`, weights: w, gap: 0 };
}

export const WITH_GAP: Rule = { name: 'S0 + test gap', weights: { ...RISK_WEIGHTS }, gap: GAP_WEIGHT };

export function scoreOf(u: Unit, rule: Rule): number {
    let s = 0;
    for (const [t, w] of Object.entries(rule.weights)) s += (u.counts[t] ?? 0) * (w as number);
    return s + rule.gap * u.untested;
}

/** Effort-aware order: score per changed line, descending; ties go to the smaller change (ManualUp), then the older one. */
export function rankUnits(units: readonly Unit[], score: (u: Unit) => number): Unit[] {
    return [...units].sort((a, b) => {
        const da = score(a) / a.effort;
        const db = score(b) / b.effort;
        if (db !== da) return db - da;
        if (a.effort !== b.effort) return a.effort - b.effort;
        return a.date < b.date ? -1 : 1;
    });
}

function curveArea(order: readonly Unit[], defective: ReadonlySet<string>): number {
    const totalEffort = order.reduce((s, u) => s + u.effort, 0);
    const totalDef = order.filter((u) => defective.has(u.sha)).length;
    if (totalEffort === 0 || totalDef === 0) return 0;
    let area = 0;
    let x = 0;
    let y = 0;
    for (const u of order) {
        const nx = x + u.effort / totalEffort;
        const ny = y + (defective.has(u.sha) ? 1 / totalDef : 0);
        area += ((y + ny) / 2) * (nx - x);
        x = nx;
        y = ny;
    }
    return area;
}

/** Kamei's Popt: 1 - (Area(optimal) - Area(model)) / (Area(optimal) - Area(worst)); null without a defective unit. */
export function popt(order: readonly Unit[], defective: ReadonlySet<string>): number | null {
    if (!order.some((u) => defective.has(u.sha))) return null;
    const dens = (u: Unit) => (defective.has(u.sha) ? 1 : 0) / u.effort;
    const optimal = [...order].sort((a, b) => dens(b) - dens(a) || a.effort - b.effort);
    const worst = [...order].sort((a, b) => dens(a) - dens(b) || b.effort - a.effort);
    const o = curveArea(optimal, defective);
    const w = curveArea(worst, defective);
    if (o === w) return null;
    return 1 - (o - curveArea(order, defective)) / (o - w);
}

/** Share of defective units found within the first 20 % of total effort; a unit crossing the budget is not counted. */
export function acc20(order: readonly Unit[], defective: ReadonlySet<string>): number | null {
    const totalDef = order.filter((u) => defective.has(u.sha)).length;
    if (totalDef === 0) return null;
    const budget = 0.2 * order.reduce((s, u) => s + u.effort, 0);
    let used = 0;
    let found = 0;
    for (const u of order) {
        if (used + u.effort > budget) break;
        used += u.effort;
        if (defective.has(u.sha)) found++;
    }
    return found / totalDef;
}

/** Deterministic PRNG (mulberry32) so the bootstrap is reproducible from the registered seed. */
export function prng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Moving-block bootstrap of Popt(rule) - Popt(base), chronological blocks of BLOCK units; returns the 2.5 % quantile. */
export function bootstrapLower(units: readonly Unit[], defective: ReadonlySet<string>, rule: Rule, base: Rule, n = BOOTSTRAP, seed = SEED): number | null {
    const sorted = [...units].sort((a, b) => (a.date < b.date ? -1 : 1));
    const len = sorted.length;
    if (len === 0) return null;
    const rand = prng(seed);
    const diffs: number[] = [];
    for (let i = 0; i < n; i++) {
        const sample: Unit[] = [];
        let k = 0;
        while (sample.length < len) {
            const start = Math.floor(rand() * len);
            for (let j = 0; j < BLOCK && sample.length < len; j++) sample.push({ ...(sorted[(start + j) % len] as Unit), sha: `${(sorted[(start + j) % len] as Unit).sha}#${String(k++)}` });
        }
        const def = new Set(sample.filter((u) => defective.has(u.sha.split('#')[0] as string)).map((u) => u.sha));
        const a = popt(rankUnits(sample, (u) => scoreOf(u, rule)), def);
        const b = popt(rankUnits(sample, (u) => scoreOf(u, base)), def);
        if (a !== null && b !== null) diffs.push(a - b);
    }
    if (diffs.length < n / 2) return null;
    diffs.sort((x, y) => x - y);
    return diffs[Math.floor(0.025 * diffs.length)] as number;
}

export type TermVerdict = 'dispensable' | 'contributes' | 'no evidence';

export interface SubjectEval {
    subject: string;
    units: number;
    defective: number;
    validation: number;
    test: number;
    term: Record<string, { verdict: TermVerdict; popt_delta: number | null; lower: number | null; fires: number; unknown_share: number }>;
    gap: { popt_delta: number | null; lower: number | null; helps: boolean };
}

export function splitChronological(units: readonly Unit[]): { validation: Unit[]; test: Unit[] } {
    const sorted = [...units].sort((a, b) => (a.date < b.date ? -1 : 1));
    const cut = Math.floor(sorted.length * VALIDATION_SHARE);
    return { validation: sorted.slice(0, cut), test: sorted.slice(cut) };
}

const poptOf = (units: readonly Unit[], def: ReadonlySet<string>, rule: Rule): number | null => popt(rankUnits(units, (u) => scoreOf(u, rule)), def);

/** Per-term verdicts and the test-gap verdict on the validation split of one subject. */
export function evaluateSubject(subject: string, units: readonly Unit[], defective: ReadonlySet<string>, opts: { bootstrap?: number } = {}): SubjectEval {
    const { validation, test } = splitChronological(units);
    const base = poptOf(validation, defective, S0);
    const term: SubjectEval['term'] = {};
    for (const t of RISK_TERMS) {
        const fires = validation.filter((u) => (u.counts[t] ?? 0) > 0).length;
        const unknownShare = validation.length ? validation.filter((u) => u.unknown.includes(t)).length / validation.length : 0;
        if (fires === 0 || unknownShare > UNKNOWN_SHARE_LIMIT || base === null) {
            term[t] = { verdict: 'no evidence', popt_delta: null, lower: null, fires, unknown_share: unknownShare };
            continue;
        }
        const rule = withoutTerm(t);
        const p = poptOf(validation, defective, rule);
        const delta = p === null ? null : p - base;
        const lower = bootstrapLower(validation, defective, rule, S0, opts.bootstrap);
        const dispensable = delta !== null && lower !== null && delta >= -POINT_TOLERANCE && lower >= -NONINFERIORITY;
        term[t] = { verdict: dispensable ? 'dispensable' : 'contributes', popt_delta: delta, lower, fires, unknown_share: unknownShare };
    }
    const g = poptOf(validation, defective, WITH_GAP);
    const gDelta = g === null || base === null ? null : g - base;
    const gLower = base === null ? null : bootstrapLower(validation, defective, WITH_GAP, S0, opts.bootstrap);
    return {
        subject,
        units: units.length,
        defective: units.filter((u) => defective.has(u.sha)).length,
        validation: validation.length,
        test: test.length,
        term,
        gap: { popt_delta: gDelta, lower: gLower, helps: gLower !== null && gLower > 0 },
    };
}

/** The proposal: drop every term dispensable in ALL subjects; add the test gap only if it helps in all subjects. */
export function proposal(evals: readonly SubjectEval[]): Rule {
    const w: Partial<Record<RiskTerm, number>> = { ...RISK_WEIGHTS };
    const removed: string[] = [];
    for (const t of RISK_TERMS) {
        if (evals.length > 0 && evals.every((e) => e.term[t]?.verdict === 'dispensable')) {
            delete w[t];
            removed.push(t);
        }
    }
    const gap = evals.length > 0 && evals.every((e) => e.gap.helps) ? GAP_WEIGHT : 0;
    return { name: `P (removes: ${removed.join(', ') || 'none'}${gap ? '; adds test gap' : ''})`, weights: w, gap };
}

export const isNoChange = (p: Rule): boolean => p.gap === 0 && RISK_TERMS.every((t) => p.weights[t] === RISK_WEIGHTS[t]);

export function bandOf(score: number): 'low' | 'medium' | 'high' {
    return score >= RISK_BAND_CUTS.high ? 'high' : score >= RISK_BAND_CUTS.medium ? 'medium' : 'low';
}

function run(cmd: string, args: readonly string[], cwd: string, allowFail = false): string {
    const r = spawnSync(cmd, args as string[], { cwd, encoding: 'utf8', maxBuffer: 1 << 30 });
    if (r.status !== 0 && !allowFail) throw new Error(`${cmd} ${args.join(' ')} exited ${String(r.status)}: ${(r.stderr || '').slice(0, 1500)}`);
    return r.stdout ?? '';
}

function parseArgs(argv: readonly string[]): { opts: Record<string, string>; multi: Record<string, string[]> } {
    const opts: Record<string, string> = {};
    const multi: Record<string, string[]> = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (!a.startsWith('--')) continue;
        const v = argv[i + 1];
        if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
        opts[a.slice(2)] = v;
        (multi[a.slice(2)] ??= []).push(v);
        i++;
    }
    return { opts, multi };
}

/** First-parent trunk commits up to the tip, oldest first, as sha / parent / committer date / subject line. */
function trunk(clone: string, tip: string): Array<{ sha: string; parent: string; date: string; subject: string }> {
    return run('git', ['log', '--first-parent', '--reverse', '--format=%H%x09%P%x09%cI%x09%s', tip], clone)
        .split('\n')
        .filter(Boolean)
        .map((l) => {
            const [sha, parents, date, ...rest] = l.split('\t');
            return { sha: sha as string, parent: (parents ?? '').split(' ')[0] ?? '', date: new Date(date as string).toISOString(), subject: rest.join('\t') };
        })
        .filter((c) => c.parent !== '');
}

async function cmdExtract(o: Record<string, string>): Promise<number> {
    const subject = o.subject as string;
    const clone = path.resolve(o.clone as string);
    const cutoff = new Date(o.cutoff as string).getTime();
    const maturity = cutoff - MATURITY_DAYS * 86_400_000;
    const all = trunk(clone, o.tip as string).filter((c) => new Date(c.date).getTime() <= maturity);
    const units = all.slice(-Number(o.units));
    const out = path.resolve(o.out as string);
    const done = new Set(fs.existsSync(out) ? fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => (JSON.parse(l) as Unit).sha) : []);
    const dir = path.join(os.tmpdir(), `rc-${subject}-wt`);
    const cache = path.join(os.tmpdir(), `rc-${subject}-graph.json`);
    if (!fs.existsSync(dir)) {
        run('git', ['worktree', 'prune'], clone, true);
        run('git', ['worktree', 'add', '--force', '--detach', dir, (units[0] as { sha: string }).sha], clone);
    }
    for (const c of units) {
        if (done.has(c.sha)) continue;
        run('git', ['checkout', '--quiet', '--force', '--detach', c.sha], dir);
        const numstat = run('git', ['diff', '--numstat', c.parent, c.sha], dir).split('\n').filter(Boolean);
        const effort = numstat.reduce((s, l) => s + (Number(l.split('\t')[0]) || 0) + (Number(l.split('\t')[1]) || 0), 0);
        const row: Unit = { sha: c.sha, parent: c.parent, date: c.date, subject, effort, counts: {}, unknown: [], untested: 0 };
        if (effort > 0) {
            // The same build the shipped `build` verb runs: lanes on, inside the git-visible scope.
            const graph = (await withGitVisibleScopeAsync(() => buildFromRepo(dir, cache, { update: true, lanes: true }))).graph;
            const hunks = diffHunks(dir, c.parent) ?? [];
            const r = reviewRisk(dir, graph, c.parent, hunks, RISK_WEIGHTS);
            for (const t of r.terms) {
                row.counts[t.term] = t.items.length;
                if (t.unknown) row.unknown.push(t.term);
            }
            row.untested = r.checks.find((ch) => ch.id === 'untested-change')?.items.filter((i) => i.verdict === 'untested').length ?? 0;
        }
        fs.appendFileSync(out, `${JSON.stringify(row)}\n`);
    }
    process.stdout.write(`extract: ${subject} ${String(units.length)} units\n`);
    return 0;
}

function cmdLabel(o: Record<string, string>): number {
    const subject = o.subject as string;
    const clone = path.resolve(o.clone as string);
    const units = fs.readFileSync(o.units as string, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Unit);
    const unitSet = new Set(units.map((u) => u.sha));
    const first = units.reduce((m, u) => (u.date < m ? u.date : m), units[0]?.date ?? '');
    const cutoff = new Date(o.cutoff as string).toISOString();
    const fixes = trunk(clone, o.tip as string).filter((c) => c.date >= first && c.date <= cutoff && isFixMessage(c.subject));
    const inducing = new Map<string, string[]>();
    const links: Array<{ fix: string; fix_subject: string; inducing: string; file: string; line: number; delay_days: number }> = [];
    let fixesUsed = 0;
    for (const f of fixes) {
        const files = run('git', ['diff', '--name-status', f.parent, f.sha], clone)
            .split('\n')
            .filter((l) => /^(M|D)\t/.test(l))
            .map((l) => l.split('\t')[1] as string)
            .filter((p) => isProductionSource(subject, p));
        if (files.length === 0) continue;
        fixesUsed++;
        const diff = run('git', ['diff', '-U0', f.parent, f.sha, '--', ...files], clone);
        let file = '';
        for (const line of diff.split('\n')) {
            if (line.startsWith('--- ')) file = line.slice(4).replace(/^a\//, '');
            const m = /^@@ -(\d+)(?:,(\d+))? /.exec(line);
            if (!m || !file) continue;
            const start = Number(m[1]);
            const len = m[2] === undefined ? 1 : Number(m[2]);
            if (len === 0) continue;
            const blame = run('git', ['blame', '-w', '--first-parent', '--line-porcelain', '-L', `${String(start)},${String(start + len - 1)}`, f.parent, '--', file], clone, true);
            let sha = '';
            let ln = 0;
            for (const b of blame.split('\n')) {
                const h = /^([0-9a-f]{40}) \d+ (\d+)/.exec(b);
                if (h) {
                    sha = h[1] as string;
                    ln = Number(h[2]);
                    continue;
                }
                if (b.startsWith('\t')) {
                    if (b.slice(1).trim() === '' || !unitSet.has(sha)) continue;
                    const u = units.find((x) => x.sha === sha) as Unit;
                    inducing.set(sha, [...(inducing.get(sha) ?? []), f.sha]);
                    links.push({ fix: f.sha, fix_subject: f.subject, inducing: sha, file, line: ln, delay_days: Math.round((new Date(f.date).getTime() - new Date(u.date).getTime()) / 86_400_000) });
                }
            }
        }
    }
    const doc = { subject, fixes_matched: fixes.length, fixes_used: fixesUsed, defective: [...inducing.keys()].sort(), links };
    fs.writeFileSync(o.out as string, `${JSON.stringify(doc, null, 1)}\n`);
    process.stdout.write(`label: ${subject} ${String(fixesUsed)}/${String(fixes.length)} fixes used, ${String(inducing.size)} defect-inducing units, ${String(links.length)} links\n`);
    return 0;
}

const f3 = (v: number | null | undefined): string => (v == null ? '—' : v.toFixed(3));

function cmdEvaluate(o: Record<string, string>, multi: Record<string, string[]>): number {
    const data = (multi.data ?? []).map((kv) => {
        const [subject, files] = kv.split('=') as [string, string];
        const [unitsFile, labelsFile] = files.split(',') as [string, string];
        const units = fs.readFileSync(unitsFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Unit).filter((u) => u.effort > 0);
        const labels = JSON.parse(fs.readFileSync(labelsFile, 'utf8')) as { defective: string[] };
        return { subject, units, defective: new Set(labels.defective) };
    });
    const evals = data.map((d) => evaluateSubject(d.subject, d.units, d.defective));
    const p = proposal(evals);
    const confirm = data.map((d) => {
        const { test } = splitChronological(d.units);
        const base = poptOf(test, d.defective, S0);
        const pp = poptOf(test, d.defective, p);
        const manualUp = popt([...test].sort((a, b) => a.effort - b.effort), d.defective);
        const lower = isNoChange(p) ? null : bootstrapLower(test, d.defective, p, S0);
        const bands = (rule: Rule) => {
            const out: Record<string, { units: number; defective: number }> = { low: { units: 0, defective: 0 }, medium: { units: 0, defective: 0 }, high: { units: 0, defective: 0 } };
            for (const u of test) {
                const b = out[bandOf(scoreOf(u, rule))] as { units: number; defective: number };
                b.units++;
                if (d.defective.has(u.sha)) b.defective++;
            }
            return out;
        };
        const moved = test.filter((u) => bandOf(scoreOf(u, S0)) !== bandOf(scoreOf(u, p))).length;
        return {
            subject: d.subject,
            popt_s0: base,
            popt_p: pp,
            popt_manualup: manualUp,
            acc20_s0: acc20(rankUnits(test, (u) => scoreOf(u, S0)), d.defective),
            acc20_p: acc20(rankUnits(test, (u) => scoreOf(u, p)), d.defective),
            lower,
            noninferior: isNoChange(p) ? null : lower !== null && lower >= -NONINFERIORITY,
            bands_s0: bands(S0),
            bands_p: bands(p),
            moved,
        };
    });
    const apply = !isNoChange(p) && confirm.every((c) => c.noninferior === true);
    const md = [
        '# Review-risk calibration — results',
        '',
        `Proposal: **${p.name}** · applied: **${apply ? 'yes' : 'no'}**${isNoChange(p) ? ' (nothing to change: no term was dispensable in every subject and the test gap did not help in every subject)' : ''}.`,
        '',
        '## Subjects',
        '',
        '| Subject | units | defect-inducing | validation / test |',
        '|---|---:|---:|---|',
        ...evals.map((e) => `| ${e.subject} | ${String(e.units)} | ${String(e.defective)} | ${String(e.validation)} / ${String(e.test)} |`),
        '',
        '## Terms on the validation split',
        '',
        `Dispensable = dropping the term changes Popt by ≥ −${String(POINT_TOLERANCE)} and the block-bootstrap 2.5 % bound of the change is ≥ −${String(NONINFERIORITY)}.`,
        '',
        `| Term | ${evals.map((e) => `${e.subject}: verdict (ΔPopt, lower, fires)`).join(' | ')} |`,
        `|---|${evals.map(() => '---').join('|')}|`,
        ...RISK_TERMS.map((t) => `| ${t} | ${evals.map((e) => { const v = e.term[t]; return v ? `${v.verdict} (${f3(v.popt_delta)}, ${f3(v.lower)}, ${String(v.fires)})` : '—'; }).join(' | ')} |`),
        `| test gap (+${String(GAP_WEIGHT)} × untested) | ${evals.map((e) => `${e.gap.helps ? 'helps' : 'does not help'} (${f3(e.gap.popt_delta)}, ${f3(e.gap.lower)})`).join(' | ')} |`,
        '',
        '## Confirmation on the untouched test split',
        '',
        '| Subject | Popt S0 | Popt P | Popt ManualUp | ACC@20 S0 | ACC@20 P | lower(P − S0) | non-inferior | units changing band |',
        '|---|---:|---:|---:|---:|---:|---:|---|---:|',
        ...confirm.map((c) => `| ${c.subject} | ${f3(c.popt_s0)} | ${f3(c.popt_p)} | ${f3(c.popt_manualup)} | ${f3(c.acc20_s0)} | ${f3(c.acc20_p)} | ${f3(c.lower)} | ${c.noninferior === null ? 'n/a' : c.noninferior ? 'yes' : 'no'} | ${String(c.moved)} |`),
        '',
        '## Bands on the test split (S0)',
        '',
        '| Subject | low (defective / units) | medium | high |',
        '|---|---|---|---|',
        ...confirm.map((c) => `| ${c.subject} | ${String(c.bands_s0.low?.defective)} / ${String(c.bands_s0.low?.units)} | ${String(c.bands_s0.medium?.defective)} / ${String(c.bands_s0.medium?.units)} | ${String(c.bands_s0.high?.defective)} / ${String(c.bands_s0.high?.units)} |`),
        '',
    ].join('\n');
    if (o.out) fs.writeFileSync(o.out, md);
    if (o.json) fs.writeFileSync(o.json, `${JSON.stringify({ proposal: p, apply, evals, confirm }, null, 1)}\n`);
    process.stdout.write(md);
    return 0;
}

async function main(argv: readonly string[]): Promise<number> {
    const [cmd, ...rest] = argv;
    const { opts, multi } = parseArgs(rest);
    if (cmd === 'extract') return cmdExtract(opts);
    if (cmd === 'label') return cmdLabel(opts);
    if (cmd === 'evaluate') return cmdEvaluate(opts, multi);
    process.stderr.write('usage: risk_calibration.ts extract|label|evaluate …\n');
    return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2)).then(
        (code) => process.exit(code),
        (err: unknown) => {
            process.stderr.write(`risk_calibration: ${String(err)}\n`);
            process.exit(1);
        },
    );
}
