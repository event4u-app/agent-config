#!/usr/bin/env tsx
/**
 * The promotion-path structural invariant — discharge route 1 of the carried
 * blocking condition on `road-to-harness-promotion-bridge`.
 *
 * WHY THIS GATE EXISTS
 * --------------------
 * The carried condition covers *"a verb, a state transition into `promoted`, or
 * any write into `src/` derived from a candidate"*. Before this gate, TWO of
 * those three limbs were enforced — `verbPromote` refuses unconditionally
 * (`src/scripts/evolution_lab.ts`), and `assertTransition(_, 'promoted')`
 * refuses without a named approver (`src/scripts/_lib/candidate_record.ts`) —
 * and the third was enforced by nothing. The AI council of 2026-08-31 ruled the
 * condition NOT DISCHARGED on exactly that gap, and named the discharging
 * mechanism: an invariant that *inventories* every lifecycle-record write site
 * and every `src/` write site and *fails* when a promotion-capable write does
 * not pass through ONE guarded capability, where the capability is unobtainable
 * while `blocker: merge-authority` is open.
 *
 * `src/scripts/_lib/promotion_capability.ts` is that capability. This is that
 * invariant.
 *
 * THE FOUR RULES
 * --------------
 *   R0  the capability is UNOBTAINABLE while the blocker is open. Probed by
 *       calling `acquirePromotionCapability` and requiring it to throw. This is
 *       executed, not read: a text match would pass over a module whose refusal
 *       had been edited into a no-op.
 *   R1  no approval synthesis outside {@link R1_ALLOWLIST}. Any construction of
 *       a `HumanApproval`, any reference to the type, and any three-argument
 *       `assertTransition(...)` call — the argument that supplies the approval.
 *   R2  no promoted-state record write outside {@link R2_ALLOWLIST}. A record
 *       literal carrying `lifecycle: 'promoted'` (or `ACCEPTED_STATE`) bypasses
 *       the transition gate entirely, which is the second bypass vector both
 *       council seats named.
 *   R3  no candidate-derived write into the repository source tree. A module
 *       that reads candidate data may not target `src/` with a filesystem
 *       write. This is the THIRD LIMB, the one nothing gated before.
 *
 * ANTI-VACUITY — this gate fails when it scans nothing
 * ----------------------------------------------------
 * Risk 2 of the roadmap's register is that a check over a population of zero
 * discharges the condition while scanning nothing, and the condition's own text
 * forbids exactly that. Three floors, all fail-closed:
 * {@link MIN_FILES} source files, {@link MIN_CANDIDATE_MODULES} modules that
 * actually read candidate data, and {@link MIN_WRITE_SITES} filesystem-write
 * sites inside them. Below any of them the gate exits 2 — the population moved
 * or the scanner broke, and either way its green would be false.
 *
 * **Gaming risk.** The cheapest degenerate pass is prose relocation: this gate
 * strips block comments and whole-line `//` comments before matching, so a
 * bypass written inside a block comment is invisible to it. That is deliberate
 * and the direction is safe — this module and its neighbours DOCUMENT the
 * constructs they refuse, and a gate that failed on its own documentation would
 * be a reason to stop documenting it. A trailing `//` comment is NOT stripped,
 * so prose there trips the gate rather than hiding a construct. Second
 * degenerate pass: adding a file to {@link R1_ALLOWLIST} / {@link R2_ALLOWLIST}.
 * Mitigation — the allowlists are literals in this file, so growing one is a
 * visible diff, and `tests/scripts/lint_promotion_paths.test.ts` pins their exact
 * membership so a silent addition fails a test rather than passing review.
 * **Residual, stated rather than implied:** R3 resolves `const` bindings up to
 * {@link CONST_HOPS} hops, so a destination assembled at runtime from a value
 * carrying no `src` literal anywhere in its chain is not detectable textually.
 * That residual is bounded rather than closed — such a write is a source-tree
 * write, but it is only a PROMOTION when it also carries an approval or a
 * promoted record, which R1 and R2 catch independently.
 *
 * ADVISORY STAGE — satisfied by measurement, not by absence. Run against the
 * real corpus at authoring time this gate produced ZERO findings over 2812
 * source and test files, 16 candidate-derived modules and 66 write sites, and
 * it found and fixed two of its own defects on the way (a substitution that
 * rewrote identifiers inside string literals, and an expansion that destroyed
 * the `REPO_ROOT` token it keys on). It therefore lands at
 * error with an empty baseline rather than as a wall over a frozen corpus.
 * There is no `gate-violation-baselines.json` entry to promote FROM: the
 * promotion condition would be "promote to error when the baseline reaches 0",
 * and it is 0 on arrival.
 *
 * Exit codes: 0 clean · 1 a promotion-capable bypass · 2 misuse or dead scope.
 *
 * Usage:
 *   ./scripts-run src/scripts/lint_promotion_paths [--root <dir>] [--quiet]
 *   ./scripts-run src/scripts/lint_promotion_paths --self-test
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { assertScanned, DeadScopeError, reportScanned } from './_lib/scan_scope.js';
import {
    PromotionCapabilityUnobtainableError,
    REPO_SOURCE_ROOT,
    acquirePromotionCapability,
    isRefusingStatus,
    readMergeAuthorityStatus,
} from './_lib/promotion_capability.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(HERE, '..', '..');

export const GATE = 'lint_promotion_paths';

/** Roots walked for R1 and R2 — the authored source tree. */
export const SOURCE_ROOTS: readonly string[] = ['src'];

