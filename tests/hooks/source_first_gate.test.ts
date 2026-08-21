/**
 * source-first-gate — road-to-source-first-frontend Phase 3 Step 3.
 *
 * The step names four cases: fires / latched-silent / valve-exhausted /
 * no-handover-silent. All four are covered below, translated into the shadow
 * posture the concern actually ships in: "fires" is a candidate reading
 * `would_warn: true`, "silent" is that candidate reading false. The load-bearing
 * assertion is still the negative one — there is no input that makes this
 * concern warn, deny, or emit anything to the model.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CANDIDATES,
    MAX_SHADOW_WARNS,
    SHADOW_LOG,
    evaluateCandidates,
    extractEvent,
    isHandoverPath,
    nextState,
    processEnvelope,
    readState,
} from '../../src/scripts/hooks/source_first_gate_hook.js';
import { isArtifactRead } from '../../src/scripts/hooks/ui_route_nudge_hook.js';

let root: string;
const SESSION = 'sess-1';

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'source-first-gate-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function lines(): Array<Record<string, unknown>> {
    const file = path.join(root, SHADOW_LOG);
    if (!fs.existsSync(file)) return [];
    return fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

function verdict(line: Record<string, unknown>, label: string): boolean {
    const cands = line.candidates as Array<{ label: string; would_warn: boolean }>;
    return cands.find((c) => c.label === label)!.would_warn;
}

/** A capture-shaped tool call. */
function capture(tool = 'browser_take_screenshot', extra: Record<string, unknown> = {}) {
    return {
        schema_version: 1,
        platform: 'claude',
        event: 'pre_tool_use',
        session_id: SESSION,
        payload: { tool_name: tool, tool_input: {}, ...extra },
    };
}

/** A read/write of an arbitrary path. */
function fileEvent(tool: string, file: string, write = false) {
    const input: Record<string, unknown> = { file_path: file };
    if (write) input.content = '<html></html>';
    return {
        schema_version: 1,
        platform: 'claude',
        event: 'pre_tool_use',
        session_id: SESSION,
        payload: { tool_name: tool, tool_input: input },
    };
}

function plantHandoverOnDisk(): void {
    fs.mkdirSync(path.join(root, '.claude', 'design-system'), { recursive: true });
}

describe('source-first-gate — posture (the negative assertion)', () => {
    it('never warns and never denies: every input returns 0', () => {
        plantHandoverOnDisk();
        expect(processEnvelope(capture(), root, SESSION)).toBe(0);
        expect(processEnvelope(capture('mcp__claude-in-chrome__screenshot'), root, SESSION)).toBe(0);
        expect(processEnvelope(fileEvent('Read', '/x/design.html'), root, SESSION)).toBe(0);
        expect(processEnvelope('garbage', root, SESSION)).toBe(0);
        expect(processEnvelope({ event: 'pre_tool_use' }, root, SESSION)).toBe(0);
        expect(processEnvelope(null, root, SESSION)).toBe(0);
    });

    it('records posture: shadow on the line itself', () => {
        processEnvelope(capture(), root, SESSION);
        expect(lines()[0]!.posture).toBe('shadow');
    });
});

describe('source-first-gate — case 1: fires', () => {
    it('a handover named this session, unread, then a page capture → would_warn', () => {
        // Named without being read: a Grep whose `path` is the artifact.
        processEnvelope(fileEvent('Grep', '/proj/.claude/design-system/tokens.json', true), root, SESSION);
        processEnvelope(capture(), root, SESSION);

        const line = lines()[0]!;
        expect(line.handover_seen_in_session).toBe(true);
        expect(line.source_read_in_session).toBe(false);
        expect(line.capture_kind).toBe('page');
        expect(verdict(line, 'handover-session')).toBe(true);
    });

    it('a handover only on disk fires the disk candidate, not the session one', () => {
        plantHandoverOnDisk();
        processEnvelope(capture(), root, SESSION);

        const line = lines()[0]!;
        expect(line.handover_present_on_disk).toBe(true);
        expect(verdict(line, 'handover-disk')).toBe(true);
        // The two proxies are recorded side by side precisely so this can differ.
        expect(verdict(line, 'handover-session')).toBe(false);
        expect(verdict(line, 'handover-either')).toBe(true);
    });
});

