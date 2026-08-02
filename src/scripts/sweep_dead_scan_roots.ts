#!/usr/bin/env -S node --import tsx
/**
 * sweep_dead_scan_roots — which gate scripts walk a root that does not exist?
 *
 * Population expansion for `road-to-gates-that-can-fail` Phase 1. The committed
 * census (`agents/evidence/reports/gate-scope-census.md`) covers the 14 gates a
 * manual audit confirmed dead; extending it to the full population is that
 * step's stated remaining work. This is the deterministic instrument for it.
 *
 * WHY IT EXISTS: two more dead gates were found OUTSIDE the censused 14 while
 * doing thematically unrelated work — `audit_skill_overlap` (rooted at a
 * deleted container, 0 of 287 skills read) and `lint_media_policy_linkage`
 * (`agents/policies/media` absent, exits 0 with "nothing to lint"). Two
 * incidental finds outside an audited set is a base-rate question, not an
 * anecdote, and a hand-written census cannot answer it repeatably.
 *
 * ── CRITERION ──────────────────────────────────────────────────────────────
 *
 * A finding is a repo path assembled from string literals over a ROOT-like
 * base that does not exist on disk. It is CONFIRMED only with POSITIVE READ
 * EVIDENCE — the path must demonstrably be read, not merely mentioned:
 *
 *   direct-read              fs read called with the identifier
 *   helper-read:<fn>         passed to a same-file function whose body reads
 *   inline-read              a read wraps the join expression itself
 *   derived-read-><id>:<ev>  a derivation chain that TERMINATES in a read
 *   array-iterated-*:<arr>   member of a root array whose loop variable reads
 *   spec-iterated-*:<arr>    property of an iterated spec table, prop reads
 *
 * "Not written to" is deliberately NOT evidence, and neither is derivation on
 * its own. Both were tried and both produced false positives — see the
 * evidence log below. Everything else missing-but-unproven is reported as
 * UNPROVEN, never dropped: static single-file analysis cannot see reads that
 * cross a module boundary, so the confirmed set is a floor, not a census.
 *
 * ── EVIDENCE LOG (every rule below was added by a measured failure) ────────
 *
 *   1. Reads inside function bodies and lowercase locals count. A first cut
 *      read only top-level uppercase constants and MISSED `audit_skill_overlap`
 *      — a sweep that misses a known-dead gate is itself a dead gate.
 *   2. Positive read evidence, not absence of writes. "Not write-only" flagged
 *      `check_gate_paths`, whose `packages` entry is a membership allowlist for
 *      an `_is_under_source_tree` predicate. Path-as-predicate is not
 *      path-as-root.
 *   3. Array membership, with the loop variable required to read. Multi-root
 *      gates collect roots in an array literal, leaving no per-root identifier
 *      — that is why `lint_media_policy_linkage` reported 1 of its 4 dead roots.
 *      Treating iteration alone as evidence re-flagged `check_gate_paths`
 *      (it iterates its allowlist into `startsWith`), so the loop variable must
 *      itself flow into a read.
 *   4. Derivation must terminate in a read. `derived-join` used to assert only
 *      "this identifier is the base of a further join" — derivation, not
 *      lecture. It carried four class-A findings.
 *   5. Property joins in iterated spec tables. Rule 4 demoted `lint_namespace`,
 *      which the census independently lists as dead: its roots live as object
 *      properties in a `TARGETS` table whose destructured loop variable feeds a
 *      reading helper. Neither the identifier trail nor the array tracer could
 *      attach.
 *
 * Not built, on purpose: `forEach`/`map` spec variants and property joins
 * outside array literals. Neither occurs in this corpus. A rule without a
 * measured occurrence is the speculative extension this log exists to prevent.
 *
 * ── DISPOSITIONS LEDGER ────────────────────────────────────────────────────
 *
 * Findings cleared by manual review live in `agents/evidence/sweep-dispositions.json`
 * ({script, rel, category, reason, date}). They are PRINTED as
 * `known-benign (<category>)`, never silently suppressed — the sweep has
 * memory so the same three cases are not re-litigated every run. A ledger
 * entry with no matching finding is STALE (the code moved; re-review), and the
 * ledger is capped so growth forces re-litigation instead of quiet accretion.
 *
 * ── EXIT CONTRACT (one meaning per code, so red stays informative) ─────────
 *
 *   0  clean
 *   1  confirmed class-A finding(s) — real dead roots. Nothing else returns 1.
 *   2  self-test failure — the extractor is blind; output is not trustworthy.
 *   3  ledger hygiene — stale entry or over cap. The sweep ran fine; the LIST
 *      needs work.
 *
 * Real findings outrank hygiene: a stale entry alongside genuine class-A hits
 * still exits 1, with the stale warning on stderr. Returning 3 there would let
 * a bookkeeping problem mask dead gates — the precise failure this gate exists
 * to catch, reproduced in the gate itself.
 *
 * Usage:
 *   ./scripts-run src/scripts/sweep_dead_scan_roots [--quiet] [--json <path>]
 *                                                   [--root <dir>] [--ledger <path>]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_SCRIPTS = path.join(REPO, 'src', 'scripts');
const DEFAULT_LEDGER = path.join(REPO, 'agents', 'evidence', 'sweep-dispositions.json');
const LEDGER_CAP = 15;

/** Population: the gate-name prefix convention the census uses. */
const GATE_RE = /^(lint|audit|check|verify)_.*\.ts$/;

