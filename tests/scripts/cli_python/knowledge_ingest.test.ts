// Golden-parity tests for src/cli/python/knowledge_ingest.ts (py2ts ADR-200 —
// the local knowledge ingestion CLI).
//
// Strategy: run `python3 src/cli/python/knowledge_ingest.py` vs
// `tsx src/cli/python/knowledge_ingest.ts` and byte-compare stdout / stderr /
// exit, plus parsed-JSON stable fields and written chunk files. Both sides run
// with cwd = a throwaway temp dir, so the CWD-relative module-level
// KNOWLEDGE_ROOT (`agents/memory/knowledge`) lands fully inside the temp dir —
// hermetic, no repo pollution, no network, no real markitdown.
//
// Non-deterministic fields (ingest_id, created_at, last_touched, the absolute
// source path, and per-file `path`) are stripped/normalised before comparison;
// the stable redaction + chunking counters are deep-compared.
//
// Coverage map:
//   - no subcommand → exit 2 (no byte-compare of --help prose).
//   - remote scheme reject → exit 2 stderr.
//   - ingest a .md (redaction ON) → manifest stable fields + chunk files match.
//   - ingest a PII-laden .txt → pii_redacted counts match py.
//   - ingest --no-redact → redacted:false, no scrubbing.
//   - ingest unsupported ext (.bin) → skipped unsupported:<mime>.
//   - ingest a binary ext (.pdf), markitdown absent → skipped markitdown reason.
//   - list --format json / table after an ingest (normalise volatile cols).
//   - forget <prefix>; ambiguous + no-match prefix errors (exit 2 stderr).
//   - list --pin / --unpin.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'knowledge_ingest.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'knowledge_ingest.py');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();
const itPy = py3 ? it : it.skip;

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runPy(args: string[], cwd: string): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: {
            ...process.env,
            COLUMNS: '80',
            PYTHONPATH: path.join(REPO_ROOT, 'src'),
            // Force markitdown absent for both sides by emptying PATH lookups
            // that could find a real binary (tests never want a real convert).
            PATH: process.env['PATH'] ?? '',
        },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], cwd: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const roots: string[] = [];
function freshRoot(): string {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'acki-'));
    roots.push(r);
    return r;
}
function freshPair(): [string, string] {
    return [freshRoot(), freshRoot()];
}

afterEach(() => {
    while (roots.length) {
        const r = roots.pop()!;
        try {
            fs.rmSync(r, { recursive: true, force: true });
        } catch {
            /* best-effort */
        }
    }
});

// ---------------------------------------------------------------------------
// normalisation helpers
// ---------------------------------------------------------------------------

const VOLATILE_TOP = new Set(['ingest_id', 'created_at', 'last_touched']);

/** Strip non-deterministic keys + paths from a parsed manifest object. */
function normManifest(m: Record<string, unknown>, root: string): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(m)) {
        if (VOLATILE_TOP.has(k)) continue;
        if (k === 'source') {
            out[k] = normPath(String(v), root);
            continue;
        }
        if (k === 'files' && Array.isArray(v)) {
            out[k] = v.map((f) => {
                const fo = { ...(f as Record<string, unknown>) };
                fo['path'] = normPath(String(fo['path']), root);
                return fo;
            });
            continue;
        }
        if (k === 'skipped' && Array.isArray(v)) {
            out[k] = v.map((s) => {
                const so = { ...(s as Record<string, unknown>) };
                if ('path' in so) so['path'] = normPath(String(so['path']), root);
                // `reason` may embed a TRUNCATED (str[:120]) absolute path that
                // normPath cannot fully match; normalise by collapsing any temp
                // path tail to <P> so two roots compare equal.
                if ('reason' in so) {
                    so['reason'] = normReason(String(so['reason']), root);
                }
                return so;
            });
            continue;
        }
        out[k] = v;
    }
    return out;
}

/** Collapse a root-or-realpath prefix to <R> so two temp dirs compare equal. */
function normPath(p: string, root: string): string {
    let real = root;
    try {
        real = fs.realpathSync(root);
    } catch {
        /* keep root */
    }
    return p.split(real).join('<R>').split(root).join('<R>');
}

/** Collapse any embedded (possibly truncated) temp-root path tail to <P>. */
function normReason(reason: string, root: string): string {
    let real = root;
    try {
        real = fs.realpathSync(root);
    } catch {
        /* keep root */
    }
    // The truncated path begins at the realpath prefix; cut from the first
    // occurrence of the tmp-root parent so both sides collapse to one token.
    for (const prefix of [real, root]) {
        const parent = path.dirname(prefix); // e.g. /private/var/folders/.../T
        const idx = reason.indexOf(parent);
        if (idx !== -1) {
            return reason.slice(0, idx) + '<P>';
        }
    }
    return reason;
}

