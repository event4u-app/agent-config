#!/usr/bin/env node
/**
 * Preamble byte census — attributes the measured subagent cold-start payload
 * to named sources (`road-to-cache-economy.md` Phase 3,
 * steps 1-2): user-scope rules, project-scope rules, the CLAUDE.md
 * hierarchy (project + user + `@`-imports + `CLAUDE.local.md`), the global
 * user `profile.md` (road-to-global-user-memory), and the preloaded skills
 * catalog (name + `description` frontmatter, the shape the host actually
 * injects — verified against this repo's own skill-catalog listing).
 *
 * Everything NOT independently file-measurable — the host's raw
 * tool-definition JSON and the per-spawn dispatch-prompt text — is reported
 * as ONE labelled residual: measured_cold_start_median minus the sum of the
 * file-measurable buckets above. That is disclosed, not hidden: no local
 * transcript or file carries the request's system/tool payload (verified —
 * `~/.claude/projects/**\/*.jsonl` records only `message.usage` counts and
 * response content; a raw scan of a real transcript file's top-level keys
 * turned up no `system`, `tools`, or prompt-body field). Because the
 * residual is defined as the gap, the "buckets sum to the measured median"
 * check is trivially satisfied BY CONSTRUCTION once a residual exists — this
 * is stated plainly in the report rather than presented as an independent
 * confirmation. The independently interesting number is what SHARE of the
 * median the file-measurable buckets cover on their own.
 *
 * Also reports the MODELLED (never "measured") reduction from removing the
 * duplicate-scope copy the C-2 census already finds — see
 * `_lib/duplicate_scope_census.ts`, reused here rather than reimplemented.
 *
 * Class A (per the ADR-124 no-runtime-boundary contract): in-process,
 * per-invocation, no socket, no daemon, no network. Reads local files
 * (rules, CLAUDE.md hierarchy, skill frontmatter, transcripts) only.
 *
 * Usage:
 *   ./scripts-run src/scripts/preamble_byte_census [--format text|json]
 *     [--repo-root <path>] [--user-home <path>] [--user-rules-dir <path>]
 *     [--project-rules-dir <path>] [--skills-dir <path>]
 *     [--root <path>] [--max-age-days <n>]
 */
import * as fs from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as YAML from 'yaml';

import { resolveGlobalProfilePath } from './_lib/agent_user_profile.js';
import { censusRuleDir, type RuleDirCensus } from './_lib/carrier_divergence.js';
import { DEFAULT_PROJECTS_ROOT, scanTranscripts } from './_lib/cc_transcript.js';
import { censusDuplicateScope } from './_lib/duplicate_scope_census.js';
import { computeColdStarts } from './cache_realization_report.js';
import type { EvidenceBasis } from './_lib/evidence_basis.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CHARS_PER_TOKEN = 4;

// A sum within this tolerance of the measured median counts as "reconciled" —
// mirrors the roadmap's own ±10% verify line. See the module doc comment for
// why this is trivially satisfied once the residual bucket exists.
const SUM_TOLERANCE_PCT = 0.1;

function tokensFromChars(chars: number): number {
    return chars / CHARS_PER_TOKEN;
}

function readCharsIfExists(p: string): number {
    try {
        return fs.statSync(p).size;
    } catch {
        return 0;
    }
}

// ── source 1/2: rule directories ────────────────────────────────────────

// Moved to `_lib/carrier_divergence.ts` when `conformance_scan` needed the same
// count (round-6 Phase 4.3): that module is on a bundled CLI path and this one
// pulls `yaml` plus the cold-start report, so importing this file to reach fifteen
// lines of `statSync` was the wrong direction. Re-exported so every existing
// caller keeps its import and there is still one definition. Imported as well as
// re-exported: a bare `export … from` does not bind the name in this module's own
// scope, and this file uses both below.
export { censusRuleDir, type RuleDirCensus };

export interface PerRuleCost {
    file: string;
    chars: number;
    tokens_estimate: number;
}

