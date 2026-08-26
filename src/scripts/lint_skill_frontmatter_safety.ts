// P1.4 — dangerous-frontmatter linter (road-to-security-pillar.md).
//
// Ported from the retired Python `src/scripts/lint_skill_frontmatter_safety.py` (ADR-200 —
// Python→TS migration). Behaviour mirrors the Python module byte-for-byte.
//
// Enforces the execution-safety contract from the `runtime-safety` rule at the
// frontmatter layer, and flags the consumer-format consent-bypass headers
// (`permissionMode: bypassPermissions`, wildcard `allowed-tools`) that the
// "skill supply-chain" attack class abuses.
//
// Checks (skill / command / persona / agent frontmatter under src/):
//
// - HIGH: `execution.type: automated` but the runtime-safety floor is not met —
//   `handler` is `none`/missing, `safety_mode` is not `strict`, or no
//   `allowed_tools` key is declared.
// - HIGH: `allowed_tools` (or consumer `allowed-tools`) grants a wildcard —
//   `*`, `Bash(*)`, or bare `Bash` — an over-broad tool grant.
// - HIGH: `permissionMode: bypassPermissions` (consent bypass).
//
// Reconciles with `validate_frontmatter.py` (schema fill) by checking only
// *safety semantics*, never re-reporting shape/required-key errors.
//
// Usage: ./scripts-run src/scripts/lint_skill_frontmatter_safety [--json]

import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as sl from './_lib/security_lint.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

export const CHECK = 'dangerous-frontmatter';

