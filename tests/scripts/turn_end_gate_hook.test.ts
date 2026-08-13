/**
 * `turn-end-gate` — the suite's first turn-END refusal.
 *
 * Two layers of test, on purpose:
 *
 *   · the DETECTORS are tested as pure functions, because roadmap step 3.4
 *     asks for a measured precision figure and a spawned process per corpus
 *     case would make that pass cost minutes instead of milliseconds;
 *   · the RE-ENTRANCY guard is tested through the real process, because its
 *     whole claim is about what a second Stop event does, and an in-process
 *     call cannot exercise `stop_hook_active` arriving on stdin.
 *
 * Round 6 recorded the reason the second half is not optional: "whichever
 * option the maintainer chooses, the guard's re-entrancy shape has to be
 * stated and tested before the concern is registered, not after."
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    alreadyRefusedTurn,
    detectCompletionClaim,
    detectLanguage,
    detectPromissory,
    detectUnverifiedEdit,
    deriveSessionKey,
    finalParagraph,
    isVerificationCommand,
    readCiSettled,
    readLanguagePin,
    readTranscriptTail,
    visibleProse,
    type ToolCall,
} from '../../src/scripts/hooks/turn_end_gate_hook.js';
import { STATE_FILE as CI_STATE_FILE } from '../../src/scripts/before_complete_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const HOOK = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'turn_end_gate_hook.ts');
const TSX = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const tmp_dirs: string[] = [];

/**
 * The gate itself no longer reads settings at all — the switch was removed and
 * it is always armed. This pin STAYS anyway: the spawned hook runs the real
 * dispatcher path, and anything it imports that does touch the settings cascade
 * would otherwise resolve the DEVELOPER's user-global layer and make the suite
 * pass or fail on one machine's state. Hermeticity is cheap; a
 * works-on-my-machine hook test is not.
 */
let _priorConfigHome: string | undefined;
beforeAll(() => {
    const empty = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'teg-global-')));
    tmp_dirs.push(empty);
    _priorConfigHome = process.env['EVENT4U_CONFIG_HOME'];
    process.env['EVENT4U_CONFIG_HOME'] = empty;
});
afterAll(() => {
    if (_priorConfigHome === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
    else process.env['EVENT4U_CONFIG_HOME'] = _priorConfigHome;
});

afterAll(() => {
    for (const d of tmp_dirs) {
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* best effort */
        }
    }
});

// ---------------------------------------------------------------------------
// The corpus. Step 3.4 asks for a measured precision per detector, so the
// positives and the must-not-fire cases live in one place and are counted.
// ---------------------------------------------------------------------------

/**
 * Promissory closings in the shape round 5 measured: the last paragraph
 * commits to work, and nothing in the turn asks the user anything.
 */
const PROMISSORY_POSITIVES: string[] = [
    'Der Fix ist drin.\n\nIch melde mich, sobald die CI durch ist.',
    'Branch steht.\n\nAls nächstes baue ich den Detektor.',
    'Ich habe den Hook registriert.\n\nIch gebe Dir Bescheid.',
    'Done with the refactor.\n\nI will report back once the suite finishes.',
    "Pushed.\n\nI'll let you know when the checks land.",
    'Analyse steht.\n\nIch werde jetzt die Tests schreiben.',
    'The manifest is updated.\n\nNext, I will wire the registry.',
    'Alles gelesen.\n\nIch berichte, sobald der Lauf fertig ist.',
    'Setup ist fertig.\n\nIch melde mich mit dem Ergebnis.',
    "Config landed.\n\nI am going to run the full pipeline now.",
];

/**
 * The shapes a blocking guard must NOT refuse. Every one of these is a
 * legitimate way to end a turn, and refusing them is what teaches a user to
 * disable the gate — the council's precision warning, made concrete.
 */
const PROMISSORY_NEGATIVES: string[] = [
    // A hand-back: the decision is explicitly the user's.
    'Ich habe drei Optionen gefunden.\n\nDas entscheidest Du.',
    'Der Branch ist veraltet.\n\nIch fasse ihn nicht ungefragt an — sag Bescheid.',
    // A blocking question IS the stop condition.
    'Zwei Wege sind möglich.\n\nSoll ich den ersten nehmen?',
    'I found two candidates.\n\nWhich one do you want?',
    // A promise the same turn then fulfils — the verb is past, not future.
    'Ich habe die Tests geschrieben und ausgeführt: 14 grün, 0 rot.',
    'I ran the full suite; every check passed.',
    // Plain completion, no forward commitment at all.
    'Der Hook ist registriert, der Typecheck ist grün.',
    'The gate is wired and the manifest lints clean.',
    // Waiting explicitly on the user.
    'Der Rest hängt an Deiner Freigabe.\n\nIch warte auf Deine Antwort.',
    "The remaining step needs your go-ahead. Let me know whether to proceed.",
];

describe('detector A — promissory closing (roadmap 3.2)', () => {
    it('the corpus is non-empty (dead-scope guard)', () => {
        // A precision figure computed over an empty corpus is a green light
        // that measured nothing — the repo's own documented failure class.
        expect(PROMISSORY_POSITIVES.length).toBeGreaterThanOrEqual(10);
        expect(PROMISSORY_NEGATIVES.length).toBeGreaterThanOrEqual(10);
    });

    it('fires on every measured promissory closing', () => {
        const missed = PROMISSORY_POSITIVES.filter((r) => detectPromissory(r) === null);
        expect(missed, `missed: ${JSON.stringify(missed, null, 2)}`).toEqual([]);
    });

    it('never fires on a legitimate hand-back, question, or completed claim', () => {
        const wrong = PROMISSORY_NEGATIVES.filter((r) => detectPromissory(r) !== null);
        expect(wrong, `false positives: ${JSON.stringify(wrong, null, 2)}`).toEqual([]);
    });

    it('reads the FINAL paragraph, not the whole reply', () => {
        // A promise made mid-reply and then fulfilled is not a promissory
        // CLOSING — the rule is about how the turn ends.
        const reply = 'Ich melde mich gleich.\n\nHabe es doch direkt gemacht: 12 Tests grün.';
        expect(detectPromissory(reply)).toBeNull();
    });

    it('quotes the span that triggered it, so the refusal is actionable', () => {
        const f = detectPromissory('Fertig.\n\nIch melde mich, sobald die CI grün ist.');
        expect(f?.evidence.toLowerCase()).toContain('ich melde mich');
    });
});