describe('source-first-gate — case 2: latched silent', () => {
    it('reading the handover silences every candidate', () => {
        plantHandoverOnDisk();
        processEnvelope(fileEvent('Read', '/proj/artifacts/design.html'), root, SESSION);
        processEnvelope(capture(), root, SESSION);

        const line = lines()[0]!;
        expect(line.source_read_in_session).toBe(true);
        for (const c of CANDIDATES) expect(verdict(line, c.label)).toBe(false);
    });

    it('the latch survives across calls in the same session', () => {
        processEnvelope(fileEvent('Read', '/proj/design.html'), root, SESSION);
        expect(readState(root, SESSION).sourceRead).toBe(true);
        // …and does not leak into a different session.
        expect(readState(root, 'other').sourceRead).toBe(false);
    });

    it('a WRITE to a handover path latches presence but never the read', () => {
        // Writing the artifact is not reading it. Conflating the two would
        // silence the gate for the session that produced the file it should
        // have been porting from.
        processEnvelope(fileEvent('Write', '/proj/design.html', true), root, SESSION);
        const state = readState(root, SESSION);
        expect(state.handoverSeen).toBe(true);
        expect(state.sourceRead).toBe(false);
    });
});

describe('source-first-gate — case 3: valve exhausted', () => {
    it(`stops counting would-warns past MAX_SHADOW_WARNS (${MAX_SHADOW_WARNS})`, () => {
        plantHandoverOnDisk();
        for (let i = 0; i < MAX_SHADOW_WARNS + 2; i++) processEnvelope(capture(), root, SESSION);

        const all = lines();
        expect(all.length).toBe(MAX_SHADOW_WARNS + 2);
        // The valve arm is RECORDED, not applied: under shadow there is nothing
        // to suppress, and a record dropped past the valve would make the
        // future warn rung's fire volume unknowable.
        expect(all[0]!.valve_would_silence).toBe(false);
        expect(all[MAX_SHADOW_WARNS]!.valve_would_silence).toBe(true);
        expect(all[MAX_SHADOW_WARNS]!.prior_would_warn_this_session).toBe(MAX_SHADOW_WARNS);
        // The counter stops at the valve rather than growing without bound.
        expect(readState(root, SESSION).wouldWarn).toBe(MAX_SHADOW_WARNS);
    });
});

describe('source-first-gate — case 4: no handover, silent', () => {
    it('no handover on disk and none named → only the loosest candidate reads true', () => {
        processEnvelope(capture(), root, SESSION);
        const line = lines()[0]!;
        expect(verdict(line, 'handover-session')).toBe(false);
        expect(verdict(line, 'handover-disk')).toBe(false);
        expect(verdict(line, 'handover-either')).toBe(false);
        // `unread-only` is deliberately the fire-volume CEILING the other three
        // are read against, not a shippable rule.
        expect(verdict(line, 'unread-only')).toBe(true);
    });

    it('a non-capture tool records nothing at all', () => {
        processEnvelope(fileEvent('Read', '/proj/src/app.ts'), root, SESSION);
        processEnvelope(fileEvent('Write', '/proj/src/app.ts', true), root, SESSION);
        processEnvelope(capture('Bash', { tool_input: { command: 'ls -la' } }), root, SESSION);
        expect(lines()).toEqual([]);
    });
});

describe('source-first-gate — the matcher, and what it separates', () => {
    it('classifies page capture and display capture apart', () => {
        // The Phase-1 census finding, load-bearing: `screencapture` photographs
        // the physical display, so it cannot be the "screenshot instead of
        // source" path and a candidate warning on it is a false positive by
        // construction. Flip condition (b) computes its share from this field.
        processEnvelope(capture('browser_take_screenshot'), root, SESSION);
        processEnvelope(capture('Bash', { tool_input: { command: '/usr/sbin/screencapture -x out.png' } }), root, SESSION);

        const all = lines();
        expect(all[0]!.capture_kind).toBe('page');
        expect(all[0]!.tool_matcher).toBe('playwright-mcp');
        expect(all[1]!.capture_kind).toBe('display');
        expect(all[1]!.tool_matcher).toBe('macos-screencapture');
    });

    it('matches the claude-in-chrome prefix and the devtools shape', () => {
        expect(extractEvent(capture('mcp__claude-in-chrome__take_screenshot'))!.capture!.label).toBe(
            'claude-in-chrome',
        );
        expect(extractEvent(capture('take_screenshot'))!.capture!.label).toBe('chrome-devtools-mcp');
    });

    it('does not match an ordinary tool', () => {
        for (const tool of ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'Agent', 'Task']) {
            expect(extractEvent(capture(tool))!.capture).toBeNull();
        }
    });

    it('reads a shell command only for shell-shaped tool names', () => {
        // A `Read` whose file happens to be named screencapture.md must not
        // register as a capture.
        expect(extractEvent(fileEvent('Read', '/docs/screencapture.md'))!.capture).toBeNull();
    });
});