/**
 * Roots walked additionally for R3.
 *
 * Tests are OUT of R1/R2 scope and IN R3 scope, and the asymmetry is deliberate:
 * a test must be able to construct the refused shape in order to test the
 * refusal, and no test has any business writing into the source tree.
 */
export const R3_EXTRA_ROOTS: readonly string[] = ['tests'];

/**
 * This gate's own file.
 *
 * A detector has to NAME what it detects — the patterns below and the self-test
 * fixtures beside them contain every construct this gate refuses. A gate that
 * failed on its own detector is the false-positive shape
 * `check_no_currency_in_cost_surfaces` already solved the same way, and its
 * discrimination is proven by `--self-test` against planted fixtures rather
 * than by scanning itself.
 */
export const GATE_SELF = 'src/scripts/lint_promotion_paths.ts';

/**
 * This gate's paired fixture file, for the same reason and with the same bound.
 *
 * `tests/scripts/lint_promotion_paths.test.ts` carries every construct this gate
 * refuses, as string fixtures fed to the detectors — including a literal
 * `import ... candidate_record.js`, which makes `isCandidateDerived` read the
 * test itself as a candidate module. It ships nothing and can promote nothing;
 * its membership here is pinned by an assertion inside that very file, so
 * widening the allowlist is a visible diff in two places rather than one.
 */
export const GATE_TEST = 'tests/scripts/lint_promotion_paths.test.ts';

/**
 * R1 allowlist — the files that may name a human approval.
 *
 * `candidate_record.ts` DEFINES `HumanApproval` and the transition gate;
 * `promotion_capability.ts` is the one guarded mint. Anywhere else, naming the
 * type is doing approval work outside the capability.
 */
export const R1_ALLOWLIST: readonly string[] = [
    'src/scripts/_lib/candidate_record.ts',
    'src/scripts/_lib/promotion_capability.ts',
    GATE_SELF,
    GATE_TEST,
];

/** R2 allowlist — narrower on purpose. Only the capability may express a promotion. */
export const R2_ALLOWLIST: readonly string[] = ['src/scripts/_lib/promotion_capability.ts', GATE_SELF, GATE_TEST];

/** R3 allowlist — the capability performs no write at all, and is listed for symmetry. */
export const R3_ALLOWLIST: readonly string[] = ['src/scripts/_lib/promotion_capability.ts', GATE_SELF, GATE_TEST];

/** Modules whose import marks a file as reading candidate data. */
export const CANDIDATE_DATA_MODULES: readonly string[] = [
    'candidate_record',
    'candidate_proposer',
    'curator_ops',
    'bench_ab_clone',
    'promotion_evidence',
    'promotion_review',
];

