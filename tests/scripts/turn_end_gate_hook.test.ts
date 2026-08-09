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

import { afterAll, describe, expect, it } from 'vitest';

import {
    detectLanguage,
    detectPromissory,
    deriveTurnKey,
    finalParagraph,
    readGateSettings,
    readLanguagePin,
    visibleProse,
} from '../../src/scripts/hooks/turn_end_gate_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const HOOK = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'turn_end_gate_hook.ts');
const TSX = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const tmp_dirs: string[] = [];
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
            '`concern_registry.ts` eingetragen; `readGateSettings` liest den Schalter.';
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
// Settings — the master switch and the two per-detector switches (3.6)
// ---------------------------------------------------------------------------

function makeWorkspace(settings?: string): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'turn-end-gate-')));
    tmp_dirs.push(dir);
    if (settings !== undefined) {
        fs.writeFileSync(path.join(dir, '.agent-settings.yml'), settings);
    }
    return dir;
}

describe('settings — default OFF, detectors ON within it (roadmap 3.6)', () => {
    it('absent settings file ⇒ disabled', () => {
        expect(readGateSettings(makeWorkspace()).enabled).toBe(false);
    });

    it('absent section ⇒ disabled — absent is never an opt-in', () => {
        expect(readGateSettings(makeWorkspace('hooks:\n  injection_scan:\n    enabled: true\n')).enabled).toBe(
            false,
        );
    });

    it('enabling the master switch turns BOTH detectors on without naming them', () => {
        const s = readGateSettings(
            makeWorkspace('hooks:\n  turn_end_gate:\n    enabled: true\n'),
        );
        expect(s).toEqual({ enabled: true, promissory: true, language: true });
    });

    it('either detector can be silenced without editing the hook manifest', () => {
        const s = readGateSettings(
            makeWorkspace(
                'hooks:\n  turn_end_gate:\n    enabled: true\n    language: false\n',
            ),
        );
        expect(s).toEqual({ enabled: true, promissory: true, language: false });
    });

    it('a SIBLING section’s `enabled:` is never read as ours', () => {
        // The indent-aware walker exists for exactly this: a width-agnostic
        // terminator would run past the block and pick up the next key's flag.
        const s = readGateSettings(
            makeWorkspace(
                'hooks:\n  turn_end_gate:\n    promissory: false\n  injection_scan:\n    enabled: true\n',
            ),
        );
        expect(s.enabled).toBe(false);
        expect(s.promissory).toBe(false);
    });
});

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

// ---------------------------------------------------------------------------
// Re-entrancy — through the real process (roadmap 3.1)
// ---------------------------------------------------------------------------

interface Run {
    status: number;
    stdout: string;
    stderr: string;
}

/** A workspace with the gate ON, a German pin, and a fake $HOME for transcripts. */
function makeGateWorkspace(): { dir: string; home: string } {
    const dir = makeWorkspace('hooks:\n  turn_end_gate:\n    enabled: true\n');
    fs.mkdirSync(path.join(dir, 'agents', 'state'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'agents', 'state', 'language-mirror.json'),
        JSON.stringify({ language: 'de', source: 'prompt' }),
    );
    const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'turn-end-gate-home-')));
    tmp_dirs.push(home);
    return { dir, home };
}

