/**
 * Shared error types for tool adapters.
 *
 * TypeScript twin of `src/scripts/tools/adapter_errors.py` (ADR-096 —
 * Python→TS migration, Phase 1 / tools adapter cluster). Public API mirrors
 * the Python module exactly (snake_case kept deliberately — fidelity over TS
 * idiom): the `AdapterErrorType` string enum, the `AdapterError` value shape
 * with its `is_retryable` property, and `classify_http_error`'s status-code →
 * error-type mapping. No behaviour changes.
 */

/** Categorized adapter errors (mirrors the `AdapterErrorType` str-Enum). */
export enum AdapterErrorType {
    AUTH_FAILURE = 'auth_failure',
    NOT_FOUND = 'not_found',
    RATE_LIMIT = 'rate_limit',
    TIMEOUT = 'timeout',
    NETWORK = 'network',
    VALIDATION = 'validation',
    UNKNOWN = 'unknown',
}

/**
 * Structured adapter error (mirrors the `AdapterError` dataclass).
 *
 * Construct via `makeAdapterError` to keep the same field defaults as the
 * Python dataclass (`status_code` / `retry_after` default to null).
 */
export interface AdapterError {
    adapter: string;
    action: string;
    error_type: AdapterErrorType;
    message: string;
    status_code: number | null;
    retry_after: number | null;
}

/** Build an `AdapterError` with Python dataclass defaults. */
export function makeAdapterError(args: {
    adapter: string;
    action: string;
    error_type: AdapterErrorType;
    message: string;
    status_code?: number | null;
    retry_after?: number | null;
}): AdapterError {
    return {
        adapter: args.adapter,
        action: args.action,
        error_type: args.error_type,
        message: args.message,
        status_code: args.status_code ?? null,
        retry_after: args.retry_after ?? null,
    };
}

/** Whether this error can be retried (mirrors the `is_retryable` property). */
export function is_retryable(error: AdapterError): boolean {
    return (
        error.error_type === AdapterErrorType.RATE_LIMIT ||
        error.error_type === AdapterErrorType.TIMEOUT ||
        error.error_type === AdapterErrorType.NETWORK
    );
}

/** Classify an HTTP error into a structured AdapterError. */
export function classify_http_error(
    adapter: string,
    action: string,
    status_code: number,
    message: string,
): AdapterError {
    let error_type: AdapterErrorType;
    if (status_code === 401 || status_code === 403) {
        error_type = AdapterErrorType.AUTH_FAILURE;
    } else if (status_code === 404) {
        error_type = AdapterErrorType.NOT_FOUND;
    } else if (status_code === 429) {
        error_type = AdapterErrorType.RATE_LIMIT;
    } else if (status_code >= 500) {
        error_type = AdapterErrorType.NETWORK;
    } else {
        error_type = AdapterErrorType.UNKNOWN;
    }

    return makeAdapterError({
        adapter,
        action,
        error_type,
        message,
        status_code,
    });
}
