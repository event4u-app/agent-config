#!/usr/bin/env node
/**
 * Phase 5.2 roadmap-complexity linter.
 *
 * Ported from the retired Python `src/scripts/lint_roadmap_complexity.py` (ADR-200,
 * Phase 4 / Wave 4b). Mirrors the CLI contract EXACTLY — `--quiet` is a
 * bare `sys.argv` membership check (computed at import, NOT argparse, so
 * there is no real `-h`/`--help`), the per-roadmap `✅`/`❌` lines, the
 * always-printed blank line + `summary:` line, the trailing `✅`/`❌`
 * lines, stdout/stderr split (failures + trailing-fail summary on stderr),
 * and exit codes (0 clean, 1 on failure). No behaviour changes.
 *
 * Enforces the measurable subset of the roadmap-complexity standard:
 * declared `complexity:` tag, lightweight caps (lines / phases / no council
 * blocks), and the plate/horizon prohibition gated on `roadmap.horizon_weeks`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { project_settings_path } from './_lib/agent_settings.js';

/** Mirror `QUIET = "--quiet" in sys.argv` (computed at import). */
const QUIET = process.argv.slice(2).includes('--quiet');

const _HERE = path.resolve(fileURLToPath(import.meta.url));
// REPO_ROOT = Path(__file__).resolve().parent.parent.parent
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const ROADMAP_GLOB = 'agents/roadmaps/*.md';
const LIGHTWEIGHT_LINE_CAP = 600;
const LIGHTWEIGHT_PHASE_CAP = 6;
const SETTINGS_FILE = project_settings_path(REPO_ROOT);
// re.compile(r"^\s*horizon_weeks:\s*(\d+)\s*(?:#.*)?$", re.MULTILINE)
const HORIZON_WEEKS_PAT = /^\s*horizon_weeks:\s*(\d+)\s*(?:#.*)?$/;

// re.compile(r"^## Phase \d+\b", re.MULTILINE)
const PHASE_PAT = /^## Phase \d+\b/gm;
// re.compile(r"^## Council Round \d+\b", re.MULTILINE)
const COUNCIL_PAT = /^## Council Round \d+\b/m;
// re.compile(r"^### Verdict\b", re.MULTILINE)
const VERDICT_PAT = /^### Verdict\b/m;
// re.compile(r"^complexity:\s*(lightweight|structural)\s*$", re.MULTILINE)
const COMPLEXITY_PAT = /^complexity:\s*(lightweight|structural)\s*$/m;
// execution.mode (templates/roadmaps.md rule 18): nested under `execution:`.
const EXEC_MODE_PAT = /^execution:[^\S\n]*\n(?:[ \t]+(?!mode:).*\n)*[ \t]+mode:[ \t]*([^\s#]+)/m;
const EXEC_MODE_VALUES = new Set(['autonomous', 'phase-checkpoints', 'interactive']);

// Plate / horizon detection — template rule 16 forbids time-boxed plates.
const PLATE_PATS: ReadonlyArray<readonly [RegExp, string]> = [
    [/^##\s+Horizon\b/im, "'## Horizon' section header"],
    [/\b\d+-week\s+(visible\s+)?plate\b/i, "'N-week (visible) plate' phrasing"],
    [/\bvisible\s+plate\b/i, "'visible plate' phrasing"],
    [/\b(in|out)-of-plate\b/i, "'in-of-plate' / 'out-of-plate' marker"],
    [/\bout-of-horizon\b/i, "'out-of-horizon' marker"],
    [/\bIn-plate\??\b/, "'In-plate' / 'In-plate?' label"],
    [/\bOut-of-plate\b/, "'Out-of-plate' label"],
    [/inside\s+(the\s+|\d+-week\s+)?plate/i, "'inside the plate' phrasing"],
    [/outside\s+(the\s+|\d+-week\s+)?plate/i, "'outside the plate' phrasing"],
];

function _frontmatter(text: string): string {
    if (!text.startsWith('---\n')) {
        return '';
    }
    const end = text.indexOf('\n---\n', 4);
    return end !== -1 ? text.slice(4, end) : '';
}

function _read_horizon_weeks(): number {
    if (!_isFile(SETTINGS_FILE)) {
        return 0;
    }
    let text: string;
    try {
        text = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    } catch {
        return 0;
    }
    let in_roadmap = false;
    for (const raw of text.split('\n')) {
        if (!raw.trim() || raw.trimStart().startsWith('#')) {
            continue;
        }
        if (raw.startsWith('roadmap:')) {
            in_roadmap = true;
            continue;
        }
        if (in_roadmap && raw && !(raw.startsWith(' ') || raw.startsWith('\t'))) {
            in_roadmap = false;
            continue;
        }
        if (in_roadmap) {
            const m = HORIZON_WEEKS_PAT.exec(raw);
            if (m) {
                const n = Number.parseInt(m[1]!, 10);
                if (Number.isNaN(n)) {
                    return 0;
                }
                return Math.max(0, n);
            }
        }
    }
    return 0;
}

function _read_complexity(fm: string): string | null {
    const m = COMPLEXITY_PAT.exec(fm);
    return m ? m[1]! : null;
}

function _countMatches(re: RegExp, text: string): number {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let count = 0;
    while (g.exec(text) !== null) {
        count++;
    }
    return count;
}

function _check_lightweight(text: string, line_count: number, problems: string[]): void {
    if (line_count > LIGHTWEIGHT_LINE_CAP) {
        problems.push(
            `lightweight cap exceeded: ${line_count} lines ` +
                `(max ${LIGHTWEIGHT_LINE_CAP}); consider tagging structural ` +
                `or trimming`,
        );
    }
    const phases = _countMatches(PHASE_PAT, text);
    if (phases > LIGHTWEIGHT_PHASE_CAP) {
        problems.push(
            `lightweight phase cap exceeded: ${phases} phases ` +
                `(max ${LIGHTWEIGHT_PHASE_CAP})`,
        );
    }
    if (COUNCIL_PAT.test(text)) {
        problems.push(
            "lightweight roadmap contains '## Council Round N' " +
                'block — council debates belong in structural roadmaps',
        );
    }
    if (VERDICT_PAT.test(text)) {
        problems.push(
            "lightweight roadmap contains '### Verdict' block — " +
                'council verdicts belong in structural roadmaps',
        );
    }
}

function _check_no_plate(text: string, problems: string[]): void {
    for (const [pat, label] of PLATE_PATS) {
        const m = pat.exec(text);
        if (m === null) {
            continue;
        }
        // line = text.count("\n", 0, m.start()) + 1
        const line = _countChar(text, '\n', 0, m.index) + 1;
        problems.push(
            `plate/horizon convention detected (${label}) at line ${line} — ` +
                `forbidden by templates/roadmaps.md rule 16 when ` +
                `\`roadmap.horizon_weeks\` is 0; set a positive integer in ` +
                `.agent-settings.yml to opt in`,
        );
    }
}

function lint_roadmap(
    p: string,
    horizon_weeks: number,
    warnings?: string[],
): string[] {
    const text = fs.readFileSync(p, 'utf-8');
    const line_count = _countChar(text, '\n') + (text && !text.endsWith('\n') ? 1 : 0);
    const problems: string[] = [];
    const fm = _frontmatter(text);
    const complexity = fm ? _read_complexity(fm) : null;
    if (complexity === null) {
        problems.push(
            "missing 'complexity:' frontmatter " +
                "(must declare 'lightweight' or 'structural')",
        );
        return problems;
    }
    if (complexity === 'lightweight') {
        _check_lightweight(text, line_count, problems);
    }
    if (horizon_weeks <= 0) {
        _check_no_plate(text, problems);
    }
    _check_execution_mode(fm, problems);
    if (warnings) {
        _check_autonomous_authoring(text, fm, warnings);
        _check_human_gate_steps(text, warnings);
        _check_human_gate_phase_headings(text, warnings);
        _check_human_gate_exit_criteria(text, warnings);
    }
    return problems;
}

// Vague-step patterns (ask-when-uncertain trigger subset) — under
// execution.mode: autonomous these guarantee mid-run ambiguity halts,
// so they warn at authoring time instead. Warnings never fail the lint.
const VAGUE_STEP_PATS: Array<[RegExp, string]> = [
    [/\b(improve|optimi[sz]e)\b(?!.*\bby\b)/i, "'improve / optimize' without a measurable target"],
    [/\bmake (it|this|.{0,30}) (better|cleaner|nicer)\b/i, "'make it better/cleaner'"],
    [/\bclean ?up\b(?!.*\(<)/i, "'clean up' without named scope"],
    [/\bfix (this|it)\b/i, "'fix this' without a symptom"],
    [/\buse best practices\b/i, "'use best practices'"],
    [/\bhandle errors properly\b/i, "'handle errors properly'"],
];

function _check_autonomous_authoring(text: string, fm: string, warnings: string[]): void {
    const m = EXEC_MODE_PAT.exec(fm);
    if (m === null || m[1]!.replace(/^['"]|['"]$/g, '') !== 'autonomous') {
        return;
    }
    const deferred = _countMatches(/^\s*-\s*\[~\]/m, text);
    if (deferred > 0) {
        warnings.push(
            `execution.mode: autonomous with ${deferred} pre-existing [~] deferred item(s) — ` +
                'the deferred-resolution archival gate (roadmap-progress-sync Iron Law 3) ' +
                'WILL interrupt the run at the end; resolve or re-author them now',
        );
    }
    for (const rawLine of text.split('\n')) {
        if (!/^\s*-\s*\[ \]/.test(rawLine)) {
            continue;
        }
        for (const [re, label] of VAGUE_STEP_PATS) {
            if (re.test(rawLine)) {
                warnings.push(
                    `vague step under execution.mode: autonomous (${label}): ` +
                        `"${rawLine.trim().slice(0, 80)}" — vagueness resolves cheaply at ` +
                        'authoring time, expensively as a mid-run ambiguity halt',
                );
                break;
            }
        }
    }
}

// Human-gate step patterns (templates/roadmaps.md rule 22) — checkbox
// steps that park work on a human instead of the agent. Steps are
// agent-executable by default; genuinely user-clearable gates belong in
// a structured `## Blockers` entry, agent-checkable verifications become
// commands / targeted tests. Warnings never fail the lint; they fire for
// every execution mode (an interactive roadmap with sprinkled human-check
// steps is the same authoring bug, just slower to hurt).
const HUMAN_GATE_STEP_PATS: Array<[RegExp, string]> = [
    [
        /\b(user|maintainer|human|operator|stakeholder|product owner) (verifies|reviews|approves|confirms|signs?[- ]off(?: on)?|inspects|validates)\b/i,
        "'<human> verifies / reviews / approves …' step",
    ],
    [
        /\bmanually (verify|review|check|test|confirm|inspect|validate)\b/i,
        "'manually verify / check …' step",
    ],
    [
        /\bwait for (the )?(user|maintainer|stakeholders?|approval|confirmation|review|feedback)\b/i,
        "'wait for approval / user' step",
    ],
    [/\bask the (user|maintainer)\b/i, "'ask the user' step"],
    [
        /\b(get|obtain|request|await|collect) ((the|an?|final) )?((user|maintainer|stakeholder|product owner|team) )?(approval|confirmation|sign[- ]?off)\b/i,
        "'obtain approval / sign-off' step",
    ],
    [/\bsign[- ]?off (from|by)\b/i, "'sign-off from <human>' step"],
    [/\bhuman review (required|needed|gate)\b/i, "'human review required' step"],
    [
        /\b(confirm|check|verify|review|clarify) with the (user|maintainer)\b/i,
        "'confirm with the user' step",
    ],
];

// Human-gate phase headings (template rule 22) — a phase whose TITLE is
// the human checkpoint ("## Phase 5 — Review / Sign-off", "## User
// Acceptance"). Whole-heading match after an optional "Phase N" prefix,
// so working headings ("## Review existing skills") never fire.
const HUMAN_GATE_HEADING_PAT =
    /^#{2,3}\s+(?:phase\s+\d+\s*(?:[—–:.-])?\s*)?(?:review(?:\s*(?:[/&+]|and)\s*sign[- ]?off)?|sign[- ]?off|approval|user\s+acceptance(?:\s+testing)?|manual\s+(?:verification|review|testing|qa)|human\s+(?:validation|review))\s*$/i;

// Human-approval exit / acceptance criteria (template rule 22) — criteria
// must be agent-decidable (exit code, file exists, test passes), never
// "user approves" / "looks good". Applied inside Exit-criteria /
// Acceptance blocks only.
const HUMAN_GATE_CRITERIA_PAT =
    /\b(user|maintainer|human|operator|stakeholder|product owner)\b[^\n]{0,60}\b(approv\w*|confirm\w*|sign[- ]?off|reviews)\b|\b(approval|confirmation|sign[- ]?off)\s+(from|by|received)\b|\blooks good\b/i;

const EXIT_CRITERIA_OPENER_PAT = /^\s*(?:[-*]\s+)?\*{0,2}(exit criteria|acceptance(?: criteria)?)\*{0,2}\s*:?/i;

const RULE22_HINT =
    'templates/roadmaps.md rule 22: steps and criteria are agent-decidable; ' +
    'replace with an agent-verifiable check (command / targeted test) or, ' +
    'if only a human can decide/authorize, a structured ## Blockers entry';

function _check_human_gate_steps(text: string, warnings: string[]): void {
    for (const rawLine of text.split('\n')) {
        if (!/^\s*-\s*\[ \]/.test(rawLine)) {
            continue;
        }
        for (const [re, label] of HUMAN_GATE_STEP_PATS) {
            if (re.test(rawLine)) {
                warnings.push(
                    `human-gate step (${label}): ` +
                        `"${rawLine.trim().slice(0, 80)}" — ${RULE22_HINT}`,
                );
                break;
            }
        }
    }
}

function _check_human_gate_phase_headings(text: string, warnings: string[]): void {
    for (const rawLine of text.split('\n')) {
        if (!rawLine.startsWith('#')) {
            continue;
        }
        if (HUMAN_GATE_HEADING_PAT.test(rawLine)) {
            warnings.push(
                `human-gate phase heading: "${rawLine.trim().slice(0, 80)}" — ` +
                    'a phase whose work only a human can finish blocks autonomous ' +
                    `execution; ${RULE22_HINT}`,
            );
        }
    }
}

function _check_human_gate_exit_criteria(text: string, warnings: string[]): void {
    let inHeadingBlock = false;
    let inInlineBlock = false;
    for (const rawLine of text.split('\n')) {
        const heading = /^#{1,6}\s+(.*)$/.exec(rawLine);
        if (heading) {
            inHeadingBlock = /\b(acceptance|exit criteria)\b/i.test(heading[1]!);
            inInlineBlock = false;
            continue;
        }
        if (rawLine.trim() === '') {
            inInlineBlock = false;
            continue;
        }
        const opener = EXIT_CRITERIA_OPENER_PAT.test(rawLine);
        if (opener) {
            inInlineBlock = true;
        }
        if (!inHeadingBlock && !inInlineBlock) {
            continue;
        }
        // Open-checkbox lines are covered by _check_human_gate_steps;
        // done/deferred/cancelled lines record history, not future gates.
        if (/^\s*-\s*\[[ xX~-]\]/.test(rawLine)) {
            continue;
        }
        if (HUMAN_GATE_CRITERIA_PAT.test(rawLine)) {
            warnings.push(
                `human-approval exit criterion: "${rawLine.trim().slice(0, 80)}" — ` +
                    `criteria must be agent-decidable; ${RULE22_HINT}`,
            );
        }
    }
}

function _check_execution_mode(fm: string, problems: string[]): void {
    if (!fm || !/^execution:/m.test(fm)) {
        return; // absent field = interactive default — valid
    }
    const m = EXEC_MODE_PAT.exec(fm);
    if (m === null) {
        problems.push(
            "'execution:' frontmatter block present but no 'mode:' key found " +
                "(expected execution.mode: autonomous | phase-checkpoints | interactive " +
                'per templates/roadmaps.md rule 18)',
        );
        return;
    }
    const value = m[1]!.replace(/^['"]|['"]$/g, '');
    if (!EXEC_MODE_VALUES.has(value)) {
        problems.push(
            `unknown execution.mode '${value}' — allowed: autonomous | ` +
                'phase-checkpoints | interactive (templates/roadmaps.md rule 18)',
        );
    }
}

function main(): number {
    const roadmaps = _globRoadmaps();
    const horizon_weeks = _read_horizon_weeks();
    if (roadmaps.length === 0) {
        if (!QUIET) {
            process.stdout.write(`✅  no active roadmaps under ${ROADMAP_GLOB} — nothing to lint\n`);
        }
        return 0;
    }
    let failed = 0;
    const summary: Array<[string, string]> = [];
    for (const roadmap of roadmaps) {
        const rel = _relPosix(roadmap, REPO_ROOT);
        const warnings: string[] = [];
        const problems = lint_roadmap(roadmap, horizon_weeks, warnings);
        for (const w of warnings) {
            process.stderr.write(`⚠️  ${rel}\n    - ${w}\n`);
        }
        const text = fs.readFileSync(roadmap, 'utf-8');
        const complexity = _read_complexity(_frontmatter(text)) ?? 'untagged';
        summary.push([rel, complexity]);
        if (problems.length > 0) {
            failed++;
            process.stderr.write(`❌  ${rel}  [${complexity}]\n`);
            for (const pr of problems) {
                process.stderr.write(`    - ${pr}\n`);
            }
        } else {
            if (!QUIET) {
                process.stdout.write(`✅  ${rel}  [${complexity}]\n`);
            }
        }
    }
    process.stdout.write('\n');
    const light = summary.filter(([, c]) => c === 'lightweight').length;
    const structural = summary.filter(([, c]) => c === 'structural').length;
    const untagged = summary.filter(([, c]) => c === 'untagged').length;
    process.stdout.write(
        `summary: ${light} lightweight · ${structural} structural · ` +
            `${untagged} untagged · ${summary.length} total\n`,
    );
    if (failed) {
        process.stderr.write(`\n❌  ${failed} roadmap(s) failed complexity lint\n`);
        return 1;
    }
    if (!QUIET) {
        process.stdout.write(`\n✅  ${roadmaps.length} roadmap(s) complexity-clean\n`);
    }
    return 0;
}

// --- helpers ---------------------------------------------------------------

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Count occurrences of a single char in text[start:end] (Python str.count). */
function _countChar(text: string, ch: string, start = 0, end?: number): number {
    const slice = text.slice(start, end);
    let n = 0;
    for (const c of slice) {
        if (c === ch) {
            n++;
        }
    }
    return n;
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

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    REPO_ROOT,
    ROADMAP_GLOB,
    LIGHTWEIGHT_LINE_CAP,
    LIGHTWEIGHT_PHASE_CAP,
    PLATE_PATS,
    _frontmatter,
    _read_horizon_weeks,
    _read_complexity,
    lint_roadmap,
    main,
};
