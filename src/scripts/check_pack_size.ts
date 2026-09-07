#!/usr/bin/env tsx
/**
 * check_pack_size — enforce the published-tarball payload budget
 * (road-to-zero-ceremony-install Phase 4).
 *
 * Two metrics, both ungated before this script existed:
 *   1. COMPRESSED tarball size — absolute max, plus the >regression_pct creep
 *      rule (fails even under the absolute budget, so slow rot cannot hide
 *      under a generous cap).
 *   2. PER-SKILL share of the skills subtree — no single skill may silently
 *      reclaim space freed elsewhere. Named exceptions carry a reason.
 *
 * The UNPACKED size is deliberately NOT gated here — and since 2026-08-04 not
 * anywhere: the former `evaluator-budgets.unpacked_size_mb` key was removed by
 * maintainer decision (see `removed_2026_08_04` in evaluator-budgets.json);
 * the evaluator umbrella still measures it as evidence.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_pack_size [--json]
 *   ./scripts-run src/scripts/check_pack_size --pack-json <file>   # test/offline
 *
 * Exit codes: 0 green · 1 over budget · 2 misuse / unreadable input.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import { runSelfTest } from './_lib/gate_self_test.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const BUDGET_PATH = path.join(REPO_ROOT, 'src', 'config', 'pack-size-budget.json');
const SKILL_PREFIX = 'dist/agent-src/skills/';

export interface PackFile {
    path: string;
    size: number;
}

export interface PackResult {
    size: number;
    unpackedSize: number;
    files: PackFile[];
}

export interface PackSizeBudget {
    regression_pct: number;
    budgets: Record<string, { max: number; last_measured: number; method: string }>;
    per_skill_share: {
        max_pct: number;
        basis: string;
        rationale: string;
        exceptions: Record<string, { max_pct: number; measured_pct: number; reason: string }>;
    };
}

/**
 * Parse `npm pack --json` stdout. npm runs the `prepare` lifecycle script even
 * under `--ignore-scripts` on some versions, and this repo's `prepare` prints a
 * banner — straight into the stream we parse. Slice from a `[` so a lifecycle
 * banner is tolerated instead of becoming a SyntaxError.
 *
 * Not the FIRST `[`: npm echoes the lifecycle command line, and this repo's own
 * `prepare` is `[ -d .git ] && bash src/scripts/install-hooks.sh || true` — its
 * `[` precedes the payload's. Try each candidate offset in order and keep the
 * first that actually parses (road-to-gates-that-can-fail Phase 6.2).
 */
export function parsePackJson(stdout: string): PackResult {
    let parsed: PackResult[] | null = null;
    for (let i = stdout.indexOf('['); i >= 0; i = stdout.indexOf('[', i + 1)) {
        try {
            parsed = JSON.parse(stdout.slice(i)) as PackResult[];
            break;
        } catch {
            // Not the payload — a banner bracket. Keep scanning.
        }
    }
    // No candidate parsed: reproduce the original SyntaxError from the raw text.
    parsed ??= JSON.parse(stdout) as PackResult[];
    const first = parsed[0];
    if (first === undefined) throw new Error('npm pack --json returned an empty array');
    return first;
}

/** Bytes per skill under `dist/agent-src/skills/`, plus the subtree total. */
export function skillBytes(files: readonly PackFile[]): { perSkill: Record<string, number>; total: number } {
    const perSkill: Record<string, number> = {};
    let total = 0;
    for (const file of files) {
        if (!file.path.startsWith(SKILL_PREFIX)) continue;
        const name = file.path.slice(SKILL_PREFIX.length).split('/')[0];
        if (name === undefined || name === '') continue;
        perSkill[name] = (perSkill[name] ?? 0) + file.size;
        total += file.size;
    }
    return { perSkill, total };
}

/** Every violation, as human-readable lines. Empty array means green. */
/**
 * Content classes the published payload is checked for.
 *
 * The gap this closes: before it, the tarball was measured by SIZE and by build
 * correctness, and by nothing that read what the files ARE. A payload can be
 * comfortably under budget and still ship compiled tests, an IDE directory, or
 * a credential-shaped file.
 *
 * `limit: 0` is a hard class — nothing of that shape may ship. A positive limit
 * is a RATCHET: the number was measured, not chosen, and it may only walk down.
 * The distinction is in `measured_in`, which every entry carries, because the
 * same `npm pack` reports a fifth of the source maps in an unbuilt worktree as
 * in a built one. A threshold with no stated tree reads as drift the first time
 * someone runs it from a fresh checkout.
 */
interface ContentClass {
    id: string;
    /** Matches a payload path. */
    match: (p: string) => boolean;
    /** 0 = must not ship at all. > 0 = shrink-only ratchet. */
    limit: number;
    /** Which tree the limit was measured in, and when. */
    measured_in: string;
    /**
     * True when the class only exists in a BUILT tree.
     *
     * This is the difference between a check and a false pass. `npm pack
     * --dry-run --ignore-scripts` on a clean checkout — which is the condition
     * `pack-size-budget.json` declares for its own numbers — produces no
     * `dist/cli/**` at all, so a source-map count of 22 sails under a limit of
     * 120 while measuring a fifth of the payload. Reported NOT MEASURABLE
     * instead, on the same principle as the dead-scope assertion above: a check
     * that could not run is not a clean bill.
     */
    requires_build: boolean;
    why: string;
}

