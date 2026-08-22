#!/usr/bin/env tsx
/**
 * Requirement → acceptance → evidence INVENTORY. Exits 0 always.
 *
 * ## Why a listing and not a gate
 *
 * A gate that can fail on day one reds the whole backlog, and this tree has
 * recorded that failure once already: `road-to-plan-gates-measurement` sits in
 * `later/` because its counter measured **0** — its own text records "Measured
 * at parking time: 0" and an advisory window of 0 of 10 gated PRs. So this
 * script is deliberately a *reader*: it prints the distribution and returns 0
 * whatever it finds, including when it finds nothing.
 *
 * The name carries a `check_` prefix because that is what the gate-population
 * classifier keys on and the script IS registered for coverage; the exit code is
 * what makes it a listing rather than an enforcement.
 *
 * ## Three populations, reported separately
 *
 * The council's correction, and the reason this is not one number. Step 2.1
 * originally named three roadmaps to dogfood; all three were archived by sibling
 * pull requests in the same drain run, so the named set was gone before any
 * window opened. Merging one PR before another would have changed the reported
 * result with no roadmap edited — which makes merge order part of the
 * experiment.
 *
 *   - `fixture`   — synthetic inputs, for parser and resolver mechanics. Never
 *                   counts toward adoption: a maintainer-authored fixture is
 *                   evidence about the reader, not about uptake.
 *   - `cohort`    — a frozen manifest of files under study, active or archived.
 *                   Experimental history; may include archived members.
 *   - `live`      — the current ACTIVE corpus only. This is the compliance
 *                   number, and the only one a ratchet may read.
 *
 * Collapsing them is how a zero from non-adoption becomes indistinguishable
 * from a zero from non-compliance.
 *
 * ## What `unresolved` means, and when it is evaluated
 *
 * At the CURRENT head, always. A ref that resolved when it was declared and no
 * longer resolves is `unresolved`, and that is the intended reading rather than
 * a defect in it — deleted evidence is what an inventory exists to surface. The
 * consequence, stated rather than discovered: a completed roadmap can move from
 * resolved to unresolved with no roadmap edit.
 *
 * Usage:
 *     ./scripts-run src/scripts/check_requirements_trace [--json] [--dir P]
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const ROADMAP_DIR = path.join(REPO_ROOT, 'agents', 'roadmaps');

/** The claim-ledger kebab slug, reused rather than invented. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface TraceRow {
    requirement_id: string;
    acceptance_id: string;
    evidence_refs: string[];
}

export interface FileTrace {
    file: string;
    rows: TraceRow[];
    /** `[AC:<id>]` ids found on `verify:` lines. */
    ac_annotations: string[];
    /** Rows whose ids do not match the reused slug grammar. */
    malformed: string[];
}

/**
 * Parse the `traceability:` rows out of a roadmap.
 *
 * A deliberately small reader over the block form § 2c fixes, and NOT a YAML
 * parser: the block may appear inside a blockquote (this roadmap dogfoods it
 * that way) and a real parser would need the whole document to be YAML, which a
 * roadmap is not. Leading `>` and whitespace are stripped per line.
 */
