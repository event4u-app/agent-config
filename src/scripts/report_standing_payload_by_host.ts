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
    readonly note: string;
}

/**
 * The host axis, taken from `docs/enforcement-by-host.md:18-28` rather than
 * invented here, plus the writer each surface has in this tree.
 */
export const HOST_SURFACES: readonly HostSurface[] = [
    {
        host: 'augment', surface: '.augment/rules', perRuleTree: true,
        writer: 'src/scripts/condense.ts:2499',
        note: 'copies by default; symlinks under `augment.rules_use_symlinks`',
    },
    {
        host: 'claude-code', surface: '.claude/rules', perRuleTree: true,
        writer: 'src/scripts/condense.ts:1192',
        note: '`_emit_claude_rule` rewrites frontmatter to the host\'s own `paths:` key',
    },
    {
        host: 'cline', surface: '.clinerules', perRuleTree: true,
        writer: 'src/scripts/condense.ts:1194',
        note: 'symlink per rule into the projection',
    },
    {
        host: 'copilot', surface: '.github/copilot-instructions.md', perRuleTree: false,
        writer: 'src/scripts/generate_capability_matrix.ts:138',
        note: 'NOT written by `condense`: the installer aggregates it from `src/agent-src/templates/copilot-instructions.md`, which is why the capability matrix marks this cell `adapter` and footnotes it as install-time',
    },
    {
        host: 'cowork', surface: null, perRuleTree: false,
        writer: '—',
        note: 'no rule-tree writer in this tree; carries hook bindings only',
    },
    {
        host: 'cursor', surface: '.cursor/rules', perRuleTree: true,
        writer: 'src/scripts/condense.ts:1194',
        note: 'symlink per rule, plus `.mdc` companions at `condense.ts:1422`',
    },
    {
        host: 'gemini', surface: 'GEMINI.md', perRuleTree: false,
        writer: 'src/scripts/condense.ts:1498',
        note: 'single file',
    },
    {
        host: 'windsurf', surface: '.windsurfrules', perRuleTree: false,
        writer: 'src/scripts/condense.ts:1242',
        note: 'single concatenated file',
    },
    {
        host: 'codex', surface: '.codex/agent-config.md', perRuleTree: false,
        writer: 'src/scripts/install.ts:1541',
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
        }
    }
    return problems;
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
    L.push('- **chars/4** is what `check_preamble_payload_budget` reports, and its measured total at');
    L.push('  this pin is **138,200 tok** across three buckets (project-scope rules 122,608 ·');
    L.push('  preloaded skills catalog 14,846 · CLAUDE.md hierarchy 746).');
    L.push('- **Exact BPE** is the unit `docs/CLAIMS.md:365` uses for the delivery experiment:');
    L.push('  120,582 → 18,573 exact-BPE standing tokens for the rule corpus under');
    L.push('  `lean_projection.mode: delivery`. The two units are NOT interchangeable and no delta');
    L.push('  is computed between them here.');
    L.push('');
    L.push('**Reconciling the two rule figures, because they differ and both are right.** The');
    L.push('census bucket reads 122,608 chars/4 tok over the projection directory; the projected-set');
    const manualChars = manualCorpusChars(root);
    L.push(`row above reads ${String(tokensChars4(perTreeChars))}. The gap is the ${String(corpus.manual)} \`type: manual\` rules: the census counts every`);
    L.push(`\`.md\` in the directory, this table counts only what a per-tool tree receives. ${String(manualChars)} bytes`);
    L.push(`= ${String(tokensChars4(manualChars))} tok, and ${String(tokensChars4(perTreeChars))} + ${String(tokensChars4(manualChars))} = ${String(tokensChars4(perTreeChars) + tokensChars4(manualChars))}. A manual rule reaches no host tree`);
    L.push('by ADR-004, so excluding it is correct here and including it is correct there.');
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
    const pinIdx = argv.indexOf('--pin');
    const pin = pinIdx !== -1 && pinIdx + 1 < argv.length ? (argv[pinIdx + 1] as string) : headSha(root);
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
    process.stdout.write(`  writer citations resolved: ${String(HOST_SURFACES.length - 1)}/${String(HOST_SURFACES.length - 1)}\n`);
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main(process.argv.slice(2)));
}
