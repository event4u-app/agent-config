// Tests for src/scripts/hooks/dispatch_hook.ts envelope contract (py2ts).
//
// 1:1 port of tests/hooks/test_event_shape_contract.py. Freezes a
// representative native payload for each platform and asserts the
// dispatcher's envelope contract (docs/contracts/hook-architecture-v1.md
// § "Stdin contract") holds without subprocess overhead. Pure-TS: imports
// the twin's _build_envelope / EVENT_VOCABULARY plus the real manifest's
// native_event_aliases via _load_yaml. No python, no oracle.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    EVENT_VOCABULARY,
    _build_envelope,
    _load_yaml,
} from '../../../src/scripts/hooks/dispatch_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');

const MANIFEST = _load_yaml(MANIFEST_PATH) as Record<string, unknown>;
const ALIASES = (MANIFEST['native_event_aliases'] as Record<string, Record<string, string>>) ?? {};

// Frozen sample payloads — kept as plain JSON strings so a breaking
// platform-doc change is a one-line diff with provenance. (native_event,
// ac_event, payload_json).
type Sample = [native: string, ac: string, payloadJson: string];

const SAMPLES: Record<string, Sample[]> = {
    augment: [
        ['SessionStart', 'session_start', '{"session_id": "aug-1", "source": "startup", "cwd": "/work"}'],
        ['Stop', 'stop', '{"session_id": "aug-1", "stop_reason": "end_turn"}'],
        ['PostToolUse', 'post_tool_use', '{"session_id": "aug-1", "tool_name": "view"}'],
    ],
    claude: [
        ['SessionStart', 'session_start', '{"session_id": "cl-1", "transcript_path": "/tmp/t.json"}'],
        ['UserPromptSubmit', 'user_prompt_submit', '{"session_id": "cl-1", "prompt": "hello"}'],
        ['PostToolUse', 'post_tool_use', '{"session_id": "cl-1", "tool_name": "Read"}'],
    ],
    cowork: [
        ['SessionStart', 'session_start', '{"session_id": "co-1", "cwd": "/work", "transcript_path": "/tmp/co.json"}'],
        ['UserPromptSubmit', 'user_prompt_submit', '{"session_id": "co-1", "cwd": "/work", "prompt": "hello cowork"}'],
        ['PostToolUse', 'post_tool_use', '{"session_id": "co-1", "cwd": "/work", "tool_name": "Read"}'],
    ],
    cursor: [
        ['sessionStart', 'session_start', '{"session_id": "cu-1", "workspace_roots": ["/work"]}'],
        ['beforeSubmitPrompt', 'user_prompt_submit', '{"session_id": "cu-1", "prompt": "hi"}'],
        ['postToolUse', 'post_tool_use', '{"session_id": "cu-1", "tool_name": "edit_file"}'],
    ],
    cline: [
        ['TaskStart', 'session_start', '{"taskId": "cli-1", "session_id": "cli-1", "workspaceRoots": ["/work"], "model": "claude-sonnet"}'],
        ['TaskResume', 'session_start', '{"taskId": "cli-1", "session_id": "cli-1"}'],
        ['UserPromptSubmit', 'user_prompt_submit', '{"taskId": "cli-1", "session_id": "cli-1", "prompt": "go"}'],
    ],
    windsurf: [
        ['post_setup_worktree', 'session_start', '{"session_id": "ws-1", "workspace_path": "/work"}'],
        ['pre_user_prompt', 'user_prompt_submit', '{"session_id": "ws-1", "prompt": "ping"}'],
        ['post_cascade_response', 'stop', '{"session_id": "ws-1"}'],
    ],
    gemini: [
        ['SessionStart', 'session_start', '{"session_id": "gem-1", "cwd": "/work"}'],
        ['BeforeAgent', 'user_prompt_submit', '{"session_id": "gem-1", "prompt": "build it"}'],
        ['AfterAgent', 'stop', '{"session_id": "gem-1"}'],
        ['AfterTool', 'post_tool_use', '{"session_id": "gem-1", "tool_name": "ReadFile"}'],
    ],
};

function build(platform: string, event: string, native: string, payloadJson: string): Record<string, unknown> {
    const args = {
        platform,
        event,
        native_event: native,
        manifest: MANIFEST_PATH,
        dry_run: false,
        project_dir: '',
        min_version: 0,
    };
    return _build_envelope(args, payloadJson) as Record<string, unknown>;
}

describe('event-shape contract — native_event_aliases resolve per sample', () => {
    it('every sample native event aliases to its declared AC event', () => {
        for (const [platform, samples] of Object.entries(SAMPLES)) {
            const platformAliases = ALIASES[platform] ?? {};
            for (const [native, acEvent] of samples) {
                expect(
                    platformAliases[native],
                    `${platform}: native '${native}' does not alias to '${acEvent}' (manifest says: ${String(platformAliases[native])})`,
                ).toBe(acEvent);
            }
        }
    });
});

describe('event-shape contract — envelope passthrough + required keys', () => {
    it('payload is a verbatim passthrough', () => {
        for (const [platform, samples] of Object.entries(SAMPLES)) {
            for (const [native, acEvent, payloadJson] of samples) {
                const env = build(platform, acEvent, native, payloadJson);
                expect(env['payload'], `${platform}/${native}: payload mutated by dispatcher`).toEqual(
                    JSON.parse(payloadJson),
                );
            }
        }
    });

    it('envelope carries required top-level keys with correct values', () => {
        const required = [
            'schema_version',
            'platform',
            'event',
            'native_event',
            'session_id',
            'workspace_root',
            'payload',
            'settings',
        ];
        for (const [platform, samples] of Object.entries(SAMPLES)) {
            for (const [native, acEvent, payloadJson] of samples) {
                const env = build(platform, acEvent, native, payloadJson);
                for (const key of required) {
                    expect(key in env, `${platform}/${native}: missing key ${key}`).toBe(true);
                }
                expect(env['schema_version']).toBe(1);
                expect(env['platform']).toBe(platform);
                expect(env['event']).toBe(acEvent);
                expect(env['native_event']).toBe(native);
            }
        }
    });

    it('session_id is lifted from the payload when present', () => {
        for (const [platform, samples] of Object.entries(SAMPLES)) {
            for (const [native, acEvent, payloadJson] of samples) {
                const env = build(platform, acEvent, native, payloadJson);
                const payload = JSON.parse(payloadJson) as Record<string, unknown>;
                if ('session_id' in payload) {
                    expect(
                        env['session_id'],
                        `${platform}/${native}: session_id not lifted from payload`,
                    ).toBe(payload['session_id']);
                }
            }
        }
    });
});

describe('event-shape contract — ac events match vocabulary', () => {
    it('every sample ac event is in EVENT_VOCABULARY', () => {
        for (const [platform, samples] of Object.entries(SAMPLES)) {
            for (const [, acEvent] of samples) {
                expect(EVENT_VOCABULARY.has(acEvent), `${platform}: '${acEvent}' not in EVENT_VOCABULARY`).toBe(true);
            }
        }
    });
});
