#!/usr/bin/env node
/**
 * Deterministic detection helper for the refine-ticket skill.
 *
 * TypeScript twin of `refine_ticket_detect.py` (Phase 8 / Wave 8g).
 *
 * Reads the detection-map.yml from
 * .agent-src.uncondensed/skills/refine-ticket/ (or the projected copy),
 * takes ticket body text, and returns a structured decision — which
 * sub-skills should fire, which keywords matched, and an
 * orchestration-notes line per sub-skill ready to fold into the skill
 * output.
 *
 * This helper makes the skill's Step 2 deterministic and pytest-covered.
 * The skill's procedure cites this helper by name; it does not re-derive
 * the matching logic.
 *
 * Usage:
 *     import { detect, load_map } from './refine_ticket_detect.js';
 *     const decision = detect(ticketBody, load_map());
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { artefact_roots as _artefact_roots } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);

// REPO_ROOT mirrors Python `Path(__file__).resolve().parent.parent.parent`
// (src/scripts/<file>.py → repo root).
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// Post-monorepo Phase 4 the detection map lives under any package's
// .agent-src.uncondensed/. Discover it via the shared helper; fall back to
// the legacy flat path so consumers and older sub-trees still work.
function _discover_default_map(): string {
    for (const root of _artefact_roots()) {
        const candidate = path.join(root, 'skills', 'refine-ticket', 'detection-map.yml');
        if (_isFile(candidate)) {
            return candidate;
        }
    }
    return path.join(
        REPO_ROOT,
        '.agent-src.uncondensed',
        'skills',
        'refine-ticket',
        'detection-map.yml',
    );
}

const DEFAULT_MAP = _discover_default_map();

// Composite tokens that contain a sub-skill keyword as a substring but are
// not themselves triggers (Phase F2). Matched with word boundaries on the
// lowercased text and substituted before keyword matching so the contained
// keyword ("password") does not fire on them. Defence in depth: word-boundary
// matching alone already skips these, the blocklist catches edge cases where a
// future keyword change or unusual spelling might otherwise re-introduce the
// false positive.
const BLOCKED_COMPOSITES = ['1password', 'lastpass', 'bitwarden'] as const;
const _BLOCKLIST_RE = new RegExp(
    '\\b(?:' + BLOCKED_COMPOSITES.map(_reEscape).join('|') + ')\\b',
    'gi',
);

// Ticket-ID pattern (Phase F1). Jira / Linear / Shortcut style — two-to-ten
// uppercase letters, hyphen, digits. Used to extract the project key
// (`DEV` in `DEV-6182`) from a ticket body.
const _TICKET_KEY_RE = /\b([A-Z]{2,10})-\d+\b/g;

/** Mirror Python `re.escape`. */
function _reEscape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\#\- \t\n\r\v\f]/g, '\\$&');
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

export class SubSkillDecision {
    skill: string;
    fired: boolean;
    matched_keywords: string[];
    matched_regex: string[];
    matched_alt_signals: string[];
    require_count: number;
    notes: string;

    constructor(init: {
        skill: string;
        fired: boolean;
        matched_keywords?: string[];
        matched_regex?: string[];
        matched_alt_signals?: string[];
        require_count?: number;
        notes?: string;
    }) {
        this.skill = init.skill;
        this.fired = init.fired;
        this.matched_keywords = init.matched_keywords ?? [];
        this.matched_regex = init.matched_regex ?? [];
        this.matched_alt_signals = init.matched_alt_signals ?? [];
        this.require_count = init.require_count ?? 1;
        this.notes = init.notes ?? '';
    }

    as_output_line(): string {
        if (!this.fired) {
            return `\`${this.skill}\` — skipped (no trigger match)`;
        }
        const matches = [
            ...this.matched_keywords,
            ...this.matched_regex,
            ...this.matched_alt_signals,
        ];
        const shown = matches.slice(0, 5).join(', ');
        const extra = matches.length > 5 ? ` (+${matches.length - 5} more)` : '';
        return `\`${this.skill}\` — fired on: ${shown}${extra}`;
    }
}

export class RepoContext {
    recent_branches: string[];
    recent_commits: string[];
    context_docs: string[];

    constructor(init?: {
        recent_branches?: string[];
        recent_commits?: string[];
        context_docs?: string[];
    }) {
        this.recent_branches = init?.recent_branches ?? [];
        this.recent_commits = init?.recent_commits ?? [];
        this.context_docs = init?.context_docs ?? [];
    }

