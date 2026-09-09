#!/usr/bin/env tsx
/**
 * What each host actually loads at rest, per host, in bytes and tokens.
 *
 * `road-to-delivery-for-every-host` step 0.1 — the baseline the flip is
 * measured against. The roadmap's headline figure (138,200 chars/4 tokens) is a
 * SINGLE number over one bucket set; this splits it by host, because the whole
 * point of `lean_projection.hosts` is that the flip must move one host's number
 * and leave every other host's byte-identical.
 *
 * WHY THE PROJECTION SOURCE AND NOT THE LOCAL TREE
 * -----------------------------------------------
 * The obvious census — walk `.claude/rules`, `.cursor/rules`, `.clinerules` on
 * disk — measures this MACHINE, not the package. Two filters shrink a
 * maintainer checkout below what a consumer install receives:
 *
 *   · user-scope dedup: a rule byte-identical to a twin already installed at
 *     user scope is skipped (`condense` prints "N rule(s) skipped — byte-identical
 *     twin already installed at user scope"), so `.claude/rules` holds 13 files
 *     here against 114 projectable ones;
 *   · workspace/pack scope: `_scoped_rule_basenames` filters by the consumer's
 *     own `workspaces:`/`packs:` settings, which differ per install.
 *
 * Both are real and both are install-local, so a number read off this disk is
 * not reproducible anywhere else — and step 0.1's verify demands a re-run at the
 * same pin be byte-identical. So the unit here is the PROJECTION SOURCE
 * (`dist/agent-src/rules`) minus the ADR-004 `type: manual` rules no per-tool
 * tree ever receives, which is the UPPER BOUND a host loads: an unscoped,
 * un-deduplicated consumer install. Every scope narrowing moves a host DOWN from
 * this figure, never up.
 *
 * WHAT IT DOES NOT ESTABLISH
 * --------------------------
 * Nothing about whether a host READS what it is given. `docs/enforcement-by-host.md`
 * owns that axis, and a host with a rule tree it never loads would look identical
 * here. This measures delivery, not consumption.
 *
 * Usage:
 *     ./scripts-run src/scripts/report_standing_payload_by_host
 *     ./scripts-run src/scripts/report_standing_payload_by_host --emit --pin <sha>
 *
 * Deterministic: hosts sort by id, no timestamp, the pin is an argument, and no
 * value is read from `$HOME`.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    loadRouter,
    matchTierRules,
    pathOnlyRuleIds,
    selectForInjection,
} from './_lib/rule_injection.js';
import { CAP_BYTES } from './hooks/rule_inject_hook.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const ARTIFACT_REL = path.join(
    'agents', 'evidence', 'analysis', 'standing-payload-by-host-2026-09.md',
);
export const RULES_DIST_REL = path.join('dist', 'agent-src', 'rules');

/**
 * One host's rule surface, and the code that writes it.
 *
 * `writer` is a `file:line` into the tree, checked by `assertWritersResolve`
 * below rather than asserted in prose — a citation nothing verifies is the
 * failure mode this whole roadmap is written against.
 */
export interface HostSurface {
    readonly host: string;
    /** Repo-relative dir or file the host loads, or `null` when this tree writes none. */
    readonly surface: string | null;
    /** `true` when `surface` is a directory receiving one file per projected rule. */
    readonly perRuleTree: boolean;
    readonly writer: string;
    /**
     * A literal substring the cited LINE must contain (R2 finding 8).
     *
     * Without it `assertWritersResolve` was a bounds test wearing a provenance
     * test's name: it checked that the line NUMBER was inside the file and
     * never read the line, so a citation that drifted by one commit — the
     * exact failure this table's docstring says the check replaces prose
     * assertion to prevent — passed unchanged, and so would a wholesale
     * renumbering as long as the file stayed long enough.
     *
     * Kept short and structural (a call, a path literal, a const name) so it
     * survives reformatting but not a move.
     */
    readonly anchor: string;
    readonly note: string;
}

/**
 * The host axis, taken from `docs/enforcement-by-host.md:18-28` rather than
 * invented here, plus the writer each surface has in this tree.
 */
