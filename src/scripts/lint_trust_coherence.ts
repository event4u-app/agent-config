#!/usr/bin/env tsx
/**
 * Lint trust/safety coherence across the discovery manifest.
 *
 * TypeScript twin of `src/scripts/lint_trust_coherence.py` (ADR-092,
 * Phase 4 / Wave 4b). Mirrors the Python CLI contract EXACTLY — `--quiet`
 * / `--manifest` / `--router` / `--compiled-src` flags, finding messages,
 * stdout/stderr split (errors + summary on stderr; success on stdout),
 * SystemExit-on-missing-file semantics, exit codes. No behaviour changes —
 * latent bugs replicated.
 *
 * Walks the discovery manifest and asserts three invariants:
 *   1. advisory/restricted packs ship a `*safety-floor*` rule;
 *   2. every human_review_required artefact carries the HRR banner marker
 *      in its compiled output under dist/agent-src/;
 *   3. every router.json kernel[] rule declares trust.level: core.
 *
 * Exit codes: 0 clean, 1 on any violation. SystemExit (code 1, stderr ERROR)
 * when the manifest or router.json is missing.
 *
 * Test seam: `_setConfigForTest` mirrors the Python tests' monkeypatch of
 * module-level ROOT / MANIFEST / ROUTER / COMPILED_SRC constants.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { strip_source_prefix } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
const _DEFAULT_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

interface Config {
    ROOT: string;
    MANIFEST: string;
    ROUTER: string;
    COMPILED_SRC: string;
}

function _deriveConfig(root: string): Config {
    return {
        ROOT: root,
        MANIFEST: path.join(root, 'dist', 'discovery', 'discovery-manifest.json'),
        ROUTER: path.join(root, 'dist', 'router.json'),
        COMPILED_SRC: path.join(root, 'dist/agent-src'),
    };
}

const _config: Config = _deriveConfig(_DEFAULT_ROOT);

/** Test seam mirroring the Python tests' monkeypatch of module constants. */
function _setConfigForTest(overrides: Partial<Config>): void {
    Object.assign(_config, overrides);
}

const _BANNER_MARKER = '<!-- agent-config:human-review-banner -->';

const _FLAGGED_LEVELS = ['advisory', 'restricted'] as const;
const _SAFETY_FLOOR_FRAGMENT = 'safety-floor';

// SystemExit carrier — mirrors Python `raise SystemExit(msg)` (prints msg to
// stderr, exits 1) when surfaced at the top level.
class SystemExit extends Error {
    constructor(public readonly msg: string) {
        super(msg);
        this.name = 'SystemExit';
    }
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** `path.stem` — filename without the final suffix. */
function _stem(p: string): string {
    const base = path.basename(p);
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(0, dot) : base;
}

/** POSIX relative path of `target` under `root` (str(Path.relative_to)). */
function _relToPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

type JsonObject = Record<string, unknown>;

function _asArray(v: unknown): unknown[] {
    return Array.isArray(v) ? v : [];
}

function _asObject(v: unknown): JsonObject {
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as JsonObject) : {};
}

function _load_manifest(p: string): JsonObject {
    if (!_exists(p)) {
        throw new SystemExit(
            `ERROR: manifest not found: ${p}\n` + '  Run `task build-discovery` first.',
        );
    }
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as JsonObject;
}

function _load_kernel(p: string): Set<string> {
    if (!_exists(p)) {
        throw new SystemExit(`ERROR: router.json not found: ${p}`);
    }
    const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as JsonObject;
    const kernel = data['kernel'] ?? [];
    if (!Array.isArray(kernel)) {
        throw new SystemExit('ERROR: router.json `kernel` must be a list');
    }
    return new Set(kernel.map((name) => String(name)));
}

function _check_pack_safety_floors(manifest: JsonObject): string[] {
    const errs: string[] = [];
    const packPaths = new Map<string, string[]>();
    for (const artRaw of _asArray(manifest['artefacts'])) {
        const art = _asObject(artRaw);
        for (const pack of _asArray(art['packs'])) {
            const key = String(pack);
            if (!packPaths.has(key)) {
                packPaths.set(key, []);
            }
            packPaths.get(key)!.push(String(art['path']));
        }
    }

    for (const packRaw of _asArray(manifest['packs'])) {
        const pack = _asObject(packRaw);
        const summary = _asObject(pack['trust_summary']);
        const flaggedTotal = _FLAGGED_LEVELS.reduce(
            (acc, lvl) => acc + _toInt(summary[lvl] ?? 0),
            0,
        );
        if (flaggedTotal === 0) {
            continue;
        }
        const paths = packPaths.get(String(pack['id'])) ?? [];
        const hasFloor = paths.some((p) => p.includes(_SAFETY_FLOOR_FRAGMENT));
        if (!hasFloor) {
            const counts = _FLAGGED_LEVELS.map(
                (lvl) => `${lvl}=${_toInt(summary[lvl] ?? 0)}`,
            ).join(', ');
            errs.push(
                `pack \`${String(pack['id'])}\` declares flagged artefacts (${counts})` +
                    ` but ships no \`*${_SAFETY_FLOOR_FRAGMENT}*\` rule`,
            );
        }
    }
    return errs;
}

