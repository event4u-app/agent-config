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
 * first: the Iron Law blocks of the safety-floor and consequence-class rules
 * ({@link FLOOR_RULE_IDS}), then the project's files nearest first, then the
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
        found.push({ label: id, body: ruleLawBlocks(text).join('\n\n'), rank: 0, sub: pos, layer: 'rule' });
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
                `User rules (Iron Law blocks): ${count('full')} full, ${count('cut')} cut, as headed below; ` +
                `${count('empty')} empty; ${omitted.length} omitted${omitted.length > 0 ? `: ${names}` : ''}.`
            );
        };
        while (keep > 0 && escBytes(render()) > RULES_INVENTORY_MAX) keep -= 1;
        return render();
    };
    const inventory = (): string => [projectInventory(), userInventory(), rulesInventory()].filter((l) => l !== '').join('\n');
    const reserve = Math.max(escBytes(inventory()), 0) + (idx('rule').length > 0 ? RULES_INVENTORY_MAX - escBytes(rulesInventory()) : 0);
    const shown: string[] = found.map(() => '');
    let room = maxBytes - REPLY_OVERHEAD - escBytes(`${head}\n`) - reserve;
    const frameOf = (f: Found): string => `\n\n--- ${f.layer === 'rule' ? 'rule ' : ''}${f.label} ---\n`;
    // Project files go nearest first; every other rank keeps its `sub` order.
    const subOf = (i: number): number => ((found[i] as Found).layer === 'project' ? -i : (found[i] as Found).sub);
    const allocation = found.map((_, i) => i).sort((x, y) => (found[x] as Found).rank - (found[y] as Found).rank || subOf(x) - subOf(y));
    for (const i of allocation) {
        const f = found[i] as Found;
        if (f.body === '') continue;
        const frame = escBytes(frameOf(f));
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
    const sections = printed.map((i) => (status[i] === 'full' || status[i] === 'cut' ? `${frameOf(found[i] as Found)}${shown[i] as string}` : ''));
    // The serialized line is the final authority: whatever the parts measured, the reply never exceeds maxBytes.
    return fitEscaped(`${head}\n${inventory()}${sections.join('')}`, maxBytes - REPLY_OVERHEAD);
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
