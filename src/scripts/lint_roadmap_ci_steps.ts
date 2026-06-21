#!/usr/bin/env tsx
/**
 * Hard-Gate linter for the `roadmap-ci-steps-policy` rule.
 *
 * TypeScript twin of `src/scripts/lint_roadmap_ci_steps.py` (ADR-200,
 * Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY — `--quiet`
 * detected by argv membership (no argparse), exit codes (0 / 1),
 * stdout/stderr split, byte-identical messages, same scan scope
 * (`agents/roadmaps/*.md`, sorted) and detection order. No behaviour
 * changes — latent bugs replicated.
 *
 * Forbids full-pipeline CI literals (`task ci`, `make test`, `npm run check`
 * etc.) inside `agents/roadmaps/*.md` checkbox steps or fenced bash blocks
 * **when** `quality.local_auto_run` in `.agent-settings.yml` is `false`.
 *
 * Exit codes: 0 = clean / disabled, 1 = violations.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { project_settings_path } from './_lib/agent_settings.js';

const _HERE = fileURLToPath(import.meta.url);
const QUIET = process.argv.slice(2).includes('--quiet');

const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const ROADMAP_GLOB = 'agents/roadmaps/*.md';
// Mutable module binding so tests can override it (mirrors the Python
// monkeypatch.setattr(mod, "SETTINGS_FILE", ...)).
let SETTINGS_FILE = project_settings_path(REPO_ROOT);
function _setSettingsFileForTest(p: string): void {
    SETTINGS_FILE = p;
}

const LOCAL_AUTO_RUN_PAT = /^\s*local_auto_run:\s*(true|false)\s*(?:#.*)?$/m;
const CARVE_OUT_MARKER = 'carve-out: new-gate-verification';

// CI-shaped literals — case-insensitive whole-word(-ish) matches.
const CI_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
    [/\btask\s+ci-strict\b/i, 'task ci-strict'],
    [/\btask\s+ci-fast\b/i, 'task ci-fast'],
    [/\btask\s+ci\b(?!-)/i, 'task ci'],
    [/\bmake\s+ci\b/i, 'make ci'],
    [/\bmake\s+test\b/i, 'make test'],
    [/\bnpm\s+run\s+check\b/i, 'npm run check'],
    [/\bpnpm\s+run\s+check\b/i, 'pnpm run check'],
    [/\byarn\s+check\b/i, 'yarn check'],
    [/\bcomposer\s+test\b/i, 'composer test'],
    // Whole-suite = bare command, or command followed only by prose. A real
    // shell argument starts with `-` (flag) or contains `/` or `.` (path /
    // .php file) — that signals a targeted run and is allowed.
    [/\bvendor\/bin\/phpunit\b(?!\s+(?:-|\S*[/.]))/i, 'vendor/bin/phpunit (whole suite)'],
    [/\bphp\s+artisan\s+test\b(?!\s+(?:-|\S*[/.]))/i, 'php artisan test (whole suite)'],
];

const CHECKBOX_PAT = /^\s*-\s*\[[ x~/-]\]\s/;
const FENCE_PAT = /^\s*```/;
const HEADING_PAT = /^(#{1,6})\s+(.*?)\s*$/;
const ACCEPTANCE_HEADING_PAT = /^acceptance criteria\b/i;

/**
 * Return `quality.local_auto_run` from `.agent-settings.yml`.
 *
 * Default `true` (= no-op) when file or key is missing. The Hard Gate only
 * fires when the setting is explicitly `false`.
 */
function _read_local_auto_run(): boolean {
    let isFile = false;
    try {
        isFile = fs.statSync(SETTINGS_FILE).isFile();
    } catch {
        isFile = false;
    }
    if (!isFile) {
        return true;
    }
    let text: string;
    try {
        text = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    } catch {
        return true;
    }
    let in_quality = false;
    for (const raw of text.split('\n')) {
        if (!raw.trim() || raw.trimStart().startsWith('#')) {
            continue;
        }
        if (raw.startsWith('quality:')) {
            in_quality = true;
            continue;
        }
        if (in_quality && raw && !(raw.startsWith(' ') || raw.startsWith('\t'))) {
            in_quality = false;
            continue;
        }
        if (in_quality) {
            const m = LOCAL_AUTO_RUN_PAT.exec(raw);
            if (m) {
                return m[1]!.toLowerCase() === 'true';
            }
        }
    }
    return true;
}

