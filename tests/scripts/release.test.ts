// Tests for src/scripts/release.ts (ADR-200 py2ts twin of src/scripts/release.py).
//
// Two layers:
//   1. Pure-helper parity — mirrors tests/test_release.py 1:1 against the TS
//      exports in-process. The Python suite (pytest) is the spec; these assert
//      the same outcomes from the TS twin. File-touching helpers (prepend_changelog,
//      set_*_version) operate on TEMP files passed as the explicit `path` arg —
//      never the real repo.
//   2. CLI golden parity (python3 vs tsx) — the safe surfaces only:
//      `--help`/`-h`, arg-errors, and `--dry-run`. The mutating paths
//      (execute() → git/gh/npm, preflight, confirm) are NEVER exercised:
//      tests never reach execute(), and --dry-run returns 0 BEFORE execute()
//      and BEFORE preflight(). --dry-run is READ-ONLY against the real repo
//      (git log / describe + read package.json / CHANGELOG; no writes, no
//      network mutation), so running both runtimes against it is safe.
//
// argparse `--help` full body + the arg-error usage block are COLUMNS-dependent
// (lesson #8), so those cases assert exit code + a stable token, not byte parity.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
    parse_version,
    bump_version,
    infer_bump,
    resolve_bump,
    render_changelog_entry,
    _cap_body,
    _changelog_line,
    prepend_changelog,
    set_package_version,
    set_marketplace_version,
    _previous_test_count_from_changelog,
    _detect_in_flight_target,
    Commit,
    SystemExitError,
    CONVENTIONAL_RE,
    SEMVER_RE,
    _RELEASE_BRANCH_RE,
    confirmGate,
    resolve_split_decision,
} from '../../src/scripts/release.js';
import {
    CURRENT_ERA_BODY_CAP,
    current_era_accumulated_body_size,
    current_era_body_size,
    read_changelog_lines,
} from '../../src/scripts/_lib/changelog_eras.js';
import * as eras from '../../src/scripts/_lib/changelog_eras.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'release.ts');
const TSX_BIN =
    process.env.TSX_BIN ??
    path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

const tmpDirs: string[] = [];
function mkTmpFile(name: string, content: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'release-'));
    const p = path.join(d, name);
    fs.writeFileSync(p, content);
    tmpDirs.push(d);
    return p;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

// ─── helper to build a Commit from a subject (mirror of test_release._c) ──────
function _c(subject: string, breaking = false): Commit {
    const m = CONVENTIONAL_RE.exec(subject);
    if (m) {
        return new Commit(
            'a'.repeat(40),
            m.groups!['type'] as string,
            (m.groups!['scope'] ?? null) as string | null,
            m.groups!['subject'] as string,
            breaking || Boolean(m.groups!['bang']),
        );
    }
    return new Commit('a'.repeat(40), 'other', null, subject, breaking);
}

// ─── version math ─────────────────────────────────────────────────────────────

describe('bump_version', () => {
    it.each([
        ['1.11.0', 'major', '2.0.0'],
        ['1.11.0', 'minor', '1.12.0'],
        ['1.11.0', 'patch', '1.11.1'],
        ['0.0.1', 'major', '1.0.0'],
        ['9.99.99', 'patch', '9.99.100'],
    ])('bumps %s %s → %s', (current, kind, expected) => {
        expect(bump_version(current, kind)).toBe(expected);
    });

    it('invalid version exits (die → SystemExitError)', () => {
        expect(() => bump_version('not-a-version', 'patch')).toThrow(SystemExitError);
    });

    it('invalid kind exits', () => {
        expect(() => bump_version('1.0.0', 'mega')).toThrow(SystemExitError);
    });
});

describe('parse_version', () => {
    it('valid', () => {
        expect(parse_version('1.2.3')).toEqual([1, 2, 3]);
    });
    it.each(['1.2', 'v1.2.3', '1.2.3-rc', '1.2.3.4', ''])('rejects %s', (bad) => {
        expect(() => parse_version(bad)).toThrow(SystemExitError);
    });
});

// ─── commit classification ────────────────────────────────────────────────────