    is_empty(): boolean {
        return !(
            this.recent_branches.length || this.recent_commits.length || this.context_docs.length
        );
    }

    summary_line(): string {
        if (this.is_empty()) {
            return 'Repo context — none gathered';
        }
        const parts = [
            `${this.recent_branches.length} branches`,
            `${this.recent_commits.length} commits`,
            `${this.context_docs.length} context docs`,
        ];
        return 'Repo context — ' + parts.join(', ');
    }
}

export class ProjectAlignment {
    ticket_project_key: string | null;
    repo_identifiers: string[];
    matched: boolean | null;

    constructor(init?: {
        ticket_project_key?: string | null;
        repo_identifiers?: string[];
        matched?: boolean | null;
    }) {
        this.ticket_project_key = init?.ticket_project_key ?? null;
        this.repo_identifiers = init?.repo_identifiers ?? [];
        this.matched = init?.matched ?? null;
    }

    has_data(): boolean {
        return Boolean(this.ticket_project_key && this.repo_identifiers.length);
    }

    as_output_line(): string | null {
        if (!this.has_data()) {
            return null;
        }
        const shown = this.repo_identifiers
            .slice(0, 3)
            .map((r) => `\`${r}\``)
            .join(', ');
        if (this.matched) {
            return (
                `Repo project match — ticket \`${this.ticket_project_key}\` ` +
                `aligns with repo identifiers ${shown}`
            );
        }
        return (
            `Repo project mismatch — ticket \`${this.ticket_project_key}\`, ` +
            `repo identifiers ${shown} — context may not apply`
        );
    }
}

export class Decision {
    sub_skills: SubSkillDecision[];
    repo_aware: boolean;
    repo_context: RepoContext;
    alignment: ProjectAlignment;

    constructor(init: {
        sub_skills: SubSkillDecision[];
        repo_aware: boolean;
        repo_context?: RepoContext;
        alignment?: ProjectAlignment;
    }) {
        this.sub_skills = init.sub_skills;
        this.repo_aware = init.repo_aware;
        this.repo_context = init.repo_context ?? new RepoContext();
        this.alignment = init.alignment ?? new ProjectAlignment();
    }

    orchestration_notes(): string[] {
        const notes = this.sub_skills.map((ss) => ss.as_output_line());
        notes.push(`Repo-aware — ${this.repo_aware ? 'on' : 'off'}`);
        if (this.repo_aware) {
            notes.push(this.repo_context.summary_line());
        }
        // Phase F1 + F7 — alignment line is independent of repo_aware; a
        // cross-repo invocation must surface the warning even when repo-aware
        // context gathering is off.
        const alignmentLine = this.alignment.as_output_line();
        if (alignmentLine !== null) {
            notes.push(alignmentLine);
        }
        return notes;
    }
}

type MapDict = Record<string, unknown>;

export function load_map(p: string | null = null): MapDict {
    const target = p ?? DEFAULT_MAP;
    if (!fs.existsSync(target)) {
        throw new Error(`detection-map not found: ${target}`);
    }
    const data = (parseYaml(fs.readFileSync(target, 'utf-8'), { version: '1.1' }) ?? {}) as MapDict;
    if (data['version'] !== 1) {
        throw new Error(`unsupported detection-map version: ${data['version']}`);
    }
    return data;
}

/**
 * Word-boundary regex for a keyword (Phase F2). Case-insensitive. Multi-word
 * and hyphenated keywords work because the inner space / hyphen is a non-word
 * character and the outer boundaries anchor against the surrounding text.
 */
function _keyword_pattern(keyword: string): RegExp {
    return new RegExp('\\b' + _reEscape(keyword) + '\\b', 'i');
}

/** Neutralize composite tokens that contain a keyword as substring. */
function _mask_blocked_composites(textLower: string): string {
    return textLower.replace(_BLOCKLIST_RE, '__blocked__');
}

const _AC_BULLET_RE = /^\s*[-*]\s*\[[ xX~\-]\]\s*(\S+)/gm;

/**
 * Return the prose between `## Description` and the next level-2 heading, or
 * the whole body when no `## Description` heading is found. Used by the F3
 * alt-signal `min_body_sentences` check.
 */
function _extract_description_body(body: string): string {
    const m = /##\s*Description\s*\n([\s\S]+?)(?=\n##\s|$)/i.exec(body);
    if (m) {
        return (m[1] as string).trim();
    }
    return body.trim();
}