export const HOST_SURFACES: readonly HostSurface[] = [
    {
        host: 'augment', surface: '.augment/rules', perRuleTree: true,
        writer: 'src/scripts/condense.ts:2495',
        anchor: '\'.augment/rules\',',
        note: 'copies by default; symlinks under `augment.rules_use_symlinks`',
    },
    {
        host: 'claude-code', surface: '.claude/rules', perRuleTree: true,
        writer: 'src/scripts/condense.ts:1188',
        anchor: '_emit_claude_rule(',
        note: '`_emit_claude_rule` rewrites frontmatter to the host\'s own `paths:` key',
    },
    {
        host: 'cline', surface: '.clinerules', perRuleTree: true,
        writer: 'src/scripts/condense.ts:1190',
        anchor: 'fs.symlinkSync(',
        note: 'symlink per rule into the projection',
    },
    {
        host: 'copilot', surface: '.github/copilot-instructions.md', perRuleTree: false,
        writer: 'src/scripts/generate_capability_matrix.ts:138',
        anchor: '_INSTALL_TIME_CELLS',
        note: 'NOT written by `condense`: the installer aggregates it from `src/agent-src/templates/copilot-instructions.md`, which is why the capability matrix marks this cell `adapter` and footnotes it as install-time',
    },
    {
        host: 'cowork', surface: null, perRuleTree: false,
        writer: '—',
        anchor: '',
        note: 'no rule-tree writer in this tree; carries hook bindings only',
    },
    {
        host: 'cursor', surface: '.cursor/rules', perRuleTree: true,
        writer: 'src/scripts/condense.ts:1190',
        anchor: 'fs.symlinkSync(',
        note: 'symlink per rule, plus `.mdc` companions at `condense.ts:1418`',
    },
    {
        host: 'gemini', surface: 'GEMINI.md', perRuleTree: false,
        writer: 'src/scripts/condense.ts:1494',
        anchor: '\'GEMINI.md\'',
        note: 'single file',
    },
    {
        host: 'windsurf', surface: '.windsurfrules', perRuleTree: false,
        writer: 'src/scripts/condense.ts:1238',
        anchor: '\'.windsurfrules\'',
        note: 'single concatenated file',
    },
    {
        host: 'codex', surface: '.codex/agent-config.md', perRuleTree: false,
        writer: 'src/scripts/install.ts:1541',
        anchor: '\'agent-config.md\'',
        note: 'written by the installer, not by `condense`; absent in this checkout',
    },
];

/** chars/4, the unit `check_preamble_payload_budget` reports. */
export function tokensChars4(chars: number): number {
    return Math.round(chars / 4);
}

/** A rule is `manual` when its frontmatter says so, quoted or bare (ADR-004). */
export function isManualRule(text: string): boolean {
    return /^type:\s*"?manual"?\s*$/mu.test(text);
}

export interface RuleCorpus {
    readonly files: number;
    readonly manual: number;
    readonly projected: number;
    readonly projectedChars: number;
}

/** The projection source, split into what a per-rule host tree receives and what it never does. */
export function readRuleCorpus(root: string): RuleCorpus {
    const dir = path.join(root, RULES_DIST_REL);
    const names = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
    let manual = 0;
    let projected = 0;
    let projectedChars = 0;
    for (const name of names) {
        const text = fs.readFileSync(path.join(dir, name), 'utf-8');
        if (isManualRule(text)) {
            manual += 1;
            continue;
        }
        projected += 1;
        projectedChars += Buffer.byteLength(text, 'utf-8');
    }
    return { files: names.length, manual, projected, projectedChars };
}

/** Bytes of the `type: manual` rules — the difference between the two rule figures. */
export function manualCorpusChars(root: string): number {
    const dir = path.join(root, RULES_DIST_REL);
    let chars = 0;
    for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
        const text = fs.readFileSync(path.join(dir, name), 'utf-8');
        if (isManualRule(text)) chars += Buffer.byteLength(text, 'utf-8');
    }
    return chars;
}

/** Bytes of a single-file surface, or `null` when it is absent from this checkout. */
export function singleFileChars(root: string, rel: string): number | null {
    try {
        return Buffer.byteLength(fs.readFileSync(path.join(root, rel), 'utf-8'), 'utf-8');
    } catch {
        return null;
    }
}

