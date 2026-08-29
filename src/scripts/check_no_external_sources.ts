#!/usr/bin/env tsx
/**
 * check_no_external_sources — block readable inspiration/harvest source names.
 *
 * Ported from the retired Python `src/scripts/check_no_external_sources.py` (ADR-200). The
 * CLI contract is mirrored EXACTLY — the `--json` flag, exit codes (0 = clean,
 * 1 = at least one denied token in a non-skipped tracked file, 2 = usage /
 * config error), the stdout split, byte-identical text + JSON report
 * (`json.dumps(..., indent=2)`), the denylist load from
 * `external_sources_denylist.json`, the `git ls-files` tracked-tree walk, the
 * binary-extension skip set, the `fnmatch` skip-path globs, the
 * case-insensitive regex search, and the `line.strip()[:160]` excerpt.
 *
 * Backstop for the source-confidentiality policy (rule: source-confidentiality;
 * the 2026-06-13 sweep). Scans the **tracked** tree for a denylist of external
 * inspiration / harvest / comparison source slugs so they cannot re-enter the
 * repo by accident. Recommending an integrated tool is allowed; recording that
 * we copied / derived / were-inspired-by a named external source is not.
 *
 * Carve-outs (see external_sources_denylist.json):
 * - Vendored Apache/MIT code keeps its license-required attribution.
 * - Recommendation/registry docs may name registries (Smithery/Glama).
 * - A retained source link must be stored encrypted via
 *   src/scripts/_lib/link_crypto.ts, never in plaintext.
 *
 * ## What `road-to-source-silence` added (Phase 3.1, 3.2, 3.3, and dormant 1.1)
 *
 * The name-list scan above is unchanged and still authoritative. Three surfaces
 * were added around it, because a list can only catch a name somebody already
 * wrote down:
 *
 * - **3.1 — paths are scanned like content.** A denied token in a FILENAME or
 *   directory name failed nothing before; `rel` reached the extension skip-list
 *   and the hit record and nothing else. It is now matched against the same
 *   deny set, and a hit blocks exactly like a content line. Measured at
 *   introduction: 0 hits, so this lands enforcing rather than baselined.
 * - **3.2 — an attribution-SHAPE heuristic** (`_lib/source_shape.ts`), which is
 *   independent of any name list. Tiered per the resolved
 *   `how-loud-the-slug-heuristic-is` blocker: **block inside `agents/**`, warn
 *   elsewhere.** The warn tier is written to a machine-readable report
 *   (`--report`) rather than only printed, which is the council's own
 *   requirement — "warnings must be visible and RETAINED in CI artifacts …
 *   so the warn tier is auditable after the fact".
 * - **3.3 — both new classes are ratcheted**, not allowlisted. Pre-existing
 *   shape debt is a committed count in `src/config/gate-violation-baselines.json`
 *   that may only shrink; a new occurrence raises the count and fails the gate.
 *   No individual violation is named or excused.
 * - **1.1 — keyed-digest matching, DORMANT.** `deny_digests` ships empty and
 *   this code path does nothing until a maintainer performs the atomic cutover
 *   in `docs/maintainers/source-deny-digests.md`. The plaintext `deny` array
 *   stays in force and is NOT deleted.
 *
 * Exit codes: 0 = clean, 1 = at least one denied token in a non-skipped tracked
 * file (or a shape-count regression), 2 = usage / config error, 3 = strict
 * digest mode requested with no key (`_lib/source_digest.ts`).
 *
 * Usage:
 *     node scripts/check_no_external_sources.ts [--json] [--report <path>]
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkRatchet } from './_lib/gate_baseline.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import { DigestMatcher, digestMode, EXIT_NO_KEY, KEY_ENV, STRICT_ENV } from './_lib/source_digest.js';
import { shapeHits as shapeHitsOf, shapePathHits, tierFor, type ShapeClass } from './_lib/source_shape.js';
import {
    dedupVerdict,
    findingKey,
    hunkTargets,
    isSnapshotPatch,
    isSnapshotPath,
} from './_lib/source_snapshot_dedup.js';

const _HERE = fileURLToPath(import.meta.url);
// parents[2] of src/scripts/<file> is the repo root.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
// `Path(__file__).with_name(...)` — sibling of this script.
const CONFIG = path.join(path.dirname(_HERE), 'external_sources_denylist.json');

// Scan only text-ish files; skip binaries / lockfiles / images.
const _SKIP_EXT = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz',
    '.woff', '.woff2', '.ttf', '.mp3', '.mp4', '.wav', '.lock',
]);

interface DenyConfig {
    deny: string[];
    /** Phase 1.1 — HMAC-SHA256 digests of the deny set. Ships EMPTY (dormant). */
    deny_digests?: string[];
    skip_paths?: string[];
    [k: string]: unknown;
}

