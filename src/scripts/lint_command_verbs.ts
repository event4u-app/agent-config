#!/usr/bin/env tsx
/**
 * Controlled-verb linter for visible commands.
 *
 * TypeScript twin of `src/scripts/lint_command_verbs.py` (ADR-088,
 * Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY — `--baseline`
 * / `--all` / `--quiet` flags, exit codes (0 clean, 1 violations, 3
 * internal error), stdout/stderr split, byte-identical finding messages,
 * same scan scope (forward-only git diff + working-tree status, or every
 * visible command under `--all`), and the same sorted iteration order.
 * snake_case kept. No behaviour changes — latent bugs replicated.
 *
 * A VISIBLE command (tier 0/1) must have a leading token drawn from the
 * approved verb allowlist in `src/config/discovery/command-verbs.yml`.
 * `create-*` is a banned leading token for new visible commands
 * (`create-pr` is grandfathered).
 *
 * Exit codes: 0 = clean, 1 = violations found, 3 = internal error.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/lint_command_verbs.ts → three dirs up is the repo root.
// Mirrors Python `Path(__file__).resolve().parent.parent.parent`.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const VERBS_YML = path.join(ROOT, 'src', 'config', 'discovery', 'command-verbs.yml');
const _CMD_PATH_RE = /\.agent-src\.uncondensed\/commands\/.+\.md$/;
const NAME_RE = /^name:\s*(.*)$/m;
const TIER_RE = /^tier:\s*(\d+)/m;
const SUB_RE = /^sub:\s*(.*)$/m;
const VISIBLE_TIERS: ReadonlySet<number> = new Set([0, 1]);

interface Violation {
    file: string;
    rule: string;
    reason: string;
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** POSIX relative path of `target` under `root` (str(Path.relative_to)). */
function _relTo(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

/** Strip one leading and one trailing matching quote pair, mirroring Python
 * `.strip('"').strip("'")` chains applied to a value. */
function _stripQuotes(value: string): string {
    let v = value;
    // Python `.strip('"')` removes ALL leading/trailing double quotes, then
    // `.strip("'")` removes ALL leading/trailing single quotes.
    v = v.replace(/^"+/, '').replace(/"+$/, '');
    v = v.replace(/^'+/, '').replace(/'+$/, '');
    return v;
}

function load_config(): { approved: Set<string>; banned: Set<string>; grandfathered: Set<string> } {
    let raw: string;
    try {
        raw = fs.readFileSync(VERBS_YML, 'utf-8');
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`❌  No approved_verbs in ${VERBS_YML}\n`);
        // Match Python: a load failure surfaces as missing approved_verbs.
        void msg;
        process.exit(3);
    }
    const data = (parseYaml(raw, { version: '1.1' }) as Record<string, unknown> | null) ?? {};
    const approved = new Set<string>((data['approved_verbs'] as string[] | null) ?? []);
    const banned = new Set<string>((data['banned_prefixes'] as string[] | null) ?? []);
    const grandfathered = new Set<string>((data['grandfathered'] as string[] | null) ?? []);
    if (approved.size === 0) {
        process.stderr.write(`❌  No approved_verbs in ${VERBS_YML}\n`);
        process.exit(3);
    }
    return { approved, banned, grandfathered };
}

function _git(args: string[], tolerant = false): string {
    const r = spawnSync('git', args, {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 15000,
    });
    if (r.error) {
        // FileNotFoundError / timeout equivalent.
        process.stderr.write(`❌  git ${args.join(' ')} failed: ${r.error.message}\n`);
        process.exit(3);
    }
    if (r.status !== 0) {
        if (tolerant) {
            return '';
        }
        process.stderr.write(`❌  git ${args.join(' ')} exit ${r.status}: ${r.stderr}\n`);
        process.exit(3);
    }
    return r.stdout;
}

/** (name, tier, sub) from frontmatter text; tier defaults to 2 (internal). */
function _parse(text: string): { name: string | null; tier: number; sub: string | null } {
    const nm = NAME_RE.exec(text);
    const name = nm ? _stripQuotes(nm[1]!.trim()) : null;
    const tm = TIER_RE.exec(text);
    const tier = tm ? parseInt(tm[1]!, 10) : 2;
    const sm = SUB_RE.exec(text);
    const sub = sm ? _stripQuotes(sm[1]!.trim()) : null;
    return { name, tier, sub };
}

function changed_command_files(baseline: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const kind of ['A', 'M'] as const) {
        const diff = _git([
            'diff',
            '--name-only',
            `--diff-filter=${kind}`,
            `${baseline}...HEAD`,
        ]);
        for (const line of diff.split('\n')) {
            const p = line.trim();
            if (p && _CMD_PATH_RE.test(p)) {
                out[p] = kind;
            }
        }
    }
    const status = _git(['status', '--porcelain', '-uall']);
    for (const line of status.split('\n')) {
        if (line === '') {
            continue;
        }
        const st = line.slice(0, 2).trim();
        const filePart = line.slice(3).trim().split(' -> ').pop()!;
        if (_CMD_PATH_RE.test(filePart)) {
            out[filePart] =
                st === 'A' || st === '??' || st === 'AM' ? 'A' : (out[filePart] ?? 'M');
        }
    }
    return out;
}

/** Recursively list `*.md` files under `dir`, mirroring Path.rglob('*.md'). */
function _rglobMd(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                out.push(full);
            }
        }
    };
    walk(dir);
    return out;
}

