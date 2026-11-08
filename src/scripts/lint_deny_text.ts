#!/usr/bin/env tsx
/**
 * A deny never names its own kill switch.
 *
 * road-to-a-kernel-that-guards-its-plumbing 1.3.
 *
 * A blocking concern refuses a tool call and then prints a message to the one
 * party that wanted the call to succeed. If that message names the environment
 * variable, the `export` line or the settings key that turns the guard off, the
 * refusal is a speed bump with instructions attached. The reader most motivated
 * to follow them is the agent that was just refused.
 *
 * The rule is therefore about the OUTPUT, not about the mechanism: a kill
 * switch may exist, may be documented in the concern's header, may be listed in
 * the manifest and in the contract. It may not appear in the text the refusal
 * prints. Two of the nine blocking concerns carry a kill switch today and both
 * name it only in a comment — this gate is what keeps that true, rather than
 * true-so-far.
 *
 * WHAT IS SCANNED, stated precisely because the boundary is the whole design.
 *
 * The corpus is the `severity: blocking` concerns in `hook_manifest.yaml`, read
 * from the manifest rather than listed here, so a guard added there joins the
 * corpus without an edit. Within each, the unit is a MESSAGE-SHAPED string
 * expression, read with the TypeScript parser: each outermost literal,
 * template or `+` chain, evaluated, and kept when it contains whitespace.
 *
 * The prose test is the discriminator, and it is what makes the settings-key
 * rule usable at all: `'hooks.enabled'` as a lookup key is how a concern reads
 * its own configuration and is not a message, while
 * `'set hooks.enabled: false to skip'` is. A rule that fired on the bare key
 * would fire on every concern that reads a setting, which is the false-positive
 * shape that gets a young gate disabled.
 *
 * Messages are read RESOLVED: a template hole or a `+` operand naming a `const`
 * string in the same module takes that constant's value before the patterns
 * run. Without that the gate read `${KILL_SWITCH}=1` literally and certified a
 * deny that printed its own kill switch (round inbox-2026-11-zc). Every value a
 * name is given anywhere is kept, constants built from constants resolve to a
 * fixed point, type assertions are seen through, and every combination is
 * checked, so
 * shadowing cannot hide a switch; escapes, line continuations and an escaped
 * `\${` are the parser's own cooked text. A message with more variants than
 * the gate enumerates, nested deeper than it evaluates, or containing any
 * expression fixed at author time that the gate does not evaluate (an operator
 * other than `+`, numeric arithmetic, a destructuring pattern over literals),
 * fails rather than passes. A deny may also not name the
 * hook manifest: telling the refused agent where its own entry lives is a
 * bypass too, so any reference is refused.
 *
 * WHAT IT DOES NOT SEE, so nobody reads more into a green than is there:
 * text a message takes from a value not fixed at author time (a call, a
 * property read, an imported value, a `let`, a parameter, or a `const` built
 * from any of these), which the gate keeps as a hole, a message in a module
 * the concern imports, and a kill switch named in a way none of the patterns
 * matches. This is a pattern gate over parsed source, not a proof about emitted
 * bytes: it models the JavaScript an author writes in a deny (literals,
 * templates, `+`, `?:`, constants, type assertions) and refuses what it does
 * not model when that is fixed at author time. A construction outside that
 * model may still escape it; review of the deny text remains the control, and
 * this gate is the net under it.
 *
 * Exit codes: 0 clean · 1 a deny names a bypass · 2 the corpus could not be read.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as yaml from 'js-yaml';
import ts from 'typescript';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { assertScanned, reportScanned } from './_lib/scan_scope.js';
import { exitOnDeadScope } from './_lib/dead_scope_exit.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const GATE = 'lint_deny_text';

const MANIFEST_REL = 'src/scripts/hook_manifest.yaml';

/**
 * Top-level settings keys, so `hooks.enabled` reads as a settings path and
 * `payload.tool_input` does not.
 *
 * A fixed list rather than a parse of the template: the template is a large
 * file with placeholder substitutions, and the gate needs the discriminator to
 * be stable and reviewable in a diff. Adding a top-level settings section is
 * the moment to add it here; a missing entry costs a miss, never a false
 * refusal.
 */
