#!/usr/bin/env tsx
/**
 * Claims-Ledger gate — no public claim without a resolvable evidence binding.
 *
 * The mechanical anti-hype guardrail (road-to-final-state-and-market-readiness
 * Phase 1 / Track B, step B1). Every public-facing claim that carries a
 * `<!-- claim:<id> -->` marker in README.md or docs/ MUST resolve to a ledger
 * entry in docs/CLAIMS.md whose `status: backed` and whose `evidence` pointer
 * resolves. A smuggled unbacked claim (marker without a backed, resolvable
 * ledger entry) fails the build — so "we sell honesty" is itself machine-checked.
 *
 * Non-disruptive by design: only `<!-- claim:ID -->`-**markered** spans are
 * enforced. Unmarkered prose is never checked, so existing README text does not
 * retroactively break CI; the ledger tightens as claims are markered over time.
 * Ledger entries with `status: unbacked` are inventory (documented debt) and do
 * NOT fail the build — but marking such an entry's claim in prose does.
 *
 * Evidence-pointer grammar (v1):
 *   <repo-path>[:line]        → the repo file exists (line advisory).
 *   <repo-path>#<substring>   → the file exists AND contains <substring>.
 *   https://… (YYYY-MM-DD)    → external cite with a dated stamp (not fetched).
 *
 * Exit codes: 0 = clean · 2 = unbacked/dangling/missing-entry finding OR usage
 * error. Success prints to stdout; findings print to stderr.
 *
 * Usage:
 *     ./scripts-run src/scripts/check_claims
 *     ./scripts-run src/scripts/check_claims --quiet
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _FILE = fileURLToPath(import.meta.url);
const _HERE = path.dirname(_FILE);
const REPO = path.resolve(_HERE, '..', '..');
const LEDGER_REL = 'docs/CLAIMS.md';

/** Surfaces scanned for `<!-- claim:ID -->` markers. */
const SURFACE_ROOTS = ['README.md', 'docs'];

const CLAIM_MARKER = /<!--\s*claim:([A-Za-z0-9._-]+)\s*-->/g;
const URL_DATED = /^https?:\/\/\S+\(\d{4}-\d{2}-\d{2}\)\s*$/;

class ExitCode extends Error {
    code: number;
    constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
    }
}

interface LedgerEntry {
    id: string;
    claim: string;
    kind: string;
    evidence: string;
    status: string;
    last_verified: string;
}

interface Args {
    quiet: boolean;
}

function parse_args(argv: string[]): Args {
    const out: Args = { quiet: false };
    for (const a of argv) {
        if (a === '--quiet') {
            out.quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: check_claims [--quiet]\n');
            throw new ExitCode(0);
        } else {
            process.stderr.write(`❌  check_claims: unrecognized argument: ${a}\n`);
            throw new ExitCode(2);
        }
    }
    return out;
}

/** Parse docs/CLAIMS.md — one entry per `### claim: <id>` block. */
function load_ledger(): Map<string, LedgerEntry> {
    const ledger = new Map<string, LedgerEntry>();
    const p = path.join(REPO, LEDGER_REL);
    if (!fs.existsSync(p)) {
        return ledger;
    }
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    let cur: Partial<LedgerEntry> & { id?: string } = {};
    const flush = () => {
        if (cur.id) {
            ledger.set(cur.id, {
                id: cur.id,
                claim: cur.claim ?? '',
                kind: cur.kind ?? '',
                evidence: cur.evidence ?? '',
                status: cur.status ?? '',
                last_verified: cur.last_verified ?? '',
            });
        }
        cur = {};
    };
    for (const line of lines) {
        const head = line.match(/^###\s+claim:\s*([A-Za-z0-9._-]+)\s*$/);
        if (head) {
            flush();
            cur = { id: head[1] };
            continue;
        }
        if (!cur.id) continue;
        const field = line.match(/^-\s+(claim|kind|evidence|status|last_verified):\s*(.*)$/);
        if (field) {
            const key = field[1] as keyof LedgerEntry;
            (cur as Record<string, string>)[key] = field[2].trim();
        }
    }
    flush();
    return ledger;
}

/** Recursively collect .md files under a repo-relative root (file or dir). */
function collect_md(rel: string): string[] {
    const abs = path.join(REPO, rel);
    if (!fs.existsSync(abs)) return [];
    const st = fs.statSync(abs);
    if (st.isFile()) return abs.endsWith('.md') ? [abs] : [];
    const out: string[] = [];
    for (const name of fs.readdirSync(abs)) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        out.push(...collect_md(path.join(rel, name)));
    }
    return out;
}

/** Find every live `<!-- claim:ID -->` marker across the scanned surfaces.
 *  Skips the ledger file itself and any marker shown as documentation
 *  (inside a ``` fenced block or an inline `backtick` span). */
