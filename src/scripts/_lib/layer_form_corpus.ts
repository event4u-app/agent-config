/**
 * The comparison set Phase 5 of `road-to-a-setup-that-decides-itself` reads —
 * step 0.2, "corpus by reuse".
 *
 * WHY A MANIFEST AND NOT A NEW CORPUS. The step forbids authoring one: every
 * arm must name an artefact the tree already carries, so that the comparison
 * measures the package's own cases rather than cases written to be passed. The
 * manifest in `src/config/layer-form-comparison-corpus.json` is therefore a
 * list of resolvers over existing files, and this module is the one reader of
 * it.
 *
 * ABSENT IS A STATE, NOT A GAP TO FILL WITH SOMETHING NEARBY. Two of the four
 * sources the step names do not exist: there is no `host-graded` case set in
 * this tree, and `tests/conformance/` carries a retrieval-envelope validator
 * rather than adjudicated cases. Each is recorded `absent` with its reason and
 * the condition that reopens it. Substituting the nearest measurable set would
 * make the comparison read as if it covered an axis it never touched, which is
 * the one failure the step's own text rules out.
 *
 * THE SEAL IS KEPT BY REFUSAL. The trigger-corpus arm goes through
 * `loadTrainCases`, which decides the partition from the skill DIRECTORY NAME
 * and never opens a holdout `evals/triggers.json`. This module adds no second
 * path to that corpus, so there is nothing here that could reach a sealed file;
 * `tests/scripts/layer_form_corpus.test.ts` asserts it over the real reads,
 * with a control that a train corpus was opened at all.
 *
 * Pure of network and of clock; reads files and nothing else.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { readConsequenceClass } from './rule_consequence_class.js';
import { loadTrainCases } from './routing_corpus.js';

export const COMPARISON_CORPUS_REL = path.join('src', 'config', 'layer-form-comparison-corpus.json');

/** A source the tree carries, with the resolver that counts its cases. */
export interface PresentSource {
    readonly id: string;
    readonly state: 'present';
    readonly resolver: string;
    readonly path: string;
    readonly what: string;
}

/** A source the step names that the tree does not carry. */
export interface AbsentSource {
    readonly id: string;
    readonly state: 'absent';
    readonly why: string;
    readonly reopens_when: string;
}

export type ManifestSource = PresentSource | AbsentSource;

export interface ComparisonManifest {
    readonly schema_version: number;
    readonly sources: readonly ManifestSource[];
}

/** One resolved source: the manifest row plus the cases it resolved to. */
export type ResolvedSource = ManifestSource & { readonly cases: number };

export interface ComparisonCorpus {
    readonly sources: readonly ResolvedSource[];
    /** Cases across every present source. Absent sources contribute nothing. */
    readonly total: number;
}

/** Raised when the manifest is missing or is not the shape this module reads. */
export class ComparisonManifestError extends Error {}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The committed manifest. A malformed one throws rather than resolving to fewer sources. */
export function readComparisonManifest(repoRoot: string): ComparisonManifest {
    const file = path.join(repoRoot, COMPARISON_CORPUS_REL);
    let raw: unknown;
    try {
        raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (cause) {
        throw new ComparisonManifestError(`${COMPARISON_CORPUS_REL} is missing or unparseable`, { cause });
    }
    if (!isRecord(raw) || !Array.isArray(raw['sources'])) {
        throw new ComparisonManifestError(`${COMPARISON_CORPUS_REL} carries no \`sources\` array`);
    }
    const sources: ManifestSource[] = [];
    for (const entry of raw['sources'] as unknown[]) {
        if (!isRecord(entry) || typeof entry['id'] !== 'string') {
            throw new ComparisonManifestError(`${COMPARISON_CORPUS_REL} carries a source with no \`id\``);
        }
        const id = entry['id'];
        if (entry['state'] === 'present') {
            if (typeof entry['resolver'] !== 'string' || typeof entry['path'] !== 'string' || typeof entry['what'] !== 'string') {
                throw new ComparisonManifestError(`present source \`${id}\` is missing \`resolver\`, \`path\` or \`what\``);
            }
            sources.push({ id, state: 'present', resolver: entry['resolver'], path: entry['path'], what: entry['what'] });
            continue;
        }
        if (entry['state'] === 'absent') {
            if (typeof entry['why'] !== 'string' || typeof entry['reopens_when'] !== 'string') {
                throw new ComparisonManifestError(`absent source \`${id}\` is missing \`why\` or \`reopens_when\``);
            }
            sources.push({ id, state: 'absent', why: entry['why'], reopens_when: entry['reopens_when'] });
            continue;
        }
        throw new ComparisonManifestError(`source \`${id}\` carries no \`state\` of \`present\` or \`absent\``);
    }
    return { schema_version: typeof raw['schema_version'] === 'number' ? raw['schema_version'] : 0, sources };
}

/** The ids the manifest records as absent, so a reader of a result can name them. */
export function absentSources(manifest: ComparisonManifest): string[] {
    return manifest.sources.filter((s) => s.state === 'absent').map((s) => s.id);
}

/** Prompts and near-misses in the per-rule routing matrix. */
function countRoutingMatrix(dir: string): number {
    if (!fs.existsSync(dir)) return 0;
    let n = 0;
    for (const name of fs.readdirSync(dir).sort()) {
        if (!name.endsWith('.yaml')) continue;
        // A case is one `- prompt:` row; the matrix is flat YAML with no nested prompts.
        for (const line of fs.readFileSync(path.join(dir, name), 'utf8').split('\n')) {
            if (/^\s*-\s+prompt:/.test(line)) n += 1;
        }
    }
    return n;
}

/** Rules that must fire under every input: the consequence class plus the `safety-floor` tier. */
export function obligationRuleIds(repoRoot: string): Set<string> {
    const ids = new Set<string>(Object.keys(readConsequenceClass(repoRoot).members));
    const dir = path.join(repoRoot, 'src', 'rules');
    if (!fs.existsSync(dir)) return ids;
    for (const name of fs.readdirSync(dir).sort()) {
        if (!name.endsWith('.md')) continue;
        const text = fs.readFileSync(path.join(dir, name), 'utf8');
        const end = text.indexOf('\n---', 3);
        const head = text.startsWith('---') && end > 0 ? text.slice(0, end) : '';
        if (/^tier:\s*["']?safety-floor["']?\s*$/m.test(head)) ids.add(name.slice(0, -3));
    }
    return ids;
}

/** Every present source resolved to a case count, in manifest order. */
export function loadComparisonCorpus(repoRoot: string): ComparisonCorpus {
    const manifest = readComparisonManifest(repoRoot);
    const sources = manifest.sources.map((source): ResolvedSource => {
        if (source.state === 'absent') return { ...source, cases: 0 };
        switch (source.resolver) {
            case 'routing-matrix-yaml':
                return { ...source, cases: countRoutingMatrix(path.join(repoRoot, source.path)) };
            case 'routing-corpus-train-slice':
                return { ...source, cases: loadTrainCases(repoRoot).length };
            case 'obligation-class':
                return { ...source, cases: obligationRuleIds(repoRoot).size };
            default:
                throw new ComparisonManifestError(`source \`${source.id}\` names resolver \`${source.resolver}\`, which this module does not carry`);
        }
    });
    return { sources, total: sources.reduce((sum, s) => sum + s.cases, 0) };
}
