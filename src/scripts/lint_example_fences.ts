#!/usr/bin/env tsx
/**
 * lint_example_fences — hold authored code examples to the rules they sit beside.
 *
 * The gap this closes: every gate in this suite reads the *prose* an artifact
 * teaches. None reads the code it *shows*. A fenced block demonstrating
 * `dangerouslySetInnerHTML` on user input, or `git commit --no-verify`, passes
 * `check_references`, `lint_framework_leakage`, `skill_linter` and every
 * description check — while sitting three paragraphs under a rule that forbids
 * exactly that. The example is the part a reader copies.
 *
 * ## What it scans, and what it deliberately does not
 *
 * Scope is fenced code blocks in the three authored surfaces the roadmap names:
 * `src/rules/*.md`, `src/skills/ * /SKILL.md`, `docs/guidelines/ ** /*.md`. Prose
 * outside a fence is never read — a rule that *names* `--no-verify` in order to
 * forbid it is the common case, and reading its prose would make this gate fire
 * on every artifact that does its job.
 *
 * Patterns are **scoped by the fence's language tag**. `eval(` in a `js` fence
 * is the render-security anti-pattern; the same characters in a `text` fence are
 * usually a grammar. Scoping by tag is what keeps the registry narrow enough to
 * be believed. An untagged fence is scanned only by the language-agnostic rules.
 *
 * ## Registry provenance — and one deliberate omission
 *
 * Seeded, as the roadmap prescribes, from four rules:
 *
 * - `frontend-render-security` / `senior-engineering-discipline` § user-controlled
 *   render → the four sink patterns.
 * - `tool-safety` § no hidden credentials → a literal credential in an example.
 * - `git-history-discipline` → hook-bypass and unleased force-push.
 * - `output-discipline` → **intentionally not re-implemented.** Its six
 *   placeholder patterns are already owned by `lint_output_slop`, which scans
 *   the same fences. Detecting them twice would produce two findings per defect
 *   and two suppressions per exception. This is the "do not report what a
 *   deterministic gate already owns" rubric line applied to a gate rather than
 *   to a reviewer.
 *
 * `git reset --hard` is also deliberately absent. It is Hard-Floor-listed, but
 * this suite documents genuine divergent-state recovery procedures that must
 * show it, so a pattern for it would fire mostly on correct instruction. A gate
 * whose hits are mostly legitimate teaches maintainers to suppress by reflex.
 *
 * ## The escape token is mandatory, and there is no allowlist file
 *
 * A deliberate negative example — "never write this" followed by the thing —
 * declares itself inline:
 *
 *     <!-- example-fence-allow: render-innerhtml -- negative example for the XSS section -->
 *
 * on the fence's opening line, the line above it, or at the top of the file
 * (file scope). The reason is required and must be more than a word: an entry a
 * reviewer cannot classify from the comment alone is how a justified exception
 * becomes boilerplate. There is deliberately **no allowlist JSON**: a
 * side-channel file is the shape that grows past 20 entries and silently becomes
 * the budget bypass `autonomous-execution` names.
 *
 * ## Advisory by default
 *
 * `--strict` makes findings exit non-zero. Without it the gate reports and exits
 * 0. This is the sibling gate-integrity roadmap's lifecycle: a new pattern gate
 * over a large corpus full of intentional negatives ships advisory until every
 * current hit is classified, because a gate that lands as an unfixable blocker
 * is a recorded failure in this repository, not a hypothetical one.
 *
 * Exit codes: 0 = clean (or advisory), 1 = findings under `--strict`, 2 = usage.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REAL_REPO_ROOT = path.dirname(path.dirname(SCRIPTS_DIR));

let REPO_ROOT = REAL_REPO_ROOT;

export function _setRepoRootForTest(root: string): void {
    REPO_ROOT = root;
}
export function _resetRepoRootForTest(): void {
    REPO_ROOT = REAL_REPO_ROOT;
}

/** Language-tag families a pattern may be scoped to. `*` = any fence. */
type LangFamily = 'web' | 'shell' | 'any';

