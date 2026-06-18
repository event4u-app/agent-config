/**
 * Tests for the linked-projects sibling detector (Phase 1, Option A).
 *
 * 1:1 vitest port of `tests/test_linked_projects_detector.py` (ADR-088
 * parity gate 1), plus a differential block asserting the TS output is
 * JSON-equal to the Python original on three synthetic fixture projects
 * (PhpStorm shape, VS Code shape, no-siblings shape) — same pattern as
 * tests/spikes/yaml_rt_py_driver.py, inlined via `python3 -c`.
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
    detect_linked_projects,
    type LinkedProjectEntry,
} from '../../src/scripts/_lib/linked_projects.js';
import { oracle2 } from '../_lib/parity_oracle.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let tmpPath: string;

beforeEach(() => {
    tmpPath = mkdtempSync(path.join(tmpdir(), 'linked-projects-'));
});

afterEach(() => {
    rmSync(tmpPath, { recursive: true, force: true });
});

// --- helpers (1:1 with the pytest module) ----------------------------------

function makeGitRepo(p: string, files = 1): string {
    mkdirSync(p, { recursive: true });
    mkdirSync(path.join(p, '.git'), { recursive: true });
    for (let i = 0; i < files; i += 1) {
        writeFileSync(path.join(p, `f${i}.txt`), 'x', 'utf-8');
    }
    return p;
}

function writeIdeaModules(project: string, siblingRel: string): void {
    const idea = path.join(project, '.idea');
    mkdirSync(idea, { recursive: true });
    writeFileSync(
        path.join(idea, 'modules.xml'),
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<project version="4">\n' +
            '  <component name="ProjectModuleManager">\n' +
            '    <modules>\n' +
            '      <module fileurl="file://$PROJECT_DIR$/.idea/main.iml" ' +
            'filepath="$PROJECT_DIR$/.idea/main.iml" />\n' +
            `      <module fileurl="file://$PROJECT_DIR$/${siblingRel}/.idea/s.iml" ` +
            `filepath="$PROJECT_DIR$/${siblingRel}/.idea/s.iml" />\n` +
            '    </modules>\n' +
            '  </component>\n' +
            '</project>\n',
        'utf-8',
    );
}

function writeIdeaVcs(project: string, siblingRel: string): void {
    const idea = path.join(project, '.idea');
    mkdirSync(idea, { recursive: true });
    writeFileSync(
        path.join(idea, 'vcs.xml'),
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<project version="4">\n' +
            '  <component name="VcsDirectoryMappings">\n' +
            '    <mapping directory="$PROJECT_DIR$" vcs="Git" />\n' +
            `    <mapping directory="$PROJECT_DIR$/${siblingRel}" vcs="Git" />\n` +
            '  </component>\n' +
            '</project>\n',
        'utf-8',
    );
}

/**
 * Mirror of Python's `sibling.resolve()` for path-equality assertions —
 * the fixture paths always exist when this is called.
 */
function resolvedPath(p: string): string {
    return realpathSync(p);
}

// --- ported tests -----------------------------------------------------------

