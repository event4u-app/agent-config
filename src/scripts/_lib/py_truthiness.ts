/**
 * Python truthiness and dict checks shared by the council CLI and the modules
 * extracted from it, relocated out of `council_cli.ts` unchanged.
 */

type Dict = Record<string, unknown>;

export function _isDict(v: unknown): v is Dict {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function _pyBool(v: unknown): boolean {
    if (v === null || v === undefined) {
        return false;
    }
    if (typeof v === 'boolean') {
        return v;
    }
    if (typeof v === 'number') {
        return v !== 0;
    }
    if (typeof v === 'string') {
        return v.length > 0;
    }
    if (Array.isArray(v)) {
        return v.length > 0;
    }
    if (v instanceof Map || v instanceof Set) {
        return v.size > 0;
    }
    if (typeof v === 'object') {
        return Object.keys(v as Dict).length > 0;
    }
    return Boolean(v);
}
