#!/usr/bin/env tsx
/**
 * Gate R1 validator — plan-risk Risk Register grammar.
 *
 * Implements exactly `docs/contracts/plan-review-gates.md` § 1 (Risk Register
 * grammar incl. the grandfather clause), § 3 (substantial-change heuristic)
 * and § 6 (exit-code contract). A divergence from that contract is a
 * validator bug, never a contract reinterpretation.
 *
 * Corpus: ready (non-draft) roadmap files directly under `agents/roadmaps/`
 * (top level only — `archive/`, `skipped/`, `later/`, `stubs/` excluded, as
 * are `template.md` and `dashboard*`). `status: draft` frontmatter exempts a
 * file (reported as `draft-exempt`, still counted as scanned).
 *
 * Checks per ready file:
 *   1. `## Risk Register` section exists — missing = fail unless the
 *      grandfather clause applies (no substantial change since the gate
 *      activation date, measured against the last pre-activation commit).
 *   2. Marker line `<!-- risk-review: v1 | reviewed: YYYY-MM-DD | reviewer: <id> -->`
 *      is the first non-blank line after the heading.
 *   3. Body is EITHER the exact honest-null line OR the six-column risk
 *      table (Rank ascending from 1, Risk type ∈ {product, implementation},
 *      Mitigation non-empty, every `Anchored under` anchor resolving to a
 *      heading / `**Step N:**` bullet in the same document).
 *   4. Staleness: `reviewed:` may not predate the last substantial change
 *      (feature comparison against the newest commit on/before the reviewed
 *      date). Skipped while the file has uncommitted modifications — there is
 *      no committed baseline for the current content to compare against.
 *
 * Exit codes (contract § 6): 0 = pass, 1 = policy violation,
 * 2 = internal error (degraded advisory mode for callers).
 */

import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { isAcceptanceCriteriaHeading } from './_lib/ac_heading.js';
import { workspaceIdentity } from './_lib/git_common_dir.js';
import { gitEnv } from './_lib/git_env.js';
import { splitMarkdownRow } from './_lib/md_table.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

/**
 * Gate activation date — committed source:
 * docs/contracts/plan-review-gates.md § 1 (grandfather clause, council
 * 2026-08-04). Ready roadmaps without a register are exempt while their
 * content has had no substantial change since this date.
 */
export const RISK_REGISTER_GATE_ACTIVATION = '2026-08-04';

export const MARKER_RE =
    /^<!--\s*risk-review:\s*v1\s*\|\s*reviewed:\s*(\d{4}-\d{2}-\d{2})\s*\|\s*reviewer:\s*(.+?)\s*-->\s*$/;
const HONEST_NULL_RE = /^\*\*Honest-null:\*\*(.*)$/;
const CHECKBOX_RE = /^\s*- \[( |x|~|-)\]/;
const PHASE_HEADING_RE = /^##\s+(Phase|Milestone)\b.*$/;
const FENCE_RE = /^\s*```/;
const STEP_BULLET_RE = /\*\*Step\s+([0-9]+[a-z]?):\*\*/i;

export interface Violation {
    file: string;
    line: number;
    kind: string;
    detail: string;
}

export interface PlanFeatures {
    /** Sorted `## Phase …` / `## Milestone …` heading texts. */
    phaseHeadings: string[];
    /** Total count of deliverable checkbox lines (state-insensitive). */
    checkboxCount: number;
    /** sha256 of the acceptance-criteria section body (heading matched per `_lib/ac_heading`; checkbox state normalized). */
    acHash: string;
}

function _splitLines(text: string): string[] {
    return text.split(/\r?\n/);
}

/** Lines of the document with an outside-code-fence flag per line. */
function _linesOutsideFences(text: string): Array<{ line: string; outside: boolean }> {
    const out: Array<{ line: string; outside: boolean }> = [];
    let inFence = false;
    for (const line of _splitLines(text)) {
        if (FENCE_RE.test(line)) {
            inFence = !inFence;
            out.push({ line, outside: false });
            continue;
        }
        out.push({ line, outside: !inFence });
    }
    return out;
}

/**
 * Extract the three substantial-change features of contract § 3:
 * (a) phase/milestone heading set, (b) checkbox line count,
 * (c) sha256 of the Acceptance Criteria section body. Checkbox STATE is
 * normalized everywhere (state flips are never substantial).
 */
