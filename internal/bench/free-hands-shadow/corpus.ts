/**
 * The frozen corpus of `internal/bench/free-hands-shadow-PREREG.md`: tracked
 * files of this public repository at the commit that last touched the PREREG,
 * sampled with a fixed seed. Nothing here reads the working tree.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

import { CouncilEgress } from '../../../src/scripts/ai_council/council_egress.js';
import { buildHandPayload, type LinkingIdentifier } from '../../../src/scripts/ai_council/hand_payload.js';

export const SEED = 20261022;
export const AUDIT_SEED = 20261023;
export const PER_KIND = 333;
export const PREREG_RELPATH = 'internal/bench/free-hands-shadow-PREREG.md';

export const MEASURED_KINDS = ['classify', 'extract'] as const;
export type MeasuredKind = (typeof MEASURED_KINDS)[number];

export const CLASSIFY_LABELS = ['skill', 'rule', 'command', 'adr', 'roadmap', 'guideline', 'context', 'test', 'script'] as const;
export type ClassifyLabel = (typeof CLASSIFY_LABELS)[number];

const LABEL_RULES: ReadonlyArray<readonly [ClassifyLabel, RegExp, string]> = [
    ['skill', /^src\/skills\/[^/]+\/SKILL\.md$/, 'an agent skill definition, one SKILL.md per directory under src/skills/'],
    ['rule', /^src\/rules\/[^/]+\.md$/, 'an always-on or triggered agent rule under src/rules/'],
    ['command', /^(?:src\/domains\/.+\/command\.md|src\/agent-src\/commands\/.+\.md)$/, 'a slash-command definition (command.md under src/domains/, or under src/agent-src/commands/)'],
    ['adr', /^docs\/decisions\/ADR-\d+[^/]*\.md$/, 'an architecture decision record under docs/decisions/'],
    ['roadmap', /^agents\/roadmaps\/.+\.md$/, 'a work roadmap under agents/roadmaps/'],
    ['guideline', /^docs\/guidelines\/.+\.md$/, 'a coding or process guideline under docs/guidelines/'],
    ['context', /^src\/agent-src\/contexts\/.+\.md$/, 'a reference context document under src/agent-src/contexts/'],
    ['test', /^tests\/.+\.test\.ts$/, 'a TypeScript test file under tests/'],
    ['script', /^src\/scripts\/.+\.ts$/, 'a TypeScript source file under src/scripts/ that is not a test'],
];

/** The label of a path, or null outside the nine classes. */
export function labelOfPath(p: string): ClassifyLabel | null {
    if (/^src\/scripts\/.+\.test\.ts$/.test(p)) return null;
    for (const [label, re] of LABEL_RULES) if (re.test(p)) return label;
    return null;
}

const EXTRACT_POPULATION = /^(?:src\/skills\/[^/]+\/SKILL\.md|src\/domains\/.+\/command\.md)$/;

export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Sorted, then Fisher–Yates under the seed: the order depends on the seed and the set only. */
export function seededShuffle<T>(items: readonly T[], seed: number, key: (t: T) => string): T[] {
    const out = [...items].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
    const rnd = mulberry32(seed);
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
}

export interface Frontmatter {
    readonly block: string | null;
    readonly fields: Readonly<Record<string, string>>;
    readonly body: string;
}

function unquote(v: string): string {
    const t = v.trim();
    if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) return t.slice(1, -1);
    return t;
}

