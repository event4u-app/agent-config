/**
 * Shared release constants, paths and Python-parity error types.
 *
 * Extracted for step 1.1 of `road-to-release-publication-integrity`. It exists
 * because the publication unit and the changelog/version unit both need these
 * and neither may import the other: `release.ts` importing back from
 * `release_publication.ts` while that file imports `REMOTE` from `release.ts` is
 * a cycle, and a cycle is worse than the large file the split is trying to fix.
 * A third leaf module is the smallest shape without one.
 *
 * Contains almost no logic and reaches nothing — paths, two branch names, two
 * GitHub body limits, three error classes, and the JSON serializer the version
 * bumps share. That is what makes it a safe leaf.
 *
 * The two manifest-version writers live here rather than in `release.ts` for a
 * measured reason: `release.ts` is 564 lines over the 1500-line source-size
 * ratchet, so every line added there is charged, and this function needs
 * exactly two things this module already owns — the manifest paths and
 * `jsonDumpsIndent`. Extraction, not a baseline bump. `set_marketplace_version`
 * moved with its Augment twin because the argument is identical and splitting a
 * matched pair across two files for no reason is the worse shape.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

// ---------------------------------------------------------------------------
// Python-runtime parity helpers
// ---------------------------------------------------------------------------

/** Mirror of Python `sys.exit(code)` raised by `die()`. Caught at the CLI entry. */
class SystemExitError extends Error {
    constructor(public readonly code: number) {
        super(`system-exit-${code}`);
    }
}

/** argparse usage-error / help exit (code 2 / 0). */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

/**
 * Mirror of `subprocess.CalledProcessError`. Thrown by `run()` when a command
 * fails with `check=True` and output is NOT captured — the retired Python implementation
 * lets `CalledProcessError` propagate in that path. The CLI entry guard does
 * NOT catch this, so it surfaces (non-zero exit + traceback), matching Python.
 */
class CalledProcessError extends Error {
    constructor(
        public readonly returncode: number,
        public readonly cmd: readonly string[],
    ) {
        super(`Command '${cmd.join(' ')}' returned non-zero exit status ${returncode}.`);
    }
}

// ---------------------------------------------------------------------------
// Module-level constants (release.py:70-84)
// ---------------------------------------------------------------------------

// REPO_ROOT: release.py is at src/scripts/release.py;
// Path(__file__).resolve().parent.parent.parent == src/scripts → src → repo
// root. release.ts lives in the same dir, so _HERE-dir is src/scripts and
// `..`/`..` reaches the repo root (matches changelog_eras.ts's 3-up from
// _lib/ and install.ts's REPO_ROOT computation).
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');
// Bumped alongside package.json — see set_lockfile_version for why.
const PACKAGE_LOCK_JSON = path.join(REPO_ROOT, 'package-lock.json');
const MARKETPLACE_JSON = path.join(REPO_ROOT, '.claude-plugin', 'marketplace.json');
// The Augment twins. Both ship in the npm tarball (`publish-surface.json`
// roots) and both are version-synced to package.json — see
// lint_marketplace.check_augment_manifests for why they are not independent.
const AUGMENT_PLUGIN_JSON = path.join(REPO_ROOT, '.augment-plugin', 'plugin.json');
const AUGMENT_MARKETPLACE_JSON = path.join(REPO_ROOT, '.augment-plugin', 'marketplace.json');
// Source-of-truth project-settings template. Carries an `agent_config_version`
// pin that check_template_pin_drift requires to equal package.json.version. We
// bump the src twin here; `task release-prepare` (run right after the bump)
// regenerates the dist/agent-src/ twin from it.
const PROJECT_TEMPLATE = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'agents',
    'agent-project-settings.example.yml',
);
const CHANGELOG = path.join(REPO_ROOT, 'CHANGELOG.md');

/**
 * Overridable reader for the WORKING-TREE changelog.
 *
 * Mirrors `_set_exec_override` in `release_publication.ts`, and exists for the
 * same reason: `execute()` reads `CHANGELOG.md` off disk at two points (the PR
 * body and the annotated-tag message), and the release drill fakes commands
 * but not the filesystem. Before this seam the drill's step 8 read the
 * repository's REAL changelog — whose current section carries four
 * `_auto-derived, rewrite before merge:_` lines at `14.13.0` — so a
 * publication guard added at that call site refused every drill scenario for a
 * reason that had nothing to do with what the scenario was testing.
 *
 * That is the failure mode the `WorldConfig.changelog` fixture already removed
 * for `git show`, and the AI council of 2026-08-23 (2/2 convergent) chose a
 * controlled fixture over a policy exemption when it removed it. This is the
 * same choice applied to the other read: the drill supplies policy-valid
 * content and exercises the real parsing and guarding path, rather than being
 * exempted from it.
 *
 * `null` restores the real filesystem read. Test-only; nothing in production
 * sets it.
 */
let _changelog_reader: ((file: string) => string) | null = null;

function _set_changelog_reader(fn: ((file: string) => string) | null): void {
    _changelog_reader = fn;
}

/** The working-tree changelog text, through the seam above. */
function read_changelog_text(): string {
    return _changelog_reader ? _changelog_reader(CHANGELOG) : fs.readFileSync(CHANGELOG, 'utf-8');
}
const MAIN_BRANCH = 'main';
const REMOTE = 'origin';
const REPO_SLUG = 'event4u-app/agent-config';

