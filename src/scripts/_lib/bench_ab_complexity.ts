/**
 * Cognitive complexity per function — the T2 endpoint of the Phase-3 metric pair
 * (`internal/bench/ab-v2-phase3-PREREG.md`), S0.3 delta #11.
 *
 * WHY THIS EXISTS. The size claim is a **pair**, never a single number: an arm
 * may only claim a size win if median added lines fell *without* median
 * cognitive complexity per changed function rising. Lines down and complexity up
 * is golfing, and a lines-only report actively rewards it. Until this endpoint
 * existed, T1 could not be evaluated either — half a pair is no result, not a
 * partial one — which is why a granted spend ceiling sat unspent.
 *
 * WHAT IT COMPUTES. Cognitive complexity as published by G. Ann Campbell
 * (SonarSource, 2018): a score that rises with how hard control flow is to
 * *follow*, not with how many paths exist. Three rules, applied to a
 * tree-sitter AST:
 *
 *   1. **Increment** for each break in the linear flow — `if`, `else if`,
 *      `else`, `for`, `foreach`, `while`, `do`, `catch`, `switch`, the ternary,
 *      and a `break`/`continue` that targets a label.
 *   2. **Nesting penalty**: a structure from rule 1 that *nests* costs its own
 *      +1 plus the current nesting depth. `else`/`else if` take the flat +1 and
 *      never a nesting penalty, because they add no new indentation to follow.
 *   3. **Sequences of binary logical operators** cost +1 per *sequence*, not per
 *      operator: `a && b && c` is one increment, `a && b || c` is two.
 *
 * WHY NOT A MATURE TOOL — the ladder, walked rather than asserted. The roadmap
 * text says complexity "is computed deterministically per stack by mature
 * tooling", so the alternatives were checked in the order
 * [`improve-before-implement`](../../rules/improve-before-implement.md) § ladder
 * requires. Reuse-in-repo: nothing computes complexity anywhere in the tree.
 * Installed dependency: `eslint` ships a `complexity` rule, but that is
 * **cyclomatic**, which is the metric F9 explicitly rejects — it scores a flat
 * `switch` above a triply-nested `if`, so it cannot detect golfing.
 * `eslint-plugin-sonarjs` implements the real metric and is **not installed**,
 * covers JS/TS only, and would leave the corpus's PHP fixtures unmeasured. The
 * ABI-pinned tree-sitter pair already in this repo parses all three languages
 * the corpus actually contains, and `code_graph/loader.ts` already wraps it. So
 * this module is a **new implementation over an existing parser**, not a new
 * dependency — the smallest rung that carries the requirement.
 *
 * TWO DEVIATIONS FROM THE PUBLISHED METRIC, NAMED RATHER THAN BURIED. Both are
 * deliberate and neither favours a treatment arm, because the metric is only
 * ever compared against itself across arms:
 *
 *   - **No recursion increment.** Campbell adds +1 for a recursive call. That
 *     needs name resolution against a call graph; the fragility it would buy is
 *     not worth one point on a metric used only for a paired comparison.
 *   - **A nested function is its own unit.** Campbell attributes a nested
 *     function's score to its enclosing method. Here every function, method,
 *     arrow and closure is scored separately and enters the median as its own
 *     observation. The endpoint is defined as complexity *per function*, so
 *     rolling a closure into its parent would make one long function with three
 *     small closures indistinguishable from one dense one.
 *
 * UNSUPPORTED FILES ARE REPORTED, NEVER SCORED ZERO. A `.py` or `.sql` fixture
 * has no grammar here; it lands in `unsupported_files` and contributes no
 * observation. A zero would read as "this file is simple", which is a different
 * claim from "we cannot measure it" — the same distinction the cost sheet draws
 * between an unpriceable model and a free one.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { getParser, type TsNode } from '../code_graph/loader.js';
import { EXT_LANG, type Lang } from '../code_graph/types.js';

export interface FunctionComplexity {
    /** Declared name, or `<anon>` for an unnamed closure/arrow. */
    name: string;
    /** 1-based line of the function's first token. */
    line: number;
    complexity: number;
}

