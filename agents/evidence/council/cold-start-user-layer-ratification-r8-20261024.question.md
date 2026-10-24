<!-- evidence-type: analysis -->

# Ratification review — the user's own instruction layer in the `subagent-constraints` digest (road-to-a-cold-start-paid-once 2.5, decision D16) — round 8

You are an independent reviewer for a change in the `event4u/agent-config` repository. The change edits files on the ratification gate's hook-plumbing list (`src/scripts/hook_manifest.yaml`, its compiled `hook_manifest.json`, `src/config/hook-bundle-budget.json`, `src/config/hook-token-budget.json`), so it needs a two-provider verdict under ADR-268 § 4: an agent may change the hook plumbing but may not ratify its own change.

## Background

`subagent-constraints` is an existing concern, ratified on 2026-10-24 as authority-expanding (`agents/evidence/ratifications/tick-shipped-path-20261024.md`). Bound on `claude` `subagent_start` only, it reads the definition the host will run for a subagent and, when that definition's frontmatter has `omitClaudeMd: true`, returns `additional_context` with a bounded digest of the project's `CLAUDE.md`, `.claude/CLAUDE.md` and `CLAUDE.local.md` files. A measurement on Claude Code 2.1.306 showed that such a subagent also loses the user-level layer (`<config dir>/CLAUDE.md` and `<config dir>/rules/`). On 2026-10-24 the repository owner directed that the carrier also deliver a digest of that user layer, with a priority order and a total byte cap, listing what was shown in full, cut or left out, and with the safety-floor and consequence-class rules first so that a cut drops other text before them.

## What the change does

1. **User layer.** When the subagent's definition skips its instruction files, the digest now also contains `<config dir>/CLAUDE.md` (`$CLAUDE_CONFIG_DIR`, else `~/.claude`), every file that CLAUDE.md imports one level deep through a line of the form `@path` (resolved against the config directory, `~/` against the home directory, each file read once), and the rules under `<config dir>/rules/`: each rule in `FLOOR_RULE_IDS` is read from its canonical path `<config dir>/rules/<id>.md` before any walk and outside its limit; every other `.md` file is found by a recursive, sorted walk of at most 500 files and identified by its path relative to the rules directory, so a nested file sharing a floor rule's name is an ordinary rule. Imports are deduplicated by their resolved real path. A rule is carried by its law only: the fenced blocks inside its Iron Law sections (section extent from the shared `_lib/rule_law_section` reader), else its first fenced block, else its first paragraph.
2. **Priority.** Room is handed out in this order: (a) the first law block of each rule in `FLOOR_RULE_IDS`, in that list's order, its later blocks not carried (owner decision D17, below). A first block is placed whole or not at all, never cut mid-text, and placing one must leave room to name every floor rule not yet placed; a rule carried by its first block has its own status, `first block only`, closed by the line `[later law blocks not carried]`, distinct from `cut` — the three `tier: safety-floor` rules, then the members of `src/config/rule-consequence-class.json`, held equal to both sources by a test; (b) the project files, nearest the project first; (c) the user CLAUDE.md and its imports; (d) every other rule's law. Sections print floor laws first, then the user files, then the project files root-most first, then the other laws.
3. **Inventory.** Only a count-only inventory (per layer: N full, N cut, N empty, N omitted) is reserved ahead of the floor laws; the named inventories take room after them, or the digest keeps the counts. The named form lists the project files and the user files with `full`, `cut`, `omitted` or `empty`, each inventory dropping whole entries and counting them when its bound is reached (a label is never shortened; a section whose heading does not fit is omitted and so listed; a directory too long for the header is described rather than printed); for rules it counts those shown in full and cut (each appears under its own heading) and those with no law text, and names the omitted ones until a 600-byte bound, then counts the rest.
4. **Cap.** The whole serialized reply line, JSON escaping included, is capped at 9,728 bytes (raised from 4,096; `EMISSION_MAX_BYTES` and the budget row carry the same number). Claude Code replaces an `additionalContext` longer than 10,000 characters with a file path and a 2,000-character preview, so the cap sits below that line. Measured over a real 106-rule user layer, the safety-floor and consequence-class laws in full came to about 8,400 escaped bytes. Under decision D17 the digest carries all 29 present floor rules (26 whole, 3 by their first law block with the later blocks listed as cut), cuts the project CLAUDE.md and lists the user CLAUDE.md and 76 other rules as omitted (named in part, the rest counted); the reply is 9,694 bytes.
5. **Chunk.** The concern's lazy chunk grows from 12,194 to 23,843 bytes; its ceiling moves 12,500 → 24,500 with one `raise_log` entry. The dispatch bundle is unchanged.
6. **Authority.** Unchanged in kind from the ratified concern, extended in scope: a user file or rule can permit as well as forbid, so the digest changes what such a subagent may decide; the concern grants no tool, file or process permission and writes nothing. The manifest comment and the concern header now say this covers the user's files too, and the header states that a user file can contradict a floor law and that both are delivered as written, with no ruling between them. Kill switch `AGENT_CONFIG_SUBAGENT_CONSTRAINTS=off`.

## Evidence

