#!/usr/bin/env tsx
/**
 * Lint subagent determinism — the ADR-109 guarantees the schema mini-validator
 * cannot express.
 *
 * `validate_frontmatter` (the schema gate) covers type / enum / required /
 * pattern, but its mini-validator ignores JSON-Schema `const` and `uniqueItems`.
 * This lint closes that gap for `src/subagents/*.md`:
 *
 *   1. `schema_version` MUST equal `subagent-v1` (schema `const`).
 *   2. `discovery.visible` MUST be exactly `false` — default-off (schema `const`).
 *   3. `tools` MUST have no duplicate entries (schema `uniqueItems`).
 *   4. `name` MUST match the filename stem (addressable-handle invariant).
 *   5. `name` MUST be globally unique across the subagent category
 *      (projection-path collision guard — two units would overwrite each other
 *      in `.claude/agents/`).
 *
 * Exit codes: 0 clean, 1 any violation.
 *
 * See ADR-109 (§ 6 determinism) and `src/scripts/schemas/subagent.schema.json`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse_frontmatter } from './validate_frontmatter.js';

const QUIET = process.argv.includes('--quiet');

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const SUBAGENT_DIR = path.join(REPO, 'src', 'subagents');

function _listSubagents(dir: string): string[] {
    if (!fs.existsSync(dir)) {
        return [];
    }
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .sort()
        .map((f) => path.join(dir, f));
}

function main(dir: string = SUBAGENT_DIR): number {
    const findings: string[] = [];
    const namesSeen = new Map<string, string>();

    for (const file of _listSubagents(dir)) {
        const rel = path.relative(REPO, file);
        const stem = path.basename(file, '.md');
        const text = fs.readFileSync(file, 'utf-8');
        const [data] = parse_frontmatter(text);
        if (data === null || typeof data !== 'object' || Array.isArray(data)) {
            findings.push(`${rel}: no parseable frontmatter`);
            continue;
        }
        const fm = data as Record<string, unknown>;

        if (fm.schema_version !== 'subagent-v1') {
            findings.push(`${rel}: schema_version must be 'subagent-v1' (got ${JSON.stringify(fm.schema_version)})`);
        }

        const discovery = fm.discovery;
        const visible =
            discovery !== null && typeof discovery === 'object' && !Array.isArray(discovery)
                ? (discovery as Record<string, unknown>).visible
                : undefined;
        if (visible !== false) {
            findings.push(`${rel}: discovery.visible must be exactly false (default-off; got ${JSON.stringify(visible)})`);
        }

        const tools = fm.tools;
        if (Array.isArray(tools)) {
            const seen = new Set<unknown>();
            const dupes = new Set<unknown>();
            for (const t of tools) {
                if (seen.has(t)) {
                    dupes.add(t);
                }
                seen.add(t);
            }
            if (dupes.size > 0) {
                findings.push(`${rel}: tools has duplicate entr(y/ies): ${[...dupes].map((d) => JSON.stringify(d)).join(', ')}`);
            }
        }

        const name = fm.name;
        if (typeof name !== 'string' || name !== stem) {
            findings.push(`${rel}: name must match the filename stem '${stem}' (got ${JSON.stringify(name)})`);
        } else {
            const prior = namesSeen.get(name);
            if (prior !== undefined) {
                findings.push(`${rel}: duplicate subagent name '${name}' (also in ${prior}) — projection-path collision`);
            } else {
                namesSeen.set(name, rel);
            }
        }
    }

    if (findings.length > 0) {
        process.stdout.write('❌ subagent determinism:\n');
        for (const f of findings.sort()) {
            process.stdout.write(`  - ${f}\n`);
        }
        return 1;
    }

    if (!QUIET) {
        process.stdout.write(
            `✅  subagent determinism: ${namesSeen.size} subagent(s) clean.\n`,
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry) {
    process.exit(main());
}

export { main };