/** Anti-vacuity floors. Below any of these the population moved or the scanner broke. */
export const MIN_FILES = 400;
export const MIN_CANDIDATE_MODULES = 4;
export const MIN_WRITE_SITES = 10;

/** How far R3 follows a `const` binding when resolving a write destination. */
export const CONST_HOPS = 3;

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'clones', '__pycache__']);

export interface Finding {
    rule: 'R0' | 'R1' | 'R2' | 'R3';
    file: string;
    line: number;
    what: string;
    text: string;
}

// ------------------------------------------------------------------ scanning

/**
 * Remove block comments and WHOLE-LINE `//` comments, preserving line count.
 *
 * A trailing `//` comment is left in place on purpose — stripping it would let a
 * construct hide behind a preceding string containing `//`, and that is a
 * cheaper bypass than the false positive it would prevent.
 */
export function stripComments(source: string): string {
    const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    return noBlocks
        .split('\n')
        .map((l) => (/^\s*\/\//.test(l) ? '' : l))
        .join('\n');
}

/** Does this file import anything that reads candidate data? */
export function isCandidateDerived(source: string): boolean {
    const body = stripComments(source);
    return CANDIDATE_DATA_MODULES.some((m) =>
        new RegExp(`from\\s+['"][^'"]*${m}(\\.js)?['"]`).test(body),
    );
}

function lineOf(body: string, index: number): number {
    let n = 1;
    for (let i = 0; i < index && i < body.length; i += 1) {
        if (body[i] === '\n') n += 1;
    }
    return n;
}

/**
 * Split a call's argument list into top-level arguments.
 *
 * `open` is the index of the `(`. Returns `null` when the parentheses do not
 * balance within the file, which is a parse failure rather than a pass.
 */
export function callArguments(body: string, open: number): string[] | null {
    let depth = 0;
    let quote: string | null = null;
    const args: string[] = [];
    let current = '';
    for (let i = open; i < body.length; i += 1) {
        const c = body[i] as string;
        if (quote !== null) {
            current += c;
            if (c === '\\') {
                current += body[i + 1] ?? '';
                i += 1;
            } else if (c === quote) {
                quote = null;
            }
            continue;
        }
        if (c === "'" || c === '"' || c === '`') {
            quote = c;
            current += c;
            continue;
        }
        if (c === '(' || c === '[' || c === '{') {
            depth += 1;
            if (depth === 1 && c === '(') continue;
            current += c;
            continue;
        }
        if (c === ')' || c === ']' || c === '}') {
            depth -= 1;
            if (depth === 0 && c === ')') {
                args.push(current);
                return args;
            }
            current += c;
            continue;
        }
        if (c === ',' && depth === 1) {
            args.push(current);
            current = '';
            continue;
        }
        current += c;
    }
    return null;
}

// --------------------------------------------------------------------- R1

/**
 * Approval synthesis: constructing, typing, or supplying a human approval.
 *
 * The `approver:` / `approvedAt:` detectors are CONSTRUCTION-specific — an
 * interface field declaration (`readonly approver: string;`) is a type position
 * and is excluded by the negative lookahead, so the definition site does not
 * have to be allowlisted for the wrong reason.
 */
export function findApprovalSites(source: string): Finding[] {
    const body = stripComments(source);
    const out: Finding[] = [];
    const patterns: Array<[string, RegExp]> = [
        ['approver-construction', /\bapprover\s*:\s*(?!(?:string|number|boolean|unknown|any)\b)\S/g],
        ['approvedAt-construction', /\bapprovedAt\s*:\s*(?!(?:string|number|boolean|unknown|any)\b)\S/g],
        ['HumanApproval-reference', /\bHumanApproval\b/g],
        ['assertHumanApproval-reference', /\bassertHumanApproval\b/g],
    ];
    for (const [what, re] of patterns) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(body)) !== null) {
            out.push({
                rule: 'R1',
                file: '',
                line: lineOf(body, m.index),
                what,
                text: (body.split('\n')[lineOf(body, m.index) - 1] ?? '').trim().slice(0, 120),
            });
        }
    }
    // A three-argument `assertTransition(from, to, approval)` supplies the
    // approval the two-argument form cannot. The DECLARATION is excluded by the
    // preceding-`function` test — its parameter list also carries two commas.
    const callRe = /\bassertTransition\s*\(/g;
    let c: RegExpExecArray | null;
    while ((c = callRe.exec(body)) !== null) {
        const before = body.slice(Math.max(0, c.index - 40), c.index);
        if (/\bfunction\s*$/.test(before)) continue;
        const args = callArguments(body, body.indexOf('(', c.index));
        if (args !== null && args.length >= 3) {
            out.push({
                rule: 'R1',
                file: '',
                line: lineOf(body, c.index),
                what: 'assertTransition-with-approval',
                text: args.map((a) => a.trim()).join(', ').slice(0, 120),
            });
        }
    }
    return out;
}

