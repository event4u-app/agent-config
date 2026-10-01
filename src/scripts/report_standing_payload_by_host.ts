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
    corpusShapeProblems,
    slotFireSizes as sampleSlotFireSizes,
    type SlotFireSizes,
} from './_lib/activation_payload.js';
import { loadRouter, pathOnlyRuleIds } from './_lib/rule_injection.js';
// The windsurf emitter itself, not a second renderer beside it — 3.1 of
// `road-to-a-hook-bundle-with-one-yaml-reader`, whose Risk 3 is precisely a
// census that measures a file nobody receives.
import { render_windsurfrules } from './condense.js';
import { CAP_BYTES } from './hooks/rule_inject_hook.js';

// Re-exported rather than redefined: this module was their only home until the
// payload gate needed the same sample, and two copies is how two numbers start
// disagreeing. `corpusShapeProblems` and `SlotFireSizes` are imported above
// because this module's own code uses them; these two it only passes through.
export { percentile, readCorpusPositives } from './_lib/activation_payload.js';
export { corpusShapeProblems, type SlotFireSizes };

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
    /**
     * Where a SINGLE-FILE row's byte figure comes from. Absent on per-rule-tree
     * rows, which read the projection source like every other row.
     *
     * `road-to-a-hook-bundle-with-one-yaml-reader` 3.1. Until this field existed
     * every single-file row read its surface off disk with `fs.readFileSync`,
     * and three of the four surfaces are UNTRACKED generated projections. So the
     * published windsurf figure was a function of when the checkout last ran
     * `task generate-tools` — `absent` on a fresh worktree, some older byte count
     * on a stale one, and nothing in the artifact said which. A census whose
     * number moves with the measurer's housekeeping is not a measurement.
     *
     * Three kinds, and the rule that picks between them is reproducibility, not
     * convenience: `render` recomputes the surface from the emitter itself;
     * `tracked` reads a file that is IN GIT, so its bytes are the repository's;
     * `unrenderable` refuses with a named reason rather than publishing a figure
     * it cannot stand behind. Reading an untracked file is not one of the three.
     */
    readonly bytes?: ByteSource;
}

/** How a single-file surface's byte figure is obtained. See {@link HostSurface.bytes}. */
export type ByteSource =
    | {
          /** Recomputed in memory by the emitter that writes the surface. */
          readonly kind: 'render';
          readonly detail: string;
      }
    | {
          /** Read from a file tracked in git, so the figure is the repository's. */
          readonly kind: 'tracked';
          /** Repo-relative path actually read — not always `surface`. */
          readonly path: string;
          readonly detail: string;
      }
    | {
          /** No in-memory emitter and no tracked file: the row reports a refusal. */
          readonly kind: 'unrenderable';
          readonly reason: string;
      };

/**
 * The host axis, taken from `docs/enforcement-by-host.md:18-28` rather than
 * invented here, plus the writer each surface has in this tree.
 */