// GitHub rejects bodies over these limits with a GraphQL "Body is too
// long" error. The full entry always lands in CHANGELOG.md (committed in
// the PR diff and attached to the tag), so an oversized body is capped
// with a pointer rather than failing the release — a major bump can
// render hundreds of commit bullets, well past the 65 536 PR-body limit.
const GH_PR_BODY_LIMIT = 65_536; // createPullRequest mutation hard limit
const GH_RELEASE_NOTES_LIMIT = 125_000; // release-notes body limit
/**
 * Return `text` unchanged when within `limit` chars; otherwise truncate at
 * the last line boundary that fits and append a pointer to `full_ref` so
 * nothing is silently lost.
 */
function _cap_body(text: string, limit: number, full_ref: string): string {
    if (pyLen(text) <= limit) {
        return text;
    }
    const notice =
        `\n\n> _Changelog truncated to fit GitHub's ` +
        `${commaGroup(limit)}-character body limit — full entry in ${full_ref}._`;
    let head = pySlice(text, limit - pyLen(notice));
    const nl = head.lastIndexOf('\n');
    if (nl > 0) {
        head = head.slice(0, nl);
    }
    return head + notice;
}
/** Python `len(str)` — number of Unicode code points (not UTF-16 units). */
function pyLen(s: string): number {
    return [...s].length;
}

/** Python `text[:n]` on a string — first `n` code points. */
function pySlice(s: string, n: number): string {
    return [...s].slice(0, n).join('');
}

/** Python f-string `{n:,}` — thousands grouping with commas (en-US grouping). */
function commaGroup(n: number): string {
    const neg = n < 0;
    const digits = Math.abs(n).toString();
    let out = '';
    for (let i = 0; i < digits.length; i += 1) {
        if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
        out += digits[i];
    }
    return neg ? '-' + out : out;
}

/** Python `re.escape` — escape regex-special chars in a literal string. */
function reEscape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\#\-]/g, '\\$&');
}

// --- JSON byte-parity (mirrors install.ts; see Parity notes for ensure_ascii). ---

function _jsonStrNoAscii(s: string): string {
    // json.dumps(ensure_ascii=False): escape control chars + " + \, keep >=0x20.
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
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
            case '\r':
                out += '\\r';
                break;
            case '\t':
                out += '\\t';
                break;
            case '\b':
                out += '\\b';
                break;
            case '\f':
                out += '\\f';
                break;
            default:
                if (code < 0x20) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else {
                    out += ch;
                }
        }
    }
    return out + '"';
}

function _jsonScalar(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            if (Number.isNaN(value)) return 'NaN';
            return value > 0 ? 'Infinity' : '-Infinity';
        }
        return String(value);
    }
    if (typeof value === 'string') return _jsonStrNoAscii(value);
    return null;
}

function _dumpIndent(value: unknown, indent: number, depth: number): string {
    const scalar = _jsonScalar(value);
    if (scalar !== null) return scalar;
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => pad + _dumpIndent(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';
        const items = keys.map(
            (k) => `${pad}${_jsonStrNoAscii(k)}: ${_dumpIndent(obj[k], indent, depth + 1)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrNoAscii(String(value));
}

/** `json.dumps(data, indent=N)` (sort_keys=False; ensure_ascii — see Parity notes). */
function jsonDumpsIndent(value: unknown, indent: number): string {
    return _dumpIndent(value, indent, 0);
}

/**
 * Rewrite every version field in an `.augment-plugin/` manifest.
 *
 * Enumerated, not walked: `plugin.json` carries one top-level `version`, and
 * `marketplace.json` carries three (top level, `metadata.version`, and one per
 * `plugins[]` entry). A recursive "every key named version" rewrite would
 * silently start bumping a future field that is legitimately independent, which
 * is the failure this whole change exists to stop — an unowned version is drift
 * whichever direction it drifts.
 */
function set_augment_manifest_version(p: string, version: string): void {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
    if ('version' in data) {
        data['version'] = version;
    }
    const meta = data['metadata'];
    if (typeof meta === 'object' && meta !== null && !Array.isArray(meta) && 'version' in meta) {
        (meta as Record<string, unknown>)['version'] = version;
    }
    const plugins = data['plugins'];
    if (Array.isArray(plugins)) {
        for (const entry of plugins) {
            if (typeof entry === 'object' && entry !== null && !Array.isArray(entry) && 'version' in entry) {
                (entry as Record<string, unknown>)['version'] = version;
            }
        }
    }
    fs.writeFileSync(p, jsonDumpsIndent(data, 2) + '\n', 'utf-8');
}

/** Update `metadata.version`; preserve 2-space indentation + UTF-8. */
function set_marketplace_version(p: string, version: string): void {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
    // data.setdefault("metadata", {})["version"] = version — preserve key order.
    if (!(typeof data['metadata'] === 'object' && data['metadata'] !== null && !Array.isArray(data['metadata']))) {
        data['metadata'] = {};
    }
    (data['metadata'] as Record<string, unknown>)['version'] = version;
    fs.writeFileSync(p, jsonDumpsIndent(data, 2) + '\n', 'utf-8');
}

export {
    ArgparseExit,
    commaGroup,
    jsonDumpsIndent,
    set_augment_manifest_version,
    set_marketplace_version,
    pyLen,
    pySlice,
    reEscape,
    _cap_body,
    CHANGELOG,
    CalledProcessError,
    _set_changelog_reader,
    read_changelog_text,
    GH_PR_BODY_LIMIT,
    GH_RELEASE_NOTES_LIMIT,
    MAIN_BRANCH,
    AUGMENT_MARKETPLACE_JSON,
    AUGMENT_PLUGIN_JSON,
    MARKETPLACE_JSON,
    PACKAGE_JSON,
    PACKAGE_LOCK_JSON,
    PROJECT_TEMPLATE,
    REMOTE,
    REPO_ROOT,
    REPO_SLUG,
    SystemExitError,
};