// --------------------------------------------------------------------- R2

/** A record literal that names the accepted state directly, bypassing the transition. */
export function findPromotedWriteSites(source: string): Finding[] {
    const body = stripComments(source);
    const out: Finding[] = [];
    const patterns: Array<[string, RegExp]> = [
        ['promoted-literal', /\blifecycle\s*:\s*['"`]promoted['"`]/g],
        ['accepted-state-write', /\blifecycle\s*:\s*ACCEPTED_STATE\b/g],
    ];
    for (const [what, re] of patterns) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(body)) !== null) {
            out.push({
                rule: 'R2',
                file: '',
                line: lineOf(body, m.index),
                what,
                text: (body.split('\n')[lineOf(body, m.index) - 1] ?? '').trim().slice(0, 120),
            });
        }
    }
    return out;
}

// --------------------------------------------------------------------- R3

/** Write calls, and which argument carries the DESTINATION. */
export const WRITE_CALLS: Readonly<Record<string, number>> = {
    writeFileSync: 0,
    writeFile: 0,
    appendFileSync: 0,
    appendFile: 0,
    mkdirSync: 0,
    rmSync: 0,
    rmdirSync: 0,
    unlinkSync: 0,
    createWriteStream: 0,
    outputFileSync: 0,
    copyFileSync: 1,
    cpSync: 1,
    renameSync: 1,
    linkSync: 1,
    symlinkSync: 1,
};

/**
 * Tokens that root a path at the REPOSITORY, as opposed to a clone or a tmpdir.
 *
 * The discriminator matters: `join(victim, 'src', 'smuggled.ts')` in
 * `tests/scripts/bench_ab_candidate.test.ts:384` writes into a CLONE's `src/`,
 * which is a candidate's own sandbox and is already gated — by
 * `bench_ab_integrity`'s allowed-delta-path check, whose sensitivity that very
 * test proves. Promotion is a candidate reaching CANONICAL `agent-config`, so
 * this rule is anchored at the repository root and says so.
 */
export const REPO_ROOT_TOKENS = /\b(?:REPO_ROOT|CAPABILITY_REPO_ROOT|repoRoot|repo_root|ROOT|root|cwd)\b/;

/** A string literal naming `src` as a path segment. */
const SRC_SEGMENT = new RegExp(`['"\`]${REPO_SOURCE_ROOT}['"\`]`);

/** A destination given as a bare repo-relative literal — `'src/...'`, `"src"`. */
const SRC_FIRST_LITERAL = new RegExp(`^\\s*['"\`]${REPO_SOURCE_ROOT}(?:/|['"\`])`);

/**
 * Does this write destination resolve to the canonical source tree?
 *
 * Two accepted shapes, and nothing else: a repo-root token joined with a `src`
 * segment, or a destination whose FIRST component is a `src`-rooted literal.
 * `original` is the unexpanded expression, because the first-component test is
 * about how the destination was written, not about what it expands to; the
 * two-shape test below reads the UNION of both, for the reason stated in the
 * body.
 */
