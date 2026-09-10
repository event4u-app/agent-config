#!/usr/bin/env tsx
/**
 * An undeclared lossy transform on a model-facing path fails
 * (`road-to-runtime-context-floors` step 3.2).
 *
 * STRICTNESS — decided, not assumed
 * ---------------------------------
 * Council 2026-08-28 (2/2 convergent, anthropic + openai, 2 rounds) resolved the
 * `how-strict-the-loss-class-lint-is` blocker as option (b): FAIL on transforms
 * whose output reaches the model, WARN elsewhere. Option (a) — fail everywhere in
 * `src/` — buys a first-run backlog whose usual answer is a broad allowlist, and
 * this repository has a measured history of an allowlist emptying a gate. Option
 * (c) — warn everywhere, ratchet later — is the shape this repository has
 * measurably never ratcheted.
 *
 * Both seats added the same refinement, adopted here: **unknown reachability is
 * classified as model-reaching.** Ambiguity must not become an accidental
 * exemption.
 *
 * WHAT COUNTS AS MODEL-FACING
 * ---------------------------
 * A hook concern bound on a slot whose output can reach the model, whose script
 * BOTH emits a context payload AND applies a lossy operation to content. Both
 * halves are read from code with comments stripped — the first cut of this
 * detector matched `truncat` inside three docblocks that describe truncation
 * without performing any, and a gate that fires on prose about a defect rather
 * than the defect is how a real corpus of one becomes a pro-forma corpus of four.
 *
 * Measured at landing: **1** module qualified — `hot_context_hook`, the
 * `ephemeral-lossy` exemplar the contract classifies. Measured 2026-09-09 after
 * road-to-continuity-writer-activation step 3.1 retired that module's cache
 * half: **0** — the scanned corpus unchanged at 58 hook scripts and the matched
 * subset empty, so the gate passed over nothing. Measured 2026-09-10 after the
 * `loss_module:` pointer below: **1** again, and it is
 * `_lib/session_index_trust.ts`, the module that applies the surviving 30-row
 * cap.
 *
 * THE POINTER, AND WHY IT IS NOT AN IMPORT-CLOSURE WIDENING
 * --------------------------------------------------------
 * The blocker `loss-class-corpus-is-empty-after-hot-context` offered two
 * routes, and the first one does not work. Measured 2026-09-10: a transitive
 * static-import closure over all 58 concern scripts returns 11 applied-lossy
 * modules, of which 9 match on an identifier rather than on a transform (a
 * `truncated: boolean` field, a settings key named `…redaction.enabled`, a
 * regex literal detecting `truncate table`) — the pro-forma-corpus failure the
 * comment-stripping above already exists to prevent, one layer up. And the
 * closure does NOT contain `session_index_trust.ts` at all: the only concern
 * that reaches it, `hot-context`, loads it through `createRequire` for bundle
 * safety. A widening that misses the module it was written for, while adding
 * nine it was not, is not a widening.
 *
 * So the second route: a concern script names the module carrying its lossy
 * transform with `loss_module: <repo-relative path>`, and the gate then
 * REQUIRES that module to declare. The polarity is the opposite of an
 * allowlist — a pointer at an undeclared, absent, or out-of-tree module fails.
 *
 * WHAT THIS STILL DOES NOT CATCH, stated rather than implied: an UNPOINTED
 * lossy transform in a module a concern reaches. That gap is narrower than the
 * one it replaces (which was every non-concern module, with an empty corpus to
 * show for it) and it is real. Closing it needs a lossy detector that matches
 * an applied transform rather than an identifier; the measurement above is the
 * evidence for what that would cost.
 *
 * Exit codes: 0 clean (warnings allowed) · 1 an undeclared model-facing
 * transform · 2 misuse / unreadable manifest.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_loss_class_declared [--root <dir>] [--json] [--quiet]
 *   ./scripts-run src/scripts/check_loss_class_declared --self-test
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { isProblem, parseLossDeclaration, parseLossModulePointers, type DeclarationProblem } from './_lib/loss_class.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(HERE, '..', '..');

/** Slots whose output can reach the model. */
const MODEL_FACING_SLOTS = [
    'session_start',
    'user_prompt_submit',
    'pre_compact',
    'stop',
    'post_tool_use',
    'pre_tool_use',
] as const;

/** Emitting a context payload — the "reaches the model" half. */
const EMIT_PATTERNS = [/\bcontext\s*:/, /additionalContext/, /hookSpecificOutput/];

/** Shortening, redacting or capping content — the "lossy" half. */
const LOSSY_PATTERNS = [/\bredact/i, /\btruncat/i, /\b(?:WORD|CHAR|MAX)_(?:CAP|CHARS|LEN|WORDS)\b/];