export function extractFeatures(text: string): PlanFeatures {
    const lines = _linesOutsideFences(text);
    const phaseHeadings: string[] = [];
    let checkboxCount = 0;
    let acStart = -1;
    for (let i = 0; i < lines.length; i++) {
        const entry = lines[i] as { line: string; outside: boolean };
        if (!entry.outside) continue;
        if (PHASE_HEADING_RE.test(entry.line)) {
            phaseHeadings.push(entry.line.trim());
        }
        if (CHECKBOX_RE.test(entry.line)) {
            checkboxCount += 1;
        }
        if (isAcceptanceCriteriaHeading(entry.line)) {
            acStart = i;
        }
    }
    let acBody = '';
    if (acStart !== -1) {
        const bodyLines: string[] = [];
        for (let i = acStart + 1; i < lines.length; i++) {
            const entry = lines[i] as { line: string; outside: boolean };
            if (entry.outside && /^##\s/.test(entry.line)) break;
            bodyLines.push(entry.line);
        }
        // Checkbox state flips inside AC are never substantial — normalize.
        acBody = bodyLines.join('\n').replace(/^(\s*- )\[( |x|~|-)\]/gm, '$1[ ]');
    }
    const acHash = crypto.createHash('sha256').update(acBody, 'utf-8').digest('hex');
    return { phaseHeadings: [...phaseHeadings].sort(), checkboxCount, acHash };
}

export function featuresEqual(a: PlanFeatures, b: PlanFeatures): boolean {
    return (
        a.checkboxCount === b.checkboxCount &&
        a.acHash === b.acHash &&
        a.phaseHeadings.length === b.phaseHeadings.length &&
        a.phaseHeadings.every((h, i) => h === b.phaseHeadings[i])
    );
}

/** Contract § 3 — a plan diff is substantial iff the feature sets differ. */
export function isSubstantialChange(oldText: string, newText: string): boolean {
    return !featuresEqual(extractFeatures(oldText), extractFeatures(newText));
}

export interface Marker {
    reviewed: string;
    reviewer: string;
}

/** Parse the § 1.1 marker line; null when malformed. */
export function parseMarker(line: string): Marker | null {
    const m = MARKER_RE.exec(line.trim());
    if (!m) return null;
    const reviewed = m[1] as string;
    const reviewer = (m[2] as string).trim();
    if (reviewer === '') return null;
    return { reviewed, reviewer };
}

/** § 1.3 — exact honest-null grammar: `**Honest-null:** … because: <non-empty>.` */
export function isValidHonestNull(line: string): boolean {
    const m = HONEST_NULL_RE.exec(line.trim());
    if (!m) return false;
    const rest = m[1] as string;
    const because = /\bbecause:\s*(.*)$/.exec(rest);
    if (!because) return false;
    const reason = (because[1] as string).replace(/\.\s*$/, '').trim();
    return reason !== '';
}

function _escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** § 1.2 — does an `Anchored under` anchor resolve inside the same document? */
export function anchorResolves(anchor: string, docText: string): boolean {
    const a = anchor.trim();
    if (a === '') return false;
    const aLower = a.toLowerCase();
    const lines = _linesOutsideFences(docText);
    const headingLines: string[] = [];
    const stepBulletLines: string[] = [];
    for (const entry of lines) {
        if (!entry.outside) continue;
        if (/^#{1,6}\s/.test(entry.line)) headingLines.push(entry.line.toLowerCase());
        if (STEP_BULLET_RE.test(entry.line)) stepBulletLines.push(entry.line.toLowerCase());
    }
    if (headingLines.some((h) => h.includes(aLower))) return true;
    if (stepBulletLines.some((b) => b.includes(aLower))) return true;
    // `Phase X Step Y` / `Phase X` compound form: "Phase X" must appear in a
    // heading; a given "Step Y" must appear as a `**Step Y:**` bullet.
    const compound = /^phase\s+(\S+?)(?:\s+step\s+([0-9]+[a-z]?))?$/i.exec(a);
    if (compound) {
        const phaseRe = new RegExp(`\\bphase\\s+${_escapeRe(compound[1] as string)}\\b`, 'i');
        if (headingLines.some((h) => phaseRe.test(h))) {
            const step = compound[2];
            if (step === undefined) return true;
            const stepRe = new RegExp(`\\*\\*step\\s+${_escapeRe(step)}:\\*\\*`, 'i');
            if (stepRe.test(docText)) return true;
        }
    }
    return false;
}

const TABLE_HEADER_CELLS = ['Rank', 'Item', 'Risk type', 'Description', 'Mitigation', 'Anchored under'];

function _splitRow(line: string): string[] {
    return splitMarkdownRow(line);
}

function _isHeaderRow(line: string): boolean {
    const cells = _splitRow(line);
    return (
        cells.length === TABLE_HEADER_CELLS.length &&
        cells.every((c, i) => c === TABLE_HEADER_CELLS[i])
    );
}

function _isSeparatorRow(line: string): boolean {
    const cells = _splitRow(line);
    return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c) || /^-+$/.test(c));
}

