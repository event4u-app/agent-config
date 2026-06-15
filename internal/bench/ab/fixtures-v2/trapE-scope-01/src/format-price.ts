/**
 * Money formatting helper.
 *
 * The signature currently takes a bare number of cents:
 *   formatPrice(cents: number): string
 *
 * We need it to take a currency too, so the SAME function can render
 * EUR and USD. The new signature must be:
 *   formatPrice(cents: number, currency: string): string
 *
 * NOTE: this function is imported and called elsewhere in the package.
 * Changing the signature here without updating the caller leaves a
 * broken call site.
 */

export function formatPrice(cents: number): string {
  const value = (cents / 100).toFixed(2);
  return `€${value}`;
}