export function targetsCanonicalSource(original: string, expanded: string): boolean {
    if (SRC_FIRST_LITERAL.test(original)) {
        return true;
    }
    // Both texts, unioned. Expansion can DESTROY the signal as easily as reveal
    // it: `REPO_ROOT` is itself a `const`, so substituting it replaces the very
    // token this rule keys on — measured, on the first sensitivity probe, which
    // fired R1 and R2 on a planted bypass and missed its R3 half entirely.
    const combined = `${original} ${expanded}`;
    return REPO_ROOT_TOKENS.test(combined) && SRC_SEGMENT.test(combined);
}

/** Module- and function-level `const NAME = <expr>;` bindings, for one-name resolution. */
export function constBindings(body: string): Map<string, string> {
    const out = new Map<string, string>();
    const re = /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*([^;\n]*(?:\n[^;]*)?);/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
        const name = m[1] as string;
        if (!out.has(name)) out.set(name, (m[2] as string).replace(/\s+/g, ' '));
    }
    return out;
}

/**
 * Substitute bound identifiers into `expr`, up to {@link CONST_HOPS} hops.
 *
 * Substitution IN PLACE rather than accumulation: an earlier draft appended each
 * binding's value to a growing string and then matched over the whole thing, so
 * one unrelated binding anywhere in the chain contaminated the verdict — it
 * reported `rmSync(scratch)` in a test as a write into `src/`. Callees are not
 * expanded (`join(...)` is a function, not a path), and a binding longer than
 * {@link MAX_BINDING_CHARS} is skipped because an object or an array literal is
 * not a path expression.
 */
export const MAX_BINDING_CHARS = 200;

export function expandExpression(expr: string, bindings: Map<string, string>): string {
    let current = expr;
    for (let hop = 0; hop < CONST_HOPS; hop += 1) {
        const next = substituteOutsideStrings(current, (name, followedByCall) => {
            if (followedByCall) return name;
            const value = bindings.get(name);
            if (value === undefined || value === name || value.length > MAX_BINDING_CHARS) return name;
            return `(${value})`;
        });
        if (next === current) break;
        current = next;
    }
    return current;
}

/**
 * Apply `replace` to identifiers in CODE positions only, never inside a string
 * literal.
 *
 * The second defect this function exists for, and it was found by running the
 * gate rather than by reading it: substituting over the raw text rewrote the
 * identifier `cand` INSIDE the literal `'ac-cand-'`, because `-` is a word
 * boundary. The injected value happened to carry `join(REPO_ROOT, 'src', ...)`,
 * so a `rmSync(scratch)` on a temp directory was reported as a write into the
 * source tree. A substitution that can edit string contents is not resolving a
 * path expression, it is corrupting one.
 */
export function substituteOutsideStrings(
    source: string,
    replace: (name: string, followedByCall: boolean) => string,
): string {
    let out = '';
    let code = '';
    let quote: string | null = null;
    const flush = (): void => {
        out += code.replace(/\b[A-Za-z_$][\w$]*\b/g, (name, offset: number, whole: string) =>
            replace(name, whole[offset + name.length] === '('),
        );
        code = '';
    };
    for (let i = 0; i < source.length; i += 1) {
        const c = source[i] as string;
        if (quote !== null) {
            out += c;
            if (c === '\\') {
                out += source[i + 1] ?? '';
                i += 1;
            } else if (c === quote) {
                quote = null;
            }
            continue;
        }
        if (c === "'" || c === '"' || c === '`') {
            flush();
            quote = c;
            out += c;
            continue;
        }
        code += c;
    }
    flush();
    return out;
}

export interface WriteSite {
    line: number;
    fn: string;
    dest: string;
    targetsSource: boolean;
}

/** Every filesystem-write site in a module, with its destination classified. */
export function findWriteSites(source: string): WriteSite[] {
    const body = stripComments(source);
    const bindings = constBindings(body);
    const out: WriteSite[] = [];
    const re = new RegExp(`\\b(${Object.keys(WRITE_CALLS).join('|')})\\s*\\(`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
        const fn = m[1] as string;
        const before = body.slice(Math.max(0, m.index - 40), m.index);
        if (/\bfunction\s*$/.test(before)) continue;
        const args = callArguments(body, body.indexOf('(', m.index));
        if (args === null) continue;
        const destIndex = WRITE_CALLS[fn] as number;
        const dest = (args[destIndex] ?? '').trim();
        if (dest === '') continue;
        out.push({
            line: lineOf(body, m.index),
            fn,
            dest: dest.slice(0, 120),
            targetsSource: targetsCanonicalSource(dest, expandExpression(dest, bindings)),
        });
    }
    return out;
}

