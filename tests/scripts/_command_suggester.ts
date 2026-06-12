// Shared helper for the command_suggester TS test suites.
//
// Hosts:
//  - the deterministic golden-parity driver (mirrors
//    tests/scripts/_command_suggester_driver.py 1:1), and
//  - a canonical JSON serialiser matching
//    `json.dumps(obj, indent=2, sort_keys=True, ensure_ascii=False)`
//    including Python float `repr` for score / floor fields, so the
//    byte-for-byte comparison against the python3 driver holds.
//
// Committed file (CI checkout is clean) — both test files import it.

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    Settings,
    load_commands,
    match,
    rank,
    render,
    sanitize_context,
    sanitize_message,
    strip_code_blocks,
    strip_suggestion_echo,
    detect_disable_directive,
    is_explicit_slash_invocation,
} from '../../src/scripts/command_suggester/index.js';
import { parse_cooldown } from '../../src/scripts/command_suggester/cooldown.js';
import type { CommandSpec, Match } from '../../src/scripts/command_suggester/types.js';

// --- canonical (Python-equivalent) JSON serialiser -----------------------

/**
 * Python `repr(float)` for the magnitudes this driver produces. Score /
 * floor fields are serialised as the *string* form of this repr (the
 * python driver does the same via `repr(float(...))`), so JSON quotes
 * them and the int-vs-float number-formatting gap never surfaces.
 */
export function pyFloatRepr(value: number): string {
    if (Number.isNaN(value)) {
        return 'nan';
    }
    if (!Number.isFinite(value)) {
        return value > 0 ? 'inf' : '-inf';
    }
    // JS `String(n)` already yields the shortest round-tripping decimal,
    // the same algorithm CPython uses for `repr(float)`. The only gap is
    // integer-valued floats: Python renders `1.0`, JS renders `1`.
    const s = String(value);
    if (/^-?\d+$/.test(s)) {
        return `${s}.0`;
    }
    return s;
}

type JsonLike =
    | string
    | number
    | boolean
    | null
    | JsonLike[]
    | { [k: string]: JsonLike };

/**
 * Mirror of `json.dumps(obj, indent=2, sort_keys=True, ensure_ascii=False)`.
 * Strings are escaped per JSON; non-ASCII passes through (ensure_ascii=False).
 */
export function pyJsonDumps(obj: JsonLike): string {
    return _dump(obj, 0);
}

function _dump(obj: JsonLike, depth: number): string {
    const pad = '  '.repeat(depth);
    const padInner = '  '.repeat(depth + 1);
    if (obj === null) {
        return 'null';
    }
    if (typeof obj === 'boolean') {
        return obj ? 'true' : 'false';
    }
    if (typeof obj === 'number') {
        // Plain numbers are treated as Python ints here (the driver wraps
        // every float in PyFloat). Integers serialise identically.
        return String(obj);
    }
    if (typeof obj === 'string') {
        return _encodeString(obj);
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        const items = obj.map((x) => padInner + _dump(x, depth + 1));
        return `[\n${items.join(',\n')}\n${pad}]`;
    }
    // object — sort keys (sort_keys=True), Unicode-codepoint order.
    const keys = Object.keys(obj).sort(_codePointCompare);
    if (keys.length === 0) {
        return '{}';
    }
    const items = keys.map(
        (k) => `${padInner}${_encodeString(k)}: ${_dump(obj[k] as JsonLike, depth + 1)}`,
    );
    return `{\n${items.join(',\n')}\n${pad}}`;
}

function _codePointCompare(a: string, b: string): number {
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}

/**
 * JSON string encoding with `ensure_ascii=False` — escape only the
 * control / structural characters CPython's encoder escapes when
 * ensure_ascii is off (`"`, `\`, and C0 controls via \uXXXX or the
 * short escapes \b \t \n \f \r). Non-ASCII characters pass through raw.
 */
function _encodeString(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0)!;
        switch (ch) {
            case '"':
                out += '\\"';
                break;
            case '\\':
                out += '\\\\';
                break;
            case '\n':
                out += '\\n';
                break;
            case '\t':
                out += '\\t';
                break;
            case '\r':
                out += '\\r';
                break;
            case '\b':
                out += '\\b';
                break;
            case '\f':
                out += '\\f';
                break;
            default:
                if (code < 0x20) {
                    out += `\\u${code.toString(16).padStart(4, '0')}`;
                } else {
                    out += ch;
                }
        }
    }
    return `${out}"`;
}

// --- deterministic message corpus (must match the python driver) ---------

export const MESSAGES: readonly string[] = [
    'Setze Ticket ABC-123 um',
    'commit my changes and write a PR description',
    'do it now',
    'the weather is nice today',
    'commit my changes please now',
    'weiter mit ABC-123',
    'ci is failing on main, fix the pipeline',
    'explain `/commit` versus `/commit-in-chunks` from the docs',
    'please look at this output:\n```\nci is failing\n```\nnow what',
    'create a roadmap for the new feature work',
    'review my changes for correctness',
    'ok',
];

