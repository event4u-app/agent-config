#!/usr/bin/env tsx
/**
 * Command-count messaging gate (road-to-pr-34-followups 1.2).
 *
 * TypeScript twin of `src/scripts/check_command_count_messaging.py`
 * (ADR-088, Phase 4 / Wave 4c). Mirrors the Python CLI contract EXACTLY —
 * `--quiet` flag (positional anywhere in argv), exit codes (0 clean,
 * 1 drift, 1 no-commands-dir via stderr), stdout/stderr split,
 * byte-identical messages, same canonical-count derivation
 * (iter_commands union), same per-file pattern checks in the same order.
 * No behaviour changes.
 *
 * Sources canonical counts from the command frontmatter and fails when any
 * documented number drifts (README hero badge, getting-started browse line;
 * shim-specific clauses only during a deprecation window).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { iter_commands } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const README = path.join(ROOT, 'README.md');
const AGENTS = path.join(ROOT, 'AGENTS.md');
const GETTING_STARTED = path.join(ROOT, 'docs', 'getting-started.md');

// re.DOTALL, non-greedy: `^---\s*\n(.*?)\n---`.
const FM_RE = /^---\s*\n([\s\S]*?)\n---/;
// re.MULTILINE: `^superseded_by:\s*\S`.
const SUPERSEDED_RE = /^superseded_by:\s*\S/m;

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _relTo(target: string): string {
    return path.relative(ROOT, target).split(path.sep).join('/');
}

/** Every command `*.md` across all source layouts, sorted by POSIX path. */
function _command_files(): string[] {
    const out: string[] = [];
    for (const f of iter_commands()) {
        if (path.basename(f) !== 'AGENTS.md') {
            out.push(f);
        }
    }
    return out.sort((a, b) => {
        const ap = a.split(path.sep).join('/');
        const bp = b.split(path.sep).join('/');
        return ap < bp ? -1 : ap > bp ? 1 : 0;
    });
}

function canonical_counts(): [number, number, number] {
    const files = _command_files();
    if (files.length === 0) {
        process.stderr.write('❌  no commands/ directory found under any artefact root\n');
        process.exit(1);
    }
    let total = 0;
    let shims = 0;
    for (const f of files) {
        total += 1;
        const text = fs.readFileSync(f, 'utf-8');
        const m = FM_RE.exec(text);
        const fm = m ? m[1]! : '';
        if (SUPERSEDED_RE.test(fm)) {
            shims += 1;
        }
    }
    return [total, shims, total - shims];
}

interface Check {
    path: string;
    pattern: RegExp;
    // The raw Python regex source string (what the f-string interpolates),
    // kept verbatim so the "pattern not found" message is byte-identical.
    raw: string;
    expected: number;
    label: string;
}

function _check(c: Check): string | null {
    if (!_exists(c.path)) {
        return `missing file: ${_relTo(c.path)}`;
    }
    const text = fs.readFileSync(c.path, 'utf-8');
    const m = c.pattern.exec(text);
    if (!m) {
        return `${_relTo(c.path)}: pattern not found for \`${c.label}\` — /${c.raw}/`;
    }
    const found = parseInt(m[1]!, 10);
    if (found !== c.expected) {
        return `${_relTo(c.path)}: \`${c.label}\` says ${found}, expected ${c.expected}`;
    }
    return null;
}

function main(argv: readonly string[]): number {
    const QUIET = argv.includes('--quiet');
    const [total, shims, active] = canonical_counts();
    process.stdout.write(
        `Canonical counts: ${total} files · ${shims} shims · ${active} active\n`,
    );

    const checks: Check[] = [
        {
            path: README,
            pattern: /\/badge\/Commands-(\d+)-/,
            raw: '/badge/Commands-(\\d+)-',
            expected: active,
            label: 'hero badge',
        },
        {
            path: GETTING_STARTED,
            pattern: /Browse all (\d+) active commands/,
            raw: 'Browse all (\\d+) active commands',
            expected: active,
            label: 'browse line',
        },
    ];
    if (shims > 0) {
        checks.push(
            {
                path: README,
                pattern: /\((\d+) files total /,
                raw: '\\((\\d+) files total ',
                expected: total,
                label: 'browse meta · total files',
            },
            {
                path: README,
                pattern: /— (\d+) are deprecation shims/,
                raw: '— (\\d+) are deprecation shims',
                expected: shims,
                label: 'browse meta · shims',
            },
        );
        const agents_text = _exists(AGENTS) ? fs.readFileSync(AGENTS, 'utf-8') : '';
        if (/commands\/\s+\(/.test(agents_text)) {
            checks.push(
                {
                    path: AGENTS,
                    pattern: /commands\/\s+\((\d+) files —/,
                    raw: 'commands/\\s+\\((\\d+) files —',
                    expected: total,
                    label: 'tree · total files',
                },
                {
                    path: AGENTS,
                    pattern: /files — (\d+) active/,
                    raw: 'files — (\\d+) active',
                    expected: active,
                    label: 'tree · active',
                },
                {
                    path: AGENTS,
                    pattern: /active \+ (\d+) deprecation shims/,
                    raw: 'active \\+ (\\d+) deprecation shims',
                    expected: shims,
                    label: 'tree · shims',
                },
            );
        }
    }

    const errors: string[] = [];
    for (const c of checks) {
        const err = _check(c);
        if (err) {
            errors.push(err);
        }
    }

    if (errors.length === 0) {
        if (!QUIET) {
            process.stdout.write('✅  All command-count messaging in sync with registry.\n');
        }
        return 0;
    }

    process.stdout.write(
        `❌  Command-count messaging drift — ${errors.length} mismatch(es):\n`,
    );
    for (const e of errors) {
        process.stdout.write(`    ${e}\n`);
    }
    process.stdout.write(
        '\nFix: update the documented numbers above, or run ' +
            '`task check-command-count` after editing.\n',
    );
    process.stdout.write(
        'Why this gate exists: see `agents/roadmaps/road-to-pr-34-followups.md` § 1.2.\n',
    );
    return 1;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}

export {
    ROOT,
    README,
    AGENTS,
    GETTING_STARTED,
    FM_RE,
    SUPERSEDED_RE,
    canonical_counts,
    main,
};