export const SETTINGS_ROOTS: readonly string[] = [
    'ai_team',
    'augment',
    'chat_history',
    'code_style',
    'commands',
    'consistency',
    'continuity',
    'cost',
    'decision_engine',
    'delivery',
    'design',
    'emergency',
    'execution',
    'github',
    'hooks',
    'knowledge',
    'memory',
    'model',
    'onboarding',
    'personal',
    'pipelines',
    'planning',
    'profile',
    'project',
    'projection',
    'quality',
    'reasoning',
    'roadmap',
    'screenshots',
    'subagents',
    'telegraph',
    'tokens',
    'update_check',
    'verbosity',
];

export interface DenyFinding {
    readonly concern: string;
    readonly file: string;
    readonly kind: 'env-assignment' | 'export-line' | 'settings-key' | 'manifest-reference' | 'unresolvable';
    readonly text: string;
}

const ENV_ASSIGNMENT_RE = /AGENT_CONFIG_[A-Z0-9_]+\s*=/;
const MANIFEST_RE = /hook_manifest\.(yaml|json)/;
const EXPORT_RE = /(^|[\s`'"(])export\s/;

function settingsKeyIn(text: string): boolean {
    for (const root of SETTINGS_ROOTS) {
        const re = new RegExp(`(^|[^A-Za-z0-9_.])${root}\\.[a-z][a-z0-9_]*`);
        if (re.test(text)) {
            return true;
        }
    }
    return false;
}

/** Above this many printable variants a message is not certified. */
export const MAX_VARIANTS = 4096;

/**
 * Every string a `const` declarator in the module is initialised with, by
 * name, at any scope and for every declarator of a list. Scope is not tracked:
 * a name declared twice keeps both values, so shadowing can over-report and
 * never hide a switch.
 */
export function stringConstants(sf: ts.SourceFile): Map<string, string[]> {
    // To a fixed point, so a chain of constants of any length resolves. Each pass
    // can only add values, so it settles within one pass per declaration.
    let declarators = 0;
    const count = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node)) declarators += 1;
        ts.forEachChild(node, count);
    };
    count(sf);
    let known = new Map<string, string[]>();
    for (let pass = 0; pass <= declarators + 1; pass += 1) {
        const next = collectConstants(sf, known);
        if (sameConstants(known, next)) return next;
        known = next;
    }
    return known;
}

function sameConstants(a: ReadonlyMap<string, readonly string[]>, b: ReadonlyMap<string, readonly string[]>): boolean {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
        const w = b.get(k);
        if (w === undefined || w.length !== v.length || w.some((x, i) => x !== v[i])) return false;
    }
    return true;
}

function collectConstants(sf: ts.SourceFile, known: ReadonlyMap<string, readonly string[]>): Map<string, string[]> {
    const out = new Map<string, string[]>();
    // Names with any declaration the gate cannot read. Applied after the walk,
    // so declaration order cannot let a readable twin mask one.
    const poisoned = new Set<string>();
    const visit = (node: ts.Node): void => {
        if (
            ts.isVariableDeclarationList(node) &&
            (node.flags & ts.NodeFlags.Const) !== 0
        ) {
            for (const decl of node.declarations) {
                if (decl.initializer === undefined) continue;
                // A const whose initializer carries literal text but does not
                // evaluate (a destructuring pattern, an unsupported form, a
                // too-large product) is recorded EMPTY: a message using it is
                // then unresolvable, never certified. A const with no literal
                // text at all is runtime assembly and stays a hole.
                const literal = staticLiteralInit(decl.initializer, known);
                if (!ts.isIdentifier(decl.name)) {
                    if (literal) for (const name of boundNames(decl.name)) poisoned.add(name);
                    continue;
                }
                const name = decl.name.text;
                const values = evaluate(decl.initializer, known, 0);
                if (values === null || values.some((v) => v.includes('\u0000HOLE'))) {
                    if (values === null || literal || staticLiteralInit(decl.initializer, known, false)) poisoned.add(name);
                    continue;
                }
                out.set(name, [...new Set([...(out.get(name) ?? []), ...values])]);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    for (const name of poisoned) out.set(name, []);
    return out;
}

/**
 * Is the initializer fixed at author time — built only from literals, array and
 * object literals, operators, type assertions and constants already known — and
 * does it carry string text? Such a value is the author's text however it is
 * shaped, so one the gate cannot evaluate must not pass. Anything reaching a
 * call, a property read or an unknown name is runtime assembly.
 */
function staticLiteralInit(node: ts.Node, known: ReadonlyMap<string, readonly string[]>, requireText = true): boolean {
    let text = false;
    // A denylist of what reaches outside the author's text, rather than an
    // allowlist of what stays inside it: a syntax form nobody listed (a unary
    // operator, `typeof`, a comma) is then static by default and fails closed.
    const isStatic = (n: ts.Node): boolean => {
        if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
            text = true;
            return true;
        }
        if (ts.isIdentifier(n)) {
            // A known constant is text by construction (or unreadable text).
            if (known.has(n.text)) text = true;
            return known.has(n.text) || n.text === 'undefined';
        }
        if (
            ts.isCallExpression(n) || ts.isNewExpression(n) || ts.isTaggedTemplateExpression(n) ||
            ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n) ||
            ts.isAwaitExpression(n) || ts.isYieldExpression(n) ||
            ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isClassExpression(n) ||
            n.kind === ts.SyntaxKind.ThisKeyword || n.kind === ts.SyntaxKind.SuperKeyword ||
            ts.isMetaProperty(n) || ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword
        ) {
            return false;
        }
        if (ts.isPropertyAssignment(n)) return isStatic(n.initializer);
        if (ts.isShorthandPropertyAssignment(n)) return isStatic(n.name);
        return ts.forEachChild(n, (c) => (isStatic(c) ? undefined : true)) !== true;
    };
    return isStatic(node) && (text || !requireText);
}

/** Every identifier a binding pattern binds. */
function boundNames(name: ts.BindingName): string[] {
    if (ts.isIdentifier(name)) return [name.text];
    return name.elements.flatMap((el) => (ts.isOmittedExpression(el) ? [] : boundNames(el.name)));
}

/**
 * The texts an expression can evaluate to, from string literals, templates,
 * `+` concatenation and identifiers bound to known constants. Anything else
 * becomes a marked hole, kept as its source text. `null` when the variants
 * exceed {@link MAX_VARIANTS}. String escapes, line continuations and an
 * escaped `\${` are already resolved by the parser's cooked text.
 */
function evaluate(node: ts.Expression, constants: ReadonlyMap<string, readonly string[]>, depth: number): string[] | null {
    const join = (left: string[] | null, right: string[] | null): string[] | null => {
        if (left === null || right === null || left.length * right.length > MAX_VARIANTS) return null;
        return left.flatMap((l) => right.map((r) => l + r));
    };
    const hole = (n: ts.Node): string[] => [`\u0000HOLE\${${n.getText()}}`];
    // Past the budget the expression is uncertified, never a silent hole.
    if (depth > 256) return null;
    if (
        ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isTypeAssertionExpression(node) ||
        ts.isNonNullExpression(node)
    ) {
        return evaluate(node.expression, constants, depth + 1);
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
    // Primitives coerce to text inside a concatenation or a template.
    if (ts.isNumericLiteral(node)) return [String(Number(node.text))];
    if (node.kind === ts.SyntaxKind.TrueKeyword) return ['true'];
    if (node.kind === ts.SyntaxKind.FalseKeyword) return ['false'];
    if (node.kind === ts.SyntaxKind.NullKeyword) return ['null'];
    if (ts.isTemplateExpression(node)) {
        let acc: string[] | null = [node.head.text];
        for (const span of node.templateSpans) {
            acc = join(acc, evaluate(span.expression, constants, depth + 1));
            acc = join(acc, [span.literal.text]);
        }
        return acc;
    }
    if (ts.isConditionalExpression(node)) {
        const a = evaluate(node.whenTrue, constants, depth + 1);
        const b = evaluate(node.whenFalse, constants, depth + 1);
        if (a === null || b === null || a.length + b.length > MAX_VARIANTS) return null;
        return [...a, ...b];
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        // Numeric addition is not concatenation; the gate does not evaluate it.
        if (numericOnly(node.left) && numericOnly(node.right)) return null;
        return join(evaluate(node.left, constants, depth + 1), evaluate(node.right, constants, depth + 1));
    }
    if (ts.isIdentifier(node)) {
        const values = constants.get(node.text);
        if (values === undefined) return hole(node);
        return values.length > 0 ? [...values] : null;
    }
    // An operator the gate does not evaluate, over text fixed at author time,
    // is uncertified rather than a hole: only runtime values may be holes.
    return staticLiteralInit(node, constants, false) ? null : hole(node);
}

/** An expression built only from numeric literals and arithmetic. */
function numericOnly(node: ts.Expression): boolean {
    if (ts.isNumericLiteral(node)) return true;
    if (ts.isParenthesizedExpression(node)) return numericOnly(node.expression);
    if (ts.isPrefixUnaryExpression(node)) return numericOnly(node.operand);
    if (ts.isBinaryExpression(node)) return numericOnly(node.left) && numericOnly(node.right);
    return false;
}

/** Does any string or template literal inside the expression carry whitespace? */
function hasProseLiteral(node: ts.Node): boolean {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && /\s/.test(node.text)) {
        return true;
    }
    return ts.forEachChild(node, (c) => (hasProseLiteral(c) ? true : undefined)) === true;
}

/** A string-bearing expression that is not itself part of a larger one. */
function isOutermostString(node: ts.Node): node is ts.Expression {
    const stringy =
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateExpression(node) ||
        (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken);
    if (!stringy) return false;
    let parent = node.parent;
    while (parent !== undefined && ts.isParenthesizedExpression(parent)) parent = parent.parent;
    if (parent === undefined) return true;
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.PlusToken) return false;
    if (ts.isTemplateSpan(parent)) return false;
    // Module specifiers and property names are not output.
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isPropertyAssignment(parent) && parent.name === node) return false;
    return true;
}

/**
 * Every message a module can print from literal parts: each outermost string
 * expression, evaluated to all its variants, kept when a variant is
 * message-shaped (contains whitespace). The shape test runs AFTER resolution,
 * so a template whose own text is bare still counts once its holes fill in.
 * `null` marks an expression with too many variants to certify.
 */
export function messageTexts(src: string, fileName = 'concern.ts'): Array<{ variants: string[] | null; at: string }> {
    const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const constants = stringConstants(sf);
    const out: Array<{ variants: string[] | null; at: string }> = [];
    const visit = (node: ts.Node): void => {
        if (isOutermostString(node)) {
            const variants = evaluate(node, constants, 0);
            const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
            const at = `line ${String(line)}: ${node.getText(sf).replace(/\s+/g, ' ').slice(0, 80)}`;
            if (variants === null) {
                // Uncertified only where it is a message: some literal text in
                // it carries whitespace. A numeric `+` is not prose.
                if (hasProseLiteral(node)) out.push({ variants: null, at });
            } else {
                const texts = variants.map((v) => v.replace(/\u0000HOLE/g, ''));
                if (texts.some((t) => /\s/.test(t))) out.push({ variants: texts, at });
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
}

/** Findings for one concern's source text. */
export function scanSource(concern: string, file: string, src: string): DenyFinding[] {
    const out: DenyFinding[] = [];
    for (const { variants, at } of messageTexts(src, file)) {
        if (variants === null) {
            out.push({ concern, file, kind: 'unresolvable', text: at });
            continue;
        }
        const text =
            variants.find((v) => ENV_ASSIGNMENT_RE.test(v) || EXPORT_RE.test(v) || settingsKeyIn(v) || MANIFEST_RE.test(v)) ??
            (variants[0] as string);
        if (ENV_ASSIGNMENT_RE.test(text)) {
            out.push({ concern, file, kind: 'env-assignment', text });
            continue;
        }
        if (EXPORT_RE.test(text)) {
            out.push({ concern, file, kind: 'export-line', text });
            continue;
        }
        if (settingsKeyIn(text)) {
            out.push({ concern, file, kind: 'settings-key', text });
            continue;
        }
        if (MANIFEST_RE.test(text)) {
            out.push({ concern, file, kind: 'manifest-reference', text });
        }
    }
    return out;
}

/** `severity: blocking` concerns, as `[name, script]`, read from the manifest. */
export function blockingConcerns(manifestText: string): Array<[string, string]> {
    const doc = yaml.load(manifestText) as { concerns?: Record<string, Record<string, unknown>> };
    const concerns = doc?.concerns ?? {};
    const out: Array<[string, string]> = [];
    for (const [name, body] of Object.entries(concerns)) {
        if (String(body['severity'] ?? '') !== 'blocking') continue;
        const script = body['script'];
        if (typeof script === 'string') out.push([name, script]);
    }
    return out.sort((a, b) => a[0].localeCompare(b[0]));
}

export function scan(root: string): { findings: DenyFinding[]; scanned: number } {
    const manifest = path.join(root, MANIFEST_REL);
    if (!fs.existsSync(manifest)) {
        return { findings: [], scanned: 0 };
    }
    const findings: DenyFinding[] = [];
    let scanned = 0;
    for (const [name, script] of blockingConcerns(fs.readFileSync(manifest, 'utf8'))) {
        const abs = path.join(root, script);
        if (!fs.existsSync(abs)) continue;
        scanned += 1;
        findings.push(...scanSource(name, script, fs.readFileSync(abs, 'utf8')));
    }
    return { findings, scanned };
}

const REASON: Readonly<Record<DenyFinding['kind'], string>> = {
    'env-assignment': 'names an environment kill switch, with its value',
    'export-line': 'carries an `export` line the reader can paste',
    'settings-key': 'names a settings key path',
    'manifest-reference': 'names the hook manifest, the file that switches the guard off',
    unresolvable: 'uses literal text the gate cannot evaluate (too many variants, too deep, or a const it cannot read), so it cannot be certified',
};

export function main(argv: readonly string[]): number {
    if (argv.includes('--self-test')) return selfTest();
    const rootIdx = argv.indexOf('--root');
    const root = rootIdx === -1 ? ROOT : (argv[rootIdx + 1] ?? ROOT);

    const { findings, scanned } = scan(root);

    const ledger = new GateLedger(GATE);
    ledger.plan(findings.map((f) => `${f.concern}:${f.kind}:${f.text.slice(0, 40)}`));
    for (const f of findings) {
        ledger.fail(`${f.concern}:${f.kind}:${f.text.slice(0, 40)}`, REASON[f.kind]);
    }

    // A gate that read nothing has not passed. BEFORE the verdict: a manifest
    // that moved, or a `severity:` key that was renamed, would otherwise
    // certify an empty corpus clean.
    assertScanned({
        gate: GATE,
        scanned,
        units: 'blocking concern(s)',
        roots: [MANIFEST_REL],
    });
    reportScanned({
        gate: GATE,
        scanned,
        units: 'blocking concern(s)',
        roots: [MANIFEST_REL],
    });
    ledger.report();

    if (findings.length > 0) {
        for (const f of findings) {
            process.stdout.write(
                `❌  ${GATE}: ${f.file} (${f.concern}) ${REASON[f.kind]}:\n      ${f.text.slice(0, 200)}\n`,
            );
        }
        process.stdout.write(
            '\nA blocking concern may HAVE a kill switch. Its refusal message may not name it.\n' +
                "Move the sentence to the concern's header comment, the manifest entry, or\n" +
                'docs/contracts/hook-architecture-v1.md — all three are read by people deciding\n' +
                'whether the guard should exist, and none is read by the agent it just refused.\n',
        );
        return 1;
    }

    process.stdout.write(
        `✅  ${GATE}: no blocking concern names its own bypass ` +
            `(${String(scanned)} concern(s) scanned).\n`,
    );
    return 0;
}

function selfTest(): number {
    const plant = (name: string, body: string): string => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), `deny-text-${name}-`));
        fs.mkdirSync(path.join(dir, 'src', 'scripts', 'hooks'), { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'src', 'scripts', 'hook_manifest.yaml'),
            [
                'schema_version: 1',
                'concerns:',
                '  probe-guard:',
                '    script: src/scripts/hooks/probe_guard.ts',
                '    severity: blocking',
                '  probe-advisory:',
                '    script: src/scripts/hooks/probe_advisory.ts',
                '    severity: advisory',
                '',
            ].join('\n'),
            'utf-8',
        );
        fs.writeFileSync(path.join(dir, 'src', 'scripts', 'hooks', 'probe_guard.ts'), body, 'utf-8');
        fs.writeFileSync(
            path.join(dir, 'src', 'scripts', 'hooks', 'probe_advisory.ts'),
            "process.stderr.write('set AGENT_CONFIG_X=1 to skip this advice');\n",
            'utf-8',
        );
        return dir;
    };
    const emit = (msg: string): string => `process.stderr.write(${JSON.stringify(msg)});\n`;
    const run = (root: string): number =>
        runGateCli(ROOT, path.join('src', 'scripts', 'lint_deny_text.ts'), ['--root', root], ROOT);

    return runSelfTest({
        gate: GATE,
        minCases: 34,
        minRejectCases: 25,
        cases: [
            {
                name: 'an empty corpus is refused, not certified green',
                expect: 'refuse',
                run: () => run(fs.mkdtempSync(path.join(os.tmpdir(), 'deny-text-empty-'))),
            },
            {
                name: 'a deny naming an env kill switch with its value fails',
                expect: 'reject',
                run: () => run(plant('env', emit('BLOCKED — set AGENT_CONFIG_X=1 to skip'))),
            },
            {
                name: 'a deny carrying an export line fails',
                expect: 'reject',
                run: () => run(plant('export', emit('BLOCKED — run export AC_OFF=1 first'))),
            },
            {
                name: 'a deny naming a settings key path fails',
                expect: 'reject',
                run: () => run(plant('settings', emit('BLOCKED — flip hooks.enabled to false'))),
            },
            {
                name: 'a template literal interpolating a kill-switch constant fails',
                expect: 'reject',
                run: () =>
                    run(
                        plant(
                            'template',
                            "const KILL = 'AGENT_CONFIG_X';\n" +
                                'process.stderr.write(`BLOCKED (maintainer override: ${KILL}=1)`);\n',
                        ),
                    ),
            },
            {
                name: 'a deny pointing at the hook manifest fails',
                expect: 'reject',
                run: () => run(plant('manifest', emit('BLOCKED — remove the entry in src/scripts/hook_manifest.yaml'))),
            },
            {
                name: 'a shadowed constant cannot hide the kill switch',
                expect: 'reject',
                run: () =>
                    run(
                        plant(
                            'shadow',
                            "const KILL = 'AGENT_CONFIG_X';\nfunction f() { const KILL = 'harmless'; return KILL; }\nvoid f;\n" +
                                'process.stderr.write(`BLOCKED (override: ${KILL}=1)`);\n',
                        ),
                    ),
            },
            {
                name: 'an escaped kill-switch name is decoded before matching',
                expect: 'reject',
                run: () =>
                    run(
                        plant(
                            'escape',
                            "const KILL = 'AGENT_CONFIG_\\x58';\n" +
                                'process.stderr.write(`BLOCKED (override: ${KILL}=1)`);\n',
                        ),
                    ),
            },
            {
                name: 'a ${NAME} inside a plain string is not interpolated',
                expect: 'accept',
                run: () =>
                    run(
                        plant(
                            'plain-dollar',
                            "const KILL = 'AGENT_CONFIG_X';\nvoid KILL;\n" +
                                "process.stderr.write('BLOCKED: the shell form ${KILL}=1 is quoted here as text');\n",
                        ),
                    ),
            },
            {
                name: 'two holes that only together spell a switch fail',
                expect: 'reject',
                run: () =>
                    run(
                        plant(
                            'two-holes',
                            "const A = 'safe';\nfunction f() { const A = 'AGENT_CONFIG_'; const B = 'X'; return A + B; }\nconst B = 'safe';\nvoid f;\n" +
                                'process.stderr.write(`BLOCKED: ${A}${B}=1`);\n',
                        ),
                    ),
            },
            {
                name: 'a line continuation inside the switch name is decoded',
                expect: 'reject',
                run: () => run(plant('continuation', 'process.stderr.write(`BLOCKED (AGENT_CONFIG_\\\nX=1)`);\n')),
            },
            {
                name: 'an escaped placeholder prints literal text and is not resolved',
                expect: 'accept',
                run: () =>
                    run(
                        plant(
                            'escaped-hole',
                            "const KILL = 'AGENT_CONFIG_X';\nvoid KILL;\n" +
                                'process.stderr.write(`BLOCKED: the form \\${KILL} is shown as text`);\n',
                        ),
                    ),
            },
            {
                name: 'a bare template becomes a message once its hole fills in',
                expect: 'reject',
                run: () =>
                    run(plant('bare-template', "const DENY = 'Blocked: AGENT_CONFIG_X';\nprocess.stderr.write(`${DENY}=1`);\n")),
            },
            {
                name: 'every declarator of a const list is collected',
                expect: 'reject',
                run: () =>
                    run(plant('declarators', "const A = 'AGENT_CONFIG_', B = 'X';\nprocess.stderr.write(`Blocked: ${A}${B}=1`);\n")),
            },
            {
                name: 'a switch split across a + chain is joined before matching',
                expect: 'reject',
                run: () => run(plant('concat', "process.stderr.write('Blocked: AGENT_CONFIG_' +\n    'X=1 to skip');\n")),
            },
            {
                name: 'a chain of four constants still resolves',
                expect: 'reject',
                run: () =>
                    run(
                        plant(
                            'const-chain',
                            "const A = 'AGENT_CONFIG_';\nconst B = A;\nconst C = B;\nconst D = C;\n" +
                                'process.stderr.write(`Blocked: ${D}X=1`);\n',
                        ),
                    ),
            },
            {
                name: 'a + chain deeper than the evaluation budget fails, not passes',
                expect: 'reject',
                run: () =>
                    run(
                        plant(
                            'deep-chain',
                            "process.stderr.write('Blocked: AGENT_CONFIG_' + " + "'' + ".repeat(300) + "'X=1');\n",
                        ),
                    ),
            },
            {
                name: 'a long constant chain inside one function still resolves',
                expect: 'reject',
                run: () => {
                    const chain = Array.from({ length: 101 }, (_, i) => (i === 0 ? "    const A0 = 'AGENT_CONFIG_';" : `    const A${String(i)} = A${String(i - 1)};`));
                    return run(plant('fn-chain', `function deny() {\n${chain.join('\n')}\n    process.stderr.write(\`Blocked: \${A100}X=1\`);\n}\nvoid deny;\n`));
                },
            },
            {
                name: 'a type assertion does not hide a constant',
                expect: 'reject',
                run: () =>
                    run(plant('as-const', "const PREFIX = 'AGENT_CONFIG_' as const;\nprocess.stderr.write(`Blocked: ${PREFIX}X=1`);\n")),
            },
            {
                name: 'a destructured literal constant fails rather than passes',
                expect: 'reject',
                run: () =>
                    run(plant('destructure', "const [PREFIX] = ['AGENT_CONFIG_'];\nprocess.stderr.write(`Blocked: ${PREFIX}X=1`);\n")),
            },
            {
                name: 'an unreadable shadow is not masked by a readable twin declared first',
                expect: 'reject',
                run: () =>
                    run(plant('poison-order', "const PREFIX = 'safe';\nfunction deny() {\n    const [PREFIX] = ['AGENT_CONFIG_'];\n    return `Blocked: ${PREFIX}X=1`;\n}\nvoid deny;\n")),
            },
            {
                name: 'destructuring through another literal constant still fails closed',
                expect: 'reject',
                run: () =>
                    run(plant('poison-alias', "const PARTS = ['AGENT_CONFIG_'];\nconst [PREFIX] = PARTS;\nprocess.stderr.write(`Blocked: ${PREFIX}X=1`);\n")),
            },
            {
                name: 'a numeric literal in a concatenation is coerced, not a hole',
                expect: 'reject',
                run: () => run(plant('numeric', "process.stderr.write('Blocked: AGENT_CONFIG_' + 1 + '=1');\n")),
            },
            {
                name: 'an unevaluated operator over author-fixed text fails closed',
                expect: 'reject',
                run: () =>
                    run(plant('logical-or', "const PREFIX = 'AGENT_CONFIG_';\nprocess.stderr.write('Blocked: ' + (PREFIX || '') + 'X=1');\n")),
            },
            {
                name: 'numeric addition is not read as concatenation',
                expect: 'reject',
                run: () => run(plant('arith', 'process.stderr.write(`Blocked: AGENT_CONFIG_${1 + 2}=1`);\n')),
            },
            {
                name: 'a unary operator over a literal fails closed',
                expect: 'reject',
                run: () => run(plant('unary', "process.stderr.write('Blocked: AGENT_CONFIG_' + +'1' + '=1');\n")),
            },
            {
                name: 'numeric arithmetic inside a message fails closed',
                expect: 'reject',
                run: () => run(plant('mul', 'process.stderr.write(`Blocked: AGENT_CONFIG_${2 * 3}=1`);\n')),
            },
            {
                name: 'a constant built by arithmetic fails closed when a message uses it',
                expect: 'reject',
                run: () => run(plant('num-const', 'const N = -1;\nprocess.stderr.write(`Blocked: AGENT_CONFIG_${N}=1`);\n')),
            },
            {
                name: 'arithmetic outside any message is not a finding',
                expect: 'accept',
                run: () => run(plant('retry', 'const RETRY_DELAY = 1000 + 250;\nvoid RETRY_DELAY;\nprocess.stderr.write(`BLOCKED — try later`);\n')),
            },
            {
                name: 'a hole bound at runtime is not a finding',
                expect: 'accept',
                run: () =>
                    run(plant('runtime-hole', "const [ok, reason] = check(process.argv);\nvoid ok;\nprocess.stderr.write(`BLOCKED — ${reason}`);\n")),
            },
            {
                name: 'a placeholder naming a non-switch constant passes',
                expect: 'accept',
                run: () =>
                    run(
                        plant(
                            'template-clean',
                            "const WHAT = 'the credential file';\n" +
                                'process.stderr.write(`BLOCKED: ${WHAT} is not readable`);\n',
                        ),
                    ),
            },
            {
                name: 'a deny that names no bypass passes',
                expect: 'accept',
                run: () => run(plant('clean', emit('BLOCKED — rebuild it from its source'))),
            },
            {
                name: 'the kill switch named in a COMMENT passes — the rule is about output',
                expect: 'accept',
                run: () =>
                    run(
                        plant(
                            'comment',
                            '// Kill switch: AGENT_CONFIG_X=1.\n/* or AGENT_CONFIG_Y=1 */\n' +
                                emit('BLOCKED — rebuild it from its source'),
                        ),
                    ),
            },
            {
                name: 'a bare settings key used as a lookup passes — it is not a message',
                expect: 'accept',
                run: () => run(plant('lookup', "const k = 'hooks.enabled';\nvoid k;\n")),
            },
            {
                name: 'an ADVISORY concern naming its switch passes — only denials are scanned',
                expect: 'accept',
                run: () => run(plant('advisory-only', emit('BLOCKED — rebuild it'))),
            },
        ],
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(exitOnDeadScope(() => main(process.argv.slice(2))));
}