interface Hit {
    file: string;
    /** 0 for a PATH hit — there is no line to point at. */
    line: number;
    token: string;
    text: string;
}

/** One attribution-shape finding (Phase 3.2). */
interface ShapeFinding {
    file: string;
    line: number;
    cls: ShapeClass;
    tier: 'block' | 'warn';
    /** The offending value, truncated. Written to the report, never to stdout. */
    value: string;
}

/** Baseline key for the block-tier shape count (Phase 3.3). */
export const SHAPE_GATE_KEY = 'check_no_external_sources:shape-block';

/** Thrown to mirror Python `raise SystemExit(msg)` (exit code derived by caller). */
class ExitError extends Error {}

/** Mirror `_tracked_files` — `git ls-files` in ROOT, non-empty lines. */
function _tracked_files(): string[] {
    const res = spawnSync('git', ['ls-files'], {
        cwd: ROOT,
        encoding: 'utf-8',
        maxBuffer: 256 * 1024 * 1024,
    });
    if (res.status !== 0) {
        // subprocess.run(check=True) raises CalledProcessError — surfaces as a crash.
        throw new Error(`git ls-files failed (status ${res.status}): ${res.stderr ?? ''}`);
    }
    return (res.stdout ?? '').split('\n').filter((line) => line);
}

/** Mirror `_load_config`. */
function _load_config(): DenyConfig {
    const data = JSON.parse(fs.readFileSync(CONFIG, 'utf-8')) as DenyConfig;
    if (!data.deny || data.deny.length === 0) {
        throw new ExitError('config error: empty deny list');
    }
    return data;
}

/** Python `.suffix.lower()` — last extension incl. the dot, lowercased; '' when none. */
function _suffixLower(rel: string): string {
    const base = rel.split('/').pop() as string;
    const dot = base.lastIndexOf('.');
    // pathlib: a leading-dot-only name (".env") has no suffix.
    if (dot <= 0) {
        return '';
    }
    return base.slice(dot).toLowerCase();
}

/**
 * Translate a Python `fnmatch` glob to a RegExp. fnmatch semantics: `*` matches
 * anything (including `/`), `?` matches one char, `[seq]` a set. CI is Linux →
 * case-sensitive (no os.path.normcase folding). Mirrors `fnmatch.translate`
 * for the glob shapes used in the denylist (`prefix/*`, exact paths).
 */
function _fnmatchToRegExp(glob: string): RegExp {
    let re = '';
    for (let i = 0; i < glob.length; i += 1) {
        const c = glob[i] as string;
        if (c === '*') {
            re += '.*';
        } else if (c === '?') {
            re += '.';
        } else if (c === '[') {
            let j = i + 1;
            if (glob[j] === '!') {
                j += 1;
            }
            if (glob[j] === ']') {
                j += 1;
            }
            while (j < glob.length && glob[j] !== ']') {
                j += 1;
            }
            if (j >= glob.length) {
                re += '\\['; // unterminated → literal '['
            } else {
                let stuff = glob.slice(i + 1, j).replace(/\\/g, '\\\\');
                i = j;
                if (stuff.startsWith('!')) {
                    stuff = '^' + stuff.slice(1);
                } else if (stuff.startsWith('^')) {
                    stuff = '\\' + stuff;
                }
                re += `[${stuff}]`;
            }
        } else {
            re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    }
    // fnmatch.translate anchors with full-match semantics.
    return new RegExp(`^(?:${re})$`);
}

/** Mirror `_skipped` — any skip-glob fnmatches the path. */
function _skipped(p: string, skipGlobs: string[]): boolean {
    return skipGlobs.some((g) => _fnmatchToRegExp(g).test(p));
}

/** Python `str.splitlines()` over the file body (no trailing-empty element). */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    const lines: string[] = [];
    let current = '';
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i] as string;
        const code = text.charCodeAt(i);
        if (ch === '\r') {
            lines.push(current);
            current = '';
            if (text[i + 1] === '\n') {
                i += 1;
            }
            continue;
        }
        if (
            ch === '\n' ||
            code === 0x0b ||
            code === 0x0c ||
            code === 0x1c ||
            code === 0x1d ||
            code === 0x1e ||
            code === 0x85 ||
            code === 0x2028 ||
            code === 0x2029
        ) {
            lines.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    if (current !== '') {
        lines.push(current);
    }
    return lines;
}

