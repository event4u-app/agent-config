/**
 * Corpus selection and the `kind: artifact` task contract for `bench_ab_v2_run`.
 *
 * The runner sits at its source-size ceiling, so everything the artifact corpus
 * adds — the `--corpus` selector, the loader that refuses an incomplete task,
 * and the dry-run listing — lives here. The trackb-v2 path is unchanged: same
 * file, same YAML 1.1 parse, same task list.
 *
 * Contract: `internal/bench/corpora/SCHEMA-v2.md` § Artifact tasks.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { parse as parseYaml } from 'yaml';

type Dict = Record<string, unknown>;

export const LADDER_NAMES = ['naive', 'informed'] as const;
export type LadderName = (typeof LADDER_NAMES)[number];
export const NETWORK_MODES = ['none', 'registry'] as const;
export type NetworkMode = (typeof NETWORK_MODES)[number];
export const LADDER_MIN_STEPS = 3;
export const LADDER_MAX_STEPS = 5;

export interface GraderRef {
    id: string;
    role: 'primary' | 'secondary';
    args?: Dict;
}

export interface ArtifactTask {
    id: string;
    kind: 'artifact';
    family: string;
    fixture: string;
    prompt: string;
    deliverable: { path: string; type: string };
    graders: GraderRef[];
    parity_bar: number;
    feedback_ladder: Record<LadderName, string[]>;
    network: NetworkMode;
    notes?: string;
}

export interface CorpusSelection {
    name: string;
    path: string;
    kind: 'discipline' | 'artifact';
}

const NAMED: Record<string, { file: string; kind: CorpusSelection['kind'] }> = {
    'ab-trackb-v2': { file: 'ab-trackb-v2.yaml', kind: 'discipline' },
    'ab-artifact-v2': { file: 'ab-artifact-v2.yaml', kind: 'artifact' },
};
const ALIASES: Record<string, string> = { trackb: 'ab-trackb-v2', artifact: 'ab-artifact-v2' };

/**
 * Strip `--corpus <name>` / `--corpus=<name>` out of argv before the runner's own
 * parser sees it. Default is the discipline corpus, so every existing invocation
 * keeps its meaning.
 */
export function select_corpus(argv: readonly string[], repo_root: string): [string[], CorpusSelection] {
    const rest: string[] = [];
    let want = 'ab-trackb-v2';
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--corpus' && i + 1 < argv.length) {
            want = argv[i + 1] as string;
            i += 1;
        } else if (a.startsWith('--corpus=')) {
            want = a.slice('--corpus='.length);
        } else {
            rest.push(a);
        }
    }
    const name = ALIASES[want] ?? want;
    const known = NAMED[name];
    if (known === undefined) {
        process.stderr.write(`bench_ab_v2: unknown --corpus "${want}" (known: ${Object.keys(ALIASES).join(', ')})\n`);
        process.exit(2);
    }
    return [rest, { name, kind: known.kind, path: path.join(repo_root, 'internal', 'bench', 'corpora', known.file) }];
}

