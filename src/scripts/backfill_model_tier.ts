#!/usr/bin/env node
/**
 * Backfill / migrate `model_tier` on every skill and command (ADR-035).
 *
 * TypeScript twin of `src/scripts/backfill_model_tier.py` (ADR-096 —
 * Python→TS migration, Phase 8 / Wave 8e). The CLI contract is mirrored
 * EXACTLY: same flag (`--dry-run`), same exit code (0), same byte-identical
 * stdout report, and byte-identical frontmatter rewrites of every skill +
 * command (source AND its dist/agent-src copy). No behaviour changes.
 *
 * Vendor-neutral capability band `lite | medium | high | inherit` (replaces
 * the concrete-model `recommended_model` from ADR-034). Behaviour per
 * artefact:
 *
 * - Has `recommended_model` (ADR-034 legacy) → migrate via the value map
 *   (`opus→high`, `sonnet→medium`, `gpt→high`, `inherit→inherit`) and rename
 *   the key to `model_tier`. Same line count — no body shift.
 * - Already `model_tier` → leave (idempotent).
 * - Untagged → classify fresh from the task→tier heuristic.
 *
 * A small explicit `_LITE` set demotes obviously-trivial mechanical skills
 * to the cheapest band; `_CONTEXT_LARGE` adds the orthogonal `context: large`
 * modifier to genuinely long-context skills. Writes BOTH the source and its
 * `dist/agent-src` copy (frontmatter stays byte-identical).
 *
 * CLI: ./scripts-run src/scripts/backfill_model_tier [--dry-run]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse_frontmatter } from './validate_frontmatter.js';
import { artefact_roots, iter_commands, strip_source_prefix } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/backfill_model_tier.ts → parents[2] is the repo root (mirrors
// `Path(__file__).resolve().parents[2]` in the .py).
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CONDENSED = path.join(ROOT, 'dist/agent-src');

// ADR-034 → ADR-035 value map.
const _MIGRATE: Record<string, string> = {
    opus: 'high',
    sonnet: 'medium',
    gpt: 'high',
    inherit: 'inherit',
};

// Fresh-classification slug signals (deep reasoning / large-analysis → high).
const _HIGH: readonly string[] = [
    'architect', 'refactor', 'debug', 'threat', 'authz', 'adversarial',
    'blast-radius', 'defense-in-depth', 'data-flow', 'decision-record',
    'adr-create', 'security-audit', 'privacy-review', 'review', 'judge-',
    'bug-analyzer', 'systematic-debugging', 'incident', 'risk-officer',
    'migration-architect', 'moat', 'analysis', 'analyze', 'analyzer',
    'research', 'deep-reading', 'repomix', 'sequential-thinking',
    'project-analysis', 'universal-project', 'market-entry',
    'scenario-modeling', 'forecast', 'dcf-modeling', 'unit-economics',
    'funnel-analysis',
];
const _MEDIUM: readonly string[] = [
    'test', 'pest', 'playwright', 'lint', 'quality-tools', 'format', 'docs',
    'readme-writing', 'commit', 'conventional', 'css', 'tailwind', 'blade',
    'flux', 'livewire', 'form-handler', 'api-endpoint', 'api-testing',
    'eloquent', 'laravel', 'dto', 'mail', 'notification', 'migration',
    'middleware', 'scheduling', 'websocket', 'reverb', 'horizon', 'pulse',
    'pennant', 'validation', 'docker', 'terraform', 'terragrunt', 'github-ci',
    'traefik', 'grafana', 'dashboard', 'openapi', 'sql', 'artisan', 'composer',
    'jobs-events', 'multi-tenancy', 'secrets', 'logging', 'database',
    'php-coder', 'php-service', 'nextjs', 'react', 'symfony', 'mcp',
    'devcontainer', 'copilot', 'module',
];
const _DOMAIN_DEFAULT: Record<string, string> = {
    engineering: 'medium',
    quality: 'medium',
    devops: 'medium',
    discovery: 'high',
    product: 'inherit',
    process: 'inherit',
};

// Clearly-trivial, no-reasoning mechanical skills → cheapest band.
const _LITE = new Set<string>(['file-editor', 'md-language-check']);
// Genuinely long-context skills → orthogonal context modifier (ADR-035).
const _CONTEXT_LARGE = new Set<string>([
    'project-analysis-core',
    'project-analysis-hypothesis-driven',
    'project-analyzer',
    'universal-project-analysis',
    'repomix-packer',
    'deep-reading-analyst',
]);

// re.MULTILINE patterns. `^...$` anchor per-line.
const _RM_RE = /^recommended_model:[ \t]*"?[a-z0-9-]+"?[ \t]*$/m;
const _MT_RE = /^model_tier:/m;
const _CTX_RE = /^context:/m;

type Fm = Record<string, unknown> | null;

function _classify(slug: string, domain: string | null): string {
    const s = slug.toLowerCase();
    if (_LITE.has(s)) {
        return 'lite';
    }
    if (_HIGH.some((k) => s.includes(k))) {
        return 'high';
    }
    if (_MEDIUM.some((k) => s.includes(k))) {
        return 'medium';
    }
    return _DOMAIN_DEFAULT[domain ?? ''] ?? 'inherit';
}

function _resolve_tier(slug: string, fm: Fm): string {
    const isDict = _isDict(fm);
    const existing_mt = isDict ? (fm as Record<string, unknown>)['model_tier'] : undefined;
    let tier: string;
    if (_pyTruthy(existing_mt)) {
        tier = String(existing_mt);
    } else {
        const existing_rm = isDict ? (fm as Record<string, unknown>)['recommended_model'] : undefined;
        if (_pyTruthy(existing_rm)) {
            tier = _MIGRATE[String(existing_rm)] ?? 'inherit';
        } else {
            const domain = isDict ? (fm as Record<string, unknown>)['domain'] : undefined;
            tier = _classify(slug, typeof domain === 'string' ? domain : domain == null ? null : String(domain));
        }
    }
    return _LITE.has(slug) ? 'lite' : tier;
}

function _apply(p: string, tier: string, want_context: boolean): boolean {
    const text = fs.readFileSync(p, 'utf-8');
    if (!text.startsWith('---\n')) {
        return false;
    }
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) {
        return false;
    }
    let fm = text.slice(4, end);
    const body = text.slice(end);
    let changed = false;
    if (_MT_RE.test(fm)) {
        // already migrated — idempotent
    } else if (_RM_RE.test(fm)) {
        fm = _subOnce(fm, _RM_RE, `model_tier: ${tier}`);
        changed = true;
    } else {
        fm = `model_tier: ${tier}\n` + fm;
        changed = true;
    }
    if (want_context && !_CTX_RE.test(fm)) {
        // re.sub(r'(^model_tier:.*$)', r'\1\ncontext: large', fm, count=1, MULTILINE)
        fm = _subOnce(fm, /^model_tier:.*$/m, (match) => `${match}\ncontext: large`);
        changed = true;
    }
    if (changed) {
        fs.writeFileSync(p, '---\n' + fm + body, 'utf-8');
    }
    return changed;
}

/** Yield [src, condensed, slug] for every skill + command, in Python order. */
function* _iter(): Generator<[string, string, string]> {
    for (const root of artefact_roots()) {
        const sdir = path.join(root, 'skills');
        if (_exists(sdir)) {
            for (const p of _rglobSorted(sdir, 'SKILL.md')) {
                const slug = path.basename(path.dirname(p));
                yield [p, path.join(CONDENSED, 'skills', slug, 'SKILL.md'), slug];
            }
        }
    }
    // Commands live under packages/*/commands/ AND the 6.0.0-D
    // src/domains/<pack>/<subpath>/command.md homes; iter_commands() covers
    // both. The condensed path + slug derive from the logical command path.
    for (const p of iter_commands()) {
        if (path.basename(p) === 'AGENTS.md') {
            continue;
        }
        const logical = strip_source_prefix(_relToRootPosix(p)) ?? '';
        const sub = logical.startsWith('commands/')
            ? logical.slice('commands/'.length)
            : path.basename(p);
        const slug = _pathParts(_withoutSuffix(sub)).join('-');
        yield [p, path.join(CONDENSED, 'commands', sub), slug];
    }
}

