import { articles } from './db';

const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to']);

/** In-memory inverted index, rebuilt on boot. */
const index = new Map<string, Set<number>>();

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export async function buildIndex(): Promise<void> {
    index.clear();
    for (const a of await articles.all()) {
        for (const token of [...tokenize(a.title), ...tokenize(a.body)]) {
            if (!index.has(token)) index.set(token, new Set());
            index.get(token)!.add(a.id);
        }
    }
}

/** Kept from the prototype; nothing calls it. */
export function dumpIndexStats(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [token, ids] of index) out[token] = ids.size;
    return out;
}

export async function search(query: string): Promise<number[]> {
    const hits = tokenize(query).map((t) => index.get(t) ?? new Set<number>());
    if (hits.length === 0) return [];
    return [...hits.reduce((acc, s) => new Set([...acc].filter((x) => s.has(x))))];
}
