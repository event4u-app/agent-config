/**
 * One sentence for an empty answer: why the graph may not know, in a fixed
 * order — not indexed, partial parse, the index behind the working tree, a
 * language gap. A non-empty answer gets none, so its bytes do not change.
 *
 * The state words are the map freshness banner's (`map_viewer/area_agent.js`):
 * `edited` and `behind:N` both read "the index is behind the working tree".
 */
import * as path from 'node:path';

import type { GraphState } from './detect.js';
import { EXT_LANG, type Lang } from './types.js';

export type UncertaintyVerb = 'impact' | 'tests-for';

/** A sentence stays one line in any answer. */
export const UNCERTAINTY_MAX_CHARS = 140;

/**
 * What a verb cannot see in a language, as data. Each row is checked against
 * `isTestFile` by the test that pins this table, so a row that stops being
 * true fails there rather than misleading an agent.
 */
export const LANGUAGE_GAPS: Readonly<Partial<Record<Lang, Partial<Record<UncertaintyVerb, string>>>>> = {
    go: { 'tests-for': 'Go _test.go files outside a tests/ folder are not read as tests' },
    python: { 'tests-for': 'Python test_*.py files outside a tests/ folder are not read as tests' },
    java: { 'tests-for': 'Java *Test.java files outside a test/ folder are not read as tests' },
    csharp: { 'tests-for': 'C# *Tests.cs files outside a tests/ folder are not read as tests' },
    ruby: { 'tests-for': 'Ruby *_spec.rb files outside a tests/ folder are not read as tests' },
};

export interface UncertaintyInput {
    verb: UncertaintyVerb;
    /** Whether the answer is empty. A non-empty answer never gets a sentence. */
    empty: boolean;
    state: GraphState;
    not_indexed: readonly string[];
    partial: readonly string[];
    /** The files the question was about, for the language row. */
    files: readonly string[];
}

function named(files: readonly string[]): string {
    const first = files[0] ?? '';
    return files.length > 1 ? `${first} (+${files.length - 1})` : first;
}

function clip(s: string): string {
    return s.length <= UNCERTAINTY_MAX_CHARS ? s : `${s.slice(0, UNCERTAINTY_MAX_CHARS - 1)}…`;
}

export function uncertaintySentence(i: UncertaintyInput): string | null {
    if (!i.empty) return null;
    if (i.not_indexed.length) return clip(`empty, but ${named(i.not_indexed)} is in a language the graph does not index`);
    if (i.partial.length) return clip(`empty, but ${named(i.partial)} parsed with errors, so the graph may miss what it declares`);
    if (i.state === 'edited' || i.state.startsWith('behind:')) return clip(`empty, but the index is behind the working tree (${i.state})`);
    for (const f of i.files) {
        const lang = EXT_LANG[path.extname(f).toLowerCase()];
        const gap = lang ? LANGUAGE_GAPS[lang]?.[i.verb] : undefined;
        if (gap) return clip(`empty, but ${gap}`);
    }
    return null;
}
