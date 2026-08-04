#!/usr/bin/env tsx
/**
 * Classify every unhardened gate by WHERE its corpus count already lives.
 *
 * `road-to-gate-hardening-adoption` Phase 1 step 1 requires the conversion
 * work-list to be **produced by a script, not by reading**, with a `file:line`
 * per entry naming the place the count already exists. Reading 189 gates by eye
 * and calling the result a list is precisely the manufactured-evidence shape the
 * parent roadmap exists to kill, so the list is derived here.
 *
 * The population is not re-derived: it is imported from
 * `check_gate_coverage.list_unhardened_gates()`, the same function the ratchet
 * reads. A second regex would be a third opinion on "what is a gate" — the
 * disagreement Phase 3 exists to remove, not to widen.
 *
 * ## The classes
 *
 * - `count_at_exit` — a corpus-sized value is in scope at the gate's exit path
 *   (the entry function) and already gates its verdict. Converting these adds
 *   no semantic judgement: the number is published, not invented. **Phase 1.**
 * - `count_in_helper` — the corpus is counted, but only inside a helper; the
 *   entry function never sees the number. Hoisting it is a real (small) code
 *   decision. **Phase 2.**
 * - `no_corpus_count` — nothing array-shaped is counted anywhere. Watch-list
 *   gate, single-file gate, or legitimately-empty. **Phase 2**, per-gate.
 *
 * A "corpus producer" is a call whose callee name reads as collection-building
 * (`readdirSync`, `glob`, `walk`, `collect*`, `list*`, `iter_*`, …), or an array
 * pipeline (`.filter`/`.map`/`.flatMap`) whose receiver is itself a corpus.
 * Deliberately syntactic: the output is a work-list a human reviews per entry,
 * never an auto-conversion input.
 *
 * ## Corpus is not findings — the one distinction this script exists to make
 *
 * The first draft classified `errors.length` in `main()` as a count-at-exit and
 * would have nominated 146 gates for a mechanical `scanned:` line. That number
 * is the count of things WRONG, not of things READ, and publishing it as
 * coverage is risk #1 of this roadmap's register (manufactured green via
 * invented counts) implemented by the very tool meant to prevent it. So:
 *
 * - an accumulator (`const violations: X[] = []` then `.push`) is NEVER a corpus,
 *   regardless of name — a bare array literal is not a producer;
 * - a finding-shaped NAME (`errors`, `violations`, `hits`, `offenders`, …) is
 *   labelled `findings` and cannot promote a gate into Phase 1, even when it
 *   reached the set some other way.
 *
 * A gate lands in `count_at_exit` only when a **corpus**-kind site sits in its
 * entry function.
 *
 * CLI:
 *   ./scripts-run src/scripts/gate_scope_classify                # markdown table
 *   ./scripts-run src/scripts/gate_scope_classify --format json
 *   ./scripts-run src/scripts/gate_scope_classify --class count_at_exit
 *   ./scripts-run src/scripts/gate_scope_classify --out <file>   # write, else stdout only
 *
 * Exit codes: 0 always when the population could be read; 2 when it could not
 * (an empty population would make the classification vacuous, and a vacuous
 * work-list is the failure this whole track is about).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';

import { list_unhardened_gates } from './check_gate_coverage.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const GATE_DIR = path.join(REPO_ROOT, 'src/scripts');

export type ScopeClass = 'count_at_exit' | 'count_in_helper' | 'no_corpus_count';

/** What the counted value MEANS — the distinction that keeps Phase 1 honest. */
export type CountKind = 'corpus' | 'findings';

export interface CountSite {
    /** Repo-relative `file:line` where the count expression already exists. */
    at: string;
    /** The expression text, trimmed — evidence a reviewer can grep for. */
    expr: string;
    /** Name of the function the expression sits in (`<top-level>` when none). */
    fn: string;
    /** `corpus` = units read · `findings` = units wrong. Only `corpus` counts. */
    kind: CountKind;
}

export interface GateClassification {
    gate: string;
    cls: ScopeClass;
    /** Entry function the gate exits through, when one was identified. */
    entry: string | null;
    /** Count sites, exit-path ones first. */
    sites: CountSite[];
}

/** Callee names that build a collection. Matched on the called identifier. */
const PRODUCER_RE =
    /^(readdir|glob|walk|collect|list|gather|discover|enumerate|iter|scan|find|load|read_all|all)/i;

/** Array-pipeline methods: `x.filter(...)` is a corpus when `x` is one. */
const PIPELINE_METHODS = new Set(['filter', 'map', 'flatMap', 'concat', 'slice', 'sort']);

