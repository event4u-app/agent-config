/**
 * Every credential environment variable a shipped adapter or council client
 * reads, joined to the egress rule that masks its bare value — or to
 * `no-stable-prefix` where the value has no vendor prefix and only the
 * assignment and entropy rows can see it. A variable missing here is a key the
 * egress table was never asked about. Kept out of `egress_rules.ts` so the
 * bundled engine chunk does not carry it.
 */
export const CREDENTIAL_ENV_ROWS: readonly { readonly env: string; readonly rule: string | 'no-stable-prefix' }[] = [
    { env: 'ANTHROPIC_API_KEY', rule: 'anthropic-api-key' },
    { env: 'OPENAI_API_KEY', rule: 'openai-api-key' },
    { env: 'GEMINI_API_KEY', rule: 'google-api-key' },
    { env: 'XAI_API_KEY', rule: 'xai-api-key' },
    { env: 'PERPLEXITY_API_KEY', rule: 'perplexity-api-key' },
    { env: 'GROQ_API_KEY', rule: 'groq-api-key' },
    { env: 'HF_TOKEN', rule: 'huggingface-token' },
    { env: 'NVIDIA_API_KEY', rule: 'nvidia-api-key' },
    { env: 'REPLICATE_API_TOKEN', rule: 'replicate-api-token' },
    { env: 'AIV_ACCESS_KEY', rule: 'no-stable-prefix' },
    { env: 'AIV_SECRET_KEY', rule: 'no-stable-prefix' },
];

const CREDENTIAL_ENV_NAME = /(?:\$\{?|process\.env(?:\.|\[['"])|['"])([A-Z][A-Z0-9_]*(?:_API_KEY|_API_TOKEN|_TOKEN|_ACCESS_KEY|_SECRET_KEY|_SECRET))\b/g;

/** Credential-shaped environment variable names a source reads or names as a string. */
export function credentialEnvNames(source: string): string[] {
    return [...new Set([...source.matchAll(CREDENTIAL_ENV_NAME)].map((m) => m[1]!))].sort();
}

/** The names with no row in {@link CREDENTIAL_ENV_ROWS}. */
export function unmappedCredentialEnv(names: readonly string[]): string[] {
    const known = new Set(CREDENTIAL_ENV_ROWS.map((r) => r.env));
    return names.filter((n) => !known.has(n));
}