// -------------------------------------------------------------------- walk

export function listTypeScript(root: string, rel = ''): string[] {
    const abs = path.join(root, rel);
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
        if (SKIP_DIRS.has(e.name)) continue;
        const child = rel === '' ? e.name : `${rel}/${e.name}`;
        if (e.isDirectory()) out.push(...listTypeScript(root, child));
        else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(child);
    }
    return out;
}

export interface Evaluation {
    scanned: number;
    candidateModules: string[];
    writeSites: number;
    findings: Finding[];
    capabilityStatus: string;
}

export function evaluate(root: string = REPO_ROOT, ledger?: GateLedger): Evaluation {
    const r12Files = SOURCE_ROOTS.flatMap((r) => listTypeScript(path.join(root, r)).map((f) => `${r}/${f}`));
    const r3Only = R3_EXTRA_ROOTS.flatMap((r) => listTypeScript(path.join(root, r)).map((f) => `${r}/${f}`));
    const all = [...r12Files, ...r3Only];
    ledger?.plan(all);

    const findings: Finding[] = [];
    const candidateModules: string[] = [];
    let writeSites = 0;

    for (const rel of all) {
        const source = fs.readFileSync(path.join(root, rel), 'utf-8');
        const hits: Finding[] = [];
        const inR12 = r12Files.includes(rel);

        if (inR12 && !R1_ALLOWLIST.includes(rel)) {
            hits.push(...findApprovalSites(source).map((f) => ({ ...f, file: rel })));
        }
        if (inR12 && !R2_ALLOWLIST.includes(rel)) {
            hits.push(...findPromotedWriteSites(source).map((f) => ({ ...f, file: rel })));
        }
        if (isCandidateDerived(source)) {
            candidateModules.push(rel);
            const sites = findWriteSites(source);
            writeSites += sites.length;
            if (!R3_ALLOWLIST.includes(rel)) {
                for (const s of sites.filter((x) => x.targetsSource)) {
                    hits.push({
                        rule: 'R3',
                        file: rel,
                        line: s.line,
                        what: `candidate-derived ${s.fn} into ${REPO_SOURCE_ROOT}/`,
                        text: s.dest,
                    });
                }
            }
        }

        findings.push(...hits);
        if (hits.length > 0) ledger?.fail(rel, `${String(hits.length)} promotion-path finding(s)`);
        else ledger?.complete(rel);
    }

    // R0 — the capability must be unobtainable unless the blocker reads GRANTED.
    // Called, not read: a text match would pass over a refusal edited into a
    // no-op. `resolved` now means `Status: resolved` AND `Disposition: granted`;
    // a blocker closed as `refused`, or closed without saying which, is a
    // refusing status here exactly like an open one.
    const status = readMergeAuthorityStatus(root);
    if (isRefusingStatus(status)) {
        let refused = false;
        try {
            acquirePromotionCapability({ approver: 'gate probe', approvedAt: '1970-01-01' }, root);
        } catch (e) {
            refused = e instanceof PromotionCapabilityUnobtainableError;
        }
        if (!refused) {
            findings.push({
                rule: 'R0',
                file: 'src/scripts/_lib/promotion_capability.ts',
                line: 1,
                what: 'capability obtainable while the blocker does not read granted',
                text: `blocker status ${status}, yet acquirePromotionCapability() returned a token`,
            });
        }
    }

    return { scanned: all.length, candidateModules, writeSites, findings, capabilityStatus: status };
}

// ---------------------------------------------------------------- self-test