function scan_markers(): { id: string; file: string }[] {
    const found: { id: string; file: string }[] = [];
    const files = new Set<string>();
    for (const root of SURFACE_ROOTS) {
        for (const f of collect_md(root)) files.add(f);
    }
    for (const f of files) {
        const rel = path.relative(REPO, f);
        if (rel === LEDGER_REL) continue; // the ledger documents the syntax
        let fenced = false;
        for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
            if (/^\s*```/.test(line)) {
                fenced = !fenced;
                continue;
            }
            if (fenced) continue;
            for (const m of line.matchAll(CLAIM_MARKER)) {
                const before = line.slice(0, m.index ?? 0);
                const backticks = (before.match(/`/g) ?? []).length;
                if (backticks % 2 === 1) continue; // inside an inline-code span
                found.push({ id: m[1], file: rel });
            }
        }
    }
    return found;
}

/** Does an evidence pointer resolve? Returns null on success, else a reason. */
function pointer_unresolved(evidence: string): string | null {
    const ev = evidence.trim();
    if (!ev) return 'empty evidence pointer';
    if (/^https?:\/\//.test(ev)) {
        return URL_DATED.test(ev) ? null : 'external URL missing a (YYYY-MM-DD) stamp';
    }
    // repo-path[:line] or repo-path#substring
    let target = ev;
    let needle: string | null = null;
    const hash = ev.indexOf('#');
    if (hash !== -1) {
        target = ev.slice(0, hash);
        needle = ev.slice(hash + 1);
    }
    target = target.replace(/:\d+$/, ''); // strip :line
    const abs = path.join(REPO, target);
    if (!fs.existsSync(abs)) return `evidence path not found: ${target}`;
    if (needle) {
        const body = fs.readFileSync(abs, 'utf8');
        if (!body.includes(needle)) return `evidence file lacks '${needle}': ${target}`;
    }
    return null;
}

interface Finding {
    id: string;
    file: string;
    reason: string;
}

function main(argv: string[] = process.argv.slice(2)): number {
    const args = parse_args(argv);
    const ledger = load_ledger();
    const markers = scan_markers();
    const findings: Finding[] = [];

    // 1. Every markered claim must map to a backed, resolvable ledger entry.
    for (const { id, file } of markers) {
        const entry = ledger.get(id);
        if (!entry) {
            findings.push({ id, file, reason: `no ledger entry in ${LEDGER_REL}` });
            continue;
        }
        if (entry.status !== 'backed') {
            findings.push({ id, file, reason: `ledger status is '${entry.status || 'missing'}', not 'backed'` });
            continue;
        }
        const un = pointer_unresolved(entry.evidence);
        if (un) findings.push({ id, file, reason: un });
    }

    // 2. Rot guard: a backed ledger entry whose pointer no longer resolves
    //    fails even before it is markered (an implementation must not outlive
    //    its claim, and vice-versa).
    for (const entry of ledger.values()) {
        if (entry.status !== 'backed') continue;
        const un = pointer_unresolved(entry.evidence);
        if (un) findings.push({ id: entry.id, file: LEDGER_REL, reason: `backed entry has dangling evidence — ${un}` });
    }

    if (findings.length > 0) {
        process.stderr.write(`❌  check_claims: ${findings.length} unbacked/dangling claim(s):\n`);
        for (const f of findings) {
            process.stderr.write(`    ${f.file} · claim:${f.id} — ${f.reason}\n`);
        }
        process.stderr.write(`    → bind the claim in ${LEDGER_REL} (status: backed + a resolvable evidence pointer), or remove the marker.\n`);
        return 2;
    }

    if (!args.quiet) {
        const backed = [...ledger.values()].filter((e) => e.status === 'backed').length;
        const unbacked = [...ledger.values()].filter((e) => e.status === 'unbacked').length;
        process.stdout.write(
            `✅  check_claims: ${markers.length} markered claim(s) bound · ledger ${ledger.size} entries (${backed} backed, ${unbacked} unbacked inventory)\n`,
        );
    }
    return 0;
}

/** Robust "am I the entry script?" — realpath-compares argv[1] to this file so
 *  a symlinked invocation path (macOS /var → /private/var under a tmp tree)
 *  still resolves. Irrelevant under scripts-run (run.ts calls main directly). */
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
if (_isCliEntry()) {
    try {
        process.exit(main());
    } catch (exc) {
        if (exc instanceof ExitCode) {
            process.exit(exc.code);
        }
        throw exc;
    }
}

export { REPO, LEDGER_REL, main, parse_args, load_ledger, scan_markers, pointer_unresolved, ExitCode };