function parseManifest(stdout: string): Record<string, unknown> {
    return JSON.parse(stdout) as Record<string, unknown>;
}

/** Find the single ingest dir created under cwd's KNOWLEDGE_ROOT. */
function ingestDir(root: string): string {
    const base = path.join(root, 'agents', 'memory', 'knowledge');
    const names = fs.readdirSync(base);
    expect(names.length).toBe(1);
    return path.join(base, names[0] as string);
}

/** Read all chunk files under an ingest dir, sorted, as a name→content map. */
function readChunks(ingest: string): Record<string, string> {
    const dir = path.join(ingest, 'chunks');
    const out: Record<string, string> = {};
    for (const n of fs.readdirSync(dir).sort()) {
        out[n] = fs.readFileSync(path.join(dir, n), 'utf8');
    }
    return out;
}

const UUID7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// ---------------------------------------------------------------------------
// usage / arg errors
// ---------------------------------------------------------------------------

describe('knowledge_ingest — usage / arg errors', () => {
    itPy('no subcommand → exit 2 (both sides)', () => {
        const [py, ts] = freshPair();
        const p = runPy([], py);
        const t = runTs([], ts);
        expect(p.status).toBe(2);
        expect(t.status).toBe(2);
    });

    itPy('remote scheme reject → exit 2 stderr', () => {
        const [py, ts] = freshPair();
        const p = runPy(['ingest', 'https://example.com/x'], py);
        const t = runTs(['ingest', 'https://example.com/x'], ts);
        expect(p.status).toBe(2);
        expect(t.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
        expect(t.stdout).toBe(p.stdout);
    });
});

// ---------------------------------------------------------------------------
// ingest a .md with redaction on
// ---------------------------------------------------------------------------

describe('knowledge_ingest — ingest .md (redact on)', () => {
    itPy('manifest stable fields + chunk files identical', () => {
        const [py, ts] = freshPair();
        for (const root of [py, ts]) {
            fs.writeFileSync(path.join(root, 'a.md'), 'Hello world.\n\nSecond paragraph here.\n');
        }
        const p = runPy(['ingest', 'a.md'], py);
        const t = runTs(['ingest', 'a.md'], ts);
        expect(p.status).toBe(0);
        expect(t.status).toBe(0);

        const pm = parseManifest(p.stdout);
        const tm = parseManifest(t.stdout);
        // uuid7 layout valid on the TS side.
        expect(String(tm['ingest_id'])).toMatch(UUID7_RE);
        expect(normManifest(tm, ts)).toEqual(normManifest(pm, py));

        // Chunk files byte-identical.
        expect(readChunks(ingestDir(ts))).toEqual(readChunks(ingestDir(py)));
    });
});

// ---------------------------------------------------------------------------
// ingest a PII-laden .txt
// ---------------------------------------------------------------------------

describe('knowledge_ingest — PII redaction counts', () => {
    itPy('email / IBAN / SSN counts match python', () => {
        const [py, ts] = freshPair();
        const body =
            'Contact alice@example.com or bob@test.org.\n\n' +
            'IBAN DE89370400440532013000 and SSN 123-45-6789.\n';
        for (const root of [py, ts]) {
            fs.writeFileSync(path.join(root, 'pii.txt'), body);
        }
        const p = runPy(['ingest', 'pii.txt'], py);
        const t = runTs(['ingest', 'pii.txt'], ts);
        expect(t.status).toBe(p.status);
        const pm = parseManifest(p.stdout);
        const tm = parseManifest(t.stdout);
        expect(tm['pii_redacted']).toEqual(pm['pii_redacted']);
        expect(tm['secrets_redacted']).toEqual(pm['secrets_redacted']);
        expect(tm['contains_redactions']).toEqual(pm['contains_redactions']);
        expect(normManifest(tm, ts)).toEqual(normManifest(pm, py));
        expect(readChunks(ingestDir(ts))).toEqual(readChunks(ingestDir(py)));
    });
});

// ---------------------------------------------------------------------------
// --no-redact
// ---------------------------------------------------------------------------

describe('knowledge_ingest — --no-redact', () => {
    itPy('redacted:false, no scrubbing', () => {
        const [py, ts] = freshPair();
        const body = 'alice@example.com SSN 123-45-6789\n';
        for (const root of [py, ts]) {
            fs.writeFileSync(path.join(root, 'p.txt'), body);
        }
        const p = runPy(['ingest', '--no-redact', 'p.txt'], py);
        const t = runTs(['ingest', '--no-redact', 'p.txt'], ts);
        const pm = parseManifest(p.stdout);
        const tm = parseManifest(t.stdout);
        expect(tm['redacted']).toBe(false);
        expect(pm['redacted']).toBe(false);
        expect(normManifest(tm, ts)).toEqual(normManifest(pm, py));
        // Chunk content keeps the raw PII (no scrubbing).
        const chunks = readChunks(ingestDir(ts));
        expect(Object.values(chunks).join('')).toContain('alice@example.com');
        expect(readChunks(ingestDir(ts))).toEqual(readChunks(ingestDir(py)));
    });
});

// ---------------------------------------------------------------------------
// unsupported extension
// ---------------------------------------------------------------------------

describe('knowledge_ingest — unsupported ext', () => {
    itPy('.bin → skipped unsupported:<mime>', () => {
        const [py, ts] = freshPair();
        for (const root of [py, ts]) {
            fs.writeFileSync(path.join(root, 'data.bin'), 'binary-ish\n');
        }
        const p = runPy(['ingest', 'data.bin'], py);
        const t = runTs(['ingest', 'data.bin'], ts);
        expect(t.status).toBe(p.status);
        const pm = parseManifest(p.stdout);
        const tm = parseManifest(t.stdout);
        expect(normManifest(tm, ts)).toEqual(normManifest(pm, py));
        expect(String(JSON.stringify(tm['skipped']))).toContain('unsupported:');
        expect(tm['documents']).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// markitdown absent
// ---------------------------------------------------------------------------

describe('knowledge_ingest — markitdown absent', () => {
    itPy('.pdf with markitdown not on PATH → skipped "not installed" reason', () => {
        // No --markitdown flag → `shutil.which("markitdown")` is consulted on the
        // real PATH. markitdown is not installed here, so the IngestError skip
        // path fires (NOT the subprocess-crash path an explicit nonexistent
        // --markitdown would take — Python lets that FileNotFoundError propagate,
        // exit 1). Guard: only meaningful when markitdown is genuinely absent.
        const markitdownPresent =
            spawnSync('markitdown', ['--version'], { encoding: 'utf8' }).error === undefined;
        if (markitdownPresent) {
            return; // environment has markitdown — this skip-path test is N/A.
        }
        const [py, ts] = freshPair();
        for (const root of [py, ts]) {
            fs.writeFileSync(path.join(root, 'doc.pdf'), '%PDF-1.4 fake\n');
        }
        const p = runPy(['ingest', 'doc.pdf'], py);
        const t = runTs(['ingest', 'doc.pdf'], ts);
        expect(t.status).toBe(0);
        expect(p.status).toBe(0);
        const pm = parseManifest(p.stdout);
        const tm = parseManifest(t.stdout);
        expect(tm['documents']).toBe(0);
        expect(pm['documents']).toBe(0);
        expect(String(JSON.stringify(tm['skipped']))).toContain('markitdown not installed');
        expect(String(JSON.stringify(pm['skipped']))).toContain('markitdown not installed');
        expect(normManifest(tm, ts)).toEqual(normManifest(pm, py));
    });
});

// ---------------------------------------------------------------------------
// list — json + table
// ---------------------------------------------------------------------------

describe('knowledge_ingest — list', () => {
    itPy('--format json after one ingest (normalised)', () => {
        const [py, ts] = freshPair();
        for (const root of [py, ts]) {
            fs.writeFileSync(path.join(root, 'a.md'), 'one\n\ntwo\n');
        }
        runPy(['ingest', 'a.md'], py);
        runTs(['ingest', 'a.md'], ts);
        const p = runPy(['list', '--format', 'json'], py);
        const t = runTs(['list', '--format', 'json'], ts);
        expect(t.status).toBe(0);
        expect(p.status).toBe(0);
        const pa = (JSON.parse(p.stdout) as Array<Record<string, unknown>>).map((m) =>
            normManifest(m, py),
        );
        const ta = (JSON.parse(t.stdout) as Array<Record<string, unknown>>).map((m) =>
            normManifest(m, ts),
        );
        expect(ta).toEqual(pa);
    });

    itPy('--format table column shape matches (volatile cols normalised)', () => {
        const [py, ts] = freshPair();
        for (const root of [py, ts]) {
            fs.writeFileSync(path.join(root, 'a.md'), 'x\n');
        }
        runPy(['ingest', 'a.md'], py);
        runTs(['ingest', 'a.md'], ts);
        const p = runPy(['list', '--format', 'table'], py);
        const t = runTs(['list', '--format', 'table'], ts);
        expect(t.status).toBe(0);
        // Both produce a header line + one row; ID (truncated uuid) + CREATED +
        // SOURCE columns are volatile, so compare the header + the static col
        // tokens (DOCS/CHUNKS/BYTES/PINNED/REDACTED) on the data row.
        const pLines = p.stdout.split('\n');
        const tLines = t.stdout.split('\n');
        expect(tLines.length).toBe(pLines.length);
        // Header row identical (no volatile content).
        expect(tLines[0]).toBe(pLines[0]);
        // Data row: split on 2-space gutter; check no/yes flags + counts align.
        const pCells = (pLines[1] as string).split(/\s{2,}/).map((c) => c.trim());
        const tCells = (tLines[1] as string).split(/\s{2,}/).map((c) => c.trim());
        // DOCS, CHUNKS, BYTES, PINNED, REDACTED (indices 1..5).
        expect(tCells.slice(1, 6)).toEqual(pCells.slice(1, 6));
    });

    itPy('empty namespace → (no ingests) table identical', () => {
        const [py, ts] = freshPair();
        const p = runPy(['list'], py);
        const t = runTs(['list'], ts);
        expect(t.status).toBe(0);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
    });
});

// ---------------------------------------------------------------------------
// forget — prefix match / ambiguity / miss
// ---------------------------------------------------------------------------

describe('knowledge_ingest — forget + pin', () => {
    itPy('forget by full id → forgot <id> + dir removed', () => {
        const root = freshRoot();
        fs.writeFileSync(path.join(root, 'a.md'), 'body\n');
        const ing = parseManifest(runTs(['ingest', 'a.md'], root).stdout);
        const id = String(ing['ingest_id']);
        const t = runTs(['forget', id], root);
        expect(t.status).toBe(0);
        expect(t.stdout).toBe(`forgot ${id}\n`);
        expect(fs.existsSync(path.join(root, 'agents', 'memory', 'knowledge', id))).toBe(false);
    });

    itPy('no-match prefix (namespace exists) → exit 2 stderr (parity)', () => {
        // The namespace dir must exist, else Python `iterdir()` raises an
        // uncaught FileNotFoundError (exit 1). Seed one ingest so the lookup
        // reaches the no-match IngestError path (exit 2).
        const [py, ts] = freshPair();
        for (const root of [py, ts]) {
            fs.writeFileSync(path.join(root, 'a.md'), 'body\n');
        }
        runPy(['ingest', 'a.md'], py);
        runTs(['ingest', 'a.md'], ts);
        const p = runPy(['forget', 'zzzznomatch'], py);
        const t = runTs(['forget', 'zzzznomatch'], ts);
        expect(p.status).toBe(2);
        expect(t.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
        expect(t.stdout).toBe(p.stdout);
    });

    itPy('no-match prefix (empty namespace) → exit 1 both sides (parity)', () => {
        // Python `iterdir()` on a missing dir raises an uncaught
        // FileNotFoundError → exit 1; the twin propagates the read error the
        // same way. Compare exit status only (traceback prose is not golden).
        const [py, ts] = freshPair();
        const p = runPy(['forget', 'zzz'], py);
        const t = runTs(['forget', 'zzz'], ts);
        expect(p.status).toBe(1);
        expect(t.status).toBe(1);
    });

    itPy('ambiguous prefix → exit 2 stderr (parity)', () => {
        // Seed two ingests sharing a 1-char prefix by reusing the same root for
        // both py and ts independently; the ambiguity message is count-based so
        // it is deterministic given two matches.
        const [py, ts] = freshPair();
        for (const root of [py, ts]) {
            const base = path.join(root, 'agents', 'memory', 'knowledge');
            // Hand-create two ingest dirs sharing prefix "01".
            for (const id of ['01aaaaaa-0000-7000-8000-000000000000', '01bbbbbb-0000-7000-8000-000000000000']) {
                fs.mkdirSync(path.join(base, id, 'chunks'), { recursive: true });
                fs.writeFileSync(path.join(base, id, 'manifest.json'), '{}\n');
            }
        }
        const p = runPy(['forget', '01'], py);
        const t = runTs(['forget', '01'], ts);
        expect(p.status).toBe(2);
        expect(t.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });

    itPy('list --pin / --unpin round-trip', () => {
        const root = freshRoot();
        fs.writeFileSync(path.join(root, 'a.md'), 'body\n');
        const ing = parseManifest(runTs(['ingest', 'a.md'], root).stdout);
        const id = String(ing['ingest_id']);
        const pinned = runTs(['list', '--pin', id.slice(0, 8)], root);
        expect(pinned.status).toBe(0);
        expect(pinned.stdout).toBe(`pinned ${id}\n`);
        const m1 = JSON.parse(
            fs.readFileSync(
                path.join(root, 'agents', 'memory', 'knowledge', id, 'manifest.json'),
                'utf8',
            ),
        ) as Record<string, unknown>;
        expect(m1['pinned']).toBe(true);
        const unpinned = runTs(['list', '--unpin', id.slice(0, 8)], root);
        expect(unpinned.stdout).toBe(`unpinned ${id}\n`);
    });
});