/**
 * Every `writer` citation resolves to a real line.
 *
 * Run on every invocation, not only under a flag: an artifact whose whole value
 * is `file:line` provenance must not be publishable with a citation that has
 * silently drifted by one commit.
 */
export function assertWritersResolve(root: string): string[] {
    const problems: string[] = [];
    for (const h of HOST_SURFACES) {
        if (h.writer === '—') continue;
        const [rel, lineRaw] = h.writer.split(':');
        const abs = path.join(root, rel as string);
        if (!fs.existsSync(abs)) {
            problems.push(`${h.host}: writer file ${rel as string} does not exist`);
            continue;
        }
        const lines = fs.readFileSync(abs, 'utf-8').split('\n');
        const n = Number(lineRaw);
        if (!Number.isInteger(n) || n < 1 || n > lines.length) {
            problems.push(`${h.host}: writer ${h.writer} is outside the file (${String(lines.length)} lines)`);
            continue;
        }
        // The line itself, not merely its existence (R2 finding 8).
        const line = lines[n - 1] as string;
        if (h.anchor === '') {
            problems.push(`${h.host}: writer ${h.writer} carries no anchor to check the line against`);
            continue;
        }
        if (!line.includes(h.anchor)) {
            problems.push(
                `${h.host}: writer ${h.writer} no longer carries its anchor ` +
                    `${JSON.stringify(h.anchor)} — the line now reads ${JSON.stringify(line.trim())}`,
            );
        }
    }
    return problems;
}

/** How many surfaces carry a citation at all — counted, never `length - 1` (R2 finding 14). */
export function citedWriterCount(): number {
    return HOST_SURFACES.filter((h) => h.writer !== '—').length;
}

/**
 * Why `pin` is not usable, or `null` (R2 finding 9).
 *
 * `--pin` was free text with no comparison against HEAD, while the artifact it
 * stamps opens with "Pinned to commit <sha> … a re-run at the same pin is
 * byte-identical". Every figure in it is read from the WORKING TREE, so a pin
 * that is not the current commit documents nothing — and the committed artifact
 * carried a pin from an earlier commit while the branch had since edited
 * `condense.ts`, whose line numbers the artifact cites. The pin is now an
 * ASSERTION about HEAD rather than a label, and a dirty tree is reported for
 * the same reason: the byte-identity sentence is false the moment the tree the
 * figures were read from is not the commit they are stamped with.
 */
export function pinProblem(root: string, pin: string): string | null {
    let head: string;
    try {
        head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
    } catch {
        return 'git rev-parse HEAD failed — the pin cannot be asserted';
    }
    if (pin !== head) {
        return (
            `--pin ${pin} is not HEAD (${head}). Every figure in the artifact is read from the ` +
            'working tree, so a pin that is not the current commit stamps the report with a ' +
            'commit its numbers were never taken at.'
        );
    }
    return null;
}

/** `true` when the working tree carries uncommitted changes to a path the report reads. */
export function treeIsDirty(root: string): boolean {
    try {
        const out = execFileSync(
            'git',
            ['-C', root, 'status', '--porcelain', '--', RULES_DIST_REL, 'src/scripts', 'tests/eval/routing-matrix'],
            { encoding: 'utf-8' },
        );
        return out.trim() !== '';
    } catch {
        return false;
    }
}