/**
 * § 1.2 — validate the risk table rows found in `bodyLines` (section body
 * after the marker). `startLine` is the 1-based document line of the first
 * body line, used for violation line numbers. Returns violations; the caller
 * decides emptiness handling.
 */
export function validateTable(
    file: string,
    docText: string,
    bodyLines: readonly string[],
    startLine: number,
): { headerFound: boolean; rowCount: number; violations: Violation[] } {
    const violations: Violation[] = [];
    let headerFound = false;
    let rowCount = 0;
    let prevRank = 0;
    for (let i = 0; i < bodyLines.length; i++) {
        const line = bodyLines[i] as string;
        const lineNo = startLine + i;
        if (!line.trim().startsWith('|')) {
            if (headerFound && line.trim() !== '') break; // table ended
            continue;
        }
        if (!headerFound) {
            if (_isHeaderRow(line)) headerFound = true;
            continue;
        }
        if (_isSeparatorRow(line)) continue;
        const cells = _splitRow(line);
        if (cells.length < TABLE_HEADER_CELLS.length) {
            violations.push({
                file,
                line: lineNo,
                kind: 'malformed_row',
                detail: `risk row has ${cells.length} cell(s), expected ${TABLE_HEADER_CELLS.length}`,
            });
            continue;
        }
        rowCount += 1;
        const [rankCell, , riskType, , mitigation, anchoredUnder] = cells as [
            string,
            string,
            string,
            string,
            string,
            string,
        ];
        const rank = /^\d+$/.test(rankCell) ? Number(rankCell) : NaN;
        if (Number.isNaN(rank) || (prevRank === 0 && rank !== 1) || (prevRank !== 0 && rank <= prevRank)) {
            violations.push({
                file,
                line: lineNo,
                kind: 'bad_rank_order',
                detail: `Rank \`${rankCell}\` — ranks must be strictly ascending integers starting at 1 (previous: ${prevRank})`,
            });
        }
        if (!Number.isNaN(rank)) prevRank = rank;
        if (riskType !== 'product' && riskType !== 'implementation') {
            violations.push({
                file,
                line: lineNo,
                kind: 'bad_risk_type',
                detail: `Risk type \`${riskType}\` — must be \`product\` or \`implementation\``,
            });
        }
        if (mitigation === '') {
            violations.push({
                file,
                line: lineNo,
                kind: 'empty_mitigation',
                detail: 'Mitigation cell is empty — every risk row needs a mitigation',
            });
        }
        if (anchoredUnder === '') {
            violations.push({
                file,
                line: lineNo,
                kind: 'empty_anchor',
                detail: '`Anchored under` cell is empty — every risk must anchor to a plan section',
            });
            continue;
        }
        for (const anchor of anchoredUnder.split(',')) {
            const a = anchor.trim();
            if (a === '') continue;
            if (!anchorResolves(a, docText)) {
                violations.push({
                    file,
                    line: lineNo,
                    kind: 'dangling_anchor',
                    detail: `\`Anchored under\` reference \`${a}\` does not resolve to any heading or \`**Step N:**\` bullet in this document`,
                });
            }
        }
    }
    return { headerFound, rowCount, violations };
}

/** `status: draft` in the YAML frontmatter block exempts a file. */
export function hasDraftStatus(text: string): boolean {
    const lines = _splitLines(text);
    if ((lines[0] ?? '').trim() !== '---') return false;
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i] as string;
        if (line.trim() === '---') return false;
        if (/^status:\s*draft\s*$/.test(line)) return true;
    }
    return false;
}

