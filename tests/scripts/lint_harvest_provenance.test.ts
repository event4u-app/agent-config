// Tests for src/scripts/lint_harvest_provenance.ts — the knowledge-side
// sibling of lint_provenance.ts.
//
// Two layers, same shape as the borrows-ledger test it mirrors:
//   1. Pure-function fixtures (no git, no CLI spawn) — schema validation,
//      pinning, uniqueness, dead rows, and orphan citations, each against a
//      temp-dir repoRoot so the path-exists checks resolve against something
//      real.
//   2. A CLI-level smoke test against the REAL repo ledger (spawns tsx),
//      proving the empty ledger passes end-to-end AND that the green line says
//      it scanned nothing — a gate that cannot distinguish "nothing to check"
//      from "everything checked" is the failure this assertion pins.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    collectCitations,
    collectPersonaSources,
    findOrphanCitations,
    lintLedgerText,
    parseLedgerText,
    stripLineSuffix,
    validateRecord,
    type HarvestRecord,
} from '../../src/scripts/lint_harvest_provenance.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_harvest_provenance.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const VALID: HarvestRecord = {
    harvest_id: 'assertion-level-citation-registry',
    stated_in: 'provenance/README.md',
    source_ref: 'https://example.com/owner/repo@a1b2c3d4e5f6789',
    evidence_locator: 'sources/INDEX.md — idea|source|page columns',
    harvested_at: '2026-08-13',
    verdict: 'adapt',
};

const tempDirs: string[] = [];

/** A temp repo root carrying the files a fixture's `stated_in` must resolve to. */
function makeRepo(files: Record<string, string> = { 'provenance/README.md': '# ledger\n' }): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harvest-ledger-'));
    tempDirs.push(root);
    for (const [rel, body] of Object.entries(files)) {
        const full = path.join(root, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body, 'utf-8');
    }
    return root;
}

afterEach(() => {
    while (tempDirs.length > 0) {
        const d = tempDirs.pop() as string;
        fs.rmSync(d, { recursive: true, force: true });
    }
});

const jsonl = (...records: unknown[]): string => records.map((r) => JSON.stringify(r)).join('\n') + '\n';

describe('validateRecord — schema', () => {
    it('accepts a well-formed record', () => {
        expect(validateRecord(VALID, 1, makeRepo())).toEqual([]);
    });

    it.each([
        'harvest_id', 'stated_in', 'source_ref', 'evidence_locator', 'harvested_at', 'verdict',
    ])('rejects a record missing %s', (field) => {
        const rec: Record<string, unknown> = { ...VALID };
        delete rec[field];
        const findings = validateRecord(rec, 1, makeRepo());
        expect(findings.some((f) => f.rule === 'schema' && f.message.includes(`missing required field '${field}'`))).toBe(true);
    });

    it('rejects an unexpected field — the schema is closed', () => {
        const findings = validateRecord({ ...VALID, note: 'extra' }, 1, makeRepo());
        expect(findings.some((f) => f.rule === 'schema' && f.message.includes("unexpected field 'note'"))).toBe(true);
    });

    it('rejects a non-object record', () => {
        expect(validateRecord(['not', 'an', 'object'], 1, makeRepo())[0]?.message).toContain('not a JSON object');
    });

    it.each(['Not_Kebab', 'trailing-', 'UPPER', 'has space'])('rejects harvest_id %s', (id) => {
        const findings = validateRecord({ ...VALID, harvest_id: id }, 1, makeRepo());
        expect(findings.some((f) => f.message.includes('kebab-case slug'))).toBe(true);
    });

    it('rejects a non-calendar date', () => {
        const findings = validateRecord({ ...VALID, harvested_at: '2026-02-30' }, 1, makeRepo());
        expect(findings.some((f) => f.message.includes('ISO-8601 date'))).toBe(true);
    });

    it('rejects an empty evidence_locator — an unlocatable claim is not a citation', () => {
        const findings = validateRecord({ ...VALID, evidence_locator: '  ' }, 1, makeRepo());
        expect(findings.some((f) => f.message.includes('evidence_locator'))).toBe(true);
    });

    it.each(['reject', 'already', 'unclear', ''])('rejects verdict %s — only adopt/adapt cite an artefact', (v) => {
        const findings = validateRecord({ ...VALID, verdict: v }, 1, makeRepo());
        expect(findings.some((f) => f.message.includes("verdict must be 'adopt' or 'adapt'"))).toBe(true);
    });
});