/**
 * Names that mean "things wrong", not "things read".
 *
 * A gate reaching its exit with only one of these in scope has NOT computed a
 * corpus size — the number is its verdict. Publishing it as `scanned:` would
 * make a gate that found 3 problems claim it inspected 3 units, which is the
 * false green the coverage guard reads as proof.
 */
const FINDINGS_RE =
    /^(err|errs|errors?|violations?|viols?|hits?|issues?|problems?|probs?|failures?|failed|offenders?|breaches?|findings?|warnings?|warns?|bad|missing|misses|stale|dupes?|duplicates?|collisions?|regressions?|over|under|orphans?|unresolved|broken|drift|gaps?|leaks?|mismatches?|empties|empty|red|green|passed)$/i;

/**
 * Loop bookkeeping, never a corpus size.
 *
 * `for (let i = 0; …) i += 1` makes `i` an incremented counter by the same test
 * that finds a real `checked` tally. Publishing a loop index as `scanned:` is
 * the invented-count failure in its purest form, so index-shaped names are
 * excluded by name AND `for`-initializer declarations are excluded by position.
 */
const LOOP_INDEX_RE = /^(i|j|k|n|x|y|idx|index|pos|cursor)$/;

/** Entry-function names, in preference order. */
const ENTRY_NAMES = ['main', 'run', 'cli', 'default'];

function _rel(abs: string): string {
    return path.relative(REPO_ROOT, abs).split(path.sep).join('/');
}

function _fnName(node: ts.Node): string {
    let cur: ts.Node | undefined = node;
    while (cur !== undefined) {
        if (ts.isFunctionDeclaration(cur) && cur.name !== undefined) return cur.name.text;
        if (ts.isMethodDeclaration(cur) && ts.isIdentifier(cur.name)) return cur.name.text;
        if (
            (ts.isFunctionExpression(cur) || ts.isArrowFunction(cur)) &&
            cur.parent !== undefined &&
            ts.isVariableDeclaration(cur.parent) &&
            ts.isIdentifier(cur.parent.name)
        ) {
            return cur.parent.name.text;
        }
        cur = cur.parent;
    }
    return '<top-level>';
}

/** The identifier a pipeline chain ultimately reads from (`a.filter().map()` → `a`). */
function _receiverRoot(expr: ts.Expression): string | null {
    let cur: ts.Expression = expr;
    for (;;) {
        if (ts.isIdentifier(cur)) return cur.text;
        if (ts.isCallExpression(cur)) {
            cur = cur.expression;
            continue;
        }
        if (ts.isPropertyAccessExpression(cur)) {
            cur = cur.expression;
            continue;
        }
        if (ts.isAwaitExpression(cur) || ts.isParenthesizedExpression(cur)) {
            cur = cur.expression;
            continue;
        }
        return null;
    }
}

/**
 * Is this initializer a corpus?
 *
 * `known` carries the corpus names found so far, so a pipeline resolves only
 * when its receiver is already a corpus — `errors.filter(...)` stays findings.
 * A bare `[]` is deliberately NOT a producer: that is the accumulator shape
 * every findings list in this repo uses.
 */
function _isProducer(init: ts.Expression | undefined, known: ReadonlySet<string>): boolean {
    if (init === undefined) return false;
    if (ts.isAwaitExpression(init) || ts.isParenthesizedExpression(init)) {
        return _isProducer(init.expression, known);
    }
    if (ts.isCallExpression(init)) {
        const callee = init.expression;
        if (ts.isIdentifier(callee)) {
            if (callee.text === 'Array' || callee.text === 'Object') return false;
            return PRODUCER_RE.test(callee.text);
        }
        if (ts.isPropertyAccessExpression(callee)) {
            const m = callee.name.text;
            if (PIPELINE_METHODS.has(m)) {
                const root = _receiverRoot(callee.expression);
                return root !== null && known.has(root) && !FINDINGS_RE.test(root);
            }
            if (m === 'from' || m === 'keys' || m === 'values' || m === 'entries') {
                const arg = init.arguments[0];
                if (arg === undefined) return false;
                const root = _receiverRoot(arg);
                return root !== null && known.has(root) && !FINDINGS_RE.test(root);
            }
            return PRODUCER_RE.test(m);
        }
    }
    return false;
}

/**
 * Collect every identifier in `src` that holds a corpus.
 *
 * Name-scoped, not symbol-scoped: two different `files` in two functions collapse
 * into one name. Acceptable — this is a work-list, and a false candidate costs a
 * reviewer one glance while a missed one costs a gate. Iterated to a fixpoint so
 * a corpus derived from a corpus (`const md = files.filter(...)`) is one too.
 */