function writeTranscript(home: string, userText: string, assistantText: string): string {
    const file = path.join(home, `transcript-${Math.abs(hashish(assistantText))}.jsonl`);
    fs.writeFileSync(
        file,
        [
            JSON.stringify({ type: 'user', message: { content: userText } }),
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

function runHook(cwd: string, stdin: string, home: string): Run {
    const r = spawnSync(TSX, [HOOK], {
        encoding: 'utf8',
        cwd,
        input: stdin,
        env: { ...process.env, AGENT_CONFIG_TRANSCRIPT_HOME: home },
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const PROMISE = 'Der Branch steht.\n\nIch melde mich, sobald die CI grün ist.';
const CLEAN = 'Der Branch steht, die Tests sind grün, mehr war nicht zu tun.';

describe('the gate, end to end', () => {
    it('refuses a promissory closing with exit 1 and the reason on STDERR', () => {
        const { dir, home } = makeGateWorkspace();
        const t = writeTranscript(home, 'mach weiter', PROMISE);
        const r = runHook(dir, envelopeJson(dir, t), home);

        expect(r.status, r.stderr).toBe(1); // dispatcher-internal EXIT_BLOCK
        expect(r.stderr).toContain('turn-end-gate');
        expect(r.stderr).toContain('promissory');
        // stdout is discarded by the host at a block — the reason must not go there.
        expect(r.stdout).toBe('');
    });

    it('lets a clean turn end, silently', () => {
        const { dir, home } = makeGateWorkspace();
        const t = writeTranscript(home, 'mach weiter', CLEAN);
        const r = runHook(dir, envelopeJson(dir, t), home);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stderr).toBe('');
    });

    it('is a no-op while the master switch is off — the shipped default', () => {
        const dir = makeWorkspace(); // no settings file at all
        const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'turn-end-gate-home-')));
        tmp_dirs.push(home);
        const t = writeTranscript(home, 'mach weiter', PROMISE);
        const r = runHook(dir, envelopeJson(dir, t), home);
        expect(r.status, r.stderr).toBe(0);
    });

    // --- the two re-entrancy layers, each proven ALONE ---

    it('LAYER 1: `stop_hook_active` alone stops a second refusal', () => {
        const { dir, home } = makeGateWorkspace();
        const t = writeTranscript(home, 'mach weiter', PROMISE);
        // No prior run, so no state marker exists — only the host flag can
        // be doing the work here.
        const r = runHook(dir, envelopeJson(dir, t, { stop_hook_active: true }), home);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stderr).toBe('');
    });

    it('LAYER 2: the turn marker alone stops a second refusal, even on a NEW reply', () => {
        const { dir, home } = makeGateWorkspace();
        const first = runHook(dir, envelopeJson(dir, writeTranscript(home, 'mach weiter', PROMISE)), home);
        expect(first.status, first.stderr).toBe(1);

        // The model answered the refusal with a DIFFERENT reply that still
        // promises. Same user prompt ⇒ same turn ⇒ must not refuse again.
        // `stop_hook_active` is deliberately absent, so layer 2 is on its own.
        const second = runHook(
            dir,
            envelopeJson(dir, writeTranscript(home, 'mach weiter', 'Ok.\n\nIch melde mich gleich.')),
            home,
        );
        expect(second.status, second.stderr).toBe(0);
        expect(second.stderr).toBe('');
    });

    it('a NEW user prompt re-arms the gate — the marker must not wedge the session', () => {
        const { dir, home } = makeGateWorkspace();
        const first = runHook(dir, envelopeJson(dir, writeTranscript(home, 'erster prompt', PROMISE)), home);
        expect(first.status, first.stderr).toBe(1);

        const nextTurn = runHook(
            dir,
            envelopeJson(dir, writeTranscript(home, 'zweiter prompt', PROMISE)),
            home,
        );
        expect(nextTurn.status, nextTurn.stderr).toBe(1);
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
                AGENT_CONFIG_TRANSCRIPT_HOME: home,
            },
        },
    );
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('claude stop — the refusal actually reaches the host', () => {
    it('exits 2, not 1 — exit 1 on stop would let the turn end anyway', () => {
        const { dir, home } = makeGateWorkspace();
        const t = writeTranscript(home, 'mach weiter', PROMISE);
        const r = runDispatcher(dir, t, home);
        expect(r.status, `stderr: ${r.stderr.slice(0, 600)}`).toBe(2);
    });

    it('puts the concern’s OWN reason on stderr, not a generic label', () => {
        const { dir, home } = makeGateWorkspace();
        const t = writeTranscript(home, 'mach weiter', PROMISE);
        const r = runDispatcher(dir, t, home);
        expect(r.stderr).toContain('turn-end-gate');
        expect(r.stderr).not.toBe('blocked by agent-config hook policy\n');
    });

    it('a clean turn ends with 0 through the same path', () => {
        const { dir, home } = makeGateWorkspace();
        const t = writeTranscript(home, 'mach weiter', CLEAN);
        const r = runDispatcher(dir, t, home);
        expect(r.status, `stderr: ${r.stderr.slice(0, 600)}`).toBe(0);
    });
});

describe('the turn key', () => {
    it('is the same for the same turn and different across turns', () => {
        expect(deriveTurnKey('s', 'prompt A')).toBe(deriveTurnKey('s', 'prompt A'));
        expect(deriveTurnKey('s', 'prompt A')).not.toBe(deriveTurnKey('s', 'prompt B'));
        expect(deriveTurnKey('s1', 'prompt A')).not.toBe(deriveTurnKey('s2', 'prompt A'));
    });

    it('does NOT depend on the reply — that is the whole point', () => {
        // If the reply were part of the key, a refused turn would mint a new
        // key on its next reply and could be refused forever.
        const a = deriveTurnKey('s', 'prompt');
        const b = deriveTurnKey('s', 'prompt');
        expect(a).toBe(b);
    });
});
