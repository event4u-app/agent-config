import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    ANCHOR_WINDOW,
    type MarkerClass,
    REPO_ROOT,
    blockquoteMeta,
    bodyStart,
    detectMarkers,
    distribution,
    enumerateRecords,
    propose,
    proposeProvenance,
    proposeStrength,
    renderArtifact,
    runCensus,
    sectionOf,
} from '../../src/scripts/adr/evidence_census.js';

/**
 * The census is proposal-only, so its tests split into two halves that fail for
 * different reasons.
 *
 * The unit half pins the two absolute rules from `adr-layout § Provenance and
 * evidence` — a council marker never raises a grade above E0, and the defaults
 * are conservative — plus each named false positive the contract or the corpus
 * already produced once. Every one of those cases was checked RED against a
 * deliberately weakened detector before it was checked green; a heuristic test
 * that has only ever passed measures nothing about the heuristic.
 *
 * The corpus half is the accuracy check: it runs the real 185-record corpus and
 * asserts the bands for records whose evidence was read independently. It is
 * allowed to be a range (E2-or-E3) because the proposal is heuristic — what it
 * is NOT allowed to do is put a record with pre-registered benchmarks in the
 * same band as one with no numbers at all.
 */

const tmpdirs: string[] = [];

function tmpRoot(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-census-'));
    tmpdirs.push(dir);
    return dir;
}

afterEach(() => {
    while (tmpdirs.length > 0) {
        const dir = tmpdirs.pop();
        if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true });
    }
});

/** Classes present in a record's marker set. */
function classesIn(text: string): Set<MarkerClass> {
    return new Set(detectMarkers(text).map((m) => m.cls));
}

function fm(body: string, rest = ''): string {
    return `---\n${body}\n---\n\n# ADR-999 — x\n${rest}\n`;
}

// ---------------------------------------------------------------------------
// Rule 1 — a council marker alone never raises the grade above E0
// ---------------------------------------------------------------------------

