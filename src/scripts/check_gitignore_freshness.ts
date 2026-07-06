#!/usr/bin/env tsx
/**
 * CI gate: every `policy: ignored` entry in `src/config/agents-paths.yml`
 * that applies to consumer or both scopes must be present in
 * `src/config/gitignore-block.txt`.
 *
 * This is a read-only freshness check — it does NOT generate either file.
 * Full generation (Phase 3.2/3.3 of road-to-agents-dir-and-gitignore-hygiene)
 * is a future enhancement; this check prevents silent drift in the meantime.
 *
 * Exit codes:
 *   0 — all consumer-scoped ignored paths are covered in the block
 *   1 — one or more paths are missing from the block
 *   2 — invalid args or missing file
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.join(path.dirname(_HERE), '..', '..');

const MANIFEST = path.join(REPO_ROOT, 'src', 'config', 'agents-paths.yml');
const BLOCK = path.join(REPO_ROOT, 'src', 'config', 'gitignore-block.txt');

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/**
 * Minimal YAML parser for the agents-paths.yml structure:
 * list of objects with `path`, `scope`, `policy` keys.
 * Handles the literal string list entries (- key: value form).
 */
function parseManifest(text: string): Array<{ path: string; scope: string; policy: string }> {
    const entries: Array<{ path: string; scope: string; policy: string }> = [];
    const lines = text.split('\n');
    let cur: Record<string, string> | null = null;

    for (const raw of lines) {
        const line = raw.trimEnd();
        // New list item starts with "- path:"
        if (/^- path:/.test(line)) {
            if (cur && cur['path'] && cur['scope'] && cur['policy']) {
                entries.push({ path: cur['path'], scope: cur['scope'], policy: cur['policy'] });
            }
            cur = {};
            const m = line.match(/^- path:\s*(.+)/);
            if (m?.[1] !== undefined) cur['path'] = m[1].trim().replace(/^"|"$/g, '');
        } else if (cur && /^\s+scope:/.test(line)) {
            const m = line.match(/scope:\s*(.+)/);
            if (m?.[1] !== undefined) cur['scope'] = m[1].trim();
        } else if (cur && /^\s+policy:/.test(line)) {
            const m = line.match(/policy:\s*(.+)/);
            if (m?.[1] !== undefined) cur['policy'] = m[1].trim();
        }
    }
    if (cur && cur['path'] && cur['scope'] && cur['policy']) {
        entries.push({ path: cur['path'], scope: cur['scope'], policy: cur['policy'] });
    }
    return entries;
}

function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    const quiet = args.includes('--quiet');

    if (!_isFile(MANIFEST)) {
        process.stdout.write(`❌  Manifest not found: ${MANIFEST}\n`);
        return 2;
    }
    if (!_isFile(BLOCK)) {
        process.stdout.write(`❌  Consumer block not found: ${BLOCK}\n`);
        return 2;
    }

    const manifestText = fs.readFileSync(MANIFEST, 'utf-8');
    const blockText = fs.readFileSync(BLOCK, 'utf-8');
    const blockLines = new Set(blockText.split('\n').map((l) => l.trim()).filter(Boolean));

    const entries = parseManifest(manifestText);
    const missing: string[] = [];

    for (const e of entries) {
        if (e.policy !== 'ignored') continue;
        if (e.scope !== 'consumer' && e.scope !== 'both') continue;
        // Carve-out negations (path starts with !) are separately tracked
        if (e.path.startsWith('!')) continue;
        if (!blockLines.has(e.path)) {
            missing.push(e.path);
        }
    }

    if (missing.length > 0) {
        process.stdout.write(
            `❌  gitignore-block.txt is missing consumer-scoped ignored paths from agents-paths.yml:\n\n`,
        );
        for (const m of missing) {
            process.stdout.write(`  - ${m}\n`);
        }
        process.stdout.write(
            `\nAdd these patterns to src/config/gitignore-block.txt ` +
                `(or update agents-paths.yml if the scope/policy is wrong).\n`,
        );
        return 1;
    }

    if (!quiet) {
        process.stdout.write(
            `✅  gitignore-block.txt covers all ${entries.filter((e) => e.policy === 'ignored' && (e.scope === 'consumer' || e.scope === 'both')).length} consumer-scoped ignored paths.\n`,
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { main };