// Always over-broad: a star or Bash(*) wildcard grant.
//   Python: re.compile(r"(^|[\s,\[\"'])(\*|Bash\(\*\))(\s|,|\]|\"|'|$)")
const _WILDCARD_TOOL = /(^|[\s,[\"'])(\*|Bash\(\*\))(\s|,|\]|"|'|$)/;
// Bare `Bash` (full shell) — over-broad only on a NON-execution skill.
//   Python: re.compile(r"(^|[\s,\[\"'])Bash(\s|,|\]|\"|'|$)")
const _BARE_BASH = /(^|[\s,[\"'])Bash(\s|,|\]|"|'|$)/;

//   Python: re.match(r"^execution:\s*$", text)
const _RE_EXECUTION = /^execution:\s*$/;
//   Python: re.match(r"^\s+([\w-]+):\s*(.*)$", text)
const _RE_EXEC_KEY = /^\s+([A-Za-z0-9_-]+):\s*(.*)$/;
//   Python: re.match(r"\s*permissionMode:\s*['\"]?bypassPermissions", text)
const _RE_PERMISSION_MODE = /^\s*permissionMode:\s*['"]?bypassPermissions/;
//   Python: re.match(r"\s*allowed-tools:\s*(.+)$", text)
const _RE_ALLOWED_TOOLS = /^\s*allowed-tools:\s*(.+)$/;

// Subagent definitions grant tools under a TOP-LEVEL `tools:` key (subagent-v1,
// `src/scripts/schemas/subagent.schema.json`), not under `execution.allowed_tools`
// and not as `allowed-tools`. Both other spellings were already read here; this
// one was not, and `src/subagents` was not a scan root either — so the two
// over-broad-grant checks below had never inspected a subagent definition.
// Top-level anchored (no leading whitespace) so a nested `tools:` inside some
// other block cannot be mistaken for a grant; the key is unused by skills,
// commands and domain artefacts, so the anchor costs no coverage.
const _RE_TOOLS_KEY = /^tools:\s*(.*)$/;
// A YAML block-sequence item under it (`  - Bash`). Inline flow (`tools: [Bash]`)
// is captured by the key regex's own trailing group.
const _RE_SEQ_ITEM = /^\s+-\s*(.+)$/;

/** Mirror Python `str.strip("'\"")` — strip any leading/trailing `'` or `"`. */
function _stripQuotes(s: string): string {
    let lo = 0;
    let hi = s.length;
    while (lo < hi && (s[lo] === "'" || s[lo] === '"')) lo++;
    while (hi > lo && (s[hi - 1] === "'" || s[hi - 1] === '"')) hi--;
    return s.slice(lo, hi);
}

/** Mirror Python `str.lstrip()` width — leading-whitespace count (Unicode-aware). */
function _indent(text: string): number {
    return text.length - text.replace(/^\s+/, '').length;
}

/** Return [(lineno, text)] of the frontmatter body + its end line, or null. */
function _frontmatter(sf: sl.ScannedFile): [Array<[number, string]>, number] | null {
    if (sf.lines.length === 0 || (sf.lines[0] as string).trim() !== '---') {
        return null;
    }
    const body: Array<[number, string]> = [];
    for (let i = 1; i < sf.lines.length; i++) {
        if ((sf.lines[i] as string).trim() === '---') {
            return [body, i + 1];
        }
        body.push([i + 1, sf.lines[i] as string]);
    }
    return null;
}

/** Extract execution.* sub-keys as {key: [lineno, value]} (one-level block). */
function _exec_block(body: ReadonlyArray<[number, string]>): Record<string, [number, string]> {
    const out: Record<string, [number, string]> = {};
    let in_exec = false;
    let base_indent = 0;
    for (const [lineno, text] of body) {
        if (_RE_EXECUTION.test(text)) {
            in_exec = true;
            base_indent = _indent(text);
            continue;
        }
        if (in_exec) {
            const indent = _indent(text);
            if (text.trim() && indent <= base_indent) {
                in_exec = false;
                continue;
            }
            const m = _RE_EXEC_KEY.exec(text);
            if (m) {
                out[m[1] as string] = [lineno, (m[2] as string).trim()];
            }
        }
    }
    return out;
}


/**
 * Which grant key is legal on this artefact's surface.
 *
 * `road-to-skill-ecosystem-runtime-enforcement` Phase 3 Step 6. The failure this
 * catches is silent by construction: **a loader ignores an unrecognised
 * frontmatter key**, so a tool restriction written on the wrong surface parses
 * fine, restricts nothing, and the artefact inherits every tool. A parse success
 * is not a restriction — and nothing in the tree said so before this check.
 *
 * - `src/subagents/*.md` — subagent-v1 (`subagent.schema.json`) grants with a
 *   TOP-LEVEL `tools:`. It has no `execution:` block at all.
 * - everything else (skills, commands, domain artefacts) — grants live under
 *   `execution.allowed_tools`, or as the consumer-format `allowed-tools`.
 *   A top-level `tools:` here is read by nothing.
 */
export type GrantSurface = 'subagent' | 'skill-like';

export function grantSurface(rel: string): GrantSurface {
    return rel.replace(/\\/g, '/').includes('src/subagents/') ? 'subagent' : 'skill-like';
}

export function _scan(sf: sl.ScannedFile): sl.Finding[] {
    if (sf.pragma_allows(CHECK)) {
        return [];
    }
    const fm = _frontmatter(sf);
    if (!fm) {
        return [];
    }
    const [body] = fm;
    const out: sl.Finding[] = [];

    const ex = _exec_block(body);
    const handler = _stripQuotes((ex['handler'] ?? [0, ''])[1]);
    const is_execution_skill = Object.keys(ex).length > 0 && handler !== '' && handler !== 'none';

    // Wrong-surface tool restrictions. A key the loader does not recognise is
    // IGNORED, so the artefact inherits everything — the restriction reads as
    // present and is not. Both directions are checked, because both have a
    // plausible author: a skill copying a subagent's `tools:` list, and a
    // subagent copying a skill's `execution:` block.
    const surface = grantSurface(sf.rel);
    for (const [lineno, text] of body) {
        if (surface === 'skill-like' && _RE_TOOLS_KEY.test(text)) {
            out.push(
                new sl.Finding(
                    sf.rel,
                    lineno,
                    CHECK,
                    'HIGH',
                    'top-level `tools:` on a non-subagent surface — subagent-v1 only; ' +
                        'the loader ignores it here, so this artefact is NOT restricted ' +
                        '(use execution.allowed_tools)',
                    sf.weight,
                ),
            );
        }
        if (surface === 'subagent' && _RE_EXECUTION.test(text)) {
            out.push(
                new sl.Finding(
                    sf.rel,
                    lineno,
                    CHECK,
                    'HIGH',
                    '`execution:` block on a subagent definition — subagent-v1 has no such ' +
                        'key, so any allowed_tools under it restricts nothing (use top-level `tools:`)',
                    sf.weight,
                ),
            );
        }
    }

    // consumer consent-bypass header + wildcard `allowed-tools` (hyphen = Claude
    // format; the underscore source key is covered by the execution block below).
    for (const [lineno, text] of body) {
        if (_RE_PERMISSION_MODE.test(text)) {
            out.push(
                new sl.Finding(
                    sf.rel,
                    lineno,
                    CHECK,
                    'HIGH',
                    'permissionMode: bypassPermissions (consent bypass)',
                    sf.weight,
                ),
            );
        }
        const m = _RE_ALLOWED_TOOLS.exec(text);
        if (
            m &&
            (_WILDCARD_TOOL.test(m[1] as string) ||
                (_BARE_BASH.test(m[1] as string) && !is_execution_skill))
        ) {
            out.push(
                new sl.Finding(
                    sf.rel,
                    lineno,
                    CHECK,
                    'HIGH',
                    'wildcard / bare-Bash tool grant (over-broad)',
                    sf.weight,
                ),
            );
        }
    }

    // Top-level `tools:` — the subagent-v1 grant key. Collect the inline value
    // plus any block-sequence items that follow, and run the same two checks the
    // other two spellings get. A subagent is never an execution skill (no
    // `execution:` block), so the bare-Bash arm applies by construction.
    for (let i = 0; i < body.length; i += 1) {
        const [lineno, text] = body[i] as [number, string];
        const key = _RE_TOOLS_KEY.exec(text);
        if (!key) {
            continue;
        }
        const grants: string[] = [];
        const inline = (key[1] ?? '').trim();
        if (inline !== '') {
            grants.push(inline);
        }
        for (let j = i + 1; j < body.length; j += 1) {
            const [, next] = body[j] as [number, string];
            const item = _RE_SEQ_ITEM.exec(next);
            if (!item) {
                break;
            }
            grants.push(_stripQuotes((item[1] as string).trim()));
        }
        const joined = grants.join(', ');
        if (joined !== '' && (_WILDCARD_TOOL.test(joined) || _BARE_BASH.test(joined))) {
            out.push(
                new sl.Finding(
                    sf.rel,
                    lineno,
                    CHECK,
                    'HIGH',
                    'wildcard / bare-Bash tool grant (over-broad)',
                    sf.weight,
                ),
            );
        }
    }

    if (Object.keys(ex).length === 0) {
        return out;
    }
    const etype = _stripQuotes((ex['type'] ?? [0, ''])[1]);
    const safety = _stripQuotes((ex['safety_mode'] ?? [0, ''])[1]);
    // Python: ex.get("type", ex.get("handler", (0, "")))[0]
    const exec_line = (ex['type'] ?? ex['handler'] ?? [0, ''])[0];

    if (etype === 'automated') {
        if (handler === '' || handler === 'none') {
            out.push(
                new sl.Finding(
                    sf.rel,
                    exec_line,
                    CHECK,
                    'HIGH',
                    'automated execution with handler none/missing (runtime-safety)',
                    sf.weight,
                ),
            );
        }
        if (safety !== 'strict') {
            out.push(
                new sl.Finding(
                    sf.rel,
                    exec_line,
                    CHECK,
                    'HIGH',
                    'automated execution without safety_mode: strict (runtime-safety)',
                    sf.weight,
                ),
            );
        }
        if (!('allowed_tools' in ex)) {
            out.push(
                new sl.Finding(
                    sf.rel,
                    exec_line,
                    CHECK,
                    'HIGH',
                    'automated execution without an explicit allowed_tools declaration',
                    sf.weight,
                ),
            );
        }
    }

    const [at_line, at_val] = ex['allowed_tools'] ?? [0, ''];
    if (at_val && _WILDCARD_TOOL.test(at_val)) {
        out.push(
            new sl.Finding(
                sf.rel,
                at_line,
                CHECK,
                'HIGH',
                'execution.allowed_tools wildcard (* / Bash(*)) grant',
                sf.weight,
            ),
        );
    } else if (at_val && _BARE_BASH.test(at_val) && !is_execution_skill) {
        out.push(
            new sl.Finding(
                sf.rel,
                at_line,
                CHECK,
                'HIGH',
                'bare Bash grant on a non-execution skill (handler none/missing)',
                sf.weight,
            ),
        );
    }
    return out;
}

interface Args {
    json: boolean;
}

function _argError(msg: string): never {
    process.stderr.write('usage: lint_skill_frontmatter_safety [-h] [--json]\n');
    process.stderr.write(`lint_skill_frontmatter_safety: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): Args {
    const out: Args = { json: false };
    const extra: string[] = [];
    for (const a of argv) {
        if (a === '-h' || a === '--help') {
            process.stdout.write('usage: lint_skill_frontmatter_safety [-h] [--json]\n');
            process.exit(0);
        } else if (a === '--json') {
            out.json = true;
        } else {
            extra.push(a);
        }
    }
    if (extra.length > 0) {
        _argError(`unrecognized arguments: ${extra.join(' ')}`);
    }
    return out;
}

export function main(argv: readonly string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const findings: sl.Finding[] = [];
    // `src/subagents` is the fourth root, added because its omission is what made
    // the over-broad-grant checks blind: the only artefact in the tree granting a
    // bare shell lives there, and the gate had never read it.
    const roots = ['src/skills', 'src/agent-src', 'src/domains', 'src/subagents'];
    let scanned = 0;
    for (const sf of sl.iter_corpus(roots, ['.md'])) {
        scanned += 1;
        for (const h of _scan(sf)) {
            findings.push(h);
        }
    }

    // `iter_corpus` skips a root that does not exist, so all three moving at
    // once yields zero files and a clean report — the quietest possible failure
    // for a security lint. `scanned` counts files READ, never findings: zero
    // findings over 900 files is the success state, zero files is blindness.
    // Exit 1 = "this gate is not clean" (reds the build); 2 stays the argv
    // usage code that `parse_args` owns.
    try {
        assertScanned({
            gate: 'lint_skill_frontmatter_safety',
            scanned,
            units: 'markdown file(s)',
            roots,
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    if (args.json) {
        const payload = sl.py_json_dumps_indent2(findings.map((f) => f.toDict()));
        process.stdout.write(payload + '\n');
        return findings.some((f) => f.is_fail) ? 1 : 0;
    }
    return sl.report(findings, { check_label: 'dangerous-frontmatter', scanned_roots: roots });
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
