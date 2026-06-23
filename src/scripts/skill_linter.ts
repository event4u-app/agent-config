#!/usr/bin/env tsx
/**
 * skill_linter.ts — minimal skill/rule linter for agent-config repositories.
 *
 * TypeScript twin of `src/scripts/skill_linter.py` (ADR-200, Phase 4 Wave 4a).
 * The public CLI contract is mirrored EXACTLY: same flags (`--all`,
 * `--changed`, `--format`, `--pairs`, `--duplicates`, `--condensation-quality`,
 * `--strict-warnings`, `--report`, `--repo-root`, `--quiet`, positional paths),
 * same exit codes (0 pass / 1 warn-with-strict / 2 fail / 3 malice-or-internal),
 * same stdout/stderr split, and byte-for-byte finding messages. No behaviour
 * changes — latent Python quirks are replicated.
 *
 * Dependencies: imports the `validate_frontmatter` twin (local, ported because
 * the Python original is a later-wave dependency) and the `_lib/agent_src`
 * twin for multi-root artefact resolution.
 *
 * MVP checks:
 * - Detect skill vs rule
 * - Required skill sections
 * - Basic rule validation
 * - Vague validation detection
 * - Output format presence
 * - Gotchas / Do NOT presence
 * - Single file, --all, --changed
 * - Text and JSON output
 *
 * Exit codes:
 *   0 = pass
 *   1 = warnings only (with --strict-warnings)
 *   2 = errors
 *   3 = internal error / structural malice
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    apply_schema_defaults,
    load_schema,
    parse_frontmatter as parse_frontmatter_for_schema,
    validate as validate_against_schema,
    type YamlValue,
} from './validate_frontmatter.js';
import { artefact_roots, resolve_logical } from './_lib/agent_src.js';

// __file__ equivalent for repo-root derivation (mirrors Python
// `Path(__file__).resolve().parent.parent.parent` = <repo>/src/scripts → repo).
const _HERE = path.dirname(fileURLToPath(import.meta.url));

export type Severity = 'error' | 'warning' | 'info';
export type ArtifactType =
    | 'skill'
    | 'rule'
    | 'command'
    | 'guideline'
    | 'persona'
    | 'user-type'
    | 'unknown';
export type Status = 'pass' | 'pass_with_warnings' | 'fail';

const REQUIRED_PERSONA_SECTIONS_CORE = [
    'Focus',
    'Mindset',
    'Unique Questions',
    'Output Expectations',
    'Anti-Patterns',
];
const REQUIRED_PERSONA_SECTIONS_SPECIALIST = [
    ...REQUIRED_PERSONA_SECTIONS_CORE,
    'Critical Rules',
    'Workflows',
];
const VALID_PERSONA_TIERS = new Set(['core', 'specialist']);
// Locked in docs/contracts/persona-schema.md § 4: core ≤ 120, specialist ≤ 100.
const PERSONA_LINE_BUDGETS: Record<string, number> = { core: 120, specialist: 100 };

const REQUIRED_USERTYPE_SECTIONS = [
    'Focus',
    'Daily Workflow',
    'Vocabulary',
    'Operational Constraints',
    'Unique Questions',
    'Ticket Red Flags',
    'Anti-Patterns',
];
const USERTYPE_LINE_BUDGET = 120;
const VALID_PERSONA_WINGS = new Set([1, 2, 3, 4]);
// Wing-scoped persona line-budget overrides; keyed by `${tier}:${wing}`.
const PERSONA_LINE_BUDGETS_BY_WING: Record<string, number> = {
    'specialist:3': 140,
    'specialist:4': 140,
};

const REQUIRED_SKILL_SECTIONS = ['When to use', 'Gotcha', 'Procedure', 'Output format', 'Do NOT'];

const SECTION_ALIASES: Record<string, Set<string>> = {
    Gotcha: new Set(['Gotcha', 'Gotchas']),
    Procedure: new Set(), // prefix-matched separately
    'Do NOT': new Set(['Do NOT', 'Do not', 'Anti-patterns']),
    'Output format': new Set(['Output format', 'Output']),
};

const RECOMMENDED_SKILL_SECTIONS: string[] = [];

const RULE_BAD_SIGNS = ['## Procedure', '## Output format', '## Gotchas'];

const FRUGALITY_WRITER_SKILLS = new Set([
    'skill-writing',
    'rule-writing',
    'command-writing',
    'guideline-writing',
    'context-authoring',
    'agent-docs-writing',
    'conventional-commits-writing',
    'readme-writing',
    'readme-writing-package',
    'adr-create',
    'persona-writing',
    'roadmap-writing',
    'script-writing',
]);
const FRUGALITY_CHARTER_RELPATH = 'contexts/communication/frugality-charter.md';
const FRUGALITY_CHARTER_INDEX_RULES: Record<string, string> = {
    'direct-answers.md': 'iron-law-3',
    'user-interaction.md': 'iron-law-1',
    'no-cheap-questions.md': 'pre-send-self-check',
    'token-efficiency.md': 'the-iron-laws',
};

const VAGUE_VALIDATION_PATTERNS = [
    String.raw`\bcheck if it works\b`,
    String.raw`\bverify it works\b`,
    String.raw`\btest manually\b`,
    String.raw`\bcheck manually\b`,
    String.raw`\bmake sure it works\b`,
];

const TRIGGER_WARNING_PATTERNS = [
    String.raw`\bgeneral helper\b`,
    String.raw`\blaravel skill\b`,
    String.raw`\bgeneral coding\b`,
    String.raw`\beverything about\b`,
];

const ORDERED_STEP_PATTERN = /^(?:\s*|#{1,4}\s*)(\d+)\.\s+/gm;
const SECTION_PATTERN = /^##\s+(.+?)\s*$/gm;
export const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n/;
export const DESCRIPTION_PATTERN = /^description:\s*"?(.*?)"?\s*$/m;
const STATUS_PATTERN = /^status:\s*"?(active|deprecated|superseded)"?\s*$/m;
const REPLACED_BY_PATTERN = /^replaced_by:\s*"?([\w-]+)"?\s*$/m;
const TIER_PATTERN = /^tier:\s*"?([\w-]+)"?\s*$/m;
const TYPE_PATTERN = /^type:\s*"?(always|auto|manual)"?\s*$/m;
const SOURCE_PATTERN = /^source:\s*"?(package|project)"?\s*$/m;

// --- Senior-tier required-block patterns ---
const SENIOR_RELATED_SKILLS_PATTERN = /^##\s+Related Skills\s*$/m;
const SENIOR_RELATED_WHEN_PATTERN = /\*\*WHEN to use this\*\*/i;
const SENIOR_RELATED_WHEN_NOT_PATTERN = /\*\*WHEN NOT to use this\*\*/i;
const SENIOR_PROACTIVE_PATTERN = /^##\s+When the agent should load this\s*$/m;
const SENIOR_OUTPUT_PATTERN = /^##\s+Output\s*$/m;
const H1_PATTERN = /^# .+/m;
const DOUBLE_BLANK_PATTERN = /\n{3,}/;

const VALID_RULE_TYPES = new Set(['always', 'auto', 'manual']);
const VALID_RULE_SOURCES = new Set(['package', 'project']);

const ROUTER_ALLOWED_TRIGGER_KEYS = new Set([
    'keyword',
    'phrase',
    'intent',
    'file_pattern',
    'path_prefix',
    'command',
]);
const KERNEL_RULE_IDS = new Set([
    'agent-authority',
    'ask-when-uncertain',
    'commit-policy',
    'direct-answers',
    'language-and-tone',
    'no-cheap-questions',
    'non-destructive-by-default',
    'scope-control',
    'verify-before-complete',
]);

// --- Runtime execution metadata constants ---
export const VALID_EXECUTION_TYPES = new Set(['manual', 'assisted', 'automated']);
export const VALID_EXECUTION_HANDLERS = new Set(['none', 'shell', 'php', 'node', 'internal']);
const VALID_EXECUTION_SAFETY_MODES = new Set(['strict']);
const VALID_EXECUTION_FIELDS = new Set([
    'type',
    'handler',
    'timeout_seconds',
    'safety_mode',
    'allowed_tools',
    'command',
]);

// --- Wing-3 GTM cognition-boundary patterns ---
const WING3_SPINE_SLOTS = new Set(['channel-stage', 'funnel-stage', 'customer-segment']);

const CONTEXT_SPINE_INLINE_PATTERN = /^context_spine:\s*\[(.*?)\]\s*$/m;

const WING3_SAAS_URL_PATTERN =
    /https?:\/\/[\w.-]*\.(salesforce|hubspot|marketo|pardot|mailchimp|intercom|amplitude|mixpanel|segment|klaviyo|sendgrid|mailgun|pendo|gong|outreach|salesloft|apollo)\.(com|io)\b/i;

const WING3_VENDOR_BLACKLIST =
    /\b(salesforce|hubspot|marketo|pardot|mailchimp|intercom|drift|klaviyo|sendgrid|mailgun|amplitude|mixpanel|pendo|gong|outreach\.io|salesloft|apollo\.io|zendesk|freshworks)\b/i;

const WING3_STACK_LOCKED_PATTERN =
    /\b(npm install|pip install|composer require|gem install|cargo add|yarn add|pnpm add|bundle add)\s+[\w@/.-]+/i;

const WING3_CHANNEL_TACTIC_PATTERN =
    /\b(email subject line|tweet length|linkedin (post|ad)|facebook ad|google ads?|tiktok (post|video)|instagram (post|reel)|sms character limit|cold email template)\b/i;

// --- Wing-4 Money/Strategy/Ops cognition-boundary patterns ---
const WING4_SPINE_SLOTS = new Set(['fiscal-period', 'org-stage', 'regulatory-regime']);

const WING4_SAAS_URL_PATTERN =
    /https?:\/\/[\w.-]*\.(quickbooks|intuit|netsuite|xero|sage|carta|pulley|gusto|bamboohr|lattice|15five|justworks|docusign|ironclad|onetrust|rippling|workday|deel|namely|adp|paychex|trinet|hibob|cultureamp)\.(com|io|co)\b/i;

const WING4_VENDOR_BLACKLIST =
    /\b(quickbooks|netsuite|xero|sage intacct|carta|pulley|gusto|bamboohr|lattice|15five|justworks|docusign|ironclad|onetrust|rippling|workday|deel|namely|adp|paychex|trinet|hibob|culture amp)\b/i;

const WING4_STAGE_AGNOSTIC_PATTERN =
    /(?:\b\d+\s+months?\s+of\s+runway\b|\brunway\s+of\s+at\s+least\s+\d+\s+months?\b|\bminimum\s+runway\s+of\s+\d+\b|\b(?:seed|series\s+[a-d]|growth|pre-?ipo|post-?ipo)[-\s]stage\s+(?:companies|startups|teams|founders|orgs)\s+(?:must|should|always|never)\b|\bteam\s+of\s+\d+\s+(?:or\s+more|or\s+fewer)\b|\b(?:arr|mrr|burn\s+rate)\s+(?:of|over|under|above|below)\s+\$\d+)/i;

export class Issue {
    severity: Severity;
    code: string;
    message: string;

    constructor(severity: Severity, code: string, message: string) {
        this.severity = severity;
        this.code = code;
        this.message = message;
    }
}

export class LintResult {
    file: string;
    artifact_type: ArtifactType;
    status: Status;
    issues: Issue[];
    suggestions: string[];

    constructor(
        file: string,
        artifactType: ArtifactType,
        status: Status,
        issues: Issue[],
        suggestions: string[],
    ) {
        this.file = file;
        this.artifact_type = artifactType;
        this.status = status;
        this.issues = issues;
        this.suggestions = suggestions;
    }
}

// --- Regex / string helpers (Python parity) --------------------------------

/** Python `str.splitlines()` — splits on \n, \r, \r\n; trailing newline does
 * NOT yield a final empty element. */
function splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    const lines = text.split(/\r\n|\r|\n/);
    // Python splitlines drops a single trailing empty produced by a final \n.
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        // Only drop the trailing empty when the text ends with a line break.
        if (/(\r\n|\r|\n)$/.test(text)) {
            lines.pop();
        }
    }
    return lines;
}

/** Python `len(text.splitlines())`. */
function lineCount(text: string): number {
    return splitlines(text).length;
}

function isUpper(ch: string): boolean {
    return ch >= 'A' && ch <= 'Z';
}
function isAlpha(ch: string): boolean {
    return /[A-Za-z]/.test(ch);
}

function readText(p: string): string {
    return fs.readFileSync(p, 'utf-8');
}

function isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}
function isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}
function exists(p: string): boolean {
    return fs.existsSync(p);
}
function isSymlink(p: string): boolean {
    try {
        return fs.lstatSync(p).isSymbolicLink();
    } catch {
        return false;
    }
}

/** Recursive glob equivalent of `Path.rglob(pattern)` for SKILL.md / *.md. */
function rglob(root: string, predicate: (basename: string) => boolean): string[] {
    const out: string[] = [];
    function walk(dir: string): void {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                walk(full);
            } else if (predicate(ent.name)) {
                out.push(full);
            }
        }
    }
    walk(root);
    return out;
}

/** Equivalent of `Path.glob('*.md')` (non-recursive). */
function glob(dir: string, predicate: (basename: string) => boolean): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter((e) => e.isFile() && predicate(e.name))
        .map((e) => path.join(dir, e.name));
}

function basename(p: string): string {
    return path.basename(p);
}
function stem(p: string): string {
    const b = path.basename(p);
    const dot = b.lastIndexOf('.');
    return dot > 0 ? b.slice(0, dot) : b;
}
function parentName(p: string): string {
    return path.basename(path.dirname(p));
}

function dedupePreserveOrder(items: Iterable<string>): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of items) {
        if (!seen.has(item)) {
            seen.add(item);
            result.push(item);
        }
    }
    return result;
}

// --- Role-contract anchor cache ---
const _ROLE_CONTRACT_CANDIDATES = ['docs/guidelines/agent-infra/role-contracts.md'];
let _ROLE_CONTRACT_SLUGS_CACHE: Set<string> | null = null;

function _loadRoleContractSlugs(): Set<string> {
    if (_ROLE_CONTRACT_SLUGS_CACHE !== null) {
        return _ROLE_CONTRACT_SLUGS_CACHE;
    }
    let slugs = new Set<string>();
    for (const candidate of _ROLE_CONTRACT_CANDIDATES) {
        if (!exists(candidate)) {
            continue;
        }
        let text: string;
        try {
            text = readText(candidate);
        } catch {
            continue;
        }
        let inSkeletons = false;
        for (const line of splitlines(text)) {
            if (line.startsWith('## ')) {
                inSkeletons = line.trim().toLowerCase().startsWith('## contract skeletons');
                continue;
            }
            if (inSkeletons && line.startsWith('### ')) {
                const name = line.slice(4).trim().toLowerCase();
                slugs.add(name.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
            }
        }
        if (slugs.size > 0) {
            break;
        }
    }
    _ROLE_CONTRACT_SLUGS_CACHE = slugs;
    return slugs;
}

/** Test seam — reset the role-contract anchor cache. */
export function _resetRoleContractCacheForTest(): void {
    _ROLE_CONTRACT_SLUGS_CACHE = null;
}

const _ROLE_CONTRACT_REF_PATTERN = /role-contracts\.md#([a-z0-9][a-z0-9-]*)/gi;

export function lint_role_contract_refs(text: string): Issue[] {
    const slugs = _loadRoleContractSlugs();
    if (slugs.size === 0) {
        return [];
    }
    const issues: Issue[] = [];
    const seen = new Set<string>();
    for (const match of text.matchAll(_ROLE_CONTRACT_REF_PATTERN)) {
        const slug = (match[1] as string).toLowerCase();
        if (seen.has(slug)) {
            continue;
        }
        seen.add(slug);
        if (!slugs.has(slug)) {
            issues.push(
                new Issue(
                    'warning',
                    'unknown_role_contract',
                    `References role-contracts.md#${slug} but no such mode is defined in the guideline (known: ${[...slugs].sort().join(', ')})`,
                ),
            );
        }
    }
    return issues;
}

export function extract_sections(text: string): Set<string> {
    const out = new Set<string>();
    for (const m of text.matchAll(SECTION_PATTERN)) {
        out.add((m[1] as string).trim());
    }
    return out;
}

function _densityScore(text: string): number {
    let insideFence = false;
    let structured = 0;
    let nonBlank = 0;
    for (const raw of splitlines(text)) {
        const stripped = raw.trim();
        if (!stripped) {
            continue;
        }
        nonBlank += 1;
        if (stripped.startsWith('```')) {
            insideFence = !insideFence;
            structured += 1;
            continue;
        }
        if (insideFence) {
            structured += 1;
            continue;
        }
        if (stripped.startsWith('#')) {
            structured += 1;
            continue;
        }
        if (stripped.startsWith('|') && stripped.endsWith('|')) {
            structured += 1;
            continue;
        }
        if (stripped.startsWith('- ') || stripped.startsWith('* ') || stripped.startsWith('+ ')) {
            structured += 1;
            continue;
        }
        if (/^\d+\.\s/.test(stripped)) {
            structured += 1;
            continue;
        }
    }
    if (nonBlank === 0) {
        return 0.0;
    }
    // Python round() — banker's rounding to 3 decimals.
    return roundHalfEven(structured / nonBlank, 3);
}

/** Python round(value, ndigits) — round-half-to-even. */
function roundHalfEven(value: number, ndigits: number): number {
    const factor = 10 ** ndigits;
    const scaled = value * factor;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let rounded: number;
    if (diff > 0.5) {
        rounded = floor + 1;
    } else if (diff < 0.5) {
        rounded = floor;
    } else {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    }
    return rounded / factor;
}

/** Python `f"{value:.2f}"` — round-half-to-even at 2 decimals, fixed width. */
function fmt2f(value: number): string {
    return roundHalfEven(value, 2).toFixed(2);
}

const PROCEDURE_HEADING_PATTERN = /^##\s+Procedure(\s*[:—-].*)?\s*$/gm;
const COMMAND_FRONTMATTER_DELEGATION_KEYS = ['cluster:', 'routes_to:'];
const MD_LINK_PATTERN_G = /\[[^\]]+\]\(([^)]+\.md[^)]*)\)/g;