// ---------------------------------------------------------------------------
// Detector B
// ---------------------------------------------------------------------------

describe('detector B — language mismatch (roadmap 3.3)', () => {
    it('fires when the prose is English under a German pin', () => {
        const reply =
            'I have wired the hook into the manifest and the registry, and the typecheck is green now.';
        const f = detectLanguage(reply, 'de');
        expect(f).not.toBeNull();
        expect(f?.detector).toBe('language');
    });

    it('fires when the prose is German under an English pin', () => {
        const reply =
            'Ich habe den Hook in das Manifest und die Registry eingetragen, und der Typecheck ist jetzt grün.';
        expect(detectLanguage(reply, 'en')).not.toBeNull();
    });

    it('stays silent when the prose matches the pin', () => {
        const reply = 'Ich habe den Hook eingetragen, und der Typecheck ist jetzt grün.';
        expect(detectLanguage(reply, 'de')).toBeNull();
    });

    it('stays silent when there is no pin — absence is not an obligation', () => {
        expect(detectLanguage('Anything at all, in any language.', 'und')).toBeNull();
    });

    // --- 3.5 adversarial: the exclusions language-and-tone already states ---

    it('ADVERSARIAL: English inside a fenced code block does not flip a German turn', () => {
        const reply = [
            'Der Hook liest die Antwort so aus dem Transcript:',
            '',
            '```ts',
            'const last = lines.filter((l) => l.type === "assistant");',
            'if (!last) { throw new Error("no assistant message in the transcript file"); }',
            '```',
            '',
            'Damit ist der Pfad abgedeckt.',
        ].join('\n');
        expect(detectLanguage(reply, 'de')).toBeNull();
    });

    it('ADVERSARIAL: quoted English tool output does not flip a German turn', () => {
        const reply = [
            'Der Lauf ist rot. Die Ausgabe sagt:',
            '',
            '> error: cannot find module and the resolver gave up after three attempts',
            '> at Object.require (internal/modules/cjs/loader.js:1015:19)',
            '',
            'Ich habe die Ursache gefunden.',
        ].join('\n');
        expect(detectLanguage(reply, 'de')).toBeNull();
    });

    it('ADVERSARIAL: English identifiers and paths do not flip a German turn', () => {
        const reply =
            'Ich habe `src/scripts/hooks/turn_end_gate_hook.ts` angelegt und in ' +
            '`concern_registry.ts` eingetragen; `detectUnverifiedEdit` liest die Tool-Calls.';
        expect(detectLanguage(reply, 'de')).toBeNull();
    });

    it('ADVERSARIAL: a markdown table of English column names does not flip a German turn', () => {
        const reply = [
            'Die Belegung sieht so aus:',
            '',
            '| concern | severity | fail_closed |',
            '|---|---|---|',
            '| turn-end-gate | blocking | false |',
            '',
            'Mehr ist es nicht.',
        ].join('\n');
        expect(detectLanguage(reply, 'de')).toBeNull();
    });

    it('ADVERSARIAL: a short reply is not evidence of drift', () => {
        // Below the classifier's marker floor `classify` returns `und`, and
        // `und` must never refuse — a two-word answer carries no language
        // signal, and refusing one would be pure noise.
        expect(detectLanguage('Fertig.', 'en')).toBeNull();
        expect(detectLanguage('Done.', 'de')).toBeNull();
    });
});

describe('visibleProse — the exclusion set', () => {
    it('drops fenced blocks, inline code, quotes, tables, URLs and paths', () => {
        const prose = visibleProse(
            [
                'Text bleibt.',
                '```',
                'CODE_MUST_VANISH',
                '```',
                '`INLINE_MUST_VANISH`',
                '> QUOTED_MUST_VANISH',
                '| TABLE_MUST_VANISH |',
                'https://example.com/URL_MUST_VANISH',
                'src/scripts/PATH_MUST_VANISH.ts',
            ].join('\n'),
        );
        expect(prose).toContain('Text bleibt.');
        for (const gone of [
            'CODE_MUST_VANISH',
            'INLINE_MUST_VANISH',
            'QUOTED_MUST_VANISH',
            'TABLE_MUST_VANISH',
            'URL_MUST_VANISH',
            'PATH_MUST_VANISH',
        ]) {
            expect(prose, `${gone} survived the strip`).not.toContain(gone);
        }
    });

    it('drops an UNTERMINATED fence — a truncated reply must not leak code', () => {
        const prose = visibleProse('Vorher.\n\n```ts\nconst leak = "LEAK_MUST_VANISH";');
        expect(prose).toContain('Vorher.');
        expect(prose).not.toContain('LEAK_MUST_VANISH');
    });

    it('finalParagraph returns the last prose paragraph, ignoring a trailing code block', () => {
        const reply = 'Erster Absatz.\n\nLetzter Absatz.\n\n```\ncode\n```';
        expect(finalParagraph(reply)).toBe('Letzter Absatz.');
    });
});

// ---------------------------------------------------------------------------
// Workspace helper.
//
// The `settings — default OFF, detectors ON within it` describe block that used
// to live here is GONE, with its R2-6a/6b/6c regressions: the gate reads no
// settings any more, so `enabled: yes`, a trailing comment, and a block under
// the wrong parent are no longer things it can get wrong. What replaced those
// tests is one assertion in the spawned section below — a workspace with NO
// settings file at all must still refuse — which is the inversion of the case
// they were pinning and the only one that can regress now.
// ---------------------------------------------------------------------------

function makeWorkspace(settings?: string): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'turn-end-gate-')));
    tmp_dirs.push(dir);
    if (settings !== undefined) {
        fs.writeFileSync(path.join(dir, '.agent-settings.yml'), settings);
    }
    return dir;
}

describe('language pin', () => {
    it('absent pin ⇒ `und` ⇒ no obligation', () => {
        expect(readLanguagePin(makeWorkspace())).toBe('und');
    });

    it('reads the language the mirror hook wrote', () => {
        const dir = makeWorkspace();
        fs.mkdirSync(path.join(dir, 'agents', 'state'), { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'agents', 'state', 'language-mirror.json'),
            JSON.stringify({ language: 'de', source: 'prompt' }),
        );
        expect(readLanguagePin(dir)).toBe('de');
    });

    it('a malformed pin is treated as absent, never as a default', () => {
        const dir = makeWorkspace();
        fs.mkdirSync(path.join(dir, 'agents', 'state'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'agents', 'state', 'language-mirror.json'), '{ not json');
        expect(readLanguagePin(dir)).toBe('und');
    });
});

