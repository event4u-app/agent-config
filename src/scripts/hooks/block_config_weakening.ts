#!/usr/bin/env node
// MIGRATE: precompiled-hook-layer — carry this hook when road-to-credible-install
// Phase 1 precompiles the hook path (touch-once preserved at migration).
/**
 * PreToolUse guard: "fix the code, not the config."
 *
 * The recorded antipattern (`autonomous-execution` § Antipattern —
 * allowlist-growth as silent budget bypass): during a fix loop the agent
 * weakens the gate instead of the code, growing a lint allowlist entry by
 * entry until the linter no longer objects. The rule already states the
 * threshold in words —
 *
 *     ALLOWLIST > 20 ENTRIES IN ONE SESSION = THE LINTER IS WRONG.
 *     STOP. PROPOSE LINTER REDESIGN OR REMOVAL.
 *
 * — and two linters cite it in their own failure messages. Nothing enforced
 * it: by the time CI sees the diff the session has already spent its budget
 * on the wrong fix. This hook moves that stated threshold to tool-call time.
 *
 * Deliberately NOT built (council 2026-08-02, anthropic/claude-sonnet-4-5 +
 * openai/gpt-4o):
 *
 * - **No invented "fix-loop is active" predicate.** Both members rejected it
 *   as speculative — no such state exists in the repo and defining entry/exit
 *   invites false positives in both directions. The SESSION is the window the
 *   recorded rule already names, so the session id off the hook envelope is
 *   the predicate, and it is not an invention.
 * - **No blocking on baselines or budgets.** Whether a violation-baseline
 *   count rising is weakening or a legitimate ratchet reset after a refactor
 *   is not mechanically decidable from the edit alone. Those surfaces warn
 *   (exit 2) and stay a review decision; only allowlist growth — mechanical,
 *   countable, and already carrying a stated numeric threshold — blocks.
 *
 * Cumulative within a session, per allowlist file. Small additions warn from
 * the first one so the count is visible while it is still cheap to change
 * course; crossing the recorded cap blocks.
 *
 * Exit codes (docs/contracts/hook-architecture-v1.md):
 *   0 — allow
 *   1 — block
 *   2 — warn
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as yaml from 'js-yaml';

import {
    buildSettingsClassIndex,
    classOfPath,
    parseSettingsClassRows,
    type SettingsClass,
} from '../../shared/settingsClasses.js';
import { EDIT_TOOLS } from '../minimal_safe_diff_hook.js';
import { readHookStdin } from './hook_stdin.js';
import { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN } from './exit_codes.js';

const _HERE = fileURLToPath(import.meta.url);

/**
 * This package's own root — where the shipped class contract lives.
 *
 * RESOLVED BY SEARCH, not by counting `..` segments. This file runs from three
 * layouts: the source tree, an installed `node_modules/@event4u/agent-config/`,
 * and inlined into `dist/hooks/dispatch.js`, where every module shares the
 * BUNDLE's `import.meta.url` and a fixed hop count lands somewhere else
 * entirely. A review flagged the fixed-hop version as resolving a different
 * root from the one the package occupies; walking up to the nearest directory
 * that actually carries the contract answers the question the guard is asking
 * ("where is the contract") instead of a proxy for it.
 *
 * `null` when no ancestor carries it — which is the fail-closed input to
 * `readClassIndex`, not a silent default root.
 */
export function findPackageRoot(from: string): string | null {
    let dir = path.dirname(from);
    for (let i = 0; i < 12; i++) {
        if (fs.existsSync(path.join(dir, SETTINGS_CLASSES_RELATIVE))) return dir;
        const up = path.dirname(dir);
        if (up === dir) break;
        dir = up;
    }
    return null;
}

/**
 * The stated cap from `autonomous-execution` § Antipattern. Crossing it in one
 * session is defined there as the third validation-target failure — the point
 * at which the linter, not the content, is wrong.
 */
export const SESSION_ENTRY_CAP = 20;

/** Warn from this many cumulative added entries so the count stays visible. */
export const SESSION_WARN_AT = 5;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function _isObject(v: JsonValue | undefined): v is JsonObject {
    return v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v);
}

