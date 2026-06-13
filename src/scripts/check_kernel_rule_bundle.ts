#!/usr/bin/env tsx
/**
 * check_kernel_rule_bundle — Phase 4.2 of road-to-always-budget-relief.
 *
 * TypeScript twin of `src/scripts/check_kernel_rule_bundle.py` (ADR-094,
 * Phase 4 / Wave 4c). The CLI contract is mirrored EXACTLY — `--base-ref`
 * / `--label` / `--event-path` / `--files` flags, exit codes (0 pass,
 * 1 fail, 3 internal error), stdout/stderr split, byte-identical finding
 * messages, the same git-diff invocation, base-ref candidate order, and
 * PR-label parsing from the GitHub event JSON. No behaviour changes —
 * latent bugs replicated.
 *
 * Fails when a single PR (or commit range) modifies more than one
 * kernel rule under `.agent-src.uncondensed/rules/`. Override via the
 * PR label `bundled-always-rules-acknowledged`.
 *
 * Kernel set is the locked 9-rule list in
 * `docs/contracts/rule-classification.md` § 3.1, mirrored as
 * `KERNEL_RULES` below.
 *
 * Inputs:
 *   --base-ref REF   git ref to diff against (default: origin/main, then main)
 *   --label NAME     PR label that overrides the gate (default:
 *                    bundled-always-rules-acknowledged)
 *   --event-path P   GitHub event JSON (defaults to $GITHUB_EVENT_PATH)
 *   --files F [F …]  override changed-file list (testing only)
 *
 * Exit codes: 0 = pass · 1 = fail (> 1 kernel rule, no override) ·
 * 3 = internal error.
 *
 * Source: `agents/settings/contexts/adr-always-budget-relief-strategy.md`.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const KERNEL_RULES: ReadonlySet<string> = new Set([
    'agent-authority.md',
    'ask-when-uncertain.md',
    'commit-policy.md',
    'direct-answers.md',
    'language-and-tone.md',
    'no-cheap-questions.md',
    'non-destructive-by-default.md',
    'scope-control.md',
    'verify-before-complete.md',
]);

const KERNEL_DIR = '.agent-src.uncondensed/rules';
const DEFAULT_LABEL = 'bundled-always-rules-acknowledged';

function _git_changed_files(base_ref: string): string[] {
    const res = spawnSync('git', ['diff', '--name-only', `${base_ref}...HEAD`], {
        encoding: 'utf8',
    });
    // Python uses check_output(stderr=STDOUT, text=True): on non-zero it raises
    // CalledProcessError and the handler prints the combined output. spawnSync
    // does not raise; mirror by checking status and combining stdout+stderr.
    if (res.status !== 0) {
        const combined = `${res.stdout ?? ''}${res.stderr ?? ''}`;
        process.stderr.write(`❌  git diff failed: ${combined.trim()}\n`);
        return [];
    }
    return (res.stdout ?? '').split('\n').filter((line) => line.trim() !== '');
}

function _resolve_base_ref(explicit: string | null): string {
    if (explicit) {
        return explicit;
    }
    for (const candidate of ['origin/main', 'origin/master', 'main', 'master']) {
        const res = spawnSync('git', ['rev-parse', '--verify', candidate], {
            stdio: ['ignore', 'ignore', 'ignore'],
        });
        if (res.status === 0) {
            return candidate;
        }
    }
    return 'HEAD~1';
}

function _pr_labels(event_path: string | null): string[] {
    const p = event_path ?? process.env['GITHUB_EVENT_PATH'] ?? null;
    if (!p || !_exists(p)) {
        return [];
    }
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
        return [];
    }
    const obj = (data ?? {}) as Record<string, unknown>;
    const pr = (obj['pull_request'] ?? {}) as Record<string, unknown>;
    const labels = (pr['labels'] ?? []) as Array<Record<string, unknown>>;
    if (!Array.isArray(labels)) {
        return [];
    }
    const out: string[] = [];
    for (const lbl of labels) {
        const name = (lbl as Record<string, unknown>)['name'];
        if (typeof name === 'string' && name) {
            out.push(name);
        }
    }
    return out;
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _kernel_changes(files: readonly string[]): string[] {
    const hits: string[] = [];
    for (const p of files) {
        if (!p.startsWith(`${KERNEL_DIR}/`)) {
            continue;
        }
        const name = _basename(p);
        if (KERNEL_RULES.has(name)) {
            hits.push(p);
        }
    }
    // sorted(set(hits)) — dedupe + sort.
    return [...new Set(hits)].sort();
}

function _basename(p: string): string {
    const norm = p.replace(/[/\\]+$/, '');
    const idx = Math.max(norm.lastIndexOf('/'), norm.lastIndexOf('\\'));
    return idx === -1 ? norm : norm.slice(idx + 1);
}

interface Args {
    base_ref: string | null;
    label: string;
    event_path: string | null;
    files: string[] | null;
}

function parse_args(argv: readonly string[]): Args {
    const args: Args = {
        base_ref: null,
        label: DEFAULT_LABEL,
        event_path: null,
        files: null,
    };
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] as string;
        if (arg === '--base-ref') {
            args.base_ref = (argv[++i] as string) ?? null;
        } else if (arg === '--label') {
            args.label = (argv[++i] as string) ?? DEFAULT_LABEL;
        } else if (arg === '--event-path') {
            args.event_path = (argv[++i] as string) ?? null;
        } else if (arg === '--files') {
            // nargs="*": consume all following non-flag tokens.
            const collected: string[] = [];
            while (i + 1 < argv.length && !(argv[i + 1] as string).startsWith('--')) {
                collected.push(argv[++i] as string);
            }
            args.files = collected;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: check_kernel_rule_bundle [-h] ...\n');
            process.exit(0);
        } else {
            process.stderr.write(`check_kernel_rule_bundle: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        }
        i++;
    }
    return args;
}

export function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    // Python: args.files or _git_changed_files(...). An empty list from
    // `--files` (no values) is falsy in Python → falls through to git diff.
    const files =
        args.files && args.files.length > 0
            ? args.files
            : _git_changed_files(_resolve_base_ref(args.base_ref));
    const hits = _kernel_changes(files);

    if (hits.length <= 1) {
        if (hits.length) {
            process.stdout.write(`✅  OK  kernel-rule bundle: 1 rule touched (${hits[0]})\n`);
        } else {
            process.stdout.write('✅  OK  kernel-rule bundle: no kernel rule touched\n');
        }
        return 0;
    }

    const labels = _pr_labels(args.event_path);
    if (labels.includes(args.label)) {
        process.stdout.write(
            `✅  OK  kernel-rule bundle: ${hits.length} rules touched but ` +
                `label '${args.label}' present\n`,
        );
        for (const h of hits) {
            process.stdout.write(`   · ${h}\n`);
        }
        return 0;
    }

    process.stderr.write(
        `❌  FAIL  kernel-rule bundle: ${hits.length} kernel rules touched in ` +
            'one PR — slow-rollout requires one-rule-per-PR.\n',
    );
    process.stderr.write('   Touched:\n');
    for (const h of hits) {
        process.stderr.write(`   · ${h}\n`);
    }
    process.stderr.write(
        `   Override: add the label '${args.label}' on the PR and ` +
            'document the bundle rationale in the PR body.\n',
    );
    process.stderr.write(
        '   Source: agents/settings/contexts/adr-always-budget-relief-strategy.md ' +
            '(Phase 4.2).\n',
    );
    return 1;
}

const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { KERNEL_RULES, KERNEL_DIR, DEFAULT_LABEL, _kernel_changes };