/**
 * Was this payload produced from a built tree?
 *
 * Keyed on the payload itself rather than on the filesystem, so it describes
 * the thing being judged instead of the machine judging it.
 */
function payloadIsBuilt(files: readonly PackFile[]): boolean {
    return files.some((f) => f.path.startsWith('dist/cli/'));
}

const CONTENT_CLASSES: readonly ContentClass[] = [
    {
        id: 'compiled-test-artefact',
        requires_build: true,
        match: (p) => /\.(test|spec)\.(js|js\.map|d\.ts)$/.test(p),
        limit: 0,
        measured_in: 'built main checkout, 2026-08-22: 8 `.test.js` + 8 `.test.js.map` were shipping before the `files[]` negations landed',
        why: "a compiled test's output has no consumer-facing purpose; council 2026-08-22 decision (b') strips BOTH the JS and its map, because stripping only the maps left the compiled tests themselves in the tarball",
    },
    {
        id: 'credential-shaped',
        requires_build: false,
        match: (p) => /(^|\/)\.env(\.|$)|\.pem$|(^|\/)id_(rsa|ed25519)$|\.p12$|\.pfx$/.test(p),
        limit: 0,
        measured_in: 'built main checkout, 2026-08-22: 0 present',
        why: 'a clean class with no check is indistinguishable from a class nobody looked at — and this one is worth a canary precisely because it is empty today',
    },
    {
        id: 'ide-metadata',
        requires_build: false,
        match: (p) => /(^|\/)\.(idea|vscode)\//.test(p),
        limit: 0,
        measured_in: 'built main checkout, 2026-08-22: 0 present',
        why: 'same reason as the credential class: empty and unchecked is not the same as empty and verified',
    },
    {
        id: 'source-map',
        requires_build: true,
        match: (p) => p.endsWith('.js.map'),
        limit: 120,
        measured_in: 'built worktree, 2026-08-22, AFTER the compiled-test negations: 120 product maps (128 total minus 8 test maps)',
        why: "a product source map is a consumer debugging affordance — proper line mapping and stepping over shipped JS — so council 2026-08-22 kept the 119/120 product maps and refused a blanket zero. Recorded as a PROVISIONAL measured ratchet, not an architectural constant: nothing here establishes that any consumer debugs the shipped JS, and nothing establishes they do not",
    },
];

/**
 * Count each content class in the payload and report over-limit classes.
 *
 * Returns one error string per violating class, with the offending paths — the
 * count alone tells a reader a rule broke and not which file broke it.
 */
export function classifyPayload(files: readonly PackFile[]): string[] {
    const out: string[] = [];
    const built = payloadIsBuilt(files);
    for (const c of CONTENT_CLASSES) {
        if (c.requires_build && !built) continue;
        const hits = files.filter((f) => c.match(f.path)).map((f) => f.path);
        if (hits.length <= c.limit) continue;
        const shown = hits.slice(0, 8);
        out.push(
            `content class \`${c.id}\`: ${String(hits.length)} entr${hits.length === 1 ? 'y' : 'ies'} ` +
                `exceeds its limit of ${String(c.limit)} (measured in: ${c.measured_in}) — ` +
                `${shown.join(', ')}${hits.length > shown.length ? `, +${String(hits.length - shown.length)} more` : ''}. ` +
                `Why this class is checked: ${c.why}`,
        );
    }
    return out;
}

/**
 * Payload TYPE classification — what an entry IS, not where it sits.
 *
 * `CONTENT_CLASSES` above matches PATHS. That catches the shapes with a naming
 * convention (a `.pem`, a `.test.js`, a `.vscode/` directory) and is blind to
 * everything else: a compiled binary named `helper`, an archive named
 * `data.md`, an extensionless script nobody looked at. Extension is the
 * attacker's choice; the first bytes are not.
 *
 * Priority is archive > binary > dotfile > no-extension > text, so each entry
 * lands in exactly one class and a count is a partition of the payload.
 */
export type PayloadType = 'text' | 'dotfile' | 'no-extension' | 'binary' | 'archive';

export const PAYLOAD_TYPES: readonly PayloadType[] = [
    'archive',
    'binary',
    'dotfile',
    'no-extension',
    'text',
];

/** Leading magic bytes for the archive container formats worth naming. */
const ARCHIVE_MAGIC: ReadonlyArray<readonly number[]> = [
    [0x50, 0x4b, 0x03, 0x04], // zip / jar / docx / xlsx
    [0x1f, 0x8b], // gzip
    [0x42, 0x5a, 0x68], // bzip2
    [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00], // xz
    [0x04, 0x22, 0x4d, 0x18], // lz4
    [0x28, 0xb5, 0x2f, 0xfd], // zstd
    [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], // 7z
    [0x52, 0x61, 0x72, 0x21], // rar
];

/** How many leading bytes are read to decide. */
export const MAGIC_BYTES_READ = 512;