const _PATH_KEYS: readonly string[] = ['file_path', 'path', 'target_file', 'filePath', 'notebook_path'];

/**
 * Config surfaces this guard recognises.
 *
 * `allowlist` is the blocking class — an entry count is a plain number and the
 * recorded rule already fixes its threshold. `advisory` covers the surfaces
 * where "weakening" needs context a tool call does not carry (a baseline count
 * may legitimately reset after a refactor); those warn and never block.
 */
export type ConfigKind = 'allowlist' | 'advisory' | 'class-c' | null;

/**
 * Project settings files whose keys this guard fences. User-global files are
 * never in reach — the hook only sees a path a tool call named, and the writes
 * that reach `~/.event4u/` go through `settings:set`, which applies its own
 * per-key refusal.
 */
const CLASS_C_BASENAMES: readonly string[] = ['.agent-settings.yml', '.agent-settings.yaml', 'settings.json'];

/** Where the class contract lives, relative to the package root. */
export const SETTINGS_CLASSES_RELATIVE = 'docs/contracts/settings-classes.md';

/** Classify a target path into a config surface, or null for everything else. */
export function classify_target(p: string): ConfigKind {
    const posix = p.split(path.sep).join('/');
    const base = posix.split('/').pop() ?? '';
    if (/_allowlist\.(json|txt)$/.test(base) || /^allowlist[-_.]/.test(base)) {
        return 'allowlist';
    }
    if (/(^|-)baselines?\.json$/.test(base)) {
        return 'advisory';
    }
    if (/-budget(s)?\.(json|ya?ml)$/.test(base) || base === 'budgets.yml') {
        return 'advisory';
    }
    // `settings.json` only under a host directory: the bare name is common
    // enough elsewhere that classifying it on the basename alone would fence
    // files that carry no settings key at all.
    if (base === 'settings.json') {
        return /(^|\/)\.(claude|cursor|augment|windsurf)\/settings\.json$/.test(posix) ? 'class-c' : null;
    }
    if (CLASS_C_BASENAMES.includes(base)) {
        return 'class-c';
    }
    return null;
}

/**
 * Leaf key paths of a parsed settings document, dotted.
 *
 * LEAVES ONLY, and the choice is load-bearing in both directions. A class-C key
 * whose value is a MAP (`hooks`, say) has children that never appear as their
 * own rows in the contract, so emitting only leaves and letting `classOfPath`
 * walk up to the nearest classified ancestor is what makes `hooks.enabled`
 * resolve to C. Emitting the interior nodes as well would double-count the same
 * change and report a parent that nothing edited.
 */
export function leafPaths(value: unknown, prefix = ''): Map<string, string> {
    const out = new Map<string, string>();
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        if (prefix !== '') out.set(prefix, JSON.stringify(value ?? null));
        return out;
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const key = prefix === '' ? k : `${prefix}.${k}`;
        for (const [ck, cv] of leafPaths(v, key)) out.set(ck, cv);
    }
    return out;
}

/**
 * Parse a settings document, or `null` when it is not parseable.
 *
 * `null` is NOT "no keys changed" — the caller treats it as an unreadable
 * corpus and refuses, because a guard that allows whatever it cannot parse is
 * bypassed by making the file unparseable for one call.
 */
export function parseSettingsDoc(text: string, rel: string): unknown | null {
    try {
        return rel.endsWith('.json') ? (JSON.parse(text) as unknown) : yaml.load(text);
    } catch {
        return null;
    }
}

/** Dotted paths whose value differs between two settings documents. */
export function changedKeys(before: unknown, after: unknown): string[] {
    const a = leafPaths(before);
    const b = leafPaths(after);
    const out = new Set<string>();
    for (const [k, v] of b) if (a.get(k) !== v) out.add(k);
    for (const k of a.keys()) if (!b.has(k)) out.add(k);
    return [...out].sort();
}

/**
 * The class index, read from the shipped contract. `null` when it cannot be
 * read AT ALL, which the caller treats as fail-closed.
 *
 * Not cached: the file is small, and a cache would keep a stale fence alive
 * across an upgrade that reclassified a key — the same reasoning the server's
 * own reader states for the same file.
 */
