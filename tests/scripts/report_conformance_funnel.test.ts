// Conformance funnel (road-to-feedback-9-29 Phase 4.2) — the delivery →
// activation → compliance join over the existing conformance sources.
//
// Two properties are pinned and neither is a count. First, the funnel JOINS:
// its numbers come from the sources' own exported functions, so the axes must
// render whatever those functions return — including the honest no-data lines
// when a carrier or a transcript store is absent, because an absent input is
// an answer, not a zero. Second, the funnel is a REPORT: exit 0 on every data
// shape, and the never-a-gate sentence is part of the output itself, so a
// reader of the report (not only of the source) sees the locked policy.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { buildFunnel, main, render } from '../../src/scripts/report_conformance_funnel.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const tmps: string[] = [];

function tmpdir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'conformance-funnel-'));
    tmps.push(d);
    return d;
}

afterEach(() => {
    while (tmps.length) {
        fs.rmSync(tmps.pop() as string, { recursive: true, force: true });
    }
});

function writeRules(dir: string, files: Record<string, string>): string {
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, body] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, name), body, 'utf-8');
    }
    return dir;
}

/** A minimal session whose only event is one `Skill` tool call. */
function writeStoreWithSkillCall(dir: string, skill: string): string {
    fs.mkdirSync(dir, { recursive: true });
    const entry = {
        type: 'assistant',
        timestamp: '2026-08-10T00:00:00Z',
        message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill } }] },
    };
    fs.writeFileSync(path.join(dir, 'session-1.jsonl'), `${JSON.stringify(entry)}\n`, 'utf-8');
    return dir;
}

describe('all three axes render against whatever local data exists', () => {
    it('renders DELIVERY, ACTIVATION and COMPLIANCE with the no-data branches taken', () => {
        // Real repo for the static censuses (skills, obligation coverage);
        // absent carriers and an absent store for every transcript-fed half —
        // the exact shape of a fresh clone on a machine with no global install.
        const root = tmpdir();
        const r = buildFunnel({
            repoRoot: REPO_ROOT,
            projectRulesDir: path.join(root, 'no-project-rules'),
            globalRulesDir: path.join(root, 'no-global-rules'),
            sourceDir: path.join(REPO_ROOT, 'dist', 'agent-src', 'rules'),
            store: path.join(root, 'no-store'),
        });
        const text = render(r);

        expect(text).toMatch(/^DELIVERY — /m);
        expect(text).toMatch(/^ACTIVATION — /m);
        expect(text).toMatch(/^COMPLIANCE — /m);

        // Delivery no-data: an absent carrier is named, never a measured zero.
        expect(text).toMatch(/ABSENT — not a measured zero/);
        expect(text).toMatch(/global carrier is absent/);

        // Activation no-data: an absent store is an answer, not a zero.
        expect(r.storePresent).toBe(false);
        expect(text).toMatch(/NO DATA: no transcript store at /);

        // Compliance no-data branch, while the static census still holds.
        expect(text).toMatch(/NO DATA: no transcript store — loaded-but-violated/);
        expect(text).toMatch(/coverage census above is static and still holds/);

        // The honest-scope statements each source already carries survive the join.
        expect(text).toMatch(/payload is NOT recoverable/); // conformance_scan
        expect(text).toMatch(/injected catalogue is not persisted/); // report_skill_activation
        expect(text).toMatch(/\d+ artefact\(s\) over \d+ obligation line\(s\)/); // SK-2 mechanisable ratio
        expect(text).toMatch(/hand-read before any number here is cited/); // SK-2 precision
    });

    it('renders measured numbers when carriers and a store exist', () => {
        const root = tmpdir();
        const project = writeRules(path.join(root, 'project'), {
            'shared.md': '---\nname: shared\n---\n\nNEW claim\n',
        });
        const global = writeRules(path.join(root, 'global'), {
            'shared.md': '---\nname: shared\n---\n\nOLD claim\n',
        });
        const store = writeStoreWithSkillCall(path.join(root, 'store'), 'docker');

        const r = buildFunnel({
            repoRoot: REPO_ROOT,
            projectRulesDir: project,
            globalRulesDir: global,
            sourceDir: path.join(root, 'no-source'),
            store,
        });
        const text = render(r);

        // Delivery: the census counted the carriers and the divergence named
        // the body-diff pair — both from the sources' own exports.
        expect(r.delivered.project.present).toBe(true);
        expect(r.divergence.bodyDiff).toEqual(['shared.md']);
        expect(text).toMatch(/1 prose-diff/);
        // Was `project projection is generated from src/ at this commit`, i.e.
        // the "newer copy wins" precedence claim. Corrected 2026-08-10: the host
        // loads both layers at launch at equal priority with no precedence marker
        // (claude-code-rules-dir-contract.md, host 2.1.226), so binding is
        // undefined and recency is not precedence.
        expect(text).toMatch(/UNDEFINED/);

        // Activation: the Skill call was counted as usage.
        expect(r.usage.invocations).toBe(1);
        expect(text).toMatch(/Skill invocations=1 distinct skills=1 of \d+/);

        // Compliance: the transcript-fed half ran (no NO DATA line).
        expect(r.storePresent).toBe(true);
        expect(text).toMatch(/sessions scanned=1 with a skill in context=1 flags=\d+/);
        expect(text).not.toMatch(/NO DATA/);
    });
});

describe('the funnel is a report and must stay that way', () => {
    it('exits 0 on the no-data shape and prints the never-a-gate sentence', () => {
        const root = tmpdir();
        expect(
            main([
                '--project', path.join(root, 'none'),
                '--global', path.join(root, 'none-either'),
                '--source', path.join(root, 'no-source'),
                '--store', path.join(root, 'no-store'),
            ]),
        ).toBe(0);
        const text = render(
            buildFunnel({
                repoRoot: REPO_ROOT,
                projectRulesDir: path.join(root, 'none'),
                globalRulesDir: path.join(root, 'none-either'),
                sourceDir: path.join(root, 'no-source'),
                store: path.join(root, 'no-store'),
            }),
        );
        expect(text).toMatch(/never be wired into a CI\s*\nworkflow without a measured false-positive rate/);
    });

    it('rejects an unknown flag and a flag in the value position, never treating either as a path', () => {
        expect(main(['--bogus'])).toBe(1);
        expect(main(['--store', '--limit'])).toBe(1);
        expect(main(['--limit', 'zero'])).toBe(1);
    });
});
