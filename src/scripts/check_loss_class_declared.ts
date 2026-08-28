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
 * Measured at landing: **1** module qualifies — `hot_context_hook`, which is
 * exactly the `ephemeral-lossy` exemplar the contract classifies. A corpus of one
 * is the honest state of this tree, not a broken detector; the gate fires the day
 * a second lands.
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
import { isProblem, parseLossDeclaration, type DeclarationProblem } from './_lib/loss_class.js';
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
    script: string;
    tier: 'fail' | 'warn';
    problem: DeclarationProblem;
}

export interface LossVerdict {
    scanned: number;
    modelFacing: number;
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
        if (!isLossy(code) || !emitsContext(code)) {
            // Not a lossy model-facing transform: the check does not apply to it.
            ledger?.outOfScope(name, 'not_applicable_kind');
            continue;
        }

        // Unknown reachability fails closed: a bound concern this gate cannot
        // place on a known slot is treated as model-reaching.
        const reaches = facing.has(name) || !bound.has(name);
        if (reaches) modelFacing += 1;

        const decl = parseLossDeclaration(source);
        if (!isProblem(decl)) {
            ledger?.complete(name);
            continue;
        }
        findings.push({ concern: name, script: rel, tier: reaches ? 'fail' : 'warn', problem: decl });
        ledger?.fail(name, `undeclared or malformed loss_class (${decl.kind})`);
    }
    return { scanned, modelFacing, findings };
}

// ---------------------------------------------------------------- self-test

const LOSSY_EMITTER = `
const WORD_CAP = 400;
export function run() {
  const kept = redactLines(body).slice(0, WORD_CAP);
  return { context: kept.join('\\n') };
}
`;

function plant(dir: string, header: string, body: string, slot = 'session_start'): void {
    fs.mkdirSync(path.join(dir, 'src', 'scripts'), { recursive: true });
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

function selfTestCases(): SelfTestCase[] {
    const mk = (name: string, expect: 'reject' | 'accept', header: string, body: string, slot?: string): SelfTestCase => ({
        name,
        expect,
        run: () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcd-'));
            try {
                plant(dir, header, body, slot);
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
    ];
}

// ---------------------------------------------------------------------- CLI

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) {
        return runSelfTest({ gate: 'check_loss_class_declared', cases: selfTestCases(), minCases: 7, minRejectCases: 3 });
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
        stream.write(`${f.tier === 'fail' ? '❌' : '⚠️ '}  ${f.concern} (${f.script}) shortens content on a model-facing path and ${say(f)}\n`);
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
        process.stdout.write(
            `✅  every model-facing lossy transform declares its loss class ` +
                `(${String(v.modelFacing)} model-facing of ${String(v.scanned)} hook script(s)).\n`,
        );
    }
    return 0;
}

if (process.env['GATE_SELF_TEST_CHILD'] !== '1' || process.argv.includes('--root')) {
    if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
        process.exit(main());
    }
}