export function renderArtifact(root: string, pin: string): string {
    const corpus = readRuleCorpus(root);
    const perTreeChars = corpus.projectedChars;
    const L: string[] = [];
    L.push('<!-- evidence-type: analysis -->');
    L.push('# Standing rule payload, per host');
    L.push('');
    L.push(`Pinned to commit \`${pin}\`. Generated by`);
    L.push(`\`./scripts-run src/scripts/report_standing_payload_by_host --emit --pin ${pin}\`;`);
    L.push('a re-run at the same pin is byte-identical — no value is read from `$HOME` and no');
    L.push('timestamp is written.');
    L.push('');
    L.push('## The unit, and why it is not this disk');
    L.push('');
    L.push('The census is taken over the **projection source** `dist/agent-src/rules`, minus the');
    L.push('ADR-004 `type: manual` rules no per-tool tree ever receives. That is the UPPER BOUND a');
    L.push('host loads: an unscoped, un-deduplicated consumer install.');
    L.push('');
    L.push('Reading it off the local trees instead would measure this machine. Two install-local');
    L.push('filters shrink a maintainer checkout below what a consumer receives — user-scope dedup');
    L.push('(a rule byte-identical to a user-scope twin is skipped) and workspace/pack scope. Both');
    L.push('are real, both differ per install, and step 0.1 requires a re-run at the same pin to be');
    L.push('byte-identical. Every scope narrowing moves a host DOWN from the figure below, never up.');
    L.push('');
    L.push('**This measures delivery, not consumption.** Whether a host READS what it is handed is');
    L.push('the axis `docs/enforcement-by-host.md:18-28` owns; a host with a tree it never loads');
    L.push('would look identical here.');
    L.push('');
    L.push('## The rule corpus');
    L.push('');
    L.push('| Quantity | Value |');
    L.push('|---|---:|');
    L.push(`| \`.md\` files in \`${RULES_DIST_REL}\` | ${String(corpus.files)} |`);
    L.push(`| of those, \`type: manual\` (never projected, ADR-004) | ${String(corpus.manual)} |`);
    L.push(`| projected to a per-rule host tree | ${String(corpus.projected)} |`);
    L.push(`| bytes of the projected set | ${String(perTreeChars)} |`);
    L.push(`| chars/4 tokens of the projected set | ${String(tokensChars4(perTreeChars))} |`);
    L.push('');
    L.push('## Per host');
    L.push('');
    L.push('| Host | Surface | Shape | Bytes | chars/4 tok | Writer |');
    L.push('|---|---|---|---:|---:|---|');
    for (const h of HOST_SURFACES) {
        if (h.surface === null) {
            L.push(`| \`${h.host}\` | — | none | — | — | ${h.writer} |`);
            continue;
        }
        if (h.perRuleTree) {
            L.push(
                `| \`${h.host}\` | \`${h.surface}\` | per-rule tree | ${String(perTreeChars)} | ` +
                    `${String(tokensChars4(perTreeChars))} | \`${h.writer}\` |`,
            );
            continue;
        }
        const chars = singleFileChars(root, h.surface);
        const bytes = chars === null ? 'absent' : String(chars);
        const toks = chars === null ? 'absent' : String(tokensChars4(chars));
        L.push(`| \`${h.host}\` | \`${h.surface}\` | single file | ${bytes} | ${toks} | \`${h.writer}\` |`);
    }
    L.push('');
    L.push('Notes per host:');
    L.push('');
    for (const h of HOST_SURFACES) {
        L.push(`- \`${h.host}\` — ${h.note}`);
    }
    L.push('');
    L.push('## The two units, recorded once');
    L.push('');
    // The rules bucket is DERIVED here, never a literal. The two figures below
    // it are readings of another gate and are dated rather than recomputed —
    // this script does not own them, and a stale literal presented as live is
    // the defect class R2 findings 8/9/14 are about (spotted while fixing them:
    // `122,608` had gone stale and contradicted the computed sum three
    // paragraphs down, inside the same emitted artifact).
    const censusTok = tokensChars4(perTreeChars) + tokensChars4(manualCorpusChars(root));
    const SKILLS_CATALOG_TOK = 14846;
    const CLAUDE_MD_TOK = 746;
    L.push('- **chars/4** is what `check_preamble_payload_budget` reports. Its rules bucket is');
    L.push(`  derived here as **${String(censusTok)} tok** (every \`.md\` in the projection directory).`);
    L.push('  The other two buckets are that gate\'s own readings, last taken 2026-09-08 and NOT');
    L.push(`  recomputed by this script: preloaded skills catalog ${String(SKILLS_CATALOG_TOK)} ·`);
    L.push(`  CLAUDE.md hierarchy ${String(CLAUDE_MD_TOK)}, for a measured total of`);
    L.push(`  **${String(censusTok + SKILLS_CATALOG_TOK + CLAUDE_MD_TOK)} tok**. Re-read it with`);
    L.push('  `./scripts-run src/scripts/check_preamble_payload_budget` rather than quoting this line.');
    L.push('- **Exact BPE** is the unit `docs/CLAIMS.md:365` uses for the delivery experiment:');
    L.push('  120,582 → 18,573 exact-BPE standing tokens for the rule corpus under');
    L.push('  `lean_projection.mode: delivery`. The two units are NOT interchangeable and no delta');
    L.push('  is computed between them here.');
    L.push('');
    L.push('**Reconciling the two rule figures, because they differ and both are right.** The');
    L.push(`census bucket reads ${String(censusTok)} chars/4 tok over the projection directory; the projected-set`);
    const manualChars = manualCorpusChars(root);
    L.push(`row above reads ${String(tokensChars4(perTreeChars))}. The gap is the ${String(corpus.manual)} \`type: manual\` rules: the census counts every`);
    L.push(`\`.md\` in the directory, this table counts only what a per-tool tree receives. ${String(manualChars)} bytes`);
    L.push(`= ${String(tokensChars4(manualChars))} tok, and ${String(tokensChars4(perTreeChars))} + ${String(tokensChars4(manualChars))} = ${String(tokensChars4(perTreeChars) + tokensChars4(manualChars))}. A manual rule reaches no host tree`);
    L.push('by ADR-004, so excluding it is correct here and including it is correct there.');
    L.push('');
    L.push('## Per-slot delivery fire sizes — the activation charge (3.1)');
    L.push('');
    L.push('Gate-open per-fire emission of the `rule-inject` concern over the frozen');
    L.push('`tests/eval/routing-matrix` corpus, measured through the SAME selection the runtime');
    L.push('concern uses (`_lib/rule_injection.ts::matchTierRules` + `selectForInjection` at the');
    L.push('concern\'s own `CAP_BYTES`), never through a second model of it.');
    L.push('');
    L.push('| Slot | Fires | p50 B | p90 B | max B |');
    L.push('|---|---:|---:|---:|---:|');
    for (const r of slotFireSizes(root)) {
        L.push(
            `| \`${r.slot}\` | ${String(r.fires)} | ${String(r.p50)} | ${String(r.p90)} | ${String(r.max)} |`,
        );
    }
    L.push('');
    L.push('`pre_compact` is zero **by construction, not by measurement**: that branch of');
    L.push('`rule_inject_hook` clears the seen-set and returns allow without writing to stdout, so');
    L.push('there is no emission to sample.');
    L.push('');
    const pathOnly = [...pathOnlyRuleIds(loadRouter(root))].sort();
    L.push('**Rules reachable ONLY on `pre_tool_use`**, which is the condition owner ruling E2');
    L.push(`makes the \`pre_tool_use\` binding conditional on — ${String(pathOnly.length)} of them, all labelled:`);
    L.push('');
    for (const id of pathOnly) L.push(`- \`${id}\``);
    L.push('');
    L.push('## What the flip must move, and what it must not');
    L.push('');
    L.push('`claude-code` is the only host in the default `lean_projection.hosts`. Its row above is');
    L.push('the number the flip reduces. **Every other per-rule-tree row must stay byte-identical**');
    L.push('— that is the D1 repair and the Phase 1.4 gate, and it is why this table exists per host');
    L.push('rather than as one total.');
    L.push('');
    return L.join('\n');
}

