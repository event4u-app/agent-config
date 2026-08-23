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
 * Contains no logic and reaches nothing — paths, two branch names, two GitHub
 * body limits, three error classes. That is what makes it a safe leaf.
 */
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

export {
    ArgparseExit,
    commaGroup,
    jsonDumpsIndent,
    pyLen,
    pySlice,
    reEscape,
    _cap_body,
    CHANGELOG,
    CalledProcessError,
    GH_PR_BODY_LIMIT,
    GH_RELEASE_NOTES_LIMIT,
    MAIN_BRANCH,
    MARKETPLACE_JSON,
    PACKAGE_JSON,
    PACKAGE_LOCK_JSON,
    PROJECT_TEMPLATE,
    REMOTE,
    REPO_ROOT,
    REPO_SLUG,
    SystemExitError,
};
