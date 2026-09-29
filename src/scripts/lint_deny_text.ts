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
 * literal — comments stripped first, then any literal containing whitespace.
 *
 * The prose test is the discriminator, and it is what makes the settings-key
 * rule usable at all: `'hooks.enabled'` as a lookup key is how a concern reads
 * its own configuration and is not a message, while
 * `'set hooks.enabled: false to skip'` is. A rule that fired on the bare key
 * would fire on every concern that reads a setting, which is the false-positive
 * shape that gets a young gate disabled.
 *
 * WHAT IT DOES NOT SEE, so nobody reads more into a green than is there:
 * a message assembled at runtime from non-literal parts, a message in a module
 * the concern imports, and a kill switch named in a way none of the three
 * patterns matches. This is a pattern gate over source text, not a proof about
 * emitted bytes.
 *
 * Exit codes: 0 clean · 1 a deny names a bypass · 2 the corpus could not be read.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as yaml from 'js-yaml';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { assertScanned, reportScanned } from './_lib/scan_scope.js';

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
    readonly kind: 'env-assignment' | 'export-line' | 'settings-key';
    readonly text: string;
}

/**
 * Characters after which a `/` begins a REGEX literal rather than a division.
 *
 * Regex handling is not a nicety here, it is the difference between a working
 * gate and a nonsense one — measured on the first run against the real tree.
 * `turn_end_gate_hook.ts` carries `/\bI (wi)ll\b/i`; without this the
 * apostrophe inside a pattern like `/\bI'll\b/` opens a phantom string literal
 * that swallows the next few hundred characters of real code and comments, and
 * the gate then reports `export function …` as deny text. Three such
 * false positives, all in one file, all from one unhandled token class.
 */
const REGEX_PRECEDERS = new Set('(,=:[!&|?{};+-*%~^<>'.split(''));

/** Strip `//` and block comments, preserving string literals and regexes. */
export function stripComments(src: string): string {
    let out = '';
    let i = 0;
    let quote: string | null = null;
    let lastSignificant = '';
    while (i < src.length) {
        const c = src[i] as string;
        const next = src[i + 1];
        if (quote !== null) {
            out += c;
            if (c === '\\') {
                out += src[i + 1] ?? '';
                i += 2;
                continue;
            }
            if (c === quote) {
                quote = null;
            }
            i += 1;
            continue;
        }
        if (c === "'" || c === '"' || c === '`') {
            quote = c;
            out += c;
            i += 1;
            lastSignificant = c;
            continue;
        }
        if (c === '/' && next === '/') {
            while (i < src.length && src[i] !== '\n') i += 1;
            continue;
        }
        if (c === '/' && next === '*') {
            i += 2;
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
            i += 2;
            continue;
        }
        if (c === '/' && (lastSignificant === '' || REGEX_PRECEDERS.has(lastSignificant))) {
            // Regex literal — consumed whole, emitted as a placeholder so the
            // scanner below never sees its contents as a message.
            i += 1;
            let inClass = false;
            while (i < src.length) {
                const r = src[i] as string;
                if (r === '\\') {
                    i += 2;
                    continue;
                }
                if (r === '[') inClass = true;
                else if (r === ']') inClass = false;
                else if (r === '/' && !inClass) break;
                else if (r === '\n') break;
                i += 1;
            }
            i += 1;
            out += '0';
            lastSignificant = '0';
            continue;
        }
        out += c;
        i += 1;
        if (!/\s/.test(c)) {
            lastSignificant = c;
        }
    }
    return out;
}

/** Message-shaped string literals — comments already stripped. */
export function messageLiterals(src: string): string[] {
    const out: string[] = [];
    const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
    for (const m of src.matchAll(re)) {
        const body = m[1] ?? m[2] ?? m[3] ?? '';
        if (/\s/.test(body)) {
            out.push(body);
        }
    }
    return out;
}

const ENV_ASSIGNMENT_RE = /AGENT_CONFIG_[A-Z0-9_]+\s*=/;
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

/** Findings for one concern's source text. */
export function scanSource(concern: string, file: string, src: string): DenyFinding[] {
    const out: DenyFinding[] = [];
    for (const text of messageLiterals(stripComments(src))) {
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
        minCases: 7,
        minRejectCases: 3,
        cases: [
            {
                name: 'an empty corpus is refused, not certified green',
                expect: 'reject',
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
    process.exit(main(process.argv.slice(2)));
}