/** One positive prompt of the frozen corpus, with the open files it declares. */
interface CorpusPrompt {
    prompt: string;
    openFiles: string[] | null;
}

/**
 * Every YAML shape inside `positives:` this hand parser cannot read (R2 finding 10).
 *
 * `readCorpusPositives` accepts only `- prompt: "…"` with a double-quoted
 * same-line scalar and an inline `open_files: [...]`. Any other legal shape —
 * single quotes, an unquoted scalar, a folded block, a block sequence for
 * `open_files` — was SILENTLY SKIPPED, which drops fires out of the
 * distribution the 16,384-byte `user_prompt_submit` row is derived from. A
 * measurement that governs a budget must fail loudly on a shape it cannot read
 * rather than under-count, so the CLI refuses on a non-empty result here.
 *
 * Reported as a shape problem rather than fixed by widening the parser: this
 * script must not grow a second YAML implementation, and the corpus is frozen,
 * so the honest answer to an unreadable shape is to say which file carries it.
 */
export function corpusShapeProblems(root: string): string[] {
    const dir = path.join(root, 'tests', 'eval', 'routing-matrix');
    const problems: string[] = [];
    if (!fs.existsSync(dir)) return problems;
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.yaml')).sort()) {
        let inPositives = false;
        let lineNo = 0;
        for (const raw of fs.readFileSync(path.join(dir, f), 'utf-8').split('\n')) {
            lineNo += 1;
            if (/^positives:/u.test(raw)) { inPositives = true; continue; }
            if (/^near_misses:/u.test(raw)) { inPositives = false; continue; }
            if (!inPositives) continue;
            if (/^\s*-\s*prompt:/u.test(raw) && !/^\s*-\s*prompt:\s*"(.*)"\s*$/u.test(raw)) {
                problems.push(
                    `${f}:${String(lineNo)}: a \`- prompt:\` this parser cannot read — only a ` +
                        `double-quoted same-line scalar is accepted: ${JSON.stringify(raw.trim())}`,
                );
                continue;
            }
            if (/^\s*-\s*/u.test(raw) && !/^\s*-\s*(prompt|command|open_files):/u.test(raw)
                && raw.trim() !== '-' && raw.trim() !== '') {
                // A bare sequence item under `positives:` is a shape with no
                // `prompt:` key on its first line — folded or nested.
                if (!/^\s{4,}/u.test(raw)) {
                    problems.push(
                        `${f}:${String(lineNo)}: a positives entry whose first line carries no ` +
                            `\`prompt:\` key: ${JSON.stringify(raw.trim())}`,
                    );
                }
            }
            if (/^\s*open_files:\s*$/u.test(raw)) {
                problems.push(
                    `${f}:${String(lineNo)}: a BLOCK-sequence \`open_files:\` — only the inline ` +
                        '`[...]` form is read, so this entry\'s files would be dropped',
                );
            }
        }
    }
    return problems;
}

