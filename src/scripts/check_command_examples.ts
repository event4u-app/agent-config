#!/usr/bin/env tsx
/**
 * `check_command_examples` — worked examples on the visible command surface.
 *
 * Three sub-checks over the commands a user can actually see
 * (`visibility: visible | advanced` in `command.md` frontmatter):
 *
 * - **(a) presence** — the command carries an `## Examples` section.
 * - **(b) resolvability** — every invocation in that section names THIS command.
 *   A rename leaves its examples naming the old slug, and nothing else in the
 *   tree notices; this is the check that does. Flags used in an example must
 *   also appear in the command body outside the fence, so a removed flag reds.
 * - **(c) pedagogy** — a Why line cites exactly one id from
 *   `src/config/discovery/prompt-patterns.yml`.
 *
 * FORWARD-ONLY, and the anchor is in this file rather than in an editable
 * exemption list. `GRANDFATHERED` below is the set of command identities that
 * were non-compliant when the gate was written, frozen per sub-check. A command
 * added, or promoted into `visible`/`advanced`, after that must comply. The
 * existing surface melts down voluntarily — removing an identity from the set
 * is a one-way ratchet the gate itself enforces (see `staleGrandfathers`).
 *
 * WHY NOT EXTEND `lint_examples.ts`. That gate's scope and observable behaviour
 * are compatibility-pinned — its `DEMO_GLOB` is asserted as a constant by its
 * test and its docstring states the quirks are preserved deliberately — and its
 * grammar (`## Demo N` + Wrong/Right/Failure-mode) is a demo-document grammar,
 * not a command grammar. AI council 2/2 (2026-08-24) decided a separate gate
 * that reuses the Why-line LITERALS rather than the code: the two conventions
 * stay textually aligned, the two populations stay uncoupled.
 *
 * Exit codes: 0 = clean, 1 = findings, 2 = dead scope.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { GateLedger } from './_lib/gate_ledger.js';
import { type SelfTestCase, runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const HERE = fileURLToPath(import.meta.url);
const REAL_REPO_ROOT = path.resolve(path.dirname(HERE), '..', '..');
/**
 * Scan root. The env override exists for `--self-test`, which drives the REAL
 * CLI against a synthetic tree — an in-process call would skip the argv parsing
 * and the entry guard, the two layers that have silently no-opped here before.
 */
const DEFAULT_ROOT = process.env['CHECK_COMMAND_EXAMPLES_ROOT'] ?? REAL_REPO_ROOT;
export const COMMAND_ROOT = 'src/domains';
export const VOCAB_FILE = 'src/config/discovery/prompt-patterns.yml';

/** The two visibility values that make a command part of the user-facing surface. */
export const IN_SCOPE_VISIBILITY = ['visible', 'advanced'] as const;

/**
 * Command identities non-compliant at the 2026-08-24 baseline, per sub-check.
 *
 * Measured, not estimated. The roadmap step pre-registered "4 of 61 top-level
 * commands"; both halves were wrong. The classifier is `visibility` (the integer
 * `tier:` alias was removed from `command.schema.json`), the in-scope population
 * is 23 — `visible` 5 + `advanced` 18 — and 5 of those carry an `## Examples`
 * heading. So 18 fail (a).
 *
 * (c) is the number that surprises: of the 5 sections that exist, ZERO carry a
 * Why line. Every one is a bare fence of invocations. So the convention this
 * gate enforces is satisfied in full by no command in the tree today, and
 * grandfathering (c) for all 5 is what keeps the gate forward-only rather than
 * a 23-finding wall on the PR that introduces it.
 */
export const GRANDFATHERED = {
    /** No `## Examples` section at the baseline. */
    presence: [
        'agents',
        'analyze',
        'condense',
        'council',
        'feature',
        'fix',
        'git-commit',
        'git-pr-create',
        'git-pr-merge',
        'jira-ticket',
        'judge',
        'memory',
        'mode',
        'optimize',
        'review',
        'roadmap',
        'agent-handoff',
        'agent-status',
    ] as readonly string[],
    /** Has a section, no Why line at the baseline. */
    whyLine: [
        'estimate-ticket',
        'implement-ticket',
        'mission-upgrade',
        'refine-ticket',
        'work',
    ] as readonly string[],
} as const;

export interface CommandRecord {
    /** `name:` frontmatter — the identity used by the grandfather set. */
    name: string;
    visibility: string;
    file: string;
    body: string;
    /** The `## Examples` section text, or null when absent. */
    examples: string | null;
}

export interface Finding {
    name: string;
    file: string;
    check: 'presence' | 'resolvable' | 'why-line' | 'stale-grandfather';
    message: string;
}

