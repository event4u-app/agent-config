/**
 * `smoke-trace.sh assumed` + the trace template's two new fields.
 *
 * The ASSUMED tags are the adapters' own admission that a provider field name
 * is documented-best-effort rather than observed. Before this, the count lived
 * only in whoever last ran the grep — and the roadmap that motivated this step
 * shipped a count of 18 when the tree carried 21, because one adapter had been
 * missed. A number a human re-derives by hand is a number that drifts.
 *
 * `assumed_fields_confirmed` and `recheck_by` are asserted on a REAL dry-run
 * capture rather than on a hand-written fixture: a template field that only
 * exists in a test's idea of the template is not in the template.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SMOKE = path.join(REPO_ROOT, 'src', 'scripts', 'ai-video', 'smoke-trace.sh');


/**
 * The calendar date `days` after a capture stamp.
 *
 * `recheck_by` is a DATE and `captured_utc` carries a time of day, so a naive
 * millisecond delta is off by one whenever the capture is not at midnight — the
 * first version of this test asserted 180 and measured 179.43. The question the
 * field answers is "which calendar day does this stop being evidence", so the
 * assertion is date arithmetic, not duration arithmetic.
 */
function calendarDatePlus(capturedUtc: string, days: number): string {
    const d = new Date(capturedUtc.replace(/T(\d{2})-(\d{2})-(\d{2})Z$/, 'T$1:$2:$3Z'));
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

function run(args: string[]) {
    return spawnSync('bash', [SMOKE, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
}

/** `<domain>\t<adapter>\t<count>` rows plus a trailing `total\t<n>`. */
function parseAll(stdout: string): { rows: [string, string, number][]; total: number } {
    const rows: [string, string, number][] = [];
    let total = Number.NaN;
    for (const line of stdout.trim().split('\n')) {
        const parts = line.split('\t');
        if (parts[0] === 'total') {
            total = Number(parts[1]);
            continue;
        }
        rows.push([parts[0] ?? '', parts[1] ?? '', Number(parts[2])]);
    }
    return { rows, total };
}

describe('smoke-trace.sh assumed', () => {
    it('prints one line per ASSUMED tag for a named adapter', () => {
        const res = run(['assumed', 'kling']);
        expect(res.status).toBe(0);
        const lines = res.stdout.trim().split('\n');
        expect(lines).toHaveLength(3);
        for (const l of lines) expect(l).toMatch(/^\d+:.*ASSUMED/);
    });

    it('totals 21 across the ai-video adapter set — the roadmap figure, re-derived', () => {
        const { rows, total } = parseAll(run(['assumed', '--all', '--domain', 'ai-video']).stdout);
        expect(total).toBe(21);
        expect(Object.fromEntries(rows.map(([, a, n]) => [a, n]))).toEqual({
            'gemini-veo': 5,
            fal: 4,
            kling: 3,
            sora: 3,
            syncso: 3,
            replicate: 2,
            higgsfield: 1,
        });
    });

    it('reports the ai-image adapters separately rather than folding them into one total', () => {
        // The undifferentiated total is 25, and the roadmap's own breakdown sums
        // to 21 — the four ai-image adapters carry one tag each and belong to a
        // different adapter population. A single number answers neither question.
        const video = parseAll(run(['assumed', '--all', '--domain', 'ai-video']).stdout);
        const image = parseAll(run(['assumed', '--all', '--domain', 'ai-image']).stdout);
        const both = parseAll(run(['assumed', '--all']).stdout);
        expect(image.total).toBe(4);
        expect(both.total).toBe(video.total + image.total);
        expect(both.total).toBe(25);
    });

    it('reports 0 for an adapter carrying no ASSUMED tag — the mechanism that closes a tag out', () => {
        // The step's second half ("after a trace confirms them the count is 0")
        // needs a paid live capture, so the CONFIRMATION is an honest null. What
        // is provable without spend is that dropping the tag drops the count —
        // i.e. the counter reads the tree and not a stored number.
        const { rows } = parseAll(run(['assumed', '--all']).stdout);
        const names = rows.map(([, a]) => a);
        expect(names).not.toContain('comfyui'); // 0 tags → absent from the report
        expect(names).not.toContain('musetalk');
        expect(run(['assumed', 'comfyui']).stdout.trim()).toBe('');
    });

    it('refuses an unknown adapter instead of reporting zero tags', () => {
        const res = run(['assumed', 'no-such-provider']);
        expect(res.status).not.toBe(0);
        expect(res.stderr).toMatch(/no adapter for/);
    });
});

describe('smoke-trace.sh trace template', () => {
    it('stamps recheck_by and an empty assumed_fields_confirmed on a real dry-run capture', () => {
        const out = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-tmpl-'));
        const res = run(['--provider', 'kling', '--out', out]);
        expect(res.status, res.stderr).toBe(0);
        const files = fs.readdirSync(out).filter((f) => f.endsWith('.json'));
        expect(files).toHaveLength(1);
        const trace = JSON.parse(fs.readFileSync(path.join(out, files[0] as string), 'utf8')) as {
            captured_utc: string;
            recheck_by: string;
            assumed_fields_confirmed: string[];
        };
        expect(trace.assumed_fields_confirmed).toEqual([]);
        expect(trace.recheck_by).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // 180 days after capture, and the window is ONE constant shared with
        // lint_adapter_tier — so a change moves both sides or neither.
        expect(trace.recheck_by).toBe(calendarDatePlus(trace.captured_utc, 180));
    });

    it('records the fields an operator names as confirmed, and only those', () => {
        const out = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-tmpl-c-'));
        const res = run(['--provider', 'kling', '--out', out, '--confirms', 'aspect_ratio, negative_prompt']);
        expect(res.status, res.stderr).toBe(0);
        const f = fs.readdirSync(out).find((x) => x.endsWith('.json')) as string;
        const trace = JSON.parse(fs.readFileSync(path.join(out, f), 'utf8')) as {
            assumed_fields_confirmed: string[];
        };
        expect(trace.assumed_fields_confirmed).toEqual(['aspect_ratio', 'negative_prompt']);
    });

    it('honours AIV_TRACE_RECHECK_DAYS so the window is not hardcoded twice', () => {
        const out = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-tmpl-w-'));
        const res = spawnSync('bash', [SMOKE, '--provider', 'kling', '--out', out], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
            env: { ...process.env, AIV_TRACE_RECHECK_DAYS: '30' },
        });
        expect(res.status, res.stderr).toBe(0);
        const f = fs.readdirSync(out).find((x) => x.endsWith('.json')) as string;
        const trace = JSON.parse(fs.readFileSync(path.join(out, f), 'utf8')) as {
            captured_utc: string;
            recheck_by: string;
        };
        expect(trace.recheck_by).toBe(calendarDatePlus(trace.captured_utc, 30));
        // And it is genuinely the env value, not the default under another name.
        expect(trace.recheck_by).not.toBe(calendarDatePlus(trace.captured_utc, 180));
    });
});
