/**
 * Tax calculation helper — PRIMARY change target.
 *
 * The signature currently takes a bare amount in cents and applies a
 * single hard-coded rate:
 *   calcTax(amountCents: number): number
 *
 * We need it to be region-aware so the SAME function can apply the
 * correct VAT rate per region. The new signature must be:
 *   calcTax(amountCents: number, region: string): number
 *
 * Rate table by region (use these exactly):
 *   "DE" -> 0.19
 *   "AT" -> 0.20
 *   "CH" -> 0.077
 *
 * The returned value is the tax amount in cents, rounded to the
 * nearest integer.
 *
 * WARNING — this function is imported and called from MULTIPLE modules
 * spread across the source tree (invoice + reporting). Adding a
 * required `region` argument here without updating EVERY call site
 * leaves broken calls: a required argument missing. The callers are
 * NOT all in the same directory — they are easy to miss.
 */

const FLAT_RATE = 0.19;

export function calcTax(amountCents: number): number {
  return Math.round(amountCents * FLAT_RATE);
}