describe('council consensus is not evidence', () => {
    it('grades a record whose only support is a two-seat council as E0', () => {
        const text = fm(
            'adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x',
            'Design converged via AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o).\nBoth seats were convergent.\n',
        );
        expect(classesIn(text).has('council')).toBe(true);
        const { strength, rationale } = proposeStrength(detectMarkers(text));
        expect(strength).toBe('E0');
        expect(rationale).toMatch(/consensus is not evidence/);
    });

    it('does not let council markers lift a grade that non-council markers set', () => {
        const withoutCouncil = fm(
            'adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x',
            'The sweep found 14 rules over budget.\n',
        );
        const withCouncil = fm(
            'adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x',
            'The sweep found 14 rules over budget.\nBoth seats were convergent; the AI council ruled it in.\n',
        );
        expect(proposeStrength(detectMarkers(withCouncil)).strength).toBe(
            proposeStrength(detectMarkers(withoutCouncil)).strength,
        );
    });

    it('never lets a council marker change the grade, for ANY starting marker set', () => {
        // The property, not one case: rule 1 is defeated the moment some future
        // branch keys on a council class, and a single council-only fixture
        // would not notice. This is the assertion that would.
        const bodies = [
            '',
            'see https://example.org/x',
            '125 commands overwhelms',
            'the cost-factor sweep measured 14 rules',
            'pre-registered arms in `internal/bench/layer/`',
            'per `docs/CLAIMS.md#x`',
            'PSR-12, the PHP-FIG standard',
        ];
        const councilText =
            '\nDesign converged via the AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o); both seats convergent.\n';
        for (const body of bodies) {
            const head = 'adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x';
            const bare = proposeStrength(detectMarkers(fm(head, `## Context\n\n${body}\n`))).strength;
            const withCouncil = proposeStrength(
                detectMarkers(fm(head, `## Context\n\n${body}\n${councilText}`)),
            ).strength;
            expect(withCouncil, `body: ${body || '(empty)'}`).toBe(bare);
        }
    });

    it('reports the council marker anyway — "agreement only" is a state, not an absence', () => {
        const text = fm('adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x', 'The AI council ruled.\n');
        const p = propose(detectMarkers(text));
        expect(p.provenance).toBe('agentic');
        expect(p.agenticMode).toBe('council');
        expect(p.strength).toBe('E0');
    });

    it('does not read a host name or a plugin path as a model id', () => {
        // Measured false positive: a bare `claude-[\w.-]+` matched `claude-code`,
        // `.claude-plugin/marketplace.json` and `claude-desktop.md`.
        for (const line of [
            'ships with the `claude-code` config and left `codex` as debt',
            'see [`.claude-plugin/marketplace.json`](../../.claude-plugin/marketplace.json)',
            'fixture `claude-code-rules-dir-contract.md`, host 2.1.226',
        ]) {
            const text = fm('adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x', line);
            expect(classesIn(text).has('council')).toBe(false);
        }
    });

    it('still reads a real model id as a council marker', () => {
        const text = fm(
            'adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x',
            'reviewed by claude-sonnet-4-5 and gpt-4o',
        );
        expect(classesIn(text).has('council')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Rule 2 — conservative defaults
// ---------------------------------------------------------------------------

describe('conservative defaults', () => {
    it('proposes unknown / E0 / incomplete for a record with no marker at all', () => {
        const text = fm('adr: 999\nstatus: accepted\ndate: 2026-06-03\ndecision: thin-command-principle');
        expect(propose(detectMarkers(text))).toMatchObject({
            provenance: 'unknown',
            agenticMode: null,
            strength: 'E0',
            discovery: 'incomplete',
        });
    });

    it('never emits `discovery: complete` — at any grade, for any record', () => {
        // The script has no code path for it: a marker grep is not the defined
        // exhaustive evidence search the contract requires before absence may
        // be asserted, so `complete` would be a claim it cannot make.
        const strong = fm(
            'adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x',
            'Pre-registered in `docs/CLAIMS.md#x`; benchmark at `internal/bench/x/`.\n',
        );
        expect(propose(detectMarkers(strong)).strength).toBe('E3');
        expect(propose(detectMarkers(strong)).discovery).toBe('incomplete');

        const result = runCensus(REPO_ROOT);
        expect(result.records.length).toBeGreaterThan(100);
        for (const r of result.records) expect(r.proposed.discovery).toBe('incomplete');
    });

    it('never proposes E4 anywhere in the corpus — a heuristic cannot establish an external constraint', () => {
        const dist = distribution(runCensus(REPO_ROOT));
        expect(dist.strength['E4']).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// The grade ladder
// ---------------------------------------------------------------------------

describe('proposeStrength', () => {
    const body = (rest: string): string =>
        fm('adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x', rest);

    it('E3 on a CLAIMS.md claim id', () => {
        expect(proposeStrength(detectMarkers(body('per `docs/CLAIMS.md#code-graph-retrieval-null`'))).strength).toBe('E3');
        expect(proposeStrength(detectMarkers(body('per `claims:code-graph-retrieval-null`'))).strength).toBe('E3');
    });

    it('E3 on a pre-registered benchmark', () => {
        expect(
            proposeStrength(detectMarkers(body('the pre-registered arms live in `internal/bench/layer/`'))).strength,
        ).toBe('E3');
    });

    it('E3 on a named external standard, E1 on a bare link', () => {
        expect(proposeStrength(detectMarkers(body('PSR-12, because it is the PHP-FIG standard'))).strength).toBe('E3');
        expect(proposeStrength(detectMarkers(body('see https://example.org/notes for background'))).strength).toBe('E1');
    });

    it('E2 on a repeated measurement, E0 when the repetition measures nothing', () => {
        expect(
            proposeStrength(detectMarkers(body('measured twice on this repository (PR #1277/#1280)'))).strength,
        ).toBe('E2');
        // "reproducible" with nothing quantified behind it is a word, not a
        // comparison — the contract's E2 row is a comparison OF something.
        expect(proposeStrength(detectMarkers(body('the approach is reproducible in principle'))).strength).toBe('E0');
    });

    it('E1 on a single quantified observation', () => {
        expect(proposeStrength(detectMarkers(body('125 commands overwhelms; ~29 commands buries features'))).strength).toBe(
            'E1',
        );
    });
});

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

describe('proposeProvenance', () => {
    it('reads an explicit owner decision as human', () => {
        const text = fm(
            'adr: 999\nstatus: accepted\ndate: 2026-08-05\ndecision: x',
            '## Status\n\n**Accepted.** Owner decision. The adoption arm is struck.\n',
        );
        expect(proposeProvenance(detectMarkers(text)).provenance).toBe('human');
    });

    it('does NOT read `maintainer` in a Consequences section as human — the contract names this false positive', () => {
        const text = fm(
            'adr: 999\nstatus: accepted\ndate: 2026-08-05\ndecision: x',
            '## Consequences\n\nThe maintainer decision to keep this is revisited annually.\n',
        );
        expect(classesIn(text).has('owner')).toBe(false);
        expect(proposeProvenance(detectMarkers(text)).provenance).toBe('unknown');
    });

    it('does NOT read `reopen_policy: owner` as human — venue is not authorship', () => {
        // `adr-layout`: "AN ADR'S HISTORICAL DECISION-MAKER DOES NOT DETERMINE
        // ITS REOPEN VENUE." Reading that backwards is the same conflation.
        const text = fm(
            'adr: 999\nstatus: accepted\ndate: 2026-08-05\ndecision: x\nreopen_policy: owner\nprotected_dimensions: [purpose]',
        );
        expect(proposeProvenance(detectMarkers(text)).provenance).toBe('unknown');
    });

    it('reads `authority_basis: owner_intent` as human — that IS a claim about the basis', () => {
        const text = fm('adr: 999\nstatus: accepted\ndate: 2026-08-05\ndecision: x\nauthority_basis: owner_intent');
        expect(proposeProvenance(detectMarkers(text)).provenance).toBe('human');
    });

    it('is mixed when a human premise meets a council mechanism', () => {
        const text = fm(
            'adr: 999\nstatus: accepted\ndate: 2026-08-05\ndecision: x',
            '## Status\n\nOwner decision on the premise; the AI council chose the mechanism.\n',
        );
        expect(proposeProvenance(detectMarkers(text))).toEqual({ provenance: 'mixed', agenticMode: 'council' });
    });
});

// ---------------------------------------------------------------------------
// Detection edges that the corpus produced
// ---------------------------------------------------------------------------

describe('detectMarkers edges', () => {
    it('does not read a frontmatter slug as a measurement', () => {
        // ADR-217's real slug. `\bmeasur` matches after the hyphen, and the
        // `date:` two lines up supplied the anchor, so the slug graded as a
        // dated observation. A slug names the decision; it reports nothing.
        const text = fm('adr: 217\nstatus: accepted\ndate: 2026-08-05\ndecision: rich-class-band-measured-and-enforced');
        expect(classesIn(text).has('measurement')).toBe(false);
        // …and the same words in the body ARE a measurement, so the assertion
        // above is about the frontmatter boundary and not about the regex.
        const inBody = fm(
            'adr: 217\nstatus: accepted\ndate: 2026-08-05\ndecision: x',
            '## Context\n\nThe band was measured against real tokenisation (2026-08-05).\n',
        );
        expect(classesIn(inBody).has('measurement')).toBe(true);
    });

    it('does not read a frontmatter `review_trigger` threshold as a measurement', () => {
        // ADR-227's real trigger carries "roughly 10 %". A trigger names the
        // condition that would REOPEN the decision — it is not evidence FOR it,
        // and grading it as such would let every well-written trigger buy an E1.
        const text = fm(
            'adr: 227\nstatus: accepted\ndate: 2026-08-13\ndecision: x\nreview_trigger: >-\n  reopen if such rules accumulate past roughly 10 % of the projected corpus',
        );
        expect(classesIn(text).has('measurement')).toBe(false);
    });

    it('reads a percentage even when it is followed by a space, a paren, or a bold marker', () => {
        // Regression: a trailing `\b` after `(?:%|pp)` made the percentage
        // pattern dead code — `%` is a non-word character, so the boundary
        // demanded a word character next, and a percentage is followed by a
        // space or a `)` essentially always. `450 ppm` must still not match.
        for (const line of ['roughly 10 % of the corpus', '(179.1 %)** on maintainer machines', 'a 12% lift', '10 pp of recall']) {
            const text = fm('adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x', `## Context\n\n${line}\n`);
            expect(classesIn(text).has('measurement'), line).toBe(true);
        }
        const ppm = fm('adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x', '## Context\n\nthe 450 ppm sensor\n');
        expect(classesIn(ppm).has('measurement')).toBe(false);
    });

    it('does not read a digit inside an identifier as a quantity', () => {
        // Measured: `Tier-3 host` and `P3.2 ADR` read as "3 host" / "2 ADR"
        // under a `\b`-anchored figure pattern, putting two records at E1 on a
        // tier label and a table cell.
        for (const line of [
            '| 4 | Degrade matrix | Tier-3 host, or tier-1 drive failure |',
            'Re-evaluate the swap as a P3.2 ADR after the router schema lands',
            'superseded by ADR-098 records the gate',
        ]) {
            const text = fm('adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x', `## Context\n\n${line}\n`);
            expect(classesIn(text).has('measurement'), line).toBe(false);
        }
        // A real quantity in the same shape still reads.
        const real = fm(
            'adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x',
            '## Context\n\nThe corpus holds 116 rules across 3 hosts.\n',
        );
        expect(classesIn(real).has('measurement')).toBe(true);
    });

    it('does not read a `phase:` slug as a comparison', () => {
        const text = fm('adr: 216\nstatus: accepted\ndate: 2026-08-05\ndecision: x\nphase: cost-factor sweep');
        expect(classesIn(text).has('repeated')).toBe(false);
        const inBody = fm(
            'adr: 216\nstatus: accepted\ndate: 2026-08-05\ndecision: x',
            '## Context\n\nThe cost-factor sweep established the ladder.\n',
        );
        expect(classesIn(inBody).has('repeated')).toBe(true);
    });

    it('reads a qualified sweep as a comparison and a corpus pass as not one', () => {
        const measured = fm('adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x', 'the cost-factor sweep established');
        const pass = fm('adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x', 'the package-wide consistency sweep found');
        expect(classesIn(measured).has('repeated')).toBe(true);
        expect(classesIn(pass).has('repeated')).toBe(false);
    });

    it('does not read `unmeasured` as a measurement', () => {
        const text = fm(
            'adr: 999\nstatus: accepted\ndate: 2026-06-23\ndecision: x',
            '## Context\n\nThe redundancy assumption is unmeasured.\n',
        );
        expect(classesIn(text).has('measurement')).toBe(false);
    });

    it('accepts a figure whose only date is the frontmatter — a second adjacent date is not required', () => {
        // Measured: requiring a co-located date dropped ADR-227's exact-BPE
        // token counts and its percentage table, grading a record built on
        // pre-registered measurement as E0.
        const text = fm(
            'adr: 227\nstatus: accepted\ndate: 2026-08-13\ndecision: x',
            '## Context\n\nx\ny\nz\n\nA figure: 179.1 % on maintainer machines, and exactly 25 of 116 rules.\n',
        );
        expect(classesIn(text).has('measurement')).toBe(true);
    });

    it('requires an anchor for a bare measurement verb with no figure', () => {
        const undated = fm(
            'adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x',
            '## Context\n\nfiller\nfiller\nfiller\nfiller\n\nThe recall was observed to be poor.\n',
        );
        expect(classesIn(undated).has('measurement')).toBe(false);
        const dated = fm(
            'adr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x',
            '## Context\n\nThe recall was observed to be poor (PR #1277).\n',
        );
        expect(classesIn(dated).has('measurement')).toBe(true);
    });

    it('reports the matched line, 1-based, for every marker', () => {
        const text = '---\nadr: 999\nstatus: accepted\ndate: 2026-08-21\ndecision: x\n---\n\nThe AI council ruled.\n';
        const council = detectMarkers(text).filter((m) => m.cls === 'council');
        expect(council).toHaveLength(1);
        expect(council[0]?.line).toBe(8);
        expect(council[0]?.excerpt).toBe('The AI council ruled.');
    });

    it('keeps the anchor window at 2, which is why a two-line sentence resolves', () => {
        expect(ANCHOR_WINDOW).toBe(2);
    });
});

describe('sectionOf / bodyStart', () => {
    it('finds the nearest preceding heading, lower-cased', () => {
        const lines = ['# T', '## Context', 'a', '## Consequences', 'b'];
        expect(sectionOf(lines, 2)).toBe('context');
        expect(sectionOf(lines, 4)).toBe('consequences');
    });

    it('is empty above the first heading', () => {
        expect(sectionOf(['a', 'b'], 1)).toBe('');
    });

    it('returns the line after the closing fence, and 0 when there is no frontmatter', () => {
        expect(bodyStart(['---', 'adr: 1', '---', 'body'])).toBe(3);
        expect(bodyStart(['# no frontmatter'])).toBe(0);
        expect(bodyStart(['---', 'adr: 1'])).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Corpus enumeration and the frontmatter-absent case
// ---------------------------------------------------------------------------

describe('enumerateRecords', () => {
    it('takes flat `ADR-*.md` and per-area `NNNN-*.md`, and never a README', () => {
        const root = tmpRoot();
        fs.mkdirSync(path.join(root, 'docs', 'decisions'), { recursive: true });
        fs.mkdirSync(path.join(root, 'docs', 'adrs', 'cost'), { recursive: true });
        fs.writeFileSync(path.join(root, 'docs', 'decisions', 'ADR-001-a.md'), fm('adr: 001'));
        fs.writeFileSync(path.join(root, 'docs', 'decisions', 'INDEX.md'), '# index\n');
        fs.writeFileSync(path.join(root, 'docs', 'decisions', 'adr-reopen-sweep-2026-08.md'), '# sweep\n');
        fs.writeFileSync(path.join(root, 'docs', 'adrs', 'cost', '0001-b.md'), '# b\n');
        fs.writeFileSync(path.join(root, 'docs', 'adrs', 'cost', 'README.md'), '# area index\n');

        // Flat first, then per-area — the order the report reads in.
        expect(enumerateRecords(root)).toEqual([
            path.join('docs', 'decisions', 'ADR-001-a.md'),
            path.join('docs', 'adrs', 'cost', '0001-b.md'),
        ]);
    });

    it('reports a record with no frontmatter instead of crashing or skipping it', () => {
        const root = tmpRoot();
        fs.mkdirSync(path.join(root, 'docs', 'adrs', 'cost'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'docs', 'adrs', 'cost', '0001-hard-stop.md'),
            '# ADR 0001 — Hard-stop hook\n\n> Area: `cost` · Status: accepted · Date: 2026-05-16 · Type: retrospective\n\n## Context\n\nx\n',
        );
        const result = runCensus(root);
        expect(result.scanned).toBe(1);
        expect(result.unreadable).toEqual([]);
        expect(result.records[0]?.frontmatter).toBe('absent');
        expect(result.records[0]?.current).toMatch(/blockquote: Area: `cost`/);
        // It is still graded, not dropped.
        expect(result.records[0]?.proposed.strength).toBe('E0');
    });

    it('says so when a record has neither frontmatter nor blockquote metadata', () => {
        const root = tmpRoot();
        fs.mkdirSync(path.join(root, 'docs', 'adrs', 'x'), { recursive: true });
        fs.writeFileSync(path.join(root, 'docs', 'adrs', 'x', '0001-y.md'), '# y\n');
        expect(runCensus(root).records[0]?.current).toBe('no frontmatter, no blockquote metadata');
    });

    it('reads the per-area blockquote line, or null', () => {
        expect(blockquoteMeta('# t\n\n> Area: `cost` · Status: accepted\n')).toBe('Area: `cost` · Status: accepted');
        expect(blockquoteMeta('# t\n\n> just a quote\n')).toBeNull();
    });

    it('records an unreadable file rather than throwing — the only --check failure', () => {
        const root = tmpRoot();
        fs.mkdirSync(path.join(root, 'docs', 'decisions', 'ADR-001-dir.md'), { recursive: true });
        const result = runCensus(root);
        expect(result.scanned).toBe(0);
        expect(result.unreadable).toHaveLength(1);
        expect(result.unreadable[0]?.record).toBe(path.join('docs', 'decisions', 'ADR-001-dir.md'));
    });
});

// ---------------------------------------------------------------------------
// The proposal-only constraint, asserted rather than described
// ---------------------------------------------------------------------------

describe('the census writes no ADR frontmatter', () => {
    it('leaves every scanned record byte-identical', () => {
        const root = tmpRoot();
        const dir = path.join(root, 'docs', 'decisions');
        fs.mkdirSync(dir, { recursive: true });
        const files = ['ADR-001-a.md', 'ADR-002-b.md'];
        for (const f of files) {
            fs.writeFileSync(path.join(dir, f), fm('adr: 001\nstatus: accepted\ndate: 2026-08-21\ndecision: x'));
        }
        const before = files.map((f) =>
            crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex'),
        );
        runCensus(root);
        renderArtifact(runCensus(root));
        const after = files.map((f) =>
            crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex'),
        );
        expect(after).toEqual(before);
    });
});

describe('renderArtifact', () => {
    it('declares its evidence type, so the artifact does not red `lint_evidence_artifacts` on commit', async () => {
        // Resolved through the real resolver rather than a string match: the
        // gate fires on any artifact ADDED under `agents/evidence/` that
        // resolves no type, and it reads only the first 40 lines.
        const { resolveEvidenceType } = await import('../../src/scripts/lint_evidence_artifacts.js');
        const md = renderArtifact(runCensus(REPO_ROOT));
        expect(resolveEvidenceType('agents/evidence/analysis/adr-evidence-census-2026-08.md', md)).toEqual({
            type: 'analysis',
            via: 'marker',
            invalidMarker: null,
        });
    });

    it('carries the required columns and the "what this is not" disclosure', () => {
        const md = renderArtifact(runCensus(REPO_ROOT));
        expect(md).toContain(
            '| Record | Proposed provenance | Proposed strength | Discovery | Matched markers (file:line) | Current frontmatter |',
        );
        expect(md).toContain('## What this artifact is NOT');
        expect(md).toMatch(/proposal set for human review/);
        expect(md).toMatch(/wrote no ADR frontmatter/);
        expect(md).toMatch(/heuristic/);
        expect(md).toContain('## Proposed distribution');
    });
});

// ---------------------------------------------------------------------------
// Corpus accuracy — the half that measures the heuristic, not the plumbing
// ---------------------------------------------------------------------------

describe('corpus accuracy against an independent read', () => {
    const result = runCensus(REPO_ROOT);
    const by = (n: string): (typeof result.records)[number] => {
        const r = result.records.find((x) => x.record.includes(`ADR-${n}-`));
        if (r === undefined) throw new Error(`ADR-${n} not found in the corpus`);
        return r;
    };

    it('scans the whole corpus — both surfaces, no README', () => {
        expect(result.scanned).toBeGreaterThanOrEqual(184);
        expect(result.records.filter((r) => r.surface === 'area')).toHaveLength(7);
        expect(result.records.every((r) => !r.record.endsWith('README.md'))).toBe(true);
        expect(result.unreadable).toEqual([]);
    });

    it('puts records built on real measurement at E2 or above', () => {
        for (const n of ['106', '110', '126', '128', '202', '217', '223', '227']) {
            expect(['E2', 'E3'], `ADR-${n}`).toContain(by(n).proposed.strength);
        }
    });

    it('puts records with no evidence marker at E0', () => {
        for (const n of ['046', '047']) {
            expect(by(n).proposed.strength, `ADR-${n}`).toBe('E0');
            expect(by(n).markers, `ADR-${n}`).toEqual([]);
        }
    });

    it('grades ADR-048 E1 — a council attribution plus two observed counts, neither E0 nor E2', () => {
        const r = by('048');
        expect(r.proposed.strength).toBe('E1');
        const lines = new Set(r.markers.map((m) => m.line));
        // The council attribution and the observed counts are all cited.
        expect(lines.has(30)).toBe(true);
        expect(lines.has(32)).toBe(true);
        expect(r.markers.some((m) => m.cls === 'council' && m.line === 30)).toBe(true);
        expect(r.markers.some((m) => m.cls === 'measurement' && m.line === 32)).toBe(true);
    });

    it('grades ADR-229 human / E2 on the duplicate work measured twice at :52', () => {
        const r = by('229');
        expect(r.proposed.provenance).toBe('human');
        expect(r.proposed.strength).toBe('E2');
        expect(r.markers.some((m) => m.cls === 'repeated' && m.line === 52)).toBe(true);
    });

    it('detects the owner decision on ADR-216', () => {
        expect(by('216').markers.some((m) => m.cls === 'owner')).toBe(true);
    });
});