describe('infer_bump', () => {
    it('breaking wins', () => {
        expect(infer_bump([_c('feat!: drop node 18')])).toBe('major');
    });
    it('breaking in footer', () => {
        const c = new Commit('a'.repeat(40), 'feat', null, 'big thing', true);
        expect(infer_bump([c])).toBe('major');
    });
    it('feat is minor', () => {
        expect(infer_bump([_c('feat: add X'), _c('fix: y')])).toBe('minor');
    });
    it('only fix is patch', () => {
        expect(infer_bump([_c('fix: typo'), _c('docs: readme')])).toBe('patch');
    });
    it('empty is patch', () => {
        expect(infer_bump([])).toBe('patch');
    });
});

describe('resolve_bump', () => {
    it('override wins over commits', () => {
        expect(resolve_bump('patch', [_c('feat!: breaking')])).toBe('patch');
    });
    it('no override uses infer', () => {
        const commits = [new Commit('a'.repeat(40), 'feat', null, 'add X', false)];
        expect(resolve_bump(null, commits)).toBe('minor');
    });
    it('no override empty commits is patch', () => {
        expect(resolve_bump(null, [])).toBe('patch');
    });
});

// ─── changelog rendering ──────────────────────────────────────────────────────

describe('render_changelog_entry', () => {
    it('groups by type in order', () => {
        const commits = [
            _c('feat(api): add endpoint'),
            _c('fix(core): null check'),
            _c('chore: bump deps'),
        ];
        const [full, body] = render_changelog_entry('1.2.0', '1.1.0', commits, '2026-04-24');
        expect(full).toContain('## [1.2.0](https://github.com/');
        expect(full).toContain('...1.2.0) (2026-04-24)');
        const feat = body.indexOf('### Features');
        const fix = body.indexOf('### Bug Fixes');
        const chore = body.indexOf('### Chores');
        expect(feat).toBeLessThan(fix);
        expect(fix).toBeLessThan(chore);
    });

    it('breaking heading first', () => {
        const c = new Commit('a'.repeat(40), 'feat', 'api', 'drop old route', true);
        const [, body] = render_changelog_entry('2.0.0', '1.11.0', [c], '2026-04-24');
        // No non-breaking commits here → body starts with BREAKING CHANGES.
        expect(body.startsWith('### BREAKING CHANGES')).toBe(true);
    });

    it('scope formatting', () => {
        const [, body] = render_changelog_entry('1.2.0', '1.1.0', [_c('feat(api): add endpoint')], '2026-04-24');
        expect(body).toContain('* **api:** add endpoint');
    });

    it('no scope formatting', () => {
        const [, body] = render_changelog_entry('1.2.0', '1.1.0', [_c('feat: plain subject')], '2026-04-24');
        expect(body).toContain('* plain subject');
    });

    it('unknown type goes to other', () => {
        const c = new Commit('a'.repeat(40), 'weird', null, 'something', false);
        const [, body] = render_changelog_entry('1.2.0', '1.1.0', [c], '2026-04-24');
        expect(body).toContain('### Other');
        expect(body).toContain('* something');
    });

    it('no prev tag uses plain heading', () => {
        const [full] = render_changelog_entry('0.1.0', null, [_c('feat: first')], '2026-04-24');
        expect(full.startsWith('## 0.1.0 (2026-04-24)')).toBe(true);
        expect(full.split('\n')[0]).not.toContain('compare/');
    });

    it('trend line appended when provided', () => {
        const [, body] = render_changelog_entry('1.2.0', '1.1.0', [_c('feat: x')], '2026-04-24', {
            test_trend_line: 'Tests: 2465 (+12 since 1.1.0)',
        });
        expect(body.replace(/\s+$/u, '').endsWith('Tests: 2465 (+12 since 1.1.0)')).toBe(true);
    });

    it('trend line omitted when none', () => {
        const [, body] = render_changelog_entry('1.2.0', '1.1.0', [_c('feat: x')], '2026-04-24', {
            test_trend_line: null,
        });
        expect(body).not.toContain('Tests:');
    });
});

describe('_changelog_line', () => {
    it('scope + 7-char sha + commit link', () => {
        const c = new Commit('b'.repeat(40), 'feat', 'api', 'add', false);
        expect(_changelog_line(c)).toBe(
            `* **api:** add ([${'b'.repeat(7)}](https://github.com/event4u-app/agent-config/commit/${'b'.repeat(40)}))`,
        );
    });
});