describe('detect_linked_projects', () => {
    test('phpstorm modules detects sibling', () => {
        const project = path.join(tmpPath, 'main');
        mkdirSync(project);
        const sibling = makeGitRepo(path.join(tmpPath, 'web'));
        writeIdeaModules(project, '../web');

        const result = detect_linked_projects(project);

        expect(result.map((e) => e.path)).toEqual([resolvedPath(sibling)]);
        expect((result[0] as LinkedProjectEntry).detected_via).toBe('phpstorm_modules');
    });

    test('phpstorm vcs detects sibling', () => {
        const project = path.join(tmpPath, 'main');
        mkdirSync(project);
        const sibling = makeGitRepo(path.join(tmpPath, 'web'));
        writeIdeaVcs(project, '../web');

        const result = detect_linked_projects(project);
        expect(result.map((e) => e.path)).toEqual([resolvedPath(sibling)]);
        expect((result[0] as LinkedProjectEntry).detected_via).toBe('phpstorm_vcs');
    });

    test('vscode workspace detects sibling', () => {
        const project = path.join(tmpPath, 'main');
        mkdirSync(project);
        const sibling = makeGitRepo(path.join(tmpPath, 'web'));
        writeFileSync(
            path.join(project, 'app.code-workspace'),
            '{\n  // workspace\n  "folders": [ {"path": "."}, {"path": "../web"} ],\n}\n',
            'utf-8',
        );

        const result = detect_linked_projects(project);
        expect(result.map((e) => e.path)).toEqual([resolvedPath(sibling)]);
        expect((result[0] as LinkedProjectEntry).detected_via).toBe('vscode_workspace');
    });

    test('malformed xml is skipped not crashed', () => {
        const project = path.join(tmpPath, 'main');
        mkdirSync(path.join(project, '.idea'), { recursive: true });
        writeFileSync(path.join(project, '.idea', 'modules.xml'), '<not valid xml', 'utf-8');

        expect(detect_linked_projects(project)).toEqual([]);
    });

    test('non-git target is skipped', () => {
        const project = path.join(tmpPath, 'main');
        mkdirSync(project);
        const plain = path.join(tmpPath, 'web');
        mkdirSync(plain); // no .git
        writeFileSync(path.join(plain, 'f.txt'), 'x', 'utf-8');
        writeIdeaModules(project, '../web');

        expect(detect_linked_projects(project)).toEqual([]);
    });

    test('missing target is skipped', () => {
        const project = path.join(tmpPath, 'main');
        mkdirSync(project);
        writeIdeaModules(project, '../does-not-exist');

        expect(detect_linked_projects(project)).toEqual([]);
    });

    test('oversized sibling is flagged not skipped', () => {
        // Under Option A (passive awareness) size never excludes — a real
        // frontend routinely exceeds the threshold and must still be
        // surfaced, just flagged.
        const project = path.join(tmpPath, 'main');
        mkdirSync(project);
        const sibling = makeGitRepo(path.join(tmpPath, 'web'), 3);
        writeIdeaModules(project, '../web');

        const result = detect_linked_projects(project, { max_files: 2 });
        expect(result.map((e) => e.path)).toEqual([resolvedPath(sibling)]);
        expect((result[0] as LinkedProjectEntry).large).toBe(true);
    });

    test('small sibling not flagged large', () => {
        const project = path.join(tmpPath, 'main');
        mkdirSync(project);
        makeGitRepo(path.join(tmpPath, 'web'), 1);
        writeIdeaModules(project, '../web');

        const result = detect_linked_projects(project);
        expect((result[0] as LinkedProjectEntry).large).toBe(false);
    });

    test('dedupe across sources', () => {
        const project = path.join(tmpPath, 'main');
        mkdirSync(project);
        const sibling = makeGitRepo(path.join(tmpPath, 'web'));
        writeIdeaModules(project, '../web');
        writeIdeaVcs(project, '../web'); // same sibling via two sources

        const result = detect_linked_projects(project);
        expect(result.map((e) => e.path)).toEqual([resolvedPath(sibling)]);
    });

    test('inside project is not a sibling', () => {
        const project = path.join(tmpPath, 'main');
        mkdirSync(project);
        makeGitRepo(path.join(project, 'submodule')); // inside the project
        writeIdeaVcs(project, 'submodule'); // maps an in-tree dir

        expect(detect_linked_projects(project)).toEqual([]);
    });
});

// --- differential check vs the Python original ------------------------------

const PY_DRIVER = [
    'import json, sys',
    'sys.path.insert(0, sys.argv[2])',
    'from scripts._lib.linked_projects import detect_linked_projects',
    'print(json.dumps(detect_linked_projects(sys.argv[1])))',
].join('\n');

