#!/usr/bin/env tsx
/**
 * Project familiarization bootstrap — road-to-knowledge-system Phase 6.
 * Deterministic, static-analysis-only seed for a fresh consumer project:
 * scans directory NAMES and known config FILENAMES only — never reads file
 * CONTENTS beyond the project's own manifest files, so secrets/PII/business
 * logic can never leak into the staged output by construction (the same
 * exclusion-by-construction principle as PII-safe log schemas: a script that
 * cannot read arbitrary file bodies has no redaction pass to fail).
 *
 * Every detected fact carries an evidence pointer (the path that proves it).
 * Every inferential line (a suggestion the human still has to confirm) is
 * marked `[HUMAN: verify]` — this script never invents a claim.
 *
 * Output goes to a GITIGNORED staging directory, never directly to
 * `agents/knowledge/`. The `/team-knowledge bootstrap` command reviews the
 * staged pages with the user before moving anything into the tracked tree.
 *
 * Usage:
 *   bootstrap_knowledge.ts [--dir <repo-root>] [--staging-dir <dir>]
 *
 * Exit codes: 0 = staged, 1 = usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PROG = 'bootstrap_knowledge.ts';
const DEFAULT_STAGING_DIR = path.join('agents', '.bootstrap-staging');

// Directory names never worth surfacing as "project structure" — build
// output, dependency caches, and VCS internals.
const NOISE_DIRS = new Set([
    'node_modules', 'vendor', '.git', 'dist', 'build', '.next', '.nuxt',
    'coverage', '.venv', 'venv', '__pycache__', '.turbo', '.cache',
]);

interface ManifestSignal {
    ecosystem: string;
    file: string;
}

const MANIFEST_FILES: ManifestSignal[] = [
    { ecosystem: 'Node/JS/TS', file: 'package.json' },
    { ecosystem: 'PHP/Composer', file: 'composer.json' },
    { ecosystem: 'Python', file: 'pyproject.toml' },
    { ecosystem: 'Python (legacy)', file: 'requirements.txt' },
    { ecosystem: 'Go', file: 'go.mod' },
    { ecosystem: 'Ruby', file: 'Gemfile' },
    { ecosystem: 'Rust', file: 'Cargo.toml' },
];

// Per standards-from-config's own detection list — existence only, never content.
const STANDARDS_CONFIG_FILES = [
    '.editorconfig', '.eslintrc.json', '.eslintrc.js', 'eslint.config.js',
    '.prettierrc', '.prettierrc.json', 'biome.json', 'tsconfig.json',
    'pint.json', '.php-cs-fixer.dist.php', 'phpcs.xml',
    'ruff.toml', 'setup.cfg', '.rubocop.yml', '.golangci.yml',
];

const TEST_CONFIG_FILES = [
    'jest.config.js', 'jest.config.ts', 'vitest.config.ts', 'vitest.config.js',
    'phpunit.xml', 'phpunit.xml.dist', 'pytest.ini', 'pest.config.php',
];

export interface DetectedFact {
    label: string;
    evidence: string; // the file/dir path proving this fact
}

export interface BootstrapResult {
    manifests: DetectedFact[];
    topLevelDirs: DetectedFact[];
    standardsConfigs: DetectedFact[];
    testConfigs: DetectedFact[];
}

function exists(p: string): boolean {
    try {
        fs.accessSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Pure detection over a given root — filenames and directory names only, never file content. */
export function detect(root: string): BootstrapResult {
    const manifests: DetectedFact[] = [];
    for (const m of MANIFEST_FILES) {
        if (exists(path.join(root, m.file))) manifests.push({ label: m.ecosystem, evidence: m.file });
    }

    let topLevelDirs: DetectedFact[] = [];
    try {
        topLevelDirs = fs
            .readdirSync(root, { withFileTypes: true })
            .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !NOISE_DIRS.has(e.name))
            .map((e) => ({ label: e.name, evidence: `${e.name}/` }))
            .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
    } catch {
        topLevelDirs = [];
    }

    const standardsConfigs = STANDARDS_CONFIG_FILES.filter((f) => exists(path.join(root, f))).map((f) => ({
        label: f,
        evidence: f,
    }));

    const testConfigs = TEST_CONFIG_FILES.filter((f) => exists(path.join(root, f))).map((f) => ({
        label: f,
        evidence: f,
    }));

    return { manifests, topLevelDirs, standardsConfigs, testConfigs };
}

function renderStructurePage(result: BootstrapResult): string {
    const lines: string[] = [
        '---',
        'type: concept',
        '---',
        '',
        '# Project Structure',
        '',
        '_Staged by `src/scripts/bootstrap_knowledge.ts` — review before committing._',
        '',
        '## Detected package manifests',
        '',
    ];
    if (result.manifests.length === 0) {
        lines.push('- No known manifest file found. `[HUMAN: verify]` — name the ecosystem.');
    } else {
        for (const m of result.manifests) lines.push(`- ${m.label} (\`${m.evidence}\`)`);
    }
    lines.push('', '## Top-level directories', '');
    if (result.topLevelDirs.length === 0) {
        lines.push('- None detected.');
    } else {
        for (const d of result.topLevelDirs) {
            lines.push(`- \`${d.evidence}\` — \`[HUMAN: verify]\` purpose/ownership`);
        }
    }
    lines.push('');
    return lines.join('\n');
}

