#!/usr/bin/env tsx
/**
 * Profile → persona id resolution gate.
 *
 * ## The defect this catches
 *
 * Every seed profile under `src/agent-src/profiles/*.yml` pre-selects persona
 * ids in `defaults.personas`. Persona ids are the filenames under
 * `src/agent-src/personas/` (plus `personas/advisors/`), and nothing else
 * historically checked the join — all six seed profiles shipped ids
 * (`reviewer`, `security`, `editor`, …) that resolved to no persona file at
 * all, so the pre-selection was silently dead. This gate makes a broken id a
 * CI failure with a nearest-match hint.
 *
 * Contract (src/config/gate-coverage.yml): emits exactly one `scanned: <N>`
 * line, N = profiles scanned.
 *
 * Exit: 0 clean · 1 usage/IO error · 2 findings.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export interface Finding {
    file: string;
    id: string;
    hint: string;
}

/** Persona ids = `.md` basenames under personas/ and personas/advisors/. */
export function known_persona_ids(repoRoot: string): Set<string> {
    const ids = new Set<string>();
    const roots = [
        path.join(repoRoot, 'src', 'agent-src', 'personas'),
        path.join(repoRoot, 'src', 'agent-src', 'personas', 'advisors'),
    ];
    for (const dir of roots) {
        if (!fs.existsSync(dir)) continue;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
            if (entry.name === 'README.md') continue;
            ids.add(entry.name.slice(0, -'.md'.length));
        }
    }
    return ids;
}

function levenshtein(a: string, b: string): number {
    const prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let diag = prev[0]!;
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const cur = prev[j]!;
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            prev[j] = Math.min(cur + 1, prev[j - 1]! + 1, diag + cost);
            diag = cur;
        }
    }
    return prev[b.length]!;
}

/** Closest known id by substring containment first, edit distance second. */
export function nearest_match(id: string, known: ReadonlySet<string>): string {
    let best = '';
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of known) {
        const contains = candidate.includes(id) || id.includes(candidate);
        const score = levenshtein(id, candidate) - (contains ? 100 : 0);
        if (score < bestScore) {
            bestScore = score;
            best = candidate;
        }
    }
    return best;
}

/**
 * Scan every `profiles/*.yml` under `repoRoot`'s profile dir and resolve
 * `defaults.personas` against the known persona ids.
 */
export function scan_profiles(repoRoot: string): { findings: Finding[]; scanned: number } {
    const profileDir = path.join(repoRoot, 'src', 'agent-src', 'profiles');
    if (!fs.existsSync(profileDir)) {
        throw new Error(`profile directory not found: ${profileDir}`);
    }
    const known = known_persona_ids(repoRoot);
    const findings: Finding[] = [];
    let scanned = 0;
    const files = fs
        .readdirSync(profileDir)
        .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
        .sort();
    for (const file of files) {
        const full = path.join(profileDir, file);
        const rel = path.relative(repoRoot, full);
        const parsed = parseYaml(fs.readFileSync(full, 'utf-8')) as Record<string, unknown> | null;
        scanned += 1;
        const profile = (parsed?.['profile'] ?? {}) as Record<string, unknown>;
        const defaults = (profile['defaults'] ?? {}) as Record<string, unknown>;
        const personas = defaults['personas'];
        if (!Array.isArray(personas)) continue;
        for (const raw of personas) {
            const id = String(raw);
            if (known.has(id)) continue;
            const hint = known.size > 0 ? `did you mean \`${nearest_match(id, known)}\`?` : 'no personas found';
            findings.push({ file: rel, id, hint });
        }
    }
    return { findings, scanned };
}

export function main(argv?: readonly string[]): number {
    let quiet = false;
    for (const arg of argv ?? process.argv.slice(2)) {
        if (arg === '--quiet') {
            quiet = true;
        } else {
            process.stderr.write(`usage: lint_profile_personas [--quiet]\n`);
            return 1;
        }
    }

    let result: { findings: Finding[]; scanned: number };
    try {
        result = scan_profiles(REPO_ROOT);
    } catch (e) {
        process.stderr.write(`error: ${String(e)}\n`);
        return 1;
    }

    for (const f of result.findings) {
        process.stdout.write(
            `❌  ${f.file}  defaults.personas id \`${f.id}\` resolves to no file under src/agent-src/personas/ — ${f.hint}\n`,
        );
    }
    if (result.findings.length === 0 && !quiet) {
        process.stdout.write(
            `✅  profile personas: every defaults.personas id resolves to a persona file\n`,
        );
    }
    // gate-coverage contract (src/config/gate-coverage.yml): profiles inspected.
    process.stdout.write(`scanned: ${String(result.scanned)}\n`);
    return result.findings.length > 0 ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}