export interface FileComplexity {
    path: string;
    /** `null` when no grammar covers the extension — then `functions` is empty. */
    lang: Lang | null;
    functions: FunctionComplexity[];
}

export interface ComplexityRollup {
    /** Median complexity across every scored function; `null` when none were scored. */
    median: number | null;
    /** How many function units the median is over. */
    n_functions: number;
    /** Changed files whose extension no grammar covers — measured as nothing, not as zero. */
    unsupported_files: string[];
    /** Changed files that were missing on disk (deleted by the run). */
    missing_files: string[];
    per_file: FileComplexity[];
}

// ── node vocabulary ────────────────────────────────────────────────────────
//
// Every set below was read off a real parse (probe over the three grammars),
// never inferred from the language spec — a node type that does not exist in the
// grammar silently scores nothing, which is exactly the defect an unverified
// list produces.

/** A scored unit. Each contributes one observation to the median. */
const FUNCTION_NODES: Record<Lang, ReadonlySet<string>> = {
    javascript: new Set([
        'function_declaration',
        'function_expression',
        'generator_function',
        'generator_function_declaration',
        'arrow_function',
        'method_definition',
    ]),
    typescript: new Set([
        'function_declaration',
        'function_expression',
        'generator_function',
        'generator_function_declaration',
        'arrow_function',
        'method_definition',
    ]),
    php: new Set([
        'function_definition',
        'method_declaration',
        'anonymous_function_creation_expression',
        'anonymous_function',
        'arrow_function',
    ]),
};

/** +1 **and** a nesting penalty, and raises nesting for everything inside. */
const NESTING_NODES: Record<Lang, ReadonlySet<string>> = {
    javascript: new Set([
        'if_statement',
        'for_statement',
        'for_in_statement',
        'while_statement',
        'do_statement',
        'switch_statement',
        'catch_clause',
        'ternary_expression',
    ]),
    typescript: new Set([
        'if_statement',
        'for_statement',
        'for_in_statement',
        'while_statement',
        'do_statement',
        'switch_statement',
        'catch_clause',
        'ternary_expression',
    ]),
    php: new Set([
        'if_statement',
        'for_statement',
        'foreach_statement',
        'while_statement',
        'do_statement',
        'switch_statement',
        // PHP 8 `match` is `switch`'s expression twin and must score like it.
        // It was missing at first review and scored 0 against its `switch`
        // twin's 1 — a silent zero pointing in exactly the golfing direction
        // this endpoint exists to catch, since rewriting a `switch` as a
        // `match` is a textbook line-saving transform.
        'match_expression',
        'catch_clause',
        'conditional_expression',
    ]),
};

/** +1 flat, no nesting penalty and no nesting increase (`else`, `else if`). */
const FLAT_NODES: Record<Lang, ReadonlySet<string>> = {
    javascript: new Set(['else_clause']),
    typescript: new Set(['else_clause']),
    php: new Set(['else_clause', 'else_if_clause']),
};

const LOGICAL_OPERATORS: Record<Lang, ReadonlySet<string>> = {
    javascript: new Set(['&&', '||', '??']),
    typescript: new Set(['&&', '||', '??']),
    php: new Set(['&&', '||', '??', 'and', 'or', 'xor']),
};

const BINARY_NODES = new Set(['binary_expression']);

/** `break outer;` / `continue outer;` — a jump the reader must chase. */
const LABELLED_JUMP_NODES = new Set(['break_statement', 'continue_statement']);

// ── traversal helpers ──────────────────────────────────────────────────────

function namedChildren(n: TsNode): TsNode[] {
    const out: TsNode[] = [];
    for (let i = 0; i < n.namedChildCount; i += 1) {
        const c = n.namedChild(i);
        if (c) out.push(c);
    }
    return out;
}