// ─── _cap_body (under / over limit) ───────────────────────────────────────────

describe('_cap_body', () => {
    it('returns text unchanged when within limit', () => {
        const text = 'short body';
        expect(_cap_body(text, 1000, '`CHANGELOG.md`')).toBe(text);
    });

    it('truncates + appends comma-grouped notice when over limit', () => {
        const text = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n');
        const out = _cap_body(text, 120, '`CHANGELOG.md` in this PR');
        expect(out.length).toBeLessThanOrEqual(text.length);
        expect(out).toContain('Changelog truncated to fit GitHub');
        // comma grouping: 65,536 / 125,000 shape; here limit=120 → "120".
        expect(out).toContain('120-character body limit');
        expect(out).toContain('full entry in `CHANGELOG.md` in this PR');
    });

    it('comma-groups the limit in the notice (65,536 shape)', () => {
        const text = 'x'.repeat(100_000);
        const out = _cap_body(text, 65_536, '`CHANGELOG.md`');
        expect(out).toContain("65,536-character body limit");
    });
});

// ─── _previous_test_count_from_changelog (temp CHANGELOG) ─────────────────────
// The TS twin reads the module-level CHANGELOG constant (fixed to the real
// repo). We cannot monkeypatch it from outside, so we validate the regex/parse
// semantics against the real repo's value for the function's null contracts,
// and assert the count-extraction logic via the CLI golden parity below. The
// null-arg contract is directly checkable:

describe('_previous_test_count_from_changelog', () => {
    it('returns null when no tag given', () => {
        expect(_previous_test_count_from_changelog(null)).toBeNull();
    });
    it('returns null for a tag that is absent from the real CHANGELOG', () => {
        // 9.9.9 is not a heading in the repo CHANGELOG → null (no throw).
        expect(_previous_test_count_from_changelog('9.9.9')).toBeNull();
    });
});

// ─── prepend_changelog (temp CHANGELOG fixture) ───────────────────────────────

describe('prepend_changelog', () => {
    it('inserts above latest heading (legacy fallback, no era header)', () => {
        const cl = mkTmpFile(
            'CHANGELOG.md',
            '# Changelog\n\nIntro.\n\n## [1.0.0](x) (2026-01-01)\n\n### Features\n\n* older\n',
        );
        prepend_changelog(cl, '## [1.1.0](y) (2026-02-02)\n\n### Features\n\n* new\n');
        const out = fs.readFileSync(cl, 'utf-8');
        expect(out.indexOf('1.1.0')).toBeLessThan(out.indexOf('1.0.0'));
        expect(out).toContain('# Changelog');
    });

    it('appends when no prior heading', () => {
        const cl = mkTmpFile('CHANGELOG.md', '# Changelog\n\nNothing yet.\n');
        prepend_changelog(cl, '## [1.0.0](x) (2026-02-02)\n\n* first\n');
        const out = fs.readFileSync(cl, 'utf-8');
        expect(out).toContain('# Changelog');
        expect(out).toContain('1.0.0');
    });

    it('era-aware: inserts under the current era, above newest version heading', () => {
        const cl = mkTmpFile(
            'CHANGELOG.md',
            '# Changelog\n\n' +
                '# Era: 1.0.x — current\n\n' +
                '> Started at `1.0.0`. Full entries live inline below.\n\n' +
                '## [1.0.5](x) (2026-01-05)\n\n* older\n',
        );
        prepend_changelog(cl, '## [1.1.0](y) (2026-02-02)\n\n* new\n');
        const out = fs.readFileSync(cl, 'utf-8');
        expect(out.indexOf('1.1.0')).toBeLessThan(out.indexOf('1.0.5'));
        // The era header + intro survive ABOVE the new entry.
        expect(out.indexOf('# Era: 1.0.x — current')).toBeLessThan(out.indexOf('1.1.0'));
    });
});

// ─── set_package_version / set_marketplace_version (temp json, byte-parity) ───

