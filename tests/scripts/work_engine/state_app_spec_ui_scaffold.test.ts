// Pure-TS gap coverage for the `state` twin's `_validate_app_spec` and
// `_validate_ui_scaffold` rejection paths — ported from the python spec
// `tests/work_engine/test_state_schema.py` (TestAppSpecEnvelope +
// TestUiScaffoldEnvelope). No python3, no golden oracle: build a payload,
// call `from_dict`, assert the round-trip or the SchemaError message.
//
// The existing `state.test.ts` golden rig covers `app_spec` / `ui_scaffold`
// only via the populated FULL_ENVELOPE round-trip; the per-field rejection
// branches below are otherwise untested on the TS side.
import { describe, expect, it } from 'vitest';

import {
    DEFAULT_DIRECTIVE_SET,
    DEFAULT_INTENT,
    type JsonValue,
    SCHEMA_VERSION,
    SchemaError,
    from_dict,
    to_dict,
} from '../../../src/agent-src/templates/scripts/work_engine/state.js';

type JsonObject = Record<string, unknown>;

/** Build a minimal v1 payload with an optional extra slot merged in. */
function payload(extra: JsonObject = {}): JsonValue {
    return {
        version: SCHEMA_VERSION,
        input: { kind: 'ticket', data: {} },
        intent: DEFAULT_INTENT,
        directive_set: DEFAULT_DIRECTIVE_SET,
        ...extra,
    } as JsonValue;
}

describe('work_engine/state — _validate_app_spec rejection + round-trip', () => {
    it('default app_spec is null and serialises as null', () => {
        const state = from_dict(payload());
        expect(state.app_spec).toBeNull();
        expect(to_dict(state)['app_spec']).toBeNull();
    });

    it('round-trips a fully-populated app_spec', () => {
        const spec = {
            pages: ['Dashboard', 'Board'],
            entity_model: ['Board', 'Task'],
            flow_map: { Dashboard: ['Board'] },
            confirmed: true,
            bypassed: false,
        };
        const rebuilt = from_dict(to_dict(from_dict(payload({ app_spec: spec }))));
        expect(rebuilt.app_spec).toEqual(spec);
    });

    it('accepts flow_map as a list', () => {
        const rebuilt = from_dict(
            payload({ app_spec: { pages: ['Home'], flow_map: [] } }),
        );
        expect((rebuilt.app_spec as JsonObject)['flow_map']).toEqual([]);
    });

    it('rejects non-list pages', () => {
        expect(() => from_dict(payload({ app_spec: { pages: 'Home' } }))).toThrow(
            /state\.app_spec\.pages must be a list/,
        );
    });

    it('rejects non-bool confirmed', () => {
        expect(() =>
            from_dict(payload({ app_spec: { pages: ['Home'], confirmed: 'yes' } })),
        ).toThrow(/state\.app_spec\.confirmed/);
    });

    it('rejects a bad flow_map (string is neither list nor object)', () => {
        expect(() =>
            from_dict(
                payload({ app_spec: { pages: ['Home'], flow_map: 'linear' } }),
            ),
        ).toThrow(/state\.app_spec\.flow_map/);
    });

    it('rejects app_spec that is not an object', () => {
        expect(() =>
            from_dict(payload({ app_spec: ['not', 'an', 'object'] })),
        ).toThrow(/state\.app_spec must be a JSON object/);
    });

    it('throws SchemaError (not a generic Error) on a bad app_spec', () => {
        expect(() => from_dict(payload({ app_spec: { pages: 'Home' } }))).toThrow(
            SchemaError,
        );
    });
});

describe('work_engine/state — _validate_ui_scaffold rejection + round-trip', () => {
    it('default ui_scaffold is null and serialises as null', () => {
        const state = from_dict(payload());
        expect(state.ui_scaffold).toBeNull();
        expect(to_dict(state)['ui_scaffold']).toBeNull();
    });

    it('round-trips a fully-populated ui_scaffold', () => {
        const plan = {
            pages: ['Dashboard', 'Board'],
            routes: ['/', '/board/:id'],
            layout_strategy: 'sidebar-shell',
            component_manifest: ['AppShell', 'BoardGrid'],
            token_seed: { radius: '0.5rem', primary: '#2563eb' },
            scaffolded: true,
            artifacts: ['src/App.tsx'],
        };
        const rebuilt = from_dict(
            to_dict(from_dict(payload({ ui_scaffold: plan }))),
        );
        expect(rebuilt.ui_scaffold).toEqual(plan);
    });

    it('rejects non-list routes', () => {
        expect(() =>
            from_dict(payload({ ui_scaffold: { routes: '/' } })),
        ).toThrow(/state\.ui_scaffold\.routes must be a list/);
    });

    it('rejects non-string layout_strategy', () => {
        expect(() =>
            from_dict(payload({ ui_scaffold: { layout_strategy: ['sidebar'] } })),
        ).toThrow(/layout_strategy must be a string/);
    });

    it('rejects non-object token_seed', () => {
        expect(() =>
            from_dict(payload({ ui_scaffold: { token_seed: ['primary'] } })),
        ).toThrow(/token_seed must be a JSON object/);
    });

    it('rejects non-bool scaffolded', () => {
        expect(() =>
            from_dict(
                payload({ ui_scaffold: { routes: ['/'], scaffolded: 'yes' } }),
            ),
        ).toThrow(/state\.ui_scaffold\.scaffolded/);
    });

    it('rejects ui_scaffold that is not an object', () => {
        expect(() =>
            from_dict(payload({ ui_scaffold: ['not', 'an', 'object'] })),
        ).toThrow(/state\.ui_scaffold must be a JSON object/);
    });

    it('throws SchemaError (not a generic Error) on a bad ui_scaffold', () => {
        expect(() =>
            from_dict(payload({ ui_scaffold: { routes: '/' } })),
        ).toThrow(SchemaError);
    });
});