function _check_human_review_banners(manifest: JsonObject, compiledSrc: string): string[] {
    const errs: string[] = [];
    for (const artRaw of _asArray(manifest['artefacts'])) {
        const art = _asObject(artRaw);
        const trust = _asObject(art['trust']);
        if (!trust['human_review_required']) {
            continue;
        }
        const rel = String(art['path']);
        const logical = strip_source_prefix(rel);
        if (logical === null) {
            errs.push(
                `${rel}: human_review_required=true but path is not under` +
                    ' any known source root',
            );
            continue;
        }
        const compiled = path.join(compiledSrc, logical);
        if (!_exists(compiled)) {
            errs.push(
                `${rel}: human_review_required=true but compiled output` +
                    ` missing at \`${_relToPosix(compiled, _config.ROOT)}\``,
            );
            continue;
        }
        const body = fs.readFileSync(compiled, 'utf-8');
        if (!body.includes(_BANNER_MARKER)) {
            errs.push(
                `${rel}: human_review_required=true but compiled output` +
                    ` \`${_relToPosix(compiled, _config.ROOT)}\` is missing the HRR banner` +
                    ` (\`${_BANNER_MARKER}\`) — re-run \`task condense\`.`,
            );
        }
    }
    return errs;
}

function _check_kernel_trust(manifest: JsonObject, kernel: Set<string>): string[] {
    const errs: string[] = [];
    const ruleByName = new Map<string, JsonObject>();
    for (const artRaw of _asArray(manifest['artefacts'])) {
        const art = _asObject(artRaw);
        if (art['category'] !== 'rule') {
            continue;
        }
        let name = art['name'];
        if (!name) {
            const logical = strip_source_prefix(String(art['path'] ?? ''));
            if (logical === null) {
                continue;
            }
            name = _stem(logical);
        }
        ruleByName.set(String(name), art);
    }

    for (const kname of [...kernel].sort()) {
        const art = ruleByName.get(kname);
        if (art === undefined) {
            errs.push(
                `kernel rule \`${kname}\` listed in router.json but no` +
                    ' matching artefact in manifest',
            );
            continue;
        }
        const level = _asObject(art['trust'])['level'];
        if (level !== 'core') {
            errs.push(
                `kernel rule \`${kname}\` has trust.level=\`${_pyStr(level)}\`` +
                    ' — must be `core` (router.json kernel guarantees Iron-Law' +
                    ' floor)',
            );
        }
    }
    return errs;
}

/** Mirror Python `f"{level}"` for a possibly-None value. */
function _pyStr(v: unknown): string {
    if (v === null || v === undefined) {
        return 'None';
    }
    if (typeof v === 'boolean') {
        return v ? 'True' : 'False';
    }
    return String(v);
}

/** Mirror Python `int(x)` for the int-ish summary counts. */
function _toInt(v: unknown): number {
    if (typeof v === 'number') {
        return Math.trunc(v);
    }
    if (typeof v === 'boolean') {
        return v ? 1 : 0;
    }
    const n = parseInt(String(v), 10);
    return Number.isNaN(n) ? 0 : n;
}

interface ParsedArgs {
    quiet: boolean;
    manifest: string;
    router: string;
    compiledSrc: string;
}

function _argparse_error(message: string): never {
    process.stderr.write(`lint_trust_coherence: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let quiet = false;
    let manifest = _config.MANIFEST;
    let router = _config.ROUTER;
    let compiledSrc = _config.COMPILED_SRC;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        const takeValue = (flag: string): string => {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error(`argument ${flag}: expected one argument`);
            }
            return v;
        };
        if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '--manifest') {
            manifest = takeValue('--manifest');
        } else if (arg.startsWith('--manifest=')) {
            manifest = arg.slice('--manifest='.length);
        } else if (arg === '--router') {
            router = takeValue('--router');
        } else if (arg.startsWith('--router=')) {
            router = arg.slice('--router='.length);
        } else if (arg === '--compiled-src') {
            compiledSrc = takeValue('--compiled-src');
        } else if (arg.startsWith('--compiled-src=')) {
            compiledSrc = arg.slice('--compiled-src='.length);
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: lint_trust_coherence [-h] [--quiet] [--manifest MANIFEST] ' +
                    '[--router ROUTER] [--compiled-src COMPILED_SRC]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { quiet, manifest, router, compiledSrc };
}

function main(argv: readonly string[] = []): number {
    const args = parse_args(argv);

    const manifest = _load_manifest(args.manifest);
    const kernel = _load_kernel(args.router);

    const errs: string[] = [];
    errs.push(..._check_pack_safety_floors(manifest));
    errs.push(..._check_human_review_banners(manifest, args.compiledSrc));
    errs.push(..._check_kernel_trust(manifest, kernel));

    const packCount = _asArray(manifest['packs']).length;
    const artCount = _asArray(manifest['artefacts']).length;

    if (errs.length > 0) {
        for (const e of errs) {
            process.stderr.write(`ERROR: ${e}\n`);
        }
        process.stderr.write(
            `\n${errs.length} trust-coherence violation(s) across` +
                ` ${packCount} pack(s) and` +
                ` ${artCount} artefact(s).\n`,
        );
        return 1;
    }

    if (!args.quiet) {
        const hrrCount = _asArray(manifest['artefacts']).filter(
            (a) => _asObject(_asObject(a)['trust'])['human_review_required'],
        ).length;
        process.stdout.write(
            '✅  lint-trust-coherence:' +
                ` ${packCount} pack(s),` +
                ` ${kernel.size} kernel rule(s),` +
                ` ${hrrCount}` +
                ' HRR artefact(s) clean.\n',
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exit(main(process.argv.slice(2)));
    } catch (e) {
        if (e instanceof SystemExit) {
            process.stderr.write(`${e.msg}\n`);
            process.exit(1);
        }
        throw e;
    }
}

export {
    type Config,
    _setConfigForTest,
    _config,
    _BANNER_MARKER,
    SystemExit,
    main,
};