export interface FencePattern {
    /** Stable id — the token an escape comment names. */
    readonly id: string;
    /** Which rule this pattern is the code-side of. */
    readonly source: string;
    /** Fence languages the pattern applies to. */
    readonly langs: LangFamily;
    readonly label: string;
    readonly pattern: RegExp;
    /**
     * Optional second gate: the line must NOT match this to count. Used where a
     * safe form of the same call exists (`--force-with-lease`), so the safe form
     * is never a finding a reader has to reason about.
     */
    readonly unless?: RegExp;
}

const WEB_LANGS = new Set([
    'js', 'javascript', 'jsx', 'ts', 'typescript', 'tsx', 'vue', 'svelte',
    'html', 'php', 'blade', 'twig', 'erb',
]);
const SHELL_LANGS = new Set(['sh', 'bash', 'zsh', 'shell', 'console', 'terminal']);

export const PATTERNS: readonly FencePattern[] = [
    // --- frontend-render-security / senior-engineering-discipline -----------
    {
        id: 'render-innerhtml',
        source: 'frontend-render-security',
        langs: 'web',
        label: 'Unescaped HTML sink (innerHTML / outerHTML assignment)',
        pattern: /\.(inner|outer)HTML\s*=/,
    },
    {
        id: 'render-dangerously-set',
        source: 'frontend-render-security',
        langs: 'web',
        label: 'React dangerouslySetInnerHTML',
        pattern: /dangerouslySetInnerHTML/,
    },
    {
        id: 'render-v-html',
        source: 'frontend-render-security',
        langs: 'web',
        label: 'Vue v-html directive',
        pattern: /\bv-html\b/,
    },
    {
        id: 'render-document-write',
        source: 'frontend-render-security',
        langs: 'web',
        label: 'document.write() sink',
        pattern: /\bdocument\.write\s*\(/,
    },
    {
        id: 'render-eval',
        source: 'frontend-render-security',
        langs: 'web',
        label: 'eval() on a non-constant',
        // A string or numeric literal argument is a constant and cannot carry
        // user input; only a variable / expression argument is the sink.
        pattern: /\beval\s*\(\s*[A-Za-z_$][\w$.[\]]*\s*[),]/,
    },

    // --- tool-safety § no hidden credentials --------------------------------
    {
        id: 'secret-literal',
        source: 'tool-safety',
        langs: 'any',
        label: 'Credential assigned a literal value in an example',
        pattern:
            /\b(api[_-]?key|apikey|password|passwd|secret|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*["'][^"']{8,}["']/i,
        // Placeholders are the correct way to show the shape and must not fire.
        // `secret-vcs-guard` owns real credentials; this pattern owns the
        // *teaching* of an inline literal, so anything self-evidently fake is out.
        unless:
            /(your[_-]?|xxx|changeme|placeholder|example|dummy|fake|redacted|<[^>]+>|\$\{|process\.env|getenv|os\.environ|\.\.\.)/i,
    },

    // --- git-history-discipline ---------------------------------------------
    {
        id: 'git-no-verify',
        source: 'git-history-discipline',
        langs: 'shell',
        label: 'Hook bypass (--no-verify / core.hooksPath override)',
        pattern: /--no-verify\b|\bcore\.hooksPath\b/,
    },
    {
        id: 'git-force-push',
        source: 'git-history-discipline',
        langs: 'shell',
        label: 'Force-push without --force-with-lease',
        pattern: /\bgit\s+push\b[^\n]*(--force\b|(?<![\w-])-f(?![\w-]))/,
        unless: /--force-with-lease/,
    },
];

const PATTERN_IDS = new Set(PATTERNS.map((p) => p.id));

export interface Finding {
    readonly file: string;
    readonly line: number;
    readonly rule: string;
    readonly source: string;
    readonly label: string;
    readonly lang: string;
    readonly snippet: string;
}

// ---------------------------------------------------------------------------
// Escape tokens
// ---------------------------------------------------------------------------

/**
 * `example-fence-allow: <id>[,<id>] -- <reason>`
 *
 * The reason is captured so the reason-quality check below can reject a word.
 */
const ALLOW_RE = /example-fence-allow:\s*([\w-]+(?:\s*,\s*[\w-]+)*)\s*--\s*(.+?)\s*(?:-->)?\s*$/i;
const ALLOW_FILE_RE =
    /example-fence-allow-file:\s*([\w-]+(?:\s*,\s*[\w-]+)*)\s*--\s*(.+?)\s*(?:-->)?\s*$/i;

/** A reason must carry real content — three words minimum, and not just the id. */
export function reasonIsSubstantive(reason: string): boolean {
    const words = reason.trim().split(/\s+/).filter((w) => w.length > 1);
    return words.length >= 3;
}

export interface ParsedAllow {
    readonly ids: string[];
    readonly reason: string;
    readonly substantive: boolean;
}

export function parseAllow(line: string, fileScope = false): ParsedAllow | null {
    const m = (fileScope ? ALLOW_FILE_RE : ALLOW_RE).exec(line);
    if (!m || m[1] === undefined || m[2] === undefined) {
        return null;
    }
    const ids = m[1].split(',').map((s) => s.trim()).filter((s) => s !== '');
    const reason = m[2].trim();
    return { ids, reason, substantive: reasonIsSubstantive(reason) };
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

function langMatches(scope: LangFamily, lang: string): boolean {
    if (scope === 'any') {
        return true;
    }
    const l = lang.toLowerCase();
    if (scope === 'web') {
        return WEB_LANGS.has(l);
    }
    return SHELL_LANGS.has(l);
}

/**
 * Scan one authored markdown file's fenced blocks.
 *
 * Fence tracking handles both ``` and ~~~ openers and refuses to treat a longer
 * inner fence as a close — the house convention (`markdown-safe-codeblocks`)
 * wraps ```-bearing content in ~~~, and a naive toggle would read the inner
 * ``` as a close and then scan the following prose as if it were code.
 */
export function scanFile(rel: string, text: string): Finding[] {
    const lines = text.split(/\r\n|\r|\n/);
    const findings: Finding[] = [];

    const fileAllows = new Map<string, ParsedAllow>();
    for (const line of lines.slice(0, 40)) {
        const parsed = parseAllow(line, true);
        if (parsed) {
            for (const id of parsed.ids) {
                fileAllows.set(id, parsed);
            }
        }
    }

    let fenceChar: '`' | '~' | null = null;
    let fenceLen = 0;
    let lang = '';
    /** Allows declared on the opener line or the line directly above it. */
    let blockAllows = new Map<string, ParsedAllow>();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] as string;
        const open = /^\s*(`{3,}|~{3,})\s*([A-Za-z0-9_+-]*)/.exec(line);

        if (fenceChar === null) {
            if (open && open[1] !== undefined) {
                fenceChar = open[1][0] === '`' ? '`' : '~';
                fenceLen = open[1].length;
                lang = open[2] ?? '';
                blockAllows = new Map();
                for (const candidate of [line, lines[i - 1] ?? '']) {
                    const parsed = parseAllow(candidate);
                    if (parsed) {
                        for (const id of parsed.ids) {
                            blockAllows.set(id, parsed);
                        }
                    }
                }
            }
            continue;
        }

        // Inside a fence: only a run of the SAME char, at least as long, closes it.
        const close = new RegExp(`^\\s*${fenceChar === '`' ? '`' : '~'}{${String(fenceLen)},}\\s*$`);
        if (close.test(line)) {
            fenceChar = null;
            lang = '';
            continue;
        }

        for (const p of PATTERNS) {
            if (!langMatches(p.langs, lang)) {
                continue;
            }
            if (!p.pattern.test(line)) {
                continue;
            }
            if (p.unless && p.unless.test(line)) {
                continue;
            }
            const allow = blockAllows.get(p.id) ?? fileAllows.get(p.id);
            if (allow) {
                // An allow with a one-word reason is NOT an allow. Reporting it
                // as a finding is the point: the alternative is a token that
                // silences the gate while recording nothing a reviewer can use.
                if (allow.substantive) {
                    continue;
                }
                findings.push({
                    file: rel,
                    line: i + 1,
                    rule: `${p.id}/unsubstantive-reason`,
                    source: p.source,
                    label: `escape token present but its reason is too thin to review: "${allow.reason}"`,
                    lang: lang || '(untagged)',
                    snippet: line.trim().slice(0, 140),
                });
                continue;
            }
            findings.push({
                file: rel,
                line: i + 1,
                rule: p.id,
                source: p.source,
                label: p.label,
                lang: lang || '(untagged)',
                snippet: line.trim().slice(0, 140),
            });
        }
    }
    return findings;
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function* walk(dir: string, match: RegExp): Generator<string> {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            yield* walk(full, match);
        } else if (e.isFile() && match.test(e.name)) {
            yield full;
        }
    }
}

export function collectFiles(root = REPO_ROOT): string[] {
    const out: string[] = [];
    for (const f of walk(path.join(root, 'src', 'rules'), /\.md$/)) out.push(f);
    for (const f of walk(path.join(root, 'src', 'skills'), /^SKILL\.md$/)) out.push(f);
    for (const f of walk(path.join(root, 'docs', 'guidelines'), /\.md$/)) out.push(f);
    return out;
}

function relToRepo(p: string): string {
    const rel = path.relative(REPO_ROOT, p);
    // An explicit `--paths` target outside the repo (a probe in a temp dir)
    // relativises to a wall of `../`, which is unreadable and useless as a
    // copy-paste path. Show it absolute instead.
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return p;
    }
    return rel.split(path.sep).join('/');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface Args {
    readonly json: boolean;
    readonly quiet: boolean;
    readonly strict: boolean;
    readonly paths: string[];
}

function parseArgs(argv: readonly string[]): Args {
    let json = false;
    let quiet = false;
    let strict = false;
    const paths: string[] = [];
    let collecting = false;
    for (const arg of argv) {
        if (arg === '--json') { json = true; collecting = false; }
        else if (arg === '--quiet') { quiet = true; collecting = false; }
        else if (arg === '--strict') { strict = true; collecting = false; }
        else if (arg === '--paths') { collecting = true; }
        else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: lint_example_fences [--json] [--quiet] [--strict] [--paths P ...]\n',
            );
            process.exit(0);
        } else if (collecting) { paths.push(arg); }
        else {
            process.stderr.write(`lint_example_fences: unrecognized argument: ${arg}\n`);
            process.exit(2);
        }
    }
    return { json, quiet, strict, paths };
}

/** The escape comment that would silence one finding, ready to paste. */
export function suppressionKey(f: Finding): string {
    return `<!-- example-fence-allow: ${f.rule} -- <why this example must show the forbidden form> -->`;
}

export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lef-selftest-'));
    const write = (rel: string, body: string): string => {
        const p = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, body, 'utf-8');
        return p;
    };
    const run = (target: string): number =>
        runGateCli(
            REAL_REPO_ROOT,
            'src/scripts/lint_example_fences.ts',
            ['--paths', target, '--quiet', '--strict'],
            REAL_REPO_ROOT,
        );

    try {
        const bad = write('bad.md', '# Demo\n\n```js\nel.innerHTML = userInput;\n```\n');
        const clean = write('clean.md', '# Demo\n\n```js\nel.textContent = userInput;\n```\n');
        const prose = write(
            'prose.md',
            '# Demo\n\nNever assign to `.innerHTML =` on user input.\n',
        );
        const allowed = write(
            'allowed.md',
            '# Demo\n\n<!-- example-fence-allow: render-innerhtml -- negative example for the XSS section -->\n```js\nel.innerHTML = userInput;\n```\n',
        );
        const thin = write(
            'thin.md',
            '# Demo\n\n<!-- example-fence-allow: render-innerhtml -- example -->\n```js\nel.innerHTML = userInput;\n```\n',
        );
        return runSelfTest({
            gate: 'lint_example_fences',
            minCases: 3,
            minRejectCases: 2,
            cases: [
                { name: 'an XSS sink inside a fence is rejected', expect: 'reject', run: () => run(bad) },
                { name: 'the safe form passes', expect: 'accept', run: () => run(clean) },
                {
                    name: 'the same token in PROSE is not a finding — the gate reads code, not text about code',
                    expect: 'accept',
                    run: () => run(prose),
                },
                {
                    name: 'a declared negative example with a real reason passes',
                    expect: 'accept',
                    run: () => run(allowed),
                },
                {
                    name: 'an escape token whose reason is one word is still rejected',
                    expect: 'reject',
                    run: () => run(thin),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv?: readonly string[]): number {
    const raw = argv ?? process.argv.slice(2);
    if (raw.includes('--self-test')) {
        return selfTest();
    }
    const args = parseArgs(raw);

    let files: string[];
    if (args.paths.length > 0) {
        files = [];
        for (const p of args.paths) {
            const target = path.isAbsolute(p) ? p : path.join(REPO_ROOT, p);
            if (!fs.existsSync(target)) {
                process.stderr.write(`error: path does not exist: ${p}\n`);
                return 2;
            }
            if (fs.statSync(target).isDirectory()) {
                files.push(...walk(target, /\.md$/));
            } else {
                files.push(target);
            }
        }
    } else {
        files = collectFiles();
    }

    const ledger = new GateLedger('lint_example_fences');
    ledger.plan(files.map(relToRepo));

    const findings: Finding[] = [];
    for (const f of files) {
        const rel = relToRepo(f);
        let text: string;
        try {
            text = fs.readFileSync(f, 'utf-8');
        } catch {
            ledger.fail(rel, 'unreadable');
            continue;
        }
        // This file enumerates the forbidden tokens as its own subject matter;
        // it can never be clean by construction, the same self-exemption
        // `lint_framework_leakage` carries for the neutrality rule.
        if (path.basename(f) === 'lint_example_fences.md') {
            ledger.outOfScope(rel, 'declared_exemption');
            continue;
        }
        const hits = scanFile(rel, text);
        if (hits.length > 0) {
            findings.push(...hits);
            ledger.fail(rel, `${String(hits.length)} example-fence finding(s)`);
        } else {
            ledger.complete(rel);
        }
    }

    const tally = ledger.finalize();

    if (args.json) {
        process.stdout.write(
            `${JSON.stringify({ version: 1, strict: args.strict, findings, ledger: tally }, null, 2)}\n`,
        );
        return args.strict && findings.length > 0 ? 1 : 0;
    }

    if (!args.quiet) {
        let current = '';
        for (const f of findings) {
            if (f.file !== current) {
                process.stdout.write(`\n${f.file}\n`);
                current = f.file;
            }
            process.stdout.write(
                `  L${String(f.line).padStart(4, ' ')}  ${f.rule.padEnd(24, ' ')}  [${f.lang}]  ${f.snippet}\n`,
            );
            process.stdout.write(`        allow: ${suppressionKey(f)}\n`);
        }
    }

    const mode = args.strict ? 'strict' : 'ADVISORY (exit 0; pass --strict to gate)';
    process.stdout.write(
        `\nlint_example_fences: ${String(findings.length)} finding(s) across ` +
            `${String(new Set(findings.map((f) => f.file)).size)} file(s) — ${mode}\n`,
    );
    ledger.report();
    reportScanned({
        gate: 'lint_example_fences',
        scanned: tally.completed + tally.failed,
        units: 'file(s)',
        roots: ['src/rules', 'src/skills', 'docs/guidelines'],
    });
    return args.strict && findings.length > 0 ? 1 : 0;
}

export { PATTERN_IDS };

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}