const SANITIZE_INPUTS: readonly string[] = [
    'before\n```bash\ngit commit -m fix\n```\nafter',
    'use `/implement-ticket` somehow',
    'commit my changes please now',
    '```a\ncommit\n```\nmid\n```b\nfix-ci\n```',
    (
        '> 💡 Your request matches a command. Pick one or run as-is:\n' +
        '>\n' +
        '> 1. /implement-ticket — drive ticket end-to-end\n' +
        '> 2. /refine-ticket — tighten AC\n' +
        '> 3. Just run the prompt as-is, no command\n' +
        '\n' +
        '**Recommendation: 1 — /implement-ticket** — the request matches.\n'
    ),
    "> the docs say '/commit stages everything'",
    '',
];

const COOLDOWN_INPUTS: readonly (string | null)[] = [
    '10m', '30s', '1h', '2d', '', 'garbage', '5', '100x', null,
];

const DIRECTIVE_INPUTS: readonly string[] = [
    '/command-suggestion-off',
    '  /command-suggestion-off  ',
    '/command-suggestion-on',
    '/command-suggestion-off then later /command-suggestion-on',
    '/command-suggestion-offline',
    'implement the feature',
    '',
];

const EXPLICIT_INPUTS: readonly string[] = [
    '/quality-fix', '  /commit', 'commit my changes', '', '/',
];

function matchToJson(m: Match): { [k: string]: JsonLike } {
    return {
        command: m.command,
        // Mirrors the python driver's `repr(float(m.score))` → a *string*
        // field, so json.dumps quotes it. Comparing scores as their Python
        // float repr sidesteps any int-vs-float JSON-number formatting gap.
        score: pyFloatRepr(m.score),
        matched_trigger: m.matched_trigger,
        evidence: m.evidence,
        has_structural_bonus: m.has_structural_bonus,
    };
}

/**
 * In-process TS twin of `_command_suggester_driver.py::main`. Returns
 * the canonical JSON string for byte comparison against python3.
 */
export function runDriver(commandsDir: string): string {
    const specs = load_commands(commandsDir);
    const specsByName = new Map<string, CommandSpec>(specs.map((s) => [s.name, s]));
    const settings = new Settings();

    // sorted(specs, key=lambda x: (x.name, x.description))
    const sortedSpecs = [...specs].sort((a, b) => {
        if (a.name !== b.name) {
            return a.name < b.name ? -1 : 1;
        }
        if (a.description !== b.description) {
            return a.description < b.description ? -1 : 1;
        }
        return 0;
    });
    const specSnapshot: JsonLike[] = sortedSpecs.map((s) => ({
        name: s.name,
        description: s.description,
        eligible: s.eligible,
        trigger_description: s.trigger_description,
        trigger_context: s.trigger_context,
        rationale: s.rationale,
        confidence_floor:
            s.confidence_floor === null ? null : pyFloatRepr(s.confidence_floor),
        cooldown: s.cooldown,
    }));

    const pipeline: JsonLike[] = MESSAGES.map((msg) => {
        const raw = match(msg, [], specs);
        const ranked = rank(raw, settings, specsByName, { raw_message: msg });
        const block = render(ranked, specsByName);
        return {
            message: msg,
            raw_matches: raw.map(matchToJson),
            ranked: ranked.map(matchToJson),
            block,
        };
    });

    const sanitize: JsonLike[] = SANITIZE_INPUTS.map((s) => ({
        input: s,
        strip_code_blocks: strip_code_blocks(s),
        strip_suggestion_echo: strip_suggestion_echo(s),
        sanitize_message: sanitize_message(s),
    }));
    const sanitizeCtx: JsonLike[] = sanitize_context(SANITIZE_INPUTS);

    const cooldown: JsonLike[] = COOLDOWN_INPUTS.map((v) => ({
        input: v,
        parsed: parse_cooldown(v, 600),
    }));
    const directives: JsonLike[] = DIRECTIVE_INPUTS.map((v) => ({
        input: v,
        detected: detect_disable_directive(v),
    }));
    const explicit: JsonLike[] = EXPLICIT_INPUTS.map((v) => ({
        input: v,
        is_explicit: is_explicit_slash_invocation(v),
    }));

    const doc: { [k: string]: JsonLike } = {
        spec_count: specs.length,
        eligible_count: specs.filter((s) => s.eligible).length,
        specs: specSnapshot,
        pipeline,
        sanitize,
        sanitize_context: sanitizeCtx,
        cooldown,
        directives,
        explicit,
    };
    return pyJsonDumps(doc);
}

// --- shared paths --------------------------------------------------------

export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
export const COMMANDS_DIR = path.join(REPO_ROOT, 'dist', 'agent-src', 'commands');
export const PY_DRIVER = path.join(
    REPO_ROOT,
    'tests',
    'scripts',
    '_command_suggester_driver.py',
);

export function commandsDirExists(): boolean {
    try {
        return fs.statSync(COMMANDS_DIR).isDirectory();
    } catch {
        return false;
    }
}