/** Top `limit` `.md` files in `dir` by byte size, descending — the per-rule per-spawn cost list (step 2). */
// A candidate list, not a verdict: routing a rule to dormancy goes through
// _lib/compile_time_toggles.ts (see its "dormancy routing" header) and needs an
// output-side bench first. Cost alone never justifies a flip.
export function topRulesByCost(dir: string, limit = 10): PerRuleCost[] {
    if (!fs.existsSync(dir)) return [];
    const entries: PerRuleCost[] = [];
    for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.md')) continue;
        let chars: number;
        try {
            chars = fs.statSync(path.join(dir, name)).size;
        } catch {
            continue;
        }
        entries.push({ file: name, chars, tokens_estimate: tokensFromChars(chars) });
    }
    entries.sort((a, b) => b.chars - a.chars || a.file.localeCompare(b.file));
    return entries.slice(0, limit);
}

// ── source 3: CLAUDE.md hierarchy (project + user + @-imports + local) ──

export interface ClaudeMdCensus {
    project_claude_md_chars: number;
    project_claude_md_present: boolean;
    project_claude_local_md_chars: number;
    project_claude_local_md_present: boolean;
    user_claude_md_chars: number;
    user_claude_md_present: boolean;
    /** Files pulled in by a top-level `@<path>` import line in the user CLAUDE.md. */
    user_imports: { file: string; chars: number }[];
}

/** `@<path>` import lines, one per line, at the START of a line (Claude Code's own import syntax). */
const IMPORT_LINE_RE = /^@(\S+)\s*$/;

function parseClaudeMdImports(claudeMdPath: string): { file: string; chars: number }[] {
    let text: string;
    try {
        text = fs.readFileSync(claudeMdPath, 'utf-8');
    } catch {
        return [];
    }
    const base = path.dirname(claudeMdPath);
    const out: { file: string; chars: number }[] = [];
    for (const line of text.split('\n')) {
        const m = IMPORT_LINE_RE.exec(line.trim());
        if (!m) continue;
        const rel = m[1] as string;
        const resolved = path.isAbsolute(rel) ? rel : path.join(base, rel);
        const chars = readCharsIfExists(resolved);
        if (chars > 0) out.push({ file: rel, chars });
    }
    return out;
}

export function censusClaudeMdHierarchy(repoRoot: string, userHome: string): ClaudeMdCensus {
    const projectClaudeMd = path.join(repoRoot, 'CLAUDE.md');
    const projectClaudeLocalMd = path.join(repoRoot, 'CLAUDE.local.md');
    const userClaudeMd = path.join(userHome, '.claude', 'CLAUDE.md');

    return {
        project_claude_md_chars: readCharsIfExists(projectClaudeMd),
        project_claude_md_present: fs.existsSync(projectClaudeMd),
        project_claude_local_md_chars: readCharsIfExists(projectClaudeLocalMd),
        project_claude_local_md_present: fs.existsSync(projectClaudeLocalMd),
        user_claude_md_chars: readCharsIfExists(userClaudeMd),
        user_claude_md_present: fs.existsSync(userClaudeMd),
        user_imports: parseClaudeMdImports(userClaudeMd),
    };
}

// ── source 4: global user profile.md (road-to-global-user-memory) ───────

export interface GlobalProfileCensus {
    present: boolean;
    chars: number;
    path: string | null;
}

/**
 * `resolveGlobalProfilePath` returns `null` when the layer hasn't landed /
 * isn't written yet — treated as 0, per the roadmap's own honesty caveat.
 * `env` is injectable so tests never touch this machine's real
 * `~/.event4u/agent-config` — see `agent_user_profile.ts`.
 */
export function censusGlobalProfile(env?: Parameters<typeof resolveGlobalProfilePath>[0]): GlobalProfileCensus {
    const p = resolveGlobalProfilePath(env);
    if (p === null) return { present: false, chars: 0, path: null };
    return { present: true, chars: readCharsIfExists(p), path: p };
}

// ── source 5: preloaded skills catalog (name + description) ─────────────

export interface SkillsCatalogCensus {
    skills: number;
    chars: number;
}

export interface RawSkillFrontmatter {
    name?: unknown;
    description?: unknown;
}

/**
 * Exported since `road-to-delivered-cost-truth` 2.1: the per-asset ledger must
 * build the catalogue line the SAME way this census does, or the two disagree
 * about the same corpus. A second regex-based reader was tried and reconciled
 * 17.1 % low, because a `[^\n]+` capture truncates every folded multi-line
 * `description:` — the reconciliation caught it, which is what it is for.
 */