/** Naive sentence splitter — punctuation `.!?` followed by whitespace. */
function _split_sentences(text: string): string[] {
    const parts = text.trim().split(/(?<=[.!?])\s+/);
    return parts.filter((p) => p.trim() && p.trim().length > 2);
}

/** First token of every AC bullet, lowercased and alpha-only. */
function _extract_ac_first_words(body: string): string[] {
    const words: string[] = [];
    _AC_BULLET_RE.lastIndex = 0;
    for (const m of body.matchAll(_AC_BULLET_RE)) {
        const cleaned = (m[1] as string).replace(/[^A-Za-z]/g, '').toLowerCase();
        if (cleaned) {
            words.push(cleaned);
        }
    }
    return words;
}

/** Compute Phase F3 alternative signals for a sub-skill. */
function _evaluate_alt_signals(body: string, spec: MapDict): string[] {
    const alt = spec['alternative_signals'];
    if (alt === null || typeof alt !== 'object' || Array.isArray(alt)) {
        return [];
    }
    const altDict = alt as MapDict;
    if (Object.keys(altDict).length === 0) {
        return [];
    }
    const reasons: string[] = [];

    const minSent = altDict['min_body_sentences'];
    if (_isPositiveInt(minSent)) {
        const n = _split_sentences(_extract_description_body(body)).length;
        if (n >= (minSent as number)) {
            reasons.push(`body sentences ${n}≥${minSent}`);
        }
    }

    const minAc = altDict['min_distinct_ac_first_words'];
    if (_isPositiveInt(minAc)) {
        const distinct = new Set(_extract_ac_first_words(body)).size;
        if (distinct >= (minAc as number)) {
            reasons.push(`ac first-words ${distinct}≥${minAc}`);
        }
    }

    return reasons;
}

/** Python `isinstance(x, int) and x > 0` — bool is an int in Python, exclude it. */
function _isPositiveInt(x: unknown): boolean {
    return typeof x === 'number' && Number.isInteger(x) && x > 0;
}

function _match_sub_skill(
    textLower: string,
    textOriginal: string,
    skillName: string,
    spec: MapDict,
): SubSkillDecision {
    const rawKeywords = Array.isArray(spec['keywords']) ? (spec['keywords'] as unknown[]) : [];
    const keywords = rawKeywords.map((kw) => String(kw).toLowerCase());
    const require = parseInt(String(spec['require_count'] ?? 1), 10);
    const masked = _mask_blocked_composites(textLower);
    const matchedKwSet = new Set<string>();
    for (const kw of keywords) {
        if (_keyword_pattern(kw).test(masked)) {
            matchedKwSet.add(kw);
        }
    }
    const matchedKw = [...matchedKwSet].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const matchedRx: string[] = [];
    const rawRegex = Array.isArray(spec['regex']) ? (spec['regex'] as unknown[]) : [];
    for (const pattern of rawRegex) {
        const pat = String(pattern);
        if (new RegExp(pat).test(textOriginal)) {
            matchedRx.push(pat);
        }
    }
    const distinct = matchedKw.length + matchedRx.length;
    const matchedAlt = _evaluate_alt_signals(textOriginal, spec);
    const fired = distinct >= require || matchedAlt.length > 0;
    return new SubSkillDecision({
        skill: skillName,
        fired,
        matched_keywords: matchedKw,
        matched_regex: matchedRx,
        matched_alt_signals: matchedAlt,
        require_count: require,
        notes: String(spec['notes'] ?? '').trim(),
    });
}

function _detect_repo_aware(cwd: string | null, spec: MapDict | null): boolean {
    if (!spec || cwd === null) {
        return false;
    }
    const signals = Array.isArray(spec['signals']) ? (spec['signals'] as MapDict[]) : [];
    const require = parseInt(String(spec['require_count'] ?? 1), 10);
    let hits = 0;
    for (const sig of signals) {
        const target = path.join(cwd, String(sig['path']));
        if (sig['type'] === 'dir' && _isDir(target)) {
            hits += 1;
        } else if (sig['type'] === 'file' && _isFile(target)) {
            hits += 1;
        }
    }
    return hits >= require;
}

function _run_git(cwd: string, args: string[]): string {
    const result = spawnSync('git', args, {
        cwd,
        encoding: 'utf-8',
        timeout: 5000,
    });
    // FileNotFoundError / timeout → "" ; non-zero exit → "".
    if (result.error || result.status !== 0 || result.stdout === null || result.stdout === undefined) {
        return '';
    }
    return result.stdout;
}

