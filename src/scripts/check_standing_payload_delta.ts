#!/usr/bin/env -S npx tsx
/**
 * Per-PR standing-payload delta against the merge-base — a REPORT, not a gate.
 *
 * `road-to-standing-payload-diet` Phase 0 steps 0.3 / 0.4 / 0.5.
 *
 * ## Why a report and not a second failing gate
 *
 * `check_preamble_payload_budget` already ratchets the same number and already
 * fails on growth. A second blocking gate on one measurement double-fails every
 * legitimate rule addition, which is how a reporting surface becomes noise
 * people route around. So this script **never fails on the delta**, in either
 * direction. It fails only when it cannot measure: a bad ref (exit 2) or a dead
 * scan scope (exit 3). That split is what makes its self-test honest — there are
 * real reject cases, and none of them is "the number moved".
 *
 * ## The ledger is TWO-SIDED, and that is step 0.5
 *
 * Steps 0.3/0.4 measured only the debit — what a change ADDS. A one-sided
 * ledger can only ever report drift: a change that REMOVES standing payload
 * scores zero and reads as neutral, which is exactly backwards for a roadmap
 * whose whole purpose is removal. So every bucket reports debit and credit
 * separately, and the credit side carries a standing booking that is already
 * measured and already shipped — the ADR-236 one-rule-one-layer partition. See
 * {@link partitionCredit}.
 *
 * ## Parity with the gate it reports beside
 *
 * The bucket definitions are IMPORTED from `preamble_byte_census`, never
 * re-implemented, so the delta cannot drift from the ratchet it explains. The
 * basis is therefore the census's own `chars/4` proxy for the bucket totals —
 * stated in every rendering, because this tree ships an exact tokenizer and a
 * report that hides which one it used is not evidence. `--rank` additionally
 * publishes an EXACT-BPE per-rule ranking, and labels it as the other basis.
 * The two are never mixed inside one subtraction.
 *
 * Modes:
 *   --base <ref>   measure the same buckets at <ref> and print the signed delta
 *   --rank         additionally print the exact-BPE per-rule ranking at HEAD
 *   --json         machine-readable, for the PR-comment renderer
 *   --quiet        verdict lines only
 *   --self-test    prove the gate discriminates
 *
 * Exit codes: 0 measured (any delta) · 2 usage / unreadable ref · 3 dead scope.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';
import { gpt_tokens, method_note } from './_lib/token_count.js';
import { measureDeterministicPayload } from './check_preamble_payload_budget.js';
import { censusRuleDir } from './preamble_byte_census.js';

const PROG = 'check_standing_payload_delta';
const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SCRIPT_REL = 'src/scripts/check_standing_payload_delta.ts';
const SELF_TEST_MIN_CASES = 4;
const SELF_TEST_MIN_REJECT = 2;

/** The three buckets `check_preamble_payload_budget` gates, by ledger name. */
const BUCKETS = [
    'project-scope rules',
    'preloaded skills catalog',
    'CLAUDE.md hierarchy (project only)',
] as const;

export interface Bucket {
    readonly name: string;
    readonly tokens: number;
    readonly files: number;
}

/** `chars/4`, the census's own basis — kept identical so the delta cannot drift. */
function proxyTokens(chars: number): number {
    return Math.round(chars / 4);
}

/**
 * Measure the three gated buckets over a checkout root.
 *
 * Delegates to `check_preamble_payload_budget.measureDeterministicPayload`, the
 * ratchet's OWN bucket builder, rather than re-deriving the definitions. A
 * second implementation would be free to drift from the number it explains, and
 * the drift would look like a real delta.
 *
 * That function already pins the user half of the CLAUDE.md hierarchy to a
 * non-existent home directory, so a ref-side measurement cannot read the
 * measuring machine's home and attribute it to a past commit — the property this
 * function needed, inherited rather than re-stated.
 */
