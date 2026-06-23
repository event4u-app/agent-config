// Intent tests for work_engine/errors.ts (ADR-094 py2ts Phase 1). errors is a
// leaf module: one exception class `_CLIError` whose only contract is "is an
// Error subclass, carries its message, name is `_CLIError`". The python
// byte-parity rig is gone; this asserts the tsx twin's own contract directly.
import { describe, expect, it } from 'vitest';

import { _CLIError } from '../../../src/agent-src/templates/scripts/work_engine/errors.js';

describe('work_engine/errors — _CLIError', () => {
    it('is an Error subclass carrying its message', () => {
        const e = new _CLIError('boom');
        expect(e).toBeInstanceOf(Error);
        expect(e).toBeInstanceOf(_CLIError);
        expect(e.message).toBe('boom');
        expect(e.name).toBe('_CLIError');
    });

    it('throws and is catchable as _CLIError', () => {
        expect(() => {
            throw new _CLIError('cfg problem');
        }).toThrow(_CLIError);
    });

    it('empty message round-trips', () => {
        const e = new _CLIError();
        expect(e.message).toBe('');
        expect(e).toBeInstanceOf(_CLIError);
    });
});