function isDict(v: unknown): v is Dict {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Every reason this entry is not a valid artifact task; empty means valid. */
export function validate_artifact_task(t: unknown): string[] {
    if (!isDict(t)) return ['task is not a mapping'];
    const id = typeof t['id'] === 'string' ? t['id'] : '<no id>';
    const errs: string[] = [];
    const need = (k: string): void => {
        if (typeof t[k] !== 'string' || (t[k] as string).trim() === '') errs.push(`${id}: missing ${k}`);
    };
    for (const k of ['id', 'family', 'fixture', 'prompt']) need(k);
    if (t['kind'] !== 'artifact') errs.push(`${id}: kind must be "artifact"`);
    const d = t['deliverable'];
    if (!isDict(d) || typeof d['path'] !== 'string' || typeof d['type'] !== 'string') {
        errs.push(`${id}: deliverable needs {path, type}`);
    }
    const graders = t['graders'];
    if (!Array.isArray(graders) || graders.length === 0) {
        errs.push(`${id}: graders[] is empty`);
    } else {
        const primaries = graders.filter((g) => isDict(g) && g['role'] === 'primary');
        if (primaries.length !== 1) errs.push(`${id}: exactly one primary grader required, got ${primaries.length}`);
        for (const g of graders) {
            if (!isDict(g) || typeof g['id'] !== 'string' || !['primary', 'secondary'].includes(String(g['role']))) {
                errs.push(`${id}: grader entries need {id, role: primary|secondary}`);
            }
        }
    }
    const bar = t['parity_bar'];
    if (typeof bar !== 'number' || !(bar > 0 && bar <= 1)) errs.push(`${id}: parity_bar must be a number in (0, 1]`);
    if (!NETWORK_MODES.includes(t['network'] as NetworkMode)) errs.push(`${id}: network must be none|registry`);
    const ladder = t['feedback_ladder'];
    if (!isDict(ladder)) {
        errs.push(`${id}: feedback_ladder missing`);
    } else {
        for (const name of LADDER_NAMES) {
            const steps = ladder[name];
            if (!Array.isArray(steps) || steps.some((s) => typeof s !== 'string' || s.trim() === '')) {
                errs.push(`${id}: feedback_ladder.${name} missing`);
            } else if (steps.length < LADDER_MIN_STEPS || steps.length > LADDER_MAX_STEPS) {
                errs.push(`${id}: feedback_ladder.${name} has ${steps.length} steps, needs ${LADDER_MIN_STEPS}-${LADDER_MAX_STEPS}`);
            }
        }
        const extra = Object.keys(ladder).filter((k) => !(LADDER_NAMES as readonly string[]).includes(k));
        if (extra.length > 0) errs.push(`${id}: unknown ladder(s) ${extra.join(', ')}`);
    }
    return errs;
}

/** Parse and validate an artifact corpus; throws listing every invalid entry. */
export function parse_artifact_corpus(text: string): ArtifactTask[] {
    const doc = parseYaml(text, { version: '1.1' }) as unknown;
    const tasks = isDict(doc) && Array.isArray(doc['tasks']) ? (doc['tasks'] as unknown[]) : null;
    if (tasks === null) throw new Error('artifact corpus: top-level tasks[] missing');
    const errs = tasks.flatMap(validate_artifact_task);
    const ids = tasks.map((t) => (isDict(t) ? String(t['id']) : ''));
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (dup.length > 0) errs.push(`duplicate id(s): ${[...new Set(dup)].join(', ')}`);
    if (errs.length > 0) throw new Error(`artifact corpus invalid:\n  ${errs.join('\n  ')}`);
    return tasks as ArtifactTask[];
}

export function load_artifact_corpus(file: string): ArtifactTask[] {
    return parse_artifact_corpus(fs.readFileSync(file, 'utf-8'));
}

/** The runner's task list for a selection. An invalid artifact corpus exits 2. */
export function load_v2_tasks(sel: CorpusSelection): Dict[] {
    if (sel.kind === 'artifact') {
        try {
            return load_artifact_corpus(sel.path) as unknown as Dict[];
        } catch (e) {
            process.stderr.write(`bench_ab_v2: ${(e as Error).message}\n`);
            process.exit(2);
        }
    }
    const doc = parseYaml(fs.readFileSync(sel.path, 'utf-8'), { version: '1.1' }) as unknown;
    return isDict(doc) && Array.isArray(doc['tasks']) ? (doc['tasks'] as Dict[]) : [];
}

/** One line per task × arm for an artifact dry run; empty for the discipline corpus. */
export function dry_run_listing(sel: CorpusSelection, tasks: readonly Dict[], arms: readonly string[]): string {
    if (sel.kind !== 'artifact') return '';
    const lines: string[] = [];
    for (const t of tasks) {
        const primary = (t['graders'] as GraderRef[]).find((g) => g.role === 'primary')?.id ?? '?';
        for (const a of arms) {
            lines.push(
                `  ${String(t['id'])}  arm=${a}  deliverable=${(t['deliverable'] as Dict)['path']}  ` +
                    `primary=${primary}  parity_bar=${String(t['parity_bar'])}  network=${String(t['network'])}  ` +
                    `ladders=${LADDER_NAMES.join('+')}\n`,
            );
        }
    }
    return lines.join('');
}
