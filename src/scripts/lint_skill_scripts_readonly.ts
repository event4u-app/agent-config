#!/usr/bin/env -S node --import tsx
/**
 * lint_skill_scripts_readonly — read-only-by-default script convention
 * (ecosystem-harvest skill-quality-gates, Phase 3).
 *
 * A script shipped inside a skill (`src/skills/<skill>/scripts/**`) is
 * side-effect-free by default: it inspects / prints, it does not mutate. Any
 * mutation must be gated behind an explicit flag (`--writable` / `--apply` /
 * `--write` / `--out` / `--fix` / `--emit`) named in the skill's SKILL.md, OR
 * the script must be allowlisted with a rationale (a generator whose declared
 * purpose IS to write into a caller-supplied path).
 *
 * The linter flags a script that contains a content-mutation primitive but
 * neither references a write-gating flag nor is allowlisted. Directory creation
 * (`mkdirSync`) and writes under a temp dir are not content mutation and do not
 * trip the gate.
 *
 * Deterministic, static-config only. Allowlist:
 * `lint_skill_scripts_readonly_allowlist.json`, capped at 20.
 *
 * Exit codes: 0 = clean (or only allowlisted), 1 = ungated write, 2 = over cap / usage.
 *
 * Usage: ./scripts-run src/scripts/lint_skill_scripts_readonly [--quiet] [--root <dir>]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_SKILLS = path.join(REPO, 'src', 'skills');
const ALLOWLIST = path.join(path.dirname(_HERE), 'lint_skill_scripts_readonly_allowlist.json');
const ALLOWLIST_CAP = 20;

// Content-mutation primitives, language-scoped. mkdirSync is intentionally
// excluded (dir creation is not content mutation). Shell redirection is matched
// only in .sh files — `> "` / `=> "` is pervasive, harmless syntax in TS/JS.
const JS_WRITE_RE =
    /\b(writeFileSync|writeFile\s*\(|appendFileSync|appendFile\s*\(|unlinkSync|unlink\s*\(|rmSync|rmdirSync|copyFileSync|renameSync)\b/;
const PY_WRITE_RE =
    /\bopen\s*\([^)]*,\s*["'][wa]\+?b?["']|\bos\.(remove|unlink|rmdir)\b|\bshutil\.(rmtree|move|copy)\b|\bpathlib[^\n]*\.write_(text|bytes)\b|\.write_(text|bytes)\s*\(/;
const SH_WRITE_RE =
    /(^|\s|;|&&|\|)(rm|rmdir|mv|cp|dd|truncate|tee)\s|>>?\s*[^&\s]|\b(DELETE\s+FROM|DROP\s+(TABLE|DATABASE)|TRUNCATE)\b/;
// A write-gating flag reference — mutation is behind an opt-in.
const GATE_RE = /--writable|--apply|--write|--out|--fix\b|--emit|--generate|--dry-run|dryRun|dry_run|parsed\.output|args\.output|opts\.output/;
const SCRIPT_EXT = new Set(['.ts', '.js', '.mjs', '.cjs', '.py', '.sh']);

function hasWritePrimitive(body: string, ext: string): boolean {
    if (ext === '.py') return PY_WRITE_RE.test(body);
    if (ext === '.sh') return SH_WRITE_RE.test(body);
    return JS_WRITE_RE.test(body); // .ts/.js/.mjs/.cjs
}

interface Violation {
    rel: string;
    detail: string;
}

function loadAllowlist(): Set<string> {
    if (!fs.existsSync(ALLOWLIST)) return new Set();
    const data = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf-8')) as {
        entries?: Array<{ path: string; reason: string }>;
    };
    const entries = Array.isArray(data.entries) ? data.entries : [];
    if (entries.length > ALLOWLIST_CAP) {
        process.stderr.write(
            `❌  lint_skill_scripts_readonly: allowlist has ${entries.length} entries (> ${ALLOWLIST_CAP}). ` +
                `Per the autonomous-execution allowlist-growth antipattern, the convention is wrong, not the content.\n`,
        );
        process.exit(2);
    }
    const bad = entries.filter((e) => !e.reason || e.reason.trim() === '');
    if (bad.length > 0) {
        process.stderr.write(`❌  lint_skill_scripts_readonly: allowlist entries must carry a non-empty reason: ${bad.map((b) => b.path).join(', ')}\n`);
        process.exit(2);
    }
    return new Set(entries.map((e) => e.path));
}

function* scriptFiles(root: string): Generator<string> {
    if (!fs.existsSync(root)) return;
    for (const skill of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (!skill.isDirectory()) continue;
        const scriptsDir = path.join(root, skill.name, 'scripts');
        if (!fs.existsSync(scriptsDir)) continue;
        const stack = [scriptsDir];
        while (stack.length) {
            const d = stack.pop() as string;
            for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
                const full = path.join(d, e.name);
                if (e.isDirectory()) stack.push(full);
                else if (SCRIPT_EXT.has(path.extname(e.name))) yield full;
            }
        }
    }
}

function parseArgs(argv: string[]): { quiet: boolean; root: string } {
    const a = { quiet: false, root: DEFAULT_SKILLS };
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--quiet') a.quiet = true;
        else if (argv[i] === '--root') a.root = argv[(i += 1)] ?? DEFAULT_SKILLS;
        else {
            process.stderr.write(`lint_skill_scripts_readonly: unrecognized argument: ${argv[i]}\n`);
            process.exit(2);
        }
    }
    return a;
}

function main(argv: string[]): number {
    const args = parseArgs(argv);
    const allow = loadAllowlist();
    const violations: Violation[] = [];
    let scanned = 0;
    for (const f of scriptFiles(args.root)) {
        scanned += 1;
        const rel = path.relative(REPO, f);
        // Compare against the src/skills-relative form for the allowlist key.
        const relSkills = path.relative(args.root, f);
        const body = fs.readFileSync(f, 'utf-8');
        if (!hasWritePrimitive(body, path.extname(f))) continue;
        if (GATE_RE.test(body)) continue;
        if (allow.has(relSkills) || allow.has(rel)) continue;
        violations.push({ rel, detail: 'contains a content-mutation primitive but no write-gating flag (--writable/--apply/--write/--out/--fix) and is not allowlisted' });
    }

    if (violations.length > 0) {
        process.stderr.write(`❌  lint_skill_scripts_readonly: ${violations.length} ungated write(s):\n`);
        for (const v of violations) process.stderr.write(`   ${v.rel} — ${v.detail}\n`);
        return 1;
    }
    if (!args.quiet) {
        process.stdout.write(`✅  lint_skill_scripts_readonly: ${scanned} skill script(s), all read-only or gated.\n`);
    }
    return 0;
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(_HERE)) {
    process.exit(main(process.argv.slice(2)));
}

export { hasWritePrimitive, GATE_RE, main };
