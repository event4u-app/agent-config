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
    RELEASE_HEAD_CAP_LINES,
    dedupe_commit_lines,
    release_head_line_count,
    render_release_head,
    parse_version,
    bump_version,
    infer_bump,
    resolve_bump,
    nothing_to_release_ci,
    render_changelog_entry,
    _cap_body,
    _changelog_line,
    prepend_changelog,
    set_package_version,
    set_lockfile_version,
    set_marketplace_version,
    _previous_test_count_from_changelog,
    _count_from_list_result,
    _TEST_LIST_MAX_BUFFER,
    _detect_in_flight_target,
    _failed_check_names,
    _failed_checks_report,
    Commit,
    SystemExitError,
    assert_scheduled_deprecations_clear,
    CONVENTIONAL_RE,
    SEMVER_RE,
    _RELEASE_BRANCH_RE,
    confirmGate,
    preflightPosition,
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

// ─── nothing_to_release_ci — the label-flow double-fire guard ─────────────────
describe('nothing_to_release_ci', () => {
    const someCommits = [new Commit('a'.repeat(40), 'feat', null, 'add X', false)];

    it('true only under --ci with no override and no commits', () => {
        expect(nothing_to_release_ci(true, null, null, [])).toBe(true);
    });
    it('false when not --ci — the interactive path is never short-circuited', () => {
        expect(nothing_to_release_ci(false, null, null, [])).toBe(false);
    });
    it('false when --ci but commits exist', () => {
        expect(nothing_to_release_ci(true, null, null, someCommits)).toBe(false);
    });
    it('false when --ci with an explicit --version override', () => {
        expect(nothing_to_release_ci(true, '9.9.9', null, [])).toBe(false);
    });
    it('false when --ci with a --as bump override', () => {
        expect(nothing_to_release_ci(true, null, 'patch', [])).toBe(false);
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

    it('breaking heading first among the generated sections', () => {
        const c = new Commit('a'.repeat(40), 'feat', 'api', 'drop old route', true);
        const [, body] = render_changelog_entry('2.0.0', '1.11.0', [c], '2026-04-24');
        // The curated head now sits above the generated log
        // (road-to-release-shape-honesty Phase 2), so the invariant is that
        // BREAKING CHANGES is the first `###` *after* the head — not the first
        // line of the body.
        expect(body.startsWith('### Release highlights')).toBe(true);
        const generated = body.slice(body.indexOf('### BREAKING CHANGES'));
        expect(generated.startsWith('### BREAKING CHANGES')).toBe(true);
        const headings = [...body.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
        expect(headings).toEqual(['Release highlights', 'BREAKING CHANGES']);
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

// Regression cover for the 9.10.0 release failure: `_count_tests_current`
// buffers `npx vitest list` through spawnSync, whose default maxBuffer is
// 1 MiB. The listing crossed that (~1.25 MB at 9470 cases), the spawn failed
// with ENOBUFS, the probe degraded to null, and the release notes shipped
// without the `Tests:` footer — which the `changelog-entry` CI gate treats as
// fatal. These pin the ceiling AND the now-loud degradation.
describe('test-count probe buffering', () => {
    it('counts a listing larger than the 1 MiB spawnSync default', () => {
        // 40k lines × ~33 B ≈ 1.3 MB — comparable to the real listing (1.25 MB
        // at 9470 cases, whose paths are longer) and past the 1 MiB default.
        // With the pre-fix options this spawn fails ENOBUFS and the assertions
        // below see an error plus a null count. The byte assertion is kept so
        // the case cannot silently stop exercising the overflow.
        const lines = 40_000;
        const res = spawnSync(
            process.execPath,
            [
                '-e',
                `const o=[];for(let i=0;i<${lines};i++)o.push("tests/lib/x.test.ts > case "+i);` +
                    'process.stdout.write(o.join("\\n")+"\\n");',
            ],
            {
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'pipe'],
                maxBuffer: _TEST_LIST_MAX_BUFFER,
            },
        );
        expect(res.error).toBeUndefined();
        expect((res.stdout ?? '').length).toBeGreaterThan(1024 * 1024);
        expect(_count_from_list_result(res)).toBe(lines);
    });

    it('ceiling clears the 1 MiB default that broke 9.10.0', () => {
        expect(_TEST_LIST_MAX_BUFFER).toBeGreaterThan(1024 * 1024);
    });

    it('ENOBUFS degrades to null AND warns', () => {
        const warnings: string[] = [];
        const err = Object.assign(new Error('spawnSync ENOBUFS'), { code: 'ENOBUFS' });
        const got = _count_from_list_result({ error: err, status: null, stdout: null }, (m) =>
            warnings.push(m),
        );
        expect(got).toBeNull();
        expect(warnings.join('')).toContain('ENOBUFS');
    });

    it('non-zero exit degrades to null AND warns', () => {
        const warnings: string[] = [];
        expect(
            _count_from_list_result({ status: 1, stdout: 'partial\n' }, (m) => warnings.push(m)),
        ).toBeNull();
        expect(warnings.join('')).toContain('Tests:');
    });

    it('empty listing degrades to null AND warns', () => {
        const warnings: string[] = [];
        expect(
            _count_from_list_result({ status: 0, stdout: '  \n\n' }, (m) => warnings.push(m)),
        ).toBeNull();
        expect(warnings.join('')).toContain('0 cases');
    });

    it('blank lines are not counted as cases', () => {
        expect(_count_from_list_result({ status: 0, stdout: 'a\n\n  \nb\n' })).toBe(2);
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

describe('set_lockfile_version', () => {
    // The bump used to touch package.json and leave the lock behind, so every
    // release shipped a `main` whose two files disagreed and every local
    // `npm install` produced a spurious modification (package.json 9.13.0 vs
    // package-lock.json 9.12.0, measured 2026-08-02).
    // road-to-gates-that-can-fail Phase 5.
    it('updates BOTH version fields npm keeps and touches nothing else', () => {
        const lock = {
            name: '@x/y',
            version: '1.0.0',
            lockfileVersion: 3,
            requires: true,
            packages: {
                '': { name: '@x/y', version: '1.0.0', license: 'MIT' },
                'node_modules/dep': { version: '2.3.4' },
            },
        };
        const p = mkTmpFile('package-lock.json', JSON.stringify(lock, null, 4) + '\n');
        set_lockfile_version(p, '1.1.0');
        const raw = fs.readFileSync(p, 'utf-8');
        const data = JSON.parse(raw) as typeof lock;
        expect(data.version).toBe('1.1.0');
        expect(data.packages[''].version).toBe('1.1.0');
        // A dependency pin is NOT the project version — re-resolving one here
        // would change dependencies mid-release.
        expect(data.packages['node_modules/dep'].version).toBe('2.3.4');
        expect(data.lockfileVersion).toBe(3);
        expect(raw.endsWith('\n')).toBe(true);
    });

    it('is a no-op when there is no lockfile', () => {
        const sibling = mkTmpFile('placeholder', '');
        const missing = path.join(path.dirname(sibling), 'package-lock.json');
        expect(() => set_lockfile_version(missing, '1.1.0')).not.toThrow();
        expect(fs.existsSync(missing)).toBe(false);
    });

    it('the committed package.json and package-lock.json agree', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8')) as {
            version: string;
        };
        const lock = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'package-lock.json'), 'utf-8'),
        ) as { version: string; packages: Record<string, { version?: string }> };
        expect(lock.version, 'package-lock.json top-level version').toBe(pkg.version);
        expect(lock.packages['']?.version, 'package-lock.json packages[""] version').toBe(
            pkg.version,
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

// ─── _detect_in_flight_target ─────────────────────────────────────────────────
// The full HEAD x package.json x remote-tag matrix, through the InFlightProbes
// seam. This block is also where the rationale for that probe lives: release.ts
// sits over the 1500-line source-size ratchet, so the long form was condensed
// there to a pointer at this comment rather than by raising a baseline, which
// that gate calls a defect rather than a fix.
//
// WHAT THE PROBE ANSWERS. "Is this release already published?" — and the only
// evidence that anything shipped is the tag ON THE REMOTE, because
// publish-npm.yml triggers on `push: tags:`. A tag sitting in one checkout
// published nothing.
//
// THE DEFECT, measured 2026-08-20 on 14.6.0. The completion check read
// `_tag_exists_local(v) || _tag_exists_remote(v)`. Step 8 of release.ts had
// created the annotated tag and then failed to push it, so main carried
// package.json 14.6.0 with no remote tag, no GitHub Release, and npm still
// serving 14.5.0 — a textbook in-flight release. The local arm answered true,
// the probe returned null, and `--resume` fell through to bump_version() and
// offered to open 14.7.0 while 14.6.0 had shipped nowhere. The probe reported
// COMPLETE exactly the state step 8 exists to finish, and handles by name
// ("tag exists locally — push only"), so the one documented recovery path
// could not reach it. The release hung ~30 h.
//
// WHY IT SURVIVED. This block used to assert only "returns a string or null
// without throwing", and pointed at tests/test_release.py for the real matrix —
// a file removed with the Python twin. The matrix was covered by nothing.
//
// SCOPE. Deliberately narrower than the whole publish chain: a tag that IS on
// the remote while the GitHub Release or the npm publish is missing still reads
// as complete here. Steps 8 and 9 each re-probe and skip their own work, so a
// hand-aimed `--version X.Y.Z --resume` still repairs that state — detection
// just will not point there on its own. Widening the probe to `gh release view`
// would put a network+auth call in the detection path, where an unauthenticated
// shell would misreport every finished release as in-flight.

describe('_detect_in_flight_target', () => {
    it('returns a string or null without throwing on the real repo', () => {
        const r = _detect_in_flight_target();
        expect(r === null || typeof r === 'string').toBe(true);
    });

    it('a HEAD on release/X.Y.Z wins over every other observation', () => {
        const r = _detect_in_flight_target({
            head_branch: () => 'release/9.9.9',
            package_version: () => '1.0.0',
            tag_published: () => true,
        });
        expect(r).toBe('9.9.9');
    });

    it('an unpublished package.json version IS the in-flight target', () => {
        const r = _detect_in_flight_target({
            head_branch: () => 'main',
            package_version: () => '14.6.0',
            tag_published: () => false,
        });
        expect(r).toBe('14.6.0');
    });

    it('a published (remote) tag means the release completed', () => {
        const r = _detect_in_flight_target({
            head_branch: () => 'main',
            package_version: () => '14.6.0',
            tag_published: () => true,
        });
        expect(r).toBeNull();
    });

    // The regression. `tag_published` is the REMOTE probe, so a tag that exists
    // only locally cannot answer it — the release is still in flight and resume
    // must aim at it, not at the next version.
    it('a local-only tag does not count as published (14.6.0 regression)', () => {
        const asked: string[] = [];
        const r = _detect_in_flight_target({
            head_branch: () => 'main',
            package_version: () => '14.6.0',
            tag_published: (tag) => {
                asked.push(tag);
                return false; // present locally, absent on the remote
            },
        });
        expect(r).toBe('14.6.0');
        expect(asked).toEqual(['14.6.0']);
    });

    it('an unreadable package.json yields null rather than throwing', () => {
        const r = _detect_in_flight_target({
            head_branch: () => 'main',
            package_version: () => null,
            tag_published: () => false,
        });
        expect(r).toBeNull();
    });

    it('a non-semver package.json version yields null', () => {
        for (const bad of ['1.2', 'v1.2.3', '', 'nightly']) {
            const r = _detect_in_flight_target({
                head_branch: () => 'main',
                package_version: () => bad,
                tag_published: () => false,
            });
            expect(r).toBeNull();
        }
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

// ─── preflight start position — the curated-head refusal must be recoverable ──
// Regression lock for the deadlock measured on 14.19.0. `guard_release_curation`
// stops BETWEEN step 2 (writes the bump + the changelog section) and step 3
// (commits them), leaving HEAD on the local `release/X.Y.Z` with a dirty tree,
// and its own message says to re-run `task release`. Both spellings of that
// re-run were then refused by the preflight, before step 1:
//
//   task release           → "release must run from 'main'"
//   task release --resume  → "working tree is not clean"
//
// `docs/release-runbook.md` claimed this was closed on 2026-09-03; that fix
// landed in `checkout_release_branch`, which is step 1 — unreachable from the
// position the guard creates. These cases pin the position rule itself, which
// is what the guard's remedy actually depends on.
describe('preflightPosition — where a release may start', () => {
    const base = { mainBranch: 'main', releaseBranch: 'release/9.0.0' };

    it('THE DEADLOCK: release branch + dirty tree proceeds, and names what gets swept', () => {
        const v = preflightPosition({
            ...base,
            branch: 'release/9.0.0',
            porcelain: ' M CHANGELOG.md\n M package.json',
        });
        expect(v.proceed).toBe(true);
        expect(v.message).toBeUndefined();
        // The files are printed, never absorbed silently — that is the whole
        // reason this is a `notice` and not just a dropped check.
        expect(v.notice).toContain('CHANGELOG.md');
        expect(v.notice).toContain('package.json');
    });

    it('the same position with no --resume equivalent: the rule is not resume-gated', () => {
        // `preflightPosition` takes no `resume` argument by construction. If a
        // future edit reintroduces one, this case is what notices.
        expect(preflightPosition({ ...base, branch: 'release/9.0.0', porcelain: '' })).toEqual({
            proceed: true,
        });
    });

    it('a dirty tree on main still refuses — that dirt is the operator\'s, not the pipeline\'s', () => {
        const v = preflightPosition({ ...base, branch: 'main', porcelain: ' M src/foo.ts' });
        expect(v.proceed).toBe(false);
        expect(v.message).toBe('working tree is not clean; commit or stash first');
    });

    it('a clean main proceeds with no notice', () => {
        expect(preflightPosition({ ...base, branch: 'main', porcelain: '' })).toEqual({
            proceed: true,
        });
    });

    it('any other branch refuses, and the message names both legal positions', () => {
        const v = preflightPosition({ ...base, branch: 'feat/whatever', porcelain: '' });
        expect(v.proceed).toBe(false);
        expect(v.message).toContain("'main'");
        expect(v.message).toContain("'release/9.0.0'");
        expect(v.message).toContain("'feat/whatever'");
    });

    it('a release branch for a DIFFERENT target is not a start position', () => {
        const v = preflightPosition({ ...base, branch: 'release/8.9.9', porcelain: '' });
        expect(v.proceed).toBe(false);
        expect(v.message).toContain("currently on 'release/8.9.9'");
    });

    it('whitespace-only porcelain is clean, not dirty', () => {
        expect(preflightPosition({ ...base, branch: 'main', porcelain: '\n  \n' })).toEqual({
            proceed: true,
        });
    });

    // A pure verdict nothing calls is the failure mode this pair of assertions
    // exists for: the seven cases above would stay green while `preflight` kept
    // its own inline refusals. Structural rather than behavioural because the
    // real `preflight` reaches `gh api user`, a network fetch and a tag probe,
    // none of which belong in a unit test.
    it('is WIRED — preflight delegates the position rule instead of re-implementing it', () => {
        const src = fs.readFileSync(TS_SCRIPT, 'utf-8');
        const body = src.slice(src.indexOf('function preflight(target: string'));
        expect(body).toContain('preflightPosition({');
        // The two refusals that produced the deadlock must live in the pure
        // function only — never a second copy inside preflight.
        expect(body).not.toContain("die('working tree is not clean");
        expect(body).not.toContain('release must run from');
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

// ─── --ci flag wiring — release.yml's entry point ─────────────────────────────
// `--ci` never touches git/gh (see the file-header comment for docs); lock
// only that the flag parses and that `--dry-run` short-circuits before the
// CI-specific gh-auth probe or the nothing-to-release check would run.
describe('release --ci — flag parses, --dry-run short-circuits before any CI-specific probe', () => {
    it('--ci --dry-run exits 0 without needing GITHUB_TOKEN-shaped gh auth', () => {
        const r = spawnSync(TSX_BIN, [TS_SCRIPT, '--ci', '--dry-run'], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
            timeout: 15_000,
        });
        expect(r.status, r.stderr).toBe(0);
    });
    it('--ci=value rejected like every other boolean flag', () => {
        const r = spawnSync(TSX_BIN, [TS_SCRIPT, '--ci=true'], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
            timeout: 15_000,
        });
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('--ci');
    });
});

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

// ─── curated head + commit-line dedup (road-to-release-shape-honesty P2) ────

describe('render_release_head', () => {
    it('emits the five sections in the operator-reading order', () => {
        const head = render_release_head();
        const labels = head
            .filter((l) => l.startsWith('- **'))
            .map((l) => /^- \*\*(.+?):\*\*/.exec(l)?.[1]);
        expect(labels).toEqual([
            'Behaviour changes',
            'Default changes + migration',
            'Security and correctness',
            'Honest nulls',
            'Known limitations',
        ]);
    });

    it('defaults to `_none_`, which is an answer rather than a placeholder', () => {
        // A release that genuinely changed no defaults should SAY so. An
        // unfilled marker would be wrong-if-shipped; this is merely terse.
        const head = render_release_head();
        const bullets = head.filter((l) => l.startsWith('- **'));
        expect(bullets.filter((l) => l.endsWith('_none_'))).toHaveLength(5);
        expect(head.join('\n')).not.toMatch(/TBD|TODO|<placeholder>/i);
    });

    it('keeps filled values and only defaults the rest', () => {
        const head = render_release_head({ 'Behaviour changes': 'the port branch now refuses' });
        expect(head.join('\n')).toContain('- **Behaviour changes:** the port branch now refuses');
        expect(head.join('\n')).toContain('- **Known limitations:** _none_');
    });

    it('fits the operator-facing cap and emits NO HTML comment', () => {
        // UPDATED 2026-09-01 (roadmap § Phase 2, Option A). This test used to
        // assert the opposite of its second line — that the writer DOES emit
        // an HTML comment, excluded from the cap. That comment was the
        // generator's authoring instruction, and nothing removed it before
        // publication, so it shipped in the npm artifact. The writer now emits
        // none and the reminder rides in the release-PR body instead; the cap
        // assertion is unchanged and still the point of this test.
        const head = render_release_head();
        expect(release_head_line_count(head)).toBeLessThanOrEqual(RELEASE_HEAD_CAP_LINES);
        expect(head.some((l) => l.trimStart().startsWith('<!--'))).toBe(false);
    });

    it('is emitted on every release, so it cannot be forgotten', () => {
        const [, body] = render_changelog_entry('1.2.0', '1.1.0', [_c('feat: x')], '2026-04-24');
        expect(body).toContain('### Release highlights');
    });
});

describe('dedupe_commit_lines', () => {
    const sha = (n: string) => n.repeat(40);

    it('folds two commits whose rendered line would be identical', () => {
        const a = new Commit(sha('a'), 'fix', 'router', 'stop double-loading', false);
        const b = new Commit(sha('b'), 'fix', 'router', 'stop double-loading', false);
        expect(dedupe_commit_lines([a, b])).toEqual([a]);
    });

    it('keeps the first occurrence, so the earliest SHA stays the citation', () => {
        const a = new Commit(sha('a'), 'fix', null, 'x', false);
        const b = new Commit(sha('b'), 'fix', null, 'x', false);
        expect(dedupe_commit_lines([a, b])[0]?.sha).toBe(sha('a'));
    });

    it('never folds a breaking commit into a non-breaking twin', () => {
        // `!` changes what the line means; collapsing them would hide a
        // breaking change behind a routine one.
        const plain = new Commit(sha('a'), 'feat', 'api', 'drop old route', false);
        const breaking = new Commit(sha('b'), 'feat', 'api', 'drop old route', true);
        expect(dedupe_commit_lines([plain, breaking])).toHaveLength(2);
    });

    it('distinguishes scope — same subject in two scopes is two changes', () => {
        const a = new Commit(sha('a'), 'fix', 'router', 'tighten', false);
        const b = new Commit(sha('b'), 'fix', 'linter', 'tighten', false);
        expect(dedupe_commit_lines([a, b])).toHaveLength(2);
    });

    it('no line appears twice in a rendered entry', () => {
        const a = new Commit(sha('a'), 'fix', 'router', 'stop double-loading', false);
        const b = new Commit(sha('b'), 'fix', 'router', 'stop double-loading', false);
        const [, body] = render_changelog_entry('1.2.1', '1.2.0', [a, b], '2026-04-24');
        const bullets = body.split('\n').filter((l) => l.startsWith('* '));
        expect(new Set(bullets).size).toBe(bullets.length);
        expect(bullets).toHaveLength(1);
    });
});

describe('watch_pr_checks — failing-check summary (the scrolled-away-failure fix)', () => {
    it('extracts only fail-bucket names from gh pr checks --json output', () => {
        const payload = JSON.stringify([
            { bucket: 'pass', name: 'skill-lint' },
            { bucket: 'fail', name: 'Release-PR shape detector' },
            { bucket: 'skipping', name: 'Node Tests (${{ matrix.os }}, shard ${{ matrix.shard }}/4)' },
            { bucket: 'fail', name: 'originality-gate' },
        ]);
        expect(_failed_check_names(payload)).toEqual([
            'Release-PR shape detector',
            'originality-gate',
        ]);
    });

    it('degrades to [] on unparseable or non-array payloads', () => {
        expect(_failed_check_names('')).toEqual([]);
        expect(_failed_check_names('not json')).toEqual([]);
        expect(_failed_check_names('{"bucket":"fail"}')).toEqual([]);
    });

    it('names every failing check and always carries the resume command', () => {
        const report = _failed_checks_report(['skill-lint', 'originality-gate']);
        expect(report).toContain('❌ skill-lint');
        expect(report).toContain('❌ originality-gate');
        expect(report).toContain('task release -- --resume --yes');
        expect(report).not.toContain('Release-PR shape:');
    });

    it('adds the land-on-main procedure only when the shape detector failed', () => {
        const report = _failed_checks_report(['Release-PR shape detector']);
        expect(report).toContain('Release-PR shape:');
        expect(report).toContain('merge main into the release branch');
    });

    it('an empty name list yields an empty report — raw watch output stands alone', () => {
        expect(_failed_checks_report([])).toBe('');
    });
});

describe('assert_scheduled_deprecations_clear', () => {
    /** A stub gate that records the argv it was handed. */
    function stub(returncode: number, calls: string[][]) {
        return (args: readonly string[]) => {
            calls.push([...args]);
            return { returncode, stdout: '', stderr: '' };
        };
    }

    it('does not consult the gate on a minor or patch target', () => {
        const calls: string[][] = [];
        assert_scheduled_deprecations_clear('12.1.0', stub(1, calls));
        assert_scheduled_deprecations_clear('12.0.1', stub(1, calls));
        // A red gate that is never consulted is what proves the guard is bounded
        // to major cuts — the asymmetry the whole check is built around.
        expect(calls).toEqual([]);
    });

    it('a clear table lets the cut proceed, consulting the gate exactly once', () => {
        const calls: string[][] = [];
        expect(() => assert_scheduled_deprecations_clear('13.0.0', stub(0, calls))).not.toThrow();
        expect(calls).toHaveLength(1);
    });

    it('passes the TARGET to the gate, not the shipped version', () => {
        // The defect this pins: without --cutting the gate falls back to
        // package.json, which at the cut to N still reads N-1, so a row due at
        // N reads as one major early and the cut that creates the miss passes.
        const calls: string[][] = [];
        assert_scheduled_deprecations_clear('13.0.0', stub(0, calls));
        expect(calls[0]).toContain('--cutting');
        expect(calls[0]?.[calls[0].indexOf('--cutting') + 1]).toBe('13.0.0');
    });

    it('a due or overdue row refuses the cut', () => {
        const calls: string[][] = [];
        expect(() => assert_scheduled_deprecations_clear('13.0.0', stub(1, calls))).toThrow(
            SystemExitError,
        );
        expect(calls).toHaveLength(1);
    });

    it('the guard cannot see the current version at all — which is what covers resume', () => {
        // Resume is the path where target === current, and an earlier revision
        // keyed on target > current returned silently there. It is not pinned
        // by a separate case, because there is no input that distinguishes it:
        // the guard takes ONE version and never reads the current one. That is
        // the property, so assert the property rather than staging a duplicate
        // of the refusal test that cannot fail independently of it.
        const calls: string[][] = [];
        assert_scheduled_deprecations_clear('13.0.0', stub(0, calls));
        // Exactly one version reaches the gate, and it is the target. An earlier
        // revision of this test also asserted `Function.length`, which counts
        // parameters before the first default and therefore held for any
        // refactor — including one that reintroduces a `current` parameter. The
        // argv content is the only thing that actually establishes the property.
        expect(calls[0]?.filter((a) => /^\d+\.\d+\.\d+$/.test(a))).toEqual(['13.0.0']);
    });

    it('previewOnly reports the refusal and does NOT throw — the dry-run contract', () => {
        // The branch this function's own JSDoc names as a prior regression, and
        // which no test reached: the integration dry-run tests spawn against the
        // real repo, whose table is clean, so the guard returns on exit 0 long
        // before the preview branch.
        const calls: string[][] = [];
        expect(() =>
            assert_scheduled_deprecations_clear('13.0.0', stub(1, calls), { previewOnly: true }),
        ).not.toThrow();
        // It still consults the gate — a preview that skips the check shows nothing.
        expect(calls).toHaveLength(1);
        // And without previewOnly the identical input refuses, so the flag is
        // what makes the difference rather than the fixture being toothless.
        expect(() => assert_scheduled_deprecations_clear('13.0.0', stub(1, []))).toThrow(
            SystemExitError,
        );
    });

    it('a multi-major jump is still a major cut', () => {
        const calls: string[][] = [];
        expect(() => assert_scheduled_deprecations_clear('14.0.0', stub(1, calls))).toThrow(
            SystemExitError,
        );
        expect(calls).toHaveLength(1);
    });
});