export interface ContentResult {
    draftExempt: boolean;
    registerMissing: boolean;
    /** Parsed `reviewed:` date when the marker is valid; null otherwise. */
    reviewed: string | null;
    violations: Violation[];
}

/** Pure content-level Gate-R1 check (no git — grandfather/staleness live in checkFile). */
export function checkContent(file: string, text: string): ContentResult {
    const result: ContentResult = {
        draftExempt: false,
        registerMissing: false,
        reviewed: null,
        violations: [],
    };
    if (hasDraftStatus(text)) {
        result.draftExempt = true;
        return result;
    }
    const lines = _linesOutsideFences(text);
    let regIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        const entry = lines[i] as { line: string; outside: boolean };
        if (entry.outside && /^##\s+Risk Register\s*$/.test(entry.line)) {
            regIdx = i;
            break;
        }
    }
    if (regIdx === -1) {
        result.registerMissing = true;
        return result;
    }
    let endIdx = lines.length;
    for (let i = regIdx + 1; i < lines.length; i++) {
        const entry = lines[i] as { line: string; outside: boolean };
        if (entry.outside && /^##\s/.test(entry.line)) {
            endIdx = i;
            break;
        }
    }
    const sectionLines = lines.slice(regIdx + 1, endIdx).map((e) => e.line);
    // Marker: first non-blank line after the heading.
    let markerOffset = -1;
    for (let i = 0; i < sectionLines.length; i++) {
        if ((sectionLines[i] as string).trim() !== '') {
            markerOffset = i;
            break;
        }
    }
    if (markerOffset === -1) {
        result.violations.push({
            file,
            line: regIdx + 1,
            kind: 'missing_marker',
            detail: 'Risk Register section is empty — missing `<!-- risk-review: v1 | reviewed: YYYY-MM-DD | reviewer: <id> -->` marker',
        });
        return result;
    }
    const markerLine = sectionLines[markerOffset] as string;
    const marker = parseMarker(markerLine);
    let bodyStartOffset = markerOffset; // body starts after the marker when valid
    if (marker === null) {
        result.violations.push({
            file,
            line: regIdx + 2 + markerOffset,
            kind: 'malformed_marker',
            detail:
                'first non-blank line after `## Risk Register` must be ' +
                '`<!-- risk-review: v1 | reviewed: YYYY-MM-DD | reviewer: <id> -->` ' +
                `(got: \`${markerLine.trim()}\`)`,
        });
    } else {
        result.reviewed = marker.reviewed;
        bodyStartOffset = markerOffset + 1;
    }
    const bodyLines = sectionLines.slice(bodyStartOffset);
    const bodyStartLine = regIdx + 2 + bodyStartOffset;
    // Honest-null branch.
    let honestNullSeen = false;
    for (let i = 0; i < bodyLines.length; i++) {
        const line = (bodyLines[i] as string).trim();
        if (!HONEST_NULL_RE.test(line)) continue;
        honestNullSeen = true;
        if (!isValidHonestNull(line)) {
            result.violations.push({
                file,
                line: bodyStartLine + i,
                kind: 'malformed_honest_null',
                detail:
                    'honest-null line must be exactly ' +
                    '`**Honest-null:** no material product or implementation risks identified because: <reason>.` ' +
                    'with a non-empty reason after `because:`',
            });
        }
        break;
    }
    // The table is validated whenever one is PRESENT — never suppressed by the
    // honest-null line. § 1.3 makes honest-null valid "only as exactly this
    // shape", so honest-null + table is contradictory: gating validateTable on
    // `!honestNullSeen` let such a register pass with zero row checks (bad
    // ranks, bad risk types, empty mitigations, dangling anchors all
    // unreported) — one honest-null line anywhere in the body disabled the whole
    // table check. Gate R2's `evaluate` already reports the analogous
    // skip-declaration-plus-table combination and still validates the rows; this
    // is the same rule on the R1 side.
    const { headerFound, rowCount, violations } = validateTable(file, text, bodyLines, bodyStartLine);
    if (honestNullSeen) {
        if (headerFound || rowCount > 0) {
            result.violations.push(...violations);
            result.violations.push({
                file,
                line: regIdx + 1,
                kind: 'contradictory_register',
                detail:
                    'Risk Register carries BOTH the honest-null line and a risk table — § 1.3 admits ' +
                    'honest-null only as the sole body content. Remove one: the table if there are ' +
                    'genuinely no risks, the honest-null line otherwise',
            });
        }
        return result;
    }
    result.violations.push(...violations);
    if (!headerFound || rowCount === 0) {
        result.violations.push({
            file,
            line: regIdx + 1,
            kind: 'empty_register',
            detail:
                'Risk Register is empty or prose-only — needs the six-column risk table ' +
                'or the exact honest-null line (prose like "no risks" does not count)',
        });
    }
    return result;
}