/**
 * Return `[line_no, matched_literal, line_text]` for every hit.
 *
 * Only scans checkbox-step lines and lines inside fenced code blocks. Skips
 * lines under an `## Acceptance criteria` heading and lines carrying the
 * carve-out marker.
 */
function _scan(text: string): Array<[number, string, string]> {
    const hits: Array<[number, string, string]> = [];
    let in_fence = false;
    let in_acceptance = false;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const idx = i + 1;
        const line = lines[i]!;
        if (FENCE_PAT.test(line)) {
            in_fence = !in_fence;
            continue;
        }
        if (!in_fence) {
            const heading = HEADING_PAT.exec(line);
            if (heading) {
                in_acceptance = ACCEPTANCE_HEADING_PAT.test(heading[2]!);
                continue;
            }
        }
        if (in_acceptance) {
            continue;
        }
        const is_checkbox = CHECKBOX_PAT.test(line);
        if (!(is_checkbox || in_fence)) {
            continue;
        }
        if (line.includes(CARVE_OUT_MARKER)) {
            continue;
        }
        for (const [pat, label] of CI_PATTERNS) {
            if (pat.test(line)) {
                hits.push([idx, label, line.trim()]);
                break;
            }
        }
    }
    return hits;
}

/** Sorted `agents/roadmaps/*.md` (non-recursive — mirrors glob, not rglob). */
function _globRoadmaps(): string[] {
    const dir = path.join(REPO_ROOT, 'agents', 'roadmaps');
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out.sort();
}

function _relPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

function main(): number {
    if (_read_local_auto_run()) {
        if (!QUIET) {
            process.stdout.write(
                '✅  quality.local_auto_run=true (or unset) — CI-step gate disabled\n',
            );
        }
        return 0;
    }
    const roadmaps = _globRoadmaps();
    if (roadmaps.length === 0) {
        if (!QUIET) {
            process.stdout.write(`✅  no active roadmaps under ${ROADMAP_GLOB}\n`);
        }
        return 0;
    }
    let failed = 0;
    for (const roadmap of roadmaps) {
        const rel = _relPosix(roadmap, REPO_ROOT);
        const text = fs.readFileSync(roadmap, 'utf-8');
        const hits = _scan(text);
        if (hits.length) {
            failed += 1;
            process.stderr.write(`❌  ${rel}\n`);
            for (const [line_no, label, line_text] of hits) {
                process.stderr.write(`    line ${line_no}: '${label}' in: ${line_text}\n`);
            }
            process.stderr.write(
                "    → reword as a narrow command " +
                    "(e.g. 'vendor/bin/phpstan analyse app/Modules/X'), or " +
                    "mark with '<!-- carve-out: new-gate-verification -->' " +
                    "when the step verifies a NEW gate introduced by this " +
                    "roadmap.\n",
            );
        } else {
            if (!QUIET) {
                process.stdout.write(`✅  ${rel}\n`);
            }
        }
    }
    if (failed) {
        process.stderr.write(
            `\n❌  ${failed} roadmap(s) schedule full-pipeline CI steps ` +
                `while quality.local_auto_run=false — ` +
                `see .augment/rules/roadmap-ci-steps-policy.md\n`,
        );
        return 1;
    }
    if (!QUIET) {
        process.stdout.write(`\n✅  ${roadmaps.length} roadmap(s) CI-step-clean\n`);
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
    REPO_ROOT,
    ROADMAP_GLOB,
    SETTINGS_FILE,
    _setSettingsFileForTest,
    LOCAL_AUTO_RUN_PAT,
    CARVE_OUT_MARKER,
    CI_PATTERNS,
    CHECKBOX_PAT,
    FENCE_PAT,
    HEADING_PAT,
    ACCEPTANCE_HEADING_PAT,
    _read_local_auto_run,
    _scan,
    main,
};