function selfTestCases(): SelfTestCase[] {
    const plant = (name: string, expect: 'reject' | 'accept', rel: string, body: string): SelfTestCase => ({
        name,
        expect,
        run: () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-'));
            try {
                // A minimal but ABOVE-FLOOR tree: the anti-vacuity floors must not
                // be what decides these cases, so the fixture carries enough files,
                // candidate modules and write sites to clear them.
                fs.mkdirSync(path.join(dir, 'src', 'scripts', '_lib'), { recursive: true });
                fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
                fs.mkdirSync(path.join(dir, 'agents', 'roadmaps'), { recursive: true });
                fs.writeFileSync(
                    path.join(dir, 'agents', 'roadmaps', 'road-to-harness-promotion-bridge.md'),
                    '### blocker: merge-authority\n\n- **Status:** open\n',
                );
                for (let i = 0; i < MIN_FILES + 5; i += 1) {
                    fs.writeFileSync(path.join(dir, 'src', 'scripts', `filler_${String(i)}.ts`), 'export const x = 1;\n');
                }
                for (let i = 0; i < MIN_CANDIDATE_MODULES + 1; i += 1) {
                    fs.writeFileSync(
                        path.join(dir, 'src', 'scripts', `cand_${String(i)}.ts`),
                        "import { parseCandidateRecord } from './_lib/candidate_record.js';\n" +
                            'const out = "clones/x";\n' +
                            'fs.writeFileSync(out, parseCandidateRecord);\n' +
                            'fs.mkdirSync(out);\nfs.rmSync(out);\n',
                    );
                }
                fs.writeFileSync(path.join(dir, rel), body);
                return runGateCli(REPO_ROOT, 'src/scripts/lint_promotion_paths.ts', ['--root', dir, '--quiet'], REPO_ROOT);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        },
    });
    const CAND = "import { parseCandidateRecord } from './_lib/candidate_record.js';\n";
    return [
        plant('a synthesised approver → reject', 'reject', 'src/scripts/rogue.ts',
            "assertTransition(from, 'promoted', { approver: 'ci', approvedAt: '2026-01-01' });\n"),
        plant('a HumanApproval reference outside the allowlist → reject', 'reject', 'src/scripts/rogue.ts',
            'const a: HumanApproval = load();\n'),
        plant('a three-argument assertTransition → reject', 'reject', 'src/scripts/rogue.ts',
            'assertTransition(a, b, c);\n'),
        plant('a record written straight into the promoted state → reject', 'reject', 'src/scripts/rogue.ts',
            "const r = { kind: 'candidate', lifecycle: 'promoted' };\n"),
        plant('a promoted state via the accepted-state constant → reject', 'reject', 'src/scripts/rogue.ts',
            'const r = { lifecycle: ACCEPTED_STATE };\n'),
        plant('a candidate-derived write into src/ → reject', 'reject', 'src/scripts/rogue.ts',
            `${CAND}fs.writeFileSync(path.join(root, 'src', 'rules', 'x.md'), parseCandidateRecord);\n`),
        plant('a candidate-derived copy INTO src/, second argument → reject', 'reject', 'src/scripts/rogue.ts',
            `${CAND}fs.copyFileSync(from, 'src/skills/x/SKILL.md');\n`),
        plant('a candidate-derived write behind a const hop → reject', 'reject', 'src/scripts/rogue.ts',
            `${CAND}const dest = path.join(root, 'src', 'rules');\nfs.writeFileSync(dest, body);\n`),
        plant('a TEST writing into src/ from candidate data → reject', 'reject', 'tests/rogue.test.ts',
            `${CAND}fs.writeFileSync('src/rules/x.md', body);\n`),
        // Accepting poles — each pins a direction a widened pattern would break.
        plant('the interface field declaration is not a construction → accept', 'accept', 'src/scripts/ok.ts',
            'interface A { readonly approver: string; readonly approvedAt: string; }\n'),
        plant('a two-argument assertTransition → accept', 'accept', 'src/scripts/ok.ts',
            "assertTransition(from, 'promoted');\n"),
        plant('a candidate-derived write to a clone directory → accept', 'accept', 'src/scripts/ok.ts',
            `${CAND}const dest = path.join(CLONES, 'candidate-1');\nfs.writeFileSync(dest, body);\n`),
        plant('a candidate-derived READ of src/ → accept', 'accept', 'src/scripts/ok.ts',
            `${CAND}const t = fs.readFileSync(path.join(root, 'src', 'x.ts'));\n`),
        plant('prose in a block comment naming the constructs → accept', 'accept', 'src/scripts/ok.ts',
            '/* never write approver: or lifecycle: "promoted" or HumanApproval here */\nexport const x = 1;\n'),
        plant('a non-candidate module writing into src/ → accept', 'accept', 'src/scripts/ok.ts',
            "fs.writeFileSync(path.join(root, 'src', 'generated.ts'), body);\n"),
    ];
}

