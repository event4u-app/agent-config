/**
 * A split skill loses no line (road-to-steps-the-skill-cannot-skip 4.2, 4.5).
 *
 * The pre-split body of each pilot is committed under `fixtures/procedure_conservation/`.
 * Conservation is checked against it, never judged:
 *
 *   - every step file is one contiguous run of the old body, the runs in sidecar
 *     order and never overlapping, so a line moved into the wrong step fails;
 *   - what is left is an in-order subsequence of the new head, each old line
 *     matched exactly once, so a dropped duplicate or a line moved under another
 *     heading fails;
 *   - a head line with no counterpart in the old body is allowed only inside the
 *     head's `## Procedure` section — the step table and the cursor sentence;
 *   - a heading may change level and a relative link is compared by the path it
 *     resolves to from the skill root; a fenced block is compared byte for byte.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { GLOBAL_DEPLOY_SOURCES } from '../../src/install/wizard-plan.js';
import { _copy_dir_dereferencing_symlinks } from '../../src/scripts/install.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'skills', 'fixtures', 'procedure_conservation');
const PILOTS = ['existing-ui-audit', 'project-analyzer'] as const;

interface Token {
    text: string;
    inProcedure: boolean;
}

/** Normalised tokens of one file; `fileDir` is the file's directory relative to the skill root. */
export function tokens(text: string, fileDir: string): Token[] {
    const out: Token[] = [];
    let fence: string | null = null;
    let inProcedure = false;
    for (const line of text.split('\n')) {
        const opener = /^\s*(`{3,}|~{3,})/.exec(line);
        if (fence !== null) {
            out.push({ text: `F:${line}`, inProcedure });
            if (opener !== null && (opener[1] as string).startsWith(fence)) fence = null;
            continue;
        }
        if (opener !== null) {
            fence = (opener[1] as string).slice(0, 3);
            out.push({ text: `F:${line}`, inProcedure });
            continue;
        }
        if (line.trim() === '') continue;
        if (/^##\s/.test(line)) inProcedure = /^##\s+Procedure\b/.test(line);
        const heading = line.replace(/^#{1,6}\s+/, '');
        const linked = heading.replace(/\]\(([^)\s]+)\)/g, (whole, target: string) => {
            if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) return whole;
            const [p, anchor] = target.split('#', 2) as [string, string | undefined];
            const resolved = path.posix.normalize(path.posix.join(fileDir, p));
            return `](${resolved}${anchor === undefined ? '' : `#${anchor}`})`;
        });
        out.push({ text: `L:${linked}`, inProcedure });
    }
    return out;
}

export interface Split {
    head: string;
    steps: Array<{ file: string; text: string }>;
}

/** Every violation of conservation, empty when the split lost nothing. */
export function conservationErrors(oldBody: string, split: Split): string[] {
    const errors: string[] = [];
    const old = tokens(oldBody, '');
    const used = new Array<boolean>(old.length).fill(false);
    let from = 0;
    for (const step of split.steps) {
        const t = tokens(step.text, path.posix.dirname(step.file)).map((x) => x.text);
        if (t.length === 0) {
            errors.push(`${step.file}: empty step file`);
            continue;
        }
        let at = -1;
        for (let p = from; p + t.length <= old.length && at === -1; p += 1) {
            if (t.every((x, k) => old[p + k]?.text === x)) at = p;
        }
        if (at === -1) {
            errors.push(`${step.file}: not one contiguous run of the old body after the previous step (first line: ${t[0]})`);
            continue;
        }
        for (let k = 0; k < t.length; k += 1) used[at + k] = true;
        from = at + t.length;
    }
    const rest = old.filter((_, i) => !used[i]).map((x) => x.text);
    const head = tokens(split.head, '');
    let j = 0;
    for (const h of head) {
        if (j < rest.length && h.text === rest[j]) {
            j += 1;
        } else if (!h.inProcedure) {
            errors.push(`head: line not in the old body at this position, outside ## Procedure: ${h.text}`);
        }
    }
    if (j < rest.length) errors.push(`head: old line lost or out of order: ${rest[j]}`);
    return errors;
}

function readSplit(skill: string): Split {
    const dir = path.join(REPO, 'src', 'skills', skill);
    const sidecar = YAML.parse(fs.readFileSync(path.join(dir, 'procedure.yaml'), 'utf8')) as {
        steps: Array<{ file: string }>;
    };
    return {
        head: fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8'),
        steps: sidecar.steps.map((s) => ({ file: s.file, text: fs.readFileSync(path.join(dir, s.file), 'utf8') })),
    };
}