function renderStandardsPage(result: BootstrapResult): string {
    const lines: string[] = [
        '---',
        'type: concept',
        '---',
        '',
        '# Coding Standards (config-derived seed)',
        '',
        '_Staged by `src/scripts/bootstrap_knowledge.ts` — this lists WHICH config',
        'files exist, not their content. Run `standards-from-config` for the full',
        'pointer+digest derivation before relying on this page._',
        '',
    ];
    if (result.standardsConfigs.length === 0) {
        lines.push('- No recognized lint/format config found. `[HUMAN: verify]`.');
    } else {
        for (const c of result.standardsConfigs) lines.push(`- \`${c.evidence}\` present — \`[HUMAN: verify]\` derive the actual rule via \`standards-from-config\``);
    }
    lines.push('', '## Test framework', '');
    if (result.testConfigs.length === 0) {
        lines.push('- No recognized test config found. `[HUMAN: verify]`.');
    } else {
        for (const t of result.testConfigs) lines.push(`- \`${t.evidence}\` present`);
    }
    lines.push('');
    return lines.join('\n');
}

const MODULES_PAGE = [
    '---',
    'type: concept',
    '---',
    '',
    '# Module Structure',
    '',
    '_Staged by `src/scripts/bootstrap_knowledge.ts` as an EMPTY seed — module',
    'boundaries require reading actual code, which this deterministic bootstrap',
    'never does. Run `module-detect-on-the-fly` to fill this in, or delete this',
    'page if the project has no module system._',
    '',
    '`[HUMAN: verify]` — run module-detect-on-the-fly and fill this page in.',
    '',
].join('\n');

const API_CONVENTIONS_PAGE = [
    '---',
    'type: procedure',
    '---',
    '',
    '# API Conventions',
    '',
    '_Staged by `src/scripts/bootstrap_knowledge.ts` as an EMPTY seed — API shapes',
    'are learned from real request/response observation (`api_shape_learned`',
    'events), which this deterministic bootstrap never fabricates._',
    '',
    '`[HUMAN: verify]` — this page fills in as `api_shape_learned` events',
    'consolidate, or via manual documentation.',
    '',
].join('\n');

const COMMON_MISTAKES_PAGE = [
    '---',
    'type: session',
    '---',
    '',
    '# Common Mistakes',
    '',
    '_Staged by `src/scripts/bootstrap_knowledge.ts` as an EMPTY seed — this fills',
    'in from `mistake_made` events as the team works, never fabricated up front._',
    '',
].join('\n');

export function stagePages(root: string, stagingDir: string): void {
    const result = detect(root);
    fs.mkdirSync(path.join(stagingDir, 'concepts'), { recursive: true });
    fs.mkdirSync(path.join(stagingDir, 'procedures'), { recursive: true });
    fs.mkdirSync(path.join(stagingDir, 'sessions'), { recursive: true });

    fs.writeFileSync(path.join(stagingDir, 'concepts', 'structure.md'), renderStructurePage(result), 'utf8');
    fs.writeFileSync(path.join(stagingDir, 'concepts', 'standards.md'), renderStandardsPage(result), 'utf8');
    fs.writeFileSync(path.join(stagingDir, 'concepts', 'modules.md'), MODULES_PAGE, 'utf8');
    fs.writeFileSync(path.join(stagingDir, 'procedures', 'api-conventions.md'), API_CONVENTIONS_PAGE, 'utf8');
    fs.writeFileSync(path.join(stagingDir, 'sessions', 'common-mistakes.md'), COMMON_MISTAKES_PAGE, 'utf8');
}

function printUsage(): void {
    process.stdout.write(`usage: ${PROG} [--dir DIR] [--staging-dir DIR]\n`);
}

export function main(argv: string[]): number {
    let dir = process.cwd();
    let stagingDir = DEFAULT_STAGING_DIR;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '-h' || arg === '--help') {
            printUsage();
            return 0;
        } else if (arg === '--dir') {
            dir = argv[++i] ?? dir;
        } else if (arg === '--staging-dir') {
            stagingDir = argv[++i] ?? stagingDir;
        } else {
            process.stderr.write(`${PROG}: error: unrecognized argument: ${arg}\n`);
            printUsage();
            return 1;
        }
    }

    stagePages(dir, stagingDir);
    process.stdout.write(
        `${PROG}: staged 5 template page(s) under ${stagingDir}/ — review before moving into agents/knowledge/.\n`,
    );
    return 0;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