/**
 * Round 7 § Phase 1 — detector D: a completion claim over an unsettled CI read.
 *
 * The measured class (14 instances, every one costing the user a turn) is
 * "Fertig" while checks are still running. The three negative cases below are the
 * point of the detector, not an afterthought: a blocking guard that refuses a
 * legitimate completion teaches the user to switch it off.
 */
describe('detector D — completion claim over unsettled CI (round 7)', () => {
    function writeCi(dir: string, ci: unknown): void {
        const target = path.join(dir, CI_STATE_FILE);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, JSON.stringify({ schema_version: 1, ci_last: ci }));
    }

    const UNSETTLED = { seen: true, settled: false };
    const SETTLED = { seen: true, settled: true };
    const NEVER_SEEN = { seen: false, settled: false };

    it('fires on the measured German shape', () => {
        const f = detectCompletionClaim('Fertig, Matze — der komplette Auftrag ist durch.', UNSETTLED);
        expect(f?.detector).toBe('completion');
        expect(f?.evidence).toContain('Fertig');
    });

    it('fires on "Damit ist alles erledigt."', () => {
        expect(detectCompletionClaim('Damit ist alles erledigt.', UNSETTLED)).not.toBeNull();
    });

    // --- the three cases that must NOT fire (roadmap 1.4) ---

    it('does NOT fire when the CI read was settled', () => {
        expect(detectCompletionClaim('Fertig, Matze.', SETTLED)).toBeNull();
    });

    it('does NOT fire in a session that never read CI', () => {
        expect(detectCompletionClaim('Fertig, Matze.', NEVER_SEEN)).toBeNull();
    });

    it('does NOT fire on an unsettled read with no completion claim', () => {
        expect(
            detectCompletionClaim('Die CI läuft noch, ich warte auf das Settle.', UNSETTLED),
        ).toBeNull();
    });

    // Measured 2026-08-12: three of ten realistic closings were refused, and every
    // one of them was an honest "not done yet" line — the shape this gate exists
    // to encourage. A line-anchored keyword cannot separate "Fertig." from
    // "Fertig ist der Fix noch nicht."; a same-line negation check can.
    it('does NOT fire when the same line negates the claim', () => {
        for (const reply of [
            'Fertig ist der Fix noch nicht — die CI läuft.',
            'Fertig? Nein, zwei Shards laufen noch.',
            'Task complete wäre verfrüht — 3 Checks pending.',
            'Done, not yet — waiting on the last shard.',
        ]) {
            expect(detectCompletionClaim(reply, UNSETTLED), reply).toBeNull();
        }
    });

    it('still fires on a real claim on an unsettled read', () => {
        for (const reply of ['Fertig, Matze.', '**Fertig** — der PR steht.', 'Done.']) {
            expect(detectCompletionClaim(reply, UNSETTLED), reply).not.toBeNull();
        }
    });

    // The negation must be on the CLAIM's own line: a later line saying something
    // is unfinished does not retract a completion claim made above it.
    it('does not let a negation on a DIFFERENT line suppress the claim', () => {
        expect(
            detectCompletionClaim('Fertig, Matze.\n\nDer Rest ist noch nicht dran.', UNSETTLED),
        ).not.toBeNull();
    });

    it('does NOT fire on "fertig" inside a sentence about something else', () => {
        expect(
            detectCompletionClaim(
                'Der Generator ist noch nicht fertig konfiguriert, deshalb prüfe ich das.',
                UNSETTLED,
            ),
        ).toBeNull();
    });

    it('does NOT fire on a completion claim inside quoted tool output', () => {
        expect(
            detectCompletionClaim('Das Log sagt:\n\n```\nFertig.\n```\n\nIch lese weiter.', UNSETTLED),
        ).toBeNull();
    });

    // --- readCiSettled: absence is never a settle, and never a refusal ---

    it('no state file ⇒ not seen ⇒ the detector cannot fire', () => {
        expect(readCiSettled(makeWorkspace())).toEqual(NEVER_SEEN);
    });

    it('a malformed state file is treated as not seen', () => {
        const dir = makeWorkspace();
        const target = path.join(dir, CI_STATE_FILE);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, '{ not json');
        expect(readCiSettled(dir)).toEqual(NEVER_SEEN);
    });

    it('ci_last null ⇒ not seen', () => {
        const dir = makeWorkspace();
        writeCi(dir, null);
        expect(readCiSettled(dir)).toEqual(NEVER_SEEN);
    });

    it('reads an unsettled record the producer wrote', () => {
        const dir = makeWorkspace();
        writeCi(dir, { at: '2026-08-12T00:00:00+00:00', pending: 3, settled: false });
        expect(readCiSettled(dir)).toEqual(UNSETTLED);
    });

    it('reads a settled record the producer wrote', () => {
        const dir = makeWorkspace();
        writeCi(dir, { at: '2026-08-12T00:00:00+00:00', pending: 0, settled: true });
        expect(readCiSettled(dir)).toEqual(SETTLED);
    });
});

// ---------------------------------------------------------------------------
// Re-entrancy — through the real process (roadmap 3.1)
// ---------------------------------------------------------------------------

interface Run {
    status: number;
    stdout: string;
    stderr: string;
}

/**
 * A workspace with a German pin and a fake $HOME for transcripts.
 *
 * No settings file is written, and that omission is the point: the gate is
 * always armed, so every spawned test below runs against a workspace that opts
 * into nothing. This helper used to write `enabled: true`.
 */
function makeGateWorkspace(): { dir: string; home: string } {
    const dir = makeWorkspace();
    fs.mkdirSync(path.join(dir, 'agents', 'state'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'agents', 'state', 'language-mirror.json'),
        JSON.stringify({ language: 'de', source: 'prompt' }),
    );
    const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'turn-end-gate-home-')));
    tmp_dirs.push(home);
    return { dir, home };
}

/**
 * Write a transcript. `userTexts` is EVERY user-role entry in order, so a test
 * can control the turn ordinal — and can include a harness-shaped entry to
 * prove it does not count.
 */