- Tests in `tests/hooks/subagent_constraints_hook.test.ts`, all failing before the change: a planted user CLAUDE.md line, an imported file's line and a planted user rule's law reach the digest and the rule's prose does not; with 31 floor laws, 80 other rules and large user and project files, every floor law appears whole and before the project section, and the reply stays under the cap; the cap holds for 200, 400, 800, 4,096 and 9,728 bytes under heavy escaping and emoji; the floor id list equals its two sources. Neutralising the floor priority makes the floor test fail.
- A live probe on Claude Code 2.1.310 (`agents/evidence/investigations/subagent-user-layer-live-probe-2026-10-24.md`): two fixture projects with an `omitClaudeMd` definition; the hook process given a fixture user layer. With the concern bound the subagent answered the user codeword from a user rule's law, the user reply prefix from the user CLAUDE.md and the project codeword; without it `NONE NONE NONE`; identical dispatch prompts.

## Rounds 1 to 7 and what changed

Questions committed as `agents/evidence/council/cold-start-user-layer-ratification-r{1..6}-20261024.question.md`. Rounds 1 to 4 were each refused 2/2 on a local defect, each fixed with a test seen red first: floor rules classified by basename, a file limit that could miss a floor rule, a doubly read import (round 1); a user inventory cut mid-entry (round 2); labels shortened at 160 bytes (round 3); later floor law blocks ranked below project and user files (round 4).

