#!/usr/bin/env tsx
/**
 * Structural breaking-change detector (road-to-contract-integrity F3).
 *
 * TypeScript twin of `src/scripts/check_structural_breaking.py` (ADR-200). The
 * CLI contract is mirrored EXACTLY — the `--quiet` flag, exit codes (0 clean /
 * cleared, 1 break without annotation), the stdout/stderr split (the ✅ summary
 * on stdout, the ❌ block on stderr), byte-identical finding + remediation
 * messages, the same `git diff --name-status` / `git log` shell-outs, and the
 * same regex set. No behaviour changes — latent bugs replicated.
 *
 * `release.py` infers the version bump from the commit annotation
 * (`feat!` / `BREAKING CHANGE`). This detector inspects the diff against the
 * trunk and FAILS when a structurally breaking change is present without a
 * breaking annotation (or an explicit override).
 *
 * Two structural-break classes (deterministic):
 *   1. Artifact deletion / rename — a tracked artifact source file is Deleted
 *      or Renamed in the diff.
 *   2. Schema change without a version bump — a contract schema under
 *      `src/scripts/schemas/` is modified but its `x-schemaVersion` is unchanged.
 *
 * Escapes (any one clears the gate):
 *   * The commit range carries a breaking annotation (`<type>!:` bang or a
 *     `BREAKING CHANGE` line).
 *   * A commit body carries `ci-override: structural-breaking-ok`.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const QUIET = process.argv.includes('--quiet');
// src/scripts/check_structural_breaking.ts → three levels up is the repo root
// (Python: Path(__file__).resolve().parent.parent.parent).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE_REF = 'origin/main';

// Source artifact files whose deletion/rename is a breaking change.
const ARTIFACT_RE = new RegExp(
    '^src/(?:' +
        'skills/[^/]+/SKILL\\.md' +
        '|rules/[^/]+\\.md' +
        '|domains/[^/]+/[^/]+/command\\.md' +
        '|scripts/schemas/[^/]+\\.schema\\.json' +
        '|config/packs\\.yml' +
        ')$',
);
const SCHEMA_RE = /^src\/scripts\/schemas\/[^/]+\.schema\.json$/;
const SCHEMA_VERSION_RE = /"x-schemaVersion"\s*:\s*"([^"]+)"/;
// A breaking annotation is a Conventional-Commits subject bang (`feat!:`,
// `fix(scope)!:`) or a `BREAKING CHANGE:` footer line — both line-anchored.
const BANG_RE = /^[a-z]+(\([^)]+\))?!:/m;
const BREAKING_FOOTER_RE = /^BREAKING[ -]CHANGE:/m;
// The override must be its own trailer line — not an inline mention.
const OVERRIDE_RE = /^ci-override:\s*structural-breaking-ok\s*$/m;

function _git(...args: string[]): string {
    const proc = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf-8' });
    // Python uses `.stdout` from subprocess.run without check=True — a missing
    // git / non-zero exit yields whatever stdout was captured (often empty).
    return (proc.stdout as string | null) ?? '';
}

function _base(): string {
    const mb = _git('merge-base', BASE_REF, 'HEAD').trim();
    return mb || BASE_REF;
}

function _schema_version_at(ref: string, p: string): string | null {
    const blob = _git('show', `${ref}:${p}`);
    const m = SCHEMA_VERSION_RE.exec(blob);
    return m ? m[1]! : null;
}

/** Mirror Python `str.splitlines()` — split on \n / \r\n / \r, drop trailing empty. */
function _splitlines(s: string): string[] {
    if (s === '') {
        return [];
    }
    const parts = s.split(/\r\n|\r|\n/);
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

function main(): number {
    const base = _base();
    if (!base) {
        return 0; // no trunk to diff against (e.g. shallow CI) → no-op
    }
    const names = _git('diff', '--name-status', `${base}...HEAD`);
    if (names.trim() === '') {
        return 0; // nothing changed vs trunk
    }

    const breaks: string[] = [];
    for (const line of _splitlines(names)) {
        const parts = line.split('\t');
        const status = parts[0]!;
        if (status.startsWith('D') && ARTIFACT_RE.test(parts[1]!)) {
            breaks.push(`deleted artifact: ${parts[1]}`);
        } else if (status.startsWith('R') && ARTIFACT_RE.test(parts[1]!)) {
            breaks.push(`renamed artifact: ${parts[1]} -> ${parts[2]}`);
        } else if (status.startsWith('M') && SCHEMA_RE.test(parts[1]!)) {
            const old = _schema_version_at(base, parts[1]!);
            const next = _schema_version_at('HEAD', parts[1]!);
            if (old !== null && old === next) {
                breaks.push(
                    `schema changed without x-schemaVersion bump (still ${old}): ${parts[1]}`,
                );
            }
        }
    }

    if (breaks.length === 0) {
        if (!QUIET) {
            process.stdout.write(
                '✅ check-structural-breaking: no structural breaks vs trunk\n',
            );
        }
        return 0;
    }

    const log = _git('log', '--format=%B', `${base}..HEAD`);
    const annotated = BANG_RE.test(log) || BREAKING_FOOTER_RE.test(log);
    const overridden = OVERRIDE_RE.test(log);
    if (annotated || overridden) {
        if (!QUIET) {
            const why = annotated ? 'breaking annotation' : 'ci-override';
            process.stdout.write(
                `✅ check-structural-breaking: ${breaks.length} break(s), cleared by ${why}\n`,
            );
        }
        return 0;
    }

    process.stderr.write(
        '❌ check-structural-breaking: structural break(s) without a breaking annotation:\n',
    );
    for (const b of breaks) {
        process.stderr.write(`   - ${b}\n`);
    }
    process.stderr.write(
        '\nResolve by either:\n' +
            '  • annotating the commit (`<type>!: …` or a `BREAKING CHANGE` line)\n' +
            '    so release.py infers a major bump, or\n' +
            '  • adding `ci-override: structural-breaking-ok` to a commit body\n' +
            '    for an intentional deprecation-cycle completion.\n',
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

export {
    ARTIFACT_RE,
    SCHEMA_RE,
    SCHEMA_VERSION_RE,
    BANG_RE,
    BREAKING_FOOTER_RE,
    OVERRIDE_RE,
    main,
};