export function run(apply: boolean): number {
    const dist = new Map<string, number>();
    let ctx = 0;
    let touched = 0;
    for (const [src, cond, slug] of _iter()) {
        const [fm] = parse_frontmatter(fs.readFileSync(src, 'utf-8'));
        const tier = _resolve_tier(slug, fm as Fm);
        const want_ctx = _CONTEXT_LARGE.has(slug);
        dist.set(tier, (dist.get(tier) ?? 0) + 1);
        if (want_ctx) {
            ctx += 1;
        }
        if (apply) {
            if (_apply(src, tier, want_ctx)) {
                touched += 1;
            }
            if (_exists(cond)) {
                _apply(cond, tier, want_ctx);
            }
        }
    }
    const verb = !apply ? 'would set' : 'set';
    process.stdout.write(`model_tier backfill (${!apply ? 'dry-run' : 'apply'}):\n`);
    for (const t of ['lite', 'medium', 'high', 'inherit']) {
        // Python f"{t:8s}" → left-justified width-8.
        process.stdout.write(`  ${t.padEnd(8)}: ${dist.get(t) ?? 0}\n`);
    }
    let total = 0;
    for (const v of dist.values()) {
        total += v;
    }
    process.stdout.write(
        `  context:large on ${ctx} skills · ${verb} ${touched} newly · total ${total}\n`,
    );
    return 0;
}

