#!/usr/bin/env tsx
/**
 * lint_originality_shingles — mechanical re-skin detector for the artifact
 * corpus (road-to-opt-subagent-harvest P1.3).
 *
 * Compares every pair of skills / personas / subagents by entity-neutralized
 * 8-word shingle overlap. Two artifacts that differ only in the named
 * framework, product, or persona ("re-skins") share almost all shingles once
 * entities are masked — exactly the near-duplicate class a human review
 * misses at 200+ files. Slots beside `persona-governance` / `skill-quality`.
 *
 * Sibling of `lint_skill_originality` (ADR-096), NOT a replacement: that
 * gate runs bag-of-words Jaccard over SKILLS with pack-domain severity;
 * this one masks entities and compares 8-word PHRASES across skills +
 * personas + subagents — the re-skin that only swaps "Laravel" for
 * "Django" scores LOW on plain token-Jaccard (different entity tokens)
 * and HIGH here. Run both.
 *
 * Modes:
 *   default             report-only — prints the top overlapping pairs,
 *                       always exits 0 (first-run calibration mode).
 *   --threshold <pct>   exits 1 when any pair's overlap (Jaccard, %) is
 *                       >= pct and the pair is not allowlisted below.
 *   --top <n>           rows to print (default 15).
 *   --quiet             suppress the report (threshold mode still fails).
 *
 * Known-legitimate pairs (shared scaffolding, sibling carve-outs) are
 * allowlisted inline with reasons — same >20-entries policy as every other
 * allowlist in this repo.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(_HERE, '..', '..');

const SHINGLE_LEN = 8;

/** Entity mask — named stacks/products/personas collapse to one token so a
 *  re-skin that only swaps the entity still matches. Lowercase input. */
const ENTITY_RE = new RegExp(
    '\\b(laravel|symfony|django|rails|react|vue|angular|nextjs|next\\.js|nuxt|' +
        'nestjs|express|fastify|flask|fastapi|spring|eloquent|doctrine|prisma|' +
        'pest|phpunit|jest|vitest|pytest|phpstan|rector|ecs|prettier|eslint|' +
        'mypy|tsc|php|python|typescript|javascript|node|go|rust|ruby|java|' +
        'tailwind|blade|livewire|flux|jira|sentry|grafana|terraform|terragrunt|' +
        'traefik|docker|aws|stripe|openai|anthropic|claude|gemini|gpt)\\b',
    'g',
);

interface Doc {
    id: string;
    shingles: Set<string>;
}

interface AllowPair {
    a: string;
    b: string;
    reason: string;
}

/** Sibling artifacts that legitimately share scaffolding. Keep < 20. */
const ALLOWLIST: AllowPair[] = [
    // Populated from calibration runs; empty on first ship — the default
    // mode is report-only, so no entry is needed until a threshold is armed.
];

function _normalize(body: string): string[] {
    // strip fenced code, frontmatter, markdown syntax; mask entities.
    let text = body.replace(/^---\n[\s\S]*?\n---\n/, '');
    text = text.replace(/```[\s\S]*?```/g, ' ');
    text = text.toLowerCase();
    text = text.replace(ENTITY_RE, '§entity§');
    text = text.replace(/[^a-z0-9§]+/g, ' ');
    return text.split(' ').filter((w) => w.length > 0);
}

function _shingles(words: string[]): Set<string> {
    const out = new Set<string>();
    for (let i = 0; i + SHINGLE_LEN <= words.length; i++) {
        out.add(words.slice(i, i + SHINGLE_LEN).join(' '));
    }
    return out;
}

/** `read` counts every corpus file opened, `docs` only those long enough to
 *  compare — a corpus of stubs is a different problem from a corpus that is not
 *  there, and only the second one means the roots below have rotted. */