export function corpusIdentifiers(src: ts.SourceFile): Set<string> {
    const decls: { name: string; init: ts.Expression | undefined }[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
            decls.push({ name: node.name.text, init: node.initializer });
        }
        ts.forEachChild(node, visit);
    };
    visit(src);

    const names = new Set<string>();
    for (let pass = 0; pass < 4; pass += 1) {
        const before = names.size;
        for (const d of decls) {
            if (FINDINGS_RE.test(d.name)) continue;
            if (_isProducer(d.init, names)) names.add(d.name);
        }
        if (names.size === before) break;
    }
    return names;
}

/** Identify the function a CLI entry exits through. */
export function entryFunction(src: ts.SourceFile): string | null {
    const declared = new Set<string>();
    const visit = (node: ts.Node): void => {
        if (ts.isFunctionDeclaration(node) && node.name !== undefined) declared.add(node.name.text);
        if (
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.initializer !== undefined &&
            (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
        ) {
            declared.add(node.name.text);
        }
        ts.forEachChild(node, visit);
    };
    visit(src);
    for (const n of ENTRY_NAMES) if (declared.has(n)) return n;
    return null;
}

/**
 * Find every `<corpus>.length` read, plus counter variables that a loop
 * increments — the two shapes a corpus size actually takes in this repo.
 */
export function countSites(src: ts.SourceFile, corpus: ReadonlySet<string>, file: string): CountSite[] {
    const sites: CountSite[] = [];
    const push = (node: ts.Node, expr: string, name: string): void => {
        const { line } = src.getLineAndCharacterOfPosition(node.getStart(src));
        sites.push({
            at: `${file}:${String(line + 1)}`,
            expr,
            fn: _fnName(node),
            kind:
                !FINDINGS_RE.test(name) &&
                !LOOP_INDEX_RE.test(name) &&
                !loopIndices.has(name) &&
                (corpus.has(name) || incremented.has(name))
                    ? 'corpus'
                    : 'findings',
        });
    };
    const incremented = new Set<string>();
    const loopIndices = new Set<string>();
    const findLoopIndices = (node: ts.Node): void => {
        if (ts.isForStatement(node) && node.initializer !== undefined && ts.isVariableDeclarationList(node.initializer)) {
            for (const d of node.initializer.declarations) {
                if (ts.isIdentifier(d.name)) loopIndices.add(d.name.text);
            }
        }
        ts.forEachChild(node, findLoopIndices);
    };
    findLoopIndices(src);

    const findIncrements = (node: ts.Node): void => {
        if (
            ts.isPostfixUnaryExpression(node) &&
            node.operator === ts.SyntaxKind.PlusPlusToken &&
            ts.isIdentifier(node.operand)
        ) {
            incremented.add(node.operand.text);
        }
        if (
            ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken &&
            ts.isIdentifier(node.left)
        ) {
            incremented.add(node.left.text);
        }
        ts.forEachChild(node, findIncrements);
    };
    findIncrements(src);

    const visit = (node: ts.Node): void => {
        if (
            ts.isPropertyAccessExpression(node) &&
            node.name.text === 'length' &&
            ts.isIdentifier(node.expression)
        ) {
            const name = node.expression.text;
            // Findings-shaped names are recorded too, labelled — a reviewer needs
            // to see that the only number at the exit is a verdict, not a corpus.
            if (corpus.has(name) || FINDINGS_RE.test(name)) push(node, `${name}.length`, name);
        }
        if (ts.isIdentifier(node) && incremented.has(node.text) && !ts.isVariableDeclaration(node.parent)) {
            // Only the reads matter; the increments themselves are not the count.
            const parent = node.parent;
            const isWrite =
                ts.isPostfixUnaryExpression(parent) ||
                ts.isPrefixUnaryExpression(parent) ||
                (ts.isBinaryExpression(parent) && parent.left === node);
            if (!isWrite) push(node, node.text, node.text);
        }
        ts.forEachChild(node, visit);
    };
    visit(src);
    return sites;
}

export function classifyGate(gate: string, dir = GATE_DIR): GateClassification {
    const abs = path.join(dir, `${gate}.ts`);
    const text = fs.readFileSync(abs, 'utf8');
    const src = ts.createSourceFile(abs, text, ts.ScriptTarget.ES2022, true);
    const entry = entryFunction(src);
    const sites = countSites(src, corpusIdentifiers(src), _rel(abs));
    const corpusSites = sites.filter((s) => s.kind === 'corpus');
    const atExit = entry === null ? [] : corpusSites.filter((s) => s.fn === entry);
    const ordered = [...atExit, ...sites.filter((s) => !atExit.includes(s))];
    const cls: ScopeClass =
        atExit.length > 0 ? 'count_at_exit' : corpusSites.length > 0 ? 'count_in_helper' : 'no_corpus_count';
    return { gate, cls, entry, sites: ordered };
}

export function classifyAll(gates: readonly string[], dir = GATE_DIR): GateClassification[] {
    const out: GateClassification[] = [];
    for (const g of gates) {
        try {
            out.push(classifyGate(g, dir));
        } catch {
            out.push({ gate: g, cls: 'no_corpus_count', entry: null, sites: [] });
        }
    }
    return out;
}

const CLASS_ORDER: ScopeClass[] = ['count_at_exit', 'count_in_helper', 'no_corpus_count'];

export function renderMarkdown(rows: readonly GateClassification[]): string {
    const byClass = new Map<ScopeClass, GateClassification[]>();
    for (const c of CLASS_ORDER) byClass.set(c, []);
    for (const r of rows) (byClass.get(r.cls) as GateClassification[]).push(r);

    const lines = [
        '# Unhardened-gate scope classification',
        '',
        'Generated by `./scripts-run src/scripts/gate_scope_classify`. Population comes',
        'from `check_gate_coverage.list_unhardened_gates()` — the same function the',
        '`gate-hardening:unhardened-scan-scope` ratchet reads, so this table and the',
        'ratchet cannot disagree about what a gate is.',
        '',
        `Population: **${String(rows.length)}** unhardened gate(s).`,
        '',
        '| Class | Gates | Meaning |',
        '|---|---:|---|',
        `| \`count_at_exit\` | ${String((byClass.get('count_at_exit') as GateClassification[]).length)} | The corpus size already exists in the entry function — publishing it invents nothing (Phase 1) |`,
        `| \`count_in_helper\` | ${String((byClass.get('count_in_helper') as GateClassification[]).length)} | Counted, but only inside a helper — hoisting is a real decision (Phase 2) |`,
        `| \`no_corpus_count\` | ${String((byClass.get('no_corpus_count') as GateClassification[]).length)} | Nothing array-shaped counted — watch-list, single-file, or legitimately empty (Phase 2) |`,
        '',
    ];
    for (const c of CLASS_ORDER) {
        const group = byClass.get(c) as GateClassification[];
        lines.push(`## \`${c}\` — ${String(group.length)} gate(s)`, '');
        if (group.length === 0) {
            lines.push('_none_', '');
            continue;
        }
        lines.push('| Gate | Entry | Count already at | Expression | Kind |', '|---|---|---|---|---|');
        for (const g of group) {
            const first = g.sites.find((s) => s.kind === 'corpus') ?? g.sites[0];
            lines.push(
                `| \`${g.gate}\` | ${g.entry === null ? '—' : `\`${g.entry}()\``} | ` +
                    `${first === undefined ? '—' : `\`${first.at}\``} | ` +
                    `${first === undefined ? '—' : `\`${first.expr}\` in \`${first.fn}()\``} | ` +
                    `${first === undefined ? '—' : first.kind} |`,
            );
        }
        lines.push('');
    }
    return lines.join('\n');
}

export function main(argv: readonly string[]): number {
    const gates = list_unhardened_gates();
    if (gates.length === 0) {
        process.stderr.write(
            'gate_scope_classify: the unhardened population is empty — either every gate is ' +
                'hardened (delete this script with the ratchet) or the population read failed.\n',
        );
        return 2;
    }
    let rows = classifyAll(gates);

    const ci = argv.indexOf('--class');
    if (ci >= 0 && argv[ci + 1] !== undefined) {
        const want = argv[ci + 1] as ScopeClass;
        rows = rows.filter((r) => r.cls === want);
    }

    const wantJson = argv.includes('--format') && argv[argv.indexOf('--format') + 1] === 'json';
    const body = wantJson
        ? `${JSON.stringify({ generated_by: 'gate_scope_classify', population: gates.length, rows }, null, 2)}\n`
        : renderMarkdown(rows);

    const oi = argv.indexOf('--out');
    if (oi >= 0 && argv[oi + 1] !== undefined) {
        const out = path.resolve(REPO_ROOT, argv[oi + 1] as string);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, body.endsWith('\n') ? body : `${body}\n`, 'utf8');
        process.stdout.write(`written: ${_rel(out)}\n`);
    } else {
        process.stdout.write(body.endsWith('\n') ? body : `${body}\n`);
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (argvUrl === import.meta.url) return true;
    try {
        return pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href === import.meta.url;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}