function _countProcedureSections(text: string): number {
    return [...text.matchAll(PROCEDURE_HEADING_PATTERN)].length;
}

function _commandDelegationSignal(text: string, frontmatter: string | null): boolean {
    if (frontmatter) {
        for (const key of COMMAND_FRONTMATTER_DELEGATION_KEYS) {
            // Python: re.search(rf"^{escape(key)}", frontmatter, MULTILINE)
            const re = new RegExp(`^${escapeRegex(key)}`, 'm');
            if (re.test(frontmatter)) {
                return true;
            }
        }
    }
    if ([...text.matchAll(MD_LINK_PATTERN_G)].length >= 3) {
        return true;
    }
    return false;
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _stripMarkdownForCheck(text: string): string {
    let out = text.replace(/```[^\n]*\n[\s\S]*?```/g, '');
    out = out.replace(/`[^`\n]+`/g, '');
    out = out.replace(/\[[^\]]*\]\([^)]*\)/g, '');
    return out;
}

function _ironLawBlocks(text: string): number {
    let blocks = 0;
    let inside = false;
    let body: string[] = [];
    for (const raw of splitlines(text)) {
        if (raw.trim().startsWith('```')) {
            if (inside && body.length > 0) {
                const nonEmpty = body.filter((b) => b.trim() !== '');
                const letters = nonEmpty.join('');
                let upper = 0;
                let total = 0;
                for (const c of letters) {
                    if (isAlpha(c)) {
                        total += 1;
                        if (isUpper(c)) {
                            upper += 1;
                        }
                    }
                }
                if (total >= 30 && upper / total >= 0.6 && nonEmpty.length > 0) {
                    blocks += 1;
                }
            }
            inside = !inside;
            body = [];
            continue;
        }
        if (inside) {
            body.push(raw);
        }
    }
    return blocks;
}

export function extract_description(text: string): string | null {
    const fm = FRONTMATTER_PATTERN.exec(text);
    if (!fm) {
        return null;
    }
    const m = DESCRIPTION_PATTERN.exec(fm[1] as string);
    return m ? (m[1] as string).trim() : null;
}

export const NAME_PATTERN = /^name:\s*"?(.*?)"?\s*$/m;
const DISABLE_MODEL_PATTERN = /^disable-model-invocation:\s*"?(true|false)"?\s*$/m;

export function detect_artifact_type(p: string, text: string): ArtifactType {
    const pathStr = p.replace(/\\/g, '/').toLowerCase();
    const hasSkillHeading = text.includes('## When to use') && text.includes('## Procedure');

    if (pathStr.includes('/commands/') && basename(p) !== 'SKILL.md') {
        return 'command';
    }
    if (basename(p).toLowerCase() === 'skill.md' || pathStr.includes('/skills/')) {
        return 'skill';
    }
    if (pathStr.includes('/rules/')) {
        return 'rule';
    }
    if (pathStr.includes('/guidelines/')) {
        return 'guideline';
    }
    if (pathStr.includes('/personas/')) {
        return 'persona';
    }
    if (pathStr.includes('/user-types/')) {
        return 'user-type';
    }
    if (hasSkillHeading) {
        return 'skill';
    }
    return 'unknown';
}

export function classify_status(issues: Issue[]): Status {
    const severities = new Set(issues.map((i) => i.severity));
    if (severities.has('error')) {
        return 'fail';
    }
    if (severities.has('warning')) {
        return 'pass_with_warnings';
    }
    return 'pass';
}

export function extract_section_block(text: string, sectionName: string): string {
    const pattern = new RegExp(
        `^##\\s+${escapeRegex(sectionName)}\\s*$([\\s\\S]*?)(?=^##\\s+|$(?![\\s\\S]))`,
        'm',
    );
    const match = pattern.exec(text);
    return match ? (match[1] as string).trim() : '';
}

function parseOrderedListItems(text: string): string[] {
    return splitlines(text)
        .filter((line) => /^\s*\d+\.\s+/.test(line))
        .map((line) => line.trim());
}

function countBullets(text: string): number {
    return splitlines(text).filter((line) => /^\s*[*-]\s+/.test(line)).length;
}

function hasValidationStep(procedureBlock: string): boolean {
    const lowered = procedureBlock.toLowerCase();
    if (lowered.includes('validate') || lowered.includes('validation')) {
        return true;
    }
    const goodSignals = [
        'expected',
        'status code',
        'no errors',
        'appears in',
        'exact check',
        'concrete checks',
        'verify',
        'confirm',
        'must pass',
        'must fail',
        'assert',
        'check that',
        'ensure',
        'run test',
        'run phpstan',
        'run ecs',
        'run rector',
        'lint',
        'passes',
        'exit code',
        'should return',
        'should contain',
        'must contain',
        'must return',
    ];
    return goodSignals.some((signal) => lowered.includes(signal));
}

const _INSPECT_VERB_PATTERN =
    /\b(?:inspect|examine|audit|survey|read|look\s+at|check|review|understand|identify|analyze|analyse|detect|gather|discover)\b/i;

function hasInspectStep(procedureBlock: string): boolean {
    return _INSPECT_VERB_PATTERN.test(procedureBlock);
}

function findVagueValidation(text: string): string[] {
    const hits: string[] = [];
    for (const pattern of VAGUE_VALIDATION_PATTERNS) {
        const re = new RegExp(pattern, 'gi');
        for (const m of text.matchAll(re)) {
            hits.push(m[0]);
        }
    }
    return hits;
}

function isProbablyTooBroad(text: string, description: string | null): boolean {
    const haystacks: string[] = [];
    if (description) {
        haystacks.push(description.toLowerCase());
    }
    const whenBlock = extract_section_block(text, 'When to use');
    if (whenBlock) {
        haystacks.push(whenBlock.toLowerCase());
    }
    if (haystacks.length === 0) {
        return false;
    }
    const combined = haystacks.join('\n');
    const broadSignals = [
        'everything about',
        'general purpose',
        'general-purpose',
        'all markdown',
        'helper for everything',
    ];
    return broadSignals.some((signal) => combined.includes(signal));
}

function sectionMatches(required: string, sections: Set<string>): boolean {
    if (sections.has(required)) {
        return true;
    }
    const aliases = SECTION_ALIASES[required];
    if (aliases) {
        for (const a of aliases) {
            if (sections.has(a)) {
                return true;
            }
        }
    }
    for (const s of sections) {
        if (s.startsWith(`${required}:`) || s.startsWith(`${required} `)) {
            return true;
        }
    }
    return false;
}

function findProcedureBlock(text: string): string | null {
    const block = extract_section_block(text, 'Procedure');
    if (block) {
        return block;
    }
    const match = /^##\s+Procedure[:\s]/m.exec(text);
    if (match) {
        const start = (match.index ?? 0) + match[0].length;
        const rest = text.slice(start);
        const nextHeading = /^##\s+/m.exec(rest);
        if (nextHeading) {
            return text.slice(start, start + (nextHeading.index ?? 0)).trim();
        }
        return text.slice(start).trim();
    }
    return null;
}

export function extract_frontmatter(text: string): string | null {
    const match = FRONTMATTER_PATTERN.exec(text);
    return match ? (match[1] as string) : null;
}

function extractFrontmatterField(frontmatter: string, pattern: RegExp): string | null {
    const match = pattern.exec(frontmatter);
    return match ? (match[1] as string).trim() : null;
}

// --- YAML list parsing (rule router) ---

type YamlListItem = string | Record<string, string>;

function _parseTrustLevel(frontmatter: string): string | null {
    const lines = splitlines(frontmatter);
    let inBlock = false;
    for (const line of lines) {
        if (!inBlock) {
            if (line.startsWith('trust:')) {
                const rhs = line.slice('trust:'.length).trim();
                if (rhs === '') {
                    inBlock = true;
                }
            }
            continue;
        }
        if (line.startsWith('  level:')) {
            return stripQuotes(line.slice('  level:'.length).trim());
        }
        if (line.startsWith('  ')) {
            continue;
        }
        break;
    }
    return null;
}