/** Collect naming-convention signals from the enclosing repo. */
export function gather_repo_context(
    cwd: string,
    branchLimit = 20,
    commitLimit = 30,
): RepoContext {
    if (!_isDir(path.join(cwd, '.git'))) {
        return new RepoContext();
    }

    const branchesRaw = _run_git(cwd, [
        'for-each-ref',
        '--count',
        String(branchLimit),
        '--sort=-committerdate',
        '--format=%(refname:short)',
        'refs/heads/',
    ]);
    const branches = branchesRaw
        .split('\n')
        .map((b) => b.trim())
        .filter((b) => b);

    const commitsRaw = _run_git(cwd, ['log', `-${commitLimit}`, '--pretty=format:%s']);
    const commits = commitsRaw
        .split('\n')
        .map((c) => c.trim())
        .filter((c) => c);

    let contextDocs: string[] = [];
    const contextsDir = path.join(cwd, 'agents', 'contexts');
    if (_isDir(contextsDir)) {
        contextDocs = fs
            .readdirSync(contextsDir)
            .filter((name) => name.endsWith('.md') && _isFile(path.join(contextsDir, name)))
            .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    }

    return new RepoContext({
        recent_branches: branches,
        recent_commits: commits,
        context_docs: contextDocs,
    });
}

/** Extract the dominant Jira / Linear / Shortcut project key (Phase F1). */
function _extract_ticket_project_key(body: string): string | null {
    const matches: string[] = [];
    _TICKET_KEY_RE.lastIndex = 0;
    for (const m of body.matchAll(_TICKET_KEY_RE)) {
        matches.push(m[1] as string);
    }
    if (matches.length === 0) {
        return null;
    }
    const counts = new Map<string, number>();
    for (const key of matches) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let topCount = 0;
    for (const c of counts.values()) {
        if (c > topCount) {
            topCount = c;
        }
    }
    for (const key of matches) {
        if (counts.get(key) === topCount) {
            return key;
        }
    }
    return null;
}

/** Collect project-identifier tokens from the enclosing repo (Phase F1). */
function _gather_repo_identifiers(cwd: string): string[] {
    const ids: string[] = [];

    for (const fname of ['composer.json', 'package.json']) {
        const fpath = path.join(cwd, fname);
        if (!_isFile(fpath)) {
            continue;
        }
        let data: unknown;
        try {
            data = JSON.parse(fs.readFileSync(fpath, 'utf-8'));
        } catch {
            continue;
        }
        const name =
            data !== null && typeof data === 'object' && !Array.isArray(data)
                ? (data as Record<string, unknown>)['name']
                : null;
        if (typeof name === 'string' && name) {
            for (let part of name.split(/[/@]/)) {
                part = part.trim();
                if (part) {
                    ids.push(part);
                }
            }
        }
    }

    const branchesRaw = _run_git(cwd, [
        'for-each-ref',
        '--count',
        '50',
        '--sort=-committerdate',
        '--format=%(refname:short)',
        'refs/heads/',
    ]);
    for (const branch of branchesRaw.split('\n')) {
        _TICKET_KEY_RE.lastIndex = 0;
        for (const m of branch.matchAll(_TICKET_KEY_RE)) {
            ids.push(m[1] as string);
        }
    }

    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const x of ids) {
        const key = x.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        deduped.push(x);
    }
    return deduped;
}

/** Heuristic project match — case-insensitive substring either way. */
function _match_project(ticketKey: string, repoIds: string[]): boolean {
    const tk = ticketKey.toLowerCase();
    for (const rid of repoIds) {
        const rlow = rid.toLowerCase();
        if (tk === rlow || rlow.includes(tk) || tk.includes(rlow)) {
            return true;
        }
    }
    return false;
}

function _compute_alignment(ticketBody: string, cwd: string | null): ProjectAlignment {
    if (cwd === null) {
        return new ProjectAlignment();
    }
    const ticketKey = _extract_ticket_project_key(ticketBody);
    if (ticketKey === null) {
        return new ProjectAlignment();
    }
    const repoIds = _gather_repo_identifiers(cwd);
    if (repoIds.length === 0) {
        return new ProjectAlignment({ ticket_project_key: ticketKey });
    }
    return new ProjectAlignment({
        ticket_project_key: ticketKey,
        repo_identifiers: repoIds,
        matched: _match_project(ticketKey, repoIds),
    });
}