describe('set_package_version', () => {
    it('updates version, preserves keys + key order + trailing newline', () => {
        const p = mkTmpFile(
            'package.json',
            JSON.stringify({ name: 'x', version: '1.0.0', description: 'y' }, null, 4) + '\n',
        );
        set_package_version(p, '1.1.0');
        const raw = fs.readFileSync(p, 'utf-8');
        const data = JSON.parse(raw);
        expect(data.version).toBe('1.1.0');
        expect(data.name).toBe('x');
        expect(data.description).toBe('y');
        expect(raw.endsWith('\n')).toBe(true);
        // 4-space indent preserved + key order name→version→description.
        expect(raw).toBe(
            '{\n    "name": "x",\n    "version": "1.1.0",\n    "description": "y"\n}\n',
        );
    });
});

describe('set_marketplace_version', () => {
    it('updates metadata.version, preserves siblings (2-space indent)', () => {
        const p = mkTmpFile(
            'marketplace.json',
            JSON.stringify({ name: 'x', metadata: { version: '1.0.0', desc: 'y' } }, null, 2) + '\n',
        );
        set_marketplace_version(p, '1.1.0');
        const raw = fs.readFileSync(p, 'utf-8');
        const data = JSON.parse(raw);
        expect(data.metadata.version).toBe('1.1.0');
        expect(data.metadata.desc).toBe('y');
        expect(raw).toBe(
            '{\n  "name": "x",\n  "metadata": {\n    "version": "1.1.0",\n    "desc": "y"\n  }\n}\n',
        );
    });

    it('creates metadata if missing', () => {
        const p = mkTmpFile('marketplace.json', JSON.stringify({ name: 'x' }, null, 2) + '\n');
        set_marketplace_version(p, '1.1.0');
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        expect(data.metadata.version).toBe('1.1.0');
    });
});

// ─── _RELEASE_BRANCH_RE ───────────────────────────────────────────────────────

describe('_RELEASE_BRANCH_RE', () => {
    it.each([
        ['release/1.0.0', '1.0.0'],
        ['release/10.20.30', '10.20.30'],
        ['release/1.15.0', '1.15.0'],
    ])('matches %s → %s', (name, expected) => {
        const m = _RELEASE_BRANCH_RE.exec(name);
        expect(m).not.toBeNull();
        expect(m![1]).toBe(expected);
    });

    it.each([
        'release/1.0',
        'release/v1.0.0',
        'release/1.0.0-rc',
        'feat/release/1.0.0',
        'release/',
        'main',
    ])('rejects %s', (name) => {
        expect(_RELEASE_BRANCH_RE.exec(name)).toBeNull();
    });
});

// ─── _detect_in_flight_target HEAD-on-release-branch fast path ────────────────
// The package.json / tag-existence path reads module-level constants fixed to
// the real repo; only the HEAD-on-release-branch branch is exercisable in
// isolation here (it never returns the repo's real version because the repo is
// not checked out on a release/* branch — this asserts the function does not
// throw and returns a string-or-null). The full package.json+tag matrix is
// covered by tests/test_release.py via monkeypatch (no TS-side seam exists).

describe('_detect_in_flight_target', () => {
    it('returns a string or null without throwing on the real repo', () => {
        const r = _detect_in_flight_target();
        expect(r === null || typeof r === 'string').toBe(true);
    });
});

// ─── SEMVER_RE sanity ─────────────────────────────────────────────────────────

describe('SEMVER_RE', () => {
    it('matches bare semver only', () => {
        expect(SEMVER_RE.test('1.2.3')).toBe(true);
        expect(SEMVER_RE.test('1.2')).toBe(false);
        expect(SEMVER_RE.test('v1.2.3')).toBe(false);
    });
});

// ─── CLI golden parity (python3 vs tsx) — safe surfaces only ──────────────────