function all_visible_command_files(): Record<string, string> {
    const out: Record<string, string> = {};
    const pkgs = path.join(ROOT, 'packages');
    let roots: string[] = [];
    if (_exists(pkgs) && fs.statSync(pkgs).isDirectory()) {
        // packages/*/.agent-src.uncondensed/commands directories.
        let pkgDirs: fs.Dirent[];
        try {
            pkgDirs = fs.readdirSync(pkgs, { withFileTypes: true });
        } catch {
            pkgDirs = [];
        }
        for (const d of pkgDirs) {
            const cand = path.join(pkgs, d.name, '.agent-src.uncondensed', 'commands');
            if (_exists(cand) && fs.statSync(cand).isDirectory()) {
                roots.push(cand);
            }
        }
        roots = roots.sort();
    }
    for (const root of roots) {
        for (const md of _rglobMd(root)) {
            const parts = _relTo(md, ROOT).split('/');
            if (path.basename(md) === 'AGENTS.md' || parts.includes('_archive')) {
                continue;
            }
            out[_relTo(md, ROOT)] = 'A';
        }
    }
    return out;
}

function leading_token(name: string, sub: string | null = null): string {
    const base = sub ? sub : name.split(':').pop()!;
    return base.split('-')[0]!;
}

function check(
    relpath: string,
    kind: string,
    baseline: string,
    approved: Set<string>,
    banned: Set<string>,
    grandfathered: Set<string>,
): Violation[] {
    const abs_path = path.join(ROOT, relpath);
    if (!_exists(abs_path)) {
        return []; // deleted
    }
    const { name, tier, sub } = _parse(fs.readFileSync(abs_path, 'utf-8'));
    if (name === null || !VISIBLE_TIERS.has(tier)) {
        return []; // internal / unnamed — not gated
    }
    if (kind === 'M') {
        // Only a PROMOTION into visibility counts as a new visible surface.
        const prev = _git(['show', `${baseline}:${relpath}`], true);
        if (prev) {
            const { tier: prev_tier } = _parse(prev);
            if (VISIBLE_TIERS.has(prev_tier)) {
                return []; // already visible before — grandfathered
            }
        }
    }

    if (grandfathered.has(name)) {
        return []; // documented single-command exception — exempt from both rules
    }
    const bare = sub ? sub : name.split(':').pop()!;
    const vio: Violation[] = [];
    // Rule 1 — banned prefix (create-*).
    for (const bp of banned) {
        if (bare === bp || bare.startsWith(bp + '-')) {
            vio.push({
                file: relpath,
                rule: 'banned-prefix',
                reason:
                    `\`${name}\` uses the banned leading token ` +
                    `\`${bp}\` (no ${bp}-* commands — ADR-041 § 2). ` +
                    `Grandfather it in command-verbs.yml only with ` +
                    `a documented exception.`,
            });
            return vio; // banned message is the actionable one; don't pile on
        }
    }
    // Rule 2 — approved verb.
    const tok = leading_token(name, sub);
    if (!approved.has(tok)) {
        vio.push({
            file: relpath,
            rule: 'approved-verb',
            reason:
                `leading token \`${tok}\` of \`${name}\` is not an ` +
                `approved verb. Rename to an existing verb, or add ` +
                `\`${tok}\` to src/config/discovery/command-verbs.yml in ` +
                `its own PR with an ADR (ADR-041 § 5).`,
        });
    }
    return vio;
}

interface ParsedArgs {
    baseline: string;
    all: boolean;
    quiet: boolean;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let baseline = 'main';
    let all = false;
    let quiet = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--baseline') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --baseline: expected one argument');
            }
            baseline = v;
        } else if (arg.startsWith('--baseline=')) {
            baseline = arg.slice('--baseline='.length);
        } else if (arg === '--all') {
            all = true;
        } else if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: lint_command_verbs.py [-h] [--baseline BASELINE] [--all] [--quiet]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { baseline, all, quiet };
}

function _argparse_error(message: string): never {
    // Mirror Python argparse: usage line + program error, both on stderr,
    // exit code 2. The prog name is the basename of the Python original.
    process.stderr.write(
        'usage: lint_command_verbs.py [-h] [--baseline BASELINE] [--all] [--quiet]\n',
    );
    process.stderr.write(`lint_command_verbs.py: error: ${message}\n`);
    process.exit(2);
}

function main(): number {
    const args = parse_args(process.argv.slice(2));

    const { approved, banned, grandfathered } = load_config();
    const targets = args.all ? all_visible_command_files() : changed_command_files(args.baseline);
    if (Object.keys(targets).length === 0) {
        if (!args.quiet) {
            process.stdout.write(
                `✅  No new/changed commands under commands/ (baseline: ${args.baseline}).\n`,
            );
        }
        return 0;
    }

    const violations: Violation[] = [];
    for (const relpath of Object.keys(targets).sort()) {
        const kind = targets[relpath]!;
        violations.push(...check(relpath, kind, args.baseline, approved, banned, grandfathered));
    }

    if (violations.length) {
        process.stdout.write(`❌  ${violations.length} controlled-verb violation(s):\n`);
        for (const v of violations) {
            process.stdout.write(`  • [${v.rule}] ${v.file} — ${v.reason}\n`);
        }
        process.stdout.write('\nSee docs/decisions/ADR-041-controlled-command-verbs.md.\n');
        return 1;
    }
    if (!args.quiet) {
        process.stdout.write(
            `✅  ${Object.keys(targets).length} new/changed command(s) all use an approved ` +
                `verb (baseline: ${args.baseline}).\n`,
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    type Violation,
    ROOT,
    VERBS_YML,
    _CMD_PATH_RE,
    VISIBLE_TIERS,
    load_config,
    changed_command_files,
    all_visible_command_files,
    leading_token,
    check,
    main,
};