/**
 * The operator token of a binary expression.
 *
 * `childForFieldName('operator')` is the accessor all three grammars answer, so
 * it is the primary path. The fallback scans the children for a token whose type
 * IS one of the operators we care about — an operator token's `type` is the
 * literal (`&&`, `||`, `??`), which is what makes this decidable without asking
 * whether a node is named.
 *
 * An earlier version fell back to "the first unnamed child", identified by
 * comparing node objects with `===`. That was wrong twice over: the WASM binding
 * re-creates a wrapper on every accessor call, so the identity test could never
 * return true, and the branch would have reported the LEFT OPERAND's type as the
 * operator. It was also unreachable, which is why the calibration suite stayed
 * green over it — a dead branch and a wrong branch hide each other.
 */
function binaryOperator(n: TsNode, lang: Lang): string | null {
    const field = n.childForFieldName('operator');
    if (field) return field.type;
    const ops = LOGICAL_OPERATORS[lang];
    for (let i = 0; i < n.childCount; i += 1) {
        const c = n.child(i);
        if (c && ops.has(c.type)) return c.type;
    }
    return null;
}

function functionName(n: TsNode): string {
    const nameNode = n.childForFieldName('name');
    if (nameNode && nameNode.text) return nameNode.text;
    return '<anon>';
}

/** `else { if (…) }` is a plain else; `else if (…)` is one construct, not two. */
function elseIfChild(n: TsNode): TsNode | null {
    const kids = namedChildren(n);
    if (kids.length === 1 && kids[0] && kids[0].type === 'if_statement') return kids[0];
    return null;
}

// ── the metric ─────────────────────────────────────────────────────────────

/**
 * Score one function body. `nesting` is the depth *inside* this unit, so it
 * starts at 0 for every function regardless of where the function itself sits.
 */
function scoreUnit(body: TsNode | null, lang: Lang, header: TsNode[]): number {
    let total = 0;

    const walk = (n: TsNode, nesting: number): void => {
        // A nested function is its own unit (see the deviation note above) — do
        // not descend into it here, and charge nothing for it.
        if (FUNCTION_NODES[lang].has(n.type)) return;

        if (FLAT_NODES[lang].has(n.type)) {
            total += 1;
            const inner = elseIfChild(n);
            if (inner) {
                // `else if` already paid its +1 above; score its condition and
                // body at the SAME nesting level, and skip the inner
                // if_statement's own increment.
                scoreIfInterior(inner, nesting);
                return;
            }
            for (const c of namedChildren(n)) walk(c, nesting);
            return;
        }

        if (NESTING_NODES[lang].has(n.type)) {
            total += 1 + nesting;
            for (const c of namedChildren(n)) walk(c, nesting + 1);
            return;
        }

        if (BINARY_NODES.has(n.type)) {
            const op = binaryOperator(n, lang);
            if (op && LOGICAL_OPERATORS[lang].has(op)) {
                // One increment per *sequence*: charge only when this operator
                // opens a new run, i.e. the parent run used a different operator.
                total += countLogicalSequences(n, lang);
                for (const c of logicalOperands(n, lang)) walk(c, nesting);
                return;
            }
        }

        if (LABELLED_JUMP_NODES.has(n.type) && namedChildren(n).length > 0) {
            total += 1;
        }

        for (const c of namedChildren(n)) walk(c, nesting);
    };

    /**
     * The interior of a JS/TS `else if` — everything inside it sits at the SAME
     * nesting as the outer `if`'s body, because `else if` adds no indentation a
     * reader has to track.
     *
     * `nesting` here is already the outer `if`'s *children* level (the
     * `else_clause` was reached from `walk(child, nesting + 1)`), so the interior
     * walks at `nesting` unchanged. Incrementing here was an off-by-one that made
     * `if (a) {} else if (b) { if (c) {} }` score 7 where the behaviourally
     * identical `else { if … }` and the PHP `elseif` twin both scored 6 — the JS
     * shape was the only one that took the penalty, because it is the only one
     * where the inner `if` is reached through a wrapper.
     */
    const scoreIfInterior = (ifNode: TsNode, nesting: number): void => {
        for (const c of namedChildren(ifNode)) walk(c, nesting);
    };

    for (const h of header) walk(h, 0);
    if (body) {
        for (const c of namedChildren(body)) walk(c, 0);
    }
    return total;
}