describe('source-first-gate — the verifier-exemption key, measured not assumed', () => {
    it('records absence as absence, without branching on it', () => {
        processEnvelope(capture(), root, SESSION);
        const line = lines()[0]!;
        // Both SLI Phase 0 Step 4 and Phase 4 Step 1 are open, so false is the
        // expected reading today; a run of trues is what makes the flip
        // condition's exemption clause satisfiable.
        expect(line.agent_id_present).toBe(false);
        expect(line.agent_type).toBeNull();
        expect(line.verifier_exemption_decidable).toBe(false);
    });

    it('records the key when the payload does carry it', () => {
        processEnvelope(capture('browser_take_screenshot', { agent_id: 'x', agent_type: 'Explore' }), root, SESSION);
        const line = lines()[0]!;
        expect(line.agent_id_present).toBe(true);
        expect(line.agent_type).toBe('Explore');
        expect(line.verifier_exemption_decidable).toBe(true);
    });

    it('never stores the agent id itself', () => {
        processEnvelope(capture('browser_take_screenshot', { agent_id: 'SECRET-ID-42' }), root, SESSION);
        expect(JSON.stringify(lines()[0])).not.toContain('SECRET-ID-42');
    });

    it('never stores a path or a command', () => {
        processEnvelope(
            capture('Bash', { tool_input: { command: '/usr/sbin/screencapture /Users/someone/private.png' } }),
            root,
            SESSION,
        );
        const serialized = JSON.stringify(lines()[0]);
        expect(serialized).not.toContain('/Users/someone');
        expect(serialized).not.toContain('private.png');
    });
});

describe('source-first-gate — the handover predicate does not drift from the rule copy', () => {
    it('accepts exactly the path shapes ui-route-nudge accepts, read-direction aside', () => {
        // `isArtifactRead` is the existing copy of `design-fidelity`'s two
        // file-shaped triggers. This concern needs the same shapes
        // direction-agnostically; pinning them together is what stops a second
        // copy of the rule's triggers from drifting silently.
        const handovers = [
            '/proj/design.html',
            '/proj/artifacts/DESIGN.HTML',
            '/proj/.claude/design-system/tokens.json',
            'C:\\proj\\.claude\\design-system\\x.json',
        ];
        for (const f of handovers) {
            expect(isHandoverPath(f)).toBe(true);
            expect(isArtifactRead({ file: f, isWrite: false })).toBe(true);
        }
        const others = ['/proj/src/app.ts', '/proj/design-system/tokens.json', '', '/proj/index.html'];
        for (const f of others) {
            expect(isHandoverPath(f)).toBe(false);
            expect(isArtifactRead({ file: f, isWrite: false })).toBe(false);
        }
    });

    it('differs from it only on write-direction, which is the whole point', () => {
        const write = { file: '/proj/design.html', isWrite: true };
        expect(isArtifactRead(write)).toBe(false);
        expect(isHandoverPath(write.file)).toBe(true);
    });
});

describe('source-first-gate — the candidate spread is a curve, not a verdict', () => {
    it('evaluates every candidate', () => {
        processEnvelope(capture(), root, SESSION);
        const labels = (lines()[0]!.candidates as Array<{ label: string }>).map((c) => c.label);
        expect(labels).toEqual(CANDIDATES.map((c) => c.label));
        expect(labels.length).toBeGreaterThan(1);
    });

    it('a read source zeroes the whole spread, in every handover configuration', () => {
        for (const seen of [true, false]) {
            for (const disk of [true, false]) {
                expect(evaluateCandidates(seen, disk, true).every((v) => !v.would_warn)).toBe(true);
            }
        }
    });

    it('state transition latches presence and read independently', () => {
        const start = { handoverSeen: false, sourceRead: false, wouldWarn: 0 };
        const read = nextState(
            { capture: null, file: '/p/design.html', isWrite: false, agentIdPresent: false, agentType: null },
            start,
        );
        expect(read).toEqual({ handoverSeen: true, sourceRead: true, wouldWarn: 0 });

        const written = nextState(
            { capture: null, file: '/p/design.html', isWrite: true, agentIdPresent: false, agentType: null },
            start,
        );
        expect(written).toEqual({ handoverSeen: true, sourceRead: false, wouldWarn: 0 });

        const unrelated = nextState(
            { capture: null, file: '/p/src/a.ts', isWrite: false, agentIdPresent: false, agentType: null },
            start,
        );
        expect(unrelated).toEqual(start);
    });
});