/** Identifiers accepted as a repo-root base for a literal join. */
const BASE_IDS: ReadonlySet<string> = new Set([
    'ROOT', 'REPO_ROOT', 'REPO', 'PROJECT_ROOT', 'REPO_DIR',
]);

const READ_FNS = 'readdirSync|readFileSync|statSync|opendirSync|existsSync|globSync';
const READ_RE = new RegExp(`(${READ_FNS})`);

/**
 * Triage classes. Assignment is mechanical; disposition is a human call.
 * A — pre-ADR-051 containers: the exact class the census repaired 14 of.
 * B — build artifacts consumed as inputs: missing in a fresh clone is only a
 *     defect if CI runs the gate before its producer.
 * C — everything else: optional surface (→ `allowEmpty` with a reason) or a
 *     retired feature (→ retire the gate).
 */
const CLASS_A_RETIRED: readonly string[] = ['.agent-src.uncondensed', 'packages'];
const CLASS_B_ARTIFACT: readonly string[] = ['dist/', 'internal/bench/reports/', '.github/', 'site/dist'];

export type TriageClass = 'A' | 'B' | 'C';

export function classify(rel: string): TriageClass {
    if (CLASS_A_RETIRED.some((p) => rel === p || rel.startsWith(`${p}/`))) return 'A';
    if (CLASS_B_ARTIFACT.some((p) => rel.startsWith(p))) return 'B';
    return 'C';
}

export interface Finding {
    rel: string;
    names: string;
    evidence: string;
}

export interface Analysis {
    confirmed: Finding[];
    unproven: Finding[];
}

export interface Disposition {
    script: string;
    rel: string;
    category: string;
    reason: string;
    date: string;
}

/** Literal segments of a `path.join(base, 'a', 'b')` tail, joined POSIX-style. */
function literals(tail: string): string {
    return [...tail.matchAll(/'([^']*)'/g)].map((x) => x[1]).join('/');
}

/** Same-file functions whose body contains a read (crude slice, deliberately). */
function localReaders(src: string): Set<string> {
    const out = new Set<string>();
    const re =
        /(?:function\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
        const name = (m[1] ?? m[2]) as string;
        if (READ_RE.test(src.slice(m.index, m.index + 3000))) out.add(name);
    }
    return out;
}

/** Does `v` flow into a read within `scope`? Returns the evidence kind. */
function readsWithin(src: string, scope: string, v: string, readers: Set<string>, kind: string): string | null {
    if (new RegExp(`(${READ_FNS})\\([^)]*\\b${v}\\b`).test(scope)) return `${kind}-read`;
    for (const r of readers) {
        if (new RegExp(`\\b${r}\\(\\s*${v}\\b`).test(scope)) return `${kind}-helper:${r}`;
    }
    return null;
}