Round 5 was split; one seat refused because named inventories were reserved ahead of the floor laws (fixed: only a count-only inventory is reserved ahead of them) and named the floor overflow as an owner choice, decided as D17 (the owner's answer verbatim: "2"): each floor rule is carried by its first law block. Round 6 was split; one seat refused because a first block could still be cut mid-text with no distinct state (fixed: whole or not at all, a `first block only` status, room kept to name every floor rule left out).

Round 7 was refused 2/2 on one defect and one owner question. The defect: the code claimed every omitted floor rule is always named, but below a cap holding every floor name it falls back to a count, and below the size of the header and inventory the final cut could truncate the inventory. Fixed: the comment and the budget row now state what is enforced (named while the cap holds the names, the rest counted), and below the size of the header and its inventory the digest is a short diagnostic, or nothing when even that does not fit. Test seen red first: at a 1,400-byte cap the floor names end in `N more`; at 400 and 800 bytes the reply is a whole inventory or the diagnostic, never a truncated inventory; at 200 bytes, nothing. The owner question — precedence when even the first blocks overflow — went to the repository owner, who decided D18 on 2026-10-24 (the owner's answer verbatim: "1"): list order as built, the three safety-floor rules first, then the consequence-class rules alphabetically, each placed whole or left out, every left-out one named while the cap allows and counted after that. A test now pins that order. Question committed as `agents/evidence/council/cold-start-user-layer-ratification-r7-20261024.question.md`.

## What to answer

1. Does the diff contain a defect — in the digest, its priority, its byte accounting, the import handling, the rule reading, or the budget rows? Name file and line for each.
2. Does the change expand any agent's or hook's authority beyond the concern as already ratified? Is `effect: context` still an accurate description?
3. Is the priority order and the cap a sound reading of the directive, given the host's 10,000-character line?
4. Do you approve the change?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

Omitted below as generated or bookkeeping: `src/scripts/hook_manifest.json` (compiled from the YAML), the env-var row in `docs/contracts/hook-architecture-v1.md`, the tests and evidence files named above, and the roadmap edits. `git diff origin/main...drain/cold-start-20261024` shows the full change.

## The concern, in full after the change (`src/scripts/hooks/subagent_constraints_hook.ts`)

```ts
/**
 * Carries a project's instruction files, and the user's own `~/.claude` layer,
 * to a subagent whose definition skips them (road-to-a-tick-the-shipped-path-earns
 * 2.4; the user layer by owner directive of 2026-10-24, road-to-a-cold-start-paid-once
 * decision D16).
 *
 * A definition with `omitClaudeMd: true` starts without the project's CLAUDE.md
 * files; measured on Claude Code 2.1.306, it also loses the user-level layer
 * (`<config dir>/CLAUDE.md` and `<config dir>/rules/`). The kernel floor is baked
 * into the definition body, so what such a worker lacks is the consumer's own
 * constraints. This concern fires on the host's `SubagentStart`, whose
 * `additionalContext` the host adds to the subagent's context, and hands it one
 * bounded digest of both layers.
 *
 * Room is handed out in a fixed priority, so a cut drops the least binding text
 * first: the first Iron Law block of each safety-floor and consequence-class rule
 * ({@link FLOOR_RULE_IDS}; its later blocks are listed as cut, decision D17), then
 * the project's files nearest first, then the
 * user's CLAUDE.md and the files it imports, then every other user rule's Iron
 * Law blocks. A rule is carried by its law blocks only, never its whole body;
 * every file found is named in an inventory with what became of it, or counted
 * where a bounded inventory has no room for its name.
 *
 * This deliberately overrides part of `omitClaudeMd` for the instruction files,
 * and a project or user file can permit as well as forbid, so the concern
 * changes what such a subagent may decide; it grants no tool or file permission.
 * A user file can contradict a floor law, and both are delivered as written; the
 * digest carries no ruling between them. Each injection lands in its own
 * subagent's context; how many subagents a turn may start is not bounded here.
 *
 * It reads the definition the host will run — `<project>/.claude/agents/<type>.md`,
 * then `<config dir>/agents/<type>.md` — rather than a list of agent names, so a
 * definition that stops skipping stops receiving the digest. A type that is not
 * a plain id (a plugin's `plugin:agent`, a path) is not looked up.
 *
 * Ships in its own chunk (decision A9), `yaml` external like `chat_history`'s:
 * the dispatch bundle carries only its `LAZY_CONCERNS` row. Kill switch: `AGENT_CONFIG_SUBAGENT_CONSTRAINTS=off`.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { lawSections, ruleBody } from '../_lib/rule_law_section.js';
import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
import { readHookStdin } from './hook_stdin.js';

/**
 * The byte ceiling of the whole reply line this concern writes, JSON escaping
 * included; `hook-token-budget.json` registers the same number for it. Below
 * the host's 10,000-character line, past which Claude Code substitutes a path
 * and a preview for the whole `additionalContext`.
 */
export const EMISSION_MAX_BYTES = 9_728;

/** The files the host loads per directory and `omitClaudeMd` skips, in load order. */
export const INSTRUCTION_FILES: readonly string[] = ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md'];

/**
 * Rules whose law is handed room before anything else: the `tier: safety-floor`
 * rules, then the members of `src/config/rule-consequence-class.json`. Kept as
 * ids here so the chunk carries no config file; a test holds the list equal to
 * both sources.
 */
export const FLOOR_RULE_IDS: readonly string[] = [
    'non-destructive-by-default',
    'scope-control',
    'commit-policy',
    'autonomous-execution',
    'broken-access-control',
    'command-suggestion-policy',
    'decision-revisit-gate',
    'doc-screenshot-hygiene',
    'domain-safety-disclaimer',
    'domain-safety-pii',
    'domain-safety-retention',
    'engineering-safety-floor',
    'evaluator-independence',
    'fast-path-marker-visibility',
    'finance-safety-floor',
    'git-history-discipline',
    'image-likeness-and-rights',
    'legal-safety-floor',
    'lethal-trifecta-guard',
    'low-impact-corpus-privacy-floor',
    'question-not-instruction',
    'runtime-safety',
    'secret-vcs-guard',
    'security-sensitive-stop',
    'session-canary',
    'settings-ask-protocol',
    'source-confidentiality',
    'strategy-safety-floor',
    'tool-safety',
    'untrusted-input-defense',
    'user-interrupt-priority',
];

const AGENT_TYPE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
const REPLY_OVERHEAD = Buffer.byteLength(`${JSON.stringify({ additional_context: '' })}\n`, 'utf-8');
const CUT = '\n[cut here]';
/** Closes a floor rule carried by its first law block (decision D17). */
const LATER = '\n[later law blocks not carried]';
/** A file with less room than this left is listed as omitted rather than shown as a stub. */
const MIN_SHOWN = 120;
/** Escaped-byte bounds on the fixed part, so bodies keep most of the room. */
/** A directory longer than this is described rather than printed; a label is never shortened. */
const ROOT_MAX = 400;
const INVENTORY_MAX = 1_200;
const USER_INVENTORY_MAX = 400;
const RULES_INVENTORY_MAX = 600;
const MAX_RULE_FILES = 500;
const IMPORT_LINE = /^@(\S+)\s*$/gm;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(o: Obj, ...keys: string[]): string | null {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'string' && v !== '') return v;
    }
    return null;
}

/** True when the definition the host runs for `agentType` parses `omitClaudeMd` as `true`. */
export function definitionSkipsInstructions(projectDir: string, agentType: string, configDir: string): boolean {
    if (!AGENT_TYPE.test(agentType)) return false;
    for (const dir of [path.join(projectDir, '.claude', 'agents'), path.join(configDir, 'agents')]) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(dir, `${agentType}.md`), 'utf-8');
        } catch {
            continue;
        }
        const fm = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
        if (fm === null) return false;
        try {
            const data: unknown = parseYaml(fm[1] as string);
            return isObj(data) && data['omitClaudeMd'] === true;
        } catch {
            return false;
        }
    }
    return false;
}

/** `start` and its ancestors up to the nearest directory holding `.git`, root-most first. */
export function instructionDirs(start: string): string[] {
    const chain: string[] = [];
    let dir = path.resolve(start);
    for (;;) {
        chain.push(dir);
        if (fs.existsSync(path.join(dir, '.git'))) return chain.reverse();
        const up = path.dirname(dir);
        if (up === dir) return [path.resolve(start)];
        dir = up;
    }
}

/** Bytes `s` occupies inside a JSON string literal. */
function escBytes(s: string): number {
    return Buffer.byteLength(JSON.stringify(s), 'utf-8') - 2;
}

/** The longest prefix of `s` within `budget` escaped bytes, cut at a line end when one is in reach. */
function fitEscaped(s: string, budget: number): string {
    if (escBytes(s) <= budget) return s;
    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (escBytes(s.slice(0, mid)) <= budget) lo = mid;
        else hi = mid - 1;
    }
    let cut = s.slice(0, lo);
    if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
    const nl = cut.lastIndexOf('\n');
    return nl > cut.length / 2 ? cut.slice(0, nl) : cut;
}

function clean(text: string): string {
    return text.replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function readText(file: string): string | null {
    try {
        return fs.statSync(file).isFile() ? fs.readFileSync(file, 'utf-8') : null;
    } catch {
        return null;
    }
}

/**
 * A rule's law as the digest carries it: the fenced blocks inside its Iron Law
 * sections (`rule_law_section`'s extent), else its first fenced block, else its
 * first paragraph. The prose around a law is left for the file itself.
 */
export function ruleLaw(text: string): string {
    return ruleLawBlocks(text).join('\n\n').trim();
}

/** {@link ruleLaw} as its separate blocks, in document order. */
export function ruleLawBlocks(text: string): string[] {
    const body = ruleBody(text.replace(/\r\n/g, '\n'));
    const fences = (s: string): string[] =>
        [...s.matchAll(/^[ \t]*```[^\n]*\n([\s\S]*?)^[ \t]*```/gm)].map((m) => (m[1] as string).trimEnd());
    let blocks = lawSections(body).flatMap((sec) => fences(sec.text));
    if (blocks.length === 0) blocks = fences(body).slice(0, 1);
    if (blocks.length === 0) blocks = [body.split(/\n\s*\n/).find((para) => !/^\s*#/.test(para))?.trim() ?? ''];
    return blocks.filter((b) => b !== '');
}

interface Found {
    readonly label: string;
    readonly body: string;
    /** Allocation rank: lower is handed room first. */
    readonly rank: number;
    /** Order within a rank, for room and for print alike. */
    readonly sub: number;
    /** A floor rule with law blocks after its first: shown as `first-block`, never `full`. */
    readonly partial?: boolean;
    readonly layer: 'project' | 'user' | 'rule';
}

/** Every `.md` under `dir`, recursively, sorted, at most {@link MAX_RULE_FILES}; `skip` names top-level files left out. */
function ruleFiles(dir: string, skip: ReadonlySet<string> = new Set()): string[] {
    const out: string[] = [];
    const walk = (d: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(d, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            if (out.length >= MAX_RULE_FILES) return;
            const abs = path.join(d, e.name);
            if (e.isDirectory()) walk(abs);
            else if (e.isFile() && e.name.endsWith('.md') && !(d === dir && skip.has(e.name))) out.push(abs);
        }
    };
    walk(dir);
    return out;
}

/** `file` resolved through symlinks, or lexically when it cannot be. */
function canonical(file: string): string {
    try {
        return fs.realpathSync(file);
    } catch {
        return path.resolve(file);
    }
}

/**
 * The user layer: `<config dir>/CLAUDE.md`, the files it imports one level deep
 * (each read once, whatever path names it), and every rule's law.
 *
 * A floor rule is read from its canonical place, `<config dir>/rules/<id>.md`,
 * before the walk and outside its file limit; a file elsewhere in the tree that
 * shares its name is an ordinary rule under its own relative path.
 */
function userLayer(configDir: string): Found[] {
    const found: Found[] = [];
    const main = readText(path.join(configDir, 'CLAUDE.md'));
    if (main !== null) {
        found.push({ label: 'user:CLAUDE.md', body: clean(main), rank: 2, sub: 0, layer: 'user' });
        const seen = new Set<string>([canonical(path.join(configDir, 'CLAUDE.md'))]);
        for (const m of main.matchAll(IMPORT_LINE)) {
            const ref = m[1] as string;
            const abs = ref.startsWith('~/') ? path.join(os.homedir(), ref.slice(2)) : path.resolve(configDir, ref);
            const key = canonical(abs);
            if (seen.has(key)) continue;
            const text = readText(abs);
            if (text === null) continue;
            seen.add(key);
            const rel = path.relative(configDir, abs);
            const label = rel.startsWith('..') || path.isAbsolute(rel) ? abs : rel;
            found.push({ label: `user:${label}`, body: clean(text), rank: 2, sub: found.length, layer: 'user' });
        }
    }
    const rulesDir = path.join(configDir, 'rules');
    const floorIds = new Set(FLOOR_RULE_IDS);
    FLOOR_RULE_IDS.forEach((id, pos) => {
        const text = readText(path.join(rulesDir, `${id}.md`));
        if (text === null) return;
        const blocks = ruleLawBlocks(text);
        const partial = blocks.length > 1;
        found.push({ label: id, body: `${blocks[0] ?? ''}${partial ? LATER : ''}`, rank: 0, sub: pos, layer: 'rule', ...(partial ? { partial } : {}) });
    });
    for (const file of ruleFiles(rulesDir, new Set(FLOOR_RULE_IDS.map((id) => `${id}.md`)))) {
        const id = path.relative(rulesDir, file).split(path.sep).join('/').replace(/\.md$/, '');
        if (floorIds.has(id)) continue;
        const text = readText(file);
        if (text === null) continue;
        found.push({ label: id, body: ruleLawBlocks(text).join('\n\n'), rank: 3, sub: found.length, layer: 'rule' });
    }
    return found;
}

/** `dir` as printed in the header, or a description of it when it is too long to print whole. */
function dirName(dir: string, what: string): string {
    return escBytes(dir) <= ROOT_MAX ? dir : `${what} (its path is over ${ROOT_MAX} bytes and not printed)`;
}

/**
 * Both layers as one block whose serialized reply fits in `maxBytes`, or null
 * when there is nothing to carry. `configDir` null leaves the user layer out.
 *
 * Room goes in rank order (see the file header); within the project files the
 * one nearest the project directory comes first, because it is the most
 * specific. Sections print floor laws first, then the user's files, then the
 * project's root-most first (the order the host loads them), then the other laws.
 */
export function instructionDigest(
    projectDir: string,
    maxBytes: number = EMISSION_MAX_BYTES,
    configDir: string | null = null,
): string | null {
    const dirs = instructionDirs(projectDir);
    const root = dirs[0] as string;
    const project: Found[] = [];
    for (const dir of dirs) {
        for (const rel of INSTRUCTION_FILES) {
            const text = readText(path.join(dir, rel));
            if (text === null) continue;
            const label = path.relative(root, path.join(dir, rel)) || rel;
            project.push({ label, body: clean(text), rank: 1, sub: 0, layer: 'project' });
        }
    }
    const user = configDir === null ? [] : userLayer(configDir);
    const found = [...project, ...user];
    if (found.every((f) => f.body === '')) return null;
    const withUser = configDir !== null;
    const head =
        `A bounded digest of ${withUser ? "this project's instruction files and the user's own instruction layer" : "this project's instruction files"}, ` +
        'which this subagent\'s definition omitted at startup (omitClaudeMd). It is not the files as the host loads them: ' +
        `comments are removed${withUser ? ', a user rule is carried by its Iron Law blocks only' : ''} and a file may be cut or omitted, as listed below; ` +
        `read a listed file before relying on its missing part. Project paths are relative to ${dirName(root, 'the project root')}` +
        `${withUser ? `; user: files and rules are under ${dirName(configDir, "the host's config directory")}` : ''}.`;
    const status: string[] = found.map((f) => (f.body === '' ? 'empty' : 'omitted'));
    const idx = (layer: Found['layer']): number[] => found.flatMap((f, i) => (f.layer === layer ? [i] : []));
    // Nearest project files are listed by name first; the rest are counted when the names would not fit.
    const projectInventory = (): string => {
        const named = idx('project').map((i) => `${(found[i] as Found).label} (${status[i]})`);
        if (named.length === 0) return '';
        let from = 0;
        const render = (): string =>
            from === named.length
                ? `Files: ${from} not named.`
                : `Files, nearest last: ${from > 0 ? `${from} nearer the root not named, ` : ''}${named.slice(from).join(', ')}.`;
        while (from < named.length && escBytes(render()) > INVENTORY_MAX) from += 1;
        return render();
    };
    // Whole entries in load order; the ones that do not fit are counted, never cut mid-name.
    const userInventory = (): string => {
        const named = idx('user').map((i) => `${(found[i] as Found).label} (${status[i]})`);
        if (named.length === 0) return '';
        let keep = named.length;
        const render = (): string => {
            const more = named.length - keep;
            const tail = more === 0 ? '' : keep === 0 ? `${more} not named` : `, ${more} more not named`;
            return `User files: ${named.slice(0, keep).join(', ')}${tail}.`;
        };
        while (keep > 0 && escBytes(render()) > USER_INVENTORY_MAX) keep -= 1;
        return render();
    };
    // Rule names grouped by what became of them; omitted names give way to a count first.
    // Shown rules carry their own heading below, so they are counted here and only omitted ones named.
    const rulesInventory = (): string => {
        const rules = idx('rule');
        if (rules.length === 0) return '';
        const count = (st: string): number => rules.filter((i) => status[i] === st).length;
        const omitted = rules.filter((i) => status[i] === 'omitted').map((i) => (found[i] as Found).label);
        let keep = omitted.length;
        const render = (): string => {
            const more = omitted.length - keep;
            const names = `${omitted.slice(0, keep).join(', ')}${more > 0 ? `${keep > 0 ? ', ' : ''}${more} more not named` : ''}`;
            return (
                `User rules (Iron Law blocks): ${count('full')} full, ${count('first-block')} first block only, ${count('cut')} cut, as headed below; ` +
                `${count('empty')} empty; ${omitted.length} omitted${omitted.length > 0 ? `: ${names}` : ''}.`
            );
        };
        while (keep > 0 && escBytes(render()) > RULES_INVENTORY_MAX) keep -= 1;
        return render();
    };
    const named = (): string => [projectInventory(), userInventory(), rulesInventory()].filter((l) => l !== '').join('\n');
    // The count-only form is all that is reserved ahead of the floor laws: it reports every
    // omission in a few dozen bytes. `all` sizes it with every count at its layer's total.
    const counted = (all = false): string => {
        const line = (layer: Found['layer'], name: string): string => {
            const members = idx(layer);
            if (members.length === 0) return '';
            const n = (st: string): number => (all ? members.length : members.filter((i) => status[i] === st).length);
            const first = layer === 'rule' ? `${n('first-block')} first block only, ` : '';
            return `${name}: ${n('full')} full, ${first}${n('cut')} cut, ${n('empty')} empty, ${n('omitted')} omitted`;
        };
        const rules = line('rule', 'User rules (Iron Law blocks)');
        const floorLeft = all ? '' : floorOmitted.length > 0 ? `; floor rules omitted: ${floorOmitted.join(', ')}` : '';
        return [line('project', 'Files'), line('user', 'User files'), rules === '' ? '' : `${rules}${floorLeft}`]
            .filter((l) => l !== '')
            .map((l) => `${l}.`)
            .join('\n');
    };
    // Floor rules that did not fit, named in the count-only form when the room after them allows.
    let floorOmitted: string[] = [];
    const shown: string[] = found.map(() => '');
    let room = maxBytes - REPLY_OVERHEAD - escBytes(`${head}\n`) - escBytes(counted(true));
    // The named form is upper-bounded with every not-yet-placed file as `omitted`, the longest status.
    const namedBound = (): number => escBytes(named()) + (idx('rule').length > 0 ? RULES_INVENTORY_MAX - escBytes(rulesInventory()) : 0);
    let useNamed = false;
    const frameOf = (f: Found): string => `\n\n--- ${f.layer === 'rule' ? 'rule ' : ''}${f.label} ---\n`;
    // Project files go nearest first; every other rank keeps its `sub` order.
    const subOf = (i: number): number => ((found[i] as Found).layer === 'project' ? -i : (found[i] as Found).sub);
    const allocation = found.map((_, i) => i).sort((x, y) => (found[x] as Found).rank - (found[y] as Found).rank || subOf(x) - subOf(y));
    const floorQueue = allocation.filter((j) => (found[j] as Found).rank === 0 && (found[j] as Found).body !== '');
    const namesCost = (names: string[]): number => (names.length === 0 ? 0 : escBytes(`; floor rules omitted: ${names.join(', ')}`));
    let floorSettled = false;
    const settleFloor = (): void => {
        if (floorSettled) return;
        floorSettled = true;
        const left = found.flatMap((f, i) => (f.rank === 0 && status[i] === 'omitted' && f.body !== '' ? [f.label] : []));
        for (let keep = left.length; keep > 0; keep -= 1) {
            const names = [...left.slice(0, keep), ...(keep < left.length ? [`${left.length - keep} more`] : [])];
            const cost = escBytes(`; floor rules omitted: ${names.join(', ')}`);
            if (cost <= room) {
                floorOmitted = names;
                room -= cost;
                return;
            }
        }
    };
    for (const i of allocation) {
        const f = found[i] as Found;
        if (f.rank > 0 && !useNamed && i === allocation.find((j) => (found[j] as Found).rank > 0)) {
            settleFloor();
            const extra = namedBound() - escBytes(counted(true));
            // An omitted floor rule keeps the count-only form, which names it; the named form may count it.
            if (floorOmitted.length === 0 && extra <= room) {
                useNamed = true;
                room -= extra;
            }
        }
        if (f.body === '') continue;
        const frame = escBytes(frameOf(f));
        // A floor law block is placed whole or not at all: a cut law reads as a different law.
        // Placing one must leave room to name every floor rule not yet placed, so an omitted
        // floor rule is named whenever the cap holds every floor name; below that, the names
        // that fit are given and the rest counted.
        if (f.rank === 0) {
            const after = floorQueue.filter((j) => j !== i && status[j] === 'omitted').map((j) => (found[j] as Found).label);
            if (frame + escBytes(f.body) + namesCost(after) > room) continue;
            shown[i] = f.body;
            status[i] = f.partial === true ? 'first-block' : 'full';
            room -= frame + escBytes(f.body);
            continue;
        }
        if (room - frame < MIN_SHOWN) continue;
        if (escBytes(f.body) <= room - frame) {
            shown[i] = f.body;
            status[i] = 'full';
        } else {
            shown[i] = `${fitEscaped(f.body, room - frame - escBytes(CUT))}${CUT}`;
            status[i] = 'cut';
        }
        room -= frame + escBytes(shown[i] as string);
    }
    const printRank = (i: number): number => {
        const f = found[i] as Found;
        return f.layer === 'rule' ? (f.rank === 0 ? 0 : 3) : f.layer === 'user' ? 1 : 2;
    };
    const printSub = (i: number): number => ((found[i] as Found).layer === 'project' ? i : (found[i] as Found).sub);
    const printed = found.map((_, i) => i).sort((a, b) => printRank(a) - printRank(b) || printSub(a) - printSub(b));
    const sections = printed.map((i) => (status[i] === 'full' || status[i] === 'cut' || status[i] === 'first-block' ? `${frameOf(found[i] as Found)}${shown[i] as string}` : ''));
    // The serialized line is the final authority: whatever the parts measured, the reply never exceeds maxBytes.
    settleFloor();
    if (!useNamed && floorOmitted.length === 0 && allocation.every((j) => (found[j] as Found).rank === 0)) {
        useNamed = namedBound() - escBytes(counted(true)) <= room;
    }
    const fixed = `${head}\n${useNamed ? named() : counted()}`;
    // Below the size of the header and its inventory, a short diagnostic replaces a truncated one.
    if (escBytes(fixed) > maxBytes - REPLY_OVERHEAD) {
        const note =
            `The digest of the instruction files this subagent's definition omitted (omitClaudeMd) did not fit in ${maxBytes} bytes; ` +
            "read the project's CLAUDE.md files and the user's CLAUDE.md and rules before relying on any instruction.";
        return escBytes(note) <= maxBytes - REPLY_OVERHEAD ? note : null;
    }
    return fitEscaped(`${fixed}${sections.join('')}`, maxBytes - REPLY_OVERHEAD);
}

