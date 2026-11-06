/**
 * Deterministic scoring for the slim-vs-full end-reviewer verdict comparison
 * run by `bench_slim_reviewer.ts`. No LLM judge: both arms answer under the
 * same output contract and this module reads it. The definitions below are
 * fixed before any paid call, so they are not tuned to a result:
 *   - caught       planted fixture, verdict NOT READY, a FINDING names the planted file (basename)
 *   - false pos.   control fixture, verdict NOT READY (a note-only READY is not one)
 *   - agreement    both arms produced the same parsed verdict; UNPARSED never agrees
 */

export type Verdict = 'READY' | 'NOT READY' | 'UNPARSED';

export interface SlimFixtureMeta {
    id: string;
    kind: 'planted' | 'control';
    /** One of the three correct-but-contested controls of the adversarial-council run. */
    contested: boolean;
    planted_file: string | null;
}

export interface Finding {
    file: string;
    severity: string;
}

export interface ArmOutcome {
    text: string;
    usd: number;
    errored: boolean;
}

export interface ArmScore {
    verdict: Verdict;
    findings: Finding[];
    caught: boolean;
    false_positive: boolean;
    usd: number;
}

export interface ScoredFixture {
    meta: SlimFixtureMeta;
    slim: ArmScore;
    full: ArmScore;
}

const FINDING_RE = /^\s*[*_`]*FINDING:\s*`?([\w./@-]+\.\w+)(?::[\d,-]+)?`?\s*(?:—|-{1,2}|:)\s*([\w-]+)/;
const VERDICT_RE = /VERDICT:\s*[*_`]*\s*(NOT READY|READY)\b/gi;

export function parseReview(text: string): { verdict: Verdict; findings: Finding[] } {
    const findings: Finding[] = [];
    for (const line of text.split('\n')) {
        const m = FINDING_RE.exec(line);
        if (m) findings.push({ file: m[1] as string, severity: (m[2] as string).toLowerCase() });
    }
    let verdict: Verdict = 'UNPARSED';
    for (const m of text.matchAll(VERDICT_RE)) {
        verdict = (m[1] as string).toUpperCase() === 'READY' ? 'READY' : 'NOT READY';
    }
    return { verdict, findings };
}

function basename(p: string): string {
    return p.split('/').pop() ?? p;
}

export function scoreFixture(meta: SlimFixtureMeta, out: ArmOutcome): ArmScore {
    const parsed = out.errored ? { verdict: 'UNPARSED' as Verdict, findings: [] } : parseReview(out.text);
    const notReady = parsed.verdict === 'NOT READY';
    const caught =
        meta.kind === 'planted' &&
        notReady &&
        meta.planted_file !== null &&
        parsed.findings.some((f) => basename(f.file) === basename(meta.planted_file as string));
    return {
        verdict: parsed.verdict,
        findings: parsed.findings,
        caught,
        false_positive: meta.kind === 'control' && notReady,
        usd: out.usd,
    };
}

export interface Summary {
    fixtures: number;
    agreement: number;
    agreement_rate: number;
    disagreements: string[];
    planted: number;
    missed: { slim: string[]; full: string[] };
    contested_controls: number;
    contested_fp: { slim: string[]; full: string[] };
    all_controls: number;
    all_control_fp: { slim: string[]; full: string[] };
    usd: { slim: number; full: number };
}

export function summarize(rows: readonly ScoredFixture[]): Summary {
    const ids = (pred: (r: ScoredFixture) => boolean): string[] => rows.filter(pred).map((r) => r.meta.id);
    const agreeing = rows.filter((r) => r.slim.verdict !== 'UNPARSED' && r.slim.verdict === r.full.verdict);
    const planted = rows.filter((r) => r.meta.kind === 'planted');
    const controls = rows.filter((r) => r.meta.kind === 'control');
    const contested = controls.filter((r) => r.meta.contested);
    return {
        fixtures: rows.length,
        agreement: agreeing.length,
        agreement_rate: rows.length === 0 ? 0 : agreeing.length / rows.length,
        disagreements: ids((r) => !agreeing.includes(r)),
        planted: planted.length,
        missed: {
            slim: planted.filter((r) => !r.slim.caught).map((r) => r.meta.id),
            full: planted.filter((r) => !r.full.caught).map((r) => r.meta.id),
        },
        contested_controls: contested.length,
        contested_fp: {
            slim: contested.filter((r) => r.slim.false_positive).map((r) => r.meta.id),
            full: contested.filter((r) => r.full.false_positive).map((r) => r.meta.id),
        },
        all_controls: controls.length,
        all_control_fp: {
            slim: controls.filter((r) => r.slim.false_positive).map((r) => r.meta.id),
            full: controls.filter((r) => r.full.false_positive).map((r) => r.meta.id),
        },
        usd: {
            slim: rows.reduce((a, r) => a + r.slim.usd, 0),
            full: rows.reduce((a, r) => a + r.full.usd, 0),
        },
    };
}

export interface BarVerdict {
    bar: number;
    agreement_pass: boolean;
    fp_pass: boolean;
    pass: boolean;
}

/** Bar: agreement >= `bar` AND slim false positives on the contested controls <= full. */
export function evaluateBar(s: Summary, bar: number): BarVerdict {
    const agreement_pass = s.agreement_rate >= bar;
    const fp_pass = s.contested_fp.slim.length <= s.contested_fp.full.length;
    return { bar, agreement_pass, fp_pass, pass: agreement_pass && fp_pass };
}