// --- helpers ---------------------------------------------------------------

function _isDict(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

/** Mirror `re.sub(pat, repl, s, count=1)` for a `m`-flagged regex. */
function _subOnce(s: string, re: RegExp, repl: string | ((m: string) => string)): string {
    const m = re.exec(s);
    if (!m) {
        return s;
    }
    const matched = m[0];
    const replacement = typeof repl === 'function' ? repl(matched) : repl;
    return s.slice(0, m.index) + replacement + s.slice(m.index + matched.length);
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** `Path.rglob(pattern)` for a fixed filename — recursive, sorted (Python rglob is sorted here via `sorted()`). */
function _rglobSorted(dir: string, filename: string): string[] {
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
            } else if (e.name === filename && _isFile(full)) {
                out.push(full);
            }
        }
    };
    walk(dir);
    // Python `sorted(p.rglob(...))` — lexicographic by full path string.
    out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return out;
}

/** `p.relative_to(ROOT).as_posix()`. */
function _relToRootPosix(p: string): string {
    return path.relative(ROOT, p).split(path.sep).join('/');
}

/** `Path(sub).with_suffix("")` — drop the final extension. */
function _withoutSuffix(sub: string): string {
    const ext = path.extname(sub);
    return ext ? sub.slice(0, sub.length - ext.length) : sub;
}

/** `Path(x).parts` — POSIX path components. */
function _pathParts(sub: string): string[] {
    return sub.split('/').filter((s) => s !== '');
}

interface ParsedArgs {
    dry_run: boolean;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let dry_run = false;
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i]!;
        if (arg === '--dry-run') {
            dry_run = true;
            i += 1;
            continue;
        }
        _argError(`unrecognized arguments: ${arg}`);
    }
    return { dry_run };
}

function _argError(message: string): never {
    process.stderr.write(`usage: backfill_model_tier [-h] [--dry-run]\n`);
    process.stderr.write(`backfill_model_tier: error: ${message}\n`);
    process.exit(2);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = parse_args(argv);
    return run(!args.dry_run);
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