/** The approved pattern ids and the two Why-line literals. */
export function readVocabulary(root = DEFAULT_ROOT): {
    patterns: string[];
    literals: string[];
} {
    const abs = path.join(root, VOCAB_FILE);
    const doc = parseYaml(fs.readFileSync(abs, 'utf-8')) as {
        approved_patterns?: unknown;
        why_line_literals?: unknown;
    };
    const patterns = Array.isArray(doc.approved_patterns) ? doc.approved_patterns.map(String) : [];
    const literals = Array.isArray(doc.why_line_literals) ? doc.why_line_literals.map(String) : [];
    if (patterns.length === 0 || literals.length === 0) {
        throw new DeadScopeError(
            'check_command_examples',
            `${VOCAB_FILE} carries no approved_patterns or no why_line_literals — ` +
                'the vocabulary is the gate\'s corpus and an empty one checks nothing',
        );
    }
    return { patterns, literals };
}

function frontmatter(text: string): string {
    const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
    return m ? m[1]! : '';
}

function fmValue(fm: string, key: string): string | null {
    const m = new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(fm);
    return m ? m[1]!.trim().replace(/^["']|["']$/g, '') : null;
}

/** The `## Examples` section body, up to the next same-or-higher heading. */
export function extractExamples(text: string): string | null {
    const m = /^(#{2,})\s*Examples\b.*$/m.exec(text);
    if (!m) return null;
    const level = m[1]!.length;
    const start = m.index + m[0].length;
    const rest = text.slice(start);
    const next = new RegExp(`^#{1,${level}}\\s`, 'm').exec(rest);
    return next ? rest.slice(0, next.index) : rest;
}

/** Walk the command corpus and read what the three checks need. */
export function collectCommands(root = DEFAULT_ROOT): CommandRecord[] {
    const base = path.join(root, COMMAND_ROOT);
    const out: CommandRecord[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(p);
            } else if (e.name === 'command.md') {
                const text = fs.readFileSync(p, 'utf-8');
                const fm = frontmatter(text);
                const visibility = fmValue(fm, 'visibility') ?? 'internal';
                if (!(IN_SCOPE_VISIBILITY as readonly string[]).includes(visibility)) continue;
                const name = fmValue(fm, 'name');
                if (!name) continue;
                out.push({
                    name,
                    visibility,
                    file: path.relative(root, p),
                    body: text,
                    examples: extractExamples(text),
                });
            }
        }
    };
    walk(base);
    return out;
}

/** Invocation lines inside the section — the ones a reader would type. */
export function invocations(section: string): string[] {
    return section
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('/'))
        .map((l) => l.replace(/\s+#.*$/, '').trim());
}

/**
 * Does this invocation name the command it sits in?
 *
 * A command's slash form renders three ways across hosts — `/a-b-c`, `/a:b:c`,
 * `/a b c` — and the tree uses all three (`/mission:upgrade` for
 * `mission-upgrade`, `/challenge-me vision` for a nested one). So the leading
 * token run is normalized on `:` and space to `-` and compared to `name`,
 * longest prefix first. An ALIAS that is not the `name:` is deliberately NOT
 * accepted: `/pr:create` does not resolve to `git-pr-create`, and a command
 * that genuinely ships an alias declares it (`replaces:`) rather than having
 * the gate guess.
 */
export function invocationResolves(line: string, name: string): boolean {
    const tokens = line.replace(/^\//, '').split(/\s+/).filter(Boolean);
    const segments = name.split('-').length;
    for (let k = Math.min(tokens.length, segments); k >= 1; k--) {
        const candidate = tokens
            .slice(0, k)
            .join('-')
            .replace(/:/g, '-');
        if (candidate === name) return true;
    }
    return false;
}

/** Long flags used in the examples (`--personas=+qa` → `--personas`). */
export function flagsUsed(section: string): string[] {
    const found = new Set<string>();
    for (const m of section.matchAll(/(--[a-z][a-z0-9-]*)/g)) found.add(m[1]!);
    return [...found].sort();
}

export function checkCommand(
    cmd: CommandRecord,
    vocab: { patterns: string[]; literals: string[] },
): Finding[] {
    const out: Finding[] = [];
    const grandPresence = GRANDFATHERED.presence.includes(cmd.name);
    const grandWhy = GRANDFATHERED.whyLine.includes(cmd.name);

    if (cmd.examples === null) {
        if (!grandPresence) {
            out.push({
                name: cmd.name,
                file: cmd.file,
                check: 'presence',
                message:
                    `visibility: ${cmd.visibility} but no '## Examples' section. ` +
                    'A user-facing command shows 1-3 filled invocations.',
            });
        }
        return out;
    }

    // (a) inverse: the grandfather entry is stale once the command complies.
    if (grandPresence) {
        out.push({
            name: cmd.name,
            file: cmd.file,
            check: 'stale-grandfather',
            message:
                "now has an '## Examples' section — remove it from " +
                'GRANDFATHERED.presence in check_command_examples.ts. The set only shrinks.',
        });
    }

    // (b) resolvability.
    const invs = invocations(cmd.examples);
    if (invs.length === 0) {
        out.push({
            name: cmd.name,
            file: cmd.file,
            check: 'resolvable',
            message: "'## Examples' section carries no invocation line starting with '/'",
        });
    }
    for (const line of invs) {
        if (!invocationResolves(line, cmd.name)) {
            out.push({
                name: cmd.name,
                file: cmd.file,
                check: 'resolvable',
                message: `example '${line}' does not resolve to '${cmd.name}' — renamed command, or a typo`,
            });
        }
    }
    const bodyOutsideExamples = cmd.body.replace(cmd.examples, '');
    for (const flag of flagsUsed(cmd.examples)) {
        if (!bodyOutsideExamples.includes(flag)) {
            out.push({
                name: cmd.name,
                file: cmd.file,
                check: 'resolvable',
                message: `example uses '${flag}' but the body never documents it — removed flag, or a typo`,
            });
        }
    }

    // (c) pedagogy.
    const hasLiteral = vocab.literals.some((l) => cmd.examples!.includes(l));
    if (!hasLiteral) {
        if (!grandWhy) {
            out.push({
                name: cmd.name,
                file: cmd.file,
                check: 'why-line',
                message:
                    `no Why line (${vocab.literals.join(' or ')}) in '## Examples'. ` +
                    'The Why line is what transfers to a command the reader has not seen.',
            });
        }
    } else {
        if (grandWhy) {
            out.push({
                name: cmd.name,
                file: cmd.file,
                check: 'stale-grandfather',
                message:
                    'now carries a Why line — remove it from GRANDFATHERED.whyLine in ' +
                    'check_command_examples.ts. The set only shrinks.',
            });
        }
        const cited = vocab.patterns.filter((p) => new RegExp(`\\b${p}\\b`).test(cmd.examples!));
        if (cited.length === 0) {
            out.push({
                name: cmd.name,
                file: cmd.file,
                check: 'why-line',
                message:
                    `Why line cites no registered pattern id. Pick one of: ${vocab.patterns.join(', ')} (${VOCAB_FILE}).`,
            });
        } else if (cited.length > 1) {
            out.push({
                name: cmd.name,
                file: cmd.file,
                check: 'why-line',
                message: `Why line cites ${cited.length} pattern ids (${cited.join(', ')}) — cite exactly one.`,
            });
        }
    }
    return out;
}

/**
 * Grandfather entries naming a command that no longer exists or is no longer
 * in scope. Left in place they would hide a NEW command that happens to reuse
 * the name — the exemption-list failure mode the council named.
 */
export function staleGrandfathers(cmds: CommandRecord[]): Finding[] {
    const live = new Set(cmds.map((c) => c.name));
    const out: Finding[] = [];
    for (const [bucket, names] of Object.entries(GRANDFATHERED)) {
        for (const n of names) {
            if (!live.has(n)) {
                out.push({
                    name: n,
                    file: `src/scripts/check_command_examples.ts (GRANDFATHERED.${bucket})`,
                    check: 'stale-grandfather',
                    message:
                        'grandfathered but no longer an in-scope command — deleted, renamed, ' +
                        'or demoted to internal. Remove the entry.',
                });
            }
        }
    }
    return out;
}

export function evaluate(
    root = DEFAULT_ROOT,
): { findings: Finding[]; scanned: number; ledger: GateLedger } {
    const vocab = readVocabulary(root);
    const cmds = collectCommands(root);
    const findings = [...staleGrandfathers(cmds)];
    // Per-target accounting: "clean" and "read almost nothing" must not print
    // the same line. Every in-scope command is planned and reaches exactly one
    // outcome, so the denominator is the corpus rather than whatever the walk
    // happened to reach.
    const ledger = new GateLedger('check_command_examples');
    ledger.plan(cmds.map((c) => c.file));
    for (const c of cmds) {
        const own = checkCommand(c, vocab);
        findings.push(...own);
        if (own.length === 0) {
            ledger.complete(c.file);
        } else {
            ledger.fail(c.file, own.map((f) => `[${f.check}] ${f.message}`).join(' · '));
        }
    }
    return { findings, scanned: cmds.length, ledger };
}

/**
 * A synthetic corpus that is compliant BY CONSTRUCTION, then broken one way per
 * case.
 *
 * The fixture stubs every grandfathered identity, because `staleGrandfathers` is
 * a real check and a corpus missing all 23 would red every case including the
 * accept one — which would make the suite prove nothing about the check under
 * test. A realistic corpus is the only fixture that isolates one variable.
 */
function selfTestRoot(tmp: string, extra: { name: string; body: string } | null): string {
    const root = fs.mkdtempSync(path.join(tmp, 'repo-'));
    fs.mkdirSync(path.join(root, path.dirname(VOCAB_FILE)), { recursive: true });
    fs.copyFileSync(path.join(REAL_REPO_ROOT, VOCAB_FILE), path.join(root, VOCAB_FILE));
    const write = (name: string, body: string): void => {
        const dir = path.join(root, COMMAND_ROOT, 'selftest', name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'command.md'),
            `---\nname: ${name}\ndescription: fixture\ndisable-model-invocation: true\n` +
                `visibility: visible\n---\n\n# ${name}\n\n${body}\n`,
        );
    };
    for (const n of GRANDFATHERED.presence) write(n, 'No examples — grandfathered on (a).');
    for (const n of GRANDFATHERED.whyLine) {
        write(n, `## Examples\n\n\`\`\`\n/${n} something\n\`\`\`\n`);
    }
    if (extra) write(extra.name, extra.body);
    return root;
}

const GOOD_BODY = [
    'Documented flag: `--deep`.',
    '',
    '## Examples',
    '',
    '```',
    '/selftest-probe tests/feature/auth --deep',
    '```',
    '',
    '**Why it works:** measurable-target — it names the file, not the symptom.',
].join('\n');

export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cce-selftest-'));
    const run = (root: string): number => {
        process.env['CHECK_COMMAND_EXAMPLES_ROOT'] = root;
        try {
            return runGateCli(REAL_REPO_ROOT, 'src/scripts/check_command_examples.ts', ['--quiet'], root);
        } finally {
            delete process.env['CHECK_COMMAND_EXAMPLES_ROOT'];
        }
    };
    const probe = (body: string): number => run(selfTestRoot(tmp, { name: 'selftest-probe', body }));
    const cases: SelfTestCase[] = [
        {
            name: 'a compliant new command is accepted',
            expect: 'accept',
            run: () => probe(GOOD_BODY),
        },
        {
            name: 'the grandfathered corpus alone is accepted — forward-only, not a wall',
            expect: 'accept',
            run: () => run(selfTestRoot(tmp, null)),
        },
        {
            name: '(a) a new visible command with no Examples section is rejected',
            expect: 'reject',
            run: () => probe('Just prose, no examples.'),
        },
        {
            name: '(b) an invocation naming a different slug is rejected',
            expect: 'reject',
            run: () => probe(GOOD_BODY.replace('/selftest-probe', '/renamed-away')),
        },
        {
            name: '(b) a flag used in an example but undocumented in the body is rejected',
            expect: 'reject',
            run: () => probe(GOOD_BODY.replace('Documented flag: `--deep`.', '')),
        },
        {
            name: '(c) an Examples section with no Why line is rejected',
            expect: 'reject',
            run: () =>
                probe(
                    GOOD_BODY.replace(
                        '**Why it works:** measurable-target — it names the file, not the symptom.',
                        '',
                    ),
                ),
        },
        {
            name: '(c) an unregistered pattern id is rejected',
            expect: 'reject',
            run: () => probe(GOOD_BODY.replace('measurable-target', 'be-nice-to-the-model')),
        },
        {
            name: 'a dead scan root exits non-zero rather than reporting clean',
            expect: 'reject',
            run: () => {
                const root = selfTestRoot(tmp, { name: 'selftest-probe', body: GOOD_BODY });
                fs.writeFileSync(path.join(root, VOCAB_FILE), 'approved_patterns: []\n');
                return run(root);
            },
        },
    ];
    try {
        return runSelfTest({
            gate: 'check_command_examples',
            cases,
            minCases: 8,
            minRejectCases: 6,
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: string[] = process.argv.slice(2), root = DEFAULT_ROOT): number {
    if (argv.includes('--self-test')) return selfTest();
    const quiet = argv.includes('--quiet');
    let result: { findings: Finding[]; scanned: number; ledger: GateLedger };
    try {
        result = evaluate(root);
        reportScanned({
            gate: 'check_command_examples',
            scanned: result.scanned,
            units: 'visible/advanced command(s)',
            roots: [COMMAND_ROOT],
        });
        result.ledger.report(quiet ? () => undefined : process.stdout.write.bind(process.stdout));
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }
    if (result.findings.length === 0) {
        if (!quiet) {
            process.stdout.write(
                `✅  ${result.scanned} visible/advanced command(s): examples present, resolvable, and cited.\n`,
            );
        }
        return 0;
    }
    for (const f of result.findings) {
        process.stderr.write(`❌  ${f.file} [${f.check}] ${f.name}: ${f.message}\n`);
    }
    process.stderr.write(`\n${result.findings.length} finding(s).\n`);
    return 1;
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(HERE)) {
    process.exit(main());
}