export function parseFrontmatter(text: string): RawSkillFrontmatter {
    if (!text.startsWith('---')) return {};
    const end = text.indexOf('\n---', 3);
    if (end === -1) return {};
    const block = text.slice(3, end);
    try {
        const parsed: unknown = YAML.parse(block);
        return typeof parsed === 'object' && parsed !== null ? (parsed as RawSkillFrontmatter) : {};
    } catch {
        return {};
    }
}

/**
 * Sums `- <name>: <description>\n` across every `SKILL.md` under `skillsDir`
 * — the shape the host's own skill-catalog listing uses (verified against
 * this session's own system-reminder catalog). This is the description-text
 * component only; the exact on-wire bullet/wrapping format the host applies
 * on top is not itself file-measurable, so this is a lower-bound estimate,
 * stated as such wherever it is reported.
 */
export function censusSkillsCatalog(skillsDir: string): SkillsCatalogCensus {
    if (!fs.existsSync(skillsDir)) return { skills: 0, chars: 0 };
    let skills = 0;
    let chars = 0;
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
        let text: string;
        try {
            text = fs.readFileSync(skillMd, 'utf-8');
        } catch {
            continue;
        }
        const fm = parseFrontmatter(text);
        const name = typeof fm.name === 'string' && fm.name.length > 0 ? fm.name : entry.name;
        const description = typeof fm.description === 'string' ? fm.description : '';
        chars += `- ${name}: ${description}\n`.length;
        skills += 1;
    }
    return { skills, chars };
}

// ── report assembly ───────────────────────────────────────────────────────

export interface ByteCensusSource {
    name: string;
    files: number;
    chars: number;
    tokens_estimate: number;
    /**
     * Migrated onto the shared evidence-basis vocabulary
     * (`road-to-delivered-cost-truth` 4.1). `measured_local_file` was this
     * file's private spelling of `measured`, and `residual` was its spelling of
     * a figure derived by subtraction — which the contract calls `estimated`.
     * Two names for one idea is how a vocabulary forks; the old literals are
     * gone rather than aliased.
     */
    provenance: Extract<EvidenceBasis, 'measured' | 'estimated'>;
    /** How this figure was derived — mandatory for anything not a plain file-size sum. */
    basis: string;
}

export interface ByteCensus {
    sources: ByteCensusSource[];
    measurable_tokens_total: number;
    /** Includes the residual bucket — always ≈ measured_cold_start_median by construction (see module doc comment). */
    grand_total_tokens: number;
    measured_cold_start_median: number | null;
    cold_start_legs: number;
    /** measurable_tokens_total / measured_cold_start_median — the honest, non-tautological number. */
    measurable_share_of_median: number | null;
    within_tolerance: boolean | null;
    top_rules_by_cost: PerRuleCost[];
    duplicate_scope: {
        evaluable: boolean;
        reason?: string | undefined;
        shared_filenames: number;
        duplicate_tokens_per_spawn: number;
    };
    /** MODELLED, never measured — see module doc comment and the `modelled` label on every field here. */
    modelled_duplicate_removal: {
        applicable: boolean;
        reason?: string | undefined;
        modelled_new_median: number | null;
        modelled_reduction_pct: number | null;
    };
}

export interface Options {
    format: 'text' | 'json';
    repoRoot: string;
    userHome: string;
    userRulesDir: string;
    projectRulesDir: string;
    skillsDir: string;
    root: string;
    maxAgeDays: number;
}

function defaultOptions(): Options {
    const userHome = homedir();
    return {
        format: 'text',
        repoRoot: REPO_ROOT,
        userHome,
        userRulesDir: path.join(userHome, '.claude', 'rules'),
        projectRulesDir: path.join(REPO_ROOT, 'dist', 'agent-src', 'rules'),
        skillsDir: path.join(REPO_ROOT, 'dist', 'agent-src', 'skills'),
        root: DEFAULT_PROJECTS_ROOT,
        maxAgeDays: 14,
    };
}