export function readClassIndex(packageRoot: string): Map<string, SettingsClass> | null {
    try {
        const text = fs.readFileSync(path.join(packageRoot, SETTINGS_CLASSES_RELATIVE), 'utf-8');
        const index = buildSettingsClassIndex(parseSettingsClassRows(text));
        return index.size === 0 ? null : index;
    } catch {
        return null;
    }
}

/**
 * The guarded subset of a change list.
 *
 * A key is guarded when its nearest classified ancestor is C, and ALSO when
 * nothing on its path is classified at all — the same per-key refusal
 * `settings:set` and the GUI write route already apply, reached here through
 * the same shared classifier rather than a second copy of the rule.
 */
export function guardedKeys(index: ReadonlyMap<string, SettingsClass> | null, keys: readonly string[]): string[] {
    if (index === null) return [...keys];
    return keys.filter((k) => {
        const cls = classOfPath(index, k);
        return cls === 'C' || cls === undefined;
    });
}

/**
 * Count allowlist entries in a blob.
 *
 * JSON: every string leaf in the structure (arrays of paths, and
 * `{"rule": ["path", …]}` maps alike) — parsing beats a line count because a
 * reformat would otherwise read as growth. Falls back to non-blank,
 * non-comment lines for `.txt` allowlists and for JSON fragments that do not
 * parse on their own (an `Edit` payload is rarely a whole document).
 */
export function count_entries(text: string): number {
    const trimmed = text.trim();
    if (trimmed) {
        try {
            let n = 0;
            const walk = (v: unknown): void => {
                if (typeof v === 'string') {
                    n += 1;
                } else if (Array.isArray(v)) {
                    v.forEach(walk);
                } else if (v !== null && typeof v === 'object') {
                    Object.values(v as Record<string, unknown>).forEach(walk);
                }
            };
            walk(JSON.parse(trimmed));
            return n;
        } catch {
            /* not a standalone JSON document — fall through */
        }
    }
    return text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//')).length;
}

/**
 * Entries this single tool call adds to an allowlist.
 *
 * `Write` carries the whole new document, so the delta is measured against
 * what is on disk. `Edit` carries a replacement pair, so the delta is the pair
 * itself. Negative results (a shrinking allowlist — the direction this guard
 * wants) collapse to 0: removals must never bank credit against a later
 * addition.
 */
export function added_entries(
    tool_input: JsonObject,
    on_disk: string | null,
): number {
    const content = tool_input['content'];
    if (typeof content === 'string') {
        const before = on_disk === null ? 0 : count_entries(on_disk);
        return Math.max(0, count_entries(content) - before);
    }
    const oldS = tool_input['old_string'] ?? tool_input['oldStr'] ?? tool_input['old_str'];
    const newS = tool_input['new_string'] ?? tool_input['newStr'] ?? tool_input['new_str'];
    if (typeof newS === 'string') {
        const before = typeof oldS === 'string' ? count_entries(oldS) : 0;
        return Math.max(0, count_entries(newS) - before);
    }
    return 0;
}

export interface Decision {
    action: 'allow' | 'warn' | 'block';
    reason: string;
}

/** Decide from the cumulative session total for one allowlist file. */
/**
 * The refusal reason for a class-C settings edit, or `null` to allow.
 *
 * WHAT THIS FENCES, and what it deliberately does not. The unit is the KEY, not
 * the file: a Class A key stays agent-writable through this path exactly as it
 * is through `settings:set`, and fencing the whole file would make an ordinary
 * preference edit need a human. Only a key the contract classifies C — or one
 * nothing on its path classifies at all, which is the same fail-closed default
 * the CLI writer applies — is refused.
 *
 * THE UNPARSEABLE CASES REFUSE, both of them, and for the same reason. A
 * contract this guard cannot read leaves it with no way to tell a C key from an
 * A key; a resulting document it cannot parse leaves it with no key list at
 * all. Allowing either would mean the fence is lifted by making one file
 * unreadable for the length of one tool call, which is a bypass with no
 * authorisation step in it.
 *
 * WHAT IT CANNOT SEE: an edit applied through a shell redirect rather than an
 * edit tool — `EDIT_TOOLS` is the corpus, and the shell shapes are
 * `block_plumbing_writes`' subject, not this one.
 */