/** `const NAME = [ path.join(<BASE>, 'lit'…), … ]` — roots collected in an array. */
function arrayRootDecls(src: string): Array<{ name: string; rels: string[] }> {
    const out: Array<{ name: string; rels: string[] }> = [];
    const re = /const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*\[([\s\S]*?)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
        const rels: string[] = [];
        const jre = /path\.join\(\s*([A-Za-z_$][\w$]*)\s*((?:,\s*'[^']*')+)\s*\)/g;
        let j: RegExpExecArray | null;
        while ((j = jre.exec(m[2] as string)) !== null) {
            if (BASE_IDS.has(j[1] as string)) rels.push(literals(j[2] as string));
        }
        if (rels.length) out.push({ name: m[1] as string, rels });
    }
    return out;
}

/** Read-shaped use of a whole root array — inherited by every member. */
function arrayEvidence(src: string, name: string, readers: Set<string>): string | null {
    const forRe = new RegExp(`for\\s*\\(\\s*const\\s+([\\w$]+)\\s+of\\s+${name}\\b`, 'g');
    let m: RegExpExecArray | null;
    while ((m = forRe.exec(src)) !== null) {
        const ev = readsWithin(src, src.slice(m.index, m.index + 400), m[1] as string, readers, 'array-iterated');
        if (ev) return ev;
    }
    const cbRe = new RegExp(`${name}\\.(?:forEach|map|flatMap|filter)\\(\\s*\\(?([\\w$]+)\\)?\\s*=>`, 'g');
    while ((m = cbRe.exec(src)) !== null) {
        const ev = readsWithin(src, src.slice(m.index, m.index + 400), m[1] as string, readers, 'array-traversed');
        if (ev) return ev;
    }
    for (const r of readers) {
        if (new RegExp(`\\b${r}\\(\\s*(?:\\.\\.\\.)?${name}\\b`).test(src)) return `array-passed-helper:${r}`;
    }
    return null;
}

/** Identifier → repo-relative path, two hops, so property joins over a derived parent resolve. */
function resolveMap(src: string): Map<string, string> {
    const out = new Map<string, string>();
    const re =
        /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*path\.join\(\s*([A-Za-z_$][\w$]*)\s*((?:,\s*'[^']*')*)\s*\)/g;
    for (let hop = 0; hop < 2; hop += 1) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src)) !== null) {
            const [, name, base, tail] = m;
            const lit = literals(tail as string);
            if (BASE_IDS.has(base as string)) {
                if (lit) out.set(name as string, lit);
            } else if (out.has(base as string)) {
                const parent = out.get(base as string) as string;
                out.set(name as string, lit ? `${parent}/${lit}` : parent);
            }
        }
    }
    return out;
}