export function parseArgs(argv: string[]): Options {
    const opts = defaultOptions();
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === undefined) continue;
        if (a === '--format') opts.format = (argv[++i] as Options['format']) ?? opts.format;
        else if (a.startsWith('--format=')) opts.format = a.slice('--format='.length) as Options['format'];
        else if (a === '--repo-root') opts.repoRoot = argv[++i] ?? opts.repoRoot;
        else if (a.startsWith('--repo-root=')) opts.repoRoot = a.slice('--repo-root='.length);
        else if (a === '--user-home') opts.userHome = argv[++i] ?? opts.userHome;
        else if (a.startsWith('--user-home=')) opts.userHome = a.slice('--user-home='.length);
        else if (a === '--user-rules-dir') opts.userRulesDir = argv[++i] ?? opts.userRulesDir;
        else if (a.startsWith('--user-rules-dir=')) opts.userRulesDir = a.slice('--user-rules-dir='.length);
        else if (a === '--project-rules-dir') opts.projectRulesDir = argv[++i] ?? opts.projectRulesDir;
        else if (a.startsWith('--project-rules-dir=')) opts.projectRulesDir = a.slice('--project-rules-dir='.length);
        else if (a === '--skills-dir') opts.skillsDir = argv[++i] ?? opts.skillsDir;
        else if (a.startsWith('--skills-dir=')) opts.skillsDir = a.slice('--skills-dir='.length);
        else if (a === '--root') opts.root = argv[++i] ?? opts.root;
        else if (a.startsWith('--root=')) opts.root = a.slice('--root='.length);
        else if (a === '--max-age-days') opts.maxAgeDays = Number(argv[++i]) || opts.maxAgeDays;
        else if (a.startsWith('--max-age-days=')) opts.maxAgeDays = Number(a.slice('--max-age-days='.length)) || opts.maxAgeDays;
    }
    if (opts.format !== 'text' && opts.format !== 'json') opts.format = 'text';
    return opts;
}

/**
 * Assembles the full census from already-computed measurements — pure, so
 * tests can supply synthetic figures without touching real transcripts or
 * this machine's `~/.claude`.
 */