export function classCVerdict(
    ti: JsonObject,
    on_disk: string | null,
    rel_path: string,
    index: ReadonlyMap<string, SettingsClass> | null,
): string | null {
    const before = on_disk === null ? null : parseSettingsDoc(on_disk, rel_path);

    const content = ti['content'];
    const oldStr = ti['old_string'];
    const newStr = ti['new_string'];
    let afterText: string | null = null;
    if (typeof content === 'string') {
        afterText = content;
    } else if (typeof oldStr === 'string' && typeof newStr === 'string' && on_disk !== null) {
        if (!on_disk.includes(oldStr)) return null; // the edit will not apply
        // `replace_all` is the host's own flag and it changes WHICH text the
        // edit produces. Modelling only the first occurrence let a
        // `replace_all` edit whose SECOND occurrence is the Class C one pass
        // this guard while the real edit changed it — the guard evaluating a
        // different edit from the one executed. Reported by an independent
        // review before this landed.
        const all = ti['replace_all'];
        if (all !== undefined && typeof all !== 'boolean') {
            return (
                `${rel_path}: this edit carries a \`replace_all\` value the guard cannot ` +
                'interpret, so the text it would produce is unknown and no key can be ' +
                'cleared. Re-send it as a plain edit, or write the change through ' +
                '`agent-config settings:set`.'
            );
        }
        afterText = all === true ? on_disk.split(oldStr).join(newStr) : on_disk.replace(oldStr, newStr);
    }
    if (afterText === null) return null;

    const after = parseSettingsDoc(afterText, rel_path);
    if (after === null) {
        return (
            `${rel_path}: the result of this edit does not parse as settings, so no key ` +
            'list can be derived and no key can be cleared. Fix the syntax, or write the ' +
            'change through `agent-config settings:set`, which refuses a Class C key by name.'
        );
    }

    const guarded = guardedKeys(index, changedKeys(before, after));
    if (guarded.length === 0) return null;

    const unreadable =
        index === null
            ? ' The class contract could not be read, so EVERY changed key is treated as ' +
              'guarded — that is the fail-closed direction, not a classification.'
            : '';
    return (
        `${rel_path}: this edit changes ${String(guarded.length)} guarded settings key(s) — ` +
        `${guarded.slice(0, 5).join(', ')}${guarded.length > 5 ? ', …' : ''}.` +
        unreadable +
        ' A Class C key is a policy dial (spend ceiling, allowlist, gate switch, hooks) and ' +
        'is a human edit by contract: docs/contracts/settings-classes.md. Every other key in ' +
        'this file stays writable.'
    );
}

export function decide(kind: ConfigKind, rel_path: string, session_total: number, added: number): Decision {
    if (kind === null || added <= 0) {
        return { action: 'allow', reason: '' };
    }
    if (kind === 'advisory') {
        return {
            action: 'warn',
            reason:
                `${rel_path}: this edit loosens a gate threshold. Whether that is a ` +
                'legitimate ratchet reset or the config being bent around a failing ' +
                'check is a review decision — state which in the diff.',
        };
    }
    if (session_total > SESSION_ENTRY_CAP) {
        return {
            action: 'block',
            reason:
                `${rel_path}: ${session_total} allowlist entries added this session ` +
                `(cap ${SESSION_ENTRY_CAP}). Per autonomous-execution § Antipattern — ` +
                'allowlist-growth as silent budget bypass, crossing this cap means the ' +
                'LINTER is wrong, not the content. Fix the code or redesign the check; ' +
                'do not expand the allowlist further.\n' +
                '  Legitimate override is a human action outside this session: land the ' +
                'linter redesign, or remove the `block-config-weakening` entry in ' +
                'src/scripts/hook_manifest.yaml.',
        };
    }
    if (session_total >= SESSION_WARN_AT) {
        return {
            action: 'warn',
            reason:
                `${rel_path}: ${session_total} allowlist entries added this session ` +
                `(cap ${SESSION_ENTRY_CAP}). Fix the code, not the config.`,
        };
    }
    return { action: 'allow', reason: '' };
}