function startsWith(buf: Uint8Array, sig: readonly number[]): boolean {
    if (buf.length < sig.length) return false;
    return sig.every((b, i) => buf[i] === b);
}

/**
 * Classify one entry from its name and its first bytes.
 *
 * `head` is null when the file could not be read. That is NOT text: an entry
 * the check could not open is an entry it did not classify, and the caller
 * treats it as a failure rather than letting it fall through to the class that
 * needs no exception.
 */
export function classifyEntry(entryPath: string, head: Uint8Array | null): PayloadType | 'unreadable' {
    if (head === null) return 'unreadable';
    if (ARCHIVE_MAGIC.some((sig) => startsWith(head, sig))) return 'archive';
    if (head.length > 0) {
        // A NUL byte is decisive. Short of that, a high proportion of C0
        // control bytes outside tab/newline/CR is what separates a compiled
        // object from prose that happens to contain an unusual character.
        if (head.includes(0)) return 'binary';
        let control = 0;
        for (const b of head) {
            if (b < 0x09 || (b > 0x0d && b < 0x20)) control += 1;
        }
        if (control / head.length > 0.1) return 'binary';
    }
    const base = entryPath.split('/').pop() ?? entryPath;
    if (base.startsWith('.')) return 'dotfile';
    if (!base.includes('.')) return 'no-extension';
    return 'text';
}

/**
 * An entry admitted into a class that would otherwise be empty.
 *
 * BOUND, not allow-listed, and the distinction is the whole point. A count
 * ratchet ("8 extensionless entries are fine") is satisfied by ANY eight
 * extensionless entries, so swapping one for something else passes silently —
 * the same key-lookup weakness the Phase 5 pragma work removed one layer up.
 * Here the binding is `sha256(path + "\n" + size)`: change the file and the
 * exception stops applying, which re-fires the check on the entry that changed.
 *
 * NOT a `*_allowlist.json`. There is no file to grow, each entry states its own
 * reason next to the class it excepts, and adding one is a reviewed code change
 * in the gate — the same shape `CONTENT_CLASSES` already uses for its ratchets.
 *
 * Recompute a fingerprint with:
 *   ./scripts-run src/scripts/check_pack_size   (the failure names path and size)
 */
export interface BoundPayloadException {
    readonly fingerprint: string;
    readonly path: string;
    readonly size: number;
    readonly why: string;
}

export function payloadFingerprint(entryPath: string, size: number): string {
    return createHash('sha256').update(`${entryPath}\n${String(size)}`).digest('hex');
}

/**
 * Bound exceptions exist for `dotfile` and `no-extension` ONLY.
 *
 * `binary` and `archive` are not exceptable: `classifyPayloadTypes` never
 * consults this table for either class, so both are the OBSERVED count and
 * cannot be excepted to zero. That is AC-6 of
 * `road-to-scan-that-fails-closed` read literally, after an AI council
 * (2026-09-07, 2 seats, unanimous over two rounds) resolved the split between
 * reading "at zero" as the ratchet and as the observed count. It chose the
 * observed count, and chose disposition 3 — ship a textual representation —
 * over generating fixtures at dry-run time, on the measurement that 12 of the
 * 15 asset-bearing media fixtures ALREADY ship an ASCII placeholder at their
 * documented path (`FIXTURE-<adapter-id>-<ext>`). The three 69-byte PNGs that
 * used to sit here were the outliers, not the norm; they now carry the sibling
 * convention and the class is empty by observation.
 */