function writeTranscript(home: string, userTexts: string[], assistantText: string): string {
    const file = path.join(
        home,
        `transcript-${Math.abs(hashish(userTexts.join('|') + assistantText))}.jsonl`,
    );
    fs.writeFileSync(
        file,
        [
            ...userTexts.map((t) => JSON.stringify({ type: 'user', message: { content: t } })),
            JSON.stringify({
                type: 'assistant',
                message: { content: [{ type: 'text', text: assistantText }] },
            }),
        ].join('\n') + '\n',
    );
    return file;
}

/** Deterministic, seed-free — `Math.random` would break replay. */
function hashish(s: string): number {
    let h = 0;
    for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return h;
}

function envelopeJson(
    workspaceRoot: string,
    transcriptPath: string,
    extraPayload: Record<string, unknown> = {},
): string {
    return JSON.stringify({
        schema_version: 1,
        platform: 'claude',
        event: 'stop',
        native_event: 'Stop',
        session_id: 'sess-turn-end-gate',
        workspace_root: workspaceRoot,
        payload: { transcript_path: transcriptPath, ...extraPayload },
        settings: {},
    });
}

/**
 * `HOME` is the fake home, which does two things at once and is why the hook
 * needs no test-only seam of its own (R2 finding 13 removed the old
 * `AGENT_CONFIG_TRANSCRIPT_HOME`): `os.homedir()` honours it, so the
 * transcript-confinement check is exercised against a temp root, AND the
 * settings cascade resolves its user-global layer under that same root, which
 * keeps these tests hermetic against the developer's real global settings.
 * `EVENT4U_CONFIG_HOME` is the cascade's own documented test override, set as a
 * belt for the same reason.
 */