export function measureBuckets(root: string): Bucket[] {
    return measureDeterministicPayload(root);
}

/** Raw bytes of one tracked path at `ref`, or `null` when it does not exist there. */
function catBlob(repoRoot: string, ref: string, rel: string): Buffer | null {
    try {
        return execFileSync('git', ['show', `${ref}:${rel}`], {
            cwd: repoRoot,
            maxBuffer: 1 << 28,
            encoding: 'buffer',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return null;
    }
}

/** Git's file mode for one tracked path at `ref` (`'120000'` = symlink), or null. */
function blobMode(repoRoot: string, ref: string, rel: string): string | null {
    try {
        const line = execFileSync('git', ['ls-tree', ref, '--', rel], {
            cwd: repoRoot,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        return line === '' ? null : (line.split(/\s+/)[0] ?? null);
    } catch {
        return null;
    }
}

/**
 * One tracked file's CONTENT at `ref`, following a tracked symlink.
 *
 * `CLAUDE.md` in this repo is a symlink to `AGENTS.md` (mode `120000`,
 * verified), so `git show <ref>:CLAUDE.md` yields the nine-byte link TARGET
 * rather than the file. Measured on the first run: the base side reported 2
 * tokens against a real 746, fabricating a +744 debit out of the symlink. A
 * checkout resolves the link transparently; a blob read does not, so the hop is
 * taken here. Bounded to two hops — this repo has one level and a cycle must not
 * become a hang.
 */
function readBlob(repoRoot: string, ref: string, rel: string): Buffer | null {
    let target = rel;
    for (let hop = 0; hop < 2; hop += 1) {
        const raw = catBlob(repoRoot, ref, target);
        if (raw === null) return null;
        if (blobMode(repoRoot, ref, target) !== '120000') return raw;
        const link = raw.toString('utf-8').trim();
        target = path.posix.normalize(path.posix.join(path.posix.dirname(target), link));
    }
    return null;
}

/** Materialise `<ref>`'s gated tree into a temp dir. Returns the root. */
export function checkoutRefTree(ref: string, repoRoot: string = REPO_ROOT): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spd-base-'));
    // `git archive | tar -x` is one round trip and honours `export-ignore`;
    // `dist/` carries no `export-ignore` entry (verified: .gitattributes has no
    // `/dist` line), so the gated buckets survive the tarball intact.
    try {
        const tar = execFileSync('git', ['archive', ref, 'dist/agent-src/rules', 'dist/agent-src/skills'], {
            cwd: repoRoot,
            maxBuffer: 1 << 30,
            encoding: 'buffer',
        });
        execFileSync('tar', ['-x', '-C', dir], { input: tar, maxBuffer: 1 << 30 });
        // `CLAUDE.md` carries `export-ignore` (`.gitattributes:26`), so `git
        // archive` omits it SILENTLY — measured here on the first run, which
        // reported a fabricated 104-token movement in the wrong bucket. It is
        // therefore fetched by blob, not by tarball. A missing project CLAUDE.md
        // at `ref` is a real state (the file may not have existed), so absence
        // is left absent rather than defaulted.
        const claudeMd = readBlob(repoRoot, ref, 'CLAUDE.md');
        if (claudeMd !== null) fs.writeFileSync(path.join(dir, 'CLAUDE.md'), claudeMd);
        const claudeLocal = readBlob(repoRoot, ref, 'CLAUDE.local.md');
        if (claudeLocal !== null) fs.writeFileSync(path.join(dir, 'CLAUDE.local.md'), claudeLocal);
    } catch (err) {
        fs.rmSync(dir, { recursive: true, force: true });
        throw new Error(`${PROG}: cannot read tree at ref '${ref}': ${String(err)}`);
    }
    return dir;
}

export interface DeltaRow {
    readonly name: string;
    /** Positive tokens the change ADDS to this bucket. */
    readonly debit: number;
    /** Positive tokens the change REMOVES from this bucket. */
    readonly credit: number;
    readonly base: number;
    readonly head: number;
    readonly baseFiles: number;
    readonly headFiles: number;
}

/**
 * Split each bucket's signed movement into a debit and a credit column.
 *
 * A signed number collapses the two sides into one cell, and the whole point of
 * step 0.5 is that a removal must be legible as a removal rather than as a
 * smaller positive.
 */
export function diffBuckets(base: readonly Bucket[], head: readonly Bucket[]): DeltaRow[] {
    const byName = new Map(base.map((b) => [b.name, b]));
    return head.map((h) => {
        const b = byName.get(h.name) ?? { name: h.name, tokens: 0, files: 0 };
        const signed = h.tokens - b.tokens;
        return {
            name: h.name,
            debit: signed > 0 ? signed : 0,
            credit: signed < 0 ? -signed : 0,
            base: b.tokens,
            head: h.tokens,
            baseFiles: b.files,
            headFiles: h.files,
        };
    });
}

export interface CreditBooking {
    readonly what: string;
    readonly gate: string;
    readonly tokens: number;
    readonly note: string;
}

/**
 * The standing credit booking — ADR-236's one-rule-one-layer partition.
 *
 * `check_rule_layer_partition` publishes, per host directory, how many rules the
 * project layer WITHHELD because the global layer already carries them. Those
 * withheld files are a saving that is already measured and already shipped, and
 * a debit-only ledger books it at zero.
 *
 * It is a **standing** booking, not a per-PR one: it does not move with the diff
 * under review, and it is rendered as such. Its purpose is that a reader of the
 * comment sees net movement against a real credit floor rather than inflow
 * alone. The number is read from the live gate on the measuring machine; where
 * the gate cannot run (no projections in a fresh CI checkout, which is the
 * normal case) the booking reports as unavailable rather than as zero — a
 * credit of zero and a credit nobody could read are different facts.
 */
export function partitionCredit(repoRoot: string = REPO_ROOT): CreditBooking | null {
    const globalDir = path.join(os.homedir(), '.claude', 'rules');
    const projectDir = path.join(repoRoot, '.claude', 'rules');
    if (!fs.existsSync(globalDir) || !fs.existsSync(projectDir)) return null;
    const globalCensus = censusRuleDir(globalDir);
    const projectCensus = censusRuleDir(projectDir);
    if (globalCensus.files === 0) return null;
    const globalNames = new Set(fs.readdirSync(globalDir).filter((f) => f.endsWith('.md')));
    const projectNames = new Set(fs.readdirSync(projectDir).filter((f) => f.endsWith('.md')));
    // Withheld = a global-owned rule the project layer did NOT re-emit. Under a
    // duplicating emitter this set is empty and the credit is honestly zero.
    let withheldChars = 0;
    let withheld = 0;
    for (const name of globalNames) {
        if (projectNames.has(name)) continue;
        try {
            withheldChars += fs.statSync(path.join(globalDir, name)).size;
            withheld += 1;
        } catch {
            /* unreadable entry — not counted, so the credit under-reports */
        }
    }
    return {
        what: `ADR-236 partition: ${String(withheld)} global-owned rule(s) withheld from .claude/rules`,
        gate: 'check_rule_layer_partition',
        tokens: proxyTokens(withheldChars),
        note:
            `project layer carries ${String(projectCensus.files)} file(s); global layer ` +
            `${String(globalCensus.files)}. A duplicating emitter would book 0 here.`,
    };
}

export interface PerRule {
    readonly rule: string;
    readonly tokens: number;
}

/** Exact-BPE per-rule ranking at HEAD — the other basis, labelled as such. */
export function rankRules(dir: string): PerRule[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const rows: PerRule[] = [];
    for (const name of entries) {
        if (!name.endsWith('.md')) continue;
        try {
            rows.push({ rule: name, tokens: gpt_tokens(fs.readFileSync(path.join(dir, name), 'utf-8')).tokens });
        } catch {
            /* unreadable entry — skipped rather than failing the whole ranking */
        }
    }
    rows.sort((a, b) => b.tokens - a.tokens);
    return rows;
}

export interface Report {
    readonly base_ref: string | null;
    readonly basis: string;
    readonly rank_basis: string;
    readonly buckets: Bucket[];
    readonly rows: DeltaRow[];
    readonly total_debit: number;
    readonly total_credit: number;
    readonly net: number;
    readonly credit_bookings: CreditBooking[];
    readonly ranking: PerRule[];
}

export function buildReport(opts: { base: string | null; rank: boolean }): Report {
    const head = measureBuckets(REPO_ROOT);
    let rows: DeltaRow[] = [];
    if (opts.base !== null) {
        const dir = checkoutRefTree(opts.base);
        try {
            rows = diffBuckets(measureBuckets(dir), head);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
    const booking = partitionCredit();
    return {
        base_ref: opts.base,
        basis: 'chars/4 proxy over the projected tree (identical to preamble_byte_census)',
        rank_basis: method_note(),
        buckets: head,
        rows,
        total_debit: rows.reduce((s, r) => s + r.debit, 0),
        total_credit: rows.reduce((s, r) => s + r.credit, 0),
        net: rows.reduce((s, r) => s + r.debit - r.credit, 0),
        credit_bookings: booking === null ? [] : [booking],
        ranking: opts.rank ? rankRules(path.join(REPO_ROOT, 'dist', 'agent-src', 'rules')) : [],
    };
}

export function renderMarkdown(r: Report): string {
    const sign = (n: number): string => (n > 0 ? `+${String(n)}` : String(n));
    const out: string[] = ['## Standing payload — per-PR delta (report only)', ''];
    out.push(`**Basis:** ${r.basis}. This step **reports**; \`check_preamble_payload_budget\` is the gate.`, '');
    if (r.base_ref === null) {
        out.push('_No base ref given — HEAD buckets only._', '');
    } else {
        out.push(`**Merge-base:** \`${r.base_ref}\``, '');
        out.push('| Bucket | base | head | debit | credit |', '|---|---:|---:|---:|---:|');
        for (const row of r.rows) {
            out.push(
                `| ${row.name} (${String(row.baseFiles)} → ${String(row.headFiles)} files) ` +
                    `| ${String(row.base)} | ${String(row.head)} | ` +
                    `${row.debit === 0 ? '—' : `+${String(row.debit)}`} | ` +
                    `${row.credit === 0 ? '—' : `−${String(row.credit)}`} |`,
            );
        }
        out.push(
            `| **total** | | | **+${String(r.total_debit)}** | **−${String(r.total_credit)}** |`,
            '',
            `**Net:** \`${sign(r.net)}\` tok on the gated per-spawn payload.`,
            '',
        );
    }
    out.push('### Credit side (standing bookings)', '');
    if (r.credit_bookings.length === 0) {
        out.push(
            '_Unavailable in this environment: no host rule projection to read, so the ' +
                'partition credit cannot be measured here. Unavailable is reported as ' +
                'unavailable, never as zero._',
            '',
        );
    } else {
        out.push('| Booking | measured by | tokens |', '|---|---|---:|');
        for (const b of r.credit_bookings) {
            out.push(`| ${b.what} | \`${b.gate}\` | −${String(b.tokens)} |`);
        }
        out.push('', ...r.credit_bookings.map((b) => `_${b.note}_`), '');
    }
    if (r.ranking.length > 0) {
        out.push(`### Heaviest projected rules (${r.rank_basis})`, '');
        out.push('| tokens | rule |', '|---:|---|');
        for (const p of r.ranking.slice(0, 20)) out.push(`| ${String(p.tokens)} | \`${p.rule}\` |`);
        out.push('');
    }
    return out.join('\n');
}

function parse(argv: readonly string[]): { base: string | null; rank: boolean; json: boolean; quiet: boolean } {
    let base: string | null = null;
    let rank = false;
    let json = false;
    let quiet = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--base') {
            const v = argv[i + 1];
            if (v === undefined || v.startsWith('--')) throw new Error(`${PROG}: --base needs a ref`);
            base = v;
            i += 1;
        } else if (a === '--rank') rank = true;
        else if (a === '--json') json = true;
        else if (a === '--quiet') quiet = true;
        else throw new Error(`${PROG}: unknown argument '${String(a)}'`);
    }
    return { base, rank, json, quiet };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();
    let opts: ReturnType<typeof parse>;
    try {
        opts = parse(argv);
    } catch (err) {
        process.stderr.write(`${String((err as Error).message)}\n`);
        return 2;
    }

    let report: Report;
    try {
        report = buildReport({ base: opts.base, rank: opts.rank });
    } catch (err) {
        process.stderr.write(`${String((err as Error).message)}\n`);
        return 2;
    }

    // Ledger: one target per gated bucket, so "measured nothing" and "measured
    // one of three" stop being the same green line.
    const ledger = new GateLedger(PROG);
    ledger.plan([...BUCKETS]);
    for (const b of report.buckets) {
        if (b.files === 0) ledger.skip(b.name, 'no_applicable_files');
        else ledger.complete(b.name);
    }

    if (opts.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else if (!opts.quiet) {
        process.stdout.write(`${renderMarkdown(report)}\n`);
    } else {
        const sign = report.net > 0 ? `+${String(report.net)}` : String(report.net);
        process.stdout.write(
            `${PROG}: net ${sign} tok (debit +${String(report.total_debit)} / ` +
                `credit −${String(report.total_credit)}) vs ${report.base_ref ?? '(no base)'}\n`,
        );
    }

    const scanned = report.buckets.filter((b) => b.files > 0).length;
    try {
        reportScanned({ gate: PROG, scanned, units: 'gated payload bucket(s)', roots: ['dist/agent-src'] });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return 3;
        }
        throw err;
    }
    ledger.report();
    // Report-only by contract: a moved number is never a failure here.
    return 0;
}

/**
 * Prove the gate discriminates.
 *
 * The reject cases are deliberately NOT "the delta is large" — a report that
 * failed on its own number would be the second blocking gate this script exists
 * not to be. They are the two ways it can fail to MEASURE: an unreadable ref and
 * a usage error. The accept cases prove a real delta and a no-base run both
 * still exit 0.
 */
function selfTest(): number {
    const cases: SelfTestCase[] = [
        {
            name: 'unreadable base ref → exit 2',
            expect: 'reject',
            run: () => runGateCli(REPO_ROOT, SCRIPT_REL, ['--base', 'no-such-ref-xyzzy', '--quiet'], REPO_ROOT),
        },
        {
            name: 'unknown argument → exit 2',
            expect: 'reject',
            run: () => runGateCli(REPO_ROOT, SCRIPT_REL, ['--nonsense'], REPO_ROOT),
        },
        {
            name: 'no base ref → HEAD-only report, exit 0',
            expect: 'accept',
            run: () => runGateCli(REPO_ROOT, SCRIPT_REL, ['--quiet'], REPO_ROOT),
        },
        {
            name: 'real base ref → measured delta, still exit 0',
            expect: 'accept',
            run: () => runGateCli(REPO_ROOT, SCRIPT_REL, ['--base', 'HEAD', '--quiet'], REPO_ROOT),
        },
    ];
    return runSelfTest({ gate: PROG, cases, minCases: SELF_TEST_MIN_CASES, minRejectCases: SELF_TEST_MIN_REJECT });
}

function invokedDirectly(): boolean {
    const entry = process.argv[1];
    if (entry === undefined) return false;
    return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (invokedDirectly()) {
    process.exit(main());
}