// --------------------------------------------------------------------------
// Git layer — grandfather clause + staleness.
// --------------------------------------------------------------------------

/**
 * Node's default `maxBuffer` is 1 MiB. `_git` reads whole file blobs
 * (`git show <sha>:<path>`), and a plan larger than that would throw ENOBUFS →
 * `null` → **no staleness baseline** → the check silently passes. Same
 * self-disabling shape as the Gate-R2 scope diff, and here it fails OPEN, so the
 * ceiling is raised rather than relied on.
 */
const GIT_MAX_BUFFER = 256 * 1024 * 1024;

function _git(cwd: string, args: readonly string[]): string | null {
    try {
        return execFileSync('git', [...args], {
            cwd,
            encoding: 'utf-8',
            maxBuffer: GIT_MAX_BUFFER,
            stdio: ['ignore', 'pipe', 'pipe'],
            // cwd decides, never an inherited GIT_DIR (hook environments).
            env: gitEnv(),
        });
    } catch {
        return null;
    }
}

interface HistoryEntry {
    sha: string;
    date: string; // %cs — YYYY-MM-DD
}

/**
 * Repo root containing `dir`, or `null` outside a repository.
 *
 * Census rows R5–R7. The three call sites below each spawned
 * `rev-parse --show-toplevel` through `_git` — already `GIT_DIR`-safe via
 * `gitEnv()`, so this migration is behaviour-identical by construction and
 * exists to remove the third, fourth and fifth re-derivation of one question,
 * not to fix a defect. The resolver reads files instead of spawning, so the
 * three checks also stop costing three subprocesses.
 */
function _repoRootOf(dir: string): string | null {
    const root = workspaceIdentity(dir).repoRoot;
    return root.resolved ? root.value : null;
}

/** Newest-first commit history of a file; empty for untracked / non-repo paths. */
export function fileHistory(absPath: string): HistoryEntry[] {
    const dir = path.dirname(absPath);
    const root = _repoRootOf(dir);
    if (root === null) return [];
    // Normalize separators: git pathspecs use `/` on every platform, so a raw
    // Windows `path.relative()` result matches nothing and would silently yield
    // an empty history — which the grandfather clause reads as "no baseline".
    const rel = path.relative(root, absPath).split(path.sep).join('/');
    const out = _git(root, ['log', '--format=%H %cs', '--', rel]);
    if (out === null) return [];
    const entries: HistoryEntry[] = [];
    for (const line of out.trim().split('\n')) {
        if (line === '') continue;
        const [sha, date] = line.split(' ');
        if (sha !== undefined && date !== undefined) entries.push({ sha, date });
    }
    return entries;
}

/**
 * Does `absPath` differ from committed state in the working tree?
 *
 * Staleness (§ 1.1) compares the working-tree text against the blob of the
 * newest commit dated `<= reviewed:`. While a substantial edit AND its freshly
 * written register are both uncommitted, that baseline is the *previous* commit,
 * whose features differ — so a register written the same minute is reported
 * stale. The gate judges committed history; with uncommitted modifications there
 * is no committed history to judge yet, so staleness is not decidable and the
 * check is skipped rather than answered wrongly. Untracked / non-repo paths
 * report `false` (they have no history at all, so staleness never fires there).
 */
export function hasUncommittedChanges(absPath: string): boolean {
    const dir = path.dirname(absPath);
    const root = _repoRootOf(dir);
    if (root === null) return false;
    const rel = path.relative(root, absPath).split(path.sep).join('/');
    const out = _git(root, ['status', '--porcelain', '--', rel]);
    if (out === null) return false;
    return out.trim() !== '';
}