export interface LossFinding {
    concern: string;
    /** The file that owes the declaration: the concern script, or a module it points at. */
    script: string;
    tier: 'fail' | 'warn';
    problem: DeclarationProblem;
    /** Set when the finding is on a `loss_module:` pointer rather than the concern script. */
    pointedFrom?: string;
}

export interface LossVerdict {
    scanned: number;
    modelFacing: number;
    /** Modules brought into scope by a `loss_module:` pointer, repo-relative. */
    pointedModules: string[];
    findings: LossFinding[];
}

/** Strip block and line comments so the detector reads CODE, never prose about code. */
export function stripComments(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

export function emitsContext(codeOnly: string): boolean {
    return EMIT_PATTERNS.some((p) => p.test(codeOnly));
}

export function isLossy(codeOnly: string): boolean {
    return LOSSY_PATTERNS.some((p) => p.test(codeOnly));
}

function loadManifest(root: string): { concerns: Record<string, { script?: unknown }>; platforms: Record<string, Record<string, string[]>> } {
    const file = path.join(root, 'src', 'scripts', 'hook_manifest.yaml');
    const raw = fs.readFileSync(file, 'utf-8');
    const out = spawnSync(
        process.execPath,
        ['-e', 'const y=require("js-yaml");let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=y.load(s);process.stdout.write(JSON.stringify({concerns:d.concerns||{},platforms:d.platforms||{}}))})'],
        { input: raw, encoding: 'utf-8', cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 },
    );
    if (out.status !== 0 || !out.stdout) throw new Error(`hook_manifest.yaml could not be parsed: ${out.stderr || 'no output'}`);
    return JSON.parse(out.stdout) as { concerns: Record<string, { script?: unknown }>; platforms: Record<string, Record<string, string[]>> };
}

/**
 * Which concerns sit on a model-facing slot.
 *
 * A concern bound on NO slot this gate recognises is `unknown` reachability, and
 * per the council refinement it is treated as model-facing rather than skipped.
 */
export function modelFacingConcerns(platforms: Record<string, Record<string, string[]>>): Set<string> {
    const out = new Set<string>();
    for (const slots of Object.values(platforms)) {
        if (slots === null || typeof slots !== 'object') continue;
        for (const [slot, names] of Object.entries(slots)) {
            if (!Array.isArray(names)) continue;
            const facing = (MODEL_FACING_SLOTS as readonly string[]).includes(slot);
            for (const n of names) if (facing) out.add(n);
        }
    }
    return out;
}

export function evaluate(root: string = REPO_ROOT, ledger?: GateLedger): LossVerdict {
    const { concerns, platforms } = loadManifest(root);
    const facing = modelFacingConcerns(platforms);
    const bound = new Set<string>();
    for (const slots of Object.values(platforms)) {
        if (slots === null || typeof slots !== 'object') continue;
        for (const names of Object.values(slots)) if (Array.isArray(names)) for (const n of names) bound.add(n);
    }

    const findings: LossFinding[] = [];
    const pointedModules: string[] = [];
    let scanned = 0;
    let modelFacing = 0;

    ledger?.plan(Object.keys(concerns));

    for (const [name, spec] of Object.entries(concerns)) {
        const rel = typeof spec?.script === 'string' ? spec.script : null;
        if (rel === null) {
            ledger?.skip(name, 'manifest_absent');
            continue;
        }
        const abs = path.join(root, rel);
        if (!fs.existsSync(abs)) {
            ledger?.skip(name, 'no_applicable_files');
            continue;
        }
        scanned += 1;

        const source = fs.readFileSync(abs, 'utf-8');
        const code = stripComments(source);

        // Unknown reachability fails closed: a bound concern this gate cannot
        // place on a known slot is treated as model-reaching.
        const reaches = facing.has(name) || !bound.has(name);

        // A `loss_module:` pointer is a CLAIM by this concern that a named
        // module carries its lossy transform. The claim brings that module into
        // the corpus and then requires it to declare — so a pointer without a
        // declaration fails rather than exempting anything. This is the only
        // route by which a non-concern module is gated; see
        // `parseLossModulePointers` for why the alternative was rejected.
        const pointers = parseLossModulePointers(source);
        for (const target of pointers) {
            const targetAbs = path.resolve(root, target);
            if (!targetAbs.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(targetAbs)) {
                findings.push({
                    concern: name,
                    script: target,
                    tier: reaches ? 'fail' : 'warn',
                    problem: { kind: 'missing' },
                    pointedFrom: rel,
                });
                ledger?.fail(name, `loss_module points at a path outside the tree or absent: ${target}`);
                continue;
            }
            if (!pointedModules.includes(target)) pointedModules.push(target);
            if (reaches) modelFacing += 1;
            const pd = parseLossDeclaration(fs.readFileSync(targetAbs, 'utf-8'));
            if (!isProblem(pd)) continue;
            findings.push({
                concern: name,
                script: target,
                tier: reaches ? 'fail' : 'warn',
                problem: pd,
                pointedFrom: rel,
            });
            ledger?.fail(name, `pointed module ${target}: undeclared or malformed loss_class (${pd.kind})`);
        }

        if (!isLossy(code) || !emitsContext(code)) {
            // The script itself is not a lossy model-facing transform. It may
            // still have brought a module into scope above, in which case the
            // check DID apply to this concern and the ledger must not say
            // otherwise.
            if (pointers.length === 0) ledger?.outOfScope(name, 'not_applicable_kind');
            else if (!findings.some((f) => f.concern === name)) ledger?.complete(name);
            continue;
        }

        if (reaches) modelFacing += 1;

        const decl = parseLossDeclaration(source);
        if (!isProblem(decl)) {
            if (!findings.some((f) => f.concern === name)) ledger?.complete(name);
            continue;
        }
        findings.push({ concern: name, script: rel, tier: reaches ? 'fail' : 'warn', problem: decl });
        ledger?.fail(name, `undeclared or malformed loss_class (${decl.kind})`);
    }
    return { scanned, modelFacing, pointedModules, findings };
}

// ---------------------------------------------------------------- self-test

const LOSSY_EMITTER = `
const WORD_CAP = 400;
export function run() {
  const kept = redactLines(body).slice(0, WORD_CAP);
  return { context: kept.join('\\n') };
}
`;

function plant(dir: string, header: string, body: string, slot = 'session_start', pointedHeader?: string): void {
    fs.mkdirSync(path.join(dir, 'src', 'scripts'), { recursive: true });
    if (pointedHeader !== undefined) {
        fs.mkdirSync(path.join(dir, 'src', 'scripts', '_lib'), { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'src', 'scripts', '_lib', 'pointed.ts'),
            pointedHeader + 'const ROW_CAP = 30;\nexport const capRows = (r: string[]) => r.slice(0, ROW_CAP);\n',
        );
    }
    fs.writeFileSync(path.join(dir, 'src', 'scripts', 'fixture_hook.ts'), header + body);
    fs.writeFileSync(
        path.join(dir, 'src', 'scripts', 'hook_manifest.yaml'),
        `schema_version: 1\nconcerns:\n  fixture:\n    script: src/scripts/fixture_hook.ts\nplatforms:\n  claude:\n    ${slot}:\n      - fixture\n`,
    );
}

const NO_DECL = '';
const DECL_RECOVERABLE = '/**\n * loss_class: recoverable-lossy\n * loss_recovery: agents/knowledge/intake/<file>:<a>-<b>\n */\n';
const DECL_RECOVERABLE_NO_LOCATOR = '/**\n * loss_class: recoverable-lossy\n */\n';
const DECL_EPHEMERAL = '/**\n * loss_class: ephemeral-lossy\n */\n';
const DECL_TYPO = '/**\n * loss_class: recoverable_lossy\n */\n';

const POINTER = '/**\n * loss_module: src/scripts/_lib/pointed.ts\n */\n';
const POINTER_ABSENT = '/**\n * loss_module: src/scripts/_lib/does_not_exist.ts\n */\n';
const POINTER_ESCAPE = '/**\n * loss_module: ../outside/pointed.ts\n */\n';
const PLAIN_EMITTER = `export function run(){return {context:'hi'};}`;

function selfTestCases(): SelfTestCase[] {
    const mk = (
        name: string,
        expect: 'reject' | 'accept',
        header: string,
        body: string,
        slot?: string,
        pointedHeader?: string,
    ): SelfTestCase => ({
        name,
        expect,
        run: () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcd-'));
            try {
                plant(dir, header, body, slot, pointedHeader);
                return runGateCli(REPO_ROOT, 'src/scripts/check_loss_class_declared.ts', ['--root', dir, '--quiet'], REPO_ROOT);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        },
    });
    return [
        mk('model-facing lossy transform with no declaration → reject', 'reject', NO_DECL, LOSSY_EMITTER),
        mk('same transform with recoverable-lossy + locator → accept', 'accept', DECL_RECOVERABLE, LOSSY_EMITTER),
        mk('recoverable-lossy WITHOUT a locator → reject', 'reject', DECL_RECOVERABLE_NO_LOCATOR, LOSSY_EMITTER),
        mk('ephemeral-lossy (owes no locator) → accept', 'accept', DECL_EPHEMERAL, LOSSY_EMITTER),
        mk('a misspelled class is not honoured → reject', 'reject', DECL_TYPO, LOSSY_EMITTER),
        mk('non-lossy emitter needs no declaration → accept', 'accept', NO_DECL, `export function run(){return {context:'hi'};}`),
        mk('lossy but emits no context → accept', 'accept', NO_DECL, `const WORD_CAP=5;export function run(){return body.slice(0,WORD_CAP);}`),
        mk('prose about truncation is not truncation → accept', 'accept', NO_DECL, `/* we deliberately never truncate or redact here */\nexport function run(){return {context:'hi'};}`),
        // The `loss_module:` pointer. A pointer is a claim, so the polarity is
        // the opposite of an allowlist: pointing at an undeclared module is the
        // reject case, and it is the one that proves the mechanism gates rather
        // than exempts.
        mk('a pointer at an UNDECLARED module → reject', 'reject', POINTER, PLAIN_EMITTER, undefined, NO_DECL),
        mk('a pointer at a declared module → accept', 'accept', POINTER, PLAIN_EMITTER, undefined, DECL_EPHEMERAL),
        mk(
            'a pointer at a recoverable-lossy module with no locator → reject',
            'reject',
            POINTER,
            PLAIN_EMITTER,
            undefined,
            DECL_RECOVERABLE_NO_LOCATOR,
        ),
        mk('a pointer at a path that does not exist → reject', 'reject', POINTER_ABSENT, PLAIN_EMITTER),
        mk('a pointer escaping the tree → reject', 'reject', POINTER_ESCAPE, PLAIN_EMITTER),
    ];
}

// ---------------------------------------------------------------------- CLI

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) {
        return runSelfTest({ gate: 'check_loss_class_declared', cases: selfTestCases(), minCases: 12, minRejectCases: 7 });
    }
    const quiet = argv.includes('--quiet');
    const json = argv.includes('--json');
    const ri = argv.indexOf('--root');
    const rootArg = ri !== -1 ? argv[ri + 1] : undefined;
    const root = rootArg !== undefined ? path.resolve(rootArg) : REPO_ROOT;

    const ledger = new GateLedger('check_loss_class_declared');
    let v: LossVerdict;
    try {
        v = evaluate(root, ledger);
    } catch (err) {
        process.stderr.write(`❌  check_loss_class_declared: ${(err as Error).message}\n`);
        return 2;
    }

    try {
        reportScanned({ gate: 'check_loss_class_declared', scanned: v.scanned, units: 'hook script(s)', roots: ['src/scripts/hook_manifest.yaml'] });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  check_loss_class_declared: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    ledger.report();

    if (json) {
        process.stdout.write(JSON.stringify(v, null, 2) + '\n');
        return v.findings.some((f) => f.tier === 'fail') ? 1 : 0;
    }

    const say = (f: LossFinding): string => {
        switch (f.problem.kind) {
            case 'missing':
                return 'declares no loss_class';
            case 'unknown-class':
                return `declares loss_class: ${f.problem.value}, which is not one of the five`;
            case 'missing-recovery':
                return 'declares recoverable-lossy but no loss_recovery locator — without one the class is indistinguishable from ephemeral-lossy';
        }
    };

    for (const f of v.findings) {
        const stream = f.tier === 'fail' ? process.stderr : process.stdout;
        const where =
            f.pointedFrom === undefined
                ? `${f.concern} (${f.script})`
                : `${f.concern} → ${f.script}, pointed at by ${f.pointedFrom}`;
        stream.write(`${f.tier === 'fail' ? '❌' : '⚠️ '}  ${where} shortens content on a model-facing path and ${say(f)}\n`);
    }

    if (v.findings.some((f) => f.tier === 'fail')) {
        process.stderr.write(
            `\n    Add a declaration to the module's own docblock:\n` +
                `      loss_class: exact | lossless | recoverable-lossy | ephemeral-lossy | forbidden\n` +
                `      loss_recovery: <where the original is retrievable>   # recoverable-lossy only\n` +
                `    Contract: docs/contracts/loss-classes.md\n`,
        );
        return 1;
    }
    if (!quiet) {
        const pointed =
            v.pointedModules.length === 0
                ? ''
                : `; ${String(v.pointedModules.length)} declared via loss_module: ${v.pointedModules.join(', ')}`;
        process.stdout.write(
            `✅  every model-facing lossy transform declares its loss class ` +
                `(${String(v.modelFacing)} model-facing of ${String(v.scanned)} hook script(s)${pointed}).\n`,
        );
    }
    return 0;
}

if (process.env['GATE_SELF_TEST_CHILD'] !== '1' || process.argv.includes('--root')) {
    if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
        process.exit(main());
    }
}