export const HOST_SURFACES: readonly HostSurface[] = [
    {
        host: 'augment', surface: '.augment/rules', perRuleTree: true,
        writer: 'src/scripts/condense.ts:2515',
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
        bytes: {
            kind: 'tracked',
            path: '.github/copilot-instructions.md',
            detail:
                'the surface is COMMITTED in this repository, so its bytes are the ' +
                'repository\'s rather than this checkout\'s. The installer aggregates a ' +
                'consumer\'s copy from a template at install time and there is no in-memory ' +
                'emitter to call here; a tracked read is reproducible on any clone, which is ' +
                'the property the figure needs.',
        },
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
        writer: 'src/scripts/condense.ts:1514',
        anchor: '\'GEMINI.md\'',
        note: 'single file — a symlink to the tracked `AGENTS.md`, so the bytes are that file\'s',
        bytes: {
            kind: 'tracked',
            path: 'AGENTS.md',
            detail:
                '`generate_gemini_md` writes a SYMLINK to `AGENTS.md` and no content of its ' +
                'own, so the emitter\'s output IS that file and reading it is calling the ' +
                'emitter. `GEMINI.md` itself is untracked and is never read for the figure — ' +
                'on a checkout that has not generated it, the row is unchanged.',
        },
    },
    {
        host: 'windsurf', surface: '.windsurfrules', perRuleTree: false,
        writer: 'src/scripts/condense.ts:1258',
        anchor: '\'.windsurfrules\'',
        note: 'single concatenated file, rendered here by `condense.render_windsurfrules` rather than read off disk',
        bytes: {
            kind: 'render',
            detail:
                'rendered in memory by `condense.render_windsurfrules`, the function ' +
                '`generate_windsurfrules` writes with — never a second renderer. It is fed the ' +
                'SAME unscoped, non-manual rule set every other row uses, not the install-local ' +
                'scoped-and-deduplicated set the writer passes, so it reports this table\'s ' +
                'stated unit: the upper bound a consumer install receives. Reading `.windsurfrules` ' +
                'off disk reported instead when the checkout last ran `task generate-tools`.',
        },
    },
    {
        host: 'codex', surface: '.codex/agent-config.md', perRuleTree: false,
        writer: 'src/scripts/install.ts:1431',
        // Scoped to `.codex` rather than the bare filename: nine other lines in
        // `install.ts` write an `agent-config.md` for some other host, so the
        // unscoped anchor would have accepted a drift onto any of them — the
        // bounds-test-wearing-a-provenance-test's-name failure this field exists
        // to close, one level down.
        anchor: '\'.codex\', \'agent-config.md\'',
        note: 'written by the installer, not by `condense`; absent in this checkout',
        bytes: {
            kind: 'unrenderable',
            reason:
                'written by the installer into a consumer project, not by any emitter this ' +
                'repository can call in memory, and not committed here. There is no byte count ' +
                'this tree can stand behind, so the row refuses rather than publishing one. It ' +
                'read `absent` before this change too — the difference is that `absent` then ' +
                'meant "not on this disk right now" and could have become a number on a ' +
                'checkout that happened to have run an install.',
        },
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

/**
 * Bytes of a file at `rel`, or `null` when it cannot be read.
 *
 * ONLY LEGITIMATE BEHIND A TRACKEDNESS CHECK, and `generate_host_cost_table` is
 * its one remaining caller — it tests `isTracked` first and reports
 * `unverifiable` otherwise, so what it reads is always in the committed tree.
 * THIS CENSUS NO LONGER USES IT: an unguarded read of an untracked generated
 * projection is the 3.1 defect, and `singleFileBytes` below is what replaced it
 * here. Kept rather than deleted because the guarded caller is correct as it
 * stands and rewriting it would change a different generated table.
 */
export function singleFileChars(root: string, rel: string): number | null {
    try {
        return Buffer.byteLength(fs.readFileSync(path.join(root, rel), 'utf-8'), 'utf-8');
    } catch {
        return null;
    }
}

/** The non-manual rules a per-tool tree receives — the unit every row in this table reports. */
export function projectedRuleBasenames(root: string): string[] {
    const dir = path.join(root, RULES_DIST_REL);
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .filter((f) => !isManualRule(fs.readFileSync(path.join(dir, f), 'utf-8')))
        .sort();
}

/** A single-file row's figure, with how it was obtained — or why there is none. */
export interface SingleFileMeasure {
    /** Bytes, or `null` when the row refuses. */
    readonly bytes: number | null;
    /** `render` · `tracked:<path>` · `refused` — printed in the artifact. */
    readonly how: string;
    /** Set when `bytes` is null. */
    readonly reason?: string;
}

/**
 * Bytes of a single-file surface, computed from what the tree GENERATES rather
 * than from what happens to sit on this disk.
 *
 * `road-to-a-hook-bundle-with-one-yaml-reader` 3.1. The predecessor
 * (`singleFileChars`) read the surface with `fs.readFileSync`, and three of the
 * four single-file surfaces are untracked generated projections — so the figure
 * it published was a reading of the measurer's housekeeping. This function never
 * reads an untracked file: it renders, reads a tracked one, or refuses.
 *
 * A row with no `bytes` declaration is a programming error rather than a
 * fallback to the old behaviour, and it throws. A silent fallback is how the
 * defect would come back one row at a time.
 */
export function singleFileBytes(root: string, h: HostSurface): SingleFileMeasure {
    const src = h.bytes;
    if (src === undefined) {
        throw new Error(
            `${h.host}: single-file surface with no \`bytes\` source declared. Declare render, ` +
                'tracked or unrenderable — reading the surface off disk is not an option here.',
        );
    }
    if (src.kind === 'unrenderable') {
        return { bytes: null, how: 'refused', reason: src.reason };
    }
    if (src.kind === 'tracked') {
        try {
            const text = fs.readFileSync(path.join(root, src.path), 'utf-8');
            return { bytes: Buffer.byteLength(text, 'utf-8'), how: `tracked:${src.path}` };
        } catch {
            return {
                bytes: null,
                how: 'refused',
                reason: `${src.path} is tracked but could not be read from this root`,
            };
        }
    }
    // `render` — windsurf is the only one, and the renderer is named rather than
    // dispatched on, because a table of host → renderer with one row is a lookup
    // pretending to be a mechanism.
    if (h.host !== 'windsurf') {
        throw new Error(`${h.host}: declares a render source but no renderer is wired for it`);
    }
    const text = render_windsurfrules(path.join(root, RULES_DIST_REL), projectedRuleBasenames(root));
    return { bytes: Buffer.byteLength(text, 'utf-8'), how: 'render' };
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
        const m = singleFileBytes(root, h);
        const bytes = m.bytes === null ? 'refused' : String(m.bytes);
        const toks = m.bytes === null ? 'refused' : String(tokensChars4(m.bytes));
        L.push(
            `| \`${h.host}\` | \`${h.surface}\` | single file (${m.how}) | ${bytes} | ${toks} | \`${h.writer}\` |`,
        );
    }
    L.push('');
    L.push('**Where the single-file figures come from.** Each is RENDERED by the emitter that writes');
    L.push('the surface, or read from a file tracked in git — never read off an untracked generated');
    L.push('projection, which is what the `(…)` in the Shape column names. Three of the four');
    L.push('single-file surfaces are untracked, so the earlier read-off-disk figure reported when');
    L.push('this checkout last ran `task generate-tools` rather than anything about the tree. A row');
    L.push('with neither an emitter nor a tracked file reads `refused` and says why below.');
    L.push('');
    L.push('Notes per host:');
    L.push('');
    for (const h of HOST_SURFACES) {
        L.push(`- \`${h.host}\` — ${h.note}`);
        if (h.bytes !== undefined) {
            const detail = h.bytes.kind === 'unrenderable' ? h.bytes.reason : h.bytes.detail;
            L.push(`  - bytes (\`${h.bytes.kind}\`): ${detail}`);
        }
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

/**
 * The activation-charge sample at the concern's own cap.
 *
 * The sampling itself moved to `_lib/activation_payload.ts` when the payload
 * gate needed the same figure (`road-to-the-delivery-flip-that-tells-the-truth`
 * 3.1). This wrapper supplies `CAP_BYTES` so the report's own callers keep the
 * one-argument form, and the helpers below are re-exported so there is still
 * exactly one implementation of each.
 */
export function slotFireSizes(root: string): SlotFireSizes[] {
    return sampleSlotFireSizes(root, CAP_BYTES);
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