function _blobAt(absPath: string, sha: string): string | null {
    const dir = path.dirname(absPath);
    const root = _repoRootOf(dir);
    if (root === null) return null;
    const rel = path.relative(root, absPath).split(path.sep).join('/');
    return _git(root, ['show', `${sha}:${rel}`]);
}

export type FileStatus = 'ok' | 'draft-exempt' | 'grandfathered' | 'fail';

export interface FileResult {
    file: string;
    status: FileStatus;
    violations: Violation[];
}

/** Full Gate-R1 check for one ready roadmap file (content + git layers). */
export function checkFile(absPath: string): FileResult {
    const text = fs.readFileSync(absPath, 'utf-8');
    const content = checkContent(absPath, text);
    if (content.draftExempt) {
        return { file: absPath, status: 'draft-exempt', violations: [] };
    }
    if (content.registerMissing) {
        // Grandfather clause (contract § 1): exempt while feature-equal with
        // the file's last committed state STRICTLY BEFORE the activation date.
        // Strictness is load-bearing: with `<=`, a substantial change committed
        // on the activation day becomes its own baseline and grandfathers
        // itself — the exemption would cover exactly the changes the gate
        // exists to catch. A file whose history starts on or after activation
        // has no baseline and must carry a register.
        const history = fileHistory(absPath);
        const pre = history.find((h) => h.date < RISK_REGISTER_GATE_ACTIVATION);
        if (pre === undefined) {
            return {
                file: absPath,
                status: 'fail',
                violations: [
                    {
                        file: absPath,
                        line: 1,
                        kind: 'missing_register',
                        detail:
                            'no `## Risk Register` section and no committed version before the ' +
                            `gate activation date ${RISK_REGISTER_GATE_ACTIVATION} — new plans must carry a register`,
                    },
                ],
            };
        }
        const blob = _blobAt(absPath, pre.sha);
        if (blob !== null && featuresEqual(extractFeatures(blob), extractFeatures(text))) {
            return { file: absPath, status: 'grandfathered', violations: [] };
        }
        return {
            file: absPath,
            status: 'fail',
            violations: [
                {
                    file: absPath,
                    line: 1,
                    kind: 'missing_register',
                    detail:
                        'no `## Risk Register` section and the plan changed substantially since the ' +
                        `activation date ${RISK_REGISTER_GATE_ACTIVATION} — the grandfather exemption is lifted`,
                },
            ],
        };
    }
    const violations = [...content.violations];
    // A file with uncommitted modifications has no committed baseline for the
    // current content, so staleness is not judgeable — see
    // hasUncommittedChanges. The committed-history case below is unchanged.
    if (content.reviewed !== null && !hasUncommittedChanges(absPath)) {
        // Staleness (contract §§ 1.1 + 3): compare features of the newest
        // commit on/before the reviewed date against the current content.
        const history = fileHistory(absPath);
        const base = history.find((h) => h.date <= (content.reviewed as string));
        if (base !== undefined) {
            const blob = _blobAt(absPath, base.sha);
            if (blob !== null && !featuresEqual(extractFeatures(blob), extractFeatures(text))) {
                violations.push({
                    file: absPath,
                    line: 1,
                    kind: 'stale_review',
                    detail:
                        `\`reviewed: ${content.reviewed}\` predates the last substantial change ` +
                        '(phase headings, checkbox count, or Acceptance Criteria differ from the ' +
                        'version at the review date) — re-review the plan',
                });
            }
        }
        // No commit on/before the reviewed date → the register was just
        // written (brand-new / uncommitted file) → fresh.
    }
    return {
        file: absPath,
        status: violations.length > 0 ? 'fail' : 'ok',
        violations,
    };
}

// --------------------------------------------------------------------------
// CLI.
// --------------------------------------------------------------------------

const EXCLUDED_NAMES_RE = /^(template\.md|dashboard.*)$/;

/** Ready-roadmap corpus: top-level `*.md` under each root dir, name-filtered. */
function _resolveTargets(paths: readonly string[]): string[] {
    const out: string[] = [];
    for (const raw of paths) {
        let stat: fs.Stats;
        try {
            stat = fs.statSync(raw);
        } catch {
            continue;
        }
        if (stat.isDirectory()) {
            const entries = fs
                .readdirSync(raw, { withFileTypes: true })
                .filter((e) => e.isFile() && e.name.endsWith('.md') && !EXCLUDED_NAMES_RE.test(e.name))
                .map((e) => path.join(raw, e.name));
            entries.sort();
            out.push(...entries);
        } else if (raw.endsWith('.md')) {
            out.push(raw);
        }
    }
    return out;
}

