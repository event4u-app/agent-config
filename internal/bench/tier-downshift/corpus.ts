/**
 * The tier bench's corpus, computed from one tree. Every answer is a function of
 * the bytes under `root`, so a corpus regenerated from the same pinned archive is
 * byte-identical and the bench self-test can prove it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Slice {
    id: string;
    question: string;
    answer: string;
}

export const CORPUS_DIRS = ['src/scripts/hooks', 'src/scripts/_lib', 'src/scripts/ai_council', 'src/shared', 'src/server/schemas'] as const;

function listTs(root: string, dir: string): string[] {
    return fs
        .readdirSync(path.join(root, dir), { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.ts'))
        .map((e) => e.name)
        .sort();
}

export function generateCorpus(root: string): Slice[] {
    const slices: Slice[] = [];
    for (const d of CORPUS_DIRS) {
        if (!fs.existsSync(path.join(root, d))) continue;
        slices.push({
            id: `count-ts-${d}`,
            question: `How many files ending in .ts are directly inside ${d} (not in subdirectories)? Answer with the number only.`,
            answer: String(listTs(root, d).length),
        });
    }
    const libDir = path.join(root, 'src/scripts/_lib');
    if (!fs.existsSync(libDir)) return slices;
    const lib = listTs(root, 'src/scripts/_lib');
    const libText = new Map(lib.map((f) => [f, fs.readFileSync(path.join(libDir, f), 'utf8')]));
    for (const f of lib) {
        if (slices.length >= 40) break;
        const m = libText.get(f)!.match(/^export function ([A-Za-z_][A-Za-z0-9_]{5,})\(/m);
        if (!m) continue;
        const name = m[1]!;
        const owners = lib.filter((g) => new RegExp(`^export function ${name}\\(`, 'm').test(libText.get(g)!));
        if (owners.length !== 1) continue;
        slices.push({
            id: `owner-${name}`,
            question: `Which file in src/scripts/_lib declares \`export function ${name}(\`? Answer with the file name only (for example foo.ts).`,
            answer: f,
        });
    }
    const hooksDir = path.join(root, 'src/scripts/hooks');
    if (!fs.existsSync(hooksDir)) return slices.slice(0, 60);
    for (const f of listTs(root, 'src/scripts/hooks')) {
        if (slices.length >= 60) break;
        const n = fs
            .readFileSync(path.join(hooksDir, f), 'utf8')
            .split('\n')
            .filter((l) => l.startsWith('import ')).length;
        if (n < 2) continue;
        slices.push({
            id: `imports-${f}`,
            question: `How many lines of src/scripts/hooks/${f} start with the word "import " at column 0? Answer with the number only.`,
            answer: String(n),
        });
    }
    return slices.slice(0, 60);
}