export function buildByteCensus(opts: {
    userRules: RuleDirCensus;
    projectRules: RuleDirCensus;
    claudeMd: ClaudeMdCensus;
    globalProfile: GlobalProfileCensus;
    skillsCatalog: SkillsCatalogCensus;
    topRules: PerRuleCost[];
    duplicateScope: ReturnType<typeof censusDuplicateScope>;
    measuredColdStartMedian: number | null;
    coldStartLegs: number;
}): ByteCensus {
    const claudeMdChars =
        opts.claudeMd.project_claude_md_chars +
        opts.claudeMd.project_claude_local_md_chars +
        opts.claudeMd.user_claude_md_chars +
        opts.claudeMd.user_imports.reduce((s, i) => s + i.chars, 0);
    const claudeMdFiles =
        (opts.claudeMd.project_claude_md_present ? 1 : 0) +
        (opts.claudeMd.project_claude_local_md_present ? 1 : 0) +
        (opts.claudeMd.user_claude_md_present ? 1 : 0) +
        opts.claudeMd.user_imports.length;

    const sources: ByteCensusSource[] = [
        {
            name: 'user-scope rules (~/.claude/rules/*.md)',
            files: opts.userRules.files,
            chars: opts.userRules.chars,
            tokens_estimate: tokensFromChars(opts.userRules.chars),
            provenance: 'measured',
            basis: 'Σ byte size of every .md file in the user-scope rules directory, chars/4.',
        },
        {
            name: 'project-scope rules (dist/agent-src/rules/*.md)',
            files: opts.projectRules.files,
            chars: opts.projectRules.chars,
            tokens_estimate: tokensFromChars(opts.projectRules.chars),
            provenance: 'measured',
            basis: 'Σ byte size of every .md file in the project-scope rules directory, chars/4.',
        },
        {
            name: 'CLAUDE.md hierarchy (project + project-local + user + user @-imports)',
            files: claudeMdFiles,
            chars: claudeMdChars,
            tokens_estimate: tokensFromChars(claudeMdChars),
            provenance: 'measured',
            basis:
                'Byte size of project CLAUDE.md + project CLAUDE.local.md (if present) + user ~/.claude/CLAUDE.md ' +
                '+ every file pulled in by a top-level "@<path>" import line in the user CLAUDE.md, chars/4.',
        },
        {
            name: 'global user profile.md (road-to-global-user-memory)',
            files: opts.globalProfile.present ? 1 : 0,
            chars: opts.globalProfile.chars,
            tokens_estimate: tokensFromChars(opts.globalProfile.chars),
            provenance: 'measured',
            basis: opts.globalProfile.present
                ? `Byte size of ${opts.globalProfile.path as string}, chars/4.`
                : 'Layer not written yet on this machine (resolveGlobalProfilePath() returned null) — treated as 0, per the roadmap\'s own honesty caveat.',
        },
        {
            name: 'preloaded skills catalog (name + description, dist/agent-src/skills)',
            files: opts.skillsCatalog.skills,
            chars: opts.skillsCatalog.chars,
            tokens_estimate: tokensFromChars(opts.skillsCatalog.chars),
            provenance: 'measured',
            basis:
                'Σ "- <name>: <description>\\n" over every SKILL.md frontmatter, chars/4 — the description-text ' +
                'component only; the host\'s exact on-wire catalog format is not independently file-measurable.',
        },
    ];

    const measurableTokensTotal = sources.reduce((s, src) => s + src.tokens_estimate, 0);
    const median = opts.measuredColdStartMedian;
    const residualTokens = median !== null ? Math.max(0, median - measurableTokensTotal) : null;

    if (residualTokens !== null) {
        sources.push({
            name: 'tool definitions + dispatch prompt (residual)',
            files: 0,
            chars: 0,
            tokens_estimate: residualTokens,
            provenance: 'estimated',
            basis:
                'measured_cold_start_median minus the sum of the file-measurable buckets above. No local transcript ' +
                'or file carries the request\'s raw tool-definition JSON or the per-spawn dispatch-prompt text ' +
                '(verified: ~/.claude/projects/**/*.jsonl records only message.usage counts and response content, ' +
                'never the request system/tool payload) — this bucket exists so the gap is named rather than silently dropped.',
        });
    }

    const grandTotal = sources.reduce((s, src) => s + src.tokens_estimate, 0);
    const measurableShare = median !== null && median > 0 ? measurableTokensTotal / median : null;
    const withinTolerance = median !== null ? Math.abs(grandTotal - median) / Math.max(1, median) <= SUM_TOLERANCE_PCT : null;

    const dup = opts.duplicateScope;
    let modelledNewMedian: number | null = null;
    let modelledReductionPct: number | null = null;
    let modelledApplicable = false;
    let modelledReason: string | undefined;
    if (median === null) {
        modelledReason = 'no measured cold-start median available in this window';
    } else if (!dup.evaluable) {
        modelledReason = dup.reason ?? 'duplicate-scope census not evaluable';
    } else {
        modelledApplicable = true;
        modelledNewMedian = Math.max(0, median - dup.duplicate_chars / CHARS_PER_TOKEN);
        modelledReductionPct = median > 0 ? (median - modelledNewMedian) / median : 0;
    }

    return {
        sources,
        measurable_tokens_total: measurableTokensTotal,
        grand_total_tokens: grandTotal,
        measured_cold_start_median: median,
        cold_start_legs: opts.coldStartLegs,
        measurable_share_of_median: measurableShare,
        within_tolerance: withinTolerance,
        top_rules_by_cost: opts.topRules,
        duplicate_scope: {
            evaluable: dup.evaluable,
            reason: dup.reason,
            shared_filenames: dup.shared_filenames.length,
            duplicate_tokens_per_spawn: dup.evaluable ? dup.duplicate_chars / CHARS_PER_TOKEN : 0,
        },
        modelled_duplicate_removal: {
            applicable: modelledApplicable,
            reason: modelledReason,
            modelled_new_median: modelledNewMedian,
            modelled_reduction_pct: modelledReductionPct,
        },
    };
}

export function buildReport(opts: Options): ByteCensus {
    const userRules = censusRuleDir(opts.userRulesDir);
    const projectRules = censusRuleDir(opts.projectRulesDir);
    const claudeMd = censusClaudeMdHierarchy(opts.repoRoot, opts.userHome);
    const globalProfile = censusGlobalProfile();
    const skillsCatalog = censusSkillsCatalog(opts.skillsDir);
    const topRules = topRulesByCost(opts.projectRulesDir, 10);
    const duplicateScope = censusDuplicateScope(opts.userRulesDir, opts.projectRulesDir);

    const scan = scanTranscripts({ root: opts.root, maxAgeDays: opts.maxAgeDays });
    const coldStart = computeColdStarts(scan.records);
    const measuredColdStartMedian = coldStart.legs > 0 ? coldStart.median_first_call_written_or_uncached : null;

    return buildByteCensus({
        userRules,
        projectRules,
        claudeMd,
        globalProfile,
        skillsCatalog,
        topRules,
        duplicateScope,
        measuredColdStartMedian,
        coldStartLegs: coldStart.legs,
    });
}

