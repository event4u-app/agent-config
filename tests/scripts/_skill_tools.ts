// Shared fixtures + golden-parity helpers for the Block D skill_tools twins
// (py2ts Phase 8 / Wave 8h). Committed helper imported by:
//   - score_skill_relevance.test.ts
//   - audit_persona_coverage.test.ts
//   - audit_user_type_coverage.test.ts
//   - suggest_skill_for_task.test.ts
//   - run_block_d_eval.test.ts
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
export const TOOLS_DIR = path.join(REPO_ROOT, 'src', 'scripts', 'skill_tools');
export const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

// `from skill_tools.X import …` resolves only with `src/scripts` on PYTHONPATH
// (the test suites manually `sys.path.insert(0, .../src/scripts)`); reproduce
// that for the golden CLI spawns.
export const PY_ENV = {
    ...process.env,
    PYTHONPATH: `${path.join(REPO_ROOT, 'src', 'scripts')}${path.delimiter}${process.env.PYTHONPATH ?? ''}`,
};

export function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** Fresh temp dir, auto-unique. Caller cleans up via rmTmp. */
export function mkTmp(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'skill-tools-'));
}

export function rmTmp(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
}

/** Mirror the pytest `_write_skill` helper (score_skill_relevance suite). */
export function writeSkill(skillsDir: string, slug: string, fm: string): void {
    const skill = path.join(skillsDir, slug, 'SKILL.md');
    fs.mkdirSync(path.dirname(skill), { recursive: true });
    fs.writeFileSync(skill, `---\n${fm}\n---\n\n# ${slug}\n`, 'utf-8');
}

/** Mirror the pytest `_persona` helper (persona suites). */
export function writePersona(personasDir: string, slug: string, tier: string): void {
    const f = path.join(personasDir, `${slug}.md`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, `---\nid: ${slug}\ntier: ${tier}\n---\nbody\n`, 'utf-8');
}

/** Mirror the persona-suite `_skill` helper (citation-only skills). */
export function writeSkillWithPersonas(skillsDir: string, slug: string, personas: string[]): void {
    const f = path.join(skillsDir, slug, 'SKILL.md');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    let body = `---\nname: ${slug}\n`;
    if (personas.length > 0) {
        const block = personas.map((p) => `  - ${p}`).join('\n');
        body += `personas:\n${block}\n`;
    }
    body += '---\n';
    fs.writeFileSync(f, body, 'utf-8');
}

/** Mirror the suggest-suite `_skill` helper (name + description + personas). */
export function writeSkillFull(
    skillsDir: string,
    slug: string,
    desc: string,
    personas: string[],
): void {
    const f = path.join(skillsDir, slug, 'SKILL.md');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    let body = `---\nname: ${slug}\ndescription: "${desc}"\n`;
    if (personas.length > 0) {
        body += 'personas:\n' + personas.map((p) => `  - ${p}`).join('\n') + '\n';
    }
    body += '---\n';
    fs.writeFileSync(f, body, 'utf-8');
}

/** Mirror the user-type-suite `_user_type` helper. */
export function writeUserType(userTypesDir: string, slug: string): void {
    const f = path.join(userTypesDir, `${slug}.md`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, `---\nid: ${slug}\nkind: user-type\n---\nbody\n`, 'utf-8');
}

/** Mirror the user-type-suite `_doc` helper. */
export function writeDoc(searchRoot: string, name: string, body: string): void {
    const f = path.join(searchRoot, name);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body, 'utf-8');
}

export interface RunResult {
    py: SpawnSyncReturns<string>;
    ts: SpawnSyncReturns<string>;
}

/**
 * Run a skill_tools module via python3 AND tsx with the same args, returning
 * both results for byte-identical comparison. The Python package import needs
 * `src/scripts` on PYTHONPATH.
 */
export function runBoth(module: string, args: string[]): RunResult {
    const py = spawnSync('python3', [path.join(TOOLS_DIR, `${module}.py`), ...args], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        env: PY_ENV,
    });
    const ts = spawnSync(TSX_BIN, [path.join(TOOLS_DIR, `${module}.ts`), ...args], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
    });
    return { py, ts };
}