describe('validateRecord — pinning', () => {
    it('accepts a revision-pinned URL', () => {
        expect(validateRecord(VALID, 1, makeRepo())).toEqual([]);
    });

    it.each(['opaque:ref-a', 'opaque:source_b.1', 'ENC1:aGVsbG8gd29ybGQ='])('accepts opaque ref %s', (ref) => {
        expect(validateRecord({ ...VALID, source_ref: ref }, 1, makeRepo())).toEqual([]);
    });

    it('rejects a bare URL with no revision — it cannot be re-verified', () => {
        const findings = validateRecord({ ...VALID, source_ref: 'https://example.com/owner/repo' }, 1, makeRepo());
        expect(findings.some((f) => f.rule === 'pinning')).toBe(true);
    });

    it('rejects a free-text source_ref', () => {
        const findings = validateRecord({ ...VALID, source_ref: 'that one blog post' }, 1, makeRepo());
        expect(findings.some((f) => f.rule === 'pinning')).toBe(true);
    });
});

describe('validateRecord — dead rows', () => {
    it('rejects a stated_in path that does not exist', () => {
        const findings = validateRecord({ ...VALID, stated_in: 'src/skills/gone/SKILL.md' }, 1, makeRepo());
        expect(findings.some((f) => f.rule === 'dead-row')).toBe(true);
    });

    it('rejects a stated_in path escaping the repo root', () => {
        const findings = validateRecord({ ...VALID, stated_in: '../outside.md' }, 1, makeRepo());
        expect(findings.some((f) => f.message.includes('escapes the repo root'))).toBe(true);
    });

    it('accepts a stated_in carrying a :line suffix', () => {
        expect(validateRecord({ ...VALID, stated_in: 'provenance/README.md:42' }, 1, makeRepo())).toEqual([]);
    });

    it('stripLineSuffix keeps a path without a suffix intact', () => {
        expect(stripLineSuffix('a/b.md')).toBe('a/b.md');
        expect(stripLineSuffix('a/b.md:12')).toBe('a/b.md');
    });
});

describe('lintLedgerText', () => {
    it('accepts an empty ledger — the day-one state', () => {
        const { records, findings } = lintLedgerText('', makeRepo());
        expect(records).toEqual([]);
        expect(findings).toEqual([]);
    });

    it('reports invalid JSON with its line number', () => {
        const { findings } = parseLedgerText('{"a":1}\nnot json\n');
        expect(findings[0]?.line).toBe(2);
        expect(findings[0]?.message).toContain('invalid JSON');
    });

    it('rejects a duplicate harvest_id', () => {
        const { records, findings } = lintLedgerText(jsonl(VALID, VALID), makeRepo());
        expect(records).toHaveLength(1);
        expect(findings.some((f) => f.rule === 'uniqueness')).toBe(true);
    });

    it('keeps distinct ids', () => {
        const other = { ...VALID, harvest_id: 'router-head-contract' };
        const { records, findings } = lintLedgerText(jsonl(VALID, other), makeRepo());
        expect(records).toHaveLength(2);
        expect(findings).toEqual([]);
    });
});

describe('citations', () => {
    it('finds a marker and resolves it against the ledger', () => {
        const root = makeRepo({
            'provenance/README.md': '# ledger\n',
            'src/skills/demo/SKILL.md': 'Adapted from an external reference. <!-- harvest:assertion-level-citation-registry -->\n',
        });
        const citations = collectCitations(root);
        expect(citations).toHaveLength(1);
        expect(citations[0]?.id).toBe('assertion-level-citation-registry');
        expect(findOrphanCitations(citations, [VALID])).toEqual([]);
    });

    it('flags a marker with no ledger row as an orphan', () => {
        const root = makeRepo({
            'provenance/README.md': '# ledger\n',
            'src/rules/demo.md': '<!-- harvest:never-recorded -->\n',
        });
        const orphans = findOrphanCitations(collectCitations(root), [VALID]);
        expect(orphans).toHaveLength(1);
        expect(orphans[0]?.rule).toBe('orphan-citation');
        expect(orphans[0]?.message).toContain('never-recorded');
    });

    it('finds every marker when one file carries several', () => {
        const root = makeRepo({
            'provenance/README.md': '# ledger\n',
            'src/rules/demo.md': '<!-- harvest:one -->\ntext\n<!-- harvest:two -->\n',
        });
        expect(collectCitations(root).map((c) => c.id).sort()).toEqual(['one', 'two']);
    });

    it('ignores non-markdown and unscanned roots', () => {
        const root = makeRepo({
            'provenance/README.md': '# ledger\n',
            'src/skills/demo/notes.txt': '<!-- harvest:in-a-txt -->\n',
            'docs/guide.md': '<!-- harvest:outside-the-roots -->\n',
        });
        expect(collectCitations(root)).toEqual([]);
    });
});