function runHook(cwd: string, stdin: string, home: string): Run {
    const r = spawnSync(TSX, [HOOK], {
        encoding: 'utf8',
        cwd,
        input: stdin,
        env: {
            ...process.env,
            HOME: home,
            USERPROFILE: home,
            EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
        },
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const PROMISE = 'Der Branch steht.\n\nIch melde mich, sobald die CI grün ist.';
const CLEAN = 'Der Branch steht, die Tests sind grün, mehr war nicht zu tun.';

describe('the gate, end to end', () => {
    it('refuses a promissory closing with exit 1 and the reason on STDERR', () => {
        const { dir, home } = makeGateWorkspace();
        const t = writeTranscript(home, ['mach weiter'], PROMISE);
        const r = runHook(dir, envelopeJson(dir, t), home);

        expect(r.status, r.stderr).toBe(1); // dispatcher-internal EXIT_BLOCK
        expect(r.stderr).toContain('turn-end-gate');
        expect(r.stderr).toContain('promissory');
        // stdout is discarded by the host at a block — the reason must not go there.
        expect(r.stdout).toBe('');
    });

    it('lets a clean turn end, silently', () => {
        const { dir, home } = makeGateWorkspace();
        const t = writeTranscript(home, ['mach weiter'], CLEAN);
        const r = runHook(dir, envelopeJson(dir, t), home);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stderr).toBe('');
    });

    // road-to-subagent-lifecycle-integrity Phase 3 Step 2. A turn waiting on an
    // async subagent cannot finish the outstanding work in THIS turn, so
    // refusing it produces the upstream Stop-hook x async-subagent loop
    // (anthropics/claude-code#55754): refuse, cannot proceed, refuse again.
    function plantOpenDispatch(dir: string, startedAt: string = new Date().toISOString()): void {
        const openDir = path.join(dir, 'agents', 'runtime', 'state', 'subagent-ledger', 'open');
        fs.mkdirSync(openDir, { recursive: true });
        fs.writeFileSync(
            path.join(openDir, 'aaaaaaaaaaaa.json'),
            JSON.stringify({
                ref: 'aaaaaaaaaaaa',
                agent_type: 'Explore',
                started_at: startedAt,
                parent_ref: null,
                depth: 1,
                depth_basis: 'assumed-root',
                session_id: null,
            }),
            'utf8',
        );
    }

    it('never refuses a turn-end while a subagent dispatch is still open', () => {
        const { dir, home } = makeGateWorkspace();
        // The exact reply the gate refuses with no open dispatch (the first
        // test in this block proves that), so a pass here can only come from
        // the open-dispatch allow path — not from an innocuous reply.
        const t = writeTranscript(home, ['mach weiter'], PROMISE);
        plantOpenDispatch(dir);

        const r = runHook(dir, envelopeJson(dir, t), home);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stderr).toBe('');
    });

    it('still refuses once the dispatch closes — the allow path is not a kill switch', () => {
        const { dir, home } = makeGateWorkspace();
        const t = writeTranscript(home, ['mach weiter'], PROMISE);
        plantOpenDispatch(dir);
        // Removing the record is exactly what a stop event does.
        fs.rmSync(path.join(dir, 'agents', 'runtime', 'state', 'subagent-ledger', 'open'), {
            recursive: true,
            force: true,
        });

        const r = runHook(dir, envelopeJson(dir, t), home);
        expect(r.status, r.stderr).toBe(1);
        expect(r.stderr).toContain('promissory');
    });

    it('an open dispatch does NOT excuse a language mismatch (R2 round 2, finding 2)', () => {
        // Step 2 scopes the allow to the completion-adjacent detectors. A
        // pending dispatch says nothing about which language the reply is in,
        // so detector B must still fire — the earlier version returned early
        // and silenced all four.
        const { dir, home } = makeGateWorkspace();
        fs.mkdirSync(path.join(dir, 'agents', 'state'), { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'agents', 'state', 'language-mirror.json'),
            JSON.stringify({ language: 'de', source: 'prompt' }),
        );
        const t = writeTranscript(
            home,
            ['mach weiter'],
            'The change is applied and the tests are green across the whole suite here.',
        );
        plantOpenDispatch(dir);

        const r = runHook(dir, envelopeJson(dir, t), home);
        expect(r.status, r.stderr).toBe(1);
        expect(r.stderr).toContain('language');
    });

    it('a LEAKED open record does not disable the gate for ever (R2 round 2, finding 1)', () => {
        // The dispatch that never returns is the symptom this roadmap targets,
        // and reaping only happens on the NEXT subagent event — which, for a
        // dispatch that never returns, may never come. Without the TTL filter
        // this record would allow every turn-end from here on, silently.
        const { dir, home } = makeGateWorkspace();
        const t = writeTranscript(home, ['mach weiter'], PROMISE);
        const ancient = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        plantOpenDispatch(dir, ancient);

        const r = runHook(dir, envelopeJson(dir, t), home);
        expect(r.status, r.stderr).toBe(1);
        expect(r.stderr).toContain('promissory');
    });

    // Round 7 § Phase 1 — the completion detector THROUGH the real process, not
    // only as a pure function. The unit tests prove the predicate; this proves it
    // is wired: a detector that is correct and unreachable is the shape this
    // repo's own memory calls "defined but not wired".
    function writeCiState(dir: string, settled: boolean): void {
        const target = path.join(dir, CI_STATE_FILE);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(
            target,
            JSON.stringify({
                schema_version: 1,
                ci_last: { at: '2026-08-12T00:00:00+00:00', pending: settled ? 0 : 3, settled },
            }),
        );
    }

    const DONE = 'Fertig, Matze. Der komplette Auftrag ist durch, alles gemergt.';

    it('refuses a completion claim while the recorded CI read is unsettled', () => {
        const { dir, home } = makeGateWorkspace();
        writeCiState(dir, false);
        const t = writeTranscript(home, ['mach weiter'], DONE);
        const r = runHook(dir, envelopeJson(dir, t), home);
        expect(r.status, r.stderr).toBe(1);
        expect(r.stderr).toContain('completion');
        expect(r.stdout).toBe('');
    });

    it('lets the SAME claim through once the CI read is settled', () => {
        const { dir, home } = makeGateWorkspace();
        writeCiState(dir, true);
        const t = writeTranscript(home, ['mach weiter'], DONE);
        const r = runHook(dir, envelopeJson(dir, t), home);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stderr).toBe('');
    });

    it('lets the same claim through when no CI was ever observed', () => {
        // No state file at all — a session that never touched CI must never be
        // refused for it, and this is the case an over-eager version would break.
        const { dir, home } = makeGateWorkspace();
        const t = writeTranscript(home, ['mach weiter'], DONE);
        const r = runHook(dir, envelopeJson(dir, t), home);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stderr).toBe('');
    });

    it('is ARMED with no settings file at all — the inverted invariant', () => {
        // This assertion used to read `toBe(0)` under the title "is a no-op
        // while the master switch is off". The switch is gone: an install that
        // opts into nothing gets the gate. Whether it FIRES is decided one
        // level down, by the detector — which is why the sibling test above,
        // same workspace and a clean reply, still exits 0.
        const dir = makeWorkspace(); // no settings file at all
        const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'turn-end-gate-home-')));
        tmp_dirs.push(home);
        const t = writeTranscript(home, ['mach weiter'], PROMISE);
        const r = runHook(dir, envelopeJson(dir, t), home);
        expect(r.status, r.stderr).toBe(1);
        expect(r.stderr).toContain('promissory');
    });

    it('a leftover `hooks.turn_end_gate.enabled: false` cannot disarm it', () => {
        // The removed key is ignored, not honoured. An older install carrying
        // the opt-out must not silently keep the gate off — that is the exact
        // shape a deletion gets wrong, and REMOVED_KEYS only warns.
        const dir = makeWorkspace('hooks:\n  turn_end_gate:\n    enabled: false\n');
        fs.mkdirSync(path.join(dir, 'agents', 'state'), { recursive: true });
        const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'turn-end-gate-home-')));
        tmp_dirs.push(home);
        const t = writeTranscript(home, ['mach weiter'], PROMISE);
        const r = runHook(dir, envelopeJson(dir, t), home);
        expect(r.status, r.stderr).toBe(1);
    });

    // --- the two re-entrancy layers, each proven ALONE ---

    it('LAYER 1: `stop_hook_active` alone stops a second refusal', () => {
        const { dir, home } = makeGateWorkspace();
        const t = writeTranscript(home, ['mach weiter'], PROMISE);
        // No prior run, so no state marker exists — only the host flag can
        // be doing the work here.
        const r = runHook(dir, envelopeJson(dir, t, { stop_hook_active: true }), home);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stderr).toBe('');
    });

    it('LAYER 2: the turn marker alone stops a second refusal, even on a NEW reply', () => {
        const { dir, home } = makeGateWorkspace();
        const first = runHook(dir, envelopeJson(dir, writeTranscript(home, ['mach weiter'], PROMISE)), home);
        expect(first.status, first.stderr).toBe(1);

        // The model answered the refusal with a DIFFERENT reply that still
        // promises. Same user prompt ⇒ same turn ⇒ must not refuse again.
        // `stop_hook_active` is deliberately absent, so layer 2 is on its own.
        const second = runHook(
            dir,
            envelopeJson(dir, writeTranscript(home, ['mach weiter'], 'Ok.\n\nIch melde mich gleich.')),
            home,
        );
        expect(second.status, second.stderr).toBe(0);
        expect(second.stderr).toBe('');
    });

    it('a NEW user prompt re-arms the gate — the marker must not wedge the session', () => {
        const { dir, home } = makeGateWorkspace();
        const first = runHook(dir, envelopeJson(dir, writeTranscript(home, ['erster prompt'], PROMISE)), home);
        expect(first.status, first.stderr).toBe(1);

        const nextTurn = runHook(
            dir,
            envelopeJson(dir, writeTranscript(home, ['erster prompt', 'zweiter prompt'], PROMISE)),
            home,
        );
        expect(nextTurn.status, nextTurn.stderr).toBe(1);
    });

    // --- R2 finding 2: the regression the old test could not see -------------

    it('R2-2: a REPEATED prompt text still gets refused — the key is the turn, not the text', () => {
        // The text-keyed version resolved the second identical prompt to the
        // SAME key as the first refused turn and allowed it unconditionally.
        // "weiter" / "ok" / "1" are the dominant prompt shape in the corpus
        // this gate was built from, so that bug disabled the gate exactly where
        // it was meant to work. Both turns below carry byte-identical text.
        const { dir, home } = makeGateWorkspace();

        const first = runHook(dir, envelopeJson(dir, writeTranscript(home, ['weiter'], PROMISE)), home);
        expect(first.status, first.stderr).toBe(1);

        const second = runHook(
            dir,
            envelopeJson(dir, writeTranscript(home, ['weiter', 'weiter'], PROMISE)),
            home,
        );
        expect(second.status, second.stderr).toBe(1);
    });

    it('R2-3: a harness-injected user entry does NOT re-arm the gate mid-turn', () => {
        // A compaction summary and a `<system-reminder>` both arrive in the
        // user role. Counting them moved the key WITHIN one turn, minting a
        // fresh marker and letting the same turn be refused twice on any host
        // that sends no `stop_hook_active` — the wedge layer 2 exists to stop.
        const { dir, home } = makeGateWorkspace();
        const synthetic = `<system-reminder>\n${'This is harness text, not a chat message. '.repeat(80)}\n</system-reminder>`;

        const first = runHook(dir, envelopeJson(dir, writeTranscript(home, ['weiter'], PROMISE)), home);
        expect(first.status, first.stderr).toBe(1);

        const afterInjection = runHook(
            dir,
            envelopeJson(dir, writeTranscript(home, ['weiter', synthetic], PROMISE)),
            home,
        );
        expect(afterInjection.status, afterInjection.stderr).toBe(0);
        expect(afterInjection.stderr).toBe('');
    });

    it('R2-17: refusal state is ONE file per session, not one per refused turn', () => {
        const { dir, home } = makeGateWorkspace();
        for (const prompts of [['a'], ['a', 'b'], ['a', 'b', 'c']]) {
            runHook(dir, envelopeJson(dir, writeTranscript(home, prompts, PROMISE)), home);
        }
        const stateDir = path.join(dir, 'agents', 'runtime', 'state', 'turn-end-gate');
        // `.json` only — `atomic_write_json` leaves its own `.dispatcher.lock`
        // beside the payload, and counting directory entries would make this
        // assert the writer's internals rather than the state shape.
        const files = fs.existsSync(stateDir)
            ? fs.readdirSync(stateDir).filter((f) => f.endsWith('.json'))
            : [];
        // Three refused turns, one session ⇒ exactly one state file. The old
        // per-turn files accumulated with no TTL and nothing pruned them.
        expect(files).toHaveLength(1);
    });

    it('an unreadable transcript lets the turn END — never a wedge', () => {
        const { dir, home } = makeGateWorkspace();
        const r = runHook(dir, envelopeJson(dir, path.join(home, 'does-not-exist.jsonl')), home);
        expect(r.status, r.stderr).toBe(0);
    });

    it('a transcript OUTSIDE the home root is refused, and the turn still ends', () => {
        const { dir, home } = makeGateWorkspace();
        const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'turn-end-gate-out-')));
        tmp_dirs.push(outside);
        const t = path.join(outside, 'evil.jsonl');
        fs.writeFileSync(
            t,
            JSON.stringify({ type: 'assistant', message: { content: PROMISE } }) + '\n',
        );
        const r = runHook(dir, envelopeJson(dir, t), home);
        expect(r.status, r.stderr).toBe(0);
    });

    it('malformed stdin lets the turn END', () => {
        const { dir, home } = makeGateWorkspace();
        const r = runHook(dir, 'not json at all', home);
        expect(r.status, r.stderr).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Through the REAL dispatcher — the only place the host-facing code appears
// ---------------------------------------------------------------------------

const DISPATCH_ENTRY = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'dispatch_entry.ts');

/**
 * A raw Claude Stop payload — what the host actually sends, not the
 * dispatcher envelope. Raw-tsx tests above see the dispatcher-INTERNAL code
 * (1 = block); only this path sees the HOST-facing code (2 = refuse). A
 * concern that returned 1 and mapped to 0 would pass every test above while
 * refusing nothing, which is exactly the class this file exists to disprove.
 */
function runDispatcher(workspace: string, transcriptPath: string, home: string): Run {
    const r = spawnSync(
        TSX,
        [DISPATCH_ENTRY, '--platform', 'claude', '--event', 'stop', '--project-dir', workspace],
        {
            encoding: 'utf-8',
            cwd: workspace,
            input: JSON.stringify({
                session_id: 'turn-end-gate-dispatch',
                cwd: workspace,
                hook_event_name: 'Stop',
                transcript_path: transcriptPath,
                stop_hook_active: false,
            }),
            timeout: 120_000,
            env: {
                ...process.env,
                AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT,
                HOME: home,
                USERPROFILE: home,
                EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
            },
        },
    );
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('claude stop — the refusal actually reaches the host', () => {
    it('exits 2, not 1 — exit 1 on stop would let the turn end anyway', () => {
        const { dir, home } = makeGateWorkspace();
        const t = writeTranscript(home, ['mach weiter'], PROMISE);
        const r = runDispatcher(dir, t, home);
        expect(r.status, `stderr: ${r.stderr.slice(0, 600)}`).toBe(2);
    });

    it('puts the concern’s OWN reason on stderr, not a generic label', () => {
        const { dir, home } = makeGateWorkspace();
        const t = writeTranscript(home, ['mach weiter'], PROMISE);
        const r = runDispatcher(dir, t, home);
        expect(r.stderr).toContain('turn-end-gate');
        expect(r.stderr).not.toBe('blocked by agent-config hook policy\n');
    });

    it('a clean turn ends with 0 through the same path', () => {
        const { dir, home } = makeGateWorkspace();
        const t = writeTranscript(home, ['mach weiter'], CLEAN);
        const r = runDispatcher(dir, t, home);
        expect(r.status, `stderr: ${r.stderr.slice(0, 600)}`).toBe(0);
    });
});

describe('the turn identity — ordinal, never text (R2 findings 2 + 3)', () => {
    it('the session key depends on the session and nothing else', () => {
        expect(deriveSessionKey('s1')).toBe(deriveSessionKey('s1'));
        expect(deriveSessionKey('s1')).not.toBe(deriveSessionKey('s2'));
    });

    it('the marker matches only the ordinal it was written for', () => {
        const dir = makeWorkspace();
        const key = deriveSessionKey('s1');
        fs.mkdirSync(path.join(dir, 'agents', 'runtime', 'state', 'turn-end-gate'), {
            recursive: true,
        });
        fs.writeFileSync(
            path.join(dir, 'agents', 'runtime', 'state', 'turn-end-gate', `${key}.json`),
            JSON.stringify({ refused_turn: 3, detector: 'promissory' }),
        );
        expect(alreadyRefusedTurn(dir, key, 3)).toBe(true);
        expect(alreadyRefusedTurn(dir, key, 4)).toBe(false);
        // A different session never reads another session's marker.
        expect(alreadyRefusedTurn(dir, deriveSessionKey('s2'), 3)).toBe(false);
    });

    it('absent or malformed state means not-refused — fail-open, never a wedge', () => {
        const dir = makeWorkspace();
        const key = deriveSessionKey('s1');
        expect(alreadyRefusedTurn(dir, key, 1)).toBe(false);
        fs.mkdirSync(path.join(dir, 'agents', 'runtime', 'state', 'turn-end-gate'), {
            recursive: true,
        });
        fs.writeFileSync(
            path.join(dir, 'agents', 'runtime', 'state', 'turn-end-gate', `${key}.json`),
            '{ not json',
        );
        expect(alreadyRefusedTurn(dir, key, 1)).toBe(false);
    });
});

describe('R2 finding 4 — a stated refusal to act is not a promise', () => {
    // Each of these fired on the shipped regex, whose lookahead excluded only
    // the literal `nicht`. All four are live false refusals on a BLOCKING
    // guard: none is caught by HANDBACK and none carries a `?`.
    const NEGATIONS = [
        'Fertig.\n\nIch werde nichts anfassen.',
        'Fertig.\n\nIch werde keine Tests schreiben.',
        'Fertig.\n\nIch werde niemals raten.',
        'Fertig.\n\nIch werde nie ungefragt pushen.',
        'Fertig.\n\nIch werde gefragt, ob die Regeln passen.',
    ];

    it('does not fire on any of them', () => {
        const wrong = NEGATIONS.filter((r) => detectPromissory(r) !== null);
        expect(wrong, `false refusals: ${JSON.stringify(wrong, null, 2)}`).toEqual([]);
    });

    it('still fires on the affirmative form — the fix must not disarm the detector', () => {
        expect(detectPromissory('Fertig.\n\nIch werde jetzt die Tests schreiben.')).not.toBeNull();
    });
});

describe('R2 finding 5 — CommonMark allows a LONGER closing fence', () => {
    it('a longer closing fence does not delete the reply tail', () => {
        // Pass 1 used a `\1` backreference, so a three-tilde block closed with
        // four did not match, and the greedy tail-drop then removed everything
        // after it — including the closing paragraph detector A must read.
        const reply = ['Vorher.', '~~~ts', 'const x = 1;', '~~~~', '', 'Ich melde mich, sobald die CI grün ist.'].join('\n');
        expect(visibleProse(reply)).toContain('Ich melde mich');
        expect(visibleProse(reply)).not.toContain('const x');
        expect(detectPromissory(reply)).not.toBeNull();
    });

    it('same for a three-backtick block closed with six', () => {
        const reply = ['Vorher.', '```ts', 'const y = 2;', '``````', '', 'Als nächstes baue ich den Rest.'].join('\n');
        expect(visibleProse(reply)).toContain('Als nächstes');
        expect(visibleProse(reply)).not.toContain('const y');
    });

    it('a genuinely unterminated fence still drops the tail', () => {
        const prose = visibleProse('Vorher.\n\n```ts\nconst leak = "LEAK_MUST_VANISH";');
        expect(prose).toContain('Vorher.');
        expect(prose).not.toContain('LEAK_MUST_VANISH');
    });

    // --- round 2, finding 1: the regression the round-1 fix INTRODUCED --------

    it('R2r2-1: a MIXED-character nested fence does not delete the reply tail', () => {
        // `~~~` outer with ``` inner is the shape `markdown-safe-codeblocks`
        // prescribes as its DEFAULT. The character-matching regex stopped at the
        // inner ``` line, declined it on the mismatch, and the greedy tail-drop
        // then removed everything from the opener onward — so the round-1 "fix"
        // was WORSE than what it replaced on the more common input. Neither
        // regex could get this right; the scanner can.
        const reply = [
            'Vorher.',
            '~~~markdown',
            'Beispiel für einen inneren Block:',
            '```ts',
            'const inner = 1;',
            '```',
            '~~~',
            '',
            'Ich melde mich, sobald die CI grün ist.',
        ].join('\n');
        const prose = visibleProse(reply);
        expect(prose).toContain('Vorher.');
        expect(prose).toContain('Ich melde mich');
        expect(prose).not.toContain('const inner');
        // And the closing paragraph is readable again, which is the point.
        expect(detectPromissory(reply)).not.toBeNull();
    });

    it('R2r2-1: an inner fence of the SAME character does not close the block early', () => {
        const reply = ['Vorher.', '````md', '```', 'inner_must_vanish', '```', '````', '', 'Fertig, nichts offen.'].join('\n');
        const prose = visibleProse(reply);
        expect(prose).not.toContain('inner_must_vanish');
        expect(prose).toContain('Fertig');
    });
});

describe('round 2, findings 15 + 16 — detector A precision and recall', () => {
    it('R2r2-15: an umlaut infinitive is reachable', () => {
        // `\\b\\w{3,}en\\b` could not reach `prüfen` / `lösen`: ü and ö are not
        // `\\w`, so they create a word boundary. Verified against the literal
        // regex before and after.
        for (const r of [
            'Fertig.\n\nIch werde die Datei prüfen.',
            'Fertig.\n\nIch werde das lösen.',
            'Fertig.\n\nIch werde die Regeln überfliegen.',
        ]) {
            expect(detectPromissory(r), r).not.toBeNull();
        }
    });

    it('R2r2-16: a question mid-paragraph is no longer a one-character bypass', () => {
        // `includes('?')` let any rhetorical or quoted question disable a
        // blocking guard. Only a question that ENDS the paragraph is a hand-back.
        const bypass = 'Fertig.\n\nWarum auch nicht? Ich melde mich, sobald die CI grün ist.';
        expect(detectPromissory(bypass)).not.toBeNull();
    });

    it('R2r2-16: a real closing question still yields to the user', () => {
        expect(detectPromissory('Zwei Wege sind möglich.\n\nSoll ich den ersten nehmen?')).toBeNull();
        // Trailing quote/bracket after the mark still counts as a closing question.
        expect(detectPromissory('Zwei Wege.\n\nWelchen nimmst Du (1 oder 2)?')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Detector C — an edit the turn never verified (dispatch-safety 4.3)
// ---------------------------------------------------------------------------

function call(name: string, extra: { command?: string; path?: string } = {}): ToolCall {
    return { name, ...extra };
}

describe('isVerificationCommand — narrow on purpose', () => {
    it('claims the project runners', () => {
        for (const cmd of [
            'task test',
            'task ci',
            'task typecheck-ts',
            'npx vitest run tests/x.test.ts',
            'npm run check',
            'pnpm test',
            'composer test',
            'php artisan test --filter=Foo',
            'go test ./...',
            'cargo clippy',
            'pytest -k foo',
            'npx tsc --noEmit',
            'npx eslint src',
            './scripts-run src/scripts/validate_frontmatter',
        ]) {
            expect(isVerificationCommand(cmd), cmd).toBe(true);
        }
    });

    it('does NOT claim an ordinary shell call', () => {
        // The rejected alternative — "any Bash call verifies" — would let `ls`
        // clear an unverified edit, which is the partial-verification failure
        // verify-before-complete names.
        for (const cmd of ['ls -la', 'git status', 'cat README.md', 'mkdir -p out', 'echo hi']) {
            expect(isVerificationCommand(cmd), cmd).toBe(false);
        }
    });
});

describe('detectUnverifiedEdit', () => {
    it('is silent on a turn that edited nothing', () => {
        expect(detectUnverifiedEdit([call('Read'), call('Bash', { command: 'ls' })])).toBeNull();
        expect(detectUnverifiedEdit([])).toBeNull();
    });

    it('fires when an edit is followed by no verification at all', () => {
        const f = detectUnverifiedEdit([call('Edit', { path: 'src/a.ts' })]);
        expect(f?.detector).toBe('verification');
        expect(f?.evidence).toBe('src/a.ts');
    });

    it('fires when the only shell call after the edit cannot have checked it', () => {
        const f = detectUnverifiedEdit([
            call('Edit', { path: 'src/a.ts' }),
            call('Bash', { command: 'git status' }),
        ]);
        expect(f).not.toBeNull();
    });

    it('is silent when a verification run follows the edit', () => {
        expect(
            detectUnverifiedEdit([
                call('Write', { path: 'src/a.ts' }),
                call('Bash', { command: 'task test -- --filter=a' }),
            ]),
        ).toBeNull();
    });

    it('fires when the verification ran BEFORE the last edit', () => {
        // The freshness clause, and the only thing that separates this case from
        // the one above: a run before the final edit did not exercise it.
        const f = detectUnverifiedEdit([
            call('Edit', { path: 'src/a.ts' }),
            call('Bash', { command: 'npx vitest run' }),
            call('Edit', { path: 'src/b.ts' }),
        ]);
        expect(f?.evidence).toBe('src/b.ts');
    });

    it('covers every write tool, not just Edit', () => {
        for (const name of ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']) {
            expect(detectUnverifiedEdit([call(name, { path: 'x' })]), name).not.toBeNull();
        }
    });

    it('names the tool when the call carried no path', () => {
        expect(detectUnverifiedEdit([call('Write')])?.evidence).toBe('Write');
    });

    it('never quotes a file body — the evidence is a path or a tool name', () => {
        // `ToolCall` has no field able to hold content, so this is a property of
        // the type rather than of a scrubber. Pinned because the evidence span is
        // written into a refusal a human reads.
        const f = detectUnverifiedEdit([call('Edit', { path: 'src/a.ts' })]);
        expect(Object.keys({ ...call('Edit', { path: 'x' }) }).sort()).toEqual(['name', 'path']);
        expect(f?.evidence).not.toContain('\n');
    });
});

describe('readTranscriptTail — tool calls of the CURRENT turn', () => {
    function transcript(home: string, entries: unknown[]): string {
        const file = path.join(home, `tools-${entries.length}-${Math.abs(hashish(JSON.stringify(entries)))}.jsonl`);
        fs.writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
        return file;
    }
    const user = (text: string) => ({ type: 'user', message: { content: text } });
    const toolUse = (name: string, input: Record<string, unknown>) => ({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name, input }] },
    });
    const say = (text: string) => ({
        type: 'assistant',
        message: { content: [{ type: 'text', text }] },
    });

    let home: string;
    beforeAll(() => {
        home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'turn-end-tools-')));
        tmp_dirs.push(home);
    });

    it('collects a tool_use block that carries no text at all', () => {
        // The regression this pins: reading tool calls after the `text === null`
        // guard would drop exactly the entries the detector needs, because a
        // tool-only assistant entry has no text block.
        const t = transcript(home, [
            user('los'),
            toolUse('Edit', { file_path: 'src/a.ts' }),
            say('fertig'),
        ]);
        const tail = readTranscriptTail(t, { homeDir: home });
        expect(tail.toolCalls.map((c) => c.name)).toEqual(['Edit']);
        expect(tail.toolCalls[0]?.path).toBe('src/a.ts');
        expect(tail.lastAssistant).toBe('fertig');
    });

    it('resets at a genuine user prompt — a run three turns ago does not vouch', () => {
        const t = transcript(home, [
            user('erste aufgabe'),
            toolUse('Bash', { command: 'task test' }),
            say('grün'),
            user('zweite aufgabe'),
            toolUse('Edit', { file_path: 'src/b.ts' }),
            say('geändert'),
        ]);
        const tail = readTranscriptTail(t, { homeDir: home });
        expect(tail.toolCalls.map((c) => c.name)).toEqual(['Edit']);
        expect(detectUnverifiedEdit(tail.toolCalls)).not.toBeNull();
    });

    it('keeps the shell command so verification is answerable', () => {
        const t = transcript(home, [
            user('los'),
            toolUse('Write', { file_path: 'src/c.ts' }),
            toolUse('Bash', { command: 'npx vitest run tests/c.test.ts' }),
            say('grün'),
        ]);
        const tail = readTranscriptTail(t, { homeDir: home });
        expect(detectUnverifiedEdit(tail.toolCalls)).toBeNull();
    });

    it('ignores a sidechain entry — a subagent is not this turn', () => {
        const t = transcript(home, [
            user('los'),
            { ...toolUse('Edit', { file_path: 'src/d.ts' }), isSidechain: true },
            say('fertig'),
        ]);
        expect(readTranscriptTail(t, { homeDir: home }).toolCalls).toEqual([]);
    });
});
