/**
 * Keys under a `hook_manifest.yaml` platform block that are NOT lifecycle slots.
 *
 * One definition, because three consumers had grown their own literal and a
 * fourth key would have had to be added to each of them independently: the
 * manifest lint (which reads an unknown key as an unknown EVENT), the
 * injection-effect report (which counts slots per host), and the install
 * snapshot's drift guard (which asserts every manifest event is bound). Each
 * of those is a different question about the same block, and none of them is
 * asking about metadata.
 *
 *   `fallback_only`  this package binds nothing on the host; counting it made
 *                    copilot read one slot against the zero the host table
 *                    records.
 *   `ask`            the shape of the host's user-facing question primitive,
 *                    `native` or `text`. It binds no event, so counting it
 *                    would add one phantom slot to every host at once.
 *
 * A key added here is a key excluded from every event-shaped reading of the
 * manifest, so add one only when it genuinely carries no binding.
 */
export const PLATFORM_METADATA_KEYS: ReadonlySet<string> = new Set(['fallback_only', 'ask']);

/** True when a platform-block key describes the host rather than binding an event. */
export function isPlatformMetadataKey(key: string): boolean {
    return PLATFORM_METADATA_KEYS.has(key);
}