/** Python `str.strip()` — strip leading/trailing whitespace (Unicode). */
function _pyStrip(s: string): string {
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

/** Mirror `json.dumps(obj, indent=2)` (ensure_ascii=True, key order preserved). */
function _jsonDumps2(obj: unknown): string {
    return _pyJson(obj, 2, 0);
}

function _pyJson(v: unknown, indent: number, depth: number): string {
    const pad = ' '.repeat(indent * (depth + 1));
    const padEnd = ' '.repeat(indent * depth);
    if (v === null) {
        return 'null';
    }
    if (typeof v === 'boolean') {
        return v ? 'true' : 'false';
    }
    if (typeof v === 'number') {
        return String(v);
    }
    if (typeof v === 'string') {
        return _pyJsonStr(v);
    }
    if (Array.isArray(v)) {
        if (v.length === 0) {
            return '[]';
        }
        const items = v.map((it) => pad + _pyJson(it, indent, depth + 1));
        return '[\n' + items.join(',\n') + '\n' + padEnd + ']';
    }
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) {
        return '{}';
    }
    const items = entries.map(([k, val]) => `${pad}${_pyJsonStr(k)}: ${_pyJson(val, indent, depth + 1)}`);
    return '{\n' + items.join(',\n') + '\n' + padEnd + '}';
}

/** Mirror Python json string encoding with ensure_ascii=True (\uXXXX escapes). */
function _pyJsonStr(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (code < 0x20 || code > 0x7e) {
            // ensure_ascii=True — escape as \uXXXX (surrogate pair for astral).
            if (code > 0xffff) {
                const c = code - 0x10000;
                const hi = 0xd800 + (c >> 10);
                const lo = 0xdc00 + (c & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0') + '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + code.toString(16).padStart(4, '0');
            }
        } else {
            out += ch;
        }
    }
    return out + '"';
}