// --- session state -------------------------------------------------------

function _state_file(root: string): string {
    return path.join(root, 'agents', 'runtime', 'state', 'config-weakening.json');
}

/** Read the cumulative count, add `added`, persist, and return the new total. */
export function bump_session(root: string, session: string, key: string, added: number): number {
    const f = _state_file(root);
    let data: Record<string, Record<string, number>> = {};
    try {
        data = JSON.parse(fs.readFileSync(f, 'utf-8')) as Record<string, Record<string, number>>;
    } catch {
        data = {};
    }
    const bucket = data[session] ?? {};
    const total = (bucket[key] ?? 0) + added;
    bucket[key] = total;
    data[session] = bucket;
    try {
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
    } catch {
        /* state is an optimisation, never a gate — a read-only tree still decides */
    }
    return total;
}

// --- entry ---------------------------------------------------------------

function _extract(envelope: JsonObject): { tool: string; paths: string[]; ti: JsonObject | null } {
    const payload = _isObject(envelope['payload']) ? envelope['payload'] : envelope;
    const nameVal =
        payload['tool_name'] ?? payload['toolName'] ?? payload['tool'] ?? envelope['tool_name'] ?? envelope['tool'];
    const tool = typeof nameVal === 'string' ? nameVal : '';
    const ti = _isObject(payload['tool_input'])
        ? payload['tool_input']
        : _isObject(envelope['tool_input'])
          ? envelope['tool_input']
          : null;
    const paths: string[] = [];
    if (ti !== null) {
        for (const key of _PATH_KEYS) {
            const v = ti[key];
            if (typeof v === 'string' && v) {
                paths.push(v);
            }
        }
    }
    return { tool, paths, ti };
}

export function main(): number {
    let envelope: JsonValue;
    try {
        const raw = readHookStdin();
        envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
    } catch {
        return EXIT_ALLOW;
    }
    if (!_isObject(envelope)) {
        return EXIT_ALLOW;
    }

    const { tool, paths, ti } = _extract(envelope);
    if (!tool || !EDIT_TOOLS.has(tool) || ti === null) {
        return EXIT_ALLOW;
    }

    const cwd = envelope['cwd'];
    const pr = envelope['workspace_root'] ?? envelope['project_root'];
    const root = typeof cwd === 'string' && cwd ? cwd : typeof pr === 'string' && pr ? pr : '.';
    const sidRaw = envelope['session_id'] ?? envelope['sessionId'];
    const session = typeof sidRaw === 'string' && sidRaw ? sidRaw : 'default';

    for (const p of paths) {
        const kind = classify_target(p);
        if (kind === null) {
            continue;
        }
        const abs = path.isAbsolute(p) ? p : path.join(root, p);
        let on_disk: string | null = null;
        try {
            on_disk = fs.readFileSync(abs, 'utf-8');
        } catch {
            on_disk = null;
        }
        if (kind === 'class-c') {
            const rel_c = path.relative(root, abs) || p;
            const pkg = findPackageRoot(_HERE);
            const verdict = classCVerdict(ti, on_disk, rel_c, pkg === null ? null : readClassIndex(pkg));
            if (verdict === null) continue;
            process.stderr.write(`block-config-weakening: BLOCKED — ${verdict}\n`);
            return EXIT_BLOCK;
        }

        const added = added_entries(ti, on_disk);
        if (added <= 0) {
            continue;
        }
        const rel = path.relative(root, abs) || p;
        const total = kind === 'allowlist' ? bump_session(root, session, rel, added) : added;
        const d = decide(kind, rel, total, added);
        if (d.action === 'block') {
            process.stderr.write(`block-config-weakening: BLOCKED — ${d.reason}\n`);
            return EXIT_BLOCK;
        }
        if (d.action === 'warn') {
            process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: d.reason })}\n`);
            return EXIT_WARN;
        }
    }
    return EXIT_ALLOW;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url`.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}
