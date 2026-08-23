/**
 * frontend_corpus_hash — freeze and verify the frontend benchmark corpus.
 *
 * Step 0.2 of `road-to-frontend-power` registers a labelled frontend population
 * and requires its hash to be committed BEFORE any commit that moves the
 * detector engine. Risk 6 of that roadmap names the failure the hash guards
 * against: "One effort ships both the engine and the corpus that scores it."
 *
 * The hash is the weaker half of that mitigation and this header says so
 * plainly: it pins the population against LATER edits, so a number published
 * against `<digest>` cannot be re-scored on a quietly-different corpus. It says
 * nothing about who authored the corpus in the first place. The authorship
 * caveat — and the resulting rule that no detector row may be promoted to
 * `backed` against this population — lives in
 * `tests/eval/frontend-corpus/README.md` and is not restated here.
 *
 * Determinism: files are enumerated depth-first with a sorted directory walk,
 * paths are emitted POSIX-style relative to the corpus root, and content is
 * hashed as raw bytes. `CORPUS.sha256` itself is excluded, so `--write`
 * followed by `--check` is stable.
 *
 * Not a CI gate, deliberately. `tests/eval/frontend-corpus.test.ts` runs the
 * `--check` path, which is the enforcement surface; a fourth ratchet-tripping
 * gate script for a manifest one test can assert would cost more than it buys.
 *
 * Exit 0 = manifest matches (or was written). Exit 1 = drift.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
export const CORPUS_ROOT = path.join(REPO, 'tests', 'eval', 'frontend-corpus');
export const MANIFEST_NAME = 'CORPUS.sha256';
/** Subtrees carrying corpus content. Anything else at the root is prose. */
const CONTENT_DIRS = ['cases', 'near-miss'] as const;

/** Depth-first, sorted, POSIX-relative file list under `root`. */
export function walk(root: string, rel = ''): string[] {
    const abs = rel ? path.join(root, rel) : root;
    if (!fs.existsSync(abs)) return [];
    const out: string[] = [];
    for (const name of fs.readdirSync(abs).sort()) {
        const childRel = rel ? `${rel}/${name}` : name;
        if (fs.statSync(path.join(root, childRel)).isDirectory()) out.push(...walk(root, childRel));
        else if (childRel !== MANIFEST_NAME) out.push(childRel);
    }
    return out;
}

/**
 * Pure core: the manifest text for a set of (path, bytes) pairs. Pure so the
 * ordering guarantee is testable without a corpus on disk.
 */
export function manifestText(entries: ReadonlyArray<readonly [string, Buffer]>): string {
    const lines = entries.map(
        ([p, bytes]) => `${crypto.createHash('sha256').update(bytes).digest('hex')}  ${p}`,
    );
    const roll = crypto.createHash('sha256').update(lines.join('\n')).digest('hex');
    return [
        '# frontend benchmark corpus — sha256 manifest',
        '# Produced by src/scripts/frontend_corpus_hash.ts. Do not hand-edit.',
        `# files: ${lines.length}`,
        `# corpus: ${roll}`,
        ...lines,
        '',
    ].join('\n');
}

export function buildManifest(root: string = CORPUS_ROOT): string {
    const files = CONTENT_DIRS.flatMap((d) => walk(root, d));
    return manifestText(files.map((p) => [p, fs.readFileSync(path.join(root, p))] as const));
}

/** The rolling `# corpus:` digest — the value a published number cites. */
export function corpusDigest(text: string): string | null {
    return /^# corpus: ([0-9a-f]{64})$/m.exec(text)?.[1] ?? null;
}

function main(argv: readonly string[]): number {
    const manifestPath = path.join(CORPUS_ROOT, MANIFEST_NAME);
    const built = buildManifest();
    const digest = corpusDigest(built);

    if (argv.includes('--write')) {
        fs.writeFileSync(manifestPath, built);
        console.log(`✅  wrote ${MANIFEST_NAME} — corpus ${digest}`);
        return 0;
    }
    if (argv.includes('--check')) {
        if (!fs.existsSync(manifestPath)) {
            console.error(`❌  ${MANIFEST_NAME} is missing — run with --write`);
            return 1;
        }
        const onDisk = fs.readFileSync(manifestPath, 'utf8');
        if (onDisk !== built) {
            console.error(
                `❌  corpus drift — manifest says ${corpusDigest(onDisk)}, tree hashes to ${digest}.\n` +
                    '    A case changed without a rehash. Rerun with --write, and re-publish any\n' +
                    '    number that cited the old digest rather than carrying it over.',
            );
            return 1;
        }
        console.log(`✅  corpus matches manifest — ${digest}`);
        return 0;
    }
    process.stdout.write(built);
    return 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    process.exit(main(process.argv.slice(2)));
}