const BOUND_PAYLOAD_EXCEPTIONS: readonly BoundPayloadException[] = [
    { fingerprint: '47e4328e71652a0375ade7eb4dac8a3e4b6df1c6e4e74caa75287266676cc9a6', path: 'agents/templates/.ai-council.yml.example', size: 30561, why: 'shipped council config TEMPLATE — a dotfile because the file it is copied to is one. RE-PINNED 2026-09-07, 29,872 -> 30,561 bytes: the exception is path-AND-size-bound by design, so this branch adding a `disabled_reason` honest-null block to the gemini seat in the template invalidated it and the gate refused the entry as unaccounted. The re-pin excepts the SAME path for the SAME reason at its measured new size — it does not widen the class, raise a cap, or except anything the gate was not already carrying.' },
    { fingerprint: 'd36a53951c184db7481139235056e90b53a853714b3a68b31ba1349ecb95ac1d', path: 'agents/templates/.ai-video.xml.example', size: 9209, why: 'shipped video-provider config template — same reason as the council template' },
    { fingerprint: 'f83229412cf8cceaadd0cb1934140a0c7c8277df43edc590f370572f6df6da98', path: 'dist/agent-src/templates/agents/.gitattributes.fragment', size: 2140, why: 'gitattributes fragment the installer appends to a consumer repo' },
    { fingerprint: 'a4f51dba3a66c0f2c3548e77961271ed4d7b5ec8a6661ea359ff044758f0d921', path: 'src/templates/minimal/.agent-settings.yml', size: 1042, why: 'the minimal-install settings template; the dot is the consumer-side filename' },
    { fingerprint: 'a9cb828c7f3e6ac62d3c55c2fd215779307bf695a065498b1d1e1188210ebea8', path: 'LICENSE', size: 1064, why: 'the licence npm requires in the tarball; extensionless by convention' },
    { fingerprint: 'e89a3d025a838e295838db68d0d832c701eeca01bb7e6c3983d3a48950f80017', path: 'NOTICE', size: 472, why: 'attribution notice shipped with the licence; extensionless by convention' },
    { fingerprint: 'c9da3c6e2476a6d2b9610a1fbf638ba9bb78ddd76fc0f799631d601774c32cab', path: 'dist/agent-src/templates/hooks/pre-commit-frontmatter', size: 2537, why: 'git hook template — git requires a hook file to carry no extension' },
    { fingerprint: 'aeffa474df3f805de07cdc9c6960c4918aa8e51e317fa1c30906d2f0267b7a16', path: 'dist/agent-src/templates/hooks/pre-commit-roadmap-progress', size: 3988, why: 'git hook template — same reason' },
    { fingerprint: '914f9c34551c5f4c42a70cd8bb0cd7b73078b0c4e7815b551833a3c64c8476d3', path: 'src/scripts/agent-config', size: 2391, why: 'the CLI entry script; an executable entry point carries no extension by convention' },
    { fingerprint: '0bb1cdd48ac2e9b6a2a56cde25de9fc221d75d42683680284c43118cff796e92', path: 'src/scripts/hooks/shims/php', size: 4439, why: 'shim invoked as the command name `php`; an extension would break the lookup' },
    { fingerprint: 'b14bdd3cd589848ad8e6d7e5f4ee633dc9005a2a97abba327a9426ce556714da', path: 'src/scripts/install', size: 22049, why: 'the installer entry script; same reason as the CLI entry' },
    { fingerprint: '1fb564019de468368e34941dffd5eb8bc994364313e02f476ff354ac0da464d7', path: 'src/templates/minimal/overrides-gitkeep', size: 164, why: 'placeholder that becomes .gitkeep on install; extensionless on purpose' },
    { fingerprint: 'a9eab60d58791fb49c5d8760ba6cfb11aa1db8def81f4e4cf507c9eeaf5219e4', path: 'src/vendor/grammars/tree-sitter-php.wasm', size: 812594, why: 'vendored tree-sitter grammar (ADR-259, amended 2026-09-07) — the code-graph engine ships its parsers so a consumer install can build a graph with no manual step. Genuinely binary, genuinely shipped: compiled WebAssembly is the only form a grammar has. The set is the three GRAMMAR_WASM entries the engine can actually load, NOT the 13-grammar default ADR-259 first named and not the 36-grammar pack — an unloadable grammar would be payload with no reader. Path-and-size-bound like every entry here, so a grammar refresh re-fails this gate by design. Provenance and refresh procedure: src/vendor/grammars/README.md.' },
    { fingerprint: '07a14e317b6b909fda4d0542f39ab3b1449b4b76a68e04c052553f10e15fad78', path: 'src/vendor/grammars/tree-sitter-typescript.wasm', size: 2342690, why: 'vendored tree-sitter grammar — same class and same reason as the php entry above; one of the three GRAMMAR_WASM languages the engine loads (it also serves .tsx)' },
    { fingerprint: '8ce86ec3d96da60552070bb9237ec8358fa5043496aa86b9c000028ec9482ae9', path: 'src/vendor/grammars/tree-sitter-javascript.wasm', size: 647334, why: 'vendored tree-sitter grammar — same class and same reason as the php entry above; one of the three GRAMMAR_WASM languages the engine loads' },
];