describe('persona sources — the three states', () => {
    const persona = (fm: string) => `---\nid: p\nrole: P\n${fm}---\n\n# P\n`;

    it('treats an ABSENT field as unscoped — no citation', () => {
        const root = makeRepo({
            'provenance/README.md': '# ledger\n',
            'src/agent-src/personas/p.md': persona(''),
        });
        expect(collectPersonaSources(root)).toEqual([]);
    });

    it('treats an EMPTY list as a declaration, not a citation', () => {
        const root = makeRepo({
            'provenance/README.md': '# ledger\n',
            'src/agent-src/personas/p.md': persona('sources: []\n'),
        });
        expect(collectPersonaSources(root)).toEqual([]);
    });

    it('collects a non-empty inline list', () => {
        const root = makeRepo({
            'provenance/README.md': '# ledger\n',
            'src/agent-src/personas/p.md': persona('sources: [router-head-contract, cite-or-label]\n'),
        });
        expect(collectPersonaSources(root).map((c) => c.id)).toEqual(['router-head-contract', 'cite-or-label']);
    });

    it('collects a non-empty block list', () => {
        const root = makeRepo({
            'provenance/README.md': '# ledger\n',
            'src/agent-src/personas/p.md': persona('sources:\n  - router-head-contract\n  - cite-or-label\n'),
        });
        expect(collectPersonaSources(root).map((c) => c.id)).toEqual(['router-head-contract', 'cite-or-label']);
    });

    it('flags a declared id with no ledger row', () => {
        const root = makeRepo({
            'provenance/README.md': '# ledger\n',
            'src/agent-src/personas/p.md': persona('sources: [never-recorded]\n'),
        });
        const orphans = findOrphanCitations(collectPersonaSources(root), [VALID]);
        expect(orphans).toHaveLength(1);
        expect(orphans[0]?.message).toContain('never-recorded');
    });

    it('does not confuse the singular `source` field with `sources`', () => {
        const root = makeRepo({
            'provenance/README.md': '# ledger\n',
            'src/agent-src/personas/p.md': persona('source: package\n'),
        });
        expect(collectPersonaSources(root)).toEqual([]);
    });

    it('stays silent on a persona whose frontmatter is otherwise malformed', () => {
        // validate_frontmatter owns that finding; two gates reporting one defect
        // with two different messages is worse than one reporting it once.
        const root = makeRepo({
            'provenance/README.md': '# ledger\n',
            'src/agent-src/personas/p.md': '---\nid: p\n  broken: [unclosed\n---\n\n# P\n',
        });
        expect(() => collectPersonaSources(root)).not.toThrow();
    });
});

describe('marker placeholder — documentation must not cite', () => {
    it('does not match the angle-bracket placeholder used in prose', () => {
        const root = makeRepo({
            'provenance/README.md': '# ledger\n',
            'src/rules/demo.md': 'Write the marker as <!-- harvest:<id> --> when explaining it.\n',
        });
        // The gate found this on its first real run: prose spelling the marker
        // out literally reads as a citation. The placeholder is the fix, so it
        // is pinned rather than left to convention.
        expect(collectCitations(root)).toEqual([]);
    });
});

describe('CLI smoke — the real repo ledger', () => {
    const run = (args: string[] = []) =>
        spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf-8' });

    it('exits 0 on the real (empty) ledger', () => {
        const res = run();
        expect(res.status).toBe(0);
    });

    it('names what it scanned on the green path, including the zero case', () => {
        const res = run();
        // The whole point: a green line that does not distinguish "nothing to
        // check" from "everything checked" hides a broken gate.
        expect(res.stdout).toMatch(/ledger row\(s\) OK/);
        expect(res.stdout).toMatch(/citation\(s\) resolved across \d+ scanned root\(s\)/);
    });

    it('exits 2 on an unrecognized argument', () => {
        const res = run(['--nope']);
        expect(res.status).toBe(2);
    });

    it('--quiet suppresses the green line but keeps the exit code', () => {
        const res = run(['--quiet']);
        expect(res.status).toBe(0);
        expect(res.stdout.trim()).toBe('');
    });
});