function pct(v: number): string {
    return `${(v * 100).toFixed(1)}%`;
}

export function renderText(r: ByteCensus): string {
    const out: string[] = [];
    out.push('Preamble byte census (road-to-cache-economy Phase 3, steps 1-2)');
    out.push('');
    out.push('Sources:');
    for (const s of r.sources) {
        out.push(`  ${s.name}`);
        out.push(`    files=${s.files} chars=${s.chars} tokens_estimate=${Math.round(s.tokens_estimate)} [${s.provenance}]`);
        out.push(`    basis: ${s.basis}`);
    }
    out.push('');
    out.push(`measurable_tokens_total (excludes residual): ${Math.round(r.measurable_tokens_total)}`);
    out.push(`grand_total_tokens (includes residual): ${Math.round(r.grand_total_tokens)}`);
    if (r.measured_cold_start_median !== null) {
        out.push(`measured_cold_start_median: ${Math.round(r.measured_cold_start_median)} (${r.cold_start_legs} legs, this window)`);
        out.push(`measurable_share_of_median: ${pct(r.measurable_share_of_median as number)} (the honest, non-tautological number)`);
        out.push(
            `sum check (grand_total vs median, ±10%): ${r.within_tolerance ? 'PASS' : 'FAIL'} — trivially PASS by ` +
                'construction once the residual bucket exists; see the module doc comment for why.',
        );
    } else {
        out.push('measured_cold_start_median: pending — no subagent legs observed in this window; no residual computed.');
    }
    out.push('');
    out.push('Top-10 project-scope rules by per-spawn token cost:');
    for (const rule of r.top_rules_by_cost) {
        out.push(`  ${rule.file}: chars=${rule.chars} tokens_estimate=${Math.round(rule.tokens_estimate)}`);
    }
    out.push('');
    out.push('Duplicate-scope census (C-2):');
    if (r.duplicate_scope.evaluable) {
        out.push(
            `  ${r.duplicate_scope.shared_filenames} shared filename(s), ` +
                `${Math.round(r.duplicate_scope.duplicate_tokens_per_spawn)} redundant tokens per spawn.`,
        );
    } else {
        out.push(`  not evaluable — ${r.duplicate_scope.reason ?? 'unknown reason'}`);
    }
    out.push('');
    out.push('Modelled duplicate-copy removal (MODELLED, not measured):');
    if (r.modelled_duplicate_removal.applicable) {
        out.push(`  modelled_new_median: ${Math.round(r.modelled_duplicate_removal.modelled_new_median as number)}`);
        out.push(`  modelled_reduction_pct: ${pct(r.modelled_duplicate_removal.modelled_reduction_pct as number)}`);
    } else {
        out.push(`  not applicable — ${r.modelled_duplicate_removal.reason ?? 'unknown reason'}`);
    }
    out.push('');
    out.push('The per-spawn payload ceiling (median ≤ 40k / p95 ≤ 50k) is a DOCUMENTED CANDIDATE, gated on C-3');
    out.push('(preamble reducibility, still pending — no reduction intervention has landed). See');
    out.push('docs/contracts/load-context-budget-model.md. This report does NOT enforce it.');
    return out.join('\n');
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const opts = parseArgs(argv);
    const report = buildReport(opts);
    if (opts.format === 'json') {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
        process.stdout.write(renderText(report) + '\n');
    }
    return 0;
}

// `__AGENT_CONFIG_BUNDLE__` is defined true by every esbuild target. Inside a
// bundle `import.meta.url` is the OUTPUT file's URL for every bundled module,
// so the guard below would match whenever the bundle is invoked directly — and
// importing this module from a bundled CLI entry (`cmd_doctor` bundles under
// `build:cli-delegate`) would run the census and exit before that entry's own
// main. Same shape as the guard in `dispatch_economy_report.ts`.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _isBundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
if (!_isBundled && process.argv[1] !== undefined) {
    const invokedUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === invokedUrl) process.exit(main());
}