describe('the conservation check itself', () => {
    const OLD = [
        '# s',
        '## When to use',
        'a',
        '## Procedure',
        '### 1. First',
        'see [x](references/x.md)',
        '### 2. Second',
        'b',
        'b',
        '```',
        '## not a heading',
        '```',
        '## Do NOT',
        'c',
    ].join('\n');
    const head = ['# s', '## When to use', 'a', '## Procedure', '1. [First](references/steps/1.md)', '## Do NOT', 'c'].join('\n');
    const step1 = { file: 'references/steps/1.md', text: '# 1. First\nsee [x](../x.md)\n' };
    const step2 = { file: 'references/steps/2.md', text: '# 2. Second\nb\nb\n```\n## not a heading\n```\n' };

    it('passes a split that only moved lines, changed heading levels and re-rooted links', () => {
        expect(conservationErrors(OLD, { head, steps: [step1, step2] })).toEqual([]);
    });

    it('fails a dropped duplicate line', () => {
        const dropped = { ...step2, text: '# 2. Second\nb\n```\n## not a heading\n```\n' };
        expect(conservationErrors(OLD, { head, steps: [step1, dropped] })).not.toEqual([]);
    });

    it('fails steps in the wrong order', () => {
        expect(conservationErrors(OLD, { head, steps: [step2, step1] })).not.toEqual([]);
    });

    it('fails a line moved under another heading in the head', () => {
        const moved = ['# s', '## When to use', '## Procedure', '1. [First](references/steps/1.md)', '## Do NOT', 'a', 'c'].join('\n');
        expect(conservationErrors(OLD, { head: moved, steps: [step1, step2] })).not.toEqual([]);
    });

    it('fails a link whose target no longer resolves to the same file', () => {
        const wrong = { ...step1, text: '# 1. First\nsee [x](x.md)\n' };
        expect(conservationErrors(OLD, { head, steps: [wrong, step2] })).not.toEqual([]);
    });

    it('fails a changed byte inside a fenced block', () => {
        const fenced = { ...step2, text: '# 2. Second\nb\nb\n```\n## not a heading \n```\n' };
        expect(conservationErrors(OLD, { head, steps: [step1, fenced] })).not.toEqual([]);
    });

    it('fails a new line outside ## Procedure', () => {
        const added = head.replace('## Do NOT\nc', '## Do NOT\nc\nnew rule');
        expect(conservationErrors(OLD, { head: added, steps: [step1, step2] })).not.toEqual([]);
    });
});

describe('every pilot is split without losing a line', () => {
    for (const skill of PILOTS) {
        it(`conserves ${skill}`, () => {
            const old = fs.readFileSync(path.join(FIXTURES, `${skill}.pre-split.txt`), 'utf8');
            expect(conservationErrors(old, readSplit(skill))).toEqual([]);
        });

        it(`${skill} keeps the five required sections in the head`, () => {
            const head = readSplit(skill).head;
            for (const section of ['When to use', 'Gotcha', 'Procedure', 'Output format', 'Do NOT']) {
                expect(head, `${skill} head lost ## ${section}`).toMatch(new RegExp(`^## ${section}`, 'm'));
            }
        });
    }
});

const tmpDirs: string[] = [];
afterAll(() => {
    for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

describe('ships-step-files: the package ships what the head links (4.5)', () => {
    const files = (JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')) as { files: string[] }).files;

    for (const skill of PILOTS) {
        const shipped = (): string[] => ['procedure.yaml', ...readSplit(skill).steps.map((s) => s.file)];

        it(`ships-step-files: ${skill} sidecar and steps are in dist/agent-src and in the tarball's files[]`, () => {
            expect(files).toContain('dist/agent-src/');
            for (const rel of shipped()) {
                expect(fs.existsSync(path.join(REPO, 'dist', 'agent-src', 'skills', skill, rel)), `dist lacks ${skill}/${rel}`).toBe(true);
            }
        });

        it(`ships-step-files: ${skill} arrives complete in every host's skills deploy`, () => {
            const hosts = Object.entries(GLOBAL_DEPLOY_SOURCES).filter(([, rows]) =>
                rows.some(([src]) => src === 'dist/agent-src/skills'),
            );
            expect(hosts.length).toBeGreaterThan(0);
            for (const [host] of hosts) {
                const dest = fs.mkdtempSync(path.join(os.tmpdir(), `ships-${host}-`));
                tmpDirs.push(dest);
                _copy_dir_dereferencing_symlinks(path.join(REPO, 'dist', 'agent-src', 'skills', skill), dest, true, REPO);
                for (const rel of shipped()) {
                    expect(fs.existsSync(path.join(dest, rel)), `${host} deploy lacks ${skill}/${rel}`).toBe(true);
                }
            }
        });
    }
});