// ---- Phase F4 — parent context folding -------------------------------------

const _PARENT_AUTO_FETCH_TYPES = new Set<string>(['story', 'sub-task', 'subtask']);

/** Decide whether the F4 auto-fetch rule applies to this issuetype. */
export function issuetype_needs_parent(issuetype: string | null | undefined): boolean {
    if (!issuetype) {
        return false;
    }
    return _PARENT_AUTO_FETCH_TYPES.has(issuetype.trim().toLowerCase());
}

/** Prepend a canonical `## Parent context` block to the ticket body. */
export function fold_parent_context(
    ticketBody: string,
    parentBody: string,
    parentKey: string,
): string {
    const header = `## Parent context — ${parentKey}`;
    if (ticketBody.includes(header)) {
        return ticketBody;
    }
    const parentBlock = parentBody.trim() || '_(parent body empty)_';
    return `${header}\n\n` + `${parentBlock}\n\n` + `---\n\n` + `${_lstrip(ticketBody)}`;
}

/** Python `str.lstrip()` — strip leading whitespace. */
function _lstrip(s: string): string {
    return s.replace(/^\s+/, '');
}

// ---- Phase F6 — close-prompt write-permission probe ------------------------

export const CLOSE_PROMPT_FULL =
    '> Next action for this ticket:\n' +
    '>\n' +
    "> 1. Comment on Jira — I'll post the refined version as a comment" +
    ' (original untouched)\n' +
    "> 2. Replace description — I'll overwrite the Jira description;" +
    ' original saved in a comment\n' +
    "> 3. Nothing — I'll handle it myself / leave the ticket as is";

export const CLOSE_PROMPT_READ_ONLY =
    '> Next action for this ticket:\n' +
    '>\n' +
    '> 1. Copy-paste — no write access to this project';

/** Return the numbered close-prompt block for the skill output. */
export function render_close_prompt(writeAccess: boolean | null): string {
    if (writeAccess === false) {
        return CLOSE_PROMPT_READ_ONLY;
    }
    return CLOSE_PROMPT_FULL;
}

export function detect(
    ticketBody: string,
    detectionMap: MapDict,
    cwd: string | null = null,
): Decision {
    const textLower = ticketBody.toLowerCase();
    const decisions: SubSkillDecision[] = [];
    const subSkills =
        detectionMap['sub_skills'] !== null &&
        typeof detectionMap['sub_skills'] === 'object' &&
        !Array.isArray(detectionMap['sub_skills'])
            ? (detectionMap['sub_skills'] as Record<string, MapDict>)
            : {};
    for (const [skillName, spec] of Object.entries(subSkills)) {
        decisions.push(_match_sub_skill(textLower, ticketBody, skillName, spec));
    }
    const repoAwareSpec =
        detectionMap['repo_aware'] !== null &&
        typeof detectionMap['repo_aware'] === 'object' &&
        !Array.isArray(detectionMap['repo_aware'])
            ? (detectionMap['repo_aware'] as MapDict)
            : null;
    const repoAware = _detect_repo_aware(cwd, repoAwareSpec);
    const repoContext = repoAware && cwd ? gather_repo_context(cwd) : new RepoContext();
    const alignment = _compute_alignment(ticketBody, cwd);
    return new Decision({
        sub_skills: decisions,
        repo_aware: repoAware,
        repo_context: repoContext,
        alignment,
    });
}

// Re-export internals the test suite imports directly.
export {
    _evaluate_alt_signals,
    _extract_ac_first_words,
    _extract_description_body,
    _extract_ticket_project_key,
    _gather_repo_identifiers,
    _match_project,
    _split_sentences,
    DEFAULT_MAP,
};

function main(): void {
    const argv = process.argv.slice(2);
    let pathArg: string | null = null;
    for (const a of argv) {
        if (!a.startsWith('-') || a === '-') {
            pathArg = a;
            break;
        }
    }
    let body: string;
    if (!pathArg || pathArg === '-') {
        body = fs.readFileSync(0, 'utf-8');
    } else {
        body = fs.readFileSync(pathArg, 'utf-8');
    }
    const decision = detect(body, load_map(), process.cwd());
    for (const line of decision.orchestration_notes()) {
        process.stdout.write(line + '\n');
    }
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    main();
}