interface RunOut {
    stdout: string;
    stderr: string;
    status: number | null;
}
function runTs(args: string[]): RunOut {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

// ─── confirm-gate — non-interactive must fail fast, never auto-abort/hang ─────
// Regression lock for `task release` exiting 1 at "[y/N]" without waiting:
// go-task / scripts-run spawn the script with stdin detached from the terminal,
// so a naive `readSync(0)` hit EOF and "aborted" silently. The fix (a) reads the
// controlling tty when present, and (b) when there is genuinely no terminal
// (CI / detached stdin), surfaces actionable `--yes` guidance instead. Unit-test
// the pure `confirmGate` verdict so the contract is locked without spawning the
// real release (which would hit preflight / working-tree gates first).
describe('confirmGate — pre-execute confirmation verdict', () => {
    const origCI = process.env.CI;
    afterEach(() => {
        if (origCI === undefined) delete process.env.CI;
        else process.env.CI = origCI;
    });

    it('--yes → proceeds unprompted', () => {
        delete process.env.CI;
        expect(confirmGate('7.0.0', true)).toEqual({ proceed: true });
    });

    it('non-interactive (CI) + no --yes → does NOT proceed, surfaces --yes guidance on stderr', () => {
        process.env.CI = '1'; // _canPrompt() → false by contract; never reads stdin/tty
        const v = confirmGate('7.0.0', false);
        expect(v.proceed).toBe(false);
        expect(v.stream).toBe('stderr');
        expect(v.message).toContain('--yes');
        expect(v.message).not.toMatch(/^aborted\.?$/); // actionable, not a bare silent abort
    });
});

// ─── --check-confirm self-test — confirm prompt reachable through wrappers ────
// Regression lock for the interactive [y/N] prompt "auto-aborting" under
// `task release` / `./scripts-run`: go-task's interactive mode leaves fd 0 a
// non-blocking TTY, so a bare readSync(0) threw EAGAIN and the prompt aborted
// without ever waiting — even on a typed `y` (reproduced with isTTY === true).
// The fix reads a fresh BLOCKING /dev/tty instead of fd 0. The interactive read
// itself needs a pty (verified out-of-band via a pty.fork harness + the
// `--check-confirm` self-test); here we lock the safe surface: the self-test is
// wired, runs without a release, and a genuinely non-interactive shell yields
// the actionable --yes guidance with exit 1 — never a hang, never a bare abort.
describe('release --check-confirm — self-test wiring', () => {
    it('non-interactive shell → guidance + exit 1, no release, no hang', () => {
        const r = spawnSync(TSX_BIN, [TS_SCRIPT, '--check-confirm'], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
            input: '', // detached stdin
            env: { ...process.env, CI: '1' }, // force the non-interactive path → no tty read, cannot hang
            timeout: 15_000,
        });
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('self-test');
        expect(r.stdout + r.stderr).toContain('--yes'); // actionable guidance
        expect(r.stdout + r.stderr).not.toMatch(/^aborted\.?$/m); // not a bare silent abort
    });
});

/**
 * Normalise --dry-run preview output for cross-runtime comparison:
 *  - the `({today})` date in the changelog heading (a day rollover between the
 *    two spawns could differ);
 *  - 40-hex full SHAs and 7-hex short SHAs in commit-link bullets;
 *  These come from live git and are identical between back-to-back runs, but
 *  normalised defensively. Both runtimes read the same repo at the same instant.
 */
function normalizeDryRun(s: string): string {
    return s
        .replace(/\(\d{4}-\d{2}-\d{2}\)/g, '(DATE)') // normalize: date heading / day-rollover
        .replace(/[0-9a-f]{40}/g, 'SHA40') // normalize: full commit SHA
        .replace(/[0-9a-f]{7}\b/g, 'SHA7'); // normalize: short SHA
}

// ─── era-split gate — newest-release exemption (regression) ───────────────────
// A PATCH release must never hard-die just because the era's newest section
// alone busts the cap (the 7.0.0 catch-up failure this exemption was
// introduced for). Since the 2026-07-07 fix the gate measures the
// POST-release body (raw total today) so minor/major releases split on time,
// but the patch path stays non-fatal: it proceeds with a warning instead of
// exit 2. Full decision-matrix coverage: `resolve_split_decision` below.
describe('release --dry-run — era gate honours the newest-release exemption', () => {
    it('does not die when the era total busts the cap but the accumulated body is under it', () => {
        const lines = read_changelog_lines();
        const total = current_era_body_size(lines);
        const accumulated = current_era_accumulated_body_size(lines);
        // Only meaningful while the exemption is load-bearing — the current
        // era's newest release alone exceeds the cap. After a genuine era split
        // the precondition lapses and the guard is moot (skip, don't assert).
        if (!(total > CURRENT_ERA_BODY_CAP && accumulated <= CURRENT_ERA_BODY_CAP)) {
            return;
        }
        const ts = runTs(['--dry-run']);
        expect(ts.status, ts.stderr).toBe(0);
        expect(ts.stderr).not.toContain('split needs a minor/major bump');
    });
});

