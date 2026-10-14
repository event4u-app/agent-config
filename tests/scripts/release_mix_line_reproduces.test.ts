// The published `> **Governance mix:** …` line must be reproducible by the
// measurer on the range the line itself names. The 16.3.0 line read `23 vs 1`
// while `measure_release_mix --from 16.2.0 --to 16.3.0` reads `83 vs 3`, and the
// line recorded neither end of the range it had measured.
//
// Each case builds a throwaway git repository under the OS temp directory.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { render_mix_response } from '../../src/scripts/_lib/release_material.js';
import { loadTaxonomy, measureRange } from '../../src/scripts/measure_release_mix.js';
import { measure_mix_obligation } from '../../src/scripts/release_publication.js';

function git(cwd: string, args: string[]): string {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
}

function commit(repo: string, rel: string, msg: string): void {
    const abs = join(repo, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, `${msg}\n`, 'utf8');
    git(repo, ['add', '.']);
    git(repo, ['commit', '-qm', msg]);
}

const LINE_RE =
    /governance-only (\d+) vs consumer-only (\d+) \(mixed (\d+), maintenance (\d+); taxonomy [^;]+; range ([0-9a-f]{12})\.\.([0-9a-f]{12})\)/u;

describe('the governance-mix line names the range it measured', () => {
    let repo: string;

    beforeEach(() => {
        repo = mkdtempSync(join(tmpdir(), 'mix-line-'));
        git(repo, ['init', '-q', '-b', 'main']);
        git(repo, ['config', 'user.email', 'test@example.com']);
        git(repo, ['config', 'user.name', 'test']);
        commit(repo, 'README.md', 'base');
        git(repo, ['tag', '1.0.0']);
        commit(repo, 'agents/roadmaps/road-to-a.md', 'gov a');
        commit(repo, 'agents/roadmaps/road-to-b.md', 'gov b');
        commit(repo, 'src/skills/c/SKILL.md', 'consumer c');
    });

    afterEach(() => {
        rmSync(repo, { recursive: true, force: true });
    });

    it('renders counts that equal measureRange on the two SHAs the line names', () => {
        const mix = measure_mix_obligation('1.1.0', '1.0.0', { cwd: repo });
        expect(mix).not.toBeNull();
        const line = render_mix_response(mix!.level)[0]!;
        const m = LINE_RE.exec(line);
        expect(m, line).not.toBeNull();

        // HEAD moves after the line is written — the line must still reproduce.
        commit(repo, 'agents/roadmaps/road-to-d.md', 'gov d after write');

        const from = git(repo, ['rev-parse', m![5]!]);
        const to = git(repo, ['rev-parse', m![6]!]);
        expect(from).toBe(mix!.from_sha);
        expect(to).toBe(mix!.to_sha);
        const reading = measureRange(from, to, loadTaxonomy(), '1.1.0', repo);
        expect(Number(m![1])).toBe(reading.response_obligation.governance_only);
        expect(Number(m![2])).toBe(reading.response_obligation.consumer_only);
        expect([Number(m![1]), Number(m![2])]).toEqual([2, 1]);
    });

    /**
     * `mixed` is a commit touching more than one classified category, and the
     * measurer's own docblock says it "is never collapsed" into either side.
     * The published line collapsed it by omission instead: over 16.3.0..16.4.0
     * the buckets read `consumer 1 · governance 42 · maintenance 1 · mixed 41`,
     * so `mixed` was the second-largest of the four and almost half the span —
     * and the line published `42 vs 1`, which a reader could only take as the
     * whole of it.
     */
    it('mix-line-carries-mixed: every bucket is named, not the two on the obligation', () => {
        // One commit touching governance AND consumer — the `mixed` bucket —
        // plus one touching only maintenance, so both new numbers are non-zero
        // and a line that dropped either would be visibly wrong rather than
        // coincidentally right.
        mkdirSync(join(repo, 'agents/roadmaps'), { recursive: true });
        mkdirSync(join(repo, 'src/skills/m'), { recursive: true });
        writeFileSync(join(repo, 'agents/roadmaps/road-to-mixed.md'), 'gov half\n', 'utf8');
        writeFileSync(join(repo, 'src/skills/m/SKILL.md'), 'consumer half\n', 'utf8');
        git(repo, ['add', '.']);
        git(repo, ['commit', '-qm', 'touches two categories at once']);
        commit(repo, '.github/workflows/ci.yml', 'maintenance only');

        const mix = measure_mix_obligation('1.1.0', '1.0.0', { cwd: repo })!;
        const m = LINE_RE.exec(render_mix_response(mix.level)[0]!);
        expect(m, mix.level).not.toBeNull();

        const reading = measureRange(mix.from_sha!, mix.to_sha!, loadTaxonomy(), '1.1.0', repo);
        expect(Number(m![3])).toBe(reading.commit_view.mixed);
        expect(Number(m![4])).toBe(reading.commit_view.maintenance);
        // Non-vacuous: a line that printed zeros would satisfy a shape check.
        expect(Number(m![3])).toBeGreaterThan(0);
        expect(Number(m![4])).toBeGreaterThan(0);
        // And the record carries them too, for any reader that is not the line.
        expect(mix.mixed).toBe(reading.commit_view.mixed);
        expect(mix.maintenance).toBe(reading.commit_view.maintenance);
    });

    it('resolves the default from-tag and an explicit to-ref to SHAs', () => {
        git(repo, ['tag', '1.1.0']);
        commit(repo, 'agents/roadmaps/road-to-e.md', 'gov e');
        const mix = measure_mix_obligation('1.1.0', null, { cwd: repo, toRef: '1.1.0' });
        expect(mix!.from_sha).toBe(git(repo, ['rev-parse', '1.0.0^{commit}']));
        expect(mix!.to_sha).toBe(git(repo, ['rev-parse', '1.1.0^{commit}']));
        expect([mix!.governance_only, mix!.consumer_only]).toEqual([2, 1]);
    });
});
