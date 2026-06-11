#!/usr/bin/env tsx
// Auto-detection contract linter for command orchestrators (6.1.0 Step 1).
//
// TypeScript twin of src/scripts/lint_orchestrator_auto_detect.py. Every
// command source under src/domains/**/command.md that opts into auto-detection
// (front-matter `auto_detect: true`) MUST honor the non-interactive contract:
// a body link to the contract doc + the `## Non-interactive & auto-detection`
// section. `auto_detect` is only meaningful on `type: orchestrator`.
//
// Exit codes: 0 = clean, 1 = violations found, 3 = internal error.
// Violations print to stderr; the success line prints to stdout.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(path.dirname(SCRIPTS_DIR));
const DOMAINS = path.join(ROOT, 'src', 'domains');

const CONTRACT_LINK = 'contexts/execution/non-interactive-contract.md';
const SECTION_HEADING = '## Non-interactive & auto-detection';

const AUTO_DETECT_RE = /^auto_detect:\s*(true|false)\s*$/m;
const TYPE_RE = /^type:\s*orchestrator\s*$/m;

export interface Violation {
    file: string;
    reason: string;
}

function isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Recursively collect files named `command.md`, sorted by POSIX path. */
function rglobCommandMd(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(d, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(d, e.name);
            if (e.isDirectory()) {
                walk(full);
            } else if (e.isFile() && e.name === 'command.md') {
                out.push(full);
            }
        }
    };
    walk(dir);
    out.sort((a, b) => {
        const pa = a.split(path.sep).join('/');
        const pb = b.split(path.sep).join('/');
        return pa < pb ? -1 : pa > pb ? 1 : 0;
    });
    return out;
}

/** Return [frontmatter, body]; frontmatter is '' when absent. */
export function _split_frontmatter(text: string): [string, string] {
    if (!text.startsWith('---\n')) {
        return ['', text];
    }
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) {
        return ['', text];
    }
    return [text.slice(4, end), text.slice(end + '\n---\n'.length)];
}

export function check(): Violation[] {
    const violations: Violation[] = [];
    if (!isDir(DOMAINS)) {
        return violations;
    }
    for (const filePath of rglobCommandMd(DOMAINS)) {
        const text = fs.readFileSync(filePath, 'utf-8');
        const [fm, body] = _split_frontmatter(text);
        const m = AUTO_DETECT_RE.exec(fm);
        if (!m) {
            continue; // opted out of the contract — nothing to enforce
        }
        const rel = path.relative(ROOT, filePath).split(path.sep).join('/');
        const is_orchestrator = TYPE_RE.test(fm);
        if (m[1] === 'false') {
            // Explicit kill-switch — allowed, but still must be an orchestrator.
            if (!is_orchestrator) {
                violations.push({
                    file: rel,
                    reason:
                        'auto_detect set on a non-orchestrator command (type: orchestrator required)',
                });
            }
            continue;
        }
        // auto_detect: true → full contract required.
        if (!is_orchestrator) {
            violations.push({
                file: rel,
                reason:
                    'auto_detect: true on a non-orchestrator command (type: orchestrator required)',
            });
        }
        if (!body.includes(CONTRACT_LINK)) {
            violations.push({
                file: rel,
                reason: `auto_detect: true but missing a body link to ${CONTRACT_LINK}`,
            });
        }
        if (!body.includes(SECTION_HEADING)) {
            violations.push({
                file: rel,
                reason: `auto_detect: true but missing the '${SECTION_HEADING}' section`,
            });
        }
    }
    return violations;
}

function parse_args(argv: readonly string[]): { quiet: boolean } {
    let quiet = false;
    for (const arg of argv) {
        if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_orchestrator_auto_detect.py [-h] [--quiet]\n');
            process.exit(0);
        } else {
            process.stderr.write(
                `lint_orchestrator_auto_detect.py: error: unrecognized arguments: ${arg}\n`,
            );
            process.exit(2);
        }
    }
    return { quiet };
}

export function main(argv?: readonly string[]): number {
    const { quiet } = parse_args(argv ?? process.argv.slice(2));
    let violations: Violation[];
    try {
        violations = check();
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  lint-orchestrator-auto-detect: internal error: ${msg}\n`);
        return 3;
    }
    if (violations.length > 0) {
        process.stderr.write('❌  Orchestrator auto-detection contract violations:\n');
        for (const v of violations) {
            process.stderr.write(`  • ${v.file}\n      ${v.reason}\n`);
        }
        return 1;
    }
    if (!quiet) {
        process.stdout.write(
            '✅  Every auto_detect orchestrator honors the non-interactive contract.\n',
        );
    }
    return 0;
}

const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