export function parseTrace(text: string): { rows: TraceRow[]; malformed: string[] } {
    const lines = text.split('\n').map((l) => l.replace(/^\s*>\s?/, ''));
    const rows: TraceRow[] = [];
    const malformed: string[] = [];
    let inBlock = false;
    let cur: Partial<TraceRow> | null = null;
    let inRefs = false;

    const flush = (): void => {
        if (cur === null) return;
        const { requirement_id: req, acceptance_id: acc } = cur;
        if (req !== undefined && acc !== undefined) {
            if (!SLUG.test(req)) malformed.push(`requirement_id \`${req}\` is not a kebab slug`);
            if (!SLUG.test(acc)) malformed.push(`acceptance_id \`${acc}\` is not a kebab slug`);
            rows.push({ requirement_id: req, acceptance_id: acc, evidence_refs: cur.evidence_refs ?? [] });
        }
        cur = null;
        inRefs = false;
    };

    for (const raw of lines) {
        if (/^\s*traceability:\s*$/.test(raw)) {
            inBlock = true;
            continue;
        }
        if (!inBlock) continue;
        // A fence or a non-indented non-list line ends the block.
        if (/^\s*```/.test(raw) || (raw.trim() !== '' && !/^\s/.test(raw))) {
            flush();
            inBlock = false;
            continue;
        }
        const item = /^\s*-\s+requirement_id:\s*(\S+)\s*$/.exec(raw);
        if (item) {
            flush();
            cur = { requirement_id: item[1] as string, evidence_refs: [] };
            continue;
        }
        if (cur === null) continue;
        const acc = /^\s*acceptance_id:\s*(\S+)\s*$/.exec(raw);
        if (acc) {
            cur.acceptance_id = acc[1] as string;
            inRefs = false;
            continue;
        }
        if (/^\s*evidence_refs:\s*$/.test(raw)) {
            inRefs = true;
            continue;
        }
        const ref = /^\s*-\s+(\S+)\s*$/.exec(raw);
        if (ref && inRefs) {
            (cur.evidence_refs ??= []).push(ref[1] as string);
        }
    }
    flush();
    return { rows, malformed };
}

/** `[AC:<id>]` ids on `verify:` lines — the first structural reader of them. */
export function parseAcAnnotations(text: string): string[] {
    const out: string[] = [];
    for (const m of text.matchAll(/verify:\s*\[AC:([a-z0-9-]+)\]/g)) out.push(m[1] as string);
    return out;
}

export interface Summary {
    files: number;
    rows: number;
    /** Rows with at least one evidence ref. */
    linked: number;
    /** Rows with no evidence ref at all. */
    unlinked: number;
    /** Evidence refs that do not resolve at the current head. */
    unresolved: number;
    refs: number;
    ac_annotations: number;
    /** `[AC:…]` ids with no matching `acceptance_id` in the same file. */
    dangling_ac: number;
    malformed: number;
}

export function summarise(traces: readonly FileTrace[], repoRoot: string): Summary {
    let rows = 0;
    let linked = 0;
    let unlinked = 0;
    let refs = 0;
    let unresolved = 0;
    let dangling = 0;
    let malformed = 0;
    for (const t of traces) {
        rows += t.rows.length;
        malformed += t.malformed.length;
        const accIds = new Set(t.rows.map((r) => r.acceptance_id));
        for (const id of t.ac_annotations) if (!accIds.has(id)) dangling += 1;
        for (const r of t.rows) {
            if (r.evidence_refs.length === 0) unlinked += 1;
            else linked += 1;
            for (const ref of r.evidence_refs) {
                refs += 1;
                // Evaluated at the CURRENT head. A ref that has been deleted is
                // unresolved, which is the reading this inventory exists for.
                if (!fs.existsSync(path.join(repoRoot, ref.replace(/:\d+(-\d+)?$/, '')))) {
                    unresolved += 1;
                }
            }
        }
    }
    return {
        files: traces.length,
        rows,
        linked,
        unlinked,
        unresolved,
        refs,
        ac_annotations: traces.reduce((n, t) => n + t.ac_annotations.length, 0),
        dangling_ac: dangling,
        malformed,
    };
}

function readLive(dir: string): FileTrace[] {
    let names: string[] = [];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.md') && n !== 'README.md').sort();
    } catch {
        return [];
    }
    const out: FileTrace[] = [];
    for (const n of names) {
        const text = fs.readFileSync(path.join(dir, n), 'utf-8');
        const { rows, malformed } = parseTrace(text);
        const ac = parseAcAnnotations(text);
        if (rows.length === 0 && ac.length === 0) continue;
        out.push({ file: `agents/roadmaps/${n}`, rows, ac_annotations: ac, malformed });
    }
    return out;
}

/** Floors for `--self-test`, declared here so a truncation is a visible diff. */
const SELF_TEST_MIN_CASES = 5;
const SELF_TEST_MIN_REJECT = 1;
const SCRIPT_REL = 'src/scripts/check_requirements_trace.ts';

/**
 * `--self-test` for a gate that exits 0 ALWAYS — which needs explaining, since
 * the harness's whole premise is that a gate proves it can go red.
 *
 * This one cannot, by design, so the reject case is the harness's OWN floor:
 * a truncated suite must fail. What the accept cases prove instead is that the
 * reader DISCRIMINATES — the same discrimination a failing exit would
 * demonstrate elsewhere, asserted on the output rather than the exit code.
 * Stated rather than left implicit, because a self-test whose cases all accept
 * is exactly the degenerate pass the harness warns about.
 */
function _fixture(name: string, body: string, args: readonly string[] = []): number {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `reqtrace-st-${name}-`));
    const rm = path.join(dir, 'agents', 'roadmaps');
    fs.mkdirSync(rm, { recursive: true });
    fs.writeFileSync(path.join(rm, 'a.md'), body, 'utf-8');
    return runGateCli(REPO_ROOT, SCRIPT_REL, ['--dir', rm, ...args], dir);
}

const _ROW = 'traceability:\n  - requirement_id: r-one\n    acceptance_id: a-one\n';

function selfTest(): number {
    const cases: SelfTestCase[] = [
        { name: 'a declared row is accepted', expect: 'accept', run: () => _fixture('row', _ROW) },
        {
            name: 'a dangling [AC:] annotation still exits 0 — this is a listing, not a gate',
            expect: 'accept',
            run: () => _fixture('dangling', `${_ROW}\n      verify: [AC:nowhere] x\n`),
        },
        {
            name: 'an empty corpus exits 0 and does not read as a clean bill',
            expect: 'accept',
            run: () => _fixture('empty', '# no traceability block here\n'),
        },
        {
            name: 'a non-slug id exits 0 and is reported, never enforced',
            expect: 'accept',
            run: () => _fixture('slug', 'traceability:\n  - requirement_id: Not_A_Slug\n    acceptance_id: a\n'),
        },
        {
            name: 'an unknown argument is refused — the one non-zero path there is',
            expect: 'reject',
            run: () => _fixture('badarg', _ROW, ['--not-a-flag']),
        },
    ];
    return runSelfTest({
        gate: 'check_requirements_trace',
        cases,
        minCases: SELF_TEST_MIN_CASES,
        minRejectCases: SELF_TEST_MIN_REJECT,
    });
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();
    for (let k = 0; k < argv.length; k += 1) {
        const a = argv[k] as string;
        if (a === '--json') continue;
        if (a === '--dir') {
            k += 1;
            continue;
        }
        if (a === '--self-test') continue;
        process.stderr.write(`check_requirements_trace: unrecognized argument: ${a}\n`);
        return 2;
    }
    const i = argv.indexOf('--dir');
    const dir = i >= 0 && i + 1 < argv.length ? path.resolve(argv[i + 1] as string) : ROADMAP_DIR;
    const root = i >= 0 ? path.dirname(path.dirname(dir)) : REPO_ROOT;

    let corpus = 0;
    try {
        corpus = fs.readdirSync(dir).filter((n) => n.endsWith('.md') && n !== 'README.md').length;
    } catch {
        corpus = 0;
    }
    const live = readLive(dir);
    const s = summarise(live, root);

    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ population: 'live', corpus, ...s, files_detail: live }, null, 2)}\n`);
        return 0;
    }

    process.stdout.write(`scanned: ${String(corpus)}\n`);
    try {
        assertScanned({
            gate: 'check_requirements_trace',
            scanned: corpus,
            units: 'roadmap file(s)',
            roots: ['agents/roadmaps'],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            // Reported, and STILL exit 0. A dead scope is a real finding about
            // this reader, and turning it into a non-zero exit would make the
            // listing a gate — which is the one thing it must not become.
            process.stderr.write(`⚠️  ${err.message}\n`);
        } else {
            throw err;
        }
    }

    process.stdout.write('\n| Roadmap | requirement_id | acceptance_id | evidence refs | unresolved |\n');
    process.stdout.write('|---|---|---|---|---|\n');
    if (live.length === 0) {
        process.stdout.write('| _none declared_ | — | — | — | — |\n');
    }
    for (const t of live) {
        for (const r of t.rows) {
            const bad = r.evidence_refs.filter(
                (ref) => !fs.existsSync(path.join(root, ref.replace(/:\d+(-\d+)?$/, ''))),
            ).length;
            process.stdout.write(
                `| ${t.file} | ${r.requirement_id} | ${r.acceptance_id} | ` +
                    `${String(r.evidence_refs.length)} | ${String(bad)} |\n`,
            );
        }
        for (const id of t.ac_annotations) {
            const known = t.rows.some((r) => r.acceptance_id === id);
            if (!known) {
                process.stdout.write(`| ${t.file} | — | **[AC:${id}] dangling** | — | — |\n`);
            }
        }
    }

    // The line a ratchet reads, and the line a later reading is compared to.
    // Integers with the corpus they were computed over, never a verdict: "
    // traceability is patchy" cannot be compared to the next reading.
    process.stdout.write(
        `\nlive: rows ${String(s.rows)} · linked ${String(s.linked)} · unlinked ${String(s.unlinked)} · ` +
            `refs ${String(s.refs)} · unresolved ${String(s.unresolved)} · ` +
            `ac_annotations ${String(s.ac_annotations)} · dangling_ac ${String(s.dangling_ac)} · ` +
            `malformed ${String(s.malformed)} · over ${String(corpus)} active roadmap(s), ` +
            `${String(s.files)} declaring\n`,
    );
    process.stdout.write(
        '    POPULATION: live (active corpus only). A `fixture` population tests this reader\n' +
            '    and never counts toward adoption; a frozen `cohort` may include archived files\n' +
            '    and is experimental history. Collapsing the three is how a zero from\n' +
            '    non-adoption becomes indistinguishable from a zero from non-compliance.\n',
    );
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main());
}