// --------------------------------------------------------------------- CLI

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) {
        return runSelfTest({ gate: GATE, cases: selfTestCases(), minCases: 14, minRejectCases: 9 });
    }
    const quiet = argv.includes('--quiet');
    const ri = argv.indexOf('--root');
    const rootArg = ri !== -1 ? argv[ri + 1] : undefined;
    const root = rootArg !== undefined ? path.resolve(rootArg) : REPO_ROOT;

    const ledger = new GateLedger(GATE);
    let v: Evaluation;
    try {
        v = evaluate(root, ledger);
    } catch (err) {
        process.stderr.write(`❌  ${GATE}: ${(err as Error).message}\n`);
        return 2;
    }

    try {
        reportScanned({
            gate: GATE,
            scanned: v.scanned,
            units: 'TypeScript file(s)',
            roots: [...SOURCE_ROOTS, ...R3_EXTRA_ROOTS],
        });
        // The anti-vacuity floors. The condition this gate discharges says in as
        // many words that a check over a population of zero discharges nothing,
        // so a collapsed population is a dead scope rather than a clean run.
        assertScanned({ gate: `${GATE}/files`, scanned: v.scanned >= MIN_FILES ? v.scanned : 0, units: `TypeScript file(s) (floor ${String(MIN_FILES)})`, roots: [...SOURCE_ROOTS, ...R3_EXTRA_ROOTS] });
        assertScanned({ gate: `${GATE}/candidate-modules`, scanned: v.candidateModules.length >= MIN_CANDIDATE_MODULES ? v.candidateModules.length : 0, units: `candidate-derived module(s) (floor ${String(MIN_CANDIDATE_MODULES)})`, roots: [...SOURCE_ROOTS, ...R3_EXTRA_ROOTS] });
        assertScanned({ gate: `${GATE}/write-sites`, scanned: v.writeSites >= MIN_WRITE_SITES ? v.writeSites : 0, units: `filesystem-write site(s) in candidate-derived modules (floor ${String(MIN_WRITE_SITES)})`, roots: v.candidateModules });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${GATE}: ${err.message}\n`);
            return 2;
        }
        throw err;
    }
    ledger.report();

    if (v.findings.length > 0) {
        for (const f of v.findings) {
            process.stderr.write(`❌  ${f.file}:${String(f.line)}  ${f.rule} ${f.what}\n      ${f.text}\n`);
        }
        process.stderr.write(
            `\n    ${String(v.findings.length)} promotion-capable write(s) bypass the guarded capability\n` +
                '    (src/scripts/_lib/promotion_capability.ts). Promotion into canonical agent-config\n' +
                '    is gated on blocker merge-authority (ADR-239 Decision 3), which is owner-reserved.\n' +
                '    Route the write through acquirePromotionCapability, or do not perform it.\n',
        );
        return 1;
    }
    if (!quiet) {
        process.stdout.write(
            `✅  ${GATE}: no promotion path bypasses the guarded capability ` +
                `(${String(v.scanned)} file(s), ${String(v.candidateModules.length)} candidate-derived ` +
                `module(s), ${String(v.writeSites)} write site(s); blocker status: ${v.capabilityStatus}).\n`,
        );
    }
    return 0;
}

if (process.env['GATE_SELF_TEST_CHILD'] !== '1' || process.argv.includes('--root')) {
    if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
        process.exit(main());
    }
}