export function analyze(src: string, repoRoot: string): Analysis {
    const readers = localReaders(src);
    const resolved = resolveMap(src);

    // Property joins inside array-literal spec tables; evidence comes from the
    // DESTRUCTURED property flowing into a read.
    const specHits = new Map<string, string>();
    const specUnproven = new Set<string>();
    {
        const are = /const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*\[([\s\S]*?)\];/g;
        let am: RegExpExecArray | null;
        while ((am = are.exec(src)) !== null) {
            const [, arrName, body] = am;
            const pre =
                /([A-Za-z_$][\w$]*)\s*:\s*path\.join\(\s*([A-Za-z_$][\w$]*)\s*((?:,\s*'[^']*')*)\s*\)/g;
            const propRels: Array<{ prop: string; rel: string }> = [];
            let pm: RegExpExecArray | null;
            while ((pm = pre.exec(body as string)) !== null) {
                const [, prop, base, tail] = pm;
                const lit = literals(tail as string);
                let rel: string | null = null;
                if (BASE_IDS.has(base as string)) rel = lit || null;
                else if (resolved.has(base as string)) {
                    const parent = resolved.get(base as string) as string;
                    rel = lit ? `${parent}/${lit}` : parent;
                }
                if (rel) propRels.push({ prop: prop as string, rel });
            }
            if (!propRels.length) continue;

            const evByProp = new Map<string, string>();
            const fre = new RegExp(`for\\s*\\(\\s*const\\s*\\{([^}]*)\\}\\s+of\\s+${arrName}\\b`, 'g');
            let fm: RegExpExecArray | null;
            while ((fm = fre.exec(src)) !== null) {
                const scope = src.slice(fm.index, fm.index + 400);
                for (const raw of (fm[1] as string).split(',')) {
                    const v = raw.trim().split(':').pop()?.trim() ?? '';
                    if (!v || evByProp.has(v)) continue;
                    const ev = readsWithin(src, scope, v, readers, 'spec-iterated');
                    if (ev) evByProp.set(v, ev);
                }
            }
            for (const { prop, rel } of propRels) {
                const ev = evByProp.get(prop);
                if (ev) specHits.set(rel, `${ev}:${arrName}`);
                else specUnproven.add(rel);
            }
        }
    }

    const arrayHits = new Map<string, string>();
    const arrayUnproven = new Set<string>();
    for (const arr of arrayRootDecls(src)) {
        const ev = arrayEvidence(src, arr.name, readers);
        for (const rel of arr.rels) {
            if (ev) arrayHits.set(rel, `${ev}:${arr.name}`);
            else arrayUnproven.add(rel);
        }
    }

    // Direct literal joins over a base, with their declaring identifier.
    const found = new Map<string, { names: Set<string>; inlineRead: boolean }>();
    {
        const re =
            /(?:(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*)?path\.join\(\s*([A-Za-z_$][\w$]*)\s*((?:,\s*'[^']*')+)\s*\)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src)) !== null) {
            const [, name, base, tail] = m;
            if (!BASE_IDS.has(base as string)) continue;
            const rel = literals(tail as string);
            if (!rel) continue;
            const e = found.get(rel) ?? { names: new Set<string>(), inlineRead: false };
            if (name) e.names.add(name);
            // Anchored on purpose: the read must WRAP the join. An unanchored
            // lookback bled across newlines and handed a preceding statement's
            // read to an unrelated array member.
            else if (new RegExp(`(${READ_FNS})\\s*\\($`).test(src.slice(Math.max(0, m.index - 40), m.index))) {
                e.inlineRead = true;
            }
            found.set(rel, e);
        }
    }

    // Derivation graph: parent identifier → children declared from it.
    const derived = new Map<string, string[]>();
    {
        const re =
            /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*path\.join\(\s*([A-Za-z_$][\w$]*)\s*(?:,\s*'[^']*')*\s*\)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src)) !== null) {
            const [, child, parent] = m;
            if (BASE_IDS.has(parent as string)) continue;
            derived.set(parent as string, [...(derived.get(parent as string) ?? []), child as string]);
        }
    }

    const identifierEvidence = (n: string, seen: Set<string>, depth: number): string | null => {
        if (depth > 3 || seen.has(n)) return null;
        seen.add(n);
        if (new RegExp(`(${READ_FNS})\\([^)]*\\b${n}\\b`).test(src)) return 'direct-read';
        for (const r of readers) {
            if (new RegExp(`\\b${r}\\(\\s*${n}\\b`).test(src)) return `helper-read:${r}`;
        }
        for (const child of derived.get(n) ?? []) {
            const ev = identifierEvidence(child, seen, depth + 1);
            if (ev) return `derived-read->${child}:${ev}`;
        }
        return null; // derivation without a terminating read is NOT evidence
    };

    const confirmed: Finding[] = [];
    const unproven: Finding[] = [];
    const missing = (rel: string): boolean => !fs.existsSync(path.join(repoRoot, rel));

    for (const [rel, e] of found) {
        if (!missing(rel)) continue;
        let evidence: string | null =
            e.inlineRead ? 'inline-read' : (arrayHits.get(rel) ?? specHits.get(rel) ?? null);
        let writeOnly = false;
        for (const n of e.names) {
            if (evidence) break;
            evidence = identifierEvidence(n, new Set<string>(), 0);
            if (!evidence) {
                writeOnly = new RegExp(
                    `(mkdirSync|writeFileSync|appendFileSync|copyFileSync)\\([^)]*\\b${n}\\b`,
                ).test(src);
            }
        }
        const hit: Finding = { rel, names: [...e.names].join(',') || '(inline)', evidence: evidence ?? '—' };
        if (evidence) confirmed.push(hit);
        else if (!writeOnly) unproven.push(hit);
    }

    const push = (target: Finding[], other: Finding[], rel: string, names: string, evidence: string): void => {
        if (!missing(rel)) return;
        if (confirmed.some((h) => h.rel === rel) || other.some((h) => h.rel === rel)) return;
        target.push({ rel, names, evidence });
    };
    for (const [rel, ev] of specHits) push(confirmed, [], rel, '(spec-table)', ev);
    for (const rel of specUnproven) push(unproven, unproven, rel, '(spec-table)', '—');
    for (const [rel, ev] of arrayHits) push(confirmed, [], rel, '(array)', ev);
    for (const rel of arrayUnproven) push(unproven, unproven, rel, '(array)', '—');

    return { confirmed, unproven };
}

/**
 * In-process guard: the dual fixture — the one case that pins BOTH directions
 * of the precision/recall trade. A spec-table root (the `lint_namespace` shape)
 * must be confirmed; a predicate-only iteration (the `check_gate_paths` shape)
 * must not. Every other fixture lives in the test file; this one runs in
 * production because a blind extractor must refuse to report at all.
 */
export function selfTest(repoRoot: string): boolean {
    const fixture = [
        "const SRC_J = path.join(ROOT, 'agents', 'sweep-selftest-absent-j');",
        "const TARGETS_J = [{ kind: 'skill', root: path.join(SRC_J, 'skills'), glob: '*.md' }];",
        'function _globJ(p, g) { return fs.readdirSync(p).filter((x) => x.endsWith(g)); }',
        'for (const { kind, root, glob } of TARGETS_J) { _globJ(root, glob); }',
        "const ALLOW_K = [{ label: 'x', root: path.join(ROOT, 'agents', 'sweep-selftest-absent-k') }];",
        'for (const { label, root } of ALLOW_K) { if (target.startsWith(root)) { ok = true; } }',
    ].join('\n');
    const { confirmed, unproven } = analyze(fixture, repoRoot);
    const c = new Set(confirmed.map((h) => h.rel));
    const u = new Set(unproven.map((h) => h.rel));
    return (
        c.has('agents/sweep-selftest-absent-j/skills') &&
        !c.has('agents/sweep-selftest-absent-k') &&
        u.has('agents/sweep-selftest-absent-k')
    );
}

export function loadLedger(file: string): Disposition[] {
    if (!fs.existsSync(file)) return [];
    const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as Disposition[];
    return Array.isArray(data) ? data : [];
}

interface Args {
    quiet: boolean;
    json: string | null;
    scripts: string;
    ledger: string;
}

export function parseArgs(argv: string[]): Args {
    const a: Args = { quiet: false, json: null, scripts: DEFAULT_SCRIPTS, ledger: DEFAULT_LEDGER };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--quiet') a.quiet = true;
        else if (arg === '--json') a.json = argv[(i += 1)] ?? '';
        else if (arg === '--root') a.scripts = path.resolve(REPO, argv[(i += 1)] ?? DEFAULT_SCRIPTS);
        else if (arg === '--ledger') a.ledger = path.resolve(REPO, argv[(i += 1)] ?? DEFAULT_LEDGER);
        else {
            process.stderr.write(`sweep_dead_scan_roots: unrecognized argument: ${arg}\n`);
            process.exit(2);
        }
    }
    return a;
}

export function main(argv: string[]): number {
    const args = parseArgs(argv);
    const repoRoot = path.resolve(args.scripts, '..', '..');

    if (!selfTest(repoRoot)) {
        process.stderr.write(
            'sweep_dead_scan_roots: SELF-TEST FAILED — the extractor is blind on a pinned mode, refusing to report.\n',
        );
        return 2;
    }

    let ledger: Disposition[];
    try {
        ledger = loadLedger(args.ledger);
    } catch (exc) {
        process.stderr.write(`sweep_dead_scan_roots: unreadable ledger — ${String(exc)}\n`);
        return 3;
    }
    if (ledger.length > LEDGER_CAP) {
        process.stderr.write(
            `sweep_dead_scan_roots: ledger has ${ledger.length} entries (cap ${LEDGER_CAP}) — ` +
                're-litigate the dispositions before adding more.\n',
        );
        return 3;
    }

    const pop = fs.existsSync(args.scripts)
        ? fs.readdirSync(args.scripts).filter((f) => GATE_RE.test(f)).sort()
        : [];
    const results = new Map<string, Analysis>();
    for (const f of pop) {
        const r = analyze(fs.readFileSync(path.join(args.scripts, f), 'utf-8'), repoRoot);
        if (r.confirmed.length || r.unproven.length) results.set(f, r);
    }

    const used = new Set<Disposition>();
    const disposed = (script: string, rel: string): Disposition | undefined => {
        const hit = ledger.find((l) => l.script === script && l.rel === rel);
        if (hit) used.add(hit);
        return hit;
    };

    let classA = 0;
    const lines: string[] = [];
    for (const [script, r] of results) {
        for (const h of r.confirmed) {
            const d = disposed(script, h.rel);
            if (d) {
                lines.push(`  CONFIRMED ${script}: ${h.rel} — known-benign (${d.category}): ${d.reason}`);
                continue;
            }
            const cls = classify(h.rel);
            if (cls === 'A') classA += 1;
            lines.push(`  CONFIRMED [${cls}] ${script}: ${h.rel} [${h.evidence}] (${h.names})`);
        }
        for (const h of r.unproven) {
            const d = disposed(script, h.rel);
            lines.push(
                d
                    ? `  unproven  ${script}: ${h.rel} — known-benign (${d.category}): ${d.reason}`
                    : `  unproven  [${classify(h.rel)}] ${script}: ${h.rel} (${h.names})`,
            );
        }
    }

    const stale = ledger.filter((l) => !used.has(l));
    const confirmedCount = [...results.values()].reduce((n, r) => n + r.confirmed.length, 0);
    const unprovenCount = [...results.values()].reduce((n, r) => n + r.unproven.length, 0);

    if (args.json) {
        fs.mkdirSync(path.dirname(args.json), { recursive: true });
        fs.writeFileSync(
            args.json,
            `${JSON.stringify(
                {
                    population: pop.length,
                    confirmed: confirmedCount,
                    unproven: unprovenCount,
                    class_a: classA,
                    stale: stale.map((s) => `${s.script}:${s.rel}`),
                    findings: [...results].map(([script, r]) => ({ script, ...r })),
                },
                null,
                2,
            )}\n`,
        );
    }

    if (!args.quiet) {
        process.stdout.write(`sweep_dead_scan_roots: ${pop.length} gate script(s) scanned\n`);
        for (const l of lines) process.stdout.write(`${l}\n`);
    }

    if (stale.length) {
        process.stderr.write(
            `⚠️  STALE ledger entries (no matching finding — the code moved, re-review): ` +
                `${stale.map((l) => `${l.script}:${l.rel}`).join(', ')}\n`,
        );
    }

    // Real findings outrank ledger hygiene — never let bookkeeping mask a dead gate.
    const exit = classA > 0 ? 1 : stale.length > 0 ? 3 : 0;
    if (!args.quiet || exit !== 0) {
        process.stdout.write(
            `sweep_dead_scan_roots: ${confirmedCount} confirmed, ${unprovenCount} unproven, ` +
                `${classA} class-A, ${stale.length} stale → exit ${exit}\n`,
        );
    }
    return exit;
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(_HERE)) {
    process.exit(main(process.argv.slice(2)));
}