/** The leading `---` block and its top-level scalar fields; nested and list values are skipped. */
export function frontmatterOf(text: string): Frontmatter {
    const lines = text.split('\n');
    if (lines[0]?.trim() !== '---') return { block: null, fields: {}, body: text };
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    if (end === -1) return { block: null, fields: {}, body: text };
    const fields: Record<string, string> = {};
    for (const l of lines.slice(1, end)) {
        const m = /^([A-Za-z_][\w-]*):[ \t]*(\S.*)?$/.exec(l);
        if (m === null || m[2] === undefined) continue;
        if (/^[|>[{]/.test(m[2])) continue;
        fields[m[1] as string] = unquote(m[2].replace(/\s+#.*$/, ''));
    }
    return { block: lines.slice(0, end + 1).join('\n'), fields, body: lines.slice(end + 1).join('\n') };
}

const MAX_LINE = 200;
function head(text: string, n: number): string {
    return text
        .split('\n')
        .slice(0, n)
        .map((l) => (l.length > MAX_LINE ? `${l.slice(0, MAX_LINE)}…` : l))
        .join('\n');
}

export function classifySpec(path: string, content: string): string {
    const defs = LABEL_RULES.map(([label, , def]) => `- ${label}: ${def}`).join('\n');
    return (
        'Classify one file of a public software repository into exactly one label, spelled exactly as listed.\n' +
        `Labels:\n${defs}\n\nFile path: ${path}\nFirst lines:\n${head(content, 15)}`
    );
}

export function extractSpec(content: string): string {
    const fm = frontmatterOf(content);
    return (
        'Extract the value of the YAML frontmatter field `name` from the document below. ' +
        'Return exactly one item: the value as YAML reads it, without surrounding quotes.\n\n' +
        `Document:\n${fm.block ?? ''}\n${head(fm.body.replace(/^\n+/, ''), 10)}`
    );
}

export interface CorpusItem {
    readonly id: string;
    readonly kind: MeasuredKind;
    readonly path: string;
    readonly truth: string;
    readonly spec: string;
}

/** True when the production payload builder leaves `needle` byte-identical in the payload. */
export function survivesPayload(kind: MeasuredKind, spec: string, needle: string, linking: readonly LinkingIdentifier[]): boolean {
    try {
        const p = buildHandPayload({ kind, spec, linking }, new CouncilEgress({ identifiers: true }));
        return p.user.includes(needle);
    } catch {
        return false;
    }
}

export interface Inconsistency {
    readonly path: string;
    readonly label: ClassifyLabel;
    readonly reason: string;
}

/** Where a file's path class and its frontmatter disagree; null when they agree or the class has no contract. */
export function inconsistencyOf(path: string, label: ClassifyLabel, content: string): string | null {
    const fm = frontmatterOf(content);
    const f = fm.fields;
    switch (label) {
        case 'skill': {
            const dir = path.split('/')[2] ?? '';
            if (fm.block === null) return 'no frontmatter';
            if (f['name'] !== dir) return `name ${JSON.stringify(f['name'] ?? null)} is not the directory ${JSON.stringify(dir)}`;
            if (f['description'] === undefined) return 'no description';
            return null;
        }
        case 'rule':
            return f['type'] !== undefined && ['always', 'auto', 'manual'].includes(f['type'])
                ? null
                : `type ${JSON.stringify(f['type'] ?? null)} is not always|auto|manual`;
        case 'command':
            return f['name'] !== undefined ? null : 'no name';
        case 'adr': {
            const n = /ADR-(\d+)/.exec(path)?.[1];
            if (f['status'] === undefined) return 'no status';
            if (f['adr'] === undefined || Number(f['adr']) !== Number(n)) return `adr ${JSON.stringify(f['adr'] ?? null)} is not the filename number ${String(n)}`;
            return null;
        }
        default:
            return null;
    }
}

export function corpusRef(root: string): string {
    const sha = execFileSync('git', ['-C', root, 'log', '-1', '--format=%H', '--', PREREG_RELPATH], { encoding: 'utf8' }).trim();
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`no commit touches ${PREREG_RELPATH}; the corpus has no reference`);
    return sha;
}

export function listTree(root: string, ref: string): string[] {
    const out = execFileSync('git', ['-C', root, 'ls-tree', '-r', '--name-only', '-z', ref], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return out.split('\0').filter(Boolean);
}

/** Blob contents at `ref`, through one `git cat-file --batch`. */
export function readBlobs(root: string, ref: string, paths: readonly string[]): Map<string, string> {
    const out = new Map<string, string>();
    if (paths.length === 0) return out;
    const r = spawnSync('git', ['-C', root, 'cat-file', '--batch'], {
        input: paths.map((p) => `${ref}:${p}`).join('\n') + '\n',
        maxBuffer: 512 * 1024 * 1024,
    });
    if (r.status !== 0) throw new Error(`git cat-file failed: ${String(r.stderr)}`);
    const buf = r.stdout;
    let at = 0;
    for (const p of paths) {
        const nl = buf.indexOf(0x0a, at);
        const header = buf.subarray(at, nl).toString('utf8');
        at = nl + 1;
        const m = /^[0-9a-f]+ (\w+) (\d+)$/.exec(header);
        if (m === null) continue; // missing
        const size = Number(m[2]);
        if (m[1] === 'blob') out.set(p, buf.subarray(at, at + size).toString('utf8'));
        at += size + 1;
    }
    return out;
}

export interface Corpus {
    readonly ref: string;
    readonly digest: string;
    readonly items: Record<MeasuredKind, CorpusItem[]>;
    readonly inconsistencies: Inconsistency[];
}

export interface BuildCorpusOptions {
    readonly ref?: string;
    readonly perKind?: number;
    readonly linking?: readonly LinkingIdentifier[];
}

/** Draw from the shuffled candidates in batches until `need` survive the payload filter. */
function draw(
    root: string,
    ref: string,
    shuffled: readonly string[],
    need: number,
    make: (path: string, content: string) => CorpusItem | null,
): { items: CorpusItem[]; contents: Map<string, string> } {
    const items: CorpusItem[] = [];
    const contents = new Map<string, string>();
    for (let at = 0; at < shuffled.length && items.length < need; at += need) {
        const batch = shuffled.slice(at, at + need);
        const blobs = readBlobs(root, ref, batch);
        for (const p of batch) {
            if (items.length >= need) break;
            const c = blobs.get(p);
            if (c === undefined) continue;
            const item = make(p, c);
            if (item === null) continue;
            items.push(item);
            contents.set(p, c);
        }
    }
    return { items, contents };
}

export function buildCorpus(root: string, opts: BuildCorpusOptions = {}): Corpus {
    const ref = opts.ref ?? corpusRef(root);
    const perKind = opts.perKind ?? PER_KIND;
    const linking = opts.linking ?? [];
    const tree = listTree(root, ref);
    const inconsistencies: Inconsistency[] = [];

    const perLabel = Math.ceil(perKind / CLASSIFY_LABELS.length);
    const classify: CorpusItem[] = [];
    for (const label of CLASSIFY_LABELS) {
        const candidates = seededShuffle(tree.filter((p) => labelOfPath(p) === label), SEED, (p) => p);
        const { items, contents } = draw(root, ref, candidates, perLabel, (p, c) => {
            const spec = classifySpec(p, c);
            return survivesPayload('classify', spec, `File path: ${p}`, linking)
                ? { id: `classify:${p}`, kind: 'classify', path: p, truth: label, spec }
                : null;
        });
        for (const it of items) {
            const why = inconsistencyOf(it.path, label, contents.get(it.path) ?? '');
            if (why !== null) inconsistencies.push({ path: it.path, label, reason: why });
        }
        classify.push(...items);
    }
    const classifyItems = seededShuffle(classify, SEED, (i) => i.id).slice(0, perKind);

    const extractCandidates = seededShuffle(tree.filter((p) => EXTRACT_POPULATION.test(p)), SEED, (p) => p);
    const { items: extractItems, contents: extractContents } = draw(root, ref, extractCandidates, perKind, (p, c) => {
        const name = frontmatterOf(c).fields['name'];
        if (name === undefined || name === '') return null;
        const spec = extractSpec(c);
        return survivesPayload('extract', spec, name, linking) ? { id: `extract:${p}`, kind: 'extract', path: p, truth: name, spec } : null;
    });
    for (const it of extractItems) {
        const label = labelOfPath(it.path);
        if (label === null || classifyItems.some((c) => c.path === it.path)) continue;
        const why = inconsistencyOf(it.path, label, extractContents.get(it.path) ?? '');
        if (why !== null) inconsistencies.push({ path: it.path, label, reason: why });
    }

    const items = { classify: classifyItems, extract: extractItems };
    const digest = createHash('sha256')
        .update(JSON.stringify([ref, items.classify.map((i) => [i.id, i.truth]), items.extract.map((i) => [i.id, i.truth])]))
        .digest('hex')
        .slice(0, 16);
    return { ref, digest, items, inconsistencies };
}