/** Read the first bytes of a payload entry from the tree it was packed from. */
function readHead(entryPath: string, root: string): Uint8Array | null {
    try {
        const fd = fs.openSync(path.join(root, entryPath), 'r');
        try {
            const buf = Buffer.alloc(MAGIC_BYTES_READ);
            const read = fs.readSync(fd, buf, 0, MAGIC_BYTES_READ, 0);
            return buf.subarray(0, read);
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return null;
    }
}

export interface TypeClassification {
    readonly counts: Record<PayloadType | 'unreadable', number>;
    /** Entries in a non-`text` class with no bound exception. */
    readonly unbound: Array<{ path: string; size: number; type: PayloadType | 'unreadable'; fingerprint: string }>;
    /** Bound exceptions matching no entry in this payload. */
    readonly unusedExceptions: string[];
}

/**
 * Classify the whole payload by type and report what is not accounted for.
 *
 * `archive` and `binary` are closed classes: no exception is consulted for
 * either, so each is the observed count and an entry in one is always a
 * violation. Dotfile and extensionless entries are each bound to a path AND a
 * size, so replacing one with different content re-fires the check on that
 * entry rather than passing inside a count.
 */
export function classifyPayloadTypes(
    files: readonly PackFile[],
    root = REPO_ROOT,
    head: (p: string) => Uint8Array | null = (p) => readHead(p, root),
): TypeClassification {
    const counts: Record<PayloadType | 'unreadable', number> = {
        archive: 0,
        binary: 0,
        dotfile: 0,
        'no-extension': 0,
        text: 0,
        unreadable: 0,
    };
    const byFingerprint = new Map(BOUND_PAYLOAD_EXCEPTIONS.map((e) => [e.fingerprint, e]));
    const used = new Set<string>();
    const unbound: TypeClassification['unbound'] = [];
    for (const f of files) {
        const type = classifyEntry(f.path, head(f.path));
        counts[type] += 1;
        if (type === 'text') continue;
        const fingerprint = payloadFingerprint(f.path, f.size);
        // `binary` and `archive` have no exception path — see BOUND_PAYLOAD_EXCEPTIONS.
        if (type !== 'binary' && type !== 'archive' && byFingerprint.has(fingerprint)) {
            used.add(fingerprint);
            continue;
        }
        unbound.push({ path: f.path, size: f.size, type, fingerprint });
    }
    return {
        counts,
        unbound,
        unusedExceptions: BOUND_PAYLOAD_EXCEPTIONS.filter((e) => !used.has(e.fingerprint)).map((e) => e.path),
    };
}

/** One line naming every type class and its count. */
export function payloadTypeLine(c: TypeClassification): string {
    const parts = [...PAYLOAD_TYPES, 'unreadable' as const]
        .filter((t) => t !== 'unreadable' || c.counts.unreadable > 0)
        .map((t) => `${t} ${String(c.counts[t])}`);
    return `${parts.join(' · ')} — ${String(c.unbound.length)} unaccounted`;
}

/** Violations from the type classification, as human-readable lines. */
export function typeClassViolations(c: TypeClassification): string[] {
    return c.unbound.map(
        (u) =>
            `payload type \`${u.type}\`: ${u.path} (${String(u.size)} bytes) is not accounted for. ` +
            (u.type === 'archive' || u.type === 'binary'
                ? 'This class is empty by observation and carries no exception path. ' +
                  'Exclude it from package.json files[], or ship a textual placeholder at the same path ' +
                  '(the media fixtures use `FIXTURE-<adapter-id>-<ext>`).'
                : 'Every dotfile and extensionless entry is carried by a path-and-size-bound exception. ' +
                  `If it belongs in the published surface, add a BoundPayloadException with ` +
                  `fingerprint sha256:${u.fingerprint} and a reason; otherwise exclude it from package.json files[].`),
    );
}

/** Per-class counts, for the green-path report. */
export function payloadClassCounts(
    files: readonly PackFile[],
): Array<{ id: string; count: number; limit: number; measurable: boolean }> {
    const built = payloadIsBuilt(files);
    return CONTENT_CLASSES.map((c) => ({
        id: c.id,
        count: files.filter((f) => c.match(f.path)).length,
        limit: c.limit,
        measurable: built || !c.requires_build,
    }));
}

/**
 * The recorded BUILT-surface figure, if the budget file carries one.
 *
 * Read by key SHAPE (`built_surface_measurement_<date>`) rather than by the one
 * dated key that exists today, so re-measuring the built surface is an added
 * record rather than an edit to this function. The newest key wins.
 */
export function recordedBuiltPackedMb(budget: PackSizeBudget): number | null {
    const keys = Object.keys(budget)
        .filter((k) => /^built_surface_measurement_/.test(k))
        .sort();
    const newest = keys[keys.length - 1];
    if (newest === undefined) return null;
    const block = (budget as unknown as Record<string, unknown>)[newest];
    if (block === null || typeof block !== 'object') return null;
    const built = (block as { built?: unknown }).built;
    if (built === null || typeof built !== 'object') return null;
    const value = (built as { packed_mb?: unknown }).packed_mb;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function evaluate(budget: PackSizeBudget, pack: PackResult): string[] {
    const errors: string[] = [];

    const packedMb = pack.size / 1e6;
    const entry = budget.budgets['packed_size_mb'];
    const built = payloadIsBuilt(pack.files);
    const pct = budget.regression_pct;
    if (entry === undefined) {
        errors.push('packed_size_mb: missing from the budget file — gate would pass vacuously');
    } else if (built) {
        // A BUILT payload is not the surface `max` describes, and comparing
        // them is the category error `pack-size-budget.json` warns about in its
        // own `measurement_conditions`: every cap in that file, `max: 9.1`
        // included, was measured with `--ignore-scripts` on a tree with no
        // `dist/cli/**`. The built surface it records separately is ~2 MB
        // larger *by construction*, so a job that happens to build first turns
        // a green branch red for a reason that has nothing to do with its diff.
        // Measured 2026-08-30: main 8.985 (2715 entries, unbuilt) against a
        // branch adding six source files at 9.922 (2827 entries) — the 112-file
        // difference is `dist/cli` + `dist/cli-delegate`, not the diff.
        //
        // So the built payload is judged against the recorded BUILT figure,
        // with the same creep percentage. That keeps teeth on the surface a
        // consumer installs instead of pretending the unbuilt cap covers it.
        const baseline = recordedBuiltPackedMb(budget);
        if (baseline === null) {
            errors.push(
                `packed_size_mb: measured ${packedMb.toFixed(3)} on a BUILT payload, and the budget `
                    + 'file records no built-surface measurement to compare it against — the unbuilt '
                    + 'cap does not describe this tree. Record one, or pack with --ignore-scripts.',
            );
        } else {
            const ceiling = baseline * (1 + pct / 100);
            if (packedMb > ceiling) {
                errors.push(
                    `packed_size_mb (BUILT surface): measured ${packedMb.toFixed(3)} regressed `
                        + `>${String(pct)}% vs the recorded built figure ${String(baseline)} `
                        + `(ceiling ${ceiling.toFixed(3)})`,
                );
            }
        }
    } else if (packedMb > entry.max) {
        errors.push(`packed_size_mb: measured ${packedMb.toFixed(3)} exceeds budget ${entry.max}`);
    } else {
        const ceiling = entry.last_measured * (1 + pct / 100);
        if (entry.last_measured > 0 && packedMb > ceiling) {
            errors.push(
                `packed_size_mb: measured ${packedMb.toFixed(3)} regressed >${pct}% vs ` +
                    `last_measured ${entry.last_measured} (ceiling ${ceiling.toFixed(3)}) — ` +
                    'fails even under the absolute budget',
            );
        }
    }

    const { perSkill, total } = skillBytes(pack.files);
    if (total === 0) {
        errors.push(`per_skill_share: no files under ${SKILL_PREFIX} — gate would pass vacuously`);
        return errors;
    }
    const { max_pct: defaultMax, exceptions } = budget.per_skill_share;
    for (const [name, bytes] of Object.entries(perSkill)) {
        const share = (bytes / total) * 100;
        const exception = exceptions[name];
        const cap = exception?.max_pct ?? defaultMax;
        if (share > cap) {
            errors.push(
                exception === undefined
                    ? `per_skill_share: ${name} is ${share.toFixed(2)}% of the skills payload, over the ${cap}% cap — ` +
                      'shrink it, or add a named exception with a reason'
                    : `per_skill_share: ${name} is ${share.toFixed(2)}%, over its own exception cap of ${cap}% — ` +
                      'the exception is not a blank cheque; shrink it or raise the cap with a reason',
            );
        }
    }
    for (const name of Object.keys(exceptions)) {
        if (!(name in perSkill)) {
            errors.push(`per_skill_share: exception for '${name}' is stale — no such skill ships`);
        }
    }
    return errors;
}

function readPack(argv: readonly string[]): PackResult {
    const idx = argv.indexOf('--pack-json');
    if (idx >= 0) {
        const file = argv[idx + 1];
        if (file === undefined) throw new Error('--pack-json needs a path');
        return parsePackJson(fs.readFileSync(file, 'utf-8'));
    }
    const stdout = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', '--silent'], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parsePackJson(stdout);
}

/**
 * Per-class discrimination, proven rather than asserted.
 *
 * WHY THIS EXISTS AND THE CANARY DOES NOT COVER IT. `gate-coverage.yml` carries
 * `canary?: CanarySpec` — exactly ONE recipe per gate id, not a list (see
 * `check_gate_coverage.ts`'s entry shape). The roadmap step behind this asked
 * for "one canary per class", which the register cannot express. Two of the four
 * classes cannot be planted through it at all: `compiled-test-artefact` is
 * excluded from the payload by the `files[]` negations that fixed it, so a plant
 * never ships and never reds, and `source-map` needs 121 files in a BUILT tree.
 *
 * So the register gets the one canary it can hold — the credential-shaped plant,
 * chosen because that class is empty today and an empty unchecked class is
 * indistinguishable from one nobody looked at — and every class is proven red
 * here, over a synthetic payload, deterministically and with no pack run.
 *
 * A test file was the alternative and is weaker: the non-adopter ratchet in
 * `check_gate_coverage` requires a NEW registered gate to carry a `--self-test`
 * or an exemption, and a self-test drives the gate's own decision function
 * rather than a copy of it.
 */
function packFiles(...paths: readonly string[]): PackFile[] {
    return paths.map((path) => ({ path, size: 1 }));
}

/** A payload that looks built, so `requires_build` classes do not abstain. */
function builtPayload(...paths: readonly string[]): PackFile[] {
    return packFiles('dist/cli/agent-config.js', ...paths);
}

function selfTest(): number {
    // NOT under `dist/cli/` — that prefix is exactly what `payloadIsBuilt`
    // keys on, so maps placed there would make an "unbuilt" fixture built and
    // the abstain case would test nothing. Found by the case failing, which is
    // the self-test doing its job on its own fixtures.
    const maps = (n: number): string[] =>
        Array.from({ length: n }, (_, i) => `dist/hooks/chunk-${String(i)}.js.map`);
    return runSelfTest({
        gate: 'check_pack_size',
        minCases: 14,
        minRejectCases: 9,
        cases: [
            {
                name: 'credential-shaped: a .pem in the payload is refused',
                expect: 'reject',
                run: () => (classifyPayload(packFiles('src/scripts/x.pem')).length > 0 ? 1 : 0),
            },
            {
                name: 'credential-shaped: a dotted .env form is refused',
                expect: 'reject',
                run: () => (classifyPayload(packFiles('src/config/.env.production')).length > 0 ? 1 : 0),
            },
            {
                name: 'ide-metadata: a .vscode entry is refused',
                expect: 'reject',
                run: () => (classifyPayload(packFiles('src/scripts/.vscode/settings.json')).length > 0 ? 1 : 0),
            },
            {
                name: 'compiled-test-artefact: a shipped .test.js is refused',
                expect: 'reject',
                run: () => (classifyPayload(builtPayload('dist/cli/a.test.js')).length > 0 ? 1 : 0),
            },
            {
                name: 'source-map: one over the measured ratchet is refused',
                expect: 'reject',
                run: () => (classifyPayload(builtPayload(...maps(121))).length > 0 ? 1 : 0),
            },
            {
                name: 'source-map: the ratchet boundary itself passes',
                expect: 'accept',
                run: () => (classifyPayload(builtPayload(...maps(120))).length > 0 ? 1 : 0),
            },
            {
                // MAGIC BYTES, NOT THE EXTENSION. This is the whole reason the
                // type pass exists beside the path pass above: an archive named
                // `.md` is invisible to every path pattern in CONTENT_CLASSES.
                name: 'type/archive: a zip planted under a .md name is classified archive, not text',
                expect: 'reject',
                run: () =>
                    typeClassViolations(
                        classifyPayloadTypes(packFiles('src/skills/x/SKILL.md'), REPO_ROOT, () =>
                            Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
                        ),
                    ).length > 0
                        ? 1
                        : 0,
            },
            {
                name: 'type/archive: the SAME path with ordinary text is classified text and passes',
                expect: 'accept',
                run: () =>
                    typeClassViolations(
                        classifyPayloadTypes(packFiles('src/skills/x/SKILL.md'), REPO_ROOT, () =>
                            new TextEncoder().encode('# An ordinary skill\n'),
                        ),
                    ).length > 0
                        ? 1
                        : 0,
            },
            {
                name: 'type/binary: a NUL-bearing entry is refused however it is named',
                expect: 'reject',
                run: () =>
                    typeClassViolations(
                        classifyPayloadTypes(packFiles('src/scripts/helper.ts'), REPO_ROOT, () =>
                            Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x00, 0x00]),
                        ),
                    ).length > 0
                        ? 1
                        : 0,
            },
            {
                // THE CLOSED-CLASS SENSITIVITY PROOF. `LICENSE` at 1064 bytes
                // carries a real bound exception, so under the pre-2026-09-07
                // code this entry passed. It is fed binary head bytes here, and
                // binary outranks no-extension in `classifyEntry`, so a
                // still-exceptable `binary` class would accept it. It must not:
                // AC-6 of road-to-scan-that-fails-closed reads "at zero" as the
                // OBSERVED count, and this row is what would go red if the
                // exception path were ever reopened for the class.
                name: 'type/binary: an entry with a VALID bound exception is still refused once it reads binary',
                expect: 'reject',
                run: () =>
                    typeClassViolations(
                        classifyPayloadTypes([{ path: 'LICENSE', size: 1064 }], REPO_ROOT, () =>
                            Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x00, 0x00]),
                        ),
                    ).length > 0
                        ? 1
                        : 0,
            },
            {
                // The negative control for the row above: the SAME exceptable
                // path with ordinary text still passes on its exception.
                name: 'type/extensionless: the same bound entry with text content still passes',
                expect: 'accept',
                run: () =>
                    typeClassViolations(
                        classifyPayloadTypes([{ path: 'LICENSE', size: 1064 }], REPO_ROOT, () =>
                            new TextEncoder().encode('Apache License\n'),
                        ),
                    ).length > 0
                        ? 1
                        : 0,
            },
            {
                name: 'type/extensionless: an unbound extensionless entry is refused',
                expect: 'reject',
                run: () =>
                    typeClassViolations(
                        classifyPayloadTypes(packFiles('src/scripts/newtool'), REPO_ROOT, () =>
                            new TextEncoder().encode('#!/bin/sh\n'),
                        ),
                    ).length > 0
                        ? 1
                        : 0,
            },
            {
                // The property a COUNT ratchet cannot have. LICENSE is bound at
                // its measured size; the same path at a different size is a
                // different artifact and the exception stops applying.
                name: 'type/binding: a bound entry whose SIZE changed is refused again',
                expect: 'reject',
                run: () =>
                    typeClassViolations(
                        classifyPayloadTypes([{ path: 'LICENSE', size: 999999 }], REPO_ROOT, () =>
                            new TextEncoder().encode('MIT\n'),
                        ),
                    ).length > 0
                        ? 1
                        : 0,
            },
            {
                name: 'type/binding: that same entry at its recorded size passes',
                expect: 'accept',
                run: () =>
                    typeClassViolations(
                        classifyPayloadTypes([{ path: 'LICENSE', size: 1064 }], REPO_ROOT, () =>
                            new TextEncoder().encode('MIT\n'),
                        ),
                    ).length > 0
                        ? 1
                        : 0,
            },
            {
                // An entry the check could not open is one it did not classify.
                name: 'type/unreadable: an entry that cannot be read is refused, never assumed text',
                expect: 'reject',
                run: () =>
                    typeClassViolations(
                        classifyPayloadTypes(packFiles('src/scripts/gone.ts'), REPO_ROOT, () => null),
                    ).length > 0
                        ? 1
                        : 0,
            },
            {
                name: 'a plain payload passes — the classes are not firing on everything',
                expect: 'accept',
                run: () => (classifyPayload(packFiles('src/scripts/x.ts', 'README.md')).length > 0 ? 1 : 0),
            },
            {
                // The false pass 1.2 closed. An unbuilt payload carries a fifth
                // of the source maps, so a build-gated class must ABSTAIN there
                // rather than report clean — and must not report a failure
                // either, or every clean-checkout run would red.
                name: 'unbuilt payload: build-gated classes abstain, not pass and not fail',
                expect: 'accept',
                run: () => (classifyPayload(packFiles(...maps(121))).length > 0 ? 1 : 0),
            },
            {
                name: 'unbuilt payload: a build-INDEPENDENT class still fires',
                expect: 'reject',
                run: () => (classifyPayload(packFiles('src/scripts/id_rsa')).length > 0 ? 1 : 0),
            },
        ],
    });
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();
    let budget: PackSizeBudget;
    let pack: PackResult;
    try {
        budget = JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf-8')) as PackSizeBudget;
    } catch (err) {
        process.stderr.write(`❌  pack size: cannot read ${BUDGET_PATH}: ${String(err)}\n`);
        return 2;
    }
    try {
        pack = readPack(argv);
    } catch (err) {
        process.stderr.write(`❌  pack size: npm pack failed: ${String(err)}\n`);
        return 2;
    }
    // The pack manifest IS the corpus. `evaluate` refuses a vacuous per-skill
    // share, but the packed-size arm has no such floor: an empty payload — a
    // botched `files[]`, a pack that resolved nothing — measures 0 MB and sits
    // comfortably under every budget.
    try {
        assertScanned({
            gate: 'check_pack_size',
            scanned: pack.files.length,
            units: 'packed file(s)',
            roots: ['npm pack --dry-run payload (package.json files[])'],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            // 2, not 1: the documented meaning of 1 is "over budget", and an
            // empty manifest is unreadable input, not a budget violation.
            process.stderr.write(`❌  pack size: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    // The coverage register requires an enforced gate to report what it
    // inspected, and it is the same reason `assertScanned` runs above: a verdict
    // with no denominator cannot be told apart from a verdict over nothing.
    // Printed on EVERY path, including the failing one, so a reader of a red run
    // still knows the population it was red over.
    process.stdout.write(`scanned: ${String(pack.files.length)}\n`);

    const types = classifyPayloadTypes(pack.files);
    const errors = [
        ...evaluate(budget, pack),
        ...classifyPayload(pack.files),
        ...typeClassViolations(types),
    ];
    const { perSkill, total } = skillBytes(pack.files);
    if (argv.includes('--json')) {
        process.stdout.write(
            `${JSON.stringify({ packed_mb: pack.size / 1e6, skills_total_bytes: total, skills: Object.keys(perSkill).length, errors }, null, 2)}\n`,
        );
        return errors.length > 0 ? 1 : 0;
    }
    // Printed BEFORE the verdict and on EVERY path, red included. The counts are
    // what a reader needs to judge a violation: "one unaccounted binary" reads
    // very differently against a payload of 3 binaries than against one of 0.
    process.stdout.write(`    payload types: ${payloadTypeLine(types)}\n`);
    for (const unused of types.unusedExceptions) {
        // Not an error: an unbuilt tree legitimately packs fewer files. Named
        // so a stale exception is visible rather than accumulating unread.
        process.stdout.write(`    bound exception matched no entry: ${unused}\n`);
    }
    if (errors.length > 0) {
        for (const e of errors) process.stderr.write(`❌  pack size: ${e}\n`);
        return 1;
    }
    process.stdout.write(
        // The SURFACE is named on the green path too. A figure with no surface
        // label is how two numbers for one lever start circulating, which is
        // the confusion this budget file opens by warning about.
        `✅  pack size within budget (${payloadIsBuilt(pack.files) ? 'BUILT surface, vs the recorded built figure' : 'UNBUILT surface, vs max'}) — ${(pack.size / 1e6).toFixed(3)} MB packed, ` +
            `${Object.keys(perSkill).length} skills, largest share ` +
            `${Math.max(...Object.values(perSkill).map((b) => (b / total) * 100)).toFixed(2)}%\n`,
    );
    // Printed on the GREEN path on purpose. A class that is clean and silent is
    // indistinguishable from a class nobody checks, which is the whole reason
    // two of these four are limit-0 over an empty set today.
    for (const c of payloadClassCounts(pack.files)) {
        const verdict = c.measurable
            ? `${String(c.count)} / ${c.limit === 0 ? 'must be 0' : `${String(c.limit)} max`}`
            : 'NOT MEASURABLE — this payload has no dist/cli/**, so the tree is unbuilt and the class is out of view';
        process.stdout.write(`    content class ${c.id}: ${verdict}\n`);
    }
    return 0;
}

const _selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_selfPath)) {
    process.exit(main());
}