/**
 * Strip the volatile tmp-dir abs prefix from text so the frozen golden is
 * machine-independent. The Python output (and the TS output) carry the resolved
 * absolute sibling `path`, rooted in a per-run `mkdtempSync` dir that differs
 * capture-vs-replay. Both fixture sides resolve through realpath (macOS
 * `/var`→`/private/var` symlink), so normalize on `realpathSync(tmpPath)`.
 * Applied symmetrically: to the oracle's python stdout AND to the TS JSON string
 * before parsing for comparison.
 */
function makeTmpNormalize(): (s: string) => string {
    const real = realpathSync(tmpPath);
    return (s: string): string => s.split(real).join('<TMP>').split(tmpPath).join('<TMP>');
}

/**
 * Drive the Python original; returns parsed JSON (paths normalized).
 *
 * Oracle-routed (`kind: 'inline'`): CAPTURE mode (PY2TS_CAPTURE=1) spawns
 * `python3 -c PY_DRIVER <projectRoot> <repo>/src` and freezes the JSON stdout;
 * NORMAL mode replays with no live python3. The volatile `projectRoot` arg is
 * stabilised in the snapshot KEY via `scratch: [tmpPath]`; the tmp-dir
 * `normalize` keeps the resolved sibling paths in the output machine-independent.
 * The inline code embeds no absolute path (it reads argv), so the inline key is
 * stable across machines.
 */
function pythonDetect(projectRoot: string, caseLabel: string): unknown {
    const out = oracle2({
        kind: 'inline',
        target: PY_DRIVER,
        // argv[1]=projectRoot, argv[2]=<repo>/src; argv[3]=caseLabel is IGNORED
        // by the driver but disambiguates the snapshot KEY per fixture (every
        // projectRoot stabilises to `<scratch:0>/main`, so without a stable
        // discriminator all three differential fixtures would collide on one key).
        args: [projectRoot, path.join(REPO_ROOT, 'src'), `case:${caseLabel}`],
        cwd: REPO_ROOT,
        scratch: [tmpPath],
        normalize: makeTmpNormalize(),
    });
    expect(out.status, out.stderr).toBe(0);
    return JSON.parse(out.stdout) as unknown;
}

function assertJsonParity(projectRoot: string, caseLabel: string): void {
    // Apply the SAME tmp-dir normalize to the TS side before comparing — the
    // python side was normalized in pythonDetect.
    const normalize = makeTmpNormalize();
    const tsResult = JSON.parse(
        normalize(JSON.stringify(detect_linked_projects(projectRoot))),
    ) as unknown;
    expect(tsResult).toEqual(pythonDetect(projectRoot, caseLabel));
}

describe('differential: TS output JSON-equals Python output', () => {
    test('phpstorm-shaped fixture project', () => {
        const project = path.join(tmpPath, 'main');
        mkdirSync(project);
        makeGitRepo(path.join(tmpPath, 'web'), 2);
        makeGitRepo(path.join(tmpPath, 'api'), 1);
        writeIdeaModules(project, '../web');
        writeIdeaVcs(project, '../api');
        // duplicate + in-tree mapping to exercise dedupe and rejection paths
        writeIdeaVcs(project, '../web');

        assertJsonParity(project, 'phpstorm');
    });

    test('vscode-shaped fixture project', () => {
        const project = path.join(tmpPath, 'main');
        mkdirSync(project);
        makeGitRepo(path.join(tmpPath, 'fe'), 2);
        writeFileSync(
            path.join(project, 'app.code-workspace'),
            '{\n  // attached sibling\n  "folders": [\n    {"path": "."},\n' +
                '    {"path": "../fe"},\n    {"path": "../missing"},\n  ],\n}\n',
            'utf-8',
        );

        assertJsonParity(project, 'vscode');
    });

    test('no-siblings fixture project', () => {
        const project = path.join(tmpPath, 'main');
        mkdirSync(project);
        makeGitRepo(path.join(project, 'submodule')); // in-tree → rejected
        writeIdeaVcs(project, 'submodule');

        assertJsonParity(project, 'no-siblings');
    });
});