/** The reply line for one digest. */
export function replyLine(digest: string): string {
    return `${JSON.stringify({ additional_context: digest })}\n`;
}

/** The digest to inject for one dispatcher envelope, or null. */
export function digestFor(envelope: unknown, env: NodeJS.ProcessEnv = process.env): string | null {
    if (env['AGENT_CONFIG_SUBAGENT_CONSTRAINTS'] === 'off' || !isObj(envelope)) return null;
    if (envelope['event'] !== undefined && envelope['event'] !== 'subagent_start') return null;
    const payload = isObj(envelope['payload']) ? envelope['payload'] : envelope;
    const agentType = str(payload, 'agent_type', 'agentType', 'subagent_type', 'subagentType');
    if (agentType === null) return null;
    const projectDir =
        str(envelope, 'workspace_root', 'project_root') ?? str(payload, 'cwd') ?? env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
    const configDir = env['CLAUDE_CONFIG_DIR'] || path.join(os.homedir(), '.claude');
    if (!definitionSkipsInstructions(projectDir, agentType, configDir)) return null;
    return instructionDigest(projectDir, EMISSION_MAX_BYTES, configDir);
}

export function main(): number {
    try {
        const raw = readHookStdin();
        const digest = digestFor(raw.trim() ? JSON.parse(raw) : {});
        if (digest === null) return EXIT_ALLOW;
        process.stdout.write(replyLine(digest));
        return EXIT_WARN;
    } catch {
        return EXIT_ALLOW;
    }
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (isCliEntry()) process.exit(main());
```

## The budget and manifest diff

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 22a77faca9..8df2391bd1 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -64,6 +64,16 @@
             "what_was_added": "The invisible-character normalisation of one-detector 2.5 wired into the engine: `replaceValues` and `tallyText` now detect through `egress_normalize.ts` (`detectWithExtent`), and a rule's extent reader (`through`) runs on the normalised text with its end mapped back, so a key block whose BEGIN and END markers both carry a zero-width character is removed whole instead of refused or left behind. Measured 30,511 bytes on origin/main, 31,907 with the wiring alone, 32,305 with the extent fix.",
             "why_it_could_not_be_avoided": "The 2026-10-18 derivation queued this rescan inside the 32,000 ceiling and the 2026-10-22 raise recorded it as not yet in the chunk. Room was taken first: `LATIN_TWIN` moved out of confusables.ts as a hex-encoded string pair so the chunk no longer carries that module's four script regexes, and the normaliser keeps one origin array instead of two (32,670 down to 31,907). The extent fix that a council seat found in round 1 of the ratification review adds about 400 bytes of mapping code no smaller form carries. The chunk loads only when a caller needs detection; the dispatch bundle is unchanged.",
             "what_would_have_caught_it": "Measuring the wired engine when 2.5 was first built rather than the unwired module, and a disguised-marker key block in the extent tests from the start."
+        },
+        {
+            "date": "2026-10-24",
+            "chunk": "src/scripts/hooks/subagent_constraints_hook.ts",
+            "from": 12500,
+            "to": 24500,
+            "by": "agent, drain/cold-start-20261024 (road-to-a-cold-start-paid-once 2.5, owner directive D16)",
+            "what_was_added": "The user's own instruction layer in the subagent-constraints digest: `<config dir>/CLAUDE.md`, the files it imports one level deep, and every rule under `<config dir>/rules/` carried by its Iron Law blocks, with a fixed priority (the first law block of each safety-floor and consequence-class rule first, its later blocks listed as cut, then the project files, the user files and the other rules), a grouped rules inventory, and the shared `_lib/rule_law_section` reader for where a law section ends. Measured 12,194 bytes on the base and 23,843 with the change. The ratification rounds added whole-entry inventories, canonical floor-rule reads, import deduplication by real path, a count-only reservation ahead of the floor laws, and whole-or-nothing placement of each floor rule's first law block with room kept to name any floor rule left out.",
+            "why_it_could_not_be_avoided": "The owner kept #2639 open until a skipping worker also receives the user layer, so the code has to ship in this chunk, which is the only carrier on the host's SubagentStart path. Reusing `rule_law_section` instead of a second law-extent parser costs bytes but keeps one definition of a law section across the projector, the lint and this concern. The chunk loads only on claude `subagent_start`; the dispatch bundle is unchanged.",
+            "what_would_have_caught_it": "Scoping step 2.4's carrier against the 2026-10-22 probe, which already showed the skip dropping the user rule layer, instead of against the project CLAUDE.md files alone."
         }
     ],
     "chunks": [
@@ -105,9 +115,9 @@
         },
         {
             "entry": "src/scripts/hooks/subagent_constraints_hook.ts",
-            "max_bytes": 12500,
+            "max_bytes": 24500,
             "registered_at": "2026-10-24",
-            "derivation": "Measured 12,131 bytes on 2026-10-24 (the concern and the hook stdin reader, `yaml` external as for `chat_history`: the concern parses one definition's frontmatter with it). The ceiling is that reading plus about 3 %, rounded, with no growth queued. road-to-a-tick-the-shipped-path-earns 2.4 under decision A9 (council, 2026-10-23): the constraint carrier ships as a lazy chunk with its own ceiling, and the dispatch ceiling is not raised. Its LAZY_CONCERNS row measured +159 bytes in the dispatch bundle (1,553,363 to 1,553,522 B, same gate run on the base and with the row), under the existing 1,554,000 ceiling, so no loader stub raise was needed. Bound on claude `subagent_start` alone; a missing chunk falls back to the spawn path and costs latency, never the digest."
+            "derivation": "Measured 23,843 bytes on 2026-10-24 (the concern with the user layer of road-to-a-cold-start-paid-once D16, the shared `_lib/rule_law_section` law-extent reader, and the hook stdin reader; `yaml` external as for `chat_history`). The ceiling is that reading plus about 3 %, rounded, with no growth queued; the 2026-10-24 raise from 12,500 is the matching `raise_log` entry. road-to-a-tick-the-shipped-path-earns 2.4 under decision A9 (council, 2026-10-23): the constraint carrier ships as a lazy chunk with its own ceiling, and the dispatch ceiling is not raised. Its LAZY_CONCERNS row measured +159 bytes in the dispatch bundle (1,553,363 to 1,553,522 B, same gate run on the base and with the row), under the existing 1,554,000 ceiling, so no loader stub raise was needed. Bound on claude `subagent_start` alone; a missing chunk falls back to the spawn path and costs latency, never the digest."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
diff --git a/src/config/hook-token-budget.json b/src/config/hook-token-budget.json
index 9bc95b1915..7a40295422 100644
--- a/src/config/hook-token-budget.json
+++ b/src/config/hook-token-budget.json
@@ -27,8 +27,8 @@
   "reread-guard": 1024,
   "reread-guard_reason": "one advisory line naming the earlier read / ranged alternative (roadmap 6.1)",
   "memory-recall": 768,
-  "subagent-constraints": 4096,
-  "subagent-constraints_reason": "road-to-a-tick-the-shipped-path-earns 2.4: the constraint carrier for a subagent whose definition sets omitClaudeMd. One fire per such subagent start, into the SUBAGENT's context, never the parent turn's: a digest of the project's CLAUDE.md files whose whole serialized reply line, JSON escaping included, is capped at EMISSION_MAX_BYTES in hooks/subagent_constraints_hook.ts, this same number. Room goes to the file nearest the project first, and every file found is named with whether it was shown in full, cut or omitted. Silent for every subagent whose definition loads the instruction files.",
+  "subagent-constraints": 9728,
+  "subagent-constraints_reason": "road-to-a-tick-the-shipped-path-earns 2.4: the constraint carrier for a subagent whose definition sets omitClaudeMd. One fire per such subagent start, into the SUBAGENT's context, never the parent turn's: a digest of the project's CLAUDE.md files and, since road-to-a-cold-start-paid-once D16 (owner directive 2026-10-24), of the user's own layer (CLAUDE.md, its imports, and every rule's Iron Law blocks), whose whole serialized reply line, JSON escaping included, is capped at EMISSION_MAX_BYTES in hooks/subagent_constraints_hook.ts, this same number. RAISED 4096 -> 9728 by D16: the safety-floor and consequence-class laws alone measured about 8,400 escaped bytes over a full user rule layer, and the host substitutes a path and a 2,000-character preview for any additionalContext over 10,000 characters, so the cap stays below that line rather than at the laws' size. Only a count-only inventory is reserved ahead of the floor laws; the named inventories take room after them or give way to counts. A floor rule is carried by its first law block, its later blocks listed as cut (owner decision D17). Measured on a full user layer (106 rules): a 9,694-byte reply carrying all 29 present floor and consequence-class rules (26 whole, 3 by their first block; a first block is placed whole or not at all, and room is kept to name any floor rule left out), the project CLAUDE.md cut, the user CLAUDE.md omitted and 76 rules omitted, named in part. Room goes to the floor laws first, then the project file nearest the project, then the user files, then the other rules, and every file found is named with whether it was shown in full, cut or omitted, or counted where a bounded inventory has no room for its name. Silent for every subagent whose definition loads the instruction files.",
   "memory-recall_reason": "ONE memory pointer per fire: the slug, one authored why-now clause, the absolute path, and the memory's OWN frontmatter description, truncated so the emission is provably under this number (`CAP_BYTES` in hooks/memory_recall_hook.ts is the same constant, enforced at emission by buildEmission rather than left to the bench to notice). Registered BELOW the 1024 default deliberately, for the reason `skill-route` gives for its 512: this row is the ceiling that keeps the concern a POINTER. A memory file in this store runs 1.5-6 kB, so a later change that starts injecting bodies fails the build instead of quietly multiplying the hottest slot in the manifest by ten. Measured emission over the four seeded rules on the real store: 356-768 B, one of the four hitting the cap and truncating its description (`hook-latency-gate-has-runner-variance`, whose own description is 517 B).",
   "session-eol": 1024,
   "session-eol_reason": "one recycle-advisory line, once per session past the committed threshold (road-to-token-economy-recycling 3.2); recording itself emits nothing",
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 120823b216..5ef2d6dd10 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1401,12 +1401,15 @@ concerns:
   # subagent whose definition sets `omitClaudeMd`. On SubagentStart it reads the
   # definition the host runs (project, then user `.claude/agents/<type>.md`)
   # and, when that definition skips the instruction files, returns a bounded
-  # digest of the project's CLAUDE.md files as `additional_context`, which the
-  # host adds to the subagent's context. Silent for every other subagent.
+  # digest of the project's CLAUDE.md files and the user's own layer (CLAUDE.md,
+  # its imports, each rule's Iron Law blocks; road-to-a-cold-start-paid-once D16)
+  # as `additional_context`, which the host adds to the subagent's context.
+  # Safety-floor and consequence-class laws get room first. Silent for every
+  # other subagent.
   # AUTHORITY: deliberately overrides part of `omitClaudeMd` for the project's
-  # own instruction files (the step's purpose), and a project file can permit as
-  # well as forbid, so this changes what such a subagent may decide; it grants no
-  # tool or file permission. Reviewed as authority-expanding, not as neutral.
+  # and the user's instruction files (the step's purpose), and such a file can
+  # permit as well as forbid, so this changes what such a subagent may decide; it
+  # grants no tool or file permission. Reviewed as authority-expanding, not as neutral.
   # Claude only: cowork's trampoline discards stdout. Loaded from its own chunk
   # (decision A9). Kill switch: `AGENT_CONFIG_SUBAGENT_CONSTRAINTS=off`.
   subagent-constraints:
```