/** Every positive prompt in the frozen routing-matrix corpus. Near-misses are not fires. */
export function readCorpusPositives(root: string): CorpusPrompt[] {
    const dir = path.join(root, 'tests', 'eval', 'routing-matrix');
    const out: CorpusPrompt[] = [];
    if (!fs.existsSync(dir)) return out;
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.yaml')).sort()) {
        let inPositives = false;
        let cur: CorpusPrompt | null = null;
        for (const raw of fs.readFileSync(path.join(dir, f), 'utf-8').split('\n')) {
            if (/^positives:/u.test(raw)) { inPositives = true; continue; }
            if (/^near_misses:/u.test(raw)) { inPositives = false; continue; }
            if (!inPositives) continue;
            const p = /^\s*-\s*prompt:\s*"(.*)"\s*$/u.exec(raw);
            if (p !== null) {
                cur = { prompt: p[1] as string, openFiles: null };
                out.push(cur);
                continue;
            }
            const of = /^\s*open_files:\s*\[(.*)\]\s*$/u.exec(raw);
            if (of !== null && cur !== null) {
                cur.openFiles = (of[1] as string)
                    .split(',')
                    .map((x) => x.trim().replace(/^["']|["']$/gu, ''))
                    .filter((x) => x !== '');
            }
        }
    }
    return out;
}

/** Nearest-rank percentile over an unsorted sample. Empty sample → 0. */
export function percentile(xs: readonly number[], q: number): number {
    if (xs.length === 0) return 0;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] as number;
}

export interface SlotFireSizes {
    readonly slot: string;
    readonly fires: number;
    readonly p50: number;
    readonly p90: number;
    readonly max: number;
}

/**
 * Gate-open per-fire emission sizes for the delivery concern, per slot
 * (road-to-delivery-for-every-host 3.1).
 *
 * Measured through the SAME selection the runtime concern uses —
 * `matchTierRules` + `selectForInjection` at the concern's own `CAP_BYTES` —
 * rather than through a second model of it. An offline figure computed by a
 * different matcher would price a set the concern does not deliver.
 *
 * `pre_compact` is 0 by construction rather than by measurement: that branch of
 * `rule_inject_hook` clears the seen-set and returns allow without writing to
 * stdout, so there is no emission to sample.
 */
export function slotFireSizes(root: string): SlotFireSizes[] {
    const router = loadRouter(root);
    const prompts = readCorpusPositives(root);
    const sample = (mode: 'prompt' | 'file'): number[] => {
        const out: number[] = [];
        for (const r of prompts) {
            if (mode === 'file' && (r.openFiles === null || r.openFiles.length === 0)) continue;
            const matches =
                mode === 'prompt'
                    ? matchTierRules(router, r.prompt, null, null)
                    : matchTierRules(router, '', r.openFiles, null);
            if (matches.length === 0) continue;
            const sel = selectForInjection(root, matches, CAP_BYTES);
            if (sel.selected.length > 0) out.push(sel.bytes);
        }
        return out;
    };
    const row = (slot: string, xs: number[]): SlotFireSizes => ({
        slot,
        fires: xs.length,
        p50: percentile(xs, 0.5),
        p90: percentile(xs, 0.9),
        max: xs.length === 0 ? 0 : Math.max(...xs),
    });
    return [
        row('user_prompt_submit', sample('prompt')),
        row('pre_tool_use', sample('file')),
        row('pre_compact', []),
    ];
}

function headSha(root: string): string {
    return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
}

export function main(argv: readonly string[]): number {
    const root = REPO_ROOT;
    const problems = assertWritersResolve(root);
    if (problems.length > 0) {
        process.stderr.write('❌  a writer citation no longer resolves:\n');
        for (const p of problems) process.stderr.write(`  · ${p}\n`);
        return 1;
    }
    // R2 finding 10: an unreadable corpus shape is a refusal, never a silent
    // under-count of the distribution a budget row is derived from.
    const shape = corpusShapeProblems(root);
    if (shape.length > 0) {
        process.stderr.write(
            `❌  ${String(shape.length)} corpus entry/entries in a shape this reader cannot parse ` +
                '— the fire distribution would be under-counted:\n',
        );
        for (const p of shape) process.stderr.write(`  · ${p}\n`);
        return 1;
    }
    const pinIdx = argv.indexOf('--pin');
    const pin = pinIdx !== -1 && pinIdx + 1 < argv.length ? (argv[pinIdx + 1] as string) : headSha(root);
    // R2 finding 9: the pin is an assertion about HEAD, not a label.
    const badPin = pinProblem(root, pin);
    if (badPin !== null) {
        process.stderr.write(`❌  ${badPin}\n`);
        return 1;
    }
    if (argv.includes('--emit') && treeIsDirty(root) && !argv.includes('--allow-dirty')) {
        process.stderr.write(
            '❌  the working tree carries uncommitted changes under dist/agent-src/rules, ' +
                'src/scripts or tests/eval/routing-matrix, so the figures would not be reproducible ' +
                `at pin ${pin}. Commit first, or pass --allow-dirty to stamp the artifact as ` +
                'provisional.\n',
        );
        return 1;
    }
    if (argv.includes('--emit')) {
        const out = path.join(root, ARTIFACT_REL);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, renderArtifact(root, pin), 'utf-8');
        process.stdout.write(`wrote ${ARTIFACT_REL} · pin ${pin}\n`);
    }
    const corpus = readRuleCorpus(root);
    process.stdout.write(`scanned: ${String(HOST_SURFACES.length)} host(s)\n`);
    process.stdout.write(
        `  rule corpus ${String(corpus.files)} files · ${String(corpus.manual)} manual · ` +
            `${String(corpus.projected)} projected · ${String(corpus.projectedChars)} bytes · ` +
            `${String(tokensChars4(corpus.projectedChars))} chars/4 tok\n`,
    );
    // R2 finding 14: counted, not `length - 1`. The old form derived the `-1`
    // from the single current `writer: '—'` row, so a second surface-less host
    // reported a wrong count, and the ratio could never read anything but N/N.
    const cited = citedWriterCount();
    process.stdout.write(
        `  writer citations resolved: ${String(cited - problems.length)}/${String(cited)}\n`,
    );
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main(process.argv.slice(2)));
}