/** `planning.risk_review === false` in `<dir>/.agent-settings.yml` disables Gate R1. */
export function riskReviewDisabled(settingsDir: string): boolean {
    const settingsPath = path.join(settingsDir, '.agent-settings.yml');
    let raw: string;
    try {
        raw = fs.readFileSync(settingsPath, 'utf-8');
    } catch {
        return false;
    }
    try {
        const parsed = parseYaml(raw) as unknown;
        if (parsed === null || typeof parsed !== 'object') return false;
        const planning = (parsed as Record<string, unknown>)['planning'];
        if (planning === null || typeof planning !== 'object') return false;
        return (planning as Record<string, unknown>)['risk_review'] === false;
    } catch {
        return false;
    }
}

interface Args {
    paths: string[];
    format: 'text' | 'json';
    quiet: boolean;
}

function parse_args(argv: readonly string[]): Args {
    const paths: string[] = [];
    let format: 'text' | 'json' = 'text';
    let quiet = false;
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] as string;
        if (arg === '--format') {
            const v = argv[++i] as string | undefined;
            if (v !== 'text' && v !== 'json') {
                process.stderr.write(
                    `lint_plan_risk_register: error: argument --format: invalid choice: '${v ?? ''}' (choose from 'text', 'json')\n`,
                );
                process.exit(2);
            }
            format = v;
        } else if (arg.startsWith('--format=')) {
            const v = arg.slice('--format='.length);
            if (v !== 'text' && v !== 'json') {
                process.stderr.write(
                    `lint_plan_risk_register: error: argument --format: invalid choice: '${v}' (choose from 'text', 'json')\n`,
                );
                process.exit(2);
            }
            format = v;
        } else if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: lint_plan_risk_register [-h] [--format {text,json}] [--quiet] [paths ...]\n',
            );
            process.exit(0);
        } else if (arg.startsWith('-') && arg !== '-') {
            process.stderr.write(`lint_plan_risk_register: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        } else {
            paths.push(arg);
        }
        i++;
    }
    return {
        paths: paths.length ? paths : ['agents/roadmaps'],
        format,
        quiet,
    };
}

export function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    // Contract § 6: the `scanned:` line is emitted on EVERY exit path, exit 2
    // included, because the coverage guard reads that number. Emit-once, so the
    // count can be published BEFORE the first failure path without any later
    // path duplicating it — the same shape check_completion_review uses (there
    // an unresolvable base ref used to exit 2 emitting no count at all; here it
    // was the dead-scope return, the unexpected-internal return, and the
    // top-level CLI catch).
    let scannedEmitted = false;
    const emitScanned = (n: number): void => {
        if (scannedEmitted) {
            return;
        }
        scannedEmitted = true;
        process.stdout.write(`scanned: ${String(n)}\n`);
    };

    // Settings escape hatch (contract scope note): planning.risk_review: false
    // disables Gate R1. assertScanned is deliberately NOT called here — the
    // zero-scan is an explicit, configured skip, not a dead scope. The
    // gate-coverage guard runs in CI where no .agent-settings.yml exists, so
    // the real scanned floor is still enforced there.
    if (riskReviewDisabled(process.cwd())) {
        process.stdout.write('⚠️  planning.risk_review=false — Gate R1 skipped (settings escape hatch)\n');
        emitScanned(0);
        return 0;
    }

    let targets: string[];
    try {
        targets = _resolveTargets(args.paths);
    } catch (exc) {
        // Inventory resolution itself can fail (an unreadable roots directory —
        // EACCES on readdir). That used to escape main entirely and hit the
        // top-level CLI catch, which printed no count at all.
        emitScanned(0);
        process.stderr.write(
            `❌  Internal error: cannot resolve the roadmap corpus (${args.paths.join(', ')}): ` +
                `${exc instanceof Error ? exc.message : String(exc)}\n`,
        );
        return 2;
    }

    // The inventory needs no git and no file reads, so the coverage number is
    // known here — publish it before anything can fail.
    emitScanned(targets.length);

    // A root that does not exist on disk at all is a legitimately empty
    // corpus (a project with no roadmaps yet), NOT a dead scope. Only a root
    // that IS there while yielding nothing means the scan went blind. Without
    // this discriminator the gate would block every roadmap-less project with
    // a misleading "the root moved" error.
    const noRootOnDisk = args.paths.every((p) => !fs.existsSync(p));

    try {
        assertScanned({
            gate: 'lint_plan_risk_register',
            scanned: targets.length,
            units: 'ready roadmap file(s)',
            roots: args.paths,
            ...(noRootOnDisk ? { allowEmpty: 'no roadmaps directory in this project — nothing to gate' } : {}),
        });
    } catch (exc) {
        // A dead scan scope is a POLICY violation (exit 1), never an internal
        // error (exit 2). Exit 2 is warn-and-allow at every call site, so
        // mapping a moved/renamed roadmaps root to 2 would silently degrade
        // this gate to advisory — the exact blind-gate failure the
        // scanned-floor machinery exists to prevent. A gate that read nothing
        // has not passed. Contract carve-out:
        // docs/contracts/plan-review-gates.md § 6.
        // Both returns below rely on the emitScanned above: a dead scope reports
        // `scanned: 0` AND exit 1, so the coverage guard sees the zero instead
        // of a missing line (contract § 6).
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        // Anything else here really is internal (unexpected): degraded advisory.
        process.stderr.write(`❌  Internal error: ${exc instanceof Error ? exc.message : String(exc)}\n`);
        return 2;
    }

    const all_violations: Violation[] = [];
    let scanned = 0;
    const statusLines: string[] = [];
    try {
        for (const p of targets) {
            const result = checkFile(p);
            scanned += 1;
            if (result.status === 'draft-exempt') {
                statusLines.push(`  draft-exempt: ${p}`);
            } else if (result.status === 'grandfathered') {
                statusLines.push(`  grandfathered: ${p}`);
            }
            all_violations.push(...result.violations);
        }
    } catch (exc) {
        // Contract § 6: `scanned:` is emitted on EVERY exit path, exit 2
        // included. A throw mid-loop (unreadable file, permission denied) that
        // exited silently would leave the coverage guard with no count at all —
        // the same blind spot the guard exists to detect. Already published
        // above (the inventory count); this call is the no-op that documents
        // the obligation for this path.
        emitScanned(scanned);
        process.stderr.write(
            `❌  lint_plan_risk_register: internal error after ${String(scanned)} file(s): ` +
                `${exc instanceof Error ? exc.message : String(exc)}\n`,
        );
        return 2;
    }

    if (args.format === 'json') {
        process.stdout.write(JSON.stringify(all_violations, null, 2) + '\n');
    } else {
        if (!args.quiet && statusLines.length > 0) {
            process.stdout.write(statusLines.join('\n') + '\n');
        }
        if (all_violations.length > 0) {
            process.stdout.write(`❌  ${all_violations.length} Risk-Register violation(s):\n\n`);
            for (const v of all_violations) {
                process.stdout.write(`  ${v.file}:${v.line} — ${v.kind}\n`);
                process.stdout.write(`    │ ${v.detail}\n`);
            }
        } else if (!args.quiet) {
            process.stdout.write(`✅  Risk Registers clean (${scanned} ready roadmap file(s) scanned).\n`);
        }
    }

    // Gate-coverage contract (src/config/gate-coverage.yml): always emitted,
    // independent of the pass/fail verdict — already published above, so this
    // is a no-op that keeps the obligation visible on the success path too.
    emitScanned(scanned);

    return all_violations.length > 0 ? 1 : 0;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed projection, or macOS
    // /var → /private/var temp dirs) makes the raw URLs differ — compare
    // realpaths so the entry guard still fires.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    try {
        process.exit(main());
    } catch (exc) {
        // Exit-code contract (docs/contracts/plan-review-gates.md § 6):
        // internal error = 2 → degraded advisory mode for hook/CI callers.
        // Last-resort `scanned:` emission: main() publishes its own count before
        // any failure path, and the coverage guard reads the FIRST match, so a
        // real count always wins over this zero — but a throw that escapes main
        // before it emitted must still leave the guard a number, not silence.
        process.stdout.write('scanned: 0\n');
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  Internal error: ${msg}\n`);
        process.exit(2);
    }
}