function stripQuotes(s: string): string {
    return s.replace(/^["']/, '').replace(/["']$/, '');
}

function _parseYamlList(frontmatter: string, key: string): YamlListItem[] | null {
    const lines = splitlines(frontmatter);
    const out: YamlListItem[] = [];
    let inBlock = false;
    for (const line of lines) {
        if (!inBlock) {
            if (line.startsWith(`${key}:`)) {
                const rhs = line.slice(key.length + 1).trim();
                if (rhs === '' || rhs === '[]') {
                    if (rhs === '[]') {
                        return [];
                    }
                    inBlock = true;
                } else {
                    return null; // unexpected scalar shape
                }
            }
            continue;
        }
        if (line.startsWith('  - ')) {
            const item = line.slice(4).trim();
            if (item.includes(':') && !(item.startsWith("'") || item.startsWith('"'))) {
                const idx = item.indexOf(':');
                const k = item.slice(0, idx);
                const v = item.slice(idx + 1);
                out.push({ [k.trim()]: stripQuotes(v.trim()) });
            } else {
                out.push(stripQuotes(item));
            }
        } else if (line.trim() === '' || line.startsWith('    ')) {
            continue;
        } else {
            break;
        }
    }
    return inBlock ? out : null;
}

function isMapping(item: YamlListItem): item is Record<string, string> {
    return typeof item === 'object' && item !== null;
}

function lint_router_frontmatter(
    ruleId: string,
    frontmatter: string,
    ruleType: string | null,
): Issue[] {
    const issues: Issue[] = [];
    const triggers = _parseYamlList(frontmatter, 'triggers');
    const routesTo = _parseYamlList(frontmatter, 'routes_to');

    if (ruleType === 'manual') {
        return issues;
    }

    const isKernel = KERNEL_RULE_IDS.has(ruleId) || ruleType === 'always';

    if (isKernel) {
        if (triggers !== null) {
            issues.push(
                new Issue(
                    'error',
                    'kernel_has_triggers',
                    'Kernel rules MUST NOT declare triggers: (kernel is unconditional)',
                ),
            );
        }
        if (routesTo !== null) {
            issues.push(
                new Issue(
                    'error',
                    'kernel_has_routes_to',
                    'Kernel rules MUST NOT declare routes_to: (kernel body stays inline)',
                ),
            );
        }
        return issues;
    }

    if (triggers === null) {
        issues.push(
            new Issue(
                'info',
                'router_triggers_missing',
                'Non-kernel rule has no triggers: — falls back to description matching until Phase 4 migration lands',
            ),
        );
    } else {
        triggers.forEach((item, idx) => {
            if (!isMapping(item) || Object.keys(item).length !== 1) {
                issues.push(
                    new Issue('error', 'trigger_shape_invalid', `triggers[${idx}] must be a single-key mapping`),
                );
                return;
            }
            const k = Object.keys(item)[0] as string;
            if (!ROUTER_ALLOWED_TRIGGER_KEYS.has(k)) {
                const allowed = [...ROUTER_ALLOWED_TRIGGER_KEYS].sort().join(', ');
                issues.push(
                    new Issue(
                        'error',
                        'trigger_key_unknown',
                        `triggers[${idx}] key '${k}' not in allowed set (${allowed})`,
                    ),
                );
            }
        });
    }

    if (routesTo === null) {
        const trustLevel = _parseTrustLevel(frontmatter);
        if (trustLevel !== 'core') {
            issues.push(
                new Issue(
                    'info',
                    'router_routes_to_missing',
                    'Non-kernel rule has no routes_to: — body should migrate to skill / guideline in Phase 4',
                ),
            );
        }
    } else {
        const repoRoot = path.resolve(_HERE, '..', '..');
        routesTo.forEach((item, idx) => {
            if (typeof item !== 'string' || !item.includes(':')) {
                issues.push(new Issue('error', 'route_shape_invalid', `routes_to[${idx}] must be 'kind:id'`));
                return;
            }
            const ci = item.indexOf(':');
            const kind = item.slice(0, ci);
            const targetId = item.slice(ci + 1);
            let target: string | null = null;
            if (kind === 'skill') {
                target = resolve_logical(`skills/${targetId}/SKILL.md`);
            } else if (kind === 'guideline') {
                const gpath = path.join(repoRoot, 'docs', 'guidelines', `${targetId}.md`);
                target = exists(gpath) ? gpath : null;
            } else if (kind === 'command') {
                target = resolve_logical(`commands/${targetId}.md`);
            } else if (kind === 'contract') {
                const cpath = path.join(repoRoot, 'docs', 'contracts', `${targetId}.md`);
                if (exists(cpath)) {
                    target = cpath;
                } else {
                    target = resolve_logical(`contexts/contracts/${targetId}.md`);
                }
            } else {
                issues.push(
                    new Issue(
                        'error',
                        'route_kind_unknown',
                        `routes_to[${idx}] kind '${kind}' must be 'skill', 'guideline', 'command', or 'contract'`,
                    ),
                );
                return;
            }
            if (target === null || !exists(target)) {
                issues.push(
                    new Issue(
                        'error',
                        'route_target_missing',
                        `routes_to[${idx}] target '${item}' not found under any artefact root`,
                    ),
                );
            }
        });
    }
    return issues;
}

// --- Execution block ---

export type ExecutionBlock = Record<string, string | number | string[]>;

export function parseExecutionBlock(frontmatter: string): ExecutionBlock | null {
    const lines = splitlines(frontmatter);
    let execStart: number | null = null;
    for (let i = 0; i < lines.length; i += 1) {
        if (/^execution:\s*$/.test(lines[i] as string)) {
            execStart = i;
            break;
        }
    }
    if (execStart === null) {
        return null;
    }

    const result: ExecutionBlock & { _current_list?: string } = {};
    for (let i = execStart + 1; i < lines.length; i += 1) {
        const line = lines[i] as string;
        if (line.length > 0 && !/\s/.test(line[0] as string)) {
            break;
        }
        const stripped = line.trim();
        if (!stripped || stripped.startsWith('#')) {
            continue;
        }
        if (stripped.startsWith('- ')) {
            const cur = result._current_list;
            if (cur !== undefined) {
                (result[cur] as string[]).push(stripQuotes(stripped.slice(2).trim()));
            }
            continue;
        }
        const m = /^(\w+):\s*(.*?)\s*$/.exec(stripped);
        if (m) {
            const key = m[1] as string;
            const value = stripQuotes((m[2] as string).trim());
            if (value === '[]') {
                result[key] = [];
                result._current_list = key;
            } else if (/^\[.*\]$/.test(value)) {
                const inner = value.slice(1, -1).trim();
                if (inner) {
                    result[key] = inner.split(',').map((it) => stripQuotes(it.trim()));
                } else {
                    result[key] = [];
                }
                result._current_list = key;
            } else if (value === '') {
                result[key] = [];
                result._current_list = key;
            } else {
                if (/^-?[0-9]+$/.test(value)) {
                    result[key] = Number.parseInt(value, 10);
                } else {
                    result[key] = value;
                }
                delete result._current_list;
            }
        }
    }
    delete result._current_list;
    return result;
}

function lint_senior_tier_blocks(text: string): Issue[] {
    const issues: Issue[] = [];

    if (!SENIOR_RELATED_SKILLS_PATTERN.test(text)) {
        issues.push(
            new Issue(
                'error',
                'missing_senior_related_skills',
                'Senior-tier skill missing `## Related Skills` block (skill-quality.md § Senior-Tier Required Structure)',
            ),
        );
    } else {
        const relatedBlock = extract_section_block(text, 'Related Skills') || '';
        if (!SENIOR_RELATED_WHEN_PATTERN.test(relatedBlock)) {
            issues.push(
                new Issue(
                    'error',
                    'missing_senior_related_when',
                    'Senior-tier `## Related Skills` block missing `**WHEN to use this**` list',
                ),
            );
        }
        if (!SENIOR_RELATED_WHEN_NOT_PATTERN.test(relatedBlock)) {
            issues.push(
                new Issue(
                    'error',
                    'missing_senior_related_when_not',
                    'Senior-tier `## Related Skills` block missing `**WHEN NOT to use this**` list',
                ),
            );
        }
    }

    if (!SENIOR_PROACTIVE_PATTERN.test(text)) {
        issues.push(
            new Issue(
                'error',
                'missing_senior_proactive_triggers',
                'Senior-tier skill missing `## When the agent should load this` block',
            ),
        );
    }

    if (!SENIOR_OUTPUT_PATTERN.test(text)) {
        issues.push(
            new Issue(
                'error',
                'missing_senior_output_artifacts',
                'Senior-tier skill missing `## Output` block declaring artifact name + shape',
            ),
        );
    }

    return issues;
}

function parseContextSpine(frontmatter: string): string[] | null {
    const match = CONTEXT_SPINE_INLINE_PATTERN.exec(frontmatter);
    if (match !== null) {
        const inner = (match[1] as string).trim();
        if (!inner) {
            return [];
        }
        return inner
            .split(',')
            .map((s) => stripQuotes(s.trim()))
            .filter((s) => s !== '');
    }
    const block = _parseYamlList(frontmatter, 'context_spine');
    if (block === null) {
        return null;
    }
    return block.map((item) => (typeof item === 'string' ? item : Object.keys(item)[0] ?? ''));
}

function _stripWing3CarveOuts(text: string): string {
    let out = text.replace(/```[^\n]*\n[\s\S]*?```/g, '');
    out = out.replace(/`[^`]+`/g, '');
    // `## Do NOT` strip: Python uses MULTILINE|DOTALL → `^##` matches at every
    // line start. `\Z` = end of string (no trailing-newline subtlety needed).
    out = out.replace(/^##\s+Do NOT\s*$[\s\S]*?(?=^##\s+|$(?![\s\S]))/gm, '');
    // `**WHEN NOT to use this**` strip — LATENT PYTHON BUG REPLICATED: the
    // Python original passes only DOTALL|IGNORECASE (NO MULTILINE), so the
    // `^##\s+` alternative in its lookahead matches only at string position 0,
    // never at a mid-text line start. With no `**WHEN` after the first one, the
    // non-greedy `.*?` therefore consumes to end-of-string — stripping every
    // section after the first `**WHEN NOT to use this**` (e.g. Gotcha, Do NOT).
    // We mirror that by omitting the `m` flag so `^##` only matches at index 0.
    // Divergence-candidate: see report.
    out = out.replace(/\*\*WHEN NOT to use this\*\*[\s\S]*?(?=\*\*WHEN|^##\s+|$(?![\s\S]))/gi, '');
    return out;
}

function lint_wing3_boundaries(text: string): Issue[] {
    const issues: Issue[] = [];
    const body = _stripWing3CarveOuts(text);

    let m = WING3_SAAS_URL_PATTERN.exec(body);
    if (m) {
        issues.push(
            new Issue(
                'warning',
                'wing3_agent_operability',
                `Wing-3 skill cites external SaaS URL \`${m[0]}\` outside carve-outs — cognition skills must operate without SaaS auth (council Q7 boundary)`,
            ),
        );
    }
    m = WING3_VENDOR_BLACKLIST.exec(body);
    if (m) {
        issues.push(
            new Issue(
                'warning',
                'wing3_vendor_independence',
                `Wing-3 skill names vendor \`${m[0]}\` outside carve-outs — keep cognition vendor-agnostic (council Q7 boundary)`,
            ),
        );
    }
    m = WING3_STACK_LOCKED_PATTERN.exec(body);
    if (m) {
        issues.push(
            new Issue(
                'warning',
                'wing3_transferability',
                `Wing-3 skill includes stack-locked instruction \`${m[0]}\` outside carve-outs — cognition should transfer across stacks (council Q7 boundary)`,
            ),
        );
    }
    m = WING3_CHANNEL_TACTIC_PATTERN.exec(body);
    if (m) {
        issues.push(
            new Issue(
                'warning',
                'wing3_channel_agnosticism',
                `Wing-3 skill prescribes channel-specific tactic \`${m[0]}\` outside carve-outs — keep cognition channel-agnostic (council Q7 boundary)`,
            ),
        );
    }
    return issues;
}

function lint_wing4_boundaries(text: string): Issue[] {
    const issues: Issue[] = [];
    const body = _stripWing3CarveOuts(text);

    let m = WING4_SAAS_URL_PATTERN.exec(body);
    if (m) {
        issues.push(
            new Issue(
                'warning',
                'wing4_agent_operability',
                `Wing-4 skill cites external SaaS URL \`${m[0]}\` outside carve-outs — cognition skills must operate without SaaS auth (council Q7 boundary)`,
            ),
        );
    }
    m = WING4_VENDOR_BLACKLIST.exec(body);
    if (m) {
        issues.push(
            new Issue(
                'warning',
                'wing4_vendor_independence',
                `Wing-4 skill names vendor \`${m[0]}\` outside carve-outs — keep cognition vendor-agnostic (council Q7 boundary)`,
            ),
        );
    }
    m = WING3_STACK_LOCKED_PATTERN.exec(body);
    if (m) {
        issues.push(
            new Issue(
                'warning',
                'wing4_transferability',
                `Wing-4 skill includes stack-locked instruction \`${m[0]}\` outside carve-outs — cognition should transfer across stacks (council Q7 boundary)`,
            ),
        );
    }
    m = WING4_STAGE_AGNOSTIC_PATTERN.exec(body);
    if (m) {
        issues.push(
            new Issue(
                'warning',
                'wing4_stage_agnosticism',
                `Wing-4 skill prescribes stage-locked threshold \`${m[0]}\` outside carve-outs — cognition must transfer across seed and public (council Q7 boundary)`,
            ),
        );
    }
    return issues;
}

function lint_execution_metadata(execution: ExecutionBlock): Issue[] {
    const issues: Issue[] = [];

    const execType = execution.type;
    if (execType !== undefined) {
        if (typeof execType !== 'string' || !VALID_EXECUTION_TYPES.has(execType)) {
            issues.push(
                new Issue(
                    'error',
                    'invalid_execution_type',
                    `Invalid execution.type '${String(execType)}'; must be one of: ${[...VALID_EXECUTION_TYPES].sort().join(', ')}`,
                ),
            );
        }
    } else {
        issues.push(
            new Issue('error', 'missing_execution_type', "Execution block present but missing 'type' field"),
        );
    }

    const handler = execution.handler;
    if (handler !== undefined) {
        if (typeof handler !== 'string' || !VALID_EXECUTION_HANDLERS.has(handler)) {
            issues.push(
                new Issue(
                    'error',
                    'invalid_execution_handler',
                    `Invalid execution.handler '${String(handler)}'; must be one of: ${[...VALID_EXECUTION_HANDLERS].sort().join(', ')}`,
                ),
            );
        }
    }

    if (execType === 'automated') {
        if (handler === undefined || handler === 'none') {
            issues.push(
                new Issue(
                    'error',
                    'automated_missing_handler',
                    "Automated execution requires a handler other than 'none'",
                ),
            );
        }
        const safetyMode = execution.safety_mode;
        if (safetyMode === undefined) {
            issues.push(
                new Issue(
                    'error',
                    'automated_missing_safety_mode',
                    "Automated execution requires 'safety_mode: strict'",
                ),
            );
        } else if (typeof safetyMode !== 'string' || !VALID_EXECUTION_SAFETY_MODES.has(safetyMode)) {
            issues.push(
                new Issue('error', 'invalid_safety_mode', `Invalid safety_mode '${String(safetyMode)}'; must be 'strict'`),
            );
        }
        if (!('allowed_tools' in execution)) {
            issues.push(
                new Issue(
                    'warning',
                    'automated_missing_allowed_tools',
                    "Automated execution should declare 'allowed_tools' (use [] for none)",
                ),
            );
        }
    }

    const safetyMode = execution.safety_mode;
    if (safetyMode !== undefined && (typeof safetyMode !== 'string' || !VALID_EXECUTION_SAFETY_MODES.has(safetyMode))) {
        issues.push(
            new Issue('error', 'invalid_safety_mode', `Invalid safety_mode '${String(safetyMode)}'; must be 'strict'`),
        );
    }

    const timeout = execution.timeout_seconds;
    if (timeout !== undefined) {
        if (typeof timeout !== 'number' || !Number.isInteger(timeout) || timeout <= 0) {
            issues.push(
                new Issue(
                    'warning',
                    'invalid_timeout',
                    `timeout_seconds should be a positive integer, got '${String(timeout)}'`,
                ),
            );
        }
    }

    const allowedTools = execution.allowed_tools;
    if (allowedTools !== undefined) {
        if (!Array.isArray(allowedTools)) {
            issues.push(new Issue('error', 'invalid_allowed_tools', 'allowed_tools must be a list'));
        } else if (!allowedTools.every((t) => typeof t === 'string')) {
            issues.push(
                new Issue('error', 'invalid_allowed_tools_entries', 'All entries in allowed_tools must be strings'),
            );
        }
    }

    const command = execution.command;
    if (command !== undefined) {
        if (!Array.isArray(command) || !command.every((c) => typeof c === 'string')) {
            issues.push(
                new Issue('error', 'invalid_command', 'command must be a list of strings (argv form)'),
            );
        } else if (command.length === 0) {
            issues.push(new Issue('error', 'empty_command', 'command must not be empty'));
        }
    }

    const unknown = Object.keys(execution).filter((k) => !VALID_EXECUTION_FIELDS.has(k));
    for (const field of unknown.sort()) {
        issues.push(
            new Issue('warning', 'unknown_execution_field', `Unknown field in execution block: '${field}'`),
        );
    }

    return issues;
}

export function lint_skill(p: string, text: string): LintResult {
    const issues: Issue[] = [];
    const suggestions: string[] = [];

    const sections = extract_sections(text);
    const description = extract_description(text);

    for (const section of REQUIRED_SKILL_SECTIONS) {
        if (!sectionMatches(section, sections)) {
            issues.push(new Issue('error', 'missing_section', `Missing required section: ${section}`));
        }
    }

    for (const section of RECOMMENDED_SKILL_SECTIONS) {
        if (!sectionMatches(section, sections)) {
            issues.push(
                new Issue('warning', 'missing_recommended_section', `Missing recommended section: ${section}`),
            );
        }
    }

    if (description) {
        if (description.length > 200) {
            issues.push(
                new Issue(
                    'error',
                    'description_too_long',
                    `Description is ${description.length} chars (hard cap: 200) — see road-to-governance-cleanup F6`,
                ),
            );
        }
        for (const pattern of TRIGGER_WARNING_PATTERNS) {
            if (new RegExp(pattern, 'i').test(description)) {
                issues.push(new Issue('warning', 'weak_trigger', `Description looks too generic: ${description}`));
                break;
            }
        }
    } else {
        issues.push(new Issue('warning', 'missing_description', 'Frontmatter description is missing or unreadable'));
    }

    // --- Bare-noun name check ---
    const skillName = basename(p) === 'SKILL.md' ? parentName(p) : stem(p);
    if (skillName && !skillName.includes('-') && skillName.length >= 3) {
        const ALLOWED_BARE_NOUNS = new Set([
            'brand',
            'database',
            'devcontainer',
            'docker',
            'eloquent',
            'flux',
            'forecasting',
            'grafana',
            'iconography',
            'laravel',
            'livewire',
            'markitdown',
            'mcp',
            'openapi',
            'performance',
            'premortem',
            'security',
            'terraform',
            'terragrunt',
            'traefik',
            'websocket',
        ]);
        if (!ALLOWED_BARE_NOUNS.has(skillName.toLowerCase())) {
            issues.push(
                new Issue(
                    'warning',
                    'bare_noun_name',
                    `Bare-noun skill name \`${skillName}\` — consider adding a qualifier (e.g., \`${skillName}-management\`)`,
                ),
            );
        }
    }

    // --- Status lifecycle check ---
    const frontmatter = extract_frontmatter(text);
    if (frontmatter) {
        const statusMatch = STATUS_PATTERN.exec(frontmatter);
        if (statusMatch) {
            const status = statusMatch[1] as string;
            if (status === 'deprecated') {
                const replacedBy = extractFrontmatterField(frontmatter, REPLACED_BY_PATTERN);
                let msg = 'Skill is deprecated';
                if (replacedBy) {
                    msg += ` (replaced by: ${replacedBy})`;
                }
                issues.push(new Issue('warning', 'deprecated_skill', msg));
            } else if (status === 'superseded') {
                const replacedBy = extractFrontmatterField(frontmatter, REPLACED_BY_PATTERN);
                let msg = 'Skill is superseded — should be removed';
                if (replacedBy) {
                    msg += ` (replaced by: ${replacedBy})`;
                }
                issues.push(new Issue('warning', 'superseded_skill', msg));
            }
        }

        const execution = parseExecutionBlock(frontmatter);
        if (execution !== null) {
            issues.push(...lint_execution_metadata(execution));
        }

        const tierMatch = TIER_PATTERN.exec(frontmatter);
        if (tierMatch && tierMatch[1] === 'senior') {
            issues.push(...lint_senior_tier_blocks(text));
        }

        const spineSlots = parseContextSpine(frontmatter);
        if (spineSlots && spineSlots.some((s) => WING3_SPINE_SLOTS.has(s))) {
            issues.push(...lint_wing3_boundaries(text));
        }
        if (spineSlots && spineSlots.some((s) => WING4_SPINE_SLOTS.has(s))) {
            issues.push(...lint_wing4_boundaries(text));
        }
    }

    const procedureBlock = findProcedureBlock(text);
    if (procedureBlock !== null) {
        if (!procedureBlock) {
            issues.push(new Issue('error', 'empty_procedure', 'Procedure section is empty'));
        } else {
            const hasOrdered = freshMatch(ORDERED_STEP_PATTERN, procedureBlock) !== null;
            const hasSubheadings = /^###\s+/m.test(procedureBlock);
            if (!hasOrdered && !hasSubheadings) {
                issues.push(new Issue('error', 'unordered_procedure', 'Procedure has no ordered steps or sub-headings'));
            }
            const meaningfulSteps = countMatches(ORDERED_STEP_PATTERN, procedureBlock);
            if (meaningfulSteps < 3) {
                issues.push(new Issue('warning', 'short_procedure', 'Procedure has fewer than 3 ordered steps'));
            }
            if (!hasValidationStep(procedureBlock) && !hasValidationStep(text)) {
                issues.push(new Issue('error', 'missing_validation', 'Skill lacks a concrete validation step'));
            }
            const vagueHits = findVagueValidation(procedureBlock);
            for (const hit of vagueHits) {
                issues.push(new Issue('error', 'vague_validation', `Vague validation detected: ${hit}`));
            }
            if (!hasInspectStep(procedureBlock)) {
                issues.push(new Issue('warning', 'missing_inspect_step', 'Procedure has no explicit inspect/check step'));
            }
        }
    }

    if (text.includes('## Output format')) {
        const outputBlock = extract_section_block(text, 'Output format');
        if (!outputBlock || parseOrderedListItems(outputBlock).length < 2) {
            issues.push(
                new Issue('warning', 'weak_output_format', 'Output format should contain at least 2 ordered requirements'),
            );
            suggestions.push('Add 2-4 ordered output requirements');
        }
    } else {
        suggestions.push('Add an Output format section with ordered response constraints');
    }

    const gotchaBlock = extract_section_block(text, 'Gotchas') || extract_section_block(text, 'Gotcha');
    if (gotchaBlock) {
        if (countBullets(gotchaBlock) < 1) {
            issues.push(new Issue('warning', 'weak_gotchas', 'Gotchas should contain at least one realistic failure mode'));
        }
    } else {
        suggestions.push('Add at least one realistic failure pattern to Gotchas');
    }

    if (text.includes('## Do NOT')) {
        const doNotBlock = extract_section_block(text, 'Do NOT');
        if (countBullets(doNotBlock) < 1) {
            issues.push(new Issue('warning', 'weak_do_not', 'Do NOT should contain at least one enforceable constraint'));
        }
    } else {
        suggestions.push('Add at least one enforceable Do NOT constraint');
    }

    if (isProbablyTooBroad(text, description)) {
        issues.push(new Issue('warning', 'broad_scope', 'Skill scope appears broad and may need splitting'));
        suggestions.push('Narrow the trigger or split unrelated workflows');
    }

    // --- Developer judgment check for assisted skills ---
    const fm = extract_frontmatter(text);
    const execBlock = fm ? parseExecutionBlock(fm) : null;
    const execTypeVal = execBlock ? (execBlock.type ?? '') : '';
    if (execTypeVal === 'assisted' && procedureBlock) {
        const validationTerms = [
            'validat',
            'check',
            'verify',
            'confirm',
            'challenge',
            'existing',
            'duplicate',
            'contradict',
            'fit',
            'misfit',
        ];
        const lower = procedureBlock.toLowerCase();
        const hasValidation = validationTerms.some((term) => lower.includes(term));
        if (!hasValidation) {
            issues.push(
                new Issue(
                    'warning',
                    'missing_validation_step',
                    'Assisted skill has no validation/challenge step in procedure',
                ),
            );
            suggestions.push('Add a requirement-checking or validation step before implementation');
        }
    }

    // --- Size check ---
    const totalLines = lineCount(text);
    const isMetaSkill = Boolean(fm) && /^meta_skill:\s*true\s*$/m.test(fm as string);
    if (totalLines > 400 && !isMetaSkill) {
        const density = _densityScore(text);
        const procedures = _countProcedureSections(text);
        if (density < 0.6 || procedures >= 2) {
            const reason = density < 0.6 ? `density ${fmt2f(density)} < 0.60` : `${procedures} ## Procedure blocks (≥ 2)`;
            issues.push(
                new Issue(
                    'warning',
                    'skill_too_large',
                    `Skill has ${totalLines} lines and ${reason}; review for split (see linter-structural-model contract)`,
                ),
            );
        }
    }

    // --- Pointer-only / guideline-dependent skill detection ---
    if (procedureBlock) {
        const procLines = splitlines(procedureBlock)
            .map((line) => line.trim())
            .filter((line) => line !== '');

        const delegationCount = countMatches(
            /(?:see|read|check|follow|refer\s+to|consult|per|apply\s+.*from)\s+.*(?:guideline|skill|rule|doc|documentation)/gi,
            procedureBlock,
        );

        const actionVerbsRe =
            /\b(?:run|execute|create|write|validate|verify|inspect|check|ensure|test|build|generate|compare|extract|parse|detect|fix|update|add|remove|install|configure|deploy|trace|review|map|resolve|measure|confirm)\b/gi;
        const actionVerbs = [...procedureBlock.matchAll(actionVerbsRe)].map((m) => m[0].toLowerCase());
        const actionCount = new Set(actionVerbs).size;

        const meaningfulSteps = countMatches(ORDERED_STEP_PATTERN, procedureBlock);

        const hasThinProcedure = meaningfulSteps < 3 && procLines.length < 8;

        if (delegationCount >= 3 && actionCount <= 1 && hasThinProcedure) {
            issues.push(
                new Issue(
                    'error',
                    'guideline_dependent_skill',
                    `Skill is effectively a pointer to guidelines/docs (${delegationCount} delegations, ${actionCount} action verbs, ${meaningfulSteps} steps) — not an executable workflow`,
                ),
            );
            suggestions.push('Add concrete steps, decision points, and validation directly into the skill');
        } else if (delegationCount >= 2 && actionCount <= 2 && hasThinProcedure) {
            issues.push(
                new Issue(
                    'warning',
                    'pointer_only_skill',
                    `Skill appears too guideline-dependent (${delegationCount} delegations, ${actionCount} action verbs, ${meaningfulSteps} steps) — may lack its own executable workflow`,
                ),
            );
            suggestions.push('Expand the skill so it remains executable without opening a guideline');
        }
    }

    issues.push(...validate_evals_json(p));

    return new LintResult(p, 'skill', classify_status(issues), issues, dedupePreserveOrder(suggestions));
}

export function validate_evals_json(skillPath: string): Issue[] {
    const evalsPath = path.join(path.dirname(skillPath), 'evals', 'evals.json');
    if (!isFile(evalsPath)) {
        return [];
    }
    const issues: Issue[] = [];
    let data: unknown;
    try {
        data = JSON.parse(readText(evalsPath));
    } catch (exc) {
        return [new Issue('warning', 'evals_json_unreadable', `evals/evals.json could not be parsed: ${pyExcStr(exc)}`)];
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return [new Issue('warning', 'evals_json_shape', 'evals/evals.json root must be an object')];
    }
    const obj = data as Record<string, unknown>;
    if (!('skill' in obj) || typeof obj.skill !== 'string') {
        issues.push(
            new Issue('warning', 'evals_json_missing_skill', "evals/evals.json must declare top-level 'skill' (string)"),
        );
    }
    const scenarios = obj.scenarios;
    if (!Array.isArray(scenarios) || scenarios.length < 1) {
        issues.push(
            new Issue('warning', 'evals_json_no_scenarios', "evals/evals.json must declare 'scenarios' (non-empty array)"),
        );
        return issues;
    }
    const validKinds = ['contains', 'file_exists', 'rubric'];
    const validKindsSet = new Set(validKinds);
    scenarios.forEach((scenario, idx) => {
        const loc = `scenarios[${idx}]`;
        if (typeof scenario !== 'object' || scenario === null || Array.isArray(scenario)) {
            issues.push(new Issue('warning', 'evals_json_scenario_shape', `${loc} must be an object`));
            return;
        }
        const sc = scenario as Record<string, unknown>;
        for (const key of ['id', 'prompt']) {
            const v = sc[key];
            if (!(key in sc) || typeof v !== 'string' || v.trim() === '') {
                issues.push(
                    new Issue('warning', 'evals_json_scenario_missing_field', `${loc} missing required string field '${key}'`),
                );
            }
        }
        const assertions = sc.assertions;
        if (!Array.isArray(assertions) || assertions.length < 1) {
            issues.push(
                new Issue('warning', 'evals_json_scenario_no_assertions', `${loc}.assertions must be a non-empty array`),
            );
            return;
        }
        assertions.forEach((assertion, aIdx) => {
            const aLoc = `${loc}.assertions[${aIdx}]`;
            if (typeof assertion !== 'object' || assertion === null || Array.isArray(assertion)) {
                issues.push(new Issue('warning', 'evals_json_assertion_shape', `${aLoc} must be an object`));
                return;
            }
            const a = assertion as Record<string, unknown>;
            const kind = a.kind;
            if (typeof kind !== 'string' || !validKindsSet.has(kind)) {
                issues.push(
                    new Issue(
                        'warning',
                        'evals_json_assertion_kind',
                        `${aLoc}.kind must be one of ${pyStrListRepr(validKinds)}, got ${pyReprUnknown(kind)}`,
                    ),
                );
                return;
            }
            const requiredField = { contains: 'value', file_exists: 'path', rubric: 'criterion' }[kind] as string;
            if (!(requiredField in a) || typeof a[requiredField] !== 'string') {
                issues.push(
                    new Issue(
                        'warning',
                        'evals_json_assertion_missing_field',
                        `${aLoc} (kind=${kind}) missing required string field '${requiredField}'`,
                    ),
                );
            }
        });
    });
    return issues;
}

export function lint_rule(p: string, text: string): LintResult {
    const issues: Issue[] = [];
    const suggestions: string[] = [];

    const frontmatter = extract_frontmatter(text);
    if (frontmatter === null) {
        issues.push(new Issue('error', 'missing_frontmatter', 'Rule is missing YAML frontmatter (--- block)'));
    } else {
        const ruleType = extractFrontmatterField(frontmatter, TYPE_PATTERN);
        if (ruleType === null) {
            issues.push(
                new Issue('error', 'missing_type', "Frontmatter missing 'type' field (must be 'always', 'auto', or 'manual')"),
            );
        } else if (!VALID_RULE_TYPES.has(ruleType)) {
            issues.push(
                new Issue('error', 'invalid_type', `Invalid type '${ruleType}'; must be 'always', 'auto', or 'manual'`),
            );
        }

        const ruleSource = extractFrontmatterField(frontmatter, SOURCE_PATTERN);
        if (ruleSource !== null && !VALID_RULE_SOURCES.has(ruleSource)) {
            issues.push(
                new Issue('error', 'invalid_source', `Invalid source '${ruleSource}'; must be 'package' or 'project'`),
            );
        }

        if (ruleType === 'auto') {
            const description = extract_description(text);
            if (!description) {
                issues.push(
                    new Issue('error', 'auto_missing_description', "Auto rules require a 'description' field for matching"),
                );
            }
        }

        const ruleDescription = extract_description(text);
        if (ruleDescription && ruleDescription.length > 200) {
            issues.push(
                new Issue(
                    'error',
                    'description_too_long',
                    `Description is ${ruleDescription.length} chars (hard cap: 200) — see road-to-governance-cleanup F6`,
                ),
            );
        }

        if (ruleType === 'always') {
            const description = extract_description(text) || '';
            const topicKeywords = [
                ...description.matchAll(
                    /\b(?:PHP|Laravel|Docker|Git|E2E|Playwright|SQL|Blade|Livewire|Terraform|Jira|Sentry|translations|i18n)\b/gi,
                ),
            ].map((m) => m[0]);
            if (topicKeywords.length >= 2) {
                issues.push(
                    new Issue(
                        'info',
                        'always_auto_candidate',
                        `Always-rule with topic-specific description (${topicKeywords.join(', ')}) — consider auto type per rule-type-governance`,
                    ),
                );
            }
        }

        issues.push(...lint_router_frontmatter(stem(p), frontmatter, ruleType));
    }

    if (!H1_PATTERN.test(text)) {
        issues.push(new Issue('error', 'missing_h1', 'Rule is missing an H1 heading (# Title)'));
    }

    if (!text.endsWith('\n')) {
        issues.push(new Issue('error', 'no_trailing_newline', 'File must end with exactly one newline'));
    } else if (text.endsWith('\n\n')) {
        issues.push(new Issue('warning', 'extra_trailing_newlines', 'File ends with multiple newlines; should be exactly one'));
    }

    if (DOUBLE_BLANK_PATTERN.test(text)) {
        issues.push(new Issue('warning', 'double_blank_lines', 'File contains double or triple blank lines'));
    }

    const lc = splitlines(text).filter((line) => line.trim() !== '').length;
    const totalLines = lineCount(text);
    if (totalLines > 200) {
        issues.push(
            new Issue('error', 'rule_too_large', `Rule has ${totalLines} lines (hard limit: 200); must split or move to guideline`),
        );
    } else if (lc > 60) {
        const density = _densityScore(text);
        const ironBlocks = _ironLawBlocks(text);
        if (density < 0.5 && ironBlocks === 0) {
            issues.push(
                new Issue(
                    'warning',
                    'long_rule',
                    `Rule has ${lc} non-empty lines, density ${fmt2f(density)} < 0.50, no Iron-Law block; rules should be concise (see linter-structural-model contract)`,
                ),
            );
        }
    }

    for (const badSign of RULE_BAD_SIGNS) {
        if (text.includes(badSign)) {
            issues.push(new Issue('error', 'rule_looks_like_skill', `Rule contains skill-like section: ${badSign}`));
        }
    }

    // Procedural-rule heuristic.
    const body = frontmatter ? splitN(text, '---', 2)[splitN(text, '---', 2).length - 1] ?? text : text;
    const strippedBody = _stripMarkdownForCheck(body);
    const kwCount = countMatches(/\b(procedure|workflow)\b/gi, strippedBody);
    const orderedSteps = countMatches(/^\s*\d+\.\s+/gm, body);
    if (kwCount >= 2 && orderedSteps >= 3 && _ironLawBlocks(text) === 0) {
        issues.push(new Issue('warning', 'procedural_rule', 'Rule looks procedural; consider a skill instead'));
    }

    return new LintResult(p, 'rule', classify_status(issues), issues, dedupePreserveOrder(suggestions));
}

function _lint_command_suggestion_block(text: string): Issue[] {
    const issues: Issue[] = [];
    const [data] = parse_frontmatter_for_schema(text);
    if (data === null) {
        return issues;
    }
    const suggestion = data.suggestion;
    if (suggestion === undefined) {
        issues.push(
            new Issue(
                'error',
                'missing_suggestion_block',
                "Command frontmatter is missing the 'suggestion' block — required by road-to-context-aware-command-suggestion Phase 2.",
            ),
        );
        return issues;
    }
    if (typeof suggestion !== 'object' || suggestion === null || Array.isArray(suggestion)) {
        issues.push(new Issue('error', 'invalid_suggestion_block', "'suggestion' must be a mapping"));
        return issues;
    }
    const sug = suggestion as Record<string, YamlValue>;
    const eligible = sug.eligible;
    if (eligible === true) {
        const td = String(sug.trigger_description ?? '').trim();
        const tc = String(sug.trigger_context ?? '').trim();
        if (!td) {
            issues.push(
                new Issue(
                    'error',
                    'missing_trigger_description',
                    "suggestion.eligible=true requires a non-empty 'trigger_description'.",
                ),
            );
        } else if (td.length < 10) {
            issues.push(
                new Issue(
                    'warning',
                    'trigger_description_too_short',
                    'suggestion.trigger_description is suspiciously short (<10 chars); linter rejects empty or overly generic patterns.',
                ),
            );
        }
        if (!tc) {
            issues.push(
                new Issue(
                    'error',
                    'missing_trigger_context',
                    "suggestion.eligible=true requires a non-empty 'trigger_context'.",
                ),
            );
        } else if (tc.length < 10) {
            issues.push(
                new Issue(
                    'warning',
                    'trigger_context_too_short',
                    'suggestion.trigger_context is suspiciously short (<10 chars); linter rejects empty or overly generic patterns.',
                ),
            );
        }
    } else if (eligible === false) {
        const rationale = String(sug.rationale ?? '').trim();
        if (!rationale) {
            issues.push(
                new Issue('error', 'missing_suggestion_rationale', "suggestion.eligible=false requires a non-empty 'rationale'."),
            );
        }
    } else {
        issues.push(new Issue('error', 'invalid_suggestion_eligible', 'suggestion.eligible must be true or false.'));
    }
    return issues;
}

export function lint_command(p: string, text: string): LintResult {
    const issues: Issue[] = [];
    const suggestions: string[] = [];

    const frontmatter = extract_frontmatter(text);
    if (frontmatter === null) {
        issues.push(new Issue('error', 'missing_frontmatter', 'Command is missing YAML frontmatter (--- block)'));
    } else {
        const nameMatch = NAME_PATTERN.exec(frontmatter);
        if (!nameMatch || (nameMatch[1] as string).trim() === '') {
            issues.push(new Issue('error', 'missing_name', "Frontmatter missing 'name' field"));
        }

        const dmiMatch = DISABLE_MODEL_PATTERN.exec(frontmatter);
        if (dmiMatch && dmiMatch[1] !== 'true') {
            issues.push(
                new Issue('warning', 'disable_model_invocation_false', "disable-model-invocation should be 'true' for commands"),
            );
        }

        const description = extract_description(text);
        if (!description) {
            issues.push(new Issue('warning', 'missing_description', 'Frontmatter description is missing'));
        } else if (description.length > 200) {
            issues.push(
                new Issue(
                    'error',
                    'description_too_long',
                    `Description is ${description.length} chars (hard cap: 200) — see road-to-governance-cleanup F6`,
                ),
            );
        }

        issues.push(..._lint_command_suggestion_block(text));

        if (frontmatter.includes('superseded_by:')) {
            const shimWarning =
                /⚠️\s+\/[a-z][a-z0-9-]*\s+is deprecated;\s+use\s+\/[a-z][a-z0-9 -]+\s+instead/.test(text);
            if (!shimWarning) {
                issues.push(
                    new Issue(
                        'error',
                        'shim_missing_warning',
                        "Deprecation shim must contain a one-line warning matching '⚠️  /<old-name> is deprecated; use /<cluster> <sub> instead.' (or '/<cluster> --<flag>' for flag-clusters) (see docs/contracts/command-clusters.md § Deprecation shim contract)",
                    ),
                );
            }
        }
    }

    if (!H1_PATTERN.test(text)) {
        issues.push(new Issue('error', 'missing_h1', 'Command is missing an H1 heading (# Title)'));
    }

    const sections = extract_sections(text);
    const hasSteps = [...sections].some((s) => s.toLowerCase().startsWith('step'));
    const hasNumbered = /^###?\s+(?:\d+\.|step\s+\d+)\s+/im.test(text);
    if (!hasSteps && !hasNumbered) {
        const delegated = _commandDelegationSignal(text, frontmatter);
        if (!delegated) {
            issues.push(new Issue('warning', 'no_steps', 'Command has no Steps section or numbered sub-headings'));
        }
    }

    const wordCount = pySplitWhitespace(text).length;
    if (wordCount > 1000) {
        const density = _densityScore(text);
        const delegated = _commandDelegationSignal(text, frontmatter);
        if (!delegated && density < 0.65) {
            issues.push(
                new Issue(
                    'warning',
                    'large_command',
                    `Command has ${wordCount} words, density ${fmt2f(density)} < 0.65, no delegation signal (frontmatter cluster:/routes_to: or ≥ 3 .md links); review for split or delegation (see linter-structural-model contract)`,
                ),
            );
        }
    }

    if (!text.endsWith('\n')) {
        issues.push(new Issue('error', 'no_trailing_newline', 'File must end with exactly one newline'));
    } else if (text.endsWith('\n\n')) {
        issues.push(new Issue('warning', 'extra_trailing_newlines', 'File ends with multiple newlines; should be exactly one'));
    }

    issues.push(...lint_role_contract_refs(text));

    return new LintResult(p, 'command', classify_status(issues), issues, dedupePreserveOrder(suggestions));
}

export function lint_unknown(p: string): LintResult {
    const issues = [
        new Issue('error', 'unknown_artifact', 'Could not detect whether file is a skill, rule, or command'),
    ];
    return new LintResult(p, 'unknown', 'fail', issues, [
        'Move the file into a recognized skills/, rules/, or commands/ path',
    ]);
}

export function lint_guideline(p: string, text: string): LintResult {
    const issues: Issue[] = [];

    if (!H1_PATTERN.test(text)) {
        issues.push(new Issue('warning', 'missing_h1', 'Guideline is missing an H1 heading'));
    }

    const wordCount = pySplitWhitespace(text).length;
    if (wordCount > 1500) {
        issues.push(new Issue('info', 'large_guideline', `Guideline has ${wordCount} words (target: 400-1500)`));
    }

    if (!text.endsWith('\n')) {
        issues.push(new Issue('warning', 'no_trailing_newline', 'File must end with exactly one newline'));
    }

    return new LintResult(p, 'guideline', classify_status(issues), issues, []);
}

export function lint_persona(p: string, text: string): LintResult {
    const issues: Issue[] = [];

    const frontmatter = extract_frontmatter(text);
    if (!frontmatter) {
        issues.push(new Issue('error', 'missing_frontmatter', 'Persona requires YAML frontmatter'));
        return new LintResult(p, 'persona', 'fail', issues, [
            'See .agent-src.uncondensed/templates/persona.md for the schema',
        ]);
    }

    const required: Record<string, RegExp> = {
        id: /^id:\s*"?([\w-]+)"?\s*$/m,
        role: /^role:\s*"?(.+?)"?\s*$/m,
        description: /^description:\s*"?(.+?)"?\s*$/m,
        tier: /^tier:\s*"?(\w+)"?\s*$/m,
    };
    const optionalDefaulted: Record<string, RegExp> = {
        version: /^version:\s*"?(.+?)"?\s*$/m,
        source: /^source:\s*"?(package|project)"?\s*$/m,
    };
    const parsed: Record<string, string | number> = {};
    for (const [field, pattern] of Object.entries(required)) {
        const value = extractFrontmatterField(frontmatter, pattern);
        if (!value) {
            issues.push(new Issue('error', `missing_${field}`, `Persona frontmatter must declare \`${field}\``));
        } else {
            parsed[field] = value;
        }
    }
    for (const [field, pattern] of Object.entries(optionalDefaulted)) {
        const value = extractFrontmatterField(frontmatter, pattern);
        if (value) {
            parsed[field] = value;
        }
    }

    if ('id' in parsed && parsed.id !== stem(p)) {
        issues.push(
            new Issue('error', 'id_filename_mismatch', `Persona id \`${parsed.id}\` must match filename stem \`${stem(p)}\``),
        );
    }

    if ('tier' in parsed && !VALID_PERSONA_TIERS.has(parsed.tier as string)) {
        issues.push(
            new Issue(
                'error',
                'invalid_tier',
                `Persona tier \`${parsed.tier}\` must be one of ${pyStrListRepr([...VALID_PERSONA_TIERS].sort())}`,
            ),
        );
    }

    const wingMatch = /^wing:\s*"?(\d+)"?\s*$/m.exec(frontmatter);
    if (wingMatch) {
        const wingValue = Number.parseInt(wingMatch[1] as string, 10);
        if (VALID_PERSONA_WINGS.has(wingValue)) {
            parsed.wing = wingValue;
        } else {
            issues.push(
                new Issue(
                    'error',
                    'invalid_wing',
                    `Persona wing \`${wingValue}\` must be one of ${pyIntListRepr([...VALID_PERSONA_WINGS].sort((a, b) => a - b))}`,
                ),
            );
        }
    }

    if ('description' in parsed && (parsed.description as string).length > 160) {
        issues.push(
            new Issue('warning', 'long_description', `Persona description is ${(parsed.description as string).length} chars (target ≤ 160)`),
        );
    }

    const sections = extract_sections(text);
    const tier = parsed.tier;
    const requiredSections = tier === 'specialist' ? REQUIRED_PERSONA_SECTIONS_SPECIALIST : REQUIRED_PERSONA_SECTIONS_CORE;
    for (const requiredSection of requiredSections) {
        if (!sections.has(requiredSection)) {
            issues.push(new Issue('error', 'missing_section', `Persona is missing required section \`## ${requiredSection}\``));
        }
    }

    const uqBlock = extract_section_block(text, 'Unique Questions');
    if (uqBlock) {
        const bulletCount = countMatches(/^\s*[-*]\s+/gm, uqBlock);
        if (bulletCount < 3) {
            issues.push(new Issue('warning', 'too_few_unique_questions', `Persona has ${bulletCount} unique questions (target ≥ 3)`));
        }
    }

    if ('tier' in parsed && (parsed.tier as string) in PERSONA_LINE_BUDGETS) {
        const tierValue = parsed.tier as string;
        const wingValue = 'wing' in parsed ? (parsed.wing as number) : null;
        const wingKey = wingValue !== null ? `${tierValue}:${wingValue}` : '';
        const budget = PERSONA_LINE_BUDGETS_BY_WING[wingKey] ?? PERSONA_LINE_BUDGETS[tierValue] ?? 0;
        const lc = lineCount(text);
        if (lc > budget) {
            const scope = wingValue === null ? `${tierValue}` : `${tierValue}, wing ${wingValue}`;
            issues.push(new Issue('warning', 'size_budget', `Persona has ${lc} lines (${scope} budget ≤ ${budget})`));
        }
    }

    if (!H1_PATTERN.test(text)) {
        issues.push(new Issue('warning', 'missing_h1', 'Persona is missing an H1 heading'));
    }

    if (!text.endsWith('\n')) {
        issues.push(new Issue('warning', 'no_trailing_newline', 'File must end with exactly one newline'));
    }

    return new LintResult(p, 'persona', classify_status(issues), issues, []);
}

export function lint_usertype(p: string, text: string): LintResult {
    const issues: Issue[] = [];

    const frontmatter = extract_frontmatter(text);
    if (!frontmatter) {
        issues.push(new Issue('error', 'missing_frontmatter', 'User-type requires YAML frontmatter'));
        return new LintResult(p, 'user-type', 'fail', issues, [
            '.agent-src.uncondensed/user-types/_template/user-type.md',
        ]);
    }

    const required: Record<string, RegExp> = {
        id: /^id:\s*"?([\w-]+)"?\s*$/m,
        kind: /^kind:\s*"?([\w-]+)"?\s*$/m,
        description: /^description:\s*"?([^"\n]+?)"?\s*$/m,
        version: /^version:\s*"?([\d.]+)"?\s*$/m,
        source: /^source:\s*"?(package|project)"?\s*$/m,
    };
    const parsed: Record<string, string> = {};
    for (const [field, pattern] of Object.entries(required)) {
        const value = extractFrontmatterField(frontmatter, pattern);
        if (!value) {
            issues.push(new Issue('error', `missing_${field}`, `User-type frontmatter must declare \`${field}\``));
        } else {
            parsed[field] = value;
        }
    }

    if ('id' in parsed && parsed.id !== stem(p)) {
        issues.push(
            new Issue('error', 'id_filename_mismatch', `User-type id \`${parsed.id}\` must match filename stem \`${stem(p)}\``),
        );
    }

    if ('kind' in parsed && parsed.kind !== 'user-type') {
        issues.push(new Issue('error', 'invalid_kind', `User-type kind must be \`user-type\` (got \`${parsed.kind}\`)`));
    }

    if ('description' in parsed && (parsed.description as string).length > 160) {
        issues.push(
            new Issue('warning', 'long_description', `User-type description is ${(parsed.description as string).length} chars (target ≤ 160)`),
        );
    }

    const sections = extract_sections(text);
    for (const requiredSection of REQUIRED_USERTYPE_SECTIONS) {
        if (!sections.has(requiredSection)) {
            issues.push(new Issue('error', 'missing_section', `User-type is missing required section \`## ${requiredSection}\``));
        }
    }

    const uqBlock = extract_section_block(text, 'Unique Questions');
    if (uqBlock) {
        const bulletCount = countMatches(/^\s*[-*]\s+/gm, uqBlock);
        if (bulletCount < 3) {
            issues.push(new Issue('warning', 'too_few_unique_questions', `User-type has ${bulletCount} unique questions (target ≥ 3)`));
        }
    }

    const lc = lineCount(text);
    if (lc > USERTYPE_LINE_BUDGET) {
        issues.push(new Issue('warning', 'size_budget', `User-type has ${lc} lines (budget ≤ ${USERTYPE_LINE_BUDGET})`));
    }

    if (!H1_PATTERN.test(text)) {
        issues.push(new Issue('warning', 'missing_h1', 'User-type is missing an H1 heading'));
    }

    if (!text.endsWith('\n')) {
        issues.push(new Issue('warning', 'no_trailing_newline', 'File must end with exactly one newline'));
    }

    return new LintResult(p, 'user-type', classify_status(issues), issues, []);
}

// --- File gathering ---

export function gather_all_candidate_files(root: string): string[] {
    const candidates: string[] = [];
    const seenLogical = new Set<string>();

    const add = (file: string, sourceRoot: string): void => {
        if (isSymlink(file) || !isFile(file)) {
            return;
        }
        let logical: string;
        if (isUnder(file, sourceRoot)) {
            logical = relPosix(file, sourceRoot);
        } else {
            logical = basename(file);
        }
        if (seenLogical.has(logical)) {
            return;
        }
        seenLogical.add(logical);
        candidates.push(file);
    };

    const sources = artefact_roots();
    if (sources.length > 0) {
        for (const srcRoot of sources) {
            const skillsDir = path.join(srcRoot, 'skills');
            if (isDir(skillsDir)) {
                for (const f of rglob(skillsDir, (b) => b === 'SKILL.md')) {
                    add(f, srcRoot);
                }
            }
            for (const sub of ['rules', 'commands', 'guidelines']) {
                const base = path.join(srcRoot, sub);
                if (exists(base)) {
                    for (const f of rglob(base, (b) => b.endsWith('.md'))) {
                        add(f, srcRoot);
                    }
                }
            }
            for (const sub of ['personas', 'user-types']) {
                const base = path.join(srcRoot, sub);
                if (exists(base)) {
                    for (const f of glob(base, (b) => b.endsWith('.md'))) {
                        if (basename(f).toLowerCase() === 'readme.md') {
                            continue;
                        }
                        add(f, srcRoot);
                    }
                }
            }
            const charter = path.join(srcRoot, FRUGALITY_CHARTER_RELPATH);
            if (exists(charter) && !isSymlink(charter)) {
                add(charter, srcRoot);
            }
        }
    } else {
        const augmentRoot = path.join(root, 'dist/agent-src');
        if (exists(augmentRoot)) {
            const subPatterns: Array<[string, (b: string) => boolean]> = [
                ['skills', (b) => b === 'SKILL.md'],
                ['rules', (b) => b.endsWith('.md')],
                ['commands', (b) => b.endsWith('.md')],
                ['guidelines', (b) => b.endsWith('.md')],
            ];
            for (const [sub, pred] of subPatterns) {
                const base = path.join(augmentRoot, sub);
                if (exists(base)) {
                    for (const f of rglob(base, pred)) {
                        add(f, augmentRoot);
                    }
                }
            }
            for (const sub of ['personas', 'user-types']) {
                const base = path.join(augmentRoot, sub);
                if (exists(base)) {
                    for (const f of glob(base, (b) => b.endsWith('.md'))) {
                        if (basename(f).toLowerCase() === 'readme.md') {
                            continue;
                        }
                        add(f, augmentRoot);
                    }
                }
            }
            const charter = path.join(augmentRoot, FRUGALITY_CHARTER_RELPATH);
            if (exists(charter) && !isSymlink(charter)) {
                add(charter, augmentRoot);
            }
        }
    }

    return sortedUnique(candidates);
}

export function gather_candidate_files_under(srcRoot: string): string[] {
    const out: string[] = [];
    if (!isDir(srcRoot)) {
        return out;
    }
    const seen = new Set<string>();

    const push = (file: string): void => {
        if (isSymlink(file) || !isFile(file)) {
            return;
        }
        const resolved = fs.realpathSync(file);
        if (seen.has(resolved)) {
            return;
        }
        seen.add(resolved);
        out.push(file);
    };

    const skillsDir = path.join(srcRoot, 'skills');
    if (exists(skillsDir)) {
        for (const f of rglob(skillsDir, (b) => b === 'SKILL.md')) {
            push(f);
        }
    }
    for (const sub of ['rules', 'commands', 'guidelines']) {
        const base = path.join(srcRoot, sub);
        if (exists(base)) {
            for (const f of rglob(base, (b) => b.endsWith('.md'))) {
                push(f);
            }
        }
    }
    for (const sub of ['personas', 'user-types']) {
        const base = path.join(srcRoot, sub);
        if (exists(base)) {
            for (const f of glob(base, (b) => b.endsWith('.md'))) {
                if (basename(f).toLowerCase() === 'readme.md') {
                    continue;
                }
                push(f);
            }
        }
    }
    const charter = path.join(srcRoot, FRUGALITY_CHARTER_RELPATH);
    if (exists(charter) && !isSymlink(charter)) {
        push(charter);
    }
    return sortedUnique(out);
}

export function gather_changed_candidate_files(root: string): string[] {
    const diffCommands = [
        ['git', 'diff', '--name-only', 'origin/main...HEAD'],
        ['git', 'diff', '--name-only', '--cached', 'HEAD'],
        ['git', 'diff', '--name-only', 'HEAD'],
    ];
    try {
        let rawLines: string[] = [];
        for (const cmd of diffCommands) {
            const result = spawnSync(cmd[0] as string, cmd.slice(1), {
                cwd: root,
                encoding: 'utf-8',
            });
            if (result.status === 0 && (result.stdout ?? '').trim()) {
                rawLines = splitlines(result.stdout);
                break;
            }
        }

        const files: string[] = [];
        for (let raw of rawLines) {
            raw = raw.trim();
            if (!raw) {
                continue;
            }
            const p = path.join(root, raw);
            if (!exists(p)) {
                continue;
            }
            if (isSymlink(p)) {
                continue;
            }
            const norm = raw.replace(/\\/g, '/');
            const inSource =
                norm.startsWith('.agent-src.uncondensed/') ||
                norm.startsWith('dist/agent-src/') ||
                norm.includes('/.agent-src.uncondensed/') ||
                norm.includes('/dist/agent-src/');
            if (!inSource) {
                continue;
            }
            const isMd = path.extname(p) === '.md';
            const inEvals = norm.includes('/evals/');
            if (
                !inEvals &&
                (basename(p) === 'SKILL.md' || (isMd && (norm.includes('/rules/') || norm.includes('/commands/'))))
            ) {
                files.push(p);
            }
        }
        return sortedUnique(files);
    } catch {
        return [];
    }
}

// --- Interaction quality checks ---

const _INTERACTION_NAME_PATTERNS =
    /skill-router|handoff|analysis-skill|skill-writing|skill-reviewer|model-recommendation|developer-like-execution|universal-project-analysis|interaction|autonomous-mode|feature-planning/i;
const _INTERACTION_CONTENT_KEYWORDS = [
    'handoff',
    'model switch',
    'clarification',
    'ask the user',
    'framework choice',
    'requirements are unclear',
];

function _isInteractionArtifact(p: string, text: string): boolean {
    const name = p.replace(/\\/g, '/').toLowerCase();
    if (_INTERACTION_NAME_PATTERNS.test(name)) {
        return true;
    }
    const textLower = text.toLowerCase();
    const matches = _INTERACTION_CONTENT_KEYWORDS.filter((kw) => textLower.includes(kw)).length;
    return matches >= 3;
}

function lint_interaction_quality(p: string, text: string): Issue[] {
    if (!_isInteractionArtifact(p, text)) {
        return [];
    }

    const issues: Issue[] = [];
    const textLower = text.toLowerCase();

    const hasQuestionContext = [
        'ask the user',
        'ask clarification',
        'numbered options',
        'present options',
        'question strategy',
        'ask before',
    ].some((kw) => textLower.includes(kw));

    if (hasQuestionContext) {
        const hasSimple = ['simple', 'binary', 'independent'].some((kw) => textLower.includes(kw));
        const hasComplex = ['complex', 'one at a time', 'one question'].some((kw) => textLower.includes(kw));
        if (!(hasSimple && hasComplex)) {
            issues.push(
                new Issue(
                    'warning',
                    'question_strategy_missing',
                    'Interaction guidance does not distinguish simple grouped questions from complex sequential questions',
                ),
            );
        }
    }

    const hasHandoff = ['handoff', 'model switch', 'model-switch'].some((kw) => textLower.includes(kw));
    if (hasHandoff) {
        const hasOrdering = ['last', 'after context', 'after clarification', 'after all'].some((kw) =>
            textLower.includes(kw),
        );
        if (!hasOrdering) {
            issues.push(
                new Issue(
                    'warning',
                    'handoff_order_missing',
                    'Handoff/model-switch guidance does not specify asking handoff questions AFTER context/domain questions',
                ),
            );
        }
    }

    const hasImpl = ['implement', 'component', 'ui component', 'ui framework'].some((kw) => textLower.includes(kw));
    const hasMulti = ['multiple frameworks', 'multiple systems', 'competing', 'which framework'].some((kw) =>
        textLower.includes(kw),
    );
    if (hasImpl && hasMulti) {
        const hasGuard = [
            'ask which',
            'ask before',
            'do not implement blindly',
            'analyze what exists',
            'do not pick',
            'clarif',
        ].some((kw) => textLower.includes(kw));
        if (!hasGuard) {
            issues.push(
                new Issue(
                    'warning',
                    'framework_choice_guard_missing',
                    'Discusses implementation choices but does not require clarification when multiple frameworks/patterns exist',
                ),
            );
        }
    }

    const hasExecutionGuidance = ['procedure', 'workflow', 'step 1', '### 1.'].some((kw) => textLower.includes(kw));
    if (hasExecutionGuidance) {
        const hasClarification = [
            'requirements are unclear',
            'ask clarification',
            'do not assume',
            'clarification question',
            'missing instructions',
            'incomplete',
        ].some((kw) => textLower.includes(kw));
        if (!hasClarification) {
            issues.push(
                new Issue(
                    'info',
                    'clarification_guard_missing',
                    'Contains action guidance but no explicit clarification behavior for incomplete requirements',
                ),
            );
        }
    }

    const isMeta = ['review', 'improve', 'learn', 'audit', 'optim'].some((kw) => p.toLowerCase().includes(kw));
    if (isMeta) {
        const hasLearning = [
            'learning',
            'feedback',
            'frustration',
            'capture',
            'improve the system',
            'rule / skill',
            'rule/skill',
        ].some((kw) => textLower.includes(kw));
        if (!hasLearning) {
            issues.push(
                new Issue(
                    'info',
                    'feedback_learning_missing',
                    'Meta/reviewer artifact does not mention learning from negative feedback or converting failures into system improvements',
                ),
            );
        }
    }

    return issues;
}

// --- Execution quality checks ---

const _EXEC_FILE_SIGNALS = [
    'execution',
    'debug',
    'implement',
    'developer',
    'action',
    'validation',
    'testing',
    'coder',
    'bug',
    'fix',
];

const _EXEC_CONTENT_SIGNALS = [
    'implement',
    'debug',
    'refactor',
    'modify',
    'fix',
    'verify',
    'validate',
    'runtime',
    'test',
    'coding',
    'before acting',
    'before coding',
    'before changing',
];

function _isExecutionArtifact(p: string, text: string): boolean {
    const pathLower = p.replace(/\\/g, '/').toLowerCase();
    const textLower = text.toLowerCase();

    if (
        pathLower.includes('/commands/') ||
        pathLower.includes('/guidelines/') ||
        pathLower.includes('/personas/') ||
        pathLower.includes('/user-types/')
    ) {
        return false;
    }

    if (_EXEC_FILE_SIGNALS.some((sig) => pathLower.includes(sig))) {
        return true;
    }

    const matches = _EXEC_CONTENT_SIGNALS.filter((sig) => textLower.includes(sig)).length;
    return matches >= 5;
}

function lint_execution_quality(p: string, text: string): Issue[] {
    if (!_isExecutionArtifact(p, text)) {
        return [];
    }

    const issues: Issue[] = [];
    const textLower = text.toLowerCase();
    const pathLower = p.replace(/\\/g, '/').toLowerCase();

    const isStrongMatch = _EXEC_FILE_SIGNALS.some((sig) => pathLower.includes(sig));

    const analysisSignals = [
        'analyze',
        'inspect',
        'understand',
        'read relevant',
        'review existing',
        'trace flow',
        'read affected',
        'check current',
        'before acting',
        'before coding',
        'examine',
        'study',
        'investigate',
        'check existing',
        'gather context',
        'read project',
        'read the changelog',
        'identify break',
        'assess',
        'before upgrading',
        'before changing',
        'before creating',
        'before modifying',
        'read docs',
        'read module',
        'read agents',
    ];
    const verificationSignals = [
        'verify',
        'validate',
        'test',
        'real execution',
        'run endpoint',
        'playwright',
        'curl',
        'postman',
        'debugger',
        'run tests',
        'hit the endpoint',
        'confirm',
        'assert',
        'check result',
        'observe',
        'run phpstan',
        'run rector',
        'build and verify',
        'must pass',
        'response shape',
    ];
    const verificationToolSignals = [
        'playwright',
        'curl',
        'postman',
        'xdebug',
        'browser',
        'http::fake',
        'phpstan',
        'rector',
        'phpunit',
        'pest',
        'devcontainer build',
    ];
    const debugRuntimeSignals = [
        'debugger',
        'xdebug',
        'mcp debugger',
        'runtime inspection',
        'trace execution',
        'breakpoint',
        'step through',
        'runtime',
        'stack trace',
        'dump',
        'dd(',
    ];
    const efficientToolingSignals = [
        'jq',
        ' rg ',
        'grep',
        'filter',
        'selective',
        'extract',
        'targeted',
        '--json',
        '--filter',
        'narrow',
        'scoped',
        'specific field',
        'only relevant',
    ];
    const antiBruteforceSignals = [
        'avoid retr',
        'do not brute',
        'do not guess',
        'do not retry blind',
        'analyze before retry',
        'blind retr',
        'trial-and-error',
        'trial and error',
        'max 2 retries',
        'stop and rethink',
        'diagnose',
        'root cause',
        'targeted fix',
        'do not blindly',
        'never guess',
    ];
    const clarificationSignals = [
        'ask',
        'clarif',
        'unclear',
        'missing information',
        'do not assume',
        "don't assume",
        'instead of assuming',
        'confirm with user',
        'verify requirement',
        'ambiguous',
        'if unsure',
        'when in doubt',
    ];

    const hasAny = (signals: string[]): boolean => signals.some((s) => textLower.includes(s));

    const sectionHeaders = [...text.matchAll(/^#{1,4}\s+(.+)$/gm)].map((m) => m[1] as string);
    const sectionHeadersLower = sectionHeaders.map((h) => h.toLowerCase());

    const hasAnalysisSection = sectionHeadersLower.some((h) =>
        ['understand', 'analyze', 'assess', 'context', 'review', 'current setup', 'current state', 'before'].some(
            (kw) => h.includes(kw),
        ),
    );
    const hasVerificationSection = sectionHeadersLower.some((h) =>
        ['verify', 'validat', 'test', 'acceptance', 'quality gate'].some((kw) => h.includes(kw)),
    );
    // hasAntipatternSection computed in the Python original but never used downstream.
    void sectionHeadersLower.some((h) =>
        ['do not', "don't", 'gotcha', 'anti-pattern', 'avoid'].some((kw) => h.includes(kw)),
    );

    const changeSignals = ['implement', 'modify', 'fix', 'refactor', 'change', 'update', 'code'];
    const hasChangeLanguage = changeSignals.some((s) => textLower.includes(s));

    const hasAnalysis = hasAny(analysisSignals) || hasAnalysisSection;
    const hasVerification = hasAny(verificationSignals) || hasVerificationSection;

    const isSkill = p.replace(/\\/g, '/').toLowerCase().includes('/skills/');
    if (isSkill && hasChangeLanguage && !hasAnalysis) {
        issues.push(
            new Issue(
                'error',
                'missing_analysis_before_action',
                'Execution-oriented skill encourages implementation without requiring prior analysis of existing system',
            ),
        );
    }

    if (isSkill && isStrongMatch && hasChangeLanguage && !hasVerification) {
        issues.push(
            new Issue(
                'error',
                'missing_real_verification',
                'Implementation/debugging skill does not require real verification after changes',
            ),
        );
    }

    if (isStrongMatch) {
        if (hasAny(verificationSignals) && !hasAny(verificationToolSignals)) {
            issues.push(
                new Issue(
                    'warning',
                    'missing_verification_tool_mapping',
                    'Verification is generic — does not reference concrete tools (Playwright, curl, Postman, Xdebug)',
                ),
            );
        }

        const debugContext = ['debug', 'execution flow', 'trace', 'unexpected behavior'].some((s) =>
            textLower.includes(s),
        );
        if (debugContext && !hasAny(debugRuntimeSignals)) {
            issues.push(
                new Issue(
                    'warning',
                    'missing_runtime_debug_guidance',
                    'Debugging/execution artifact does not mention runtime debug tools (Xdebug, debugger, breakpoints)',
                ),
            );
        }

        const dataContext = ['api', 'log', 'json', 'response', 'output', 'data'].some((s) => textLower.includes(s));
        if (dataContext && !hasAny(efficientToolingSignals)) {
            issues.push(
                new Issue(
                    'warning',
                    'missing_efficient_tooling_guidance',
                    'Artifact does not encourage targeted filtering tools (jq, rg, grep) for reducing output',
                ),
            );
        }

        if (isSkill && hasChangeLanguage && !hasAny(antiBruteforceSignals)) {
            issues.push(
                new Issue(
                    'warning',
                    'missing_anti_bruteforce_guidance',
                    'Execution guidance lacks explicit anti-retry / anti-bruteforce behavior',
                ),
            );
        }

        if (isSkill && hasChangeLanguage && !hasAny(clarificationSignals)) {
            issues.push(
                new Issue(
                    'warning',
                    'missing_clarification_guard',
                    'Implementation guidance does not require clarification when requirements are incomplete',
                ),
            );
        }
    }

    return issues;
}

// --- Type boundary checks ---

function lint_type_boundaries(p: string, text: string, artifactType: string): Issue[] {
    const issues: Issue[] = [];

    if (artifactType === 'guideline') {
        const numberedSteps = [
            ...text.matchAll(/^\d+\.\s+\*?\*?(?:Step|Run|Create|Execute|Implement)/gim),
        ];
        if (numberedSteps.length >= 5) {
            issues.push(
                new Issue(
                    'warning',
                    'guideline_contains_executable_procedure',
                    `Guideline has ${numberedSteps.length} executable numbered steps — consider extracting into a skill or command`,
                ),
            );
        }
    }

    if (artifactType === 'command') {
        const frontmatter = extract_frontmatter(text);
        let hasSkillsField = false;
        let isOrchestrator = false;
        if (frontmatter) {
            const skillsMatch = /skills:\s*\[(.+)\]/.exec(frontmatter);
            hasSkillsField = Boolean(skillsMatch && (skillsMatch[1] as string).trim());
            const typeMatch = /^type:\s*['"]?orchestrator['"]?\s*$/m.exec(frontmatter);
            isOrchestrator = Boolean(typeMatch);
        }

        const hasSkillRef = /skill|SKILL\.md/.test(text);

        if (!hasSkillsField && !hasSkillRef && !isOrchestrator) {
            issues.push(
                new Issue(
                    'warning',
                    'command_missing_skill_references',
                    'Command does not reference any skills — commands should orchestrate skills, not contain domain logic (use `type: orchestrator` in frontmatter to exempt routers)',
                ),
            );
        }
    }

    if (artifactType === 'skill') {
        const validationSection =
            /(?:^#{1,4}\s+(?:Validat|Verif|Quality|Accept).+?\n)((?:.*\n)*?)(?=^#{1,4}\s|$(?![\s\S]))/im.exec(text);
        if (validationSection) {
            const validationText = (validationSection[1] as string).toLowerCase();
            const vaguePatterns = [
                'check if it works',
                "make sure it's correct",
                'verify it works',
                'should work',
                'looks correct',
            ];
            const concretePatterns = [
                'run ',
                'curl ',
                'phpstan',
                'rector',
                'pest',
                'playwright',
                'assert',
                'exit code',
                'must pass',
                '0 fail',
                '0 error',
            ];
            const hasVague = vaguePatterns.some((vp) => validationText.includes(vp));
            const hasConcrete = concretePatterns.some((cp) => validationText.includes(cp));
            if (hasVague && !hasConcrete) {
                issues.push(
                    new Issue(
                        'warning',
                        'skill_validation_too_generic',
                        'Validation section uses vague language — add concrete checks (commands, expected output, conditions)',
                    ),
                );
            }
        }
    }

    return issues;
}

// --- Verification maturity checks ---

const _TASK_TYPE_SIGNALS: Record<string, string[]> = {
    backend: [
        'api',
        'endpoint',
        'controller',
        'route',
        'service',
        'repository',
        'eloquent',
        'migration',
        'artisan',
        'middleware',
        'job',
        'queue',
    ],
    frontend: ['blade', 'livewire', 'component', 'view', 'ui', 'frontend', 'tailwind', 'flux', 'css', 'template'],
    cli: ['artisan command', 'cli', 'console', 'schedule', 'cron'],
    database: ['migration', 'database', 'schema', 'index', 'query', 'sql', 'mariadb', 'mysql', 'seeder'],
    debugging: ['debug', 'xdebug', 'error', 'exception', 'sentry', 'trace', 'breakpoint', 'log'],
};

const _VERIFICATION_TOOLS: Record<string, string[]> = {
    backend: ['curl', 'postman', 'http::fake', 'actingas', 'api/'],
    frontend: ['playwright', 'browser', 'screenshot', 'snapshot', 'livewire test'],
    cli: ['exit code', 'command output', 'artisan test', 'expectsoutput'],
    database: ['query', 'assertdatabase', 'migration', 'seedandassert', 'table'],
    debugging: ['xdebug', 'breakpoint', 'dump', 'dd(', 'stack trace', 'log'],
};

function lint_verification_maturity(p: string, text: string, artifactType: string): Issue[] {
    if (artifactType !== 'skill') {
        return [];
    }

    const pathLower = p.replace(/\\/g, '/').toLowerCase();
    if (!_EXEC_FILE_SIGNALS.some((sig) => pathLower.includes(sig))) {
        return [];
    }

    const issues: Issue[] = [];
    const textLower = text.toLowerCase();

    const detectedTypes: string[] = [];
    for (const [taskType, signals] of Object.entries(_TASK_TYPE_SIGNALS)) {
        const matches = signals.filter((s) => textLower.includes(s)).length;
        if (matches >= 2) {
            detectedTypes.push(taskType);
        }
    }

    if (detectedTypes.length === 0) {
        return [];
    }

    for (const taskType of detectedTypes) {
        const tools = _VERIFICATION_TOOLS[taskType] ?? [];
        const hasTool = tools.some((t) => textLower.includes(t));
        if (!hasTool) {
            issues.push(
                new Issue(
                    'warning',
                    `missing_${taskType}_verification_example`,
                    `Skill covers ${taskType} tasks but does not mention verification tools for that context (e.g. ${tools.slice(0, 3).join(', ')})`,
                ),
            );
        }
    }

    return issues;
}

// --- Frugality validator helpers + Layers 1 & 2 ---

function _headingToSlug(heading: string): string {
    let s = heading.trim().toLowerCase();
    s = s.replace(/[^a-z0-9 \-]/g, '');
    s = s.replace(/ /g, '-');
    return s.replace(/^-+|-+$/g, '');
}

function _extractHeadingSlugs(text: string): Set<string> {
    const slugs = new Set<string>();
    for (const line of splitlines(text)) {
        if (line.startsWith('## ') || line.startsWith('### ')) {
            const heading = line.split(' ').slice(1).join(' ').trim();
            slugs.add(_headingToSlug(heading));
        }
    }
    return slugs;
}

function _skillIdFromPath(p: string): string | null {
    if (basename(p).toLowerCase() !== 'skill.md') {
        return null;
    }
    return parentName(p);
}

function _isFrugalityCharter(p: string): boolean {
    const norm = p.replace(/\\/g, '/');
    return norm.endsWith(`/${FRUGALITY_CHARTER_RELPATH}`);
}

const _FRUGALITY_STANDARDS_PATTERN = /^##\s+Frugality Standards\s*$/m;
const _FRUGALITY_CHARTER_LINK_PATTERN = /\]\([^)]*frugality-charter\.md[^)]*\)/;

function lint_frugality_writer_cite(p: string, text: string, artifactType: string): Issue[] {
    if (artifactType !== 'skill') {
        return [];
    }
    const skillId = _skillIdFromPath(p);
    if (skillId === null || !FRUGALITY_WRITER_SKILLS.has(skillId)) {
        return [];
    }
    const issues: Issue[] = [];
    const sectionMatch = _FRUGALITY_STANDARDS_PATTERN.exec(text);
    if (!sectionMatch) {
        issues.push(
            new Issue(
                'error',
                'frugality_section_missing',
                'Writer skill must carry a `## Frugality Standards` section (road-to-token-frugality Phase 0.4 Layer 1)',
            ),
        );
        return issues;
    }
    const bodyStart = (sectionMatch.index ?? 0) + sectionMatch[0].length;
    const rest = text.slice(bodyStart);
    const nextH2 = /^##\s+/m.exec(rest);
    const bodyEnd = nextH2 ? bodyStart + (nextH2.index ?? 0) : text.length;
    const body = text.slice(bodyStart, bodyEnd);
    if (!_FRUGALITY_CHARTER_LINK_PATTERN.test(body)) {
        issues.push(
            new Issue(
                'error',
                'frugality_charter_cite_missing',
                '`## Frugality Standards` section must link to `frugality-charter.md` (road-to-token-frugality Phase 0.4 Layer 1)',
            ),
        );
    }
    return issues;
}

const _MD_LINK_PATTERN = /\[[^\]]+\]\(([^)#]+)(?:#([^)]+))?\)/g;

function lint_frugality_charter_index(p: string, text: string): Issue[] {
    if (!_isFrugalityCharter(p)) {
        return [];
    }
    const issues: Issue[] = [];
    const rulesDir = path.join(path.dirname(path.dirname(path.dirname(p))), 'rules');
    const ruleSlugsCache = new Map<string, Set<string>>();
    const canonicalSatisfied = new Set<string>();
    for (const linkMatch of text.matchAll(_MD_LINK_PATTERN)) {
        const linkPath = linkMatch[1] as string;
        const linkAnchor = linkMatch[2] as string | undefined;
        const ruleName = basename(linkPath);
        if (!(ruleName in FRUGALITY_CHARTER_INDEX_RULES)) {
            continue;
        }
        if (linkAnchor === undefined) {
            continue;
        }
        const anchorLc = linkAnchor.toLowerCase();
        const requiredSubstr = FRUGALITY_CHARTER_INDEX_RULES[ruleName] as string;
        if (anchorLc.includes(requiredSubstr)) {
            canonicalSatisfied.add(ruleName);
        }
        if (!ruleSlugsCache.has(ruleName)) {
            const ruleFile = path.join(rulesDir, ruleName);
            if (!exists(ruleFile)) {
                issues.push(
                    new Issue(
                        'error',
                        'frugality_charter_rule_missing',
                        `Charter cites ${ruleName} but the rule file does not exist at ${ruleFile}`,
                    ),
                );
                ruleSlugsCache.set(ruleName, new Set());
                continue;
            }
            let ruleText: string;
            try {
                ruleText = readText(ruleFile);
            } catch (e) {
                issues.push(
                    new Issue('error', 'frugality_charter_rule_unreadable', `Cannot read ${ruleName}: ${pyExcStr(e)}`),
                );
                ruleSlugsCache.set(ruleName, new Set());
                continue;
            }
            ruleSlugsCache.set(ruleName, _extractHeadingSlugs(ruleText));
        }
        if (!(ruleSlugsCache.get(ruleName) as Set<string>).has(anchorLc)) {
            issues.push(
                new Issue(
                    'error',
                    'frugality_charter_anchor_unresolved',
                    `Charter cites ${ruleName}#${linkAnchor} but no H2/H3 heading with that slug exists in the rule file`,
                ),
            );
        }
    }
    const missing = Object.keys(FRUGALITY_CHARTER_INDEX_RULES).filter((r) => !canonicalSatisfied.has(r));
    for (const ruleName of missing.sort()) {
        const requiredSubstr = FRUGALITY_CHARTER_INDEX_RULES[ruleName] as string;
        issues.push(
            new Issue(
                'error',
                'frugality_charter_canonical_missing',
                `Charter index lacks a canonical citation of ${ruleName} with anchor containing '${requiredSubstr}' (road-to-token-frugality Phase 0.4 Layer 2)`,
            ),
        );
    }
    return issues;
}

// --- Governance & packaging checks ---

function lint_governance(p: string, _text: string, artifactType: string, repoRoot: string | null): Issue[] {
    const issues: Issue[] = [];
    if (repoRoot === null) {
        return issues;
    }

    const pathStr = p;
    const isCondensed = pathStr.includes('/dist/agent-src/') && !pathStr.includes('/.agent-src.uncondensed/');
    const isUncondensed = pathStr.includes('/.agent-src.uncondensed/');

    if (!isCondensed && !isUncondensed) {
        return issues;
    }

    const norm = pathStr.replace(/\\/g, '/');
    if (isUncondensed) {
        let logical = stripSourcePrefix(norm);
        if (logical === null) {
            const marker = '/.agent-src.uncondensed/';
            const idx = norm.lastIndexOf(marker);
            logical = idx !== -1 ? norm.slice(idx + marker.length) : null;
        }
        if (logical) {
            const condensedPath = path.join(repoRoot, 'dist/agent-src', logical);
            if (!exists(condensedPath)) {
                issues.push(
                    new Issue(
                        'warning',
                        'condensed_variant_missing',
                        `Uncondensed file exists but condensed variant missing: ${basename(condensedPath)}`,
                    ),
                );
            }
        }
    } else if (isCondensed) {
        const marker = '/dist/agent-src/';
        const idx = norm.lastIndexOf(marker);
        const logical = idx !== -1 ? norm.slice(idx + marker.length) : null;
        if (logical) {
            const uncondensedPath = resolve_logical(logical);
            if (uncondensedPath === null || !exists(uncondensedPath)) {
                issues.push(
                    new Issue(
                        'warning',
                        'uncondensed_variant_missing',
                        `Condensed file exists but uncondensed source missing: ${basename(logical)}`,
                    ),
                );
            }
        }
    }

    const locationMap: Record<string, string> = {
        skill: '/skills/',
        rule: '/rules/',
        command: '/commands/',
        guideline: '/guidelines/',
    };
    const expectedLoc = locationMap[artifactType];
    if (expectedLoc && !pathStr.includes(expectedLoc)) {
        issues.push(
            new Issue(
                'warning',
                'invalid_location_for_type',
                `Artifact detected as '${artifactType}' but not in expected location (${expectedLoc})`,
            ),
        );
    }

    return issues;
}

// --- Structural malice check ---

const _MALICE_CRED_EXFIL =
    /\b(?:curl|wget)\b[^\n]*(?:\$\{?[A-Z_]*(?:TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL|API)[A-Z_]*\}?|~\/\.(?:aws|ssh)\/)/;
const _MALICE_REMOTE_EXEC =
    /(?:\b(?:eval|exec)\s*\([^)]*(?:curl|wget|requests\.get|urllib)|\b(?:bash|sh|zsh)\s*<\s*\(\s*(?:curl|wget))/;
const _MALICE_FORCE_PUSH =
    /\bgit\s+push\b[^\n]*--force(?:-with-lease)?\b[^\n]*\b(?:main|master|prod|production|release)\b/;
const _MALICE_CHMOD_SECRETS = /\bchmod\s+0?[4567]\d{2}\s+[^\n]*\.(?:pem|key|env)\b/;
const _MALICE_SHELL_INJECT = /\bsubprocess\.[A-Za-z_]+\s*\([^)]*shell\s*=\s*True[^)]*\$\{/;

const _MALICE_PATTERNS: Array<[string, RegExp]> = [
    ['cred_exfil', _MALICE_CRED_EXFIL],
    ['remote_exec', _MALICE_REMOTE_EXEC],
    ['force_push_protected', _MALICE_FORCE_PUSH],
    ['chmod_secrets', _MALICE_CHMOD_SECRETS],
    ['shell_injection', _MALICE_SHELL_INJECT],
];

export function check_structural_malice(text: string): Issue[] {
    const issues: Issue[] = [];
    const lines = splitlines(text);
    lines.forEach((raw, idx) => {
        const lineno = idx + 1;
        for (const [name, pattern] of _MALICE_PATTERNS) {
            const match = pattern.exec(raw);
            if (match) {
                issues.push(new Issue('error', `malice:${name}`, `${lineno}:${match[0].trim()}`));
            }
        }
    });
    return issues;
}

// --- Output-schema check ---

const _OUTPUT_SCHEMA_KEY_PATTERN = /^(\w+):\s*(.*?)\s*$/;

export function parse_output_schema(text: string): Record<string, string | number | string[]> {
    const result: Record<string, string | number | string[]> = {};
    let currentList: string | null = null;
    for (const raw of splitlines(text)) {
        const stripped = raw.trim();
        if (!stripped || stripped.startsWith('#')) {
            continue;
        }
        if (stripped.startsWith('- ')) {
            if (currentList === null) {
                continue;
            }
            const value = stripQuotes(stripped.slice(2).trim());
            (result[currentList] as string[]).push(value);
            continue;
        }
        const match = _OUTPUT_SCHEMA_KEY_PATTERN.exec(stripped);
        if (!match) {
            continue;
        }
        const key = match[1] as string;
        const value = stripQuotes((match[2] as string).trim());
        if (value === '') {
            result[key] = [];
            currentList = key;
        } else {
            currentList = null;
            if (/^-?[0-9]+$/.test(value)) {
                result[key] = Number.parseInt(value, 10);
            } else {
                result[key] = value;
            }
        }
    }
    return result;
}

function load_output_schema(skillPath: string): Record<string, string | number | string[]> | null {
    if (basename(skillPath) !== 'SKILL.md') {
        return null;
    }
    const schemaPath = path.join(path.dirname(skillPath), 'evals', 'output-schema.yml');
    if (!exists(schemaPath)) {
        return null;
    }
    try {
        return parse_output_schema(readText(schemaPath));
    } catch {
        return null;
    }
}

export function lint_output_schema(p: string, text: string): Issue[] {
    const schema = load_output_schema(p);
    if (schema === null) {
        return [];
    }
    const required = schema.required_headers ?? [];
    if (!Array.isArray(required) || required.length === 0) {
        return [];
    }
    const issues: Issue[] = [];
    for (const header of required) {
        if (typeof header !== 'string' || header.trim() === '') {
            continue;
        }
        const pattern = new RegExp(`^##\\s+${escapeRegex(header.trim())}\\s*$`, 'm');
        if (!pattern.test(text)) {
            issues.push(
                new Issue(
                    'error',
                    'output_schema_drift',
                    `Output template is missing required header \`## ${header}\` (declared in evals/output-schema.yml)`,
                ),
            );
        }
    }
    return issues;
}

const _SCHEMA_ARTEFACT_TYPES = new Set(['skill', 'rule', 'command', 'persona', 'user-type']);

function lint_frontmatter_schema(p: string, text: string, artifactType: string): Issue[] {
    if (!_SCHEMA_ARTEFACT_TYPES.has(artifactType)) {
        return [];
    }
    let schema: Record<string, YamlValue>;
    try {
        schema = load_schema(artifactType);
    } catch (e) {
        if ((e as { code?: string }).code === 'ENOENT') {
            return [];
        }
        throw e;
    }

    const [data] = parse_frontmatter_for_schema(text);
    if (data === null) {
        return [];
    }

    apply_schema_defaults(data, schema);

    const issues: Issue[] = [];
    for (const error of validate_against_schema(data, schema)) {
        const code = `schema_${error.rule}`;
        const message = `${error.path} – ${error.message}`;
        issues.push(new Issue('error', code, message));
    }
    return issues;
}

export function lint_file(p: string, repoRoot: string | null = null): LintResult {
    if (basename(p).toLowerCase() === 'readme.md') {
        return new LintResult(p, 'unknown', 'pass', [], []);
    }
    const text = readText(p);
    const artifactType = detect_artifact_type(p, text);
    let displayPath = p;
    if (repoRoot) {
        if (isUnder(p, repoRoot) || path.resolve(p) === path.resolve(repoRoot)) {
            displayPath = relPosixNative(p, repoRoot);
        }
    }

    let result: LintResult;
    if (artifactType === 'skill') {
        result = lint_skill(displayPath, text);
    } else if (artifactType === 'rule') {
        result = lint_rule(displayPath, text);
    } else if (artifactType === 'command') {
        result = lint_command(displayPath, text);
    } else if (artifactType === 'guideline') {
        result = lint_guideline(displayPath, text);
    } else if (artifactType === 'persona') {
        result = lint_persona(displayPath, text);
    } else if (artifactType === 'user-type') {
        result = lint_usertype(displayPath, text);
    } else {
        if (_isFrugalityCharter(p)) {
            const charterIssues = lint_frugality_charter_index(p, text);
            return new LintResult(displayPath, 'unknown', classify_status(charterIssues), charterIssues, []);
        }
        return lint_unknown(displayPath);
    }

    const schemaIssues = lint_frontmatter_schema(displayPath, text, artifactType);
    if (schemaIssues.length > 0) {
        result.issues.push(...schemaIssues);
        result.status = classify_status(result.issues);
    }

    const interactionIssues = lint_interaction_quality(displayPath, text);
    if (interactionIssues.length > 0) {
        result.issues.push(...interactionIssues);
        result.status = classify_status(result.issues);
    }

    const executionIssues = lint_execution_quality(displayPath, text);
    if (executionIssues.length > 0) {
        result.issues.push(...executionIssues);
        result.status = classify_status(result.issues);
    }

    const boundaryIssues = lint_type_boundaries(displayPath, text, artifactType);
    if (boundaryIssues.length > 0) {
        result.issues.push(...boundaryIssues);
        result.status = classify_status(result.issues);
    }

    const maturityIssues = lint_verification_maturity(displayPath, text, artifactType);
    if (maturityIssues.length > 0) {
        result.issues.push(...maturityIssues);
        result.status = classify_status(result.issues);
    }

    const governanceIssues = lint_governance(p, text, artifactType, repoRoot);
    if (governanceIssues.length > 0) {
        result.issues.push(...governanceIssues);
        result.status = classify_status(result.issues);
    }

    if (artifactType === 'skill') {
        const outputSchemaIssues = lint_output_schema(p, text);
        if (outputSchemaIssues.length > 0) {
            result.issues.push(...outputSchemaIssues);
            result.status = classify_status(result.issues);
        }
    }

    if (artifactType === 'skill' || artifactType === 'rule' || artifactType === 'command') {
        const maliceIssues = check_structural_malice(text);
        if (maliceIssues.length > 0) {
            result.issues.push(...maliceIssues);
            result.status = classify_status(result.issues);
        }
    }

    const frugalityIssues = lint_frugality_writer_cite(displayPath, text, artifactType);
    if (frugalityIssues.length > 0) {
        result.issues.push(...frugalityIssues);
        result.status = classify_status(result.issues);
    }

    return result;
}

// --- Output formatting ---

export function format_text(results: LintResult[], quiet = false): string {
    const lines: string[] = [];
    let maliceTotal = 0;
    for (const result of results) {
        for (const issue of result.issues) {
            if (issue.code.startsWith('malice:')) {
                const patternName = issue.code.split(':').slice(1).join(':');
                const idx = issue.message.indexOf(':');
                const lineno = idx === -1 ? issue.message : issue.message.slice(0, idx);
                const matched = idx === -1 ? '' : issue.message.slice(idx + 1);
                lines.push(`${result.file}:${lineno}:malice:${patternName}:${matched}`);
                maliceTotal += 1;
            }
        }
    }
    if (maliceTotal) {
        lines.push('');
    }

    for (const result of results) {
        if (quiet && result.status === 'pass' && result.issues.length === 0 && result.suggestions.length === 0) {
            continue;
        }
        const badge = { pass: '[PASS]', pass_with_warnings: '[WARN]', fail: '[FAIL]' }[result.status];
        lines.push(`${badge} ${result.file} (${result.artifact_type})`);
        if (result.issues.length > 0) {
            for (const issue of result.issues) {
                lines.push(`  - ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);
            }
        } else {
            lines.push('  - No issues found');
        }
        if (result.suggestions.length > 0) {
            lines.push('  Suggested fixes:');
            for (const suggestion of result.suggestions) {
                lines.push(`    - ${suggestion}`);
            }
        }
        lines.push('');
    }

    const total = results.length;
    const fails = results.filter((r) => r.status === 'fail').length;
    const warns = results.filter((r) => r.status === 'pass_with_warnings').length;
    const passes = results.filter((r) => r.status === 'pass').length;
    const suffix = maliceTotal ? `, ${maliceTotal} malice` : '';
    lines.push(`Summary: ${passes} pass, ${warns} warn, ${fails} fail, ${total} total${suffix}`);
    return lines.join('\n');
}

export function format_json(results: LintResult[]): string {
    const payload = {
        summary: {
            pass: results.filter((r) => r.status === 'pass').length,
            pass_with_warnings: results.filter((r) => r.status === 'pass_with_warnings').length,
            fail: results.filter((r) => r.status === 'fail').length,
            total: results.length,
        },
        results: results.map((r) => ({
            file: r.file,
            artifact_type: r.artifact_type,
            status: r.status,
            issues: r.issues.map((issue) => ({
                severity: issue.severity,
                code: issue.code,
                message: issue.message,
            })),
            suggestions: r.suggestions,
        })),
    };
    return jsonIndent2(payload);
}

export function check_condensation_pairs(root: string): LintResult[] {
    const results: LintResult[] = [];

    const pairs: Array<[string, string, boolean]> = [
        ['skills', 'SKILL.md', true],
        ['rules', '*.md', false],
        ['commands', '*.md', false],
    ];

    for (const [subdir, pattern, isNested] of pairs) {
        const condensedDir = path.join(root, 'dist/agent-src', subdir);
        const uncondensedNames = new Set<string>();
        let anySource = false;
        for (const srcRoot of artefact_roots()) {
            const uncondensedDir = path.join(srcRoot, subdir);
            if (!exists(uncondensedDir)) {
                continue;
            }
            anySource = true;
            if (isNested) {
                for (const d of iterdir(uncondensedDir)) {
                    if (isDir(d) && exists(path.join(d, pattern))) {
                        uncondensedNames.add(basename(d));
                    }
                }
            } else {
                for (const f of glob(uncondensedDir, (b) => b.endsWith('.md'))) {
                    if (isFile(f)) {
                        uncondensedNames.add(basename(f));
                    }
                }
            }
        }

        if (!anySource) {
            continue;
        }

        let condensedNames = new Set<string>();
        if (exists(condensedDir)) {
            if (isNested) {
                for (const d of iterdir(condensedDir)) {
                    if (isDir(d) && exists(path.join(d, pattern))) {
                        condensedNames.add(basename(d));
                    }
                }
            } else {
                for (const f of glob(condensedDir, (b) => b.endsWith('.md'))) {
                    if (isFile(f)) {
                        condensedNames.add(basename(f));
                    }
                }
            }
        }

        for (const name of [...uncondensedNames].filter((n) => !condensedNames.has(n)).sort()) {
            const pathStr = isNested
                ? `dist/agent-src/${subdir}/${name}/${pattern}`
                : `dist/agent-src/${subdir}/${name}`;
            results.push(
                new LintResult(
                    pathStr,
                    rstripS(subdir) as ArtifactType,
                    'fail',
                    [new Issue('error', 'missing_condensed', 'Uncondensed exists but condensed version is missing')],
                    [`Run /condense to generate dist/agent-src/${subdir}/${name}`],
                ),
            );
        }

        for (const name of [...condensedNames].filter((n) => !uncondensedNames.has(n)).sort()) {
            const pathStr = isNested
                ? `dist/agent-src/${subdir}/${name}/${pattern}`
                : `dist/agent-src/${subdir}/${name}`;
            results.push(
                new LintResult(
                    pathStr,
                    rstripS(subdir) as ArtifactType,
                    'fail',
                    [new Issue('error', 'orphaned_condensed', 'Condensed exists but uncondensed source is missing')],
                    ['Delete orphaned file or restore uncondensed source'],
                ),
            );
        }
    }

    return results;
}

export function check_condensation_quality(root: string): LintResult[] {
    const results: LintResult[] = [];
    const condensedDir = path.join(root, 'dist/agent-src', 'skills');
    if (!exists(condensedDir)) {
        return results;
    }

    const skillSources: string[] = [];
    for (const srcRoot of artefact_roots()) {
        const uncondensedDir = path.join(srcRoot, 'skills');
        if (exists(uncondensedDir)) {
            skillSources.push(...iterdir(uncondensedDir).sort());
        }
    }
    if (skillSources.length === 0) {
        return results;
    }

    const preservedSections = ['When to use', 'Procedure', 'Gotcha', 'Gotchas', 'Do NOT', 'Output format', 'Output'];

    for (const skillDir of skillSources) {
        const src = path.join(skillDir, 'SKILL.md');
        const dst = path.join(condensedDir, basename(skillDir), 'SKILL.md');
        if (!exists(src) || !exists(dst)) {
            continue;
        }

        const srcText = readText(src);
        const dstText = readText(dst);
        const srcSections = extract_sections(srcText);
        const dstSections = extract_sections(dstText);

        const issues: Issue[] = [];
        const suggestions: string[] = [];

        for (const section of preservedSections) {
            if (sectionMatches(section, srcSections) && !sectionMatches(section, dstSections)) {
                issues.push(new Issue('warning', 'condensation_lost_section', `Condensed version lost '${section}' section`));
            }
        }

        const srcProc = findProcedureBlock(srcText) || '';
        const dstProc = findProcedureBlock(dstText) || '';
        const validationPatterns = [/\bverif/i, /\bcheck\b/i, /\bconfirm\b/i, /\bvalidat/i, /\binspect/i];
        const srcHasValidation = validationPatterns.some((p) => p.test(srcProc));
        const dstHasValidation = validationPatterns.some((p) => p.test(dstProc));
        if (srcHasValidation && !dstHasValidation) {
            issues.push(
                new Issue(
                    'warning',
                    'condensation_lost_validation',
                    'Condensed procedure lost validation keywords present in uncondensed',
                ),
            );
        }

        const srcCodeBlocks = countMatches(/```/g, srcText);
        const dstCodeBlocks = countMatches(/```/g, dstText);
        if (srcCodeBlocks > 0 && dstCodeBlocks < Math.floor(srcCodeBlocks / 2)) {
            issues.push(
                new Issue(
                    'warning',
                    'condensation_lost_example',
                    `Condensed version has fewer code blocks (${Math.floor(dstCodeBlocks / 2)} vs ${Math.floor(srcCodeBlocks / 2)} in source)`,
                ),
            );
        }

        const srcDonot = countMatches(/(?:Do NOT|NEVER|MUST NOT)\b/g, srcText);
        const dstDonot = countMatches(/(?:Do NOT|NEVER|MUST NOT)\b/g, dstText);
        if (srcDonot > 0 && dstDonot < Math.floor(srcDonot / 2)) {
            issues.push(
                new Issue(
                    'warning',
                    'condensation_lost_antipattern',
                    `Condensed version lost anti-pattern constraints (${dstDonot} vs ${srcDonot} in source)`,
                ),
            );
        }

        if (issues.length > 0) {
            const relPath = `dist/agent-src/skills/${basename(skillDir)}/SKILL.md`;
            results.push(
                new LintResult(
                    relPath,
                    'skill',
                    'pass_with_warnings',
                    issues,
                    suggestions.length > 0 ? suggestions : ['Re-condense to preserve lost content'],
                ),
            );
        }
    }

    return results;
}

export function check_duplication(root: string): LintResult[] {
    void root;
    const results: LintResult[] = [];
    const skillDirs: string[] = [];
    const seen = new Set<string>();
    for (const srcRoot of artefact_roots()) {
        const sd = path.join(srcRoot, 'skills');
        if (!exists(sd)) {
            continue;
        }
        for (const d of iterdir(sd).sort()) {
            if (isDir(d) && !seen.has(basename(d))) {
                seen.add(basename(d));
                skillDirs.push(d);
            }
        }
    }
    if (skillDirs.length === 0) {
        return results;
    }

    const skillData: Array<[string, string, string]> = [];
    for (const skillDir of skillDirs) {
        const skillFile = path.join(skillDir, 'SKILL.md');
        if (!exists(skillFile)) {
            continue;
        }
        const text = readText(skillFile);
        const desc = extract_description(text) || '';
        skillData.push([basename(skillDir), desc.toLowerCase(), skillFile]);
    }

    for (let i = 0; i < skillData.length; i += 1) {
        const [nameA, descA] = skillData[i] as [string, string, string];
        for (let j = i + 1; j < skillData.length; j += 1) {
            const [nameB, descB] = skillData[j] as [string, string, string];
            if (nameA === nameB) {
                continue;
            }
            if (descA && descB) {
                const wordsA = new Set(descA.split(/\s+/).filter((w) => w !== ''));
                const wordsB = new Set(descB.split(/\s+/).filter((w) => w !== ''));
                if (wordsA.size > 3 && wordsB.size > 3) {
                    let inter = 0;
                    for (const w of wordsA) {
                        if (wordsB.has(w)) {
                            inter += 1;
                        }
                    }
                    const overlap = inter / Math.min(wordsA.size, wordsB.size);
                    if (overlap > 0.7) {
                        const relA = `.agent-src.uncondensed/skills/${nameA}/SKILL.md`;
                        results.push(
                            new LintResult(
                                relA,
                                'skill',
                                'pass_with_warnings',
                                [
                                    new Issue(
                                        'warning',
                                        'similar_description',
                                        `Description highly similar to '${nameB}' (${pyPercent(overlap)} word overlap)`,
                                    ),
                                ],
                                [`Consider merging with '${nameB}' or differentiating descriptions`],
                            ),
                        );
                    }
                }
            }
        }
    }

    return results;
}

export function compute_exit_code(results: LintResult[], strictWarnings: boolean): number {
    for (const r of results) {
        if (r.issues.some((issue) => issue.code.startsWith('malice:'))) {
            return 3;
        }
    }
    if (results.some((r) => r.status === 'fail')) {
        return 2;
    }
    if (results.some((r) => r.status === 'pass_with_warnings') && strictWarnings) {
        return 1;
    }
    return 0;
}

export function format_report(results: LintResult[]): string {
    const lines = ['# Quality Report', ''];

    const byType = new Map<string, LintResult[]>();
    for (const r of results) {
        const arr = byType.get(r.artifact_type) ?? [];
        arr.push(r);
        byType.set(r.artifact_type, arr);
    }

    lines.push('| Type | Total | Pass | Warn | Fail | Score |');
    lines.push('|---|---|---|---|---|---|');
    let totalScore = 0.0;
    let totalCount = 0;
    for (const atype of [...byType.keys()].sort()) {
        const items = byType.get(atype) as LintResult[];
        const n = items.length;
        const nPass = items.filter((r) => r.status === 'pass').length;
        const nWarn = items.filter((r) => (r.status as string) === 'warn' || r.status === 'pass_with_warnings').length;
        const nFail = items.filter((r) => r.status === 'fail').length;
        const typeScore = (nPass * 10 + nWarn * 8 + nFail * 3) / Math.max(n, 1);
        totalScore += typeScore * n;
        totalCount += n;
        lines.push(`| ${atype} | ${n} | ${nPass} | ${nWarn} | ${nFail} | ${typeScore.toFixed(1)}/10 |`);
    }
    const overall = totalScore / Math.max(totalCount, 1);
    lines.push(`| **TOTAL** | **${totalCount}** | | | | **${overall.toFixed(1)}/10** |`);

    const issueCounts = new Map<string, number>();
    for (const r of results) {
        for (const i of r.issues) {
            issueCounts.set(i.code, (issueCounts.get(i.code) ?? 0) + 1);
        }
    }
    if (issueCounts.size > 0) {
        lines.push('', '## Top Issues', '');
        lines.push('| Issue | Count | Severity |');
        lines.push('|---|---|---|');
        const sorted = [...issueCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
        for (const [code, count] of sorted) {
            let sev = '?';
            for (const r of results) {
                for (const i of r.issues) {
                    if (i.code === code) {
                        sev = i.severity;
                        break;
                    }
                }
                if (sev !== '?') {
                    break;
                }
            }
            lines.push(`| \`${code}\` | ${count} | ${sev} |`);
        }
    }

    const filesWithIssues = results.filter((r) => r.issues.length > 0).map((r) => [r.file, r.issues.length, r.status] as [string, number, string]);
    filesWithIssues.sort((a, b) => b[1] - a[1]);
    if (filesWithIssues.length > 0) {
        lines.push('', '## Files with Most Issues (Top 10)', '');
        lines.push('| File | Issues | Status |');
        lines.push('|---|---|---|');
        for (const [fpath, count, status] of filesWithIssues.slice(0, 10)) {
            const short = fpath.replace('.agent-src.uncondensed/', '');
            lines.push(`| \`${short}\` | ${count} | ${status} |`);
        }
    }

    const skillResults = results.filter((r) => r.artifact_type === 'skill' && !r.file.includes('/pair-check/'));
    if (skillResults.length > 0) {
        lines.push('', '## Per-File Quality (Skills)', '');
        lines.push('| Skill | Structure | Validation | Scope | Dependency | Lines |');
        lines.push('|---|---|---|---|---|---|');
        for (const r of [...skillResults].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))) {
            const short = r.file
                .replace('.agent-src.uncondensed/skills/', '')
                .replace('dist/agent-src/skills/', '')
                .replace('/SKILL.md', '');
            const codes = new Set(r.issues.map((i) => i.code));

            const struct = setIntersects(codes, ['missing_section', 'empty_procedure', 'unordered_procedure'])
                ? '❌'
                : '✅';

            let valid: string;
            if (setIntersects(codes, ['missing_validation', 'vague_validation'])) {
                valid = '❌ weak';
            } else if (codes.has('missing_inspect_step')) {
                valid = '⚠️ partial';
            } else {
                valid = '✅ strong';
            }

            const scope = codes.has('broad_scope') ? '⚠️ broad' : '✅ focused';

            let dep: string;
            if (codes.has('guideline_dependent_skill')) {
                dep = '❌ high';
            } else if (codes.has('pointer_only_skill')) {
                dep = '⚠️ medium';
            } else {
                dep = '✅ low';
            }

            let totalLines = 0;
            try {
                totalLines = countChar(readText(r.file), '\n');
            } catch {
                // OSError → leave 0
            }

            lines.push(`| \`${short}\` | ${struct} | ${valid} | ${scope} | ${dep} | ${totalLines} |`);
        }
    }

    return lines.join('\n');
}

// --- arg parsing + main ---

interface Args {
    paths: string[];
    all: boolean;
    changed: boolean;
    format: 'text' | 'json';
    pairs: boolean;
    duplicates: boolean;
    condensationQuality: boolean;
    strictWarnings: boolean;
    report: boolean;
    repoRoot: string;
    quiet: boolean;
}

export function parse_args(argv: string[]): Args {
    const args: Args = {
        paths: [],
        all: false,
        changed: false,
        format: 'text',
        pairs: false,
        duplicates: false,
        condensationQuality: false,
        strictWarnings: false,
        report: false,
        repoRoot: '.',
        quiet: false,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--all') {
            args.all = true;
        } else if (a === '--changed') {
            args.changed = true;
        } else if (a === '--format') {
            const v = argv[i + 1];
            i += 1;
            if (v !== 'text' && v !== 'json') {
                throw new ArgError(`argument --format: invalid choice: '${v ?? ''}' (choose from 'text', 'json')`);
            }
            args.format = v;
        } else if (a.startsWith('--format=')) {
            const v = a.slice('--format='.length);
            if (v !== 'text' && v !== 'json') {
                throw new ArgError(`argument --format: invalid choice: '${v}' (choose from 'text', 'json')`);
            }
            args.format = v;
        } else if (a === '--pairs') {
            args.pairs = true;
        } else if (a === '--duplicates') {
            args.duplicates = true;
        } else if (a === '--condensation-quality') {
            args.condensationQuality = true;
        } else if (a === '--strict-warnings') {
            args.strictWarnings = true;
        } else if (a === '--report') {
            args.report = true;
        } else if (a === '--repo-root') {
            args.repoRoot = (argv[i + 1] as string) ?? '.';
            i += 1;
        } else if (a.startsWith('--repo-root=')) {
            args.repoRoot = a.slice('--repo-root='.length);
        } else if (a === '--quiet') {
            args.quiet = true;
        } else {
            args.paths.push(a);
        }
    }
    return args;
}

class ArgError extends Error {}

export function main(argv: string[]): number {
    let args: Args;
    try {
        args = parse_args(argv);
    } catch (e) {
        if (e instanceof ArgError) {
            process.stderr.write(`skill_linter.ts: error: ${e.message}\n`);
            return 2;
        }
        throw e;
    }
    const root = path.resolve(args.repoRoot);

    try {
        const paths: string[] = [];
        if (args.all || args.report) {
            paths.push(...gather_all_candidate_files(root));
        }
        if (args.changed) {
            paths.push(...gather_changed_candidate_files(root));
        }
        for (const raw of args.paths) {
            const p = path.isAbsolute(raw) ? raw : path.resolve(root, raw);
            if (!exists(p)) {
                continue;
            }
            if (isDir(p)) {
                paths.push(...gather_candidate_files_under(p));
            } else {
                paths.push(p);
            }
        }

        const sortedPaths = sortedUnique(paths);
        if (sortedPaths.length === 0) {
            if (args.report) {
                process.stdout.write(`${format_report([])}\n`);
            } else if (args.format === 'json') {
                process.stdout.write(`${format_json([])}\n`);
            }
            process.stderr.write('No matching skill/rule files found.\n');
            return 0;
        }

        const results = sortedPaths.map((p) => lint_file(p, root));

        if (args.pairs || args.report) {
            results.push(...check_condensation_pairs(root));
        }
        if (args.duplicates) {
            results.push(...check_duplication(root));
        }
        if (args.condensationQuality || args.report) {
            results.push(...check_condensation_quality(root));
        }

        if (args.report) {
            process.stdout.write(`${format_report(results)}\n`);
        } else if (args.format === 'json') {
            process.stdout.write(`${format_json(results)}\n`);
        } else {
            process.stdout.write(`${format_text(results, args.quiet)}\n`);
        }

        return compute_exit_code(results, args.strictWarnings);
    } catch (exc) {
        process.stderr.write(`Internal error: ${pyExcStr(exc)}\n`);
        return 3;
    }
}

// --- low-level Python-parity helpers --------------------------------------

/** Count non-overlapping regex matches (mirrors `len(re.findall(...))` for a
 * pattern with a single full match per position; the `g` flag must be set). */
function countMatches(pattern: RegExp, text: string): number {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    let n = 0;
    while (re.exec(text) !== null) {
        n += 1;
        if (re.lastIndex === 0) {
            re.lastIndex += 1; // guard against zero-width infinite loop
        }
    }
    return n;
}

/** Fresh `.search`-style first match (resets lastIndex). */
function freshMatch(pattern: RegExp, text: string): RegExpExecArray | null {
    const re = new RegExp(pattern.source, pattern.flags);
    return re.exec(text);
}

/** Python `str.split(sep, maxsplit)`. */
function splitN(text: string, sep: string, maxsplit: number): string[] {
    const parts: string[] = [];
    let rest = text;
    let count = 0;
    while (count < maxsplit) {
        const idx = rest.indexOf(sep);
        if (idx === -1) {
            break;
        }
        parts.push(rest.slice(0, idx));
        rest = rest.slice(idx + sep.length);
        count += 1;
    }
    parts.push(rest);
    return parts;
}

/** Python `str.split()` with no args — split on runs of whitespace, drop empties. */
function pySplitWhitespace(text: string): string[] {
    return text.split(/\s+/).filter((s) => s !== '');
}

function rstripS(s: string): string {
    return s.endsWith('s') ? s.slice(0, -1) : s;
}

function setIntersects(s: Set<string>, candidates: string[]): boolean {
    return candidates.some((c) => s.has(c));
}

function countChar(text: string, ch: string): number {
    let n = 0;
    for (let i = 0; i < text.length; i += 1) {
        if (text[i] === ch) {
            n += 1;
        }
    }
    return n;
}

/** Python `f"{overlap:.0%}"` — percent with no decimals, round-half-even. */
function pyPercent(value: number): string {
    return `${roundHalfEven(value * 100, 0)}%`;
}

function iterdir(dir: string): string[] {
    try {
        return fs.readdirSync(dir).map((name) => path.join(dir, name));
    } catch {
        return [];
    }
}

function isUnder(child: string, parent: string): boolean {
    const c = path.resolve(child);
    const par = path.resolve(parent);
    const rel = path.relative(par, c);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** Equivalent of `child.relative_to(parent).as_posix()`. */
function relPosix(child: string, parent: string): string {
    return path.relative(path.resolve(parent), path.resolve(child)).split(path.sep).join('/');
}

/** Like relPosix but preserves the native separator (mirrors `str(Path)` use). */
function relPosixNative(child: string, parent: string): string {
    return path.relative(path.resolve(parent), path.resolve(child));
}

/**
 * Sort + dedup like Python `sorted(set(Path(...)))`. Python compares pathlib
 * objects component-wise (the case-normalized parts tuple), NOT as a flat
 * string — so `laravel` sorts before `laravel-validation` because the
 * directory component `laravel` < `laravel-validation`, even though the joined
 * string `laravel-validation/...` < `laravel/...` under plain string order
 * (`-` 0x2D < `/` 0x2F). Replicate the component-wise comparison.
 */
function sortedUnique(items: string[]): string[] {
    return [...new Set(items)].sort(comparePathComponents);
}

function comparePathComponents(a: string, b: string): number {
    const pa = a.split(/[\\/]/);
    const pb = b.split(/[\\/]/);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i += 1) {
        const ca = pa[i] as string;
        const cb = pb[i] as string;
        if (ca < cb) {
            return -1;
        }
        if (ca > cb) {
            return 1;
        }
    }
    return pa.length - pb.length;
}

function stripSourcePrefix(norm: string): string | null {
    const LEGACY = '.agent-src.uncondensed/';
    if (norm.startsWith(LEGACY)) {
        return norm.slice(LEGACY.length);
    }
    if (norm.startsWith('packages/')) {
        const suffix = '/.agent-src.uncondensed/';
        const idx = norm.indexOf(suffix);
        if (idx !== -1) {
            return norm.slice(idx + suffix.length);
        }
    }
    return null;
}

/** Python `str(exc)` rendering for messages. */
function pyExcStr(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}

/** Python repr of an unknown scalar (used in evals_json_assertion_kind). */
function pyReprUnknown(value: unknown): string {
    if (typeof value === 'string') {
        return `'${value}'`;
    }
    if (value === null || value === undefined) {
        return 'None';
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    return String(value);
}

function pyStrListRepr(values: string[]): string {
    return `[${values.map((v) => `'${v}'`).join(', ')}]`;
}
function pyIntListRepr(values: number[]): string {
    return `[${values.join(', ')}]`;
}

/** Python `json.dumps(payload, indent=2, ensure_ascii=False)` parity. */
function jsonIndent2(payload: unknown): string {
    return JSON.stringify(payload, null, 2);
}

// CLI entry — only when executed directly, not when imported by tests.
const isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
    // Set exitCode rather than calling process.exit() so a large stdout write
    // to a pipe is fully flushed before the process terminates — process.exit()
    // can truncate async pipe writes (observed with --all --format json over
    // spawnSync). Node exits with process.exitCode once the event loop drains.
    process.exitCode = main(process.argv.slice(2));
}
