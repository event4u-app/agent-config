/**
 * Friendly mappings for the validation / locking errors the server returns.
 *
 * Keep these short and Iron-Law-clean: every entry describes the user's
 * next action, not the internal error code. Unknown codes fall back to
 * the raw server message.
 */

export interface CopyContext {
    code: string;
    message: string;
    fields?: Array<{ path: string; message: string }>;
}

export function topLevelCopy(ctx: CopyContext): string {
    switch (ctx.code) {
        case 'VALIDATION':
            return 'Some fields need attention before saving.';
        case 'CONFLICT':
            return 'This file changed on disk while you were editing. Review the latest version and re-save.';
        case 'PRECONDITION_REQUIRED':
            return 'Reload the page once — the optimistic-lock token is missing.';
        case 'NOT_FOUND':
            return 'The file does not exist yet. Use the wizard to create it.';
        case 'ATOMIC_WRITE':
            return 'Write failed mid-flight. The file was not partially modified.';
        case 'YAML_PARSE':
            return 'YAML parse error — fix the file by hand, then reload.';
        default:
            return ctx.message;
    }
}

export function fieldCopy(zodMessage: string): string {
    if (/expected (boolean|string|number)/i.test(zodMessage)) {
        return zodMessage.replace(/^expected/i, 'Expected');
    }
    return zodMessage;
}

export function fieldErrorMap(ctx: CopyContext): Record<string, string> {
    const out: Record<string, string> = {};
    for (const f of ctx.fields ?? []) {
        out[f.path] = fieldCopy(f.message);
    }
    return out;
}