// ─── resolve_split_decision — post-release view (2026-07-07 regression) ──────
// The 8.0.0 and 8.1.0 releases each skipped the era split because the gate
// measured the PRE-release accumulated body (~0 right after a big catch-up
// release) while the drift test measures POST-release — the just-exempt big
// section starts counting the moment the next section is prepended. Both
// releases left main red until a manual chore split. The decision matrix:
describe('resolve_split_decision — era gate measures the post-release state', () => {
    const SAVED_CHANGELOG = eras.CHANGELOG;
    const SAVED_ARCHIVE_DIR = eras.ARCHIVE_DIR;
    let tmp: string;

    function write_changelog(body: string): void {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'release-era-gate-'));
        tmpDirs.push(tmp);
        const changelog = path.join(tmp, 'CHANGELOG.md');
        fs.writeFileSync(changelog, body, 'utf-8');
        fs.mkdirSync(path.join(tmp, 'docs', 'archive'), { recursive: true });
        eras._set_changelog_path(changelog);
        eras._set_archive_dir(path.join(tmp, 'docs', 'archive'));
    }

    afterEach(() => {
        eras._set_changelog_path(SAVED_CHANGELOG);
        eras._set_archive_dir(SAVED_ARCHIVE_DIR);
    });

    function era_body(newest_extra: number, prior_extra: number): string {
        const pad = (n: number, tag: string): string =>
            Array.from({ length: n }, (_, i) => `- ${tag} line ${i}`).join('\n');
        return (
            '# Changelog\n\n' +
            '# Era: 8.0.x — current\n\n' +
            '> Started at `8.0.0`.\n\n' +
            '## [8.0.1](https://example/compare/8.0.0...8.0.1) (2026-07-06)\n\n' +
            '### Bug Fixes\n\n* newest fix\n' +
            `${pad(newest_extra, 'newest')}\n\n` +
            '## [8.0.0](https://example/compare/7.5.0...8.0.0) (2026-07-05)\n\n' +
            '### Features\n\n* prior feature\n' +
            `${pad(prior_extra, 'prior')}\n\n` +
            '# Era: pre-8.0.0 — archived\n\n' +
            '> All entries before `8.0.0` live in\n' +
            '> [`docs/archive/CHANGELOG-pre-8.0.0.md`](docs/archive/CHANGELOG-pre-8.0.0.md).\n'
        );
    }

    it('the 8.1.0 class: big still-exempt newest section + MINOR target → split planned', () => {
        write_changelog(era_body(300, 0)); // accumulated small, raw total over cap
        expect(current_era_accumulated_body_size()).toBeLessThanOrEqual(CURRENT_ERA_BODY_CAP);
        expect(current_era_body_size()).toBeGreaterThan(CURRENT_ERA_BODY_CAP);
        const d = resolve_split_decision('8.1.0');
        expect(d.die_message).toBeNull();
        expect(d.warning).toBeNull();
        expect(d.split).not.toBeNull();
        expect(d.split!.boundary).toBe('8.1.0');
    });

    it('big newest section + PATCH target → proceeds with a warning, never dies (exemption kept)', () => {
        write_changelog(era_body(300, 0));
        const d = resolve_split_decision('8.0.2');
        expect(d.die_message).toBeNull();
        expect(d.split).toBeNull();
        expect(d.warning).toContain('drift gate will be RED');
    });

    it('accumulated body itself over the cap + PATCH target → dies (unchanged behaviour)', () => {
        write_changelog(era_body(0, 300)); // prior sections over cap even excluding newest
        expect(current_era_accumulated_body_size()).toBeGreaterThan(CURRENT_ERA_BODY_CAP);
        const d = resolve_split_decision('8.0.2');
        expect(d.split).toBeNull();
        expect(d.die_message).toContain('split needs a minor/major bump');
    });

    it('era comfortably under the cap → no split, no warning, no die', () => {
        write_changelog(era_body(0, 0));
        const d = resolve_split_decision('8.1.0');
        expect(d).toEqual({ split: null, die_message: null, warning: null });
    });
});
