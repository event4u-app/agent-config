#!/usr/bin/env tsx
/**
 * Fail when a skill or command lacks a `model_tier` value.
 *
 * TypeScript twin of `src/scripts/lint_model_tier_coverage.py` (ADR-096,
 * Phase 4 / Wave 4b). Mirrors the Python CLI contract EXACTLY — `--quiet`
 * flag, target enumeration + ordering (skills via artefact_roots, then
 * commands via iter_commands), finding messages, stdout/stderr split,
 * exit codes. No behaviour changes — latent bugs replicated.
 *
 * Phase 5 coverage gate of `road-to-model-capability-tiers.md` (ADR-035):
 * every skill and command MUST declare an explicit `model_tier`
 * (`opus | sonnet | gpt`) or `inherit`. An untagged artefact is an error.
 *
 * The enum itself is validated by `scripts/validate_frontmatter.py`; this
 * gate only enforces *presence*.
 *
 * Exit codes: 0 clean, 1 at least one untagged skill/command.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse_frontmatter } from './validate_frontmatter.js';
import { artefact_roots, iter_commands } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Recursively list `SKILL.md` files under `dir`, sorted (sorted(rglob)). */
function _rglobSkillsSorted(dir: string): string[] {
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
            } else if (entry.isFile() && entry.name === 'SKILL.md') {
                out.push(full);
            }
        }
    };
    walk(dir);
    return out.sort();
}

/** POSIX relative path of `target` under `root`. */
function _relToPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

function* _targets(): Generator<[string, string]> {
    for (const root of artefact_roots()) {
        const sdir = path.join(root, 'skills');
        if (_isDir(sdir)) {
            for (const p of _rglobSkillsSorted(sdir)) {
                yield ['skill', p];
            }
        }
    }
    // Commands live under packages/*/commands/ AND the 6.0.0-D
    // src/domains/<pack>/<subpath>/command.md homes; iter_commands() covers both.
    for (const p of iter_commands()) {
        if (path.basename(p) !== 'AGENTS.md') {
            yield ['command', p];
        }
    }
}

function main(argv: readonly string[]): number {
    const quiet = parse_args(argv);

    let total = 0;
    const missing: Array<[string, string]> = [];
    for (const [kind, p] of _targets()) {
        total += 1;
        const [fm] = parse_frontmatter(fs.readFileSync(p, 'utf-8'));
        if (
            fm === null ||
            typeof fm !== 'object' ||
            Array.isArray(fm) ||
            !fm['model_tier']
        ) {
            missing.push([kind, _relToPosix(p, ROOT)]);
        }
    }

    if (missing.length > 0) {
        for (const [kind, rel] of missing.slice(0, 40)) {
            process.stdout.write(
                `❌  [${kind}] ${rel}: missing \`model_tier\` ` +
                    `(set lite/medium/high or inherit)\n`,
            );
        }
        if (missing.length > 40) {
            process.stdout.write(`  ... and ${missing.length - 40} more\n`);
        }
        process.stderr.write(
            `\n== model_tier coverage: ${missing.length}/${total} artefact(s) ` +
                'untagged. Run `python3 scripts/backfill_model_tier.py`. ==\n',
        );
        return 1;
    }
    if (!quiet) {
        process.stdout.write(`✅  lint-model-tier-coverage: ${total} artefact(s) tagged.\n`);
    }
    return 0;
}

function _argparse_error(message: string): never {
    process.stderr.write(`lint_model_tier_coverage: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): boolean {
    let quiet = false;
    for (const arg of argv) {
        if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_model_tier_coverage [-h] [--quiet]\n');
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return quiet;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}

export { ROOT, main };