function _collect(): { docs: Doc[]; read: number } {
    const docs: Doc[] = [];
    let read = 0;
    const push = (id: string, file: string): void => {
        let body: string;
        try {
            body = fs.readFileSync(file, 'utf-8');
        } catch {
            return;
        }
        read += 1;
        const sh = _shingles(_normalize(body));
        if (sh.size >= 20) {
            docs.push({ id, shingles: sh });
        }
    };
    const skillsDir = path.join(REPO, 'src', 'skills');
    for (const d of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (d.isDirectory()) {
            push(`skill:${d.name}`, path.join(skillsDir, d.name, 'SKILL.md'));
        }
    }
    // `src/agent-src/personas`, not `src/personas` — the latter has never existed
    // since ADR-051 moved the container, so the `existsSync` guard below silently
    // dropped all 30 personas from a comparison whose own header promises to cover
    // them. Same dead-root class the rest of this roadmap repairs; it escaped the
    // class-A sweep only because the literal does not carry a retired-container
    // prefix (road-to-gates-that-can-fail Phase 1).
    const personasDir = path.join(REPO, 'src', 'agent-src', 'personas');
    if (fs.existsSync(personasDir)) {
        const walk = (dir: string, prefix: string): void => {
            for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, d.name);
                if (d.isDirectory() && !d.name.startsWith('_')) {
                    walk(full, prefix);
                } else if (d.isFile() && d.name.endsWith('.md') && d.name !== 'README.md') {
                    push(`persona:${path.basename(d.name, '.md')}`, full);
                }
            }
        };
        walk(personasDir, 'persona');
    }
    const subagentsDir = path.join(REPO, 'src', 'subagents');
    if (fs.existsSync(subagentsDir)) {
        for (const f of fs.readdirSync(subagentsDir)) {
            if (f.endsWith('.md') && !f.startsWith('_')) {
                push(`subagent:${path.basename(f, '.md')}`, path.join(subagentsDir, f));
            }
        }
    }
    return { docs, read };
}

function _jaccardPct(a: Set<string>, b: Set<string>): number {
    const [small, large] = a.size <= b.size ? [a, b] : [b, a];
    let inter = 0;
    for (const s of small) {
        if (large.has(s)) inter++;
    }
    const union = a.size + b.size - inter;
    return union === 0 ? 0 : (100 * inter) / union;
}

function _allowlisted(a: string, b: string): boolean {
    return ALLOWLIST.some(
        (p) => (p.a === a && p.b === b) || (p.a === b && p.b === a),
    );
}

export function main(argv: string[] = process.argv.slice(2)): number {
    let threshold: number | null = null;
    let top = 15;
    let quiet = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i] as string;
        if (arg === '--threshold') threshold = Number(argv[++i]);
        else if (arg === '--top') top = Number(argv[++i]);
        else if (arg === '--quiet') quiet = true;
    }

    const { docs, read } = _collect();
    // Two of the three roots are behind `existsSync` guards, which is exactly
    // how the personas root went missing for a whole release (see `_collect`).
    // Exit 1 is the only failure this gate has; report-only mode included, since
    // an empty corpus makes the report itself a false all-clear.
    try {
        assertScanned({
            gate: 'lint_originality_shingles',
            scanned: read,
            units: 'corpus file(s)',
            roots: ['src/skills', 'src/agent-src/personas', 'src/subagents'],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 1;
        }
        throw e;
    }
    const pairs: Array<{ a: string; b: string; pct: number }> = [];
    for (let i = 0; i < docs.length; i++) {
        for (let j = i + 1; j < docs.length; j++) {
            const pct = _jaccardPct((docs[i] as Doc).shingles, (docs[j] as Doc).shingles);
            if (pct > 0.5) {
                pairs.push({ a: (docs[i] as Doc).id, b: (docs[j] as Doc).id, pct });
            }
        }
    }
    pairs.sort((x, y) => y.pct - x.pct);

    if (!quiet) {
        process.stdout.write(
            `originality-shingles: ${docs.length} docs · ${SHINGLE_LEN}-word entity-masked shingles\n`,
        );
        for (const p of pairs.slice(0, top)) {
            process.stdout.write(`  ${p.pct.toFixed(1).padStart(5)}%  ${p.a}  ↔  ${p.b}\n`);
        }
        if (pairs.length === 0) {
            process.stdout.write('  no pair above 0.5% overlap\n');
        }
    }

    if (threshold !== null && Number.isFinite(threshold)) {
        const offenders = pairs.filter((p) => p.pct >= (threshold as number) && !_allowlisted(p.a, p.b));
        if (offenders.length > 0) {
            process.stderr.write(
                `❌  originality-shingles: ${offenders.length} pair(s) at or above ${threshold}% overlap:\n`,
            );
            for (const p of offenders.slice(0, top)) {
                process.stderr.write(`    ${p.pct.toFixed(1)}%  ${p.a} ↔ ${p.b}\n`);
            }
            return 1;
        }
    }
    return 0;
}

function _isCliEntry(): boolean {
    const a = process.argv[1];
    if (!a) return false;
    if (pathToFileURL(path.resolve(a)).href === import.meta.url) return true;
    try {
        return fs.realpathSync(a) === fs.realpathSync(fileURLToPath(import.meta.url));
    } catch {
        return false;
    }
}
if (_isCliEntry()) {
    process.exit(main());
}