/**
 * Count operator *sequences* in a logical binary tree.
 *
 * `a && b && c` parses left-nested with the same operator throughout → 1.
 * `a && b || c` changes operator once → 2. The walk stops at any non-logical
 * node, whose operands are scored by the caller.
 */
function countLogicalSequences(root: TsNode, lang: Lang): number {
    let sequences = 0;
    const visit = (n: TsNode, parentOp: string | null): void => {
        if (!BINARY_NODES.has(n.type)) return;
        const op = binaryOperator(n, lang);
        if (!op || !LOGICAL_OPERATORS[lang].has(op)) return;
        if (op !== parentOp) sequences += 1;
        for (const c of namedChildren(n)) visit(c, op);
    };
    visit(root, null);
    return sequences;
}

/** Operands hanging off a logical tree — scored normally (they may nest more). */
function logicalOperands(root: TsNode, lang: Lang): TsNode[] {
    const out: TsNode[] = [];
    const visit = (n: TsNode): void => {
        for (const c of namedChildren(n)) {
            const op = BINARY_NODES.has(c.type) ? binaryOperator(c, lang) : null;
            if (op && LOGICAL_OPERATORS[lang].has(op)) {
                visit(c);
            } else {
                out.push(c);
            }
        }
    };
    visit(root);
    return out;
}

export function langForPath(relPath: string): Lang | null {
    const ext = path.extname(relPath).toLowerCase();
    return (EXT_LANG as Record<string, Lang | undefined>)[ext] ?? null;
}

/** Cognitive complexity of every function unit in one source string. */
export async function complexityForSource(relPath: string, source: string): Promise<FileComplexity> {
    const lang = langForPath(relPath);
    if (lang === null) return { path: relPath, lang: null, functions: [] };

    const parser = await getParser(lang);
    const tree = parser.parse(source);
    const functions: FunctionComplexity[] = [];
    try {
        const walk = (n: TsNode): void => {
            if (FUNCTION_NODES[lang].has(n.type)) {
                const body = n.childForFieldName('body');
                const header: TsNode[] = [];
                const params = n.childForFieldName('parameters');
                if (params) header.push(params);
                functions.push({
                    name: functionName(n),
                    line: n.startPosition.row + 1,
                    complexity: scoreUnit(body, lang, header),
                });
                // Descend anyway — nested functions are their own units.
                if (body) for (const c of namedChildren(body)) walk(c);
                return;
            }
            for (const c of namedChildren(n)) walk(c);
        };
        walk(tree.rootNode);
    } finally {
        tree.delete();
    }
    return { path: relPath, lang, functions };
}

/** Python-style median: the mean of the two middles for an even count. */
export function median(values: readonly number[]): number | null {
    if (values.length === 0) return null;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    if (s.length % 2 === 1) return s[mid] as number;
    return ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/**
 * Median cognitive complexity per changed function, over one workspace.
 *
 * `changed` is the scorer's own changed-file set, so the endpoint measures
 * exactly the functions the run touched — not the whole fixture, which would
 * drown a small diff in unchanged code and make the metric insensitive to the
 * thing it is supposed to detect.
 */
export async function medianComplexityPerChangedFunction(
    root: string,
    changed: Iterable<string>,
): Promise<ComplexityRollup> {
    const per_file: FileComplexity[] = [];
    const unsupported_files: string[] = [];
    const missing_files: string[] = [];
    const scores: number[] = [];

    for (const rel of [...changed].sort()) {
        const abs = path.join(root, rel);
        let source: string;
        try {
            source = fs.readFileSync(abs, 'utf8');
        } catch {
            missing_files.push(rel);
            continue;
        }
        const fc = await complexityForSource(rel, source);
        if (fc.lang === null) {
            unsupported_files.push(rel);
            continue;
        }
        per_file.push(fc);
        for (const f of fc.functions) scores.push(f.complexity);
    }

    return {
        median: median(scores),
        n_functions: scores.length,
        unsupported_files,
        missing_files,
        per_file,
    };
}