/** Mirror `main(argv)`. */
function main(argv: readonly string[]): number {
    const asJson = argv.includes('--json');
    const cfg = _load_config();
    const patterns: Array<[string, RegExp]> = cfg.deny.map((p) => [p, new RegExp(p, 'i')]);
    const skipGlobs = cfg.skip_paths ?? [];

    // `_tracked_files` raises when git itself fails, but a git that succeeds
    // with empty output (not a repo, nothing tracked) yields the same empty
    // loop and the ✅ "no external-source references" line. Not a diff — this
    // is the whole tracked tree, so zero is never a legitimate state; no
    // `allowEmpty`. Assert the unfiltered enumeration, before the extension /
    // skip_paths filters, so a filter change can never mask a dead scope.
    // Exit 1 is the only failure code this pinned CLI reaches.
    const tracked = _tracked_files();
    try {
        assertScanned({
            gate: 'check_no_external_sources',
            scanned: tracked.length,
            units: 'tracked file(s)',
            roots: ['git ls-files'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    // Phase 1.1 — dormant unless a maintainer has performed the atomic cutover.
    const digests = cfg.deny_digests ?? [];
    const strict = (process.env[STRICT_ENV] ?? '') !== '';
    const mode = digestMode({ digests, key: process.env[KEY_ENV], strict });
    if (mode.strict && !mode.active) {
        process.stderr.write(`❌  ${mode.message}\n`);
        return EXIT_NO_KEY;
    }
    if (mode.message !== '') {
        process.stderr.write(`${mode.message}\n`);
    }
    const matcher = mode.active ? new DigestMatcher(digests, process.env[KEY_ENV] as string) : null;

    const hits: Hit[] = [];
    const shapes: ShapeFinding[] = [];
    for (const rel of tracked) {
        if (_skipped(rel, skipGlobs)) {
            continue;
        }
        // --- Phase 3.1: the PATH is scanned exactly like a content line. -----
        for (const [raw, rx] of patterns) {
            if (rx.test(rel)) {
                hits.push({ file: rel, line: 0, token: raw, text: `(path) ${rel}`.slice(0, 160) });
            }
        }
        if (matcher) {
            for (const tok of matcher.hits(rel)) {
                hits.push({ file: rel, line: 0, token: `digest:${tok}`, text: `(path) ${rel}`.slice(0, 160) });
            }
        }
        for (const h of shapePathHits(rel)) {
            shapes.push({ file: rel, line: 0, cls: h.cls, tier: tierFor(rel), value: h.value });
        }
        if (_SKIP_EXT.has(_suffixLower(rel))) {
            continue;
        }
        let text: string;
        try {
            const abs = path.join(ROOT, rel);
            // Mirror `(OSError, IsADirectoryError)` skip — a directory entry, gone, etc.
            if (!fs.statSync(abs).isFile()) {
                continue;
            }
            text = fs.readFileSync(abs, 'utf-8'); // errors="replace": Node substitutes U+FFFD
        } catch {
            continue;
        }
        const lines = _splitlines(text);
        const tier = tierFor(rel);
        for (let idx = 0; idx < lines.length; idx += 1) {
            const line = lines[idx] as string;
            for (const [raw, rx] of patterns) {
                if (rx.test(line)) {
                    hits.push({
                        file: rel,
                        line: idx + 1,
                        token: raw,
                        text: _pyStrip(line).slice(0, 160),
                    });
                }
            }
            if (matcher) {
                for (const tok of matcher.hits(line)) {
                    hits.push({
                        file: rel,
                        line: idx + 1,
                        token: `digest:${tok}`,
                        text: _pyStrip(line).slice(0, 160),
                    });
                }
            }
            for (const h of shapeHitsOf(line)) {
                shapes.push({ file: rel, line: idx + 1, cls: h.cls, tier, value: h.value });
            }
        }
    }

    // --- Phase 3.2 + 3.3: tier the shape findings and ratchet the block tier.
    const blockShapesAll = shapes.filter((s2) => s2.tier === 'block');
    const warnShapes = shapes.filter((s2) => s2.tier === 'warn');

    // --- Phase 3.4: provenance-aware deduplication of R2 snapshot mirrors. ----
    // A finding inside a review-input snapshot is excluded from the ratchet ONLY
    // when an identical class+value is independently block-counted in the
    // current tracked tree. Earned per finding; fails closed. The refused
    // alternative (lower the tier for the whole snapshot corpus) and the two
    // legs are documented in `_lib/source_snapshot_dedup.ts`.
    const trackedPaths = new Set(tracked);
    const blockIndex = new Map<string, Set<string>>();
    for (const s2 of blockShapesAll) {
        if (isSnapshotPath(s2.file)) {
            continue;
        }
        const k = findingKey(s2.cls, s2.value);
        let set = blockIndex.get(k);
        if (!set) {
            set = new Set();
            blockIndex.set(k, set);
        }
        set.add(s2.file);
    }
    const targets = new Map<string, ReadonlyMap<number, string>>();
    for (const rel of tracked) {
        if (!isSnapshotPatch(rel)) {
            continue;
        }
        try {
            targets.set(rel, hunkTargets(fs.readFileSync(path.join(ROOT, rel), 'utf-8')));
        } catch {
            // Unreadable patch — no hunk targets, so no finding in it can take
            // Leg 1. It does NOT follow that they fail closed: Leg 2 still
            // excludes a finding whose value is block-counted elsewhere in the
            // scanned tree. Corrected after the R2 review of this branch, which
            // caught this comment claiming a guarantee the code does not give.
        }
    }
    const dedupInput = { blockIndex, targets, trackedPaths };
    const blockShapes: ShapeFinding[] = [];
    const excluded: Array<ShapeFinding & { leg: string; matched: string }> = [];
    for (const s2 of blockShapesAll) {
        const v = isSnapshotPath(s2.file)
            ? dedupVerdict({ file: s2.file, line: s2.line, cls: s2.cls, value: s2.value }, dedupInput)
            : { excluded: false, leg: null, matchedPath: null, reason: 'not a snapshot finding' };
        if (v.excluded) {
            excluded.push({ ...s2, leg: v.leg ?? '?', matched: v.matchedPath ?? '' });
        } else {
            blockShapes.push(s2);
        }
    }
    const dedupByLeg = {
        hunk: excluded.filter((e) => e.leg === 'hunk').length,
        tree: excluded.filter((e) => e.leg === 'tree').length,
    };

    const verdict = checkRatchet({ repoRoot: ROOT, gate: SHAPE_GATE_KEY, actual: blockShapes.length });

    // The council's retention requirement: the warn tier is written where CI can
    // keep it, not merely printed into a log that scrolls away.
    const ri = argv.indexOf('--report');
    if (ri >= 0 && argv[ri + 1] !== undefined) {
        const out = path.resolve(ROOT, argv[ri + 1] as string);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(
            out,
            _jsonDumps2({
                deny_hits: hits.length,
                digest_mode: { active: mode.active, digests: mode.digests, key_missing: mode.keyMissing },
                shape: {
                    block: blockShapes.length,
                    warn: warnShapes.length,
                    baseline: verdict.baseline,
                    status: verdict.status,
                },
                // Phase 3.4 — every exclusion names its leg and the tracked
                // file whose independent block-count justified it, so the
                // weaker `tree` leg is auditable after the fact rather than
                // invisible. The council required exactly this.
                snapshot_dedup: {
                    excluded: excluded.length,
                    by_leg: dedupByLeg,
                    exclusions: excluded,
                },
                block_findings: blockShapes,
                warn_findings: warnShapes,
            }) + '\n',
            'utf-8',
        );
    }

    const ok = hits.length === 0 && verdict.ok;

    if (asJson) {
        // `ok` and `hits` keep their pinned meaning for the name-list scan; the
        // shape block is additive so an existing consumer is unaffected.
        process.stdout.write(
            _jsonDumps2({
                ok,
                hits,
                shape: {
                    block: blockShapes.length,
                    warn: warnShapes.length,
                    baseline: verdict.baseline,
                    status: verdict.status,
                    ok: verdict.ok,
                    snapshot_dedup: { excluded: excluded.length, by_leg: dedupByLeg },
                },
            }) + '\n',
        );
    } else {
        if (hits.length > 0) {
            process.stdout.write(`❌  ${hits.length} external-source reference(s) in the tracked tree:\n\n`);
            for (const h of hits) {
                process.stdout.write(`  ${h.file}:${h.line}  [${h.token}]  ${h.text}\n`);
            }
            process.stdout.write(
                '\nThese name an external inspiration/harvest source. Remove the name,\n' +
                    'or — if a real source link must be retained — encrypt it via\n' +
                    'src/scripts/_lib/link_crypto.ts. Legitimate carve-outs (vendored code,\n' +
                    'registry recommendations) belong in external_sources_denylist.json\n' +
                    'skip_paths. See rule: source-confidentiality.\n',
            );
        } else {
            process.stdout.write('✅  No external inspiration-source references in the tracked tree.\n');
        }
        // The shape tier reports on every run — a count that is only printed
        // when it fails is a count nobody watches shrink.
        process.stdout.write(
            `\nattribution shape — block(agents/**) ${String(blockShapes.length)}` +
                ` / baseline ${String(verdict.baseline)} · warn(elsewhere) ${String(warnShapes.length)}\n`,
        );
        if (excluded.length > 0) {
            process.stdout.write(
                `snapshot dedup — ${String(excluded.length)} review-snapshot finding(s) excluded` +
                    ` (hunk-target ${String(dedupByLeg.hunk)} · tracked-tree ${String(dedupByLeg.tree)});` +
                    ' each matched an identical class+value block-counted in a scanned file.' +
                    ' Per-exclusion legs and matched paths: --report <path>.\n',
            );
        }
        process.stdout.write(`${verdict.ok ? '✅' : '❌'}  ${verdict.message}\n`);
        if (!verdict.ok) {
            process.stdout.write(
                '\nThe shape heuristic flags attribution by FORM, not by name: a speaking\n' +
                    '`**Source:**` value, a quoted agents/tmp(.old)/<name>/ directory, or an\n' +
                    'un-allowlisted github.com/<owner>/<repo> URL. Rewrite the reference to an\n' +
                    'opaque round identifier or an ENC1: token (src/scripts/_lib/link_crypto.ts).\n' +
                    'Run with --report <path> for the per-finding list. See rule:\n' +
                    'source-confidentiality and roadmap road-to-source-silence Phase 3.\n',
            );
        }
    }
    // No second `scanned:` line: `assertScanned` above already emits it, and this
    // copy landed AFTER the --json payload, which made the pinned JSON output
    // unparseable. Caught by the CLI-contract test, not by inspection.
    return ok ? 0 : 1;
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
    try {
        process.exit(main(process.argv.slice(2)));
    } catch (exc) {
        if (exc instanceof ExitError) {
            // Mirror `raise SystemExit("config error: empty deny list")` — a
            // SystemExit with a STRING arg prints the message to stderr and
            // exits with code 1 (NOT 2; the docstring's "2 = config error" is a
            // doc inaccuracy in the .py — the actual code path exits 1).
            process.stderr.write(`${exc.message}\n`);
            process.exit(1);
        }
        throw exc;
    }
}

export { main, _tracked_files, _load_config, _skipped, _fnmatchToRegExp, _suffixLower, ExitError };
